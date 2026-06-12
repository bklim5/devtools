mod license;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
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
        // Relaunch backend for the updater apply flow (DST-02). The JS side calls it
        // via @tauri-apps/plugin-process behind src/lib/platform/tauri.ts to restart
        // into the freshly-installed bundle. Gated by `process:allow-restart`.
        .plugin(tauri_plugin_process::init())
        // Tray icon + menu (NAT-02, D-02 regular dock app + tray). Tauri 2 trays are
        // Rust-only (no tauri.conf.json tray config). The menu has Show + Quit; both
        // the menu "show" and a left-click summon the main window using the D-03
        // unminimize → show → set_focus order (Pitfall 1).
        .setup(|app| {
            // Updater plugin (DST-02). Registered here (not in the builder chain) per
            // the official Tauri 2 updater pattern. The mandatory minisign verify
            // against the committed pubkey is the DST-02 verify-before-apply. Desktop
            // only. JS drives check()/downloadAndInstall() through src/lib/platform/.
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // License manager (Phase 19, LIC-01..04): real impls composed once —
            // app-data cert store, macOS Keychain, Keygen client — behind the
            // managed LicenseState the 4 license commands borrow. The machine
            // fingerprint is computed ONCE here; a failure maps to the empty
            // sentinel (resolve_status fails closed to a Problem on any existing
            // machine.lic and activate refuses to run) — never a startup panic.
            let fingerprint = license::fingerprint::machine_fingerprint().unwrap_or_else(|e| {
                eprintln!("license: machine fingerprint unavailable: {e}");
                String::new()
            });
            let mgr = license::LicenseManager::new(
                Box::new(license::store::AppDataLicStore::new(
                    app.path().app_data_dir()?,
                )),
                Box::new(license::keychain::MacKeychain),
                license::keygen_client::KeygenClient::new(),
                fingerprint,
            );
            app.manage(license::commands::LicenseState(
                tauri::async_runtime::Mutex::new(mgr),
            ));

            let show_i = MenuItem::with_id(app, "show", "Show TinkerDev", true, None::<&str>)?;
            // "Check for Updates…" (DST-02 / D-11a). The actual check() runs in JS
            // through the platform seam (D-12); this just emits an event the JS shell
            // listens for (Plan 04). Manual check is always available regardless of
            // the auto-update opt-in (D-09).
            let check_updates_i =
                MenuItem::with_id(app, "check_updates", "Check for Updates…", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &check_updates_i, &quit_i])?;

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
                    "check_updates" => {
                        let _ = app.emit("menu://check-updates", ());
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
        // The locked 4-command licensing surface (Phase 19). App-defined
        // commands registered via generate_handler! need no capability entries.
        .invoke_handler(tauri::generate_handler![
            license::commands::license_status,
            license::commands::activate_license,
            license::commands::refresh_license,
            license::commands::deactivate_machine
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
