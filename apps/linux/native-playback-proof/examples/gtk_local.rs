//! Standalone proof. No app bridge, HTTP services, tokens or user mpv config.
#![forbid(unsafe_code)]

use std::{cell::Cell, path::PathBuf, rc::Rc, time::Duration};

use gtk::{gdk, glib, prelude::*};
use nahhasio_native_playback_proof::ProofPlayer;
use webkit6::prelude::*;

fn main() -> glib::ExitCode {
    // libmpv requires LC_NUMERIC=C. Keep the process's initial C locale instead
    // of letting GTK change it; production must establish locale before threads.
    gtk::disable_setlocale();
    let mut path = None;
    let mut smoke = false;
    let mut web_overlay = false;
    for arg in std::env::args().skip(1) {
        match arg.as_str() {
            "--smoke" => smoke = true,
            "--web-overlay" => web_overlay = true,
            _ if path.is_none() && !arg.starts_with('-') => path = Some(PathBuf::from(arg)),
            _ => {
                eprintln!("Usage: gtk_local LOCAL_VIDEO [--smoke] [--web-overlay]");
                return glib::ExitCode::FAILURE;
            }
        }
    }
    let Some(path) = path else {
        eprintln!("Usage: gtk_local LOCAL_VIDEO [--smoke] [--web-overlay]");
        return glib::ExitCode::FAILURE;
    };
    let failed = Rc::new(Cell::new(false));
    let app = gtk::Application::builder()
        .application_id("io.nahhasio.NativePlaybackProof")
        .flags(gtk::gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate({
        let failed = failed.clone();
        move |app| {
            let player = match ProofPlayer::new(&path) {
                Ok(player) => Rc::new(player),
                Err(error) => {
                    eprintln!("proof: {error}");
                    failed.set(true);
                    app.quit();
                    return;
                }
            };
            let window = gtk::ApplicationWindow::builder()
                .application(app)
                .title("Nahhasio — isolated native playback proof")
                .default_width(960)
                .default_height(600)
                .build();
            let layout = gtk::Box::new(gtk::Orientation::Vertical, 0);
            let overlay = gtk::Overlay::new();
            overlay.set_child(Some(player.area()));
            layout.append(&overlay);
            let controls = gtk::Box::new(gtk::Orientation::Horizontal, 12);
            for (label, action) in [
                ("−5s", 0),
                ("Play / Pause", 1),
                ("+5s", 2),
                ("Fullscreen", 3),
            ] {
                let button = gtk::Button::with_label(label);
                button.connect_clicked({
                    let player = player.clone();
                    let window = window.downgrade();
                    move |_| match action {
                        0 => player.seek(-5),
                        1 => player.toggle_pause(),
                        2 => player.seek(5),
                        _ => {
                            if let Some(window) = window.upgrade() {
                                toggle_fullscreen(&window);
                            }
                        }
                    }
                });
                controls.append(&button);
            }
            layout.append(&controls);
            window.set_child(Some(&layout));
            let keys = gtk::EventControllerKey::new();
            keys.connect_key_pressed({
                let player = player.clone();
                let window = window.downgrade();
                move |_, key, _, _| {
                    match key {
                        gdk::Key::space => player.toggle_pause(),
                        gdk::Key::Left => player.seek(-5),
                        gdk::Key::Right => player.seek(5),
                        gdk::Key::F11 => {
                            if let Some(window) = window.upgrade() {
                                toggle_fullscreen(&window);
                            }
                        }
                        gdk::Key::Escape => {
                            if let Some(window) = window.upgrade() {
                                window.unfullscreen();
                            }
                        }
                        _ => return glib::Propagation::Proceed,
                    }
                    glib::Propagation::Stop
                }
            });
            window.add_controller(keys);
            window.connect_close_request({
                let player = player.clone();
                let failed = failed.clone();
                move |_| {
                    failed.set(player.diagnostics().failures > 0);
                    glib::Propagation::Proceed
                }
            });
            if web_overlay {
                let manager = webkit6::UserContentManager::new();
                manager.register_script_message_handler("proof", None);
                manager.connect_script_message_received(Some("proof"), {
                    let player = player.clone();
                    let window = window.downgrade();
                    move |_, value| match value.to_string().as_str() {
                        "pause" => player.toggle_pause(),
                        "back" => player.seek(-5),
                        "forward" => player.seek(5),
                        "fullscreen" => {
                            if let Some(window) = window.upgrade() {
                                toggle_fullscreen(&window);
                            }
                        }
                        _ => {}
                    }
                });
                let view = webkit6::WebView::builder()
                    .user_content_manager(&manager)
                    .hexpand(true)
                    .vexpand(true)
                    .build();
                view.set_background_color(&gdk::RGBA::new(0.0, 0.0, 0.0, 0.0));
                view.connect_load_changed(|_, event| {
                    if event == webkit6::LoadEvent::Finished {
                        eprintln!("proof: transparent WebKit diagnostic overlay loaded");
                    }
                });
                view.load_html(include_str!("overlay.html"), Some("about:blank"));
                overlay.add_overlay(&view);
                // Overlay should follow video allocation, not impose its size.
                overlay.set_measure_overlay(&view, false);
                overlay.set_clip_overlay(&view, true);
            }
            window.present();
            if smoke {
                let tick = Cell::new(0);
                let failed = failed.clone();
                let app = app.downgrade();
                glib::timeout_add_local(Duration::from_secs(1), move || {
                    let current = tick.get() + 1;
                    tick.set(current);
                    match current {
                        2 => {
                            eprintln!("proof: smoke pause");
                            player.toggle_pause();
                        }
                        3 => {
                            eprintln!("proof: smoke resume/seek");
                            player.toggle_pause();
                            player.seek(2);
                        }
                        4 => window.fullscreen(),
                        5 => {
                            window.unfullscreen();
                            window.set_default_size(800, 500);
                        }
                        6 => {
                            eprintln!("proof: smoke detach GLArea");
                            overlay.set_child(gtk::Widget::NONE);
                        }
                        7 => {
                            eprintln!("proof: smoke reattach GLArea");
                            overlay.set_child(Some(player.area()));
                        }
                        12 => {
                            window.destroy();
                            let diagnostics = player.diagnostics();
                            let pass = diagnostics.realizes == 2
                                && diagnostics.teardowns == 2
                                && diagnostics.loaded == 2
                                && diagnostics.renders > 30
                                && diagnostics.changed_samples > 3
                                && diagnostics.position > 0.0
                                && diagnostics.failures == 0;
                            eprintln!(
                                "proof: smoke {} {diagnostics:?}",
                                if pass { "PASS" } else { "FAIL" }
                            );
                            failed.set(!pass);
                            if let Some(app) = app.upgrade() {
                                app.quit();
                            }
                            return glib::ControlFlow::Break;
                        }
                        _ => {}
                    }
                    glib::ControlFlow::Continue
                });
            }
        }
    });
    // Do not forward diagnostic flags/file arguments to GApplication.
    app.run_with_args::<&str>(&[]);
    if failed.get() {
        glib::ExitCode::FAILURE
    } else {
        glib::ExitCode::SUCCESS
    }
}

fn toggle_fullscreen(window: &gtk::ApplicationWindow) {
    if window.is_fullscreen() {
        window.unfullscreen();
    } else {
        window.fullscreen();
    }
}
