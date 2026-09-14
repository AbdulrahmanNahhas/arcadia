//! Launch-time switches for profiling the shell without a debug build.
//!
//! `ARCADIA_DEVTOOLS=1` (or `--devtools`) opens the WebKit inspector on the main window as soon as
//! the page has loaded; `ARCADIA_LOG=debug|info|warn|error` sets the log level (release builds
//! default to `warn`, debug builds to `info`). Startup milestones are logged at `info` with the
//! elapsed time since the process started, which is the number Phase T1 of `docs/v0.3.5.md`
//! asks for: run with `ARCADIA_LOG=info` and read `page loaded` from the log.

use std::time::Instant;

use tauri::webview::PageLoadEvent;
use tauri::{Manager, Runtime, Webview};

/// Process start, as close to `main` as a static allows. Read by the page-load hook.
pub struct StartedAt(pub Instant);

pub fn wants_devtools() -> bool {
  std::env::args().any(|arg| arg == "--devtools")
    || std::env::var("ARCADIA_DEVTOOLS").is_ok_and(|value| value == "1")
}

pub fn log_level() -> log::LevelFilter {
  let configured = std::env::var("ARCADIA_LOG").ok();
  match configured
    .as_deref()
    .map(str::to_ascii_lowercase)
    .as_deref()
  {
    Some("trace") => log::LevelFilter::Trace,
    Some("debug") => log::LevelFilter::Debug,
    Some("info") => log::LevelFilter::Info,
    Some("warn") => log::LevelFilter::Warn,
    Some("error") => log::LevelFilter::Error,
    Some("off") => log::LevelFilter::Off,
    _ if cfg!(debug_assertions) => log::LevelFilter::Info,
    _ => log::LevelFilter::Warn,
  }
}

/// Wired through `Builder::on_page_load`. `Started` fires when navigation begins, `Finished` when
/// the document has loaded — the second one is "the shell is on screen" for our purposes, since
/// the SPA paints synchronously from the prerendered `index.html`.
pub fn on_page_load<R: Runtime>(webview: &Webview<R>, event: PageLoadEvent) {
  let elapsed = webview
    .try_state::<StartedAt>()
    .map(|started| started.0.elapsed().as_millis())
    .unwrap_or_default();
  match event {
    PageLoadEvent::Started => log::info!("page load started at +{elapsed} ms"),
    PageLoadEvent::Finished => {
      log::info!("page loaded at +{elapsed} ms");
      if wants_devtools() {
        webview.open_devtools();
      }
    }
  }
}
