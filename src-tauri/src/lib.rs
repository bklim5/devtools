#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // Clipboard seam for the platform layer (FND-04, D-11). The JS side calls
        // it via @tauri-apps/plugin-clipboard-manager behind src/lib/platform/.
        .plugin(tauri_plugin_clipboard_manager::init());

    // WebDriver automation spike (D-01 / HRN-02), DEBUG-ONLY. The plugin embeds a
    // W3C WebDriver server on 127.0.0.1:4445 (localhost only — threat T-01-11) so
    // the macOS WKWebView can be driven by WebdriverIO during `tauri dev`. It is
    // gated behind `#[cfg(debug_assertions)]` (and the Cargo dep is under
    // `[target.'cfg(debug_assertions)'.dependencies]`) so a release build never
    // compiles it in (RESEARCH Pitfall 4 / threat T-01-10). Override the port via
    // the TAURI_WEBDRIVER_PORT env var if 4445 conflicts.
    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_webdriver::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
