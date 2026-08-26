pub mod surface;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use libmpv2::{Format, Mpv};
use serde::Serialize;
use tauri::ipc::Channel;

use crate::error::{PlayerError, PlayerResult};

/// `time-pos` fires far faster than a UI can usefully consume, so it is throttled here — in Rust,
/// before it crosses the IPC boundary — rather than in React. The roadmap budgets the overlay at
/// under 5 % CPU with zero React re-renders per tick; 4 Hz is what that allows for.
const TICK_INTERVAL: Duration = Duration::from_millis(250);

/// Property observation ids. Only scalar-typed properties are observed: libmpv's node-typed ones
/// (`demuxer-cache-state`, `track-list`) are not representable in libmpv2's `PropertyData` and
/// panic if observed. The scalar equivalents below carry everything Phase 1 needs.
mod property {
  pub const TIME_POS: u64 = 1;
  pub const DURATION: u64 = 2;
  pub const PAUSE: u64 = 3;
  pub const PAUSED_FOR_CACHE: u64 = 4;
  pub const CACHE_DURATION: u64 = 5;
  pub const EOF_REACHED: u64 = 6;
  pub const IDLE_ACTIVE: u64 = 7;
}

/// Where player events go. Set once by `player_subscribe`; a `tauri::ipc::Channel` is a direct,
/// ordered, single-consumer pipe, unlike `emit`, which broadcasts to every webview and
/// re-serialises per listener.
pub type EventSink = Arc<Mutex<Option<Channel<PlayerEvent>>>>;

pub fn new_event_sink() -> EventSink {
  Arc::new(Mutex::new(None))
}

fn publish(sink: &EventSink, event: PlayerEvent) {
  // Never held across an await: this is a plain lock, take-clone-drop.
  let channel = { sink.lock().ok().and_then(|guard| guard.clone()) };
  if let Some(channel) = channel {
    if let Err(error) = channel.send(event) {
      log::debug!("dropping player event, channel closed: {error}");
    }
  }
}

/// One coalesced snapshot rather than one message per property — one IPC hop per tick, not eight.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerTick {
  pub position: f64,
  pub duration: f64,
  pub paused: bool,
  /// mpv has stalled waiting for the demuxer cache — this is "buffering", distinct from paused.
  pub buffering: bool,
  /// Seconds of media already demuxed ahead of the playhead.
  pub cache_seconds: f64,
  pub eof: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PlayerEvent {
  #[serde(rename_all = "camelCase")]
  Tick(PlayerTick),
  #[serde(rename_all = "camelCase")]
  FileLoaded {
    duration: Option<f64>,
    /// Read back from `hwdec-current`, never `hwdec` — the latter only echoes what was asked
    /// for. `None` or `"no"` means software decode, which is a logged warning, not a silent
    /// pass.
    hardware_decoder: Option<String>,
  },
  #[serde(rename_all = "camelCase")]
  Ended {
    reason: String,
  },
  Idle,
  #[serde(rename_all = "camelCase")]
  Failed {
    message: String,
  },
  /// Torrent transfer progress, pushed down the same pipe so the UI has one event stream.
  #[serde(rename_all = "camelCase")]
  Transfer(crate::torrent::StreamProgress),
  /// Which ranked candidate the engine is currently trying, so failover is visible rather than
  /// looking like a hang.
  #[serde(rename_all = "camelCase")]
  Attempt {
    candidate_id: String,
    index: usize,
    total: usize,
  },
  /// Metadata resolution — before this completes even the file list is unknown.
  Resolving,
  /// The pointer moved somewhere over the window. Polled natively because the video surface
  /// swallows mouse events the webview would otherwise see (see `surface::watch_pointer`).
  PointerMoved,
}

/// libmpv refuses to start at all under a non-C `LC_NUMERIC`: `mpv_create()` prints "Non-C locale
/// detected" and returns NULL, which libmpv2 surfaces as the bare `Error::Null`. GTK calls
/// `setlocale(LC_ALL, "")` during init, so on any machine with `LANG=en_US.UTF-8` (i.e. most of
/// them) the player would fail with nothing but "Null" to explain itself.
///
/// Setting only `LC_NUMERIC` is what mpv's own embedding docs prescribe, and it is safe here: the
/// interface formats its numbers through JS `Intl`, not the C locale.
fn force_c_numeric_locale() {
  #[cfg(unix)]
  {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
      // SAFETY: `setlocale` with a valid category and a NUL-terminated literal. Called once,
      // before any mpv handle exists.
      unsafe { libc::setlocale(libc::LC_NUMERIC, c"C".as_ptr()) };
    });
  }
}

