//! Download-to-keep (roadmap Phase 3): the same librqbit session the player streams through,
//! but torrents added here write into the download folder, survive restarts, and are never
//! deleted by `stop_stream`. One `DownloadManager` per process, owned by `AppState`.

pub mod registry;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use librqbit::api::TorrentIdOrHash;
use librqbit::{
  AddTorrent, AddTorrentOptions, AddTorrentResponse, Magnet, ManagedTorrent, Session,
};
use serde::Serialize;
use tauri::ipc::Channel;
use tokio::sync::Mutex;

use crate::error::{PlayerError, PlayerResult};
use crate::torrent::magnet::build_magnet;
use crate::torrent::{StoppedStream, StreamCandidate, TorrentEngine};
use registry::{
  DownloadItem, DownloadState, DownloadTarget, Registry, SubtitleFile, is_allowed_video, now_ms,
  random_hex, title_folder_name,
};

/// Simultaneous transfers. More just splits the same connection; a family box downloads a
/// season overnight, not in parallel.
const MAX_ACTIVE: usize = 3;
const METADATA_TIMEOUT: Duration = Duration::from_secs(60);

/// Pushed over `downloads_subscribe`'s channel: the whole list, every time anything changes and
/// once a second while something is transferring. The list is a few dozen rows at most, and one
/// snapshot shape keeps the React side a single `useState`.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DownloadEvent {
  Snapshot(DownloadSnapshot),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSnapshot {
  pub dir: PathBuf,
  pub device_id: String,
  pub items: Vec<DownloadItem>,
}

type EventSink = Arc<std::sync::Mutex<Option<Channel<DownloadEvent>>>>;

pub struct DownloadManager {
  session: Arc<Session>,
  registry_path: PathBuf,
  registry: Mutex<Registry>,
  events: EventSink,
  /// Info hashes asked for while the same torrent was streaming. They start once the stream
  /// stops, continuing from the pieces already on disk (`finish_stream`).
  promotions: Mutex<HashSet<String>>,
}

fn download_error(error: impl std::fmt::Display) -> PlayerError {
  PlayerError::Download(error.to_string())
}

fn hash_id(info_hash: &str) -> PlayerResult<TorrentIdOrHash> {
  Magnet::parse(info_hash)
    .ok()
    .and_then(|magnet| magnet.as_id20())
    .map(TorrentIdOrHash::Hash)
    .ok_or_else(|| PlayerError::Download(format!("invalid info hash {info_hash}")))
}

impl DownloadManager {
  pub fn new(session: Arc<Session>, registry_path: PathBuf, default_dir: PathBuf) -> Arc<Self> {
    let registry = Registry::load(&registry_path, default_dir);
    Arc::new(Self {
      session,
      registry_path,
      registry: Mutex::new(registry),
      events: Arc::new(std::sync::Mutex::new(None)),
      promotions: Mutex::new(HashSet::new()),
    })
  }

  pub fn subscribe(&self, channel: Channel<DownloadEvent>) {
    if let Ok(mut sink) = self.events.lock() {
      *sink = Some(channel);
    }
  }

  pub async fn snapshot(&self) -> DownloadSnapshot {
    let registry = self.registry.lock().await;
    DownloadSnapshot {
      dir: registry.dir.clone(),
      device_id: registry.device_id.clone(),
      items: registry.items.clone(),
    }
  }

  async fn publish(&self) {
    let snapshot = self.snapshot().await;
    let channel = self.events.lock().ok().and_then(|guard| guard.clone());
    if let Some(channel) = channel {
      let _ = channel.send(DownloadEvent::Snapshot(snapshot));
    }
  }

  fn persist(&self, registry: &Registry) {
    if let Err(error) = registry.save(&self.registry_path) {
      log::warn!("could not save the downloads registry: {error}");
    }
  }

