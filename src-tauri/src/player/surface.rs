//! The native video surface the webview shares the window with.
//!
//! mpv draws into a **child `GdkWindow` of the toplevel**, filling the window and shaped so the
//! interface shows through it.
//!
//! ## Why the video sits *above* the webview, with holes cut in it
//!
//! X11 does not alpha-blend sibling windows: at any pixel the topmost sibling simply wins. Video
//! *below* a transparent webview is therefore invisible — the webview paints alpha-0 pixels over
//! it and you see the desktop while the audio plays on. Video *above* an opaque webview hides the
//! controls instead. Neither ordering alone can produce controls floating over a picture.
//!
//! So the surface is stacked on top and then **shaped**: its bounding region is the whole window
//! minus the rectangles the interface currently occupies. The webview shows through those holes.
//! The picture is never cropped or resized — it is occluded exactly where the controls are, which
//! is what a floating control bar looks like. When the controls hide, the holes disappear and the
//! video covers the window again.
//!
//! The alternative is mpv's GL render API drawing into a GTK `GLArea`, which would allow true
//! per-pixel blending (rounded corners, blur behind the bar). That needs a widget above the
//! webview, which is precisely what the next section explains cannot be done here.
//!
//! ## Why the widget tree is left exactly as Tauri built it
//!
//! `tauri-runtime-wry` attaches an undecorated-resize handler to every Linux window-content
//! webview (unconditionally — the `is_decorated()` check happens *inside* the handler, too late),
//! and that handler does:
//!
//! ```ignore
//! let window: gtk::Window = webview.parent().and_then(|w| w.parent()).downcast().unwrap();
//! ```
//!
//! It hard-codes "the webview's grandparent is the toplevel". Any container added above the
//! webview makes that `unwrap` fail — inside a GTK signal trampoline, a C frame that cannot
//! unwind, so the panic becomes `abort` on the first left click. A sibling GdkWindow touches no
//! widget, so the assumption keeps holding.
//!
//! ## Why X11 and not Wayland
//!
//! `main.rs` forces `GDK_BACKEND=x11` *and* removes `WAYLAND_DISPLAY`. Embedding into a foreign
//! window through `wid` is an X11 concept with no Wayland equivalent, so mpv's Wayland contexts
//! ignore it and open a window of their own. See the note in `main.rs`.

use std::sync::{Arc, Mutex};

use crate::error::{PlayerError, PlayerResult};

/// A piece of interface, in logical pixels, that the video must not cover.
///
/// `radius` is the element's CSS corner radius. Cutting a plain rectangle for a rounded control
/// leaves the corners of the hole showing the page behind it instead of the picture, which reads
/// as four black notches around every button — so the corners are cut away too.
#[derive(Debug, Clone, Copy, serde::Deserialize)]
pub struct UiRect {
  pub x: i32,
  pub y: i32,
  pub width: i32,
  pub height: i32,
  /// `f64`, deliberately, not `i32`. The frontend already clamps this to at most half the box's
  /// own smaller side before sending it (see the comment beside where these rectangles are
  /// measured, in `player-page.tsx`) — but that clamp exists precisely *because* this field once
  /// arrived unclamped: Tailwind's `rounded-full` reports its literal `calc(infinity * 1px)`
  /// specified radius through `getComputedStyle`, not the value it actually paints with once the
  /// browser clamps it at render time. A JSON number that size always round-trips through `f64`;
  /// it does not always fit an `i32` one, and when it didn't, serde failed to deserialize this
  /// whole array — silently, since the caller only `.catch()`es — leaving the surface stuck
  /// unshaped forever, with no way for the family to get the controls back onto the picture.
  /// `f64` removes that failure mode at the type level, for this field and any future one like
  /// it, rather than depending on every caller getting its own clamp right.
  #[serde(default)]
  pub radius: f64,
}

#[derive(Default)]
struct SurfaceState {
  /// Hidden until the first frame, and again on stop — otherwise the last decoded frame stays on
  /// screen after leaving the player, covering whatever the app navigated to.
  visible: bool,
  regions: Vec<UiRect>,
}

/// Handle to the video surface, shared between the frontend and the GTK main thread.
#[derive(Clone)]
pub struct VideoLayout {
  state: Arc<Mutex<SurfaceState>>,
  /// The X11 id of the surface. `gdk::Window` is not `Send`, but its id is — so the main thread
  /// finds the window again by matching this against the toplevel's children.
  xid: i64,
}