/// Everything set at creation: the options libmpv only reads before `mpv_initialize`, plus every
/// option whose default is wrong for a torrent-backed source. Discovering the latter later, when
/// playback stutters, is how "it stalls every 20 seconds" becomes folklore instead of a fixed bug.
///
/// All values are strings because mpv accepts the string form of every option, which keeps this a
/// single table one loop can walk — and lets `every_playback_option_is_accepted_by_libmpv` check
/// the whole list against the libmpv actually linked at runtime.
const PLAYBACK_OPTIONS: &[(&str, &str)] = &[
  // Decode. `gpu-next` is the current renderer; `auto-safe` picks VAAPI/NVDEC on Linux, D3D11VA
  // on Windows, VideoToolbox on macOS. Direct rendering lets the decoder own its buffers;
  // interpolation costs GPU for no benefit at TV distance.
  ("vo", "gpu-next"),
  // OpenGL rather than `auto`: `auto` prefers Vulkan here, and a Vulkan swapchain on a *shaped*
  // X11 child window (see player/surface.rs) is a far less travelled path than EGL/GLX on one.
  // Hardware decode is unaffected — VAAPI still engages through EGL.
  ("gpu-api", "opengl"),
  ("hwdec", "auto-safe"),
  ("vd-lavc-dr", "yes"),
  ("interpolation", "no"),
  // React owns every control and every key. mpv draws no OSD and binds no input.
  ("osc", "no"),
  ("osd-level", "0"),
  ("input-default-bindings", "no"),
  ("input-vo-keyboard", "no"),
  ("keep-open", "yes"),
  ("idle", "yes"),
  // Network cache. mpv's defaults assume a CDN; a torrent-backed HTTP source behaves nothing like
  // one, and an undersized demuxer buffer is the single most common cause of periodic stuttering
  // on this kind of stream. Start from these, then measure.
  ("cache", "yes"),
  ("demuxer-max-bytes", "256MiB"),
  ("demuxer-max-back-bytes", "128MiB"),
  ("demuxer-readahead-secs", "60"),
  ("cache-pause", "yes"),
  ("cache-pause-wait", "3"),
  ("hr-seek", "yes"),
  ("network-timeout", "60"),
];

/// Applies the tuning table best-effort.
///
/// A single option libmpv does not recognise — an mpv version older or newer than expected
/// renaming one — must not cost the family the whole film. Each rejection is logged by name so it
/// is diagnosable, and playback proceeds with mpv's default for that one setting.
fn apply_playback_options(init: &libmpv2::MpvInitializer) {
  for (name, value) in PLAYBACK_OPTIONS {
    if let Err(error) = init.set_property(name, *value) {
      log::warn!("libmpv rejected {name}={value} ({error}); continuing with its default");
    }
  }
}

pub struct MpvEngine {
  mpv: Arc<Mpv>,
  running: Arc<AtomicBool>,
}

impl MpvEngine {
  /// Creates the engine rendering into `wid` (an X11 window id from [`surface`]).
  ///
  /// Every option that cannot be changed later, and every option whose default is wrong for a
  /// torrent-backed source, is set here — discovering them later, when playback stutters, is
  /// how "it stalls every 20 seconds" becomes folklore instead of a fixed bug.
  pub fn new(wid: i64, sink: EventSink) -> PlayerResult<Self> {
    force_c_numeric_locale();
    let mpv = Mpv::with_initializer(|init| {
      // Fatal: without a target window there is nothing to render into, and `wid` is one of the
      // options libmpv only reads at creation time.
      init.set_property("wid", wid)?;
      apply_playback_options(&init);
      Ok(())
    })
    .map_err(|error| PlayerError::EngineUnavailable(error.to_string()))?;

    let mpv = Arc::new(mpv);
    for (name, format, id) in [
      ("time-pos", Format::Double, property::TIME_POS),
      ("duration", Format::Double, property::DURATION),
      ("pause", Format::Flag, property::PAUSE),
      ("paused-for-cache", Format::Flag, property::PAUSED_FOR_CACHE),
      (
        "demuxer-cache-duration",
        Format::Double,
        property::CACHE_DURATION,
      ),
      ("eof-reached", Format::Flag, property::EOF_REACHED),
      ("idle-active", Format::Flag, property::IDLE_ACTIVE),
    ] {
      mpv
        .observe_property(name, format, id)
        .map_err(PlayerError::mpv)?;
    }

    let running = Arc::new(AtomicBool::new(true));
    spawn_event_loop(mpv.clone(), sink, running.clone());
    Ok(Self { mpv, running })
  }

