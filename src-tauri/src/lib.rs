use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // single-instance MUST be the FIRST plugin registered (RESEARCH Pitfall 4 /
        // official docs). On a second launch its callback summons the existing main
        // window — unminimize → show → set_focus (D-03 order; Tauri 2.3+ focus
        // regression, issue #12834). `_argv`/`_cwd` are UNTRUSTED input (threat
        // T-05-02) and are intentionally IGNORED here — argv is NOT parsed as a
        // route/path. Any future deep-link must route through getToolById/
        // resolveStartupTool (ENABLED_TOOLS only), never raw argv.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        // OS-level global summon shortcut (NAT-01). The chord is registered from JS
        // through src/lib/platform/ (Plan 02); this just builds the plugin. Gated by
        // the global-shortcut:allow-* capabilities (threat T-05-01).
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Window position/size persistence across relaunch (SHL-05 / D-11). Auto-saves
        // geometry; restores before the window is shown (tauri.conf.json
        // app.windows[0].visible = false avoids the restore-flash, Pitfall 6).
        .plugin(tauri_plugin_window_state::Builder::default().build())
        // Clipboard seam for the platform layer (FND-04, D-11). The JS side calls
        // it via @tauri-apps/plugin-clipboard-manager behind src/lib/platform/.
        .plugin(tauri_plugin_clipboard_manager::init())
        // Persistent prefs store (SHL-05, D-09). The JS side calls it via
        // @tauri-apps/plugin-store behind src/lib/platform/tauri.ts. Registered
        // UNCONDITIONALLY (both debug and release) — unlike the webdriver plugin
        // below — so persistence works in the shipped app. Gated at runtime by the
        // `store:default` capability in capabilities/default.json (threat T-02-01).
        .plugin(tauri_plugin_store::Builder::new().build())
        // Tray icon + menu (NAT-02, D-02 regular dock app + tray). Tauri 2 trays are
        // Rust-only (no tauri.conf.json tray config). The menu has Show + Quit; both
        // the menu "show" and a left-click summon the main window using the D-03
        // unminimize → show → set_focus order (Pitfall 1).
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "Show DevTools", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        });

    // WebDriver automation spike (D-01 / HRN-02), DOUBLE-GATED. The plugin embeds a
    // W3C WebDriver server on 127.0.0.1:4445 (localhost only — threat T-01-11) so the
    // macOS WKWebView can be driven by WebdriverIO during the e2e UI gate. The Cargo
    // dep is an OPTIONAL dependency enabled only by the `webdriver` feature, and
    // registration here is gated on `#[cfg(all(debug_assertions, feature =
    // "webdriver"))]` — BOTH a debug build AND the opt-in feature are required. The
    // double gate is deliberate (codex review): the feature alone is not enough,
    // because a release build run with `--features webdriver` / `--all-features`
    // would otherwise compile the server into a shipped artifact. With the
    // `debug_assertions` half, any release (non-debug) build excludes the server
    // unconditionally (RESEARCH Pitfall 4 / threat T-01-10). The spike runs it via
    // `pnpm tauri:dev:e2e` (= `tauri dev --features webdriver`, a debug build) from
    // scripts/e2e-spike.sh. Override the port via TAURI_WEBDRIVER_PORT.
    #[cfg(all(debug_assertions, feature = "webdriver"))]
    let builder = builder.plugin(tauri_plugin_webdriver::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
