use serde::Serialize;

/// Every player command returns this rather than a stringified panic, so the React side can
/// branch on a discriminant and show the family an honest, specific message. The roadmap's rule
/// for Phase 1 is that a failure is always nameable — never a spinner that never resolves.
#[derive(Debug, Serialize, thiserror::Error)]
#[serde(tag = "kind", content = "detail", rename_all = "camelCase")]
pub enum PlayerError {
  /// libmpv could not be created or configured — a missing/incompatible libmpv at runtime.
  #[error("playback engine unavailable: {0}")]
  EngineUnavailable(String),
  /// The native video surface could not be attached to the window.
  #[error("video surface unavailable: {0}")]
  SurfaceUnavailable(String),
  /// A libmpv call failed.
  #[error("playback command failed: {0}")]
  Mpv(String),
  /// The magnet could not be built or added to the session.
  #[error("torrent could not be started: {0}")]
  TorrentRejected(String),
  /// Metadata never resolved, or no peer ever connected. The UI fails over to the next candidate.
  #[error("torrent stalled: {0}")]
  TorrentStalled(String),
  /// The local stream server could not bind or is not running.
  #[error("stream server unavailable: {0}")]
  StreamServer(String),
}

impl PlayerError {
  pub fn mpv(error: impl std::fmt::Display) -> Self {
    Self::Mpv(error.to_string())
  }
}

pub type PlayerResult<T> = Result<T, PlayerError>;