  pub fn load(&self, url: &str) -> PlayerResult<()> {
    self
      .mpv
      .command("loadfile", &[url, "replace"])
      .map_err(PlayerError::mpv)
  }

  pub fn set_paused(&self, paused: bool) -> PlayerResult<()> {
    self
      .mpv
      .set_property("pause", paused)
      .map_err(PlayerError::mpv)
  }

  /// Absolute seek. `hr-seek=yes` makes it frame-exact rather than keyframe-snapped.
  pub fn seek(&self, seconds: f64) -> PlayerResult<()> {
    self
      .mpv
      .command("seek", &[&seconds.to_string(), "absolute"])
      .map_err(PlayerError::mpv)
  }

  pub fn set_volume(&self, volume: f64) -> PlayerResult<()> {
    self
      .mpv
      .set_property("volume", volume.clamp(0.0, 130.0))
      .map_err(PlayerError::mpv)
  }

  pub fn set_property(&self, name: &str, value: &str) -> PlayerResult<()> {
    self.mpv.set_property(name, value).map_err(PlayerError::mpv)
  }

  pub fn get_property(&self, name: &str) -> PlayerResult<String> {
    self
      .mpv
      .get_property::<String>(name)
      .map_err(PlayerError::mpv)
  }

  pub fn stop(&self) -> PlayerResult<()> {
    self.mpv.command("stop", &[]).map_err(PlayerError::mpv)
  }
}

impl Drop for MpvEngine {
  fn drop(&mut self) {
    self.running.store(false, Ordering::Relaxed);
  }
}

/// Runs libmpv's event queue on its own thread.
///
/// It has to be a dedicated OS thread rather than a tokio task: `wait_event` blocks, and blocking
/// a runtime worker for the length of a film would starve everything else on it.
fn spawn_event_loop(mpv: Arc<Mpv>, sink: EventSink, running: Arc<AtomicBool>) {
  std::thread::Builder::new()
    .name("arcadia-mpv-events".into())
    .spawn(move || {
      let mut tick = PlayerTick {
        position: 0.0,
        duration: 0.0,
        paused: false,
        buffering: false,
        cache_seconds: 0.0,
        eof: false,
      };
      let mut dirty = false;
      let mut last_sent = Instant::now() - TICK_INTERVAL;

      while running.load(Ordering::Relaxed) {
        let Some(event) = mpv.wait_event(0.2) else {
          // No event within the timeout — still flush a pending tick so the scrubber
          // keeps moving while nothing else is happening.
          if dirty && last_sent.elapsed() >= TICK_INTERVAL {
            publish(&sink, PlayerEvent::Tick(tick.clone()));
            last_sent = Instant::now();
            dirty = false;
          }
          continue;
        };

        match event {
          Ok(libmpv2::events::Event::PropertyChange {
            change,
            reply_userdata,
            ..
          }) => {
            if apply_property(&mut tick, reply_userdata, &change) {
              publish(&sink, PlayerEvent::Idle);
            }
            dirty = true;
          }
          Ok(libmpv2::events::Event::FileLoaded) => {
            let duration = mpv.get_property::<f64>("duration").ok();
            let decoder = mpv.get_property::<String>("hwdec-current").ok();
            // Confirms mpv embedded rather than opening its own window: a `wayland` context here
            // means `wid` was ignored (see the note in main.rs).
            let context = mpv
              .get_property::<String>("current-gpu-context")
              .unwrap_or_else(|_| "unknown".into());
            if context.starts_with("wayland") {
              log::error!(
                "mpv chose the {context} context, which ignores `wid` — video will render in its own window"
              );
            } else {
              log::info!("mpv video context: {context}");
            }
            match decoder.as_deref() {
              None | Some("no") | Some("") => {
                log::warn!("no hardware decoder is active — playback will decode in software")
              }
              Some(name) => log::info!("hardware decode active: {name}"),
            }
            publish(
              &sink,
              PlayerEvent::FileLoaded {
                duration,
                hardware_decoder: decoder,
              },
            );
          }
          Ok(libmpv2::events::Event::EndFile(reason)) => {
            publish(
              &sink,
              PlayerEvent::Ended {
                reason: end_reason(reason),
              },
            );
          }
          Ok(libmpv2::events::Event::PlaybackRestart) => {
            // Forces the scrubber to catch up immediately after a seek.
            dirty = true;
            last_sent = Instant::now() - TICK_INTERVAL;
          }
          Ok(libmpv2::events::Event::Shutdown) => break,
          Ok(_) => {}
          Err(error) => {
            publish(
              &sink,
              PlayerEvent::Failed {
                message: error.to_string(),
              },
            );
          }
        }

        if dirty && last_sent.elapsed() >= TICK_INTERVAL {
          publish(&sink, PlayerEvent::Tick(tick.clone()));
          last_sent = Instant::now();
          dirty = false;
        }
      }
    })
    .expect("failed to spawn the mpv event thread");
}

