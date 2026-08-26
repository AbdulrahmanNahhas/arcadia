use std::net::{Ipv4Addr, SocketAddr};
use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use librqbit::Session;
use rand::Rng;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use crate::error::{PlayerError, PlayerResult};

/// mpv needs a URL, so a custom `tauri://` protocol is not an option — the torrent has to be
/// served over real HTTP. Two rules follow from that, and both matter:
///
/// * **`127.0.0.1` is not a permission boundary.** Every process on the machine can reach a
///   loopback port. The port is therefore ephemeral (bound to 0, discovered at runtime) and every
///   URL carries a per-session random token in its path.
/// * **Only this read route is exposed.** librqbit's own HTTP API includes torrent *control*
///   endpoints; none of it is mounted here.
pub struct StreamServer {
  address: SocketAddr,
  token: String,
}

#[derive(Clone)]
struct ServerState {
  session: Arc<Session>,
  token: Arc<String>,
}

impl StreamServer {
  /// Binds to an ephemeral loopback port and serves until `session`'s runtime goes away.
  pub async fn start(session: Arc<Session>) -> PlayerResult<Self> {
    let token: String = {
      let mut rng = rand::rng();
      (0..32)
        .map(|_| {
          let alphabet = b"abcdefghijklmnopqrstuvwxyz0123456789";
          alphabet[rng.random_range(0..alphabet.len())] as char
        })
        .collect()
    };

    let state = ServerState {
      session,
      token: Arc::new(token.clone()),
    };
    let router = Router::new()
      .route("/stream/{token}/{torrent_id}/{file_idx}", get(serve_file))
      .with_state(state);

    let listener = tokio::net::TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))
      .await
      .map_err(|error| PlayerError::StreamServer(error.to_string()))?;
    let address = listener
      .local_addr()
      .map_err(|error| PlayerError::StreamServer(error.to_string()))?;

    tauri::async_runtime::spawn(async move {
      if let Err(error) = axum::serve(listener, router).await {
        log::error!("local stream server stopped: {error}");
      }
    });

    Ok(Self { address, token })
  }

  /// The URL handed to mpv. Includes the token, so it is a capability — do not log it.
  pub fn stream_url(&self, torrent_id: usize, file_idx: usize) -> String {
    format!(
      "http://{}/stream/{}/{}/{}",
      self.address, self.token, torrent_id, file_idx
    )
  }
}

/// Serves one file out of one torrent, honouring `Range`. mpv seeks by issuing a fresh ranged
/// request, and librqbit's `FileStream` re-prioritises pieces when it is seeked — that pairing is
/// what makes seeking into an undownloaded region resume rather than stall forever.
async fn serve_file(
  State(state): State<ServerState>,
  Path((token, torrent_id, file_idx)): Path<(String, usize, usize)>,
  headers: HeaderMap,
) -> Response {
  // Constant-time-ish comparison is overkill for a loopback capability, but a length check
  // first avoids leaking anything through an early mismatch on a wildly wrong token.
  if token.len() != state.token.len() || token != *state.token {
    return StatusCode::NOT_FOUND.into_response();
  }

  let Some(handle) = state.session.get(torrent_id.into()) else {
    return StatusCode::NOT_FOUND.into_response();
  };
  let mut stream = match handle.stream(file_idx).await {
    Ok(stream) => stream,
    Err(error) => {
      log::warn!("stream open failed for torrent {torrent_id} file {file_idx}: {error}");
      return StatusCode::NOT_FOUND.into_response();
    }
  };

  let total = stream.len();
  let range = headers
    .get(header::RANGE)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| parse_range(value, total));

  let (status, start, end) = match range {
    Some(Some((start, end))) => (StatusCode::PARTIAL_CONTENT, start, end),
    // A syntactically valid but unsatisfiable range — the one case RFC 9110 wants a 416 for.
    Some(None) => {
      let mut response = StatusCode::RANGE_NOT_SATISFIABLE.into_response();
      response.headers_mut().insert(
        header::CONTENT_RANGE,
        HeaderValue::from_str(&format!("bytes */{total}")).expect("ascii"),
      );
      return response;
    }
    None => (StatusCode::OK, 0, total.saturating_sub(1)),
  };

  if start > 0 {
    if let Err(error) = stream.seek(std::io::SeekFrom::Start(start)).await {
      log::warn!("stream seek failed: {error}");
      return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }
  }

  let length = end.saturating_sub(start).saturating_add(1);
  let body = Body::from_stream(ReaderStream::new(stream.take(length)));

  let mut response = Response::builder()
    .status(status)
    .header(header::ACCEPT_RANGES, "bytes")
    .header(header::CONTENT_TYPE, "video/x-matroska")
    .header(header::CONTENT_LENGTH, length);
  if status == StatusCode::PARTIAL_CONTENT {
    response = response.header(
      header::CONTENT_RANGE,
      format!("bytes {start}-{end}/{total}"),
    );
  }
  response
    .body(body)
    .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// `Ok(Some((start, end)))` for a satisfiable single range, `Ok(None)` for an unsatisfiable one,
