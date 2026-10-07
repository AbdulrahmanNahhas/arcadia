use std::{env, error::Error, net::SocketAddr};

use nahhasio_server::{database_pool, router_with_admin};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let address: SocketAddr = env::var("NAHHASIO_BIND")
        .unwrap_or_else(|_| "127.0.0.1:23103".to_owned())
        .parse()?;
    let database_url = env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required")?;
    let pool = database_pool(&database_url).map_err(|_| "DATABASE_URL is invalid")?;
    let local_admin = env::var("NAHHASIO_LOCAL_ADMIN").as_deref() == Ok("true");
    if local_admin && (!cfg!(debug_assertions) || !address.ip().is_loopback()) {
        return Err("Local administration requires a debug build bound to loopback".into());
    }
    let token = if local_admin {
        Some(env::var("NAHHASIO_LOCAL_ADMIN_TOKEN").map_err(|_| "Local admin token is required")?)
    } else {
        None
    };
    if token.as_ref().is_some_and(|value| value.len() < 32) {
        return Err("Local admin token must contain at least 32 characters".into());
    }
    let listener = TcpListener::bind(address).await?;
    tracing::info!(%address, "Nahhasio server listening");

    axum::serve(listener, router_with_admin(pool.clone(), token))
        .with_graceful_shutdown(shutdown())
        .await?;
    pool.close().await;
    Ok(())
}

async fn shutdown() {
    let interrupt = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "failed to install interrupt handler");
        }
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => {
                tracing::error!(%error, "failed to install termination handler");
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = interrupt => {},
        () = terminate => {},
    }
}