/// Folds one property change into the running snapshot. Returns `true` when the player went
/// idle, which is a discrete lifecycle event rather than part of the tick.
fn apply_property(
  tick: &mut PlayerTick,
  id: u64,
  change: &libmpv2::events::PropertyData<'_>,
) -> bool {
  use libmpv2::events::PropertyData;
  match (id, change) {
    (property::TIME_POS, PropertyData::Double(value)) => tick.position = *value,
    (property::DURATION, PropertyData::Double(value)) => tick.duration = *value,
    (property::CACHE_DURATION, PropertyData::Double(value)) => tick.cache_seconds = *value,
    (property::PAUSE, PropertyData::Flag(value)) => tick.paused = *value,
    (property::PAUSED_FOR_CACHE, PropertyData::Flag(value)) => tick.buffering = *value,
    (property::EOF_REACHED, PropertyData::Flag(value)) => tick.eof = *value,
    (property::IDLE_ACTIVE, PropertyData::Flag(true)) => {
      tick.position = 0.0;
      tick.duration = 0.0;
      return true;
    }
    _ => {}
  }
  false
}

fn end_reason(reason: libmpv2::EndFileReason) -> String {
  match reason {
    libmpv2::mpv_end_file_reason::Eof => "eof",
    libmpv2::mpv_end_file_reason::Stop => "stop",
    libmpv2::mpv_end_file_reason::Quit => "quit",
    libmpv2::mpv_end_file_reason::Error => "error",
    libmpv2::mpv_end_file_reason::Redirect => "redirect",
    _ => "unknown",
  }
  .to_string()
}

#[cfg(test)]
mod tests {
  use super::{PLAYBACK_OPTIONS, force_c_numeric_locale};
  use libmpv2::Mpv;

  /// Checks every option name/value in [`PLAYBACK_OPTIONS`] against the libmpv actually linked at
  /// runtime, and — by getting as far as a live handle at all — that the `LC_NUMERIC` fix holds.
  ///
  /// Without this, a renamed or mistyped option is invisible until someone presses play on a real
  /// machine, and surfaces as an opaque `Raw(-5)`. Creating the handle does not open a video
  /// output, so this runs headless.
  #[test]
  fn every_playback_option_is_accepted_by_libmpv() {
    force_c_numeric_locale();
    let mut rejected = Vec::new();
    let mpv = Mpv::with_initializer(|init| {
      for (name, value) in PLAYBACK_OPTIONS {
        if let Err(error) = init.set_property(name, *value) {
          rejected.push(format!("{name}={value} ({error})"));
        }
      }
      Ok(())
    });

    assert!(
      rejected.is_empty(),
      "libmpv rejected these options: {}",
      rejected.join(", ")
    );
    assert!(
      mpv.is_ok(),
      "libmpv could not create a handle: {:?}",
      mpv.err()
    );
  }

  /// `mpv_create()` returns NULL under a non-C `LC_NUMERIC`, which libmpv2 reports as the bare
  /// `Error::Null` — the literal "Null" a family member saw on screen before this was fixed.
  #[test]
  fn a_handle_can_be_created_under_the_ambient_locale() {
    force_c_numeric_locale();
    assert!(Mpv::new().is_ok(), "mpv_create() failed under this locale");
  }
}
