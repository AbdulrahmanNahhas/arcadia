pub mod magnet;
pub mod stream_server;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use librqbit::{
  AddTorrent, AddTorrentOptions, ManagedTorrent, Session, SessionOptions, SessionPersistenceConfig,
};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::error::{PlayerError, PlayerResult};
use magnet::build_magnet;
use stream_server::StreamServer;

/// librqbit's own alias lives in a private module; it is just a shared handle to a torrent.
type ManagedTorrentHandle = Arc<ManagedTorrent>;

/// How long a magnet gets to turn into torrent metadata before the candidate is abandoned. Until
/// this resolves, even the file list is unknown — the UI shows `resolving`, not `buffering`.
const METADATA_TIMEOUT: Duration = Duration::from_secs(30);
/// How long a resolved torrent gets to find a peer and move a byte. Past this it is dead and the
/// caller should fail over to the next ranked candidate.
const FIRST_BYTE_TIMEOUT: Duration = Duration::from_secs(20);
/// Streaming still writes fetched pieces to disk, so the cache is capped and pruned on startup.
/// Without this, "streams by default, downloads only on request" quietly stops being true.
const DEFAULT_CACHE_BUDGET_BYTES: u64 = 20 * 1024 * 1024 * 1024;
const PEER_LIMIT: usize = 64;

