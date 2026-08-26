// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // WebKitGTK's Wayland compositing path has a long-standing upstream DPI-scaling bug (wrong
  // devicePixelRatio -> half-scale layout, e.g. tauri-apps/tauri#14590) that misreports the
  // viewport as narrower than it is, breaking responsive breakpoints and hover hit-testing.
  // Forcing GTK onto XWayland avoids that path entirely, so blur/backdrop-filter and animations
  // keep working (unlike the documented WEBKIT_DISABLE_COMPOSITING_MODE workaround). Must be set
  // before GTK initializes inside app_lib::run(). Linux only; harmless no-op elsewhere.
  #[cfg(target_os = "linux")]
  unsafe {
    std::env::set_var("GDK_BACKEND", "x11");

    // `GDK_BACKEND` only steers GTK. libmpv reads the environment for itself, and its `gpu-next`
    // video output probes the Wayland context first whenever `WAYLAND_DISPLAY` is set — a context
    // in which `wid` is meaningless, because embedding into a foreign window is an X11 concept
    // Wayland deliberately has no equivalent for. mpv would therefore ignore the surface we hand
    // it and open a top-level window of its own, which is what "the video plays in a second
    // window, and fullscreen only resizes the controls" looked like on a Wayland session (Niri).
    //
    // Removing the variable makes the whole process a consistent X11 client, so mpv's own
    // auto-probing lands on x11egl/GLX and honours `wid`. Everything here already runs through
    // XWayland because of the line above, so nothing is lost.
    std::env::remove_var("WAYLAND_DISPLAY");
  }

  app_lib::run();
}
