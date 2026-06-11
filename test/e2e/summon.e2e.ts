// Summon wiring — real macOS WKWebView gate (Phase 5, 05-03; NAT-01, HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// base64.e2e.ts / uuid-ulid.e2e.ts. Run by scripts/e2e-spike.sh (starts
// `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears down).
//
// SUMMON DECISION (Phase-5 G-05-1): the app no longer auto-registers a global
// chord at startup — summon ships via the tray menu + single-instance instead,
// and the configurable hotkey defers to a future Settings phase. The platform
// seam (platform.nativeShortcut) and shell/summon.ts are kept for that reuse.
// This spec pins the WEBVIEW-OBSERVABLE surface that survives that change:
//   1. The app launches WITHOUT a blank/crashed window despite the new Rust
//      plugins + window-state `visible:false` — navigating to the hero tool
//      renders its input (Pitfall 6 / Assumption A5).
//   2. The HashRouter deep-link path the future summon would reuse works (set the
//      hash, assert the targeted tool renders) — the validated `deepLink` route
//      (T-05-08).
//
// Stable selectors: #protobuf-input (ProtobufDecoder.tsx), #base64-pane-text
// (Base64Tool.tsx) — the same ids the protobuf/base64 specs drive.

import { assert, navigateToTool, saveScreenshot } from "./helpers";

describe("Summon wiring + HashRouter deep-link (real WKWebView)", () => {
  it("launches non-blank with the new plugins + summon registered, and deep-links via the hash route", async () => {
    // 1. The app reaches the hero tool and renders its input — proving startup
    // survives the new Rust plugins and window-state `visible:false` with no
    // blank/crashed window (summon is no longer auto-registered, G-05-1).
    await navigateToTool("protobuf-decoder");
    const protoInput = await $("#protobuf-input");
    await protoInput.waitForExist({ timeout: 15_000 });
    assert(
      await protoInput.isDisplayed(),
      "protobuf-decoder input did not render — app may have launched blank " +
        "(window-state visible:false / startup-summon regression, Pitfall 6 / A5)?",
    );

    // 2. The HashRouter deep-link path works (the route the summon's guarded
    // deepLink would reuse): set #/tools/base64 and assert the Base64 tool renders.
    await navigateToTool("base64");
    const b64Input = await $("#base64-pane-text");
    await b64Input.waitForExist({ timeout: 15_000 });
    assert(
      await b64Input.isDisplayed(),
      "base64 tool did not render after a HashRouter deep-link — deep-link path broken?",
    );

    // 3. Screenshot the real WKWebView (the HRN-02 artifact for this spec).
    await saveScreenshot("summon", "summon-wkwebview.png");
  });
});
