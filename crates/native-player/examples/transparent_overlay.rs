//! Native regression for transparent WebKit updates over libmpv. No API, DB or network.
//! Run through nahhasio-native-runtime with a generated local video as the only argument.
#![forbid(unsafe_code)]

use gtk::{gdk, gio, glib, prelude::*};
use nahhasio_native_player::NativePlayer;
use std::{cell::Cell, path::PathBuf, rc::Rc, time::Duration};
use webkit6::prelude::*;

fn main() -> glib::ExitCode {
    gtk::disable_setlocale();
    let Some(path) = std::env::args_os().nth(1).map(PathBuf::from) else {
        eprintln!("Usage: transparent_overlay GENERATED_LOCAL_VIDEO");
        return glib::ExitCode::FAILURE;
    };
    let passed = Rc::new(Cell::new(false));
    let app = gtk::Application::builder()
        .application_id("io.nahhasio.TransparentOverlayRegression")
        .flags(gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate({
        let passed = passed.clone();
        move |app| {
            let player = Rc::new(NativePlayer::local(&path).expect("generated local fixture"));
            let view = webkit6::WebView::builder()
                .hexpand(true)
                .vexpand(true)
                .build();
            view.set_background_color(&gdk::RGBA::new(0.0, 0.0, 0.0, 0.0));
            let overlay = gtk::Overlay::new();
            overlay.set_child(Some(player.area()));
            overlay.add_overlay(&view);
            let window = gtk::ApplicationWindow::builder()
                .application(app)
                .title("Transparent overlay regression")
                .default_width(800)
                .default_height(500)
                .child(&overlay)
                .build();
            // Synthetic old page, controls and popover; deliberately separate updates.
            view.load_html(
                "<!doctype html><html><body style='margin:0;background:#b03020'>\
                 <div id='page' style='position:fixed;inset:0;background:#b03020'></div>\
                 <div id='control' style='position:fixed;left:40px;top:40px;width:120px;height:80px;background:rgba(255,255,255,.5)'></div>\
                 <div id='popover' style='position:fixed;left:200px;top:40px;width:120px;height:80px;background:rgba(50,100,255,.7)'></div>\
                 </body></html>",
                Some("about:blank"),
            );
            window.present();
            let app = app.clone();
            let passed = passed.clone();
            glib::MainContext::default().spawn_local(async move {
                let result = run(&window, &view, &player).await;
                match result {
                    Ok(()) => {
                        passed.set(true);
                        eprintln!("transparent-overlay: PASS");
                    }
                    Err(error) => eprintln!("transparent-overlay: FAIL {error}"),
                }
                app.quit();
            });
        }
    });
    app.run_with_args::<&str>(&[]);
    if passed.get() {
        glib::ExitCode::SUCCESS
    } else {
        glib::ExitCode::FAILURE
    }
}

async fn script(view: &webkit6::WebView, script: &str) -> Result<(), String> {
    view.evaluate_javascript_future(script, None, None)
        .await
        .map_err(|error| error.to_string())?;
    glib::timeout_future(Duration::from_millis(700)).await;
    Ok(())
}

// Snapshot the GTK-side WebView, not WebKit's fresh WebProcess snapshot: the
// latter would bypass the backing store whose stale alpha this regression tests.
fn alpha_at(
    window: &gtk::ApplicationWindow,
    view: &webkit6::WebView,
    x: usize,
    y: usize,
) -> Result<u8, String> {
    let paintable = gtk::WidgetPaintable::new(Some(view));
    let snapshot = gtk::Snapshot::new();
    paintable.snapshot(&snapshot, view.width().into(), view.height().into());
    let node = snapshot.to_node().ok_or("No WebView render node")?;
    let texture = window
        .renderer()
        .ok_or("No GTK renderer")?
        .render_texture(&node, None);
    let stride = texture.width() as usize * 4;
    let mut pixels = vec![0; stride * texture.height() as usize];
    texture.download(&mut pixels, stride);
    let alpha = pixels[y * stride + x * 4 + 3];
    eprintln!(
        "transparent-overlay: GTK={}x{} DPR={} sample=({x},{y}) alpha={alpha}",
        view.width(),
        view.height(),
        view.scale_factor()
    );
    Ok(alpha)
}

async fn run(
    window: &gtk::ApplicationWindow,
    view: &webkit6::WebView,
    player: &NativePlayer,
) -> Result<(), String> {
    // Bounded load wait, with no click/fullscreen/focus-induced invalidation.
    for _ in 0..100 {
        if !view.is_loading()
            && player.render_count() > 5
            && view
                .evaluate_javascript_future(
                    "document.readyState === 'complete' && !!document.getElementById('page')",
                    None,
                    None,
                )
                .await
                .is_ok_and(|value| value.to_boolean())
        {
            break;
        }
        glib::timeout_future(Duration::from_millis(100)).await;
    }
    if player.render_count() <= 5 {
        return Err("Local video did not render".into());
    }
    glib::timeout_future(Duration::from_secs(1)).await;
    if alpha_at(window, view, 400, 250)? != 255 {
        return Err("Initial old-page fixture is not opaque".into());
    }
    script(
        view,
        "document.body.style.background='transparent';document.getElementById('page').remove();",
    )
    .await?;
    let old_page = alpha_at(window, view, 400, 250)?;
    script(
        view,
        "document.getElementById('control').style.opacity='.3';",
    )
    .await?;
    script(
        view,
        "document.getElementById('control').remove();document.getElementById('popover').remove();",
    )
    .await?;
    let control = alpha_at(window, view, 80, 80)?;
    let popover = alpha_at(window, view, 240, 80)?;
    player.pause(true)?;
    script(view, "document.body.innerHTML='<div id=paused style=\"position:fixed;left:40px;top:40px;width:120px;height:80px;background:rgba(255,255,255,.5)\"></div>';").await?;
    script(view, "document.getElementById('paused').remove();").await?;
    let paused = alpha_at(window, view, 80, 80)?;
    if [old_page, control, popover, paused] != [0; 4] {
        return Err(format!(
            "stale alpha: old-page={old_page}, faded-control={control}, popover={popover}, paused-control={paused}"
        ));
    }
    if let Some(error) = player.snapshot().error {
        return Err(error);
    }
    if let Some(path) = std::env::var_os("NAHHASIO_RENDER_SNAPSHOT") {
        let paintable = gtk::WidgetPaintable::new(Some(window));
        let snapshot = gtk::Snapshot::new();
        paintable.snapshot(&snapshot, window.width().into(), window.height().into());
        let node = snapshot.to_node().ok_or("No window render node")?;
        window
            .renderer()
            .ok_or("No GTK renderer")?
            .render_texture(&node, None)
            .save_to_png(path)
            .map_err(|error| error.to_string())?;
    }
    eprintln!(
        "transparent-overlay: actual-hwdec={:?} video-renders={}",
        player.snapshot().hwdec,
        player.render_count()
    );
    Ok(())
}
