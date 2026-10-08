//! Minimal owner authentication using the existing identity and session tables.
//! Passwords match Better Auth 1.6.29 / @better-auth/utils 0.5.0 exactly.
use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Request, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use subtle::ConstantTimeEq;
use tokio::sync::Semaphore;
use unicode_normalization::UnicodeNormalization;

const FIXTURE_HASH: &str = "00112233445566778899aabbccddeeff:0f41509d7afa42f50405a64fee8db01ba40f9016a7f011477989a0af876e15d9745b07f4499f1b8e12e40de191be30daba9c2289b89ddff8e79a40f86304bc14";

#[derive(Clone)]
struct AuthState {
    pool: PgPool,
    hashing: Arc<Semaphore>,
    // Local server global rate bound; no unbounded per-address/email allocations.
    attempts: Arc<Mutex<(Instant, u32)>>,
}

pub fn routes(pool: PgPool) -> Router {
    Router::new()
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/session", get(session))
        .route("/api/v1/auth/logout", post(logout))
        .layer(DefaultBodyLimit::max(2048))
        .layer(axum::middleware::from_fn(no_store))
        .with_state(AuthState {
            pool,
            hashing: Arc::new(Semaphore::new(2)),
            attempts: Arc::new(Mutex::new((Instant::now(), 0))),
        })
}

async fn no_store(request: Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

#[derive(Debug, Serialize, Clone)]
pub struct User {
    pub id: String,
    pub name: String,
    pub email: String,
    pub role: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionResponse {
    user: User,
    expires_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginResponse {
    token: String,
    user: User,
    expires_at: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Login {
    email: String,
    password: String,
}

#[derive(Debug)]
pub struct AuthError(StatusCode, &'static str);
impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (self.0, Json(serde_json::json!({ "message": self.1 }))).into_response()
    }
}
fn unauthorized() -> AuthError {
    AuthError(StatusCode::UNAUTHORIZED, "Authentication required")
}
fn unavailable(_: sqlx::Error) -> AuthError {
    AuthError(
        StatusCode::SERVICE_UNAVAILABLE,
        "Authentication temporarily unavailable",
    )
}
fn user(row: &sqlx::postgres::PgRow) -> User {
    User {
        id: row.get("id"),
        name: row.get("name"),
        email: row.get("email"),
        role: row.get("role"),
    }
}

/// Better Auth salts are hexadecimal TEXT passed as UTF-8 to scrypt, not decoded bytes.
fn verify_password(hash: &str, password: &str) -> bool {
    let Some((salt, key)) = hash.split_once(':') else {
        return false;
    };
    if salt.len() != 32 || !salt.bytes().all(|c| c.is_ascii_hexdigit()) {
        return false;
    }
    let Ok(expected) = hex::decode(key) else {
        return false;
    };
    if expected.len() != 64 {
        return false;
    }
    let normalized: String = password.nfkc().collect();
    let mut actual = [0; 64];
    let params = scrypt::Params::new(14, 16, 1, 64).expect("fixed valid scrypt parameters");
    if scrypt::scrypt(normalized.as_bytes(), salt.as_bytes(), &params, &mut actual).is_err() {
        return false;
    }
    bool::from(actual.as_slice().ct_eq(&expected))
}

fn session_key(token: &str) -> Option<String> {
    let value = token.strip_prefix("nh1_")?;
    if value.len() != 64 || !value.bytes().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some(format!(
        "nh1:{}",
        hex::encode(Sha256::digest(token.as_bytes()))
    ))
}
fn bearer(headers: &HeaderMap) -> Result<String, AuthError> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .and_then(session_key)
        .ok_or_else(unauthorized)
}

async fn login(
    State(state): State<AuthState>,
    Json(input): Json<Login>,
) -> Result<Json<LoginResponse>, AuthError> {
    if input.email.len() > 254
        || input.email.is_empty()
        || input.password.len() > 512
        || input.password.chars().count() > 128
        || input.password.is_empty()
    {
        return Err(AuthError(StatusCode::BAD_REQUEST, "Invalid login fields"));
    }
    {
        let mut attempts = state.attempts.lock().map_err(|_| {
            AuthError(
                StatusCode::SERVICE_UNAVAILABLE,
                "Authentication temporarily unavailable",
            )
        })?;
        if attempts.0.elapsed() >= Duration::from_secs(60) {
            *attempts = (Instant::now(), 0);
        }
        if attempts.1 >= 20 {
            return Err(AuthError(StatusCode::TOO_MANY_REQUESTS, "Try again later"));
        }
        attempts.1 += 1;
    }
    let permit = state
        .hashing
        .clone()
        .try_acquire_owned()
        .map_err(|_| AuthError(StatusCode::TOO_MANY_REQUESTS, "Try again later"))?;
    let row = sqlx::query("SELECT u.id, u.name, u.email, u.role, c.password FROM auth_users u JOIN auth_accounts c ON c.user_id=u.id AND c.provider_id='credential' JOIN accounts a ON a.auth_user_id=u.id WHERE lower(u.email)=lower($1) AND u.role='owner' AND a.status='active' AND (NOT u.banned OR u.ban_expires <= now()) LIMIT 1")
        .bind(input.email.trim()).fetch_optional(&state.pool).await.map_err(unavailable)?;
    let hash = row
        .as_ref()
        .and_then(|r| r.get::<Option<String>, _>("password"))
        .unwrap_or_else(|| FIXTURE_HASH.to_owned());
    let valid = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        verify_password(&hash, &input.password)
    })
    .await
    .map_err(|_| {
        AuthError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Authentication temporarily unavailable",
        )
    })?;
    let Some(row) = row.filter(|_| valid) else {
        return Err(AuthError(StatusCode::UNAUTHORIZED, "Invalid credentials"));
    };
    let user = user(&row);
    let mut random = [0u8; 32];
    getrandom::fill(&mut random).map_err(|_| {
        AuthError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Authentication temporarily unavailable",
        )
    })?;
    let token = format!("nh1_{}", hex::encode(random));
    let key = session_key(&token).expect("generated token valid");
    let mut transaction = state.pool.begin().await.map_err(unavailable)?;
    sqlx::query("SET TRANSACTION READ WRITE")
        .execute(&mut *transaction)
        .await
        .map_err(unavailable)?;
    // Recheck account state after the slow password verification. Hash equality prevents a
    // concurrent password reset from issuing a session using the previous credential.
    let expires_at: Option<String> = sqlx::query_scalar("INSERT INTO auth_sessions (id, token, user_id, expires_at) SELECT $1, $2, u.id, now()+interval '7 days' FROM auth_users u JOIN accounts a ON a.auth_user_id=u.id JOIN auth_accounts c ON c.user_id=u.id AND c.provider_id='credential' WHERE u.id=$3 AND u.role='owner' AND a.status='active' AND (NOT u.banned OR u.ban_expires <= now()) AND c.password=$4 RETURNING to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")
        .bind(format!("session:{key}")).bind(&key).bind(&user.id).bind(row.get::<Option<String>,_>("password"))
        .fetch_optional(&mut *transaction).await.map_err(unavailable)?;
    let expires_at = expires_at.ok_or_else(unauthorized)?;
    transaction.commit().await.map_err(unavailable)?;
    Ok(Json(LoginResponse {
        token,
        user,
        expires_at,
    }))
}