  /// Brings the session in line with the registry after a restart: torrents nobody asked to
  /// keep are deleted (a stream that outlived a crash), kept ones are re-added or paused as
  /// recorded, and finished ones leave the session (their files stay).
  pub async fn reconcile(self: &Arc<Self>) {
    let known: HashSet<String> = {
      let registry = self.registry.lock().await;
      registry
        .items
        .iter()
        .map(|item| item.info_hash.to_ascii_lowercase())
        .collect()
    };
    let orphans: Vec<usize> = self.session.with_torrents(|torrents| {
      torrents
        .filter(|(_, handle)| !known.contains(&handle.info_hash().as_string()))
        .map(|(id, _)| id)
        .collect()
    });
    for id in orphans {
      if let Err(error) = self.session.delete(id.into(), true).await {
        log::warn!("could not drop orphaned torrent {id}: {error}");
      }
    }

    let items = self.registry.lock().await.items.clone();
    for item in items {
      match item.state {
        DownloadState::Downloading | DownloadState::Queued => {
          self.set_state(&item.id, DownloadState::Queued, None).await;
        }
        DownloadState::Paused => {
          if let Some(handle) = self.handle_for(&item.info_hash) {
            let _ = self.session.pause(&handle).await;
          }
        }
        DownloadState::Completed | DownloadState::Failed => {
          if let Ok(id) = hash_id(&item.info_hash) {
            let _ = self.session.delete(id, false).await;
          }
        }
      }
    }
    self.fill_slots().await;
    self.publish().await;
  }

  /// One-second heartbeat: progress, completion, and slot filling.
  pub fn spawn_pump(self: &Arc<Self>) {
    let manager = self.clone();
    tauri::async_runtime::spawn(async move {
      loop {
        tokio::time::sleep(Duration::from_secs(1)).await;
        manager.tick().await;
      }
    });
  }

  async fn tick(self: &Arc<Self>) {
    let mut changed = false;
    let mut finished: Vec<String> = Vec::new();
    {
      let mut registry = self.registry.lock().await;
      for item in registry.items.iter_mut().filter(|item| item.is_active()) {
        let Some(handle) = self.handle_for(&item.info_hash) else {
          continue;
        };
        let stats = handle.stats();
        let live = stats.live.as_ref();
        item.downloaded_bytes = stats.progress_bytes;
        item.size_bytes = stats.total_bytes;
        item.download_rate_bps = live.map(|live| live.download_speed.as_bytes()).unwrap_or(0);
        item.peers_connected = live.map(|live| live.snapshot.peer_stats.live).unwrap_or(0);
        if let Some(error) = stats.error.as_ref() {
          item.state = DownloadState::Failed;
          item.error = Some(error.clone());
        } else if stats.finished {
          finished.push(item.id.clone());
        }
        changed = true;
      }
    }
    for id in finished {
      self.complete(&id).await;
    }
    if self.fill_slots().await || changed {
      let registry = self.registry.lock().await;
      self.persist(&registry);
      drop(registry);
      self.publish().await;
    }
  }

  fn handle_for(&self, info_hash: &str) -> Option<Arc<ManagedTorrent>> {
    hash_id(info_hash).ok().and_then(|id| self.session.get(id))
  }

  async fn set_state(&self, id: &str, state: DownloadState, error: Option<String>) {
    let mut registry = self.registry.lock().await;
    if let Some(item) = registry.find_mut(id) {
      item.state = state;
      item.error = error;
      if state == DownloadState::Completed {
        item.completed_at_ms = Some(now_ms());
      }
    }
    self.persist(&registry);
  }

  /// Starts queued items while slots are free. Returns whether anything was started.
  async fn fill_slots(self: &Arc<Self>) -> bool {
    let promotions = self.promotions.lock().await.clone();
    let to_start: Vec<String> = {
      let registry = self.registry.lock().await;
      let mut free = MAX_ACTIVE.saturating_sub(registry.active_count());
      let mut ids = Vec::new();
      for item in registry
        .items
        .iter()
        .filter(|item| item.state == DownloadState::Queued)
      {
        if free == 0 {
          break;
        }
        // Waiting for the stream to stop; `finish_stream` starts it.
        if promotions.contains(&item.info_hash.to_ascii_lowercase()) {
          continue;
        }
        ids.push(item.id.clone());
        free -= 1;
      }
      ids
    };
    for id in &to_start {
      // Marked before the add resolves so the next tick does not start it twice.
      self.set_state(id, DownloadState::Downloading, None).await;
      let manager = self.clone();
      let id = id.clone();
      tauri::async_runtime::spawn(async move { manager.run_add(&id).await });
    }
    !to_start.is_empty()
  }

