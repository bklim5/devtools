#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // Clipboard seam for the platform layer (FND-04, D-11). The JS side calls
        // it via @tauri-apps/plugin-clipboard-manager behind src/lib/platform/.
        .plugin(tauri_plugin_clipboard_manager::init())
        // Persistent prefs store (SHL-05, D-09). The JS side calls it via
        // @tauri-apps/plugin-store behind src/lib/platform/tauri.ts. Registered
        // UNCONDITIONALLY (both debug and release) — unlike the webdriver plugin
        // below — so persistence works in the shipped app. Gated at runtime by the
        // `store:default` capability in capabilities/default.json (threat T-02-01).
        .plugin(tauri_plugin_store::Builder::new().build());

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