/// and `None` when the header is absent or malformed enough that ignoring it is correct.
///
/// Only single ranges are handled: mpv never asks for a multipart range, and answering a
/// multi-range request with the whole body is a legal response.
fn parse_range(value: &str, total: u64) -> Option<Option<(u64, u64)>> {
  let spec = value.strip_prefix("bytes=")?.trim();
  if spec.contains(',') {
    return None;
  }
  let (raw_start, raw_end) = spec.split_once('-')?;
  if total == 0 {
    return Some(None);
  }
  let last = total - 1;

  let range = match (raw_start.trim(), raw_end.trim()) {
    // `bytes=-500` — the final 500 bytes.
    ("", suffix) => {
      let length: u64 = suffix.parse().ok()?;
      if length == 0 {
        return Some(None);
      }
      (total.saturating_sub(length), last)
    }
    // `bytes=500-` — from 500 to the end.
    (start, "") => {
      let start: u64 = start.parse().ok()?;
      if start > last {
        return Some(None);
      }
      (start, last)
    }
    (start, end) => {
      let start: u64 = start.parse().ok()?;
      let end: u64 = end.parse().ok()?;
      if start > last || end < start {
        return Some(None);
      }
      (start, end.min(last))
    }
  };
  Some(Some(range))
}

#[cfg(test)]
mod tests {
  use super::parse_range;

  #[test]
  fn reads_an_explicit_range() {
    assert_eq!(parse_range("bytes=0-499", 1000), Some(Some((0, 499))));
    assert_eq!(parse_range("bytes=500-999", 1000), Some(Some((500, 999))));
  }

  #[test]
  fn clamps_an_open_ended_or_overlong_range_to_the_file() {
    assert_eq!(parse_range("bytes=500-", 1000), Some(Some((500, 999))));
    assert_eq!(parse_range("bytes=0-99999", 1000), Some(Some((0, 999))));
  }

  #[test]
  fn reads_a_suffix_range_from_the_end() {
    assert_eq!(parse_range("bytes=-500", 1000), Some(Some((500, 999))));
    assert_eq!(parse_range("bytes=-99999", 1000), Some(Some((0, 999))));
  }

  #[test]
  fn reports_an_unsatisfiable_range_separately_from_a_malformed_one() {
    assert_eq!(parse_range("bytes=1000-1200", 1000), Some(None));
    assert_eq!(parse_range("bytes=900-800", 1000), Some(None));
    assert_eq!(parse_range("bytes=0-499", 0), Some(None));
    assert_eq!(parse_range("lines=0-499", 1000), None);
    assert_eq!(parse_range("bytes=abc-def", 1000), None);
  }

  #[test]
  fn ignores_a_multi_range_request_instead_of_answering_it_wrongly() {
    assert_eq!(parse_range("bytes=0-99,200-299", 1000), None);
  }
}