async fn lookup(pool: &PgPool, headers: &HeaderMap) -> Result<SessionResponse, AuthError> {
    let key = bearer(headers)?;
    let row = sqlx::query("SELECT u.id, u.name, u.email, u.role, to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS expires_at FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id JOIN accounts a ON a.auth_user_id=u.id WHERE s.token=$1 AND s.expires_at > now() AND u.role='owner' AND a.status='active' AND (NOT u.banned OR u.ban_expires <= now())")
        .bind(key).fetch_optional(pool).await.map_err(unavailable)?.ok_or_else(unauthorized)?;
    Ok(SessionResponse {
        user: user(&row),
        expires_at: row.get("expires_at"),
    })
}
async fn session(
    State(state): State<AuthState>,
    headers: HeaderMap,
) -> Result<Json<SessionResponse>, AuthError> {
    lookup(&state.pool, &headers).await.map(Json)
}
async fn logout(
    State(state): State<AuthState>,
    headers: HeaderMap,
) -> Result<StatusCode, AuthError> {
    let key = bearer(&headers)?;
    let mut transaction = state.pool.begin().await.map_err(unavailable)?;
    sqlx::query("SET TRANSACTION READ WRITE")
        .execute(&mut *transaction)
        .await
        .map_err(unavailable)?;
    sqlx::query("DELETE FROM auth_sessions WHERE token=$1")
        .bind(key)
        .execute(&mut *transaction)
        .await
        .map_err(unavailable)?;
    transaction.commit().await.map_err(unavailable)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn require_owner(
    State(pool): State<PgPool>,
    mut request: Request,
    next: Next,
) -> Result<Response, AuthError> {
    let session = lookup(&pool, request.headers()).await?;
    request.extensions_mut().insert(session.user);
    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn verifies_node_scrypt_fixture_and_rejects_bad_password() {
        assert!(verify_password(FIXTURE_HASH, "fixture-password"));
        assert!(!verify_password(FIXTURE_HASH, "wrong"));
    }
    #[test]
    fn normalizes_unicode_like_better_auth() {
        let hash = "00112233445566778899aabbccddeeff:817adae5fe2fbe423824692734e71eba7d85a9e3a391ffe7aa69bb60dd8659184ca8f95443801fdcc1b558490060b7d0f9e12df4005c4938fb1d11e75a7658bc";
        assert!(verify_password(hash, "Ｆｉｘｔｕｒｅ\u{212b}"));
        assert!(verify_password(hash, "FixtureÅ"));
    }
    #[test]
    fn malformed_hashes_and_tokens_are_rejected() {
        for hash in ["", "salt:key", "00112233445566778899aabbccddeeff:00"] {
            assert!(!verify_password(hash, "test"));
        }
        for token in ["", "legacy-better-auth-token", "nh1_00"] {
            assert!(session_key(token).is_none());
        }
        let token = format!("nh1_{}", "01".repeat(32));
        let key = session_key(&token).unwrap();
        assert!(key.starts_with("nh1:"));
        assert!(!key.contains(&token));
    }
    #[tokio::test]
    async fn missing_or_malformed_bearer_fails_without_database_access() {
        let pool = crate::database_pool("postgresql://127.0.0.1:1/nahhasio_test").unwrap();
        assert_eq!(
            lookup(&pool, &HeaderMap::new()).await.err().unwrap().0,
            StatusCode::UNAUTHORIZED
        );
    }
}