impl VideoLayout {
  pub fn xid(&self) -> i64 {
    self.xid
  }

  /// Never held across an await: lock, replace, drop.
  pub fn set(&self, visible: bool, regions: Vec<UiRect>) {
    if let Ok(mut state) = self.state.lock() {
      state.visible = visible;
      state.regions = regions;
    }
  }
}

/// Builds the video surface and returns the handle libmpv and the frontend both need.
///
/// GTK is main-thread-only, so this hops onto it and waits for the answer.
pub fn attach_video_surface(
  window: &tauri::Window,
  on_pointer_move: impl Fn() + Send + 'static,
) -> PlayerResult<VideoLayout> {
  #[cfg(not(target_os = "linux"))]
  {
    let _ = (window, on_pointer_move);
    Err(PlayerError::SurfaceUnavailable(
      "embedded playback is implemented for Linux only so far".into(),
    ))
  }

  #[cfg(target_os = "linux")]
  {
    let state = Arc::new(Mutex::new(SurfaceState::default()));
    let (sender, receiver) = std::sync::mpsc::channel::<Result<i64, String>>();
    // The GTK types are not `Send`, so the window (which is) crosses the thread boundary and
    // everything else is looked up once we are already on the main thread.
    let main_thread_window = window.clone();
    let state_for_main = state.clone();
    window
      .run_on_main_thread(move || {
        let _ = sender.send(
          main_thread_window
            .gtk_window()
            .map_err(|error| error.to_string())
            .and_then(|gtk_window| build_surface(&gtk_window, state_for_main, on_pointer_move)),
        );
      })
      .map_err(|error| PlayerError::SurfaceUnavailable(error.to_string()))?;

    let xid = receiver
      .recv_timeout(std::time::Duration::from_secs(5))
      .map_err(|_| PlayerError::SurfaceUnavailable("the GTK main thread did not respond".into()))?
      .map_err(PlayerError::SurfaceUnavailable)?;

    Ok(VideoLayout { state, xid })
  }
}

/// Re-applies visibility and the interface cut-outs after the frontend has changed them.
pub fn refresh_video_layout(window: &tauri::Window, layout: &VideoLayout) -> PlayerResult<()> {
  #[cfg(not(target_os = "linux"))]
  {
    let _ = (window, layout);
    Ok(())
  }

  #[cfg(target_os = "linux")]
  {
    let main_thread_window = window.clone();
    let layout = layout.clone();
    window
      .run_on_main_thread(move || {
        use gtk::prelude::*;
        let Ok(gtk_window) = main_thread_window.gtk_window() else {
          return;
        };
        let Some(toplevel) = gtk_window.window() else {
          return;
        };
        for child in toplevel.children() {
          let is_ours = child
            .clone()
            .downcast::<gdkx11::X11Window>()
            .map(|x11| i64::try_from(x11.xid()).unwrap_or(-1) == layout.xid)
            .unwrap_or(false);
          if is_ours {
            apply_layout(&child, &gtk_window, &layout.state);
            break;
          }
        }
      })
      .map_err(|error| PlayerError::SurfaceUnavailable(error.to_string()))
  }
}

