// Updater UX — real macOS WKWebView gate (Phase 6, 06-04; DST-02, HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// summon.e2e.ts / base64.e2e.ts. Run by scripts/e2e-spike.sh.
//
// MANUAL-ONLY boundary (Plan 05): the real update download + minisign verify +
// relaunch cannot be driven by WebDriver, so this spec pins only the WEBVIEW-
// OBSERVABLE surface 06-04 owns:
//   1. The app launches WITHOUT a blank/crashed window despite the updater +
//      process plugins + the launch opt-in/check wiring — the hero tool renders.
//   2. The dismissible UpdateBanner (D-11c/D-13) renders deterministically (via
//      the dev-only __injectUpdate hook, stripped from production) and is
//      KEYBOARD-dismissible: focus the dismiss button, press Enter, banner gone.
//
// Stable selectors: #protobuf-input (ProtobufDecoder.tsx), #update-banner /
// #update-dismiss (UpdateBanner.tsx via App.tsx).

import { assert, navigateToTool, saveScreenshot } from "./helpers";

describe("Updater UX banner (real WKWebView)", () => {
  it("launches non-blank with the updater plugins, then shows a keyboard-dismissible banner", async () => {
    // 1. The app reaches the hero tool and renders its input — proving startup
    // survives the updater + process plugins and the launch opt-in/check wiring
    // with no blank/crashed window.
    await navigateToTool("protobuf-decoder");
    const protoInput = await $("#protobuf-input");
    await protoInput.waitForExist({ timeout: 15_000 });
    assert(
      await protoInput.isDisplayed(),
      "protobuf-decoder input did not render — app may have launched blank " +
        "(updater wiring regression)?",
    );

    // 2. Inject a detected update via the dev-only hook so the banner renders
    // deterministically (the real download/verify is Manual-Only, Plan 05).
    await browser.execute(() => {
      const w = window as unknown as {
        __injectUpdate?: (info: {
          version: string;
          notes: string | null;
          date: string | null;
        }) => void;
      };
      w.__injectUpdate?.({
        version: "9.9.9",
        notes: "e2e injected update",
        date: null,
      });
    });

    const banner = await $("#update-banner");
    await banner.waitForExist({ timeout: 10_000 });
    assert(
      await banner.isDisplayed(),
      "update banner did not render after __injectUpdate — banner mount broken?",
    );

    // 3. Keyboard-dismiss: focus the dismiss button and activate it from the
    // keyboard. The banner must disappear (real <button>, keyboard-reachable, no
    // hover-only action — D-13 / UX-04). First assert the button actually takes
    // focus (proving keyboard reachability), then activate via Enter/Space.
    const dismiss = await $("#update-dismiss");
    await dismiss.waitForExist({ timeout: 10_000 });
    const focused = await browser.execute(() => {
      const el = document.getElementById("update-dismiss");
      el?.focus();
      return document.activeElement === el;
    });
    assert(
      focused,
      "dismiss button did not accept keyboard focus — not keyboard-reachable?",
    );
    // The dismiss button handles Enter/Space (onKeyDown) so a keyboard press
    // deterministically dismisses on the embedded WKWebView WebDriver.
    await browser.keys("Enter");
    if (await banner.isExisting()) {
      await browser.execute(() => {
        document.getElementById("update-dismiss")?.focus();
      });
      await browser.keys([" "]);
    }

    await banner.waitForExist({ reverse: true, timeout: 10_000 });
    assert(
      !(await banner.isExisting()),
      "update banner did not disappear after keyboard-dismiss — dismiss not keyboard-reachable?",
    );

    // 4. Screenshot the real WKWebView (the HRN-02 artifact for this spec).
    await saveScreenshot("update", "update-wkwebview.png");
  });
});
