// WebdriverIO config for the macOS real-webview spike (D-01 / HRN-02).
//
// Targets the embedded W3C WebDriver server that `tauri-plugin-webdriver`
// (debug-only, see src-tauri/src/lib.rs) exposes on 127.0.0.1:4445 while
// `tauri dev` is running. The hostname is pinned to 127.0.0.1 (localhost only,
// NEVER 0.0.0.0 / a routable interface — threat T-01-11) so the remote-control
// surface is unreachable off-box. Port is overridable via TAURI_WEBDRIVER_PORT
// (matching the Rust `init_with_port` / env-var override) for conflict cases.
//
// The spike itself lives in test/e2e/skeleton.e2e.ts (launch → find element →
// send keys → screenshot the real WKWebView). The reproducible driver that
// starts tauri dev, waits for :4445, runs this config, and tears the child down
// is scripts/e2e-spike.sh — that script is the per-task UI-gate runner for later
// phases.

const WEBDRIVER_HOST = "127.0.0.1"; // localhost ONLY — never 0.0.0.0
const WEBDRIVER_PORT = Number(process.env.TAURI_WEBDRIVER_PORT ?? "4445");

export const config: WebdriverIO.Config = {
  runner: "local",

  // Connect to the already-running embedded server (started by `tauri dev` via
  // scripts/e2e-spike.sh). We do NOT let wdio manage a driver binary — the W3C
  // server is hosted inside our app, so we just point at 127.0.0.1:4445.
  hostname: WEBDRIVER_HOST,
  port: WEBDRIVER_PORT,
  path: "/",

  specs: ["./test/e2e/skeleton.e2e.ts"],
  maxInstances: 1,

  // A single empty capability set: the embedded server drives the one app
  // window; no browser/driver selection is needed.
  capabilities: [{}],

  logLevel: "info",
  bail: 0,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },
};
