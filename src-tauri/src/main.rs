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
  }

  app_lib::run();
}
