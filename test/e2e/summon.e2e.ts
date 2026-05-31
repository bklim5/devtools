// Summon wiring — real macOS WKWebView gate (Phase 5, 05-03; NAT-01, HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// base64.e2e.ts / uuid-ulid.e2e.ts. Run by scripts/e2e-spike.sh (starts
// `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears down).
//
// WHAT THIS CAN AND CANNOT ASSERT: the OS-GLOBAL summon chord lives OUTSIDE the
// webview (it's an OS keyboard registration), so WebDriver — which only drives
// the page — CANNOT fire it. Per 05-VALIDATION "Manual-Only Verifications", the
// real "hotkey from another app raises + focuses the window" is confirmed at the
// Plan-04 packaged-build human sign-off. This spec instead pins the WEBVIEW-
// OBSERVABLE surface that Plan 05-03 adds:
//   1. The app launches WITHOUT a blank/crashed window despite the new Rust
//      plugins + window-state `visible:false` + the startup summon registration —
//      navigating to the hero tool renders its input (Pitfall 6 / Assumption A5).
//   2. The HashRouter deep-link path the summon would reuse works (set the hash,
//      assert the targeted tool renders) — the validated `deepLink` route (T-05-08).
//
// Stable selectors: #protobuf-input (ProtobufDecoder.tsx), #base64-pane-text
// (Base64Tool.tsx) — the same ids the protobuf/base64 specs drive.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "summon-wkwebview.png");

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("Summon wiring + HashRouter deep-link (real WKWebView)", () => {
  it("launches non-blank with the new plugins + summon registered, and deep-links via the hash route", async () => {
    // 1. The app reaches the hero tool and renders its input — proving startup
    // survives the new Rust plugins, window-state `visible:false`, and the
    // registerSummon() call chained onto initPlatform (no blank/crashed window).
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });
    const protoInput = await $("#protobuf-input");
    await protoInput.waitForExist({ timeout: 15_000 });
    assert(
      await protoInput.isDisplayed(),
      "protobuf-decoder input did not render — app may have launched blank " +
        "(window-state visible:false / startup-summon regression, Pitfall 6 / A5)?",
    );

    // 2. The HashRouter deep-link path works (the route the summon's guarded
    // deepLink would reuse): set #/tools/base64 and assert the Base64 tool renders.
    await browser.execute(() => {
      window.location.hash = "#/tools/base64";
    });
    const b64Input = await $("#base64-pane-text");
    await b64Input.waitForExist({ timeout: 15_000 });
    assert(
      await b64Input.isDisplayed(),
      "base64 tool did not render after a HashRouter deep-link — deep-link path broken?",
    );

    // 3. Screenshot the real WKWebView (the HRN-02 artifact for this spec).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[summon] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