#[cfg(target_os = "linux")]
fn apply_layout(
  video: &gdk::Window,
  gtk_window: &gtk::ApplicationWindow,
  state: &Arc<Mutex<SurfaceState>>,
) {
  use gdk::cairo::{RectangleInt, Region};
  use gtk::prelude::*;

  let width = gtk_window.allocated_width().max(1);
  let height = gtk_window.allocated_height().max(1);
  video.move_resize(0, 0, width, height);

  let Ok(state) = state.lock() else { return };
  if !state.visible {
    // Clipped away rather than unmapped. The window must stay *mapped* for as long as mpv exists:
    // its EGL/GLX surface is bound to this X window, and binding to — or being unmapped into — an
    // unviewable window makes the driver render nothing at all. An empty shape makes it invisible
    // while keeping it viewable, which is all the caller actually wants.
    video.shape_combine_region(Some(&Region::create()), 0, 0);
    return;
  }

  if state.regions.is_empty() {
    // `None` *removes* the shape rather than setting a full-window one. Worth doing rather than
    // shaping to the whole rectangle: a shaped window is a different code path in the X server and
    // the GPU driver, and there is no reason to be on it when nothing is being cut out.
    video.shape_combine_region(None, 0, 0);
  } else {
    // The shape is the whole surface minus the interface. Punching holes rather than shrinking the
    // surface keeps the picture full-size and un-cropped while the bar sits over it.
    let region = Region::create_rectangle(&RectangleInt::new(0, 0, width, height));
    for rect in &state.regions {
      // Clamped into the surface: a stale rectangle from a resize, or one measured mid-animation,
      // must not be able to subtract more than exists.
      let x = rect.x.clamp(0, width);
      let y = rect.y.clamp(0, height);
      let w = rect.width.max(0).min(width - x);
      let h = rect.height.max(0).min(height - y);
      if w > 0 && h > 0 {
        // A float-to-int cast in Rust saturates rather than wrapping or panicking (since 1.45),
        // so even an unclamped `calc(infinity * 1px)`-sized value lands safely at `i32::MAX` here
        // — and `subtract_rounded_rect` below clamps it again against the rectangle's own size
        // regardless, so the value only ever matters for correctness, never for safety.
        #[allow(clippy::cast_possible_truncation)]
        let radius = rect.radius.max(0.0).round() as i32;
        subtract_rounded_rect(&region, x, y, w, h, radius);
      }
    }
    // A region that swallowed the whole surface would look exactly like "the video broke".
    // Logged with its extents so an empty shape is distinguishable from a rendering failure.
    let extents = RectangleInt::new(0, 0, 0, 0);
    region.extents(&extents);
    if region.is_empty() {
      log::warn!(
        "the interface cut-outs covered the entire {width}x{height} surface; leaving it unshaped"
      );
      video.shape_combine_region(None, 0, 0);
    } else {
      log::debug!(
        "video shape: {width}x{height} minus {} cut-out(s), visible extent {}x{} at {},{}",
        state.regions.len(),
        extents.width(),
        extents.height(),
        extents.x(),
        extents.y()
      );
      video.shape_combine_region(Some(&region), 0, 0);
    }
  }
  video.show();
  video.raise();
}

/// Reports pointer movement anywhere over the window.
///
/// The video surface is a native X11 child covering the whole window, so pointer events over the
/// picture are delivered to *it* and never reach the webview — which means the interface's
/// mouse-move listener only ever fires over the small cut-outs the controls occupy. Once the
/// controls auto-hid, there were no cut-outs left, so nothing could wake them again.
///
/// Polling the pointer's position asks the X server directly and so is indifferent to which
/// window it happens to be over. 100 ms is far below the threshold where a person notices lag on
/// "move the mouse to bring the controls back", and the callback only fires when the position
/// actually changed, so a still mouse costs one cheap query.
#[cfg(target_os = "linux")]
fn watch_pointer(gtk_window: &gtk::ApplicationWindow, on_pointer_move: impl Fn() + 'static) {
  use gtk::prelude::*;

  let Some(toplevel) = gtk_window.window() else {
    return;
  };
  let Some(pointer) = toplevel
    .display()
    .default_seat()
    .and_then(|seat| seat.pointer())
  else {
    log::warn!("no pointer device; the controls will only wake on a key press");
    return;
  };

  let last = std::cell::Cell::new((i32::MIN, i32::MIN));
  glib::timeout_add_local(std::time::Duration::from_millis(100), move || {
    let (_, x, y, _) = toplevel.device_position(&pointer);
    if last.get() != (x, y) {
      last.set((x, y));
      on_pointer_move();
    }
    glib::ControlFlow::Continue
  });
}