  /// Adds (or re-attaches) the item's torrent and waits for its metadata, so the file name and
  /// the allowlist verdict are known before the row reports "downloading".
  async fn run_add(self: &Arc<Self>, id: &str) {
    let Some(item) = self.registry.lock().await.find(id).cloned() else {
      return;
    };
    let options = AddTorrentOptions {
      only_files: item.file_idx.map(|idx| vec![idx]),
      overwrite: true,
      output_folder: Some(item.folder.to_string_lossy().into_owned()),
      ..Default::default()
    };
    let result = async {
      let response = self
        .session
        .add_torrent(AddTorrent::from_url(item.magnet.as_str()), Some(options))
        .await
        .map_err(download_error)?;
      let handle = match response {
        AddTorrentResponse::Added(_, handle) => handle,
        AddTorrentResponse::AlreadyManaged(_, handle) => {
          // The same torrent is streaming right now (a different output folder). Continue it
          // once the film stops instead of fighting over pieces.
          if handle.output_folder() != item.folder {
            self
              .promotions
              .lock()
              .await
              .insert(item.info_hash.to_ascii_lowercase());
            self.set_state(id, DownloadState::Queued, None).await;
            self.publish().await;
            return Ok(());
          }
          self
            .session
            .unpause(&handle)
            .await
            .map_err(download_error)?;
          handle
        }
        AddTorrentResponse::ListOnly(_) => {
          return Err(PlayerError::Download("torrent was not started".into()));
        }
      };
      tokio::time::timeout(METADATA_TIMEOUT, handle.wait_until_initialized())
        .await
        .map_err(|_| PlayerError::Download("metadata did not resolve".into()))?
        .map_err(download_error)?;
      let file_idx = match item.file_idx {
        Some(idx) => idx,
        None => {
          let idx = largest_file_index(&handle)
            .ok_or_else(|| PlayerError::Download("torrent contains no file".into()))?;
          self
            .session
            .update_only_files(&handle, &HashSet::from([idx]))
            .await
            .map_err(download_error)?;
          idx
        }
      };
      let relative = handle
        .with_metadata(|metadata| {
          metadata
            .file_infos
            .get(file_idx)
            .map(|info| (info.relative_filename.clone(), info.len))
        })
        .map_err(download_error)?
        .ok_or_else(|| PlayerError::Download("file index out of range".into()))?;
      if !is_allowed_video(&relative.0) {
        self.session.delete(handle.id().into(), true).await.ok();
        return Err(PlayerError::Download(
          "the selected file is not a video".into(),
        ));
      }
      let mut registry = self.registry.lock().await;
      if let Some(item) = registry.find_mut(id) {
        item.file_idx = Some(file_idx);
        item.path = Some(item.folder.join(&relative.0));
        item.size_bytes = relative.1;
        item.state = DownloadState::Downloading;
        item.error = None;
      }
      self.persist(&registry);
      Ok(())
    }
    .await;
    if let Err(error) = result {
      log::warn!("download {id} failed: {error}");
      self
        .set_state(id, DownloadState::Failed, Some(error.to_string()))
        .await;
    }
    self.publish().await;
  }

  async fn complete(&self, id: &str) {
    let info_hash = match self.registry.lock().await.find(id) {
      Some(item) => item.info_hash.clone(),
      None => return,
    };
    // Out of the session (uploading is off, so there is nothing left to do) but the files stay.
    if let Ok(hash) = hash_id(&info_hash) {
      let _ = self.session.delete(hash, false).await;
    }
    self.set_state(id, DownloadState::Completed, None).await;
  }

