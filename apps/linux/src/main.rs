//! Native shell bootstrap. Client Rust exercises begin after this baseline is reviewed.
mod assets;
mod bridge;
mod services;
mod smoke;

use adw::prelude::*;
use bridge::{Error, Request, reply};
use gtk::{gio, glib};
use services::Services;
use std::{path::PathBuf, sync::Arc};
use webkit6::prelude::*;

#[derive(Clone)]
struct Config {
    ui: String,
    dev: bool,
    asset_root: Option<PathBuf>,
}
impl Config {
    fn load() -> Result<Self, String> {
        if let Ok(ui) = std::env::var("NAHHASIO_UI_URL") {
            if ui != "http://127.0.0.1:23110/" && ui != "http://127.0.0.1:23110" {
                return Err("The desktop development UI must be http://127.0.0.1:23110/".into());
            }
            return Ok(Self {
                ui: "http://127.0.0.1:23110/".into(),
                dev: true,
                asset_root: None,
            });
        }
        let file = std::env::var_os("NAHHASIO_UI_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui/dist"))
            .join("index.html")
            .canonicalize()
            .map_err(|_| {
                "Build the client UI first or set NAHHASIO_UI_URL=http://127.0.0.1:23110/"
                    .to_owned()
            })?;
        let root = file
            .parent()
            .ok_or("Invalid packaged UI path")?
            .to_path_buf();
        Ok(Self {
            ui: assets::ENTRY.into(),
            dev: false,
            asset_root: Some(root),
        })
    }
    fn permits(&self, uri: &str) -> bool {
        // Only our own top-level entry point can hold native privileges. Hash routing is local.
        uri.split('#').next() == Some(self.ui.as_str())
    }
}
fn main() -> glib::ExitCode {
    let services = match Services::new(
        &std::env::var("NAHHASIO_SERVER_URL").unwrap_or_else(|_| "http://127.0.0.1:23103/".into()),
    ) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{}", error.message);
            return glib::ExitCode::FAILURE;
        }
    };
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
    {
        Ok(value) => Arc::new(value),
        Err(_) => {
            eprintln!("Could not start native request workers");
            return glib::ExitCode::FAILURE;
        }
    };
    // A bounded stdin smoke mode exercises the same bridge/services without GTK or secrets in argv.
    if std::env::args().any(|arg| arg == "--bridge-smoke") {
        return smoke(&runtime, &services);
    }
    let smoke = if std::env::args().any(|arg| arg == "--ui-smoke") {
        match smoke::Input::read() {
            Ok(input) => Some(input),
            Err(error) => {
                eprintln!("{error}");
                return glib::ExitCode::FAILURE;
            }
        }
    } else {
        None
    };
    let passed = std::rc::Rc::new(std::cell::Cell::new(false));
    let config = match Config::load() {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{error}");
            return glib::ExitCode::FAILURE;
        }
    };
    let smoke_mode = smoke.is_some();
    let application = adw::Application::builder()
        .application_id("io.nahhasio.Linux")
        .flags(if smoke_mode {
            gio::ApplicationFlags::NON_UNIQUE
        } else {
            gio::ApplicationFlags::empty()
        })
        .build();
    let result = passed.clone();
    application.connect_activate(move |app| {
        build_window(
            app,
            &config,
            &services,
            &runtime,
            smoke.clone(),
            passed.clone(),
        )
    });
    let exit = application.run_with_args(&["nahhasio-linux"]);
    if smoke_mode && !result.get() {
        glib::ExitCode::FAILURE
    } else {
        exit
    }
}
fn build_window(
    app: &adw::Application,
    config: &Config,
    services: &Services,
    runtime: &Arc<tokio::runtime::Runtime>,
    smoke: Option<smoke::Input>,
    passed: std::rc::Rc<std::cell::Cell<bool>>,
) {
    if let Some(window) = app.active_window() {
        window.present();
        return;
    }
    adw::StyleManager::default().set_color_scheme(adw::ColorScheme::ForceDark);
    let manager = webkit6::UserContentManager::new();
    if !manager.register_script_message_handler("nahhasio", None) {
        eprintln!("Could not initialize desktop bridge");
        return;
    }
    manager.add_script(&webkit6::UserScript::new(
        "window.__NAHHASIO_NATIVE__ = true;",
        webkit6::UserContentInjectedFrames::TopFrame,
        webkit6::UserScriptInjectionTime::Start,
        &[&config.ui],
        &[],
    ));
    let context = webkit6::WebContext::new();
    if let Some(root) = &config.asset_root {
        assets::install(&context, root.clone());
    }
    let network = webkit6::NetworkSession::new_ephemeral();
    network.connect_download_started(|_, download| download.cancel());
    let view = webkit6::WebView::builder()
        .web_context(&context)
        .user_content_manager(&manager)
        .network_session(&network)
        .build();
    if let Some(settings) = webkit6::prelude::WebViewExt::settings(&view) {
        settings.set_enable_developer_extras(config.dev);
        settings.set_allow_universal_access_from_file_urls(false);
        settings.set_enable_html5_database(false);
        settings.set_enable_html5_local_storage(false);
        settings.set_enable_write_console_messages_to_stdout(false);
        settings.set_enable_media_stream(false);
    }
    let policy_config = config.clone();
    view.connect_decide_policy(move |_view, decision, kind| {
        if matches!(
            kind,
            webkit6::PolicyDecisionType::NavigationAction
                | webkit6::PolicyDecisionType::NewWindowAction
        ) {
            let allowed = decision
                .downcast_ref::<webkit6::NavigationPolicyDecision>()
                .and_then(|nav| nav.navigation_action())
                .and_then(|mut action| action.request())
                .and_then(|request| request.uri())
                .is_some_and(|uri| policy_config.permits(uri.as_str()));
            if !allowed || kind == webkit6::PolicyDecisionType::NewWindowAction {
                decision.ignore();
                return true;
            }
        }
        false
    });
    view.connect_permission_request(|_, request| {
        request.deny();
        true
    });
    let weak_view = view.downgrade();
    let bridge_config = config.clone();
    let services = services.clone();
    let runtime = runtime.clone();
    manager.connect_script_message_received(Some("nahhasio"), move |_, value| {
        let Some(view) = weak_view.upgrade() else {
            return;
        };
        if !view
            .uri()
            .is_some_and(|uri| bridge_config.permits(uri.as_str()))
        {
            return;
        }
        if !value.is_string() {
            return;
        }
        let raw = value.to_str().to_string();
        let request = match Request::parse(&raw) {
            Ok(request) => request,
            Err(_) => return,
        };
        let id = request.id.clone();
        let permit = match services.permits.clone().try_acquire_owned() {
            Ok(permit) => permit,
            Err(_) => {
                send_reply(
                    &view,
                    reply(
                        &id,
                        Err(Error::new(
                            "busy",
                            "Desktop requests are busy. Try again shortly.",
                        )),
                    ),
                );
                return;
            }
        };
        let service = services.clone();
        let task = runtime.spawn(async move {
            let _permit = permit;
            service.execute(request).await
        });
        let weak = view.downgrade();
        glib::MainContext::default().spawn_local(async move {
            let result = task
                .await
                .unwrap_or_else(|_| Err(Error::new("internal", "Desktop request was interrupted")));
            if let Some(view) = weak.upgrade() {
                send_reply(&view, reply(&id, result));
            }
        });
    });
    let header = adw::HeaderBar::builder()
        .title_widget(&adw::WindowTitle::new("Nahhasio", "Family library"))
        .build();
    let content = gtk::Box::new(gtk::Orientation::Vertical, 0);
    content.append(&header);
    content.append(&view);
    view.set_vexpand(true);
    view.set_hexpand(true);
    let width = if smoke.is_some() {
        std::env::var("NAHHASIO_SMOKE_WIDTH")
            .ok()
            .and_then(|value| value.parse::<i32>().ok())
            .filter(|value| (520..=2560).contains(value))
            .unwrap_or(1280)
    } else {
        1280
    };
    let window = adw::ApplicationWindow::builder()
        .application(app)
        .title("Nahhasio")
        .default_width(width)
        .default_height(820)
        .content(&content)
        .build();
    window.set_size_request(520, 480);
    view.load_uri(&config.ui);
    window.present();
    if let Some(input) = smoke {
        smoke::install(app, &view, input, passed);
    }
}
fn send_reply(view: &webkit6::WebView, value: serde_json::Value) {
    let script = format!("window.__nahhasioReply?.({value});");
    view.evaluate_javascript(&script, None, None, None::<&gio::Cancellable>, |_| {});
}
fn smoke(runtime: &tokio::runtime::Runtime, service: &Services) -> glib::ExitCode {
    use std::io::{BufRead, Write};
    let stdin = std::io::stdin();
    let mut reader = stdin.lock();
    let mut bytes = Vec::new();
    loop {
        bytes.clear();
        let mut take = std::io::Read::take(&mut reader, 4097);
        match take.read_until(b'\n', &mut bytes) {
            Ok(0) => break,
            Ok(_) => {}
            Err(_) => return glib::ExitCode::FAILURE,
        };
        if bytes.len() > 4096 {
            return glib::ExitCode::FAILURE;
        }
        let Ok(raw) = std::str::from_utf8(&bytes) else {
            return glib::ExitCode::FAILURE;
        };
        let Ok(request) = Request::parse(raw) else {
            return glib::ExitCode::FAILURE;
        };
        let id = request.id.clone();
        let response = reply(&id, runtime.block_on(service.execute(request)));
        println!("{response}");
        if std::io::stdout().flush().is_err() {
            return glib::ExitCode::FAILURE;
        }
    }
    glib::ExitCode::SUCCESS
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_foreign_and_development_routes() {
        let config = Config {
            ui: "http://127.0.0.1:23110/".into(),
            dev: true,
            asset_root: None,
        };
        assert!(config.permits("http://127.0.0.1:23110/#library"));
        assert!(!config.permits("http://localhost:23110/"));
        assert!(!config.permits("http://127.0.0.1:23110/evil"));
        assert!(!config.permits("https://example.com/"));
    }
}
