mod license;

use tauri::{
    menu::{Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder},
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
        // External-URL opener for the "Buy license" CTA (Phase 20, PAY-01 / D-67).
        // The JS side calls openUrl via @tauri-apps/plugin-opener behind
        // src/lib/platform/tauri.ts; gated at runtime by the https-only
        // `opener:allow-open-url` capability (capabilities/default.json) so the app
        // can never be coerced to open non-https schemes (file:/tel:/mailto:).
        .plugin(tauri_plugin_opener::init())
        // Launch-at-login (SET-09 / D-24-7). The ONE scoped new-dep exception of
        // v1.7: an official Tauri plugins-workspace crate, no UI, no network — it
        // writes a per-user LaunchAgent plist. `None::<Vec<&str>>` passes NO launch
        // args (no shell-injection surface, T-24-03). The JS side calls
        // enable/disable/isEnabled via @tauri-apps/plugin-autostart behind
        // src/lib/platform/tauri.ts; scoped to the three autostart:allow-* perms in
        // capabilities/default.json — no wider grant.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None::<Vec<&str>>,
        ))
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

            // Opportunistic background license refresh (D-76, LIC-05). A
            // fire-and-forget task — setup() returns IMMEDIATELY, so first
            // paint is never blocked (honoring the v1.6 "no per-launch hard
            // network check" amendment; the launch trigger waits for the window
            // to paint, then runs off the UI thread).
            //
            // Both the launch trigger and the 24h poll funnel through
            // `refresh_if_needed`, which is itself gated: it makes ZERO network
            // when the cert is fresh, and SWALLOWS every error (offline /
            // service down) so a failed attempt is silent and leaves state
            // untouched. The scheduler's job is to keep machine.lic fresh on
            // disk so the next `license_status` (panel open / explicit Refresh,
            // Plan 04) reflects it; the result here is discarded server-side.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use std::time::Duration;
                // POLL_INTERVAL_HOURS=24 (config.rs, D-76). tokio's interval
                // fires its FIRST tick immediately — we consume that first tick
                // as the launch trigger (after a short paint delay) and every
                // subsequent tick as a periodic poll, so the launch attempt and
                // the first poll never double-fire.
                let mut interval = tokio::time::interval(Duration::from_secs(
                    license::config::POLL_INTERVAL_HOURS * 3600,
                ));
                // Let the window paint before the first (launch) attempt — the
                // refresh must never delay first paint.
                tokio::time::sleep(Duration::from_secs(2)).await;
                loop {
                    interval.tick().await; // immediate on the first iteration
                    let state = handle.state::<license::commands::LicenseState>();
                    let _ = state.0.lock().await.refresh_if_needed().await;
                    // TODO(21-04): emit a `license://refreshed` event here when
                    // the on-disk state changed, so a long-running window can
                    // live-flip the UI without a restart. Plan 04 wires the
                    // status-open + explicit-Refresh paths that already pick up
                    // the fresh disk state, so the event is a nice-to-have for
                    // the long-uptime case, not a blocker for this plan.
                }
            });

            // ── macOS application menu (SET-01) ────────────────────────────────
            // The app sets NO app menu otherwise — macOS auto-generates the
            // default bar. `app.set_menu()` REPLACES that wholesale (RESEARCH
            // Pitfall 1 / tauri#11422), so a partial menu would strip
            // Copy/Paste/Undo/Select-All/Quit from this paste-first, text-heavy
            // app. We therefore rebuild a COMPLETE menu — App / Edit / Window —
            // reconstructing every default submenu via the 2.11.2 SubmenuBuilder
            // chainable predefined-item methods (verified self->Self, build->Result
            // against the installed crate source). The Edit-menu regression is the
            // human-walkthrough backstop (WebDriver can't assert native menus).
            //
            // SET-01: the Settings item lives under the FIRST submenu (the macOS
            // application menu), directly below About, bound to ⌘, per macOS
            // convention. `CmdOrCtrl+,` is translated to Cmd on macOS by Tauri.
            let settings_app_i =
                MenuItem::with_id(app, "open_settings", "Settings…", true, Some("CmdOrCtrl+,"))?;

            // Follow-up 1 (BUG, 22.1): the no-text chainable .about(None)/.hide()/.quit()
            // derive their label from the Cargo bin name (devtools-app). Build explicit
            // PredefinedMenuItems with the product name so the menu reads "TinkerDev"
            // (D-22.1-1/D-22.1-2; API verified vs tauri-2.11.2 predefined.rs). about
            // metadata stays None (unchanged behavior).
            let about_i = PredefinedMenuItem::about(app, Some("About TinkerDev"), None)?;
            let hide_i = PredefinedMenuItem::hide(app, Some("Hide TinkerDev"))?;
            let quit_i = PredefinedMenuItem::quit(app, Some("Quit TinkerDev"))?;

            // App submenu (first submenu => the macOS application menu).
            let app_menu = SubmenuBuilder::new(app, "TinkerDev")
                .item(&about_i)
                .separator()
                .item(&settings_app_i)
                .separator()
                .services()
                .separator()
                .item(&hide_i)
                .hide_others()
                .show_all()
                .separator()
                .item(&quit_i)
                .build()?;

            // Edit submenu — MUST be reconstructed or the paste-first app loses
            // Copy/Paste/Undo/Select-All (Pitfall 1). These are native edit
            // actions via PredefinedMenuItem (real behavior + localized labels).
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            // Window submenu — rebuilt with the standard macOS Window items the
            // 2.11.2 SubmenuBuilder exposes via the shared_menu_builder! macro
            // (verified against the installed crate source: fullscreen(),
            // bring_all_to_front()). A bare Minimize+Close stripped Enter Full
            // Screen / Bring All to Front from the default bar (LOW-22-03).
            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .fullscreen()
                .separator()
                .bring_all_to_front()
                .separator()
                .close_window()
                .build()?;

            let app_menu_bar = MenuBuilder::new(app)
                .items(&[&app_menu, &edit_menu, &window_menu])
                .build()?;
            app.set_menu(app_menu_bar)?;

            // SET-01: the app-menu Settings item emits the SAME no-payload event
            // the tray uses (T-22-08: the listener ignores any data, just opens
            // Settings). Mirrors the tray's `menu://check-updates` channel.
            app.on_menu_event(move |app, event| {
                if event.id().as_ref() == "open_settings" {
                    let _ = app.emit("menu://open-settings", ());
                }
            });

            let show_i = MenuItem::with_id(app, "show", "Show TinkerDev", true, None::<&str>)?;
            // "Check for Updates…" (DST-02 / D-11a). The actual check() runs in JS
            // through the platform seam (D-12); this just emits an event the JS shell
            // listens for (Plan 04). Manual check is always available regardless of
            // the auto-update opt-in (D-09).
            // SET-02: the tray Settings… item emits the SAME `menu://open-settings`
            // event the app-menu item uses (same "open_settings" id — both fire the
            // identical no-payload event; the webview listener doesn't distinguish
            // source). No accelerator on the tray item (the ⌘, lives on the app menu).
            let settings_tray_i =
                MenuItem::with_id(app, "open_settings", "Settings…", true, None::<&str>)?;
            let check_updates_i =
                MenuItem::with_id(app, "check_updates", "Check for Updates…", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&show_i, &settings_tray_i, &check_updates_i, &quit_i],
            )?;

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
                    "open_settings" => {
                        let _ = app.emit("menu://open-settings", ());
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

    // The locked licensing command surface (Phase 19 + 21). App-defined commands
    // registered via generate_handler! need no capability entries.
    // `license_status_detail` is the route-only masked-key path (D-89);
    // `license_status` stays Keychain-free for startup (T-19-10, finding 2).
    //
    // The `dev_set_license_state` e2e seam (22.1-04) is registered ONLY under
    // `#[cfg(debug_assertions)]` — the SECOND half of its double-gate (the command
    // body in commands.rs is itself `#[cfg(debug_assertions)]`). A release build
    // takes the `#[cfg(not(debug_assertions))]` handler below, which OMITS the dev
    // command, so the synthetic-override path is wholly absent from a shipped
    // binary (mirrors the webdriver plugin's debug-only registration above).
    // generate_handler! is a single fixed list (it can't be conditionally
    // extended mid-chain), so the two arms duplicate the locked surface and the
    // debug arm appends the seam — there is no other way to cfg a command in.
    #[cfg(debug_assertions)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        license::commands::license_status,
        license::commands::license_status_detail,
        license::commands::activate_license,
        license::commands::refresh_license,
        license::commands::refresh_license_if_needed,
        license::commands::deactivate_machine,
        license::commands::dev_set_license_state
    ]);
    #[cfg(not(debug_assertions))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        license::commands::license_status,
        license::commands::license_status_detail,
        license::commands::activate_license,
        license::commands::refresh_license,
        license::commands::refresh_license_if_needed,
        license::commands::deactivate_machine
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