  /// Queues a download for the first torrent candidate the API ranked. Returns the existing
  /// row when the same file is already known.
  pub async fn start(
    self: &Arc<Self>,
    target: DownloadTarget,
    candidates: &[StreamCandidate],
  ) -> PlayerResult<DownloadItem> {
    let candidate = candidates
      .iter()
      .find(|candidate| {
        candidate
          .info_hash
          .as_ref()
          .is_some_and(|hash| !hash.is_empty())
      })
      .ok_or_else(|| PlayerError::Download("no torrent source to download".into()))?;
    let info_hash = candidate
      .info_hash
      .clone()
      .unwrap_or_default()
      .to_ascii_lowercase();
    let item = {
      let mut registry = self.registry.lock().await;
      if let Some(existing) = registry.find_by_hash(&info_hash, candidate.file_idx) {
        return Ok(existing.clone());
      }
      let folder = registry.dir.join(title_folder_name(&target.title_name));
      std::fs::create_dir_all(&folder).map_err(download_error)?;
      let item = DownloadItem {
        id: random_hex(),
        target,
        info_hash: info_hash.clone(),
        file_idx: candidate.file_idx,
        magnet: build_magnet(
          &info_hash,
          candidate.filename.as_deref(),
          &candidate.trackers,
        ),
        path: None,
        folder,
        size_bytes: 0,
        downloaded_bytes: 0,
        download_rate_bps: 0,
        peers_connected: 0,
        state: DownloadState::Queued,
        error: None,
        subtitles: Vec::new(),
        created_at_ms: now_ms(),
        completed_at_ms: None,
      };
      registry.items.push(item.clone());
      self.persist(&registry);
      item
    };
    self.fill_slots().await;
    self.publish().await;
    Ok(item)
  }

  pub async fn pause(self: &Arc<Self>, id: &str) -> PlayerResult<()> {
    let info_hash = self.item_hash(id).await?;
    if let Some(handle) = self.handle_for(&info_hash) {
      self.session.pause(&handle).await.map_err(download_error)?;
    }
    self.set_state(id, DownloadState::Paused, None).await;
    self.publish().await;
    Ok(())
  }

  pub async fn resume(self: &Arc<Self>, id: &str) -> PlayerResult<()> {
    let info_hash = self.item_hash(id).await?;
    match self.handle_for(&info_hash) {
      Some(handle) => {
        self
          .session
          .unpause(&handle)
          .await
          .map_err(download_error)?;
        self.set_state(id, DownloadState::Downloading, None).await;
      }
      // Not in the session anymore (a failed add, or a restart without persistence): re-add.
      None => self.set_state(id, DownloadState::Queued, None).await,
    }
    self.fill_slots().await;
    self.publish().await;
    Ok(())
  }

  pub async fn remove(self: &Arc<Self>, id: &str, delete_files: bool) -> PlayerResult<()> {
    let item = self
      .registry
      .lock()
      .await
      .find(id)
      .cloned()
      .ok_or_else(|| PlayerError::Download("unknown download".into()))?;
    self
      .promotions
      .lock()
      .await
      .remove(&item.info_hash.to_ascii_lowercase());
    if let Ok(hash) = hash_id(&item.info_hash)
      && self.session.get(hash).is_some()
    {
      self
        .session
        .delete(hash, delete_files)
        .await
        .map_err(download_error)?;
    }
    if delete_files {
      if let Some(path) = &item.path {
        let _ = std::fs::remove_file(path);
      }
      for subtitle in &item.subtitles {
        let _ = std::fs::remove_file(&subtitle.path);
      }
      // A now-empty title folder goes too; a shared one (another episode) stays.
      let _ = std::fs::remove_dir(&item.folder);
    }
    let mut registry = self.registry.lock().await;
    registry.items.retain(|entry| entry.id != id);
    self.persist(&registry);
    drop(registry);
    self.publish().await;
    Ok(())
  }

  pub async fn find_completed(
    &self,
    installment_id: &str,
    episode_id: Option<&str>,
  ) -> Option<DownloadItem> {
    self
      .registry
      .lock()
      .await
      .find_completed(installment_id, episode_id)
      .cloned()
  }

  pub async fn set_dir(&self, dir: PathBuf) -> PlayerResult<PathBuf> {
    std::fs::create_dir_all(&dir).map_err(download_error)?;
    let dir = dir.canonicalize().map_err(download_error)?;
    let mut registry = self.registry.lock().await;
    registry.dir = dir.clone();
    self.persist(&registry);
    drop(registry);
    self.publish().await;
    Ok(dir)
  }

