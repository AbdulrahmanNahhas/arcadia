mod diagnostics;
mod downloads;
mod error;
mod player;
mod torrent;

use std::sync::Arc;

use tauri::ipc::Channel;
use tauri::{Manager, RunEvent, State, WindowEvent};
use tokio::sync::Mutex;

use downloads::registry::{DownloadItem, DownloadTarget};
use downloads::{DownloadEvent, DownloadManager, DownloadSnapshot};
use error::{PlayerError, PlayerResult};
use player::surface::{UiRect, VideoLayout, attach_video_surface, refresh_video_layout};
use player::{EventSink, MpvEngine, PlayerEvent, new_event_sink};
use torrent::{StartedStream, StreamCandidate, TorrentEngine};

/// Commands defined in this crate and registered through `generate_handler!` need no capability
/// entry — the ACL gates *plugin* commands and core APIs, not app commands. `capabilities/
/// default.json` therefore only grows entries for the core APIs the player actually calls.
pub struct AppState {
  /// One long-lived librqbit session, built once during `setup` on Tauri's own runtime.
  torrent: Mutex<Option<Arc<TorrentEngine>>>,
  /// Kept downloads on the same session; ready right after the torrent engine is.
  downloads: Mutex<Option<Arc<DownloadManager>>>,
  /// Created on the first `player_init`: the video surface needs a realized window to attach to.
  player: Mutex<Option<Arc<MpvEngine>>>,
  events: EventSink,
  /// How much of the window the controls reserve; the video surface is inset to match.
  layout: Mutex<Option<VideoLayout>>,
  /// Cancels the transfer-progress pump when the stream stops.
  progress: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
}

impl AppState {
  async fn engine(&self) -> PlayerResult<Arc<MpvEngine>> {
    self
      .player
      .lock()
      .await
      .clone()
      .ok_or_else(|| PlayerError::EngineUnavailable("the player is not initialised".into()))
  }

  async fn downloads(&self) -> PlayerResult<Arc<DownloadManager>> {
    self
      .downloads
      .lock()
      .await
      .clone()
      .ok_or_else(|| PlayerError::Download("the download manager is not ready".into()))
  }

  async fn transfers(&self) -> PlayerResult<Arc<TorrentEngine>> {
    self
      .torrent
      .lock()
      .await
      .clone()
      .ok_or_else(|| PlayerError::TorrentRejected("the torrent session is not ready".into()))
  }
}

/// Subscribing before anything else means the UI sees the `resolving`/`attempt` events that a
/// slow first candidate produces, instead of staring at a spinner until the stream is up.
#[tauri::command]
async fn player_subscribe(
  state: State<'_, Arc<AppState>>,
  on_event: Channel<PlayerEvent>,
) -> PlayerResult<()> {
  if let Ok(mut sink) = state.events.lock() {
    *sink = Some(on_event);
  }
  Ok(())
}

/// Builds the video surface and the mpv engine. Idempotent: the surface is only created once.
#[tauri::command]
async fn player_init(window: tauri::Window, state: State<'_, Arc<AppState>>) -> PlayerResult<()> {
  let mut player = state.player.lock().await;
  if player.is_some() {
    return Ok(());
  }
  // The video surface swallows pointer events the webview would otherwise see (it is a native
  // X11 window covering the whole area — see `surface::watch_pointer`), so the surface itself
  // reports movement back over the event channel instead.
  let sink = state.events.clone();
  let layout = attach_video_surface(&window, move || {
    publish_event(&sink, PlayerEvent::PointerMoved);
  })?;
  *player = Some(Arc::new(MpvEngine::new(
    layout.xid(),
    state.events.clone(),
  )?));
  *state.layout.lock().await = Some(layout);
  Ok(())
}

/// Walks the API's ranked candidates until one plays, then points mpv at the local stream URL.
#[tauri::command]
async fn player_start_stream(
  state: State<'_, Arc<AppState>>,
  candidates: Vec<StreamCandidate>,
) -> PlayerResult<StartedStream> {
  let engine = state.engine().await?;
  let transfers = state.transfers().await?;
  stop_progress_pump(&state).await;

  let sink = state.events.clone();
  publish_event(&sink, PlayerEvent::Resolving);
  let started = transfers
    .start_stream(&candidates, |candidate_id, index, total| {
      publish_event(
        &sink,
        PlayerEvent::Attempt {
          candidate_id: candidate_id.to_string(),
          index,
          total,
        },
      );
    })
    .await?;

  engine.load(&started.url)?;
  if started.torrent_id.is_some() {
    start_progress_pump(&state, transfers).await;
  }
  Ok(started)
}

