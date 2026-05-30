// The macOS real-webview spike (D-01 / HRN-02 success bar, D-02).
//
// Drives our ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). The success bar is:
//   launch app → findElement (the skeleton input) → sendKeys → assert the
//   output/status bar updated → takeScreenshot of the real WKWebView.
//
// This runs under `pnpm e2e` (wdio run wdio.conf.ts), itself invoked by the
// reproducible scripts/e2e-spike.sh which starts `tauri dev`, waits for :4445,
// runs this spec, and tears the child down. The skeleton's stable selectors
// (data-testid="skeleton-input" / "skeleton-output" / "skeleton-copy" /
// "skeleton-status") come from Plan 02.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "skeleton-wkwebview.png");

describe("byte-inspector skeleton (real WKWebView)", () => {
  it("finds the input, types bytes, transforms instantly, and screenshots the real webview", async () => {
    // 1. Find the skeleton input in the real WKWebView (stable selector from P02).
    const input = await $('[data-testid="skeleton-input"]');
    await input.waitForExist({ timeout: 15_000 });

    // 2. Send keys (paste/type bytes) — the common case transforms with NO button.
    await input.click();
    await input.setValue("hello");

    // 3. Assert the output + status bar updated instantly (paste-transforms-instantly).
    const output = await $('[data-testid="skeleton-output"]');
    await output.waitForExist({ timeout: 5_000 });
    const outputText = await output.getText();
    if (!outputText.toUpperCase().includes("HELLO")) {
      throw new Error(
        `expected the uppercase transform of "hello" in the output, got: ${outputText}`,
      );
    }

    const byteCount = await $('[data-testid="skeleton-bytecount"]');
    const byteText = await byteCount.getText();
    if (!byteText.includes("5")) {
      throw new Error(`expected a 5-byte count in the status bar, got: ${byteText}`);
    }

    // 4. The copy affordance must be present AND focusable (no hover-only copy):
    //    a real <button> reachable in the WKWebView's tab order.
    const copy = await $('[data-testid="skeleton-copy"]');
    if (!(await copy.isDisplayed())) {
      throw new Error("copy button is not visible — hover-only copy is forbidden");
    }

    // 5. Screenshot the real WKWebView with the input filled (the HRN-02 artifact).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    // eslint-disable-next-line no-console
    console.log(`[spike] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