  /// Writes a subtitle next to the video as `<video stem>.<language>.<ext>` — the layout mpv's
  /// `sub-auto=fuzzy` picks up on its own when the file plays from disk.
  pub async fn save_subtitle(
    &self,
    id: &str,
    bytes: &[u8],
    language: &str,
    filename: &str,
  ) -> PlayerResult<PathBuf> {
    let mut registry = self.registry.lock().await;
    let item = registry
      .find_mut(id)
      .ok_or_else(|| PlayerError::Download("unknown download".into()))?;
    let video = item
      .path
      .clone()
      .ok_or_else(|| PlayerError::Download("the video file is not known yet".into()))?;
    let stem = video
      .file_stem()
      .map(|stem| stem.to_string_lossy().into_owned())
      .unwrap_or_else(|| "subtitle".into());
    let extension = Path::new(filename)
      .extension()
      .and_then(|ext| ext.to_str())
      .filter(|ext| {
        matches!(
          ext.to_ascii_lowercase().as_str(),
          "srt" | "ass" | "ssa" | "vtt" | "sub"
        )
      })
      .unwrap_or("srt");
    let safe_language: String = language
      .chars()
      .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-')
      .take(12)
      .collect();
    let path = video.with_file_name(format!("{stem}.{safe_language}.{extension}"));
    std::fs::write(&path, bytes).map_err(download_error)?;
    item
      .subtitles
      .retain(|subtitle| subtitle.language != safe_language);
    item.subtitles.push(SubtitleFile {
      language: safe_language,
      path: path.clone(),
    });
    self.persist(&registry);
    drop(registry);
    self.publish().await;
    Ok(path)
  }

  /// Called wherever the stream would be stopped: if the film being watched was also asked for
  /// as a download, its pieces move to the download folder and the torrent continues there
  /// instead of being deleted.
  pub async fn finish_stream(self: &Arc<Self>, transfers: &TorrentEngine) {
    let wanted = match transfers.active_info_hash().await {
      Some(hash) => self
        .promotions
        .lock()
        .await
        .contains(&hash.to_ascii_lowercase()),
      None => false,
    };
    if !wanted {
      transfers.stop_stream().await;
      return;
    }
    let Some(stopped) = transfers.stop_stream_keeping_files().await else {
      return;
    };
    self.promote(stopped).await;
  }

  async fn promote(self: &Arc<Self>, stopped: StoppedStream) {
    let hash = stopped.info_hash.to_ascii_lowercase();
    self.promotions.lock().await.remove(&hash);
    let item = self
      .registry
      .lock()
      .await
      .find_by_hash(&hash, Some(stopped.file_idx))
      .cloned();
    let Some(item) = item else { return };
    let from = stopped.output_folder.join(&stopped.relative_file);
    let to = item.folder.join(&stopped.relative_file);
    if let Err(error) = move_file(&from, &to) {
      log::warn!("could not move streamed pieces for {}: {error}", item.id);
    }
    {
      let mut registry = self.registry.lock().await;
      if let Some(entry) = registry.find_mut(&item.id) {
        entry.file_idx = Some(stopped.file_idx);
        entry.magnet = stopped.magnet;
        entry.state = DownloadState::Queued;
      }
      self.persist(&registry);
    }
    let _ = std::fs::remove_dir_all(&stopped.output_folder);
    self.fill_slots().await;
    self.publish().await;
  }

  async fn item_hash(&self, id: &str) -> PlayerResult<String> {
    self
      .registry
      .lock()
      .await
      .find(id)
      .map(|item| item.info_hash.clone())
      .ok_or_else(|| PlayerError::Download("unknown download".into()))
  }
}

fn largest_file_index(handle: &ManagedTorrent) -> Option<usize> {
  handle
    .with_metadata(|metadata| {
      metadata
        .file_infos
        .iter()
        .enumerate()
        .max_by_key(|(_, info)| info.len)
        .map(|(index, _)| index)
    })
    .ok()
    .flatten()
}

/// Rename when the cache and the download folder share a filesystem; copy + delete otherwise.
fn move_file(from: &Path, to: &Path) -> std::io::Result<()> {
  if !from.exists() {
    return Ok(());
  }
  if let Some(parent) = to.parent() {
    std::fs::create_dir_all(parent)?;
  }
  match std::fs::rename(from, to) {
    Ok(()) => Ok(()),
    Err(_) => {
      std::fs::copy(from, to)?;
      std::fs::remove_file(from)
    }
  }
}
