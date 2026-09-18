//! The on-disk record of what this device has downloaded: `downloads.json` in the app data
//! directory. Downloads are per device by nature (the file is *here*), so the registry is the
//! source of truth for the Downloads screen and for "play this from disk"; the server's
//! `account_downloads` table is only a mirror the web app keeps for cross-device badges.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{PlayerError, PlayerResult};

pub const REGISTRY_VERSION: u32 = 1;

/// File types the engine will fetch, for streams and downloads alike. A torrent whose selected
/// "video" is anything else (an installer, an archive, a shortcut) is refused before a byte is
/// transferred — see docs/security-and-debrid.md §1.
pub const VIDEO_EXTENSIONS: &[&str] = &["mkv", "mp4", "webm", "avi", "mov", "m4v", "ts", "wmv"];

pub fn is_allowed_video(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| ext.to_ascii_lowercase())
    .is_some_and(|ext| VIDEO_EXTENSIONS.contains(&ext.as_str()))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DownloadState {
  /// Waiting for a free slot (or for the same torrent to stop streaming).
  Queued,
  Downloading,
  Paused,
  Completed,
  Failed,
}

/// What the download is *of*, as the catalog names it — enough to label the row and to answer
/// "is this installment/episode available on disk?" without a server round trip.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTarget {
  pub title_id: String,
  pub title_name: String,
  pub installment_id: String,
  #[serde(default)]
  pub episode_id: Option<String>,
  /// "الفيلم", "الحلقة 3", … — whatever the UI wants to show under the title.
  pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleFile {
  pub language: String,
  pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
  pub id: String,
  #[serde(flatten)]
  pub target: DownloadTarget,
  pub info_hash: String,
  /// Which file inside the torrent; `None` until metadata resolves it to the largest file.
  #[serde(default)]
  pub file_idx: Option<usize>,
  /// The magnet as built for the stream, trackers included — what a restart re-adds.
  pub magnet: String,
  /// The torrent's own file name, once known; the final path is `folder/<relative file name>`.
  #[serde(default)]
  pub path: Option<PathBuf>,
  /// The torrent's output folder (`<download dir>/<title folder>`).
  pub folder: PathBuf,
  #[serde(default)]
  pub size_bytes: u64,
  #[serde(default)]
  pub downloaded_bytes: u64,
  #[serde(default)]
  pub download_rate_bps: u64,
  #[serde(default)]
  pub peers_connected: u32,
  pub state: DownloadState,
  #[serde(default)]
  pub error: Option<String>,
  #[serde(default)]
  pub subtitles: Vec<SubtitleFile>,
  pub created_at_ms: u64,
  #[serde(default)]
  pub completed_at_ms: Option<u64>,
}

