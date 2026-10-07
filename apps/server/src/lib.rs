use std::time::Duration;

use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use serde::Serialize;
use sqlx::{PgPool, postgres::PgPoolOptions};
use tower_http::trace::TraceLayer;

/// The foundation connects read-only. Catalog mutations are introduced in a later phase.
pub fn database_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(2))
        .after_connect(|connection, _| {
            Box::pin(async move {
                sqlx::query("SET default_transaction_read_only = on")
                    .execute(connection)
                    .await?;
                Ok(())
            })
        })
        .connect_lazy(database_url)
}

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/api/health/live", get(live))
        .route("/api/health/ready", get(ready))
        .layer(TraceLayer::new_for_http())
        .with_state(pool)
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

async fn live() -> Json<Health> {
    Json(Health { status: "alive" })
}

async fn ready(State(pool): State<PgPool>) -> (StatusCode, Json<Health>) {
    match sqlx::query("SELECT 1").execute(&pool).await {
        Ok(_) => (StatusCode::OK, Json(Health { status: "ready" })),
        Err(error) => {
            if let sqlx::Error::Database(database_error) = &error {
                tracing::warn!(
                    code = database_error.code().as_deref().unwrap_or("unknown"),
                    message = database_error.message(),
                    "database readiness check failed"
                );
            } else {
                tracing::warn!(kind = ?std::mem::discriminant(&error), "database readiness check failed");
            }
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(Health {
                    status: "unavailable",
                }),
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    use super::*;

    fn unavailable_database() -> PgPool {
        database_pool("postgresql://127.0.0.1:1/nahhasio_test").expect("valid fixture URL")
    }

    #[tokio::test]
    async fn liveness_does_not_depend_on_database_availability() {
        let response = router(unavailable_database())
            .oneshot(
                Request::get("/api/health/live")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn readiness_reports_unavailable_database() {
        let response = router(unavailable_database())
            .oneshot(
                Request::get("/api/health/ready")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn catalog_is_not_exposed_before_authentication_is_implemented() {
        let response = router(unavailable_database())
            .oneshot(Request::get("/api/v1/titles").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