/// Subtracts a rounded rectangle by cutting the straight middle in one piece and each corner row
/// by row. A `cairo::Region` is a set of rectangles, so a curve has to be approximated — one
/// scanline per pixel of radius is exact enough that the result is indistinguishable from the
/// CSS corner it is following, and a radius is at most a couple of dozen pixels.
#[cfg(target_os = "linux")]
fn subtract_rounded_rect(
  region: &gdk::cairo::Region,
  x: i32,
  y: i32,
  width: i32,
  height: i32,
  radius: i32,
) {
  use gdk::cairo::RectangleInt;

  // A radius cannot exceed half of either side, or opposite corners would overlap.
  let radius = radius.clamp(0, (width.min(height)) / 2);
  if radius == 0 {
    let _ = region.subtract_rectangle(&RectangleInt::new(x, y, width, height));
    return;
  }

  // The straight middle band, full width.
  let _ = region.subtract_rectangle(&RectangleInt::new(
    x,
    y + radius,
    width,
    height - 2 * radius,
  ));

  // The corner bands, inset per row by the circle that the radius describes.
  for row in 0..radius {
    let dy = f64::from(radius - row);
    let dx = f64::from(radius) - (f64::from(radius * radius) - dy * dy).sqrt();
    #[allow(clippy::cast_possible_truncation)]
    let inset = dx.round() as i32;
    let inner = width - 2 * inset;
    if inner <= 0 {
      continue;
    }
    let _ = region.subtract_rectangle(&RectangleInt::new(x + inset, y + row, inner, 1));
    let _ = region.subtract_rectangle(&RectangleInt::new(
      x + inset,
      y + height - 1 - row,
      inner,
      1,
    ));
  }
}

#[cfg(target_os = "linux")]
fn build_surface(
  gtk_window: &gtk::ApplicationWindow,
  state: Arc<Mutex<SurfaceState>>,
  on_pointer_move: impl Fn() + 'static,
) -> Result<i64, String> {
  // `gtk::prelude` brings in `Cast`, which is what makes the `GdkWindow` downcast below work;
  // `xid()` is an inherent method on the X11 window type.
  use gtk::prelude::*;

  let toplevel = gtk_window
    .window()
    .ok_or_else(|| "the window is not realized yet".to_string())?;

  let width = gtk_window.allocated_width().max(1);
  let height = gtk_window.allocated_height().max(1);
  let attributes = gdk::WindowAttr {
    window_type: gdk::WindowType::Child,
    x: Some(0),
    y: Some(0),
    width,
    height,
    wclass: gdk::WindowWindowClass::InputOutput,
    // No event mask: every click and keystroke belongs to the webview, which is where all the
    // controls live. An input-grabbing video plane would swallow them.
    event_mask: gdk::EventMask::empty(),
    ..Default::default()
  };

  let video = gdk::Window::new(Some(&toplevel), &attributes);

  // **This call is what makes `wid` work at all.** GTK3 child windows are "client-side" by
  // default: GDK draws them onto the toplevel and they have no X11 window of their own, so
  // `gdk_x11_window_get_xid()` hands back the *nearest native ancestor's* id instead. libmpv is
  // then given an id that is not the surface we made, and opens its own top-level window.
  if !video.ensure_native() {
    return Err("GDK could not back the video surface with a native X11 window".to_string());
  }

  // **Mapped immediately, and kept that way.** mpv binds its EGL surface to this window during
  // `MpvEngine::new`, which runs moments after this function returns — and an X window that is not
  // viewable at that moment yields a context that silently renders nothing. Invisibility before
  // the first frame is done with an empty shape instead (see `apply_layout`), never by unmapping.
  video.show();
  video.raise();

  // Re-apply on every resize. Without this the surface keeps its creation size, so the picture is
  // cropped against a stale rectangle — and fullscreen would show a window-sized image on a
  // screen-sized window.
  let resizable = video.clone();
  let resize_state = state.clone();
  gtk_window.connect_size_allocate(move |window, _| {
    apply_layout(&resizable, window, &resize_state);
  });

  watch_pointer(gtk_window, on_pointer_move);

  let is_native = video.has_native();
  let x11_window = video
    .downcast::<gdkx11::X11Window>()
    .map_err(|_| "the video surface is not an X11 window (Wayland-native session?)".to_string())?;
  let xid = i64::try_from(x11_window.xid())
    .map_err(|_| "the X11 window id does not fit in a libmpv wid".to_string())?;

  // Logged because "no picture" has several very different causes. Comparing the surface id with
  // the toplevel's separates them without needing someone to watch the screen: equal ids mean the
  // surface never became native and mpv is about to open a window of its own.
  let toplevel_xid = toplevel
    .downcast::<gdkx11::X11Window>()
    .map(|window| i64::try_from(window.xid()).unwrap_or(-1))
    .unwrap_or(-1);
  if xid == toplevel_xid {
    return Err(format!(
      "the video surface resolved to the toplevel window ({xid}); mpv would open its own window"
    ));
  }
  log::info!(
    "video surface ready: wid={xid} (toplevel {toplevel_xid}), {width}x{height}, native={is_native}"
  );
  Ok(xid)
}