/// Tells the video surface where the interface is, and whether to be on screen at all.
///
/// X11 cannot blend the video surface with the webview above it (see `player/surface.rs`), so the
/// surface is shaped instead: `regions` are cut out of it and the controls show through. An empty
/// list gives the whole window back to the picture. `visible: false` hides the surface outright,
/// which is what stops the last decoded frame lingering over the app after leaving the player.
#[tauri::command]
async fn player_set_overlay(
  window: tauri::Window,
  state: State<'_, Arc<AppState>>,
  visible: bool,
  regions: Vec<UiRect>,
) -> PlayerResult<()> {
  let layout = state.layout.lock().await.clone();
  let Some(layout) = layout else { return Ok(()) };
  layout.set(visible, regions);
  refresh_video_layout(&window, &layout)
}

#[tauri::command]
async fn player_play(state: State<'_, Arc<AppState>>) -> PlayerResult<()> {
  state.engine().await?.set_paused(false)
}

#[tauri::command]
async fn player_pause(state: State<'_, Arc<AppState>>) -> PlayerResult<()> {
  state.engine().await?.set_paused(true)
}

#[tauri::command]
async fn player_seek(state: State<'_, Arc<AppState>>, seconds: f64) -> PlayerResult<()> {
  state.engine().await?.seek(seconds)
}

#[tauri::command]
async fn player_set_volume(state: State<'_, Arc<AppState>>, volume: f64) -> PlayerResult<()> {
  state.engine().await?.set_volume(volume)
}

#[tauri::command]
async fn player_set_property(
  state: State<'_, Arc<AppState>>,
  name: String,
  value: String,
) -> PlayerResult<()> {
  state.engine().await?.set_property(&name, &value)
}

#[tauri::command]
async fn player_get_property(
  state: State<'_, Arc<AppState>>,
  name: String,
) -> PlayerResult<String> {
  state.engine().await?.get_property(&name)
}

/// Writes a downloaded subtitle to the cache directory and loads it (roadmap Phase 2). The
/// caller (`getInstallmentSubtitles`/the subtitle menu) already did the authenticated fetch
/// against the API's OpenSubtitles proxy — this command's whole job is turning those bytes into a
/// path `sub-add` can open, since libmpv's subtitle loader takes a filesystem path, not a byte
/// buffer, and the video plane's own local-HTTP-URL trick doesn't apply to something this small.
#[tauri::command]
async fn player_load_subtitle(
  app: tauri::AppHandle,
  state: State<'_, Arc<AppState>>,
  bytes: Vec<u8>,
  filename: String,
) -> PlayerResult<()> {
  let dir = app
    .path()
    .app_cache_dir()
    .map_err(|error| PlayerError::SubtitleUnavailable(error.to_string()))?
    .join("subtitles");
  std::fs::create_dir_all(&dir)
    .map_err(|error| PlayerError::SubtitleUnavailable(error.to_string()))?;
  // Strips any path components the caller's filename might carry, so this can never write
  // outside the subtitle cache directory.
  let safe_name = std::path::Path::new(&filename)
    .file_name()
    .map(|name| name.to_string_lossy().into_owned())
    .filter(|name| !name.is_empty())
    .unwrap_or_else(|| "subtitle.srt".to_string());
  let path = dir.join(safe_name);
  std::fs::write(&path, &bytes)
    .map_err(|error| PlayerError::SubtitleUnavailable(error.to_string()))?;
  state.engine().await?.load_subtitle(&path.to_string_lossy())
}

/// Stops playback *and* the transfer. Called on route exit as well as on window close, so leaving
/// the player screen does not leave a torrent running in the background.
#[tauri::command]
async fn player_stop(state: State<'_, Arc<AppState>>) -> PlayerResult<()> {
  stop_progress_pump(&state).await;
  if let Some(engine) = state.player.lock().await.clone() {
    engine.stop()?;
  }
  if let Some(transfers) = state.torrent.lock().await.clone() {
    match state.downloads.lock().await.clone() {
      Some(downloads) => downloads.finish_stream(&transfers).await,
      None => transfers.stop_stream().await,
    }
  }
  Ok(())
}

