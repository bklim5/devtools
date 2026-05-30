#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // Clipboard seam for the platform layer (FND-04, D-11). The JS side calls
        // it via @tauri-apps/plugin-clipboard-manager behind src/lib/platform/.
        .plugin(tauri_plugin_clipboard_manager::init());

    // WebDriver automation spike (D-01 / HRN-02), FEATURE-GATED. The plugin embeds
    // a W3C WebDriver server on 127.0.0.1:4445 (localhost only — threat T-01-11) so
    // the macOS WKWebView can be driven by WebdriverIO during the e2e UI gate. It is
    // gated behind `#[cfg(feature = "webdriver")]` and the Cargo dep is an optional
    // dependency enabled only by the `webdriver` feature (`pnpm tauri dev
    // --features webdriver`, via scripts/e2e-spike.sh). A normal `pnpm tauri build`
    // does NOT enable the feature, so the crate and its server are compiled out of
    // release entirely (RESEARCH Pitfall 4 / threat T-01-10). The previously-used
    // `#[cfg(debug_assertions)]` gate was wrong: Cargo does not support
    // `debug_assertions` for dependency selection, so the crate leaked into the
    // release dependency tree. Override the port via TAURI_WEBDRIVER_PORT.
    #[cfg(feature = "webdriver")]
    let builder = builder.plugin(tauri_plugin_webdriver::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
