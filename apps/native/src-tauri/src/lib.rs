mod routing;

use routing::{auth_return, start, stays_inside, Start};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;
use url::Url;

const MAIN: &str = "main";
const START_URL_ENV: &str = "FEEGA_URL";
#[cfg(target_os = "ios")]
const PLATFORM_AGENT: &str = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
#[cfg(target_os = "android")]
const PLATFORM_AGENT: &str = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36";
#[cfg(target_os = "windows")]
const PLATFORM_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/130.0";
#[cfg(not(any(target_os = "ios", target_os = "android", target_os = "windows")))]
const PLATFORM_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)";

fn user_agent() -> String {
    format!("{PLATFORM_AGENT} FeegaNative/{}", env!("CARGO_PKG_VERSION"))
}

fn configured_start() -> Start {
    let runtime = std::env::var(START_URL_ENV).ok();
    start(runtime.as_deref().or(option_env!("FEEGA_URL")))
}

fn app_url(app: &AppHandle) -> Option<Url> {
    app.get_webview_window(MAIN)?.url().ok()
}

fn follow_deep_links(app: &AppHandle, urls: Vec<Url>) {
    let Some(window) = app.get_webview_window(MAIN) else {
        return;
    };
    let Some(current) = app_url(app) else {
        return;
    };
    for deep in urls {
        let Some(target) = auth_return(&deep, &current) else {
            continue;
        };
        let _ = window.navigate(target);
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN) {
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let (webview_url, home) = match configured_start() {
                Start::Hosted(url) => (WebviewUrl::External(url.clone()), Some(url)),
                Start::Bundle => (WebviewUrl::App("index.html".into()), None),
            };

            let opener = app.handle().clone();
            let window = WebviewWindowBuilder::new(app, MAIN, webview_url).user_agent(&user_agent());

            #[cfg(desktop)]
            let window = window.title("feega").inner_size(1440.0, 900.0).min_inner_size(800.0, 600.0);

            #[cfg(feature = "bench")]
            let window = window.initialization_script(include_str!("../../bench/tauri-loader.js"));

            window
                .on_navigation(move |target| {
                    let Some(home) = home.as_ref() else {
                        return true;
                    };
                    if stays_inside(target, home) {
                        return true;
                    }
                    let _ = opener.opener().open_url(target.as_str(), None::<&str>);
                    false
                })
                .build()?;

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| follow_deep_links(&handle, event.urls()));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("feega shell failed to start");
}