/// One candidate as the API ranked it (see `packages/contracts/src/playback.ts`). Only the fields
/// the transfer layer needs cross the IPC boundary.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamCandidate {
  pub id: String,
  pub info_hash: Option<String>,
  pub file_idx: Option<usize>,
  pub url: Option<String>,
  pub filename: Option<String>,
  #[serde(default)]
  pub trackers: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartedStream {
  /// The candidate that actually worked — the UI reports which attempt it landed on.
  pub candidate_id: String,
  pub url: String,
  /// `None` for a direct/debrid source: there is no torrent behind it to report progress for.
  pub torrent_id: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamProgress {
  pub torrent_id: usize,
  pub downloaded_bytes: u64,
  pub total_bytes: u64,
  pub download_rate_bps: u64,
  pub peers_connected: u32,
  pub finished: bool,
}

struct ActiveStream {
  torrent_id: usize,
  handle: ManagedTorrentHandle,
}

pub struct TorrentEngine {
  session: Arc<Session>,
  server: StreamServer,
  /// Phase 1 keeps exactly one streaming torrent alive; starting a second tears the first down.
  active: Mutex<Option<ActiveStream>>,
}

impl TorrentEngine {
  pub async fn start(cache_dir: PathBuf) -> PlayerResult<Self> {
    prune_cache_dir(&cache_dir, DEFAULT_CACHE_BUDGET_BYTES);
    std::fs::create_dir_all(&cache_dir)
      .map_err(|error| PlayerError::TorrentRejected(error.to_string()))?;

    let options = SessionOptions {
      fastresume: true,
      // Set now so Phase 3's restart-resume is a config change rather than a rewrite.
      persistence: Some(SessionPersistenceConfig::Json {
        folder: Some(cache_dir.join("session")),
      }),
      peer_limit: Some(PEER_LIMIT),
      ..Default::default()
    };
    let session = Session::new_with_opts(cache_dir.clone(), options)
      .await
      .map_err(|error| PlayerError::TorrentRejected(error.to_string()))?;
    let server = StreamServer::start(session.clone()).await?;

    Ok(Self {
      session,
      server,
      active: Mutex::new(None),
    })
  }

  /// Walks the ranked candidate list until one actually plays.
  ///
  /// This is the difference between "a movie plays" and "any movie plays". A candidate is
  /// abandoned when its metadata never resolves, when no peer connects, or when throughput
  /// stays at zero — and the next one is tried. Only an exhausted list is a failure.
  pub async fn start_stream(
    &self,
    candidates: &[StreamCandidate],
    mut on_attempt: impl FnMut(&str, usize, usize),
  ) -> PlayerResult<StartedStream> {
    self.stop_stream().await;

    let mut last_error = String::from("no candidates were offered");
    for (index, candidate) in candidates.iter().enumerate() {
      on_attempt(&candidate.id, index + 1, candidates.len());

      // A debrid source is already a playable URL; there is nothing to transfer.
      if let Some(url) = candidate.url.as_ref().filter(|url| !url.is_empty()) {
        return Ok(StartedStream {
          candidate_id: candidate.id.clone(),
          url: url.clone(),
          torrent_id: None,
        });
      }

      match self.try_candidate(candidate).await {
        Ok(started) => return Ok(started),
        Err(error) => {
          log::warn!("candidate {} failed: {error}", candidate.id);
          last_error = error.to_string();
        }
      }
    }
    Err(PlayerError::TorrentStalled(last_error))
  }

  async fn try_candidate(&self, candidate: &StreamCandidate) -> PlayerResult<StartedStream> {
    let info_hash = candidate
      .info_hash
      .as_ref()
      .ok_or_else(|| PlayerError::TorrentRejected("candidate has no infoHash".into()))?;
    let magnet = build_magnet(
      info_hash,
      candidate.filename.as_deref(),
      &candidate.trackers,
    );

    let options = AddTorrentOptions {
      // Nothing but the one video file is fetched — the rest of a season pack is not our
      // bandwidth to spend, and it would compete for pieces with the part being watched.
      only_files: candidate.file_idx.map(|idx| vec![idx]),
      overwrite: true,
      ..Default::default()
    };
    let response = self
      .session
      .add_torrent(AddTorrent::from_url(magnet), Some(options))
      .await
      .map_err(|error| PlayerError::TorrentRejected(error.to_string()))?;
    let handle = response
      .into_handle()
      .ok_or_else(|| PlayerError::TorrentRejected("torrent was not started".into()))?;

    // Until metadata resolves the file list — and therefore the playable file — is unknown.
    tokio::time::timeout(METADATA_TIMEOUT, handle.wait_until_initialized())
      .await
      .map_err(|_| PlayerError::TorrentStalled("metadata did not resolve".into()))?
      .map_err(|error| PlayerError::TorrentStalled(error.to_string()))?;

    let file_idx = match candidate.file_idx {
      Some(idx) => idx,
      // Per the Stremio spec, an absent `fileIdx` means the largest file — resolvable only
      // now that metadata exists, which is why the API leaves it null.
      None => largest_file_index(&handle)
        .ok_or_else(|| PlayerError::TorrentStalled("torrent contains no playable file".into()))?,
    };

    self.wait_for_first_bytes(&handle).await?;

    let torrent_id = handle.id();
    let url = self.server.stream_url(torrent_id, file_idx);
    *self.active.lock().await = Some(ActiveStream {
      torrent_id,
      handle: handle.clone(),
    });
    Ok(StartedStream {
      candidate_id: candidate.id.clone(),
      url,
      torrent_id: Some(torrent_id),
    })
  }

  /// A torrent whose metadata resolved but that never finds a peer looks identical to a healthy
  /// one until playback starts and stalls forever. Catching it here is what lets failover work.
  async fn wait_for_first_bytes(&self, handle: &ManagedTorrentHandle) -> PlayerResult<()> {
    let deadline = tokio::time::Instant::now() + FIRST_BYTE_TIMEOUT;
    loop {
      let stats = handle.stats();
      if stats.progress_bytes > 0 || stats.finished {
        return Ok(());
      }
      if tokio::time::Instant::now() >= deadline {
        return Err(PlayerError::TorrentStalled(
          "no peer sent any data before the timeout".into(),
        ));
      }
      tokio::time::sleep(Duration::from_millis(250)).await;
    }
  }

  pub async fn progress(&self) -> Option<StreamProgress> {
    let active = self.active.lock().await;
    let active = active.as_ref()?;
    let stats = active.handle.stats();
    let live = stats.live.as_ref();
    Some(StreamProgress {
      torrent_id: active.torrent_id,
      downloaded_bytes: stats.progress_bytes,
      total_bytes: stats.total_bytes,
      download_rate_bps: live.map(|live| live.download_speed.as_bytes()).unwrap_or(0),
      peers_connected: live.map(|live| live.snapshot.peer_stats.live).unwrap_or(0),
      finished: stats.finished,
    })
  }

  /// Stops the active stream and deletes what it fetched.
  ///
  /// Deleting is the deliberate half of "torrents stream by default; only an explicit download
  /// keeps the file". Phase 3's promotion path will mark a torrent as kept before it gets here.
  pub async fn stop_stream(&self) {
    let Some(active) = self.active.lock().await.take() else {
      return;
    };
    if let Err(error) = self
      .session
      .delete(active.torrent_id.into(), /* delete_files */ true)
      .await
    {
      log::warn!("failed to clean up torrent {}: {error}", active.torrent_id);
    }
  }

  /// Torn down on `CloseRequested`, on `ExitRequested`, and again from `Drop` as the backstop.
  pub async fn shutdown(&self) {
    self.stop_stream().await;
    self.session.stop().await;
  }
}

fn largest_file_index(handle: &ManagedTorrentHandle) -> Option<usize> {
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

/// Startup-time LRU eviction. Streaming writes every fetched piece to disk, and without a cap the
/// cache dir grows until the disk is full.
fn prune_cache_dir(cache_dir: &PathBuf, budget: u64) {
  let Ok(entries) = std::fs::read_dir(cache_dir) else {
    return;
  };
  let mut files: Vec<(std::path::PathBuf, u64, std::time::SystemTime)> = entries
    .filter_map(|entry| {
      let entry = entry.ok()?;
      let metadata = entry.metadata().ok()?;
      if !metadata.is_file() {
        return None;
      }
      Some((
        entry.path(),
        metadata.len(),
        metadata.accessed().or_else(|_| metadata.modified()).ok()?,
      ))
    })
    .collect();

  let mut total: u64 = files.iter().map(|(_, size, _)| size).sum();
  if total <= budget {
    return;
  }
  files.sort_by_key(|(_, _, accessed)| *accessed);
  for (path, size, _) in files {
    if total <= budget {
      break;
    }
    if std::fs::remove_file(&path).is_ok() {
      total = total.saturating_sub(size);
      log::info!("evicted {} from the stream cache", path.display());
    }
  }
}