/// Plays a file from disk (a kept download) — mpv takes a path exactly like a URL.
#[tauri::command]
async fn player_load_path(state: State<'_, Arc<AppState>>, path: String) -> PlayerResult<()> {
  stop_progress_pump(&state).await;
  if !std::path::Path::new(&path).is_file() {
    return Err(PlayerError::Download(format!("file not found: {path}")));
  }
  state.engine().await?.load(&path)
}

#[tauri::command]
async fn downloads_subscribe(
  state: State<'_, Arc<AppState>>,
  on_event: Channel<DownloadEvent>,
) -> PlayerResult<DownloadSnapshot> {
  let downloads = state.downloads().await?;
  downloads.subscribe(on_event);
  Ok(downloads.snapshot().await)
}

#[tauri::command]
async fn downloads_list(state: State<'_, Arc<AppState>>) -> PlayerResult<DownloadSnapshot> {
  Ok(state.downloads().await?.snapshot().await)
}

#[tauri::command]
async fn downloads_start(
  state: State<'_, Arc<AppState>>,
  target: DownloadTarget,
  candidates: Vec<StreamCandidate>,
) -> PlayerResult<DownloadItem> {
  state.downloads().await?.start(target, &candidates).await
}

#[tauri::command]
async fn downloads_pause(state: State<'_, Arc<AppState>>, id: String) -> PlayerResult<()> {
  state.downloads().await?.pause(&id).await
}

#[tauri::command]
async fn downloads_resume(state: State<'_, Arc<AppState>>, id: String) -> PlayerResult<()> {
  state.downloads().await?.resume(&id).await
}

#[tauri::command]
async fn downloads_remove(
  state: State<'_, Arc<AppState>>,
  id: String,
  delete_files: bool,
) -> PlayerResult<()> {
  state.downloads().await?.remove(&id, delete_files).await
}

/// The finished download for a catalog unit, if this device has one — the resolver's first stop.
#[tauri::command]
async fn downloads_find(
  state: State<'_, Arc<AppState>>,
  installment_id: String,
  episode_id: Option<String>,
) -> PlayerResult<Option<DownloadItem>> {
  Ok(
    state
      .downloads()
      .await?
      .find_completed(&installment_id, episode_id.as_deref())
      .await,
  )
}

#[tauri::command]
async fn downloads_set_dir(
  state: State<'_, Arc<AppState>>,
  path: String,
) -> PlayerResult<std::path::PathBuf> {
  state.downloads().await?.set_dir(path.into()).await
}

/// Same bytes-plus-filename shape as `player_load_subtitle`, written beside the video instead of
/// into the cache, so it is still there when the file plays offline.
#[tauri::command]
async fn downloads_save_subtitle(
  state: State<'_, Arc<AppState>>,
  id: String,
  bytes: Vec<u8>,
  language: String,
  filename: String,
) -> PlayerResult<std::path::PathBuf> {
  state
    .downloads()
    .await?
    .save_subtitle(&id, &bytes, &language, &filename)
    .await
}

fn publish_event(sink: &EventSink, event: PlayerEvent) {
  let channel = { sink.lock().ok().and_then(|guard| guard.clone()) };
  if let Some(channel) = channel {
    let _ = channel.send(event);
  }
}

/// Transfer progress is pushed, never polled from JS — same rule as `time-pos`, and at the same
/// 4 Hz ceiling so the two streams cost one predictable amount together.
async fn start_progress_pump(state: &State<'_, Arc<AppState>>, transfers: Arc<TorrentEngine>) {
  let sink = state.events.clone();
  let handle = tauri::async_runtime::spawn(async move {
    loop {
      tokio::time::sleep(std::time::Duration::from_millis(250)).await;
      match transfers.progress().await {
        Some(progress) => publish_event(&sink, PlayerEvent::Transfer(progress)),
        None => break,
      }
    }
  });
  *state.progress.lock().await = Some(handle);
}