impl DownloadItem {
  pub fn is_active(&self) -> bool {
    matches!(self.state, DownloadState::Downloading)
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Registry {
  pub version: u32,
  /// Where new downloads go. Existing items remember their own folder, so changing this never
  /// moves anything.
  pub dir: PathBuf,
  /// Stable per-install identifier the web app sends to the server's `account_downloads` mirror.
  pub device_id: String,
  #[serde(default)]
  pub items: Vec<DownloadItem>,
}

impl Registry {
  pub fn new(dir: PathBuf) -> Self {
    Self {
      version: REGISTRY_VERSION,
      dir,
      device_id: random_hex(),
      items: Vec::new(),
    }
  }

  pub fn load(path: &Path, default_dir: PathBuf) -> Self {
    match std::fs::read(path) {
      Ok(bytes) => match serde_json::from_slice::<Registry>(&bytes) {
        Ok(registry) => registry,
        Err(error) => {
          log::warn!(
            "downloads registry at {} is unreadable ({error}); starting empty",
            path.display()
          );
          Self::new(default_dir)
        }
      },
      Err(_) => Self::new(default_dir),
    }
  }

  /// Written to a sibling temp file and renamed, so a crash mid-write never leaves half a JSON.
  pub fn save(&self, path: &Path) -> PlayerResult<()> {
    if let Some(parent) = path.parent() {
      std::fs::create_dir_all(parent).map_err(|error| PlayerError::Download(error.to_string()))?;
    }
    let bytes =
      serde_json::to_vec_pretty(self).map_err(|error| PlayerError::Download(error.to_string()))?;
    let temp = path.with_extension("json.tmp");
    std::fs::write(&temp, bytes).map_err(|error| PlayerError::Download(error.to_string()))?;
    std::fs::rename(&temp, path).map_err(|error| PlayerError::Download(error.to_string()))
  }

  pub fn find(&self, id: &str) -> Option<&DownloadItem> {
    self.items.iter().find(|item| item.id == id)
  }

  pub fn find_mut(&mut self, id: &str) -> Option<&mut DownloadItem> {
    self.items.iter_mut().find(|item| item.id == id)
  }

  pub fn find_by_hash(&self, info_hash: &str, file_idx: Option<usize>) -> Option<&DownloadItem> {
    self.items.iter().find(|item| {
      item.info_hash.eq_ignore_ascii_case(info_hash)
        && (file_idx.is_none() || item.file_idx.is_none() || item.file_idx == file_idx)
    })
  }

  /// The completed download for a catalog unit, if any — what the resolver checks before it
  /// asks the server for streams.
  pub fn find_completed(
    &self,
    installment_id: &str,
    episode_id: Option<&str>,
  ) -> Option<&DownloadItem> {
    self.items.iter().find(|item| {
      item.state == DownloadState::Completed
        && item.target.installment_id == installment_id
        && item.target.episode_id.as_deref() == episode_id
        && item.path.as_ref().is_some_and(|path| path.is_file())
    })
  }

  pub fn active_count(&self) -> usize {
    self.items.iter().filter(|item| item.is_active()).count()
  }
}

/// A file-system-safe folder name from a catalog title: keeps letters (any script), digits,
/// spaces, dots, dashes and underscores; collapses runs of anything else to one space.
pub fn title_folder_name(title: &str) -> String {
  let mut out = String::with_capacity(title.len());
  let mut pending_space = false;
  for ch in title.chars() {
    let keep = ch.is_alphanumeric() || matches!(ch, '.' | '-' | '_' | '\'' | '!' | ',');
    if keep {
      if pending_space && !out.is_empty() {
        out.push(' ');
      }
      pending_space = false;
      out.push(ch);
    } else {
      pending_space = true;
    }
  }
  let trimmed = out.trim().trim_end_matches('.').trim();
  if trimmed.is_empty() {
    "Untitled".to_string()
  } else {
    trimmed.chars().take(120).collect()
  }
}

pub fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

pub fn random_hex() -> String {
  let value: u128 = rand::random();
  format!("{value:032x}")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn allowlist_accepts_video_and_rejects_everything_else() {
    assert!(is_allowed_video(Path::new("Movie.2024.1080p.MKV")));
    assert!(is_allowed_video(Path::new("dir/ep01.mp4")));
    assert!(!is_allowed_video(Path::new("Movie.2024.exe")));
    assert!(!is_allowed_video(Path::new("Movie.mkv.lnk")));
    assert!(!is_allowed_video(Path::new("no-extension")));
  }

  #[test]
  fn title_folder_name_strips_path_characters_and_keeps_arabic() {
    assert_eq!(
      title_folder_name("Spirited Away / 千と千尋"),
      "Spirited Away 千と千尋"
    );
    assert_eq!(
      title_folder_name("قاتل الشياطين: قطار اللانهاية"),
      "قاتل الشياطين قطار اللانهاية"
    );
    assert_eq!(title_folder_name("..."), "Untitled");
    assert_eq!(title_folder_name("  Trailing dots... "), "Trailing dots");
  }

  #[test]
  fn registry_round_trips_through_disk() {
    let dir = std::env::temp_dir().join(format!("arcadia-registry-{}", random_hex()));
    let path = dir.join("downloads.json");
    let mut registry = Registry::new(dir.join("videos"));
    registry.items.push(DownloadItem {
      id: "one".into(),
      target: DownloadTarget {
        title_id: "t".into(),
        title_name: "T".into(),
        installment_id: "i".into(),
        episode_id: Some("e".into()),
        label: "الحلقة 1".into(),
      },
      info_hash: "abc".into(),
      file_idx: Some(0),
      magnet: "magnet:?xt=urn:btih:abc".into(),
      path: None,
      folder: dir.join("videos").join("T"),
      size_bytes: 10,
      downloaded_bytes: 5,
      download_rate_bps: 0,
      peers_connected: 0,
      state: DownloadState::Paused,
      error: None,
      subtitles: vec![],
      created_at_ms: 1,
      completed_at_ms: None,
    });
    registry.save(&path).unwrap();
    let loaded = Registry::load(&path, dir.clone());
    assert_eq!(loaded.device_id, registry.device_id);
    assert_eq!(loaded.items.len(), 1);
    assert_eq!(loaded.items[0].state, DownloadState::Paused);
    assert_eq!(
      loaded.find_by_hash("ABC", Some(0)).map(|i| i.id.as_str()),
      Some("one")
    );
    assert!(loaded.find_completed("i", Some("e")).is_none());
    let _ = std::fs::remove_dir_all(dir);
  }
}
