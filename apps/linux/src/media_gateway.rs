//! Private native byte-range gateway. No browser access, paths, URLs or execution.
use crate::media_range;
use axum::{
    Router,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, Method, StatusCode, header},
    response::Response,
    routing::get,
};
use media_transfer::{Cancellation, Engine, File, PlaybackLease, TorrentId};
use std::{
    io,
    pin::Pin,
    sync::Arc,
    task::{Context, Poll},
    time::Duration,
};
use subtle::ConstantTimeEq;
use tokio::sync::{OwnedSemaphorePermit, Semaphore, mpsc, oneshot};
use tokio_stream::{Stream, wrappers::ReceiverStream};

#[derive(Clone)]
struct Target {
    engine: Engine,
    id: TorrentId,
    file: File,
    token: String,
    host: String,
    cancel: Cancellation,
    readers: Arc<Semaphore>,
}

pub struct Gateway {
    pub id: TorrentId,
    pub file: File,
    endpoint: String,
    cancel: Cancellation,
    shutdown: Option<oneshot::Sender<()>>,
    lease: Option<PlaybackLease>,
    runtime: tokio::runtime::Handle,
}

impl Gateway {
    pub async fn start(
        engine: Engine,
        id: TorrentId,
        file: File,
        lease: PlaybackLease,
    ) -> io::Result<Self> {
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await?;
        let host = listener.local_addr()?.to_string();
        let mut entropy = [0u8; 32];
        getrandom::fill(&mut entropy)
            .map_err(|_| io::Error::other("Could not create native stream capability"))?;
        let token = hex::encode(entropy);
        let endpoint = format!("http://{host}/video/{token}");
        let cancel = Cancellation::default();
        let target = Target {
            engine,
            id: id.clone(),
            file: file.clone(),
            token,
            host,
            cancel: cancel.clone(),
            readers: Arc::new(Semaphore::new(8)),
        };
        let router = Router::new()
            .route("/video/{capability}", get(serve))
            .with_state(target);
        let (shutdown, stopped) = oneshot::channel();
        tokio::spawn(async move {
            let _ = axum::serve(listener, router)
                .with_graceful_shutdown(async {
                    let _ = stopped.await;
                })
                .await;
        });
        Ok(Self {
            id,
            file,
            endpoint,
            cancel,
            shutdown: Some(shutdown),
            lease: Some(lease),
            runtime: tokio::runtime::Handle::current(),
        })
    }
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }
}
impl Drop for Gateway {
    fn drop(&mut self) {
        self.cancel.cancel();
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
        // Releasing a lease can wait on the bounded engine queue; never do that on GTK.
        if let Some(lease) = self.lease.take() {
            self.runtime.spawn_blocking(move || drop(lease));
        }
    }
}

struct ResponseStream {
    receiver: ReceiverStream<Result<Vec<u8>, io::Error>>,
    cancel: Cancellation,
    _permit: OwnedSemaphorePermit,
}
impl Stream for ResponseStream {
    type Item = Result<Vec<u8>, io::Error>;
    fn poll_next(self: Pin<&mut Self>, context: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        Pin::new(&mut self.get_mut().receiver).poll_next(context)
    }
}
impl Drop for ResponseStream {
    fn drop(&mut self) {
        self.cancel.cancel();
    }
}

async fn serve(
    State(target): State<Target>,
    Path(token): Path<String>,
    method: Method,
    headers: HeaderMap,
) -> Response {
    if headers.contains_key(header::ORIGIN)
        || headers
            .get(header::HOST)
            .and_then(|value| value.to_str().ok())
            != Some(target.host.as_str())
        || token.len() != target.token.len()
        || !bool::from(token.as_bytes().ct_eq(target.token.as_bytes()))
    {
        return response(StatusCode::FORBIDDEN, Body::empty());
    }
    if target.cancel.is_cancelled() {
        return response(StatusCode::GONE, Body::empty());
    }
    let raw = match headers.get(header::RANGE) {
        Some(value) => match value.to_str() {
            Ok(value) => Some(value),
            Err(_) => return unsatisfiable(target.file.size),
        },
        None => None,
    };
    let range = match media_range::parse(raw, target.file.size) {
        Ok(range) => range,
        Err(_) => return unsatisfiable(target.file.size),
    };
    let status = if range.partial {
        StatusCode::PARTIAL_CONTENT
    } else {
        StatusCode::OK
    };
    let body = if method == Method::HEAD || range.length == 0 {
        Body::empty()
    } else {
        let Ok(permit) = target.readers.clone().try_acquire_owned() else {
            return response(StatusCode::SERVICE_UNAVAILABLE, Body::empty());
        };
        let cancel = Cancellation::child_of(&target.cancel);
        let (send, receive) = mpsc::channel(2);
        tokio::spawn({
            let cancel = cancel.clone();
            let target = target.clone();
            async move {
                let mut offset = range.offset;
                let mut remaining = range.length;
                while remaining > 0 && !cancel.is_cancelled() && !target.cancel.is_cancelled() {
                    let length = remaining.min(256 * 1024) as usize;
                    let engine = target.engine.clone();
                    let id = target.id.clone();
                    let file = target.file.index;
                    let read_cancel = cancel.clone();
                    let task = tokio::task::spawn_blocking(move || {
                        engine.read_range(
                            &id,
                            file,
                            offset,
                            length,
                            Duration::from_secs(15),
                            &read_cancel,
                        )
                    });
                    let result = tokio::select! {
                        _ = send.closed() => { cancel.cancel(); break; }
                        result = task => result,
                    };
                    let bytes = match result {
                        Ok(Ok(bytes)) if bytes.len() == length => bytes,
                        _ => {
                            let _ = send
                                .send(Err(io::Error::other("Verified media range is unavailable")))
                                .await;
                            break;
                        }
                    };
                    if send.send(Ok(bytes)).await.is_err() {
                        cancel.cancel();
                        break;
                    }
                    offset += length as u64;
                    remaining -= length as u64;
                }
            }
        });
        Body::from_stream(ResponseStream {
            receiver: ReceiverStream::new(receive),
            cancel,
            _permit: permit,
        })
    };
    let mut builder = Response::builder()
        .status(status)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, range.length)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CACHE_CONTROL, "no-store")
        .header("X-Content-Type-Options", "nosniff");
    if let Some(content_range) = range.content_range(target.file.size) {
        builder = builder.header(header::CONTENT_RANGE, content_range);
    }
    builder
        .body(body)
        .unwrap_or_else(|_| response(StatusCode::INTERNAL_SERVER_ERROR, Body::empty()))
}
fn response(status: StatusCode, body: Body) -> Response {
    let mut response = Response::new(body);
    *response.status_mut() = status;
    response
}
fn unsatisfiable(length: u64) -> Response {
    Response::builder()
        .status(StatusCode::RANGE_NOT_SATISFIABLE)
        .header(header::CONTENT_RANGE, format!("bytes */{length}"))
        .body(Body::empty())
        .unwrap_or_else(|_| response(StatusCode::INTERNAL_SERVER_ERROR, Body::empty()))
}
