//! Network work runs on Tokio workers. The session token never enters the UI.
use crate::bridge::{Error, Request, valid_id};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use reqwest::{Client, Method, Response};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};
use tokio::sync::{Mutex, Semaphore};
use url::Url;

#[derive(Clone)]
pub struct Services {
    client: Client,
    base: Url,
    token: Arc<Mutex<Option<String>>>,
    pub permits: Arc<Semaphore>,
    network_permits: Arc<Semaphore>,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Login {
    email: String,
    password: String,
}
#[derive(Deserialize, Serialize)]
struct User {
    id: String,
    name: String,
    email: String,
    role: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginResponse {
    token: String,
    user: User,
    expires_at: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Resource {
    id: String,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Browse {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    genre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_from: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_to: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    include_private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    planet: Option<String>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    view: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    privacy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    filters: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_from: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_to: Option<u32>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RecommendationQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    work_id: Option<String>,
}
fn parse<T: serde::de::DeserializeOwned>(value: Value) -> Result<T, Error> {
    serde_json::from_value(value).map_err(|_| Error::new("bad_request", "Invalid command fields"))
}
fn network(_: reqwest::Error) -> Error {
    Error::new(
        "network",
        "Cannot reach the server. Check that devenv is running.",
    )
}
impl Services {
    pub fn new(base: &str) -> Result<Self, Error> {
        let base =
            Url::parse(base).map_err(|_| Error::new("configuration", "Invalid server address"))?;
        if base.username() != ""
            || base.password().is_some()
            || base.query().is_some()
            || base.fragment().is_some()
            || base.path() != "/"
            || !(base.scheme() == "https"
                || (base.scheme() == "http"
                    && matches!(base.host_str(), Some("127.0.0.1" | "localhost" | "::1"))))
        {
            return Err(Error::new(
                "configuration",
                "Server must use HTTPS or a loopback HTTP address",
            ));
        }
        let client = Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(3))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(network)?;
        Ok(Self {
            client,
            base,
            token: Arc::new(Mutex::new(None)),
            permits: Arc::new(Semaphore::new(64)),
            network_permits: Arc::new(Semaphore::new(6)),
        })
    }
    fn url(&self, path: &str) -> Url {
        self.base.join(path).expect("fixed API route")
    }
    async fn body(&self, mut response: Response, max: usize) -> Result<Vec<u8>, Error> {
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            *self.token.lock().await = None;
            return Err(Error::new(
                "unauthorized",
                "Your session has expired. Sign in again.",
            ));
        }
        if !response.status().is_success() {
            return Err(Error::new(
                "server",
                match response.status().as_u16() {
                    401 => "Invalid credentials",
                    429 => "Too many attempts. Try again shortly.",
                    _ => "The server could not complete this request.",
                },
            ));
        }
        if response.content_length().is_some_and(|n| n > max as u64) {
            return Err(Error::new(
                "too_large",
                "Server response exceeds the desktop limit",
            ));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(network)? {
            if bytes.len() + chunk.len() > max {
                return Err(Error::new(
                    "too_large",
                    "Server response exceeds the desktop limit",
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        Ok(bytes)
    }
    async fn json(&self, response: Response) -> Result<Value, Error> {
        let body = self.body(response, 2 * 1024 * 1024).await?;
        serde_json::from_slice(&body)
            .map_err(|_| Error::new("response", "The server sent an invalid response"))
    }
    async fn authorized(
        &self,
        method: Method,
        path: &str,
    ) -> Result<reqwest::RequestBuilder, Error> {
        let token = self
            .token
            .lock()
            .await
            .clone()
            .ok_or_else(|| Error::new("unauthorized", "Sign in to browse your library"))?;
        Ok(self
            .client
            .request(method, self.url(path))
            .bearer_auth(token))
    }
    pub async fn execute(&self, request: Request) -> Result<Value, Error> {
        let _permit = self
            .network_permits
            .acquire()
            .await
            .map_err(|_| Error::new("internal", "Desktop requests stopped"))?;
        match request.command.as_str() {
            "login" => {
                let input: Login = parse(request.payload)?;
                if input.email.len() > 254
                    || input.password.len() > 512
                    || input.email.trim().is_empty()
                    || input.password.is_empty()
                {
                    return Err(Error::new("bad_request", "Enter an email and password"));
                }
                // Serialize session changes; neither login data nor token is logged or returned.
                let mut token = self.token.lock().await;
                let response = self
                    .client
                    .post(self.url("api/v1/auth/login"))
                    .json(&input)
                    .send()
                    .await
                    .map_err(network)?;
                if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                    return Err(Error::new("unauthorized", "Email or password is incorrect"));
                }
                if !response.status().is_success() {
                    return Err(Error::new("server", "Sign in failed. Try again shortly."));
                }
                let bytes = bounded_body(response, 16 * 1024).await?;
                let login: LoginResponse = serde_json::from_slice(&bytes)
                    .map_err(|_| Error::new("response", "Invalid login response"))?;
                *token = Some(login.token);
                Ok(json!({"user":login.user,"expiresAt":login.expires_at}))
            }
            "logout" => {
                let mut token = self.token.lock().await;
                let old = token.take();
                if let Some(old) = old {
                    let response = self
                        .client
                        .post(self.url("api/v1/auth/logout"))
                        .bearer_auth(old)
                        .send()
                        .await
                        .map_err(network)?;
                    if !response.status().is_success()
                        && response.status() != reqwest::StatusCode::UNAUTHORIZED
                    {
                        return Err(Error::new(
                            "server",
                            "Signed out locally; server session could not be revoked",
                        ));
                    }
                }
                Ok(Value::Null)
            }
            "session" => {
                if self.token.lock().await.is_none() {
                    return Ok(Value::Null);
                }
                let response = self
                    .authorized(Method::GET, "api/v1/auth/session")
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                    *self.token.lock().await = None;
                    return Ok(Value::Null);
                }
                self.json(response).await
            }
            "works" => {
                let input: Browse = parse(request.payload)?;
                if input.page_size.is_some_and(|n| n > 100 || n == 0)
                    || input.page.is_some_and(|n| n == 0 || n > 100_000)
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                {
                    return Err(Error::new("bad_request", "Invalid catalog pagination"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/works")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "browse" | "facets" => {
                let input: CatalogQuery = parse(request.payload)?;
                if input.page_size.is_some_and(|n| n == 0 || n > 100)
                    || input.page.is_some_and(|n| n == 0 || n > 100_000)
                    || input.q.as_ref().is_some_and(|v| v.chars().count() > 200)
                    || input.filters.as_ref().is_some_and(|v| v.len() > 8000)
                {
                    return Err(Error::new("bad_request", "Invalid catalog query"));
                }
                let path = if request.command == "browse" {
                    "api/v1/catalog/browse"
                } else {
                    "api/v1/catalog/facets"
                };
                let response = self
                    .authorized(Method::GET, path)
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "recommendations" => {
                let input: RecommendationQuery = parse(request.payload)?;
                if input.work_id.as_ref().is_some_and(|id| !valid_id(id)) {
                    return Err(Error::new("bad_request", "Invalid catalog identifier"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/catalog/recommendations")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "filters" | "home" => {
                let response = self
                    .authorized(
                        Method::GET,
                        if request.command == "home" {
                            "api/v1/catalog/home"
                        } else {
                            "api/v1/catalog/filters"
                        },
                    )
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "work" | "artwork" => {
                let resource: Resource = parse(request.payload)?;
                if !valid_id(&resource.id) {
                    return Err(Error::new("bad_request", "Invalid catalog identifier"));
                }
                let is_art = request.command == "artwork";
                let path = format!(
                    "api/v1/{}/{}",
                    if is_art { "artwork" } else { "works" },
                    resource.id
                );
                let response = self
                    .authorized(Method::GET, &path)
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                if !is_art {
                    return self.json(response).await;
                }
                if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                    *self.token.lock().await = None;
                    return Err(Error::new(
                        "unauthorized",
                        "Your session has expired. Sign in again.",
                    ));
                }
                if !response.status().is_success() {
                    return Err(Error::new("server", "Artwork is currently unavailable"));
                }
                let mime = response
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .split(';')
                    .next()
                    .unwrap_or("")
                    .to_owned();
                if !matches!(
                    mime.as_str(),
                    "image/jpeg" | "image/png" | "image/webp" | "image/avif"
                ) {
                    return Err(Error::new("response", "Unsupported artwork format"));
                }
                let bytes = self.body(response, 8 * 1024 * 1024).await?;
                Ok(json!({"dataUrl":format!("data:{mime};base64,{}",STANDARD.encode(bytes))}))
            }
            "appInfo" => Ok(
                json!({"version":env!("CARGO_PKG_VERSION"),"apiUrl":self.base.as_str(),"platform":"linux","playerAvailable":false}),
            ),
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
async fn bounded_body(mut response: Response, max: usize) -> Result<Vec<u8>, Error> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(network)? {
        if bytes.len() + chunk.len() > max {
            return Err(Error::new(
                "too_large",
                "Server response exceeds the desktop limit",
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn server_addresses_reject_plaintext_remote_and_credentials() {
        assert!(Services::new("http://127.0.0.1:23103").is_ok());
        assert!(Services::new("http://192.168.1.2:23103").is_err());
        assert!(Services::new("https://user:secret@example.org").is_err());
        assert!(Services::new("https://example.org/path").is_err());
    }
    #[tokio::test]
    async fn login_keeps_credentials_native_and_expired_session_clears_them() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("local test listener");
        let address = listener.local_addr().expect("local address");
        let server = std::thread::spawn(move || {
            for (status, body) in [
                (
                    "200 OK",
                    r#"{"token":"fixture-only-token","user":{"id":"owner","name":"Test","email":"test@example.invalid","role":"owner"},"expiresAt":"2030-01-01T00:00:00Z"}"#,
                ),
                ("401 Unauthorized", r#"{"message":"expired"}"#),
            ] {
                let (mut stream, _) = listener.accept().expect("request");
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .expect("timeout");
                let mut incoming = Vec::new();
                loop {
                    let mut chunk = [0; 1024];
                    let count = stream.read(&mut chunk).expect("bounded request");
                    assert!(count > 0 && incoming.len() + count <= 4096);
                    incoming.extend_from_slice(&chunk[..count]);
                    if let Some(end) = incoming.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                        let headers = String::from_utf8_lossy(&incoming[..end]);
                        let length = headers
                            .lines()
                            .find_map(|line| {
                                line.to_ascii_lowercase()
                                    .strip_prefix("content-length:")
                                    .and_then(|value| value.trim().parse::<usize>().ok())
                            })
                            .unwrap_or(0);
                        if incoming.len() >= end + 4 + length {
                            break;
                        }
                    }
                }
                write!(stream, "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).expect("response");
            }
        });
        let service = Services::new(&format!("http://{address}/")).expect("service");
        let login = service
            .execute(Request {
                id: "login".into(),
                command: "login".into(),
                payload: json!({"email":"test@example.invalid","password":"fixture-only"}),
            })
            .await
            .expect("login should succeed");
        assert!(login.get("token").is_none());
        assert!(login.get("password").is_none());
        assert_eq!(login["user"]["id"], "owner");
        assert!(service.token.lock().await.is_some());
        let session = service
            .execute(Request {
                id: "session".into(),
                command: "session".into(),
                payload: json!({}),
            })
            .await
            .expect("expired session is signed out");
        assert!(session.is_null());
        assert!(service.token.lock().await.is_none());
        server.join().expect("mock server completed");
    }
}