async fn stop_progress_pump(state: &State<'_, Arc<AppState>>) {
  if let Some(handle) = state.progress.lock().await.take() {
    handle.abort();
  }
}

/// Tears down playback and the torrent session. Runs on `CloseRequested` and on `ExitRequested`;
/// either path alone would leave the other reachable, and a half-torn-down session leaves a
/// growing cache directory and orphaned peers behind.
async fn shutdown(state: Arc<AppState>) {
  if let Some(handle) = state.progress.lock().await.take() {
    handle.abort();
  }
  if let Some(engine) = state.player.lock().await.take() {
    let _ = engine.stop();
  }
  state.downloads.lock().await.take();
  if let Some(transfers) = state.torrent.lock().await.take() {
    // Kept downloads stay in librqbit's persistence and resume on the next launch; only the
    // stream is deleted here.
    transfers.shutdown().await;
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let started_at = diagnostics::StartedAt(std::time::Instant::now());
  let state = Arc::new(AppState {
    torrent: Mutex::new(None),
    downloads: Mutex::new(None),
    player: Mutex::new(None),
    events: new_event_sink(),
    layout: Mutex::new(None),
    progress: Mutex::new(None),
  });

  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    // Folder picker for the download location, and "show in file manager" for a finished file.
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .manage(state.clone())
    .manage(started_at)
    .on_page_load(|webview, payload| diagnostics::on_page_load(webview, payload.event()))
    .invoke_handler(tauri::generate_handler![
      player_subscribe,
      player_init,
      player_set_overlay,
      player_start_stream,
      player_play,
      player_pause,
      player_seek,
      player_set_volume,
      player_set_property,
      player_get_property,
      player_load_subtitle,
      player_stop,
      player_load_path,
      downloads_subscribe,
      downloads_list,
      downloads_start,
      downloads_pause,
      downloads_resume,
      downloads_remove,
      downloads_find,
      downloads_set_dir,
      downloads_save_subtitle,
    ])
    .setup({
      let state = state.clone();
      move |app| {
        // Always registered so a release build can be asked for logs; the level is the only
        // thing that differs between debug and release (see diagnostics.rs).
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(diagnostics::log_level())
            .build(),
        )?;
        log::info!(
          "setup at +{} ms",
          app
            .state::<diagnostics::StartedAt>()
            .0
            .elapsed()
            .as_millis()
        );

        // Streaming data is disposable, so it belongs in the cache directory (wiped on every
        // start). Kept downloads and the session's resume state are data: they live under
        // app_data_dir() and, by default, ~/Videos/Arcadia — see README "Where Arcadia keeps
        // data on your device".
        let cache_dir = app.path().app_cache_dir()?.join("streams");
        let data_dir = app.path().app_data_dir()?;
        let persistence_dir = data_dir.join("torrent-session");
        let registry_path = data_dir.join("downloads.json");
        let default_download_dir = app
          .path()
          .video_dir()
          .map(|videos| videos.join("Arcadia"))
          .unwrap_or_else(|_| data_dir.join("downloads"));
        let state = state.clone();
        // Tauri's runtime *is* tokio; a second one would mean two thread pools competing
        // for cores during playback.
        tauri::async_runtime::spawn(async move {
          match TorrentEngine::start(cache_dir, persistence_dir).await {
            Ok(engine) => {
              let engine = Arc::new(engine);
              let downloads =
                DownloadManager::new(engine.session(), registry_path, default_download_dir);
              downloads.reconcile().await;
              downloads.spawn_pump();
              *state.torrent.lock().await = Some(engine);
              *state.downloads.lock().await = Some(downloads);
            }
            Err(error) => log::error!("torrent session unavailable: {error}"),
          }
        });
        Ok(())
      }
    })
    .on_window_event({
      let state = state.clone();
      move |_window, event| {
        if matches!(event, WindowEvent::CloseRequested { .. }) {
          let state = state.clone();
          tauri::async_runtime::block_on(shutdown(state));
        }
      }
    })
    .build(tauri::generate_context!())
    .expect("error while building the Arcadia desktop shell")
    .run(move |_app, event| {
      if matches!(event, RunEvent::ExitRequested { .. }) {
        tauri::async_runtime::block_on(shutdown(state.clone()));
      }
    });
}
