// Base64/Hex/Bytes tool — real macOS WKWebView gate (Phase 3, 03-03; HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) the same way the Phase-1
// skeleton spike did — but against a REAL shipped tool. Run by scripts/e2e-spike.sh
// (starts `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears
// the child down). Stable selectors come from Base64Tool.tsx: textarea ids
// (#base64-pane-text/-b64/-hex), the per-pane copy <button aria-label="Copy …">,
// the alphabet toggle (button text "base64url"), and the status footer[role=status].
//
// The load-bearing assertion is the base64url one: native Uint8Array.toBase64 (which
// WKWebView HAS, unlike Node's jsdom) keeps "=" padding unless omitPadding is set —
// the exact native/fallback split fixed in src/lib/bytes.ts. Only the real webview
// exercises that path, so this spec is where that fix is truly proven.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "base64-wkwebview.png");

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("Base64/Hex/Bytes tool (real WKWebView)", () => {
  it("derives panes, clears on error, drops base64url padding, and exposes focusable copy", async () => {
    // Navigate to the Base64 tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await browser.execute(() => {
      window.location.hash = "#/tools/base64";
    });

    const text = await $("#base64-pane-text");
    await text.waitForExist({ timeout: 15_000 });
    const base64 = await $("#base64-pane-b64");
    const hex = await $("#base64-pane-hex");

    // 1. Type "hello" → base64 + hex derive instantly (no convert button, UX-01).
    await text.click();
    await text.setValue("hello");
    assert(
      (await base64.getValue()) === "aGVsbG8=",
      `expected base64 "aGVsbG8=", got "${await base64.getValue()}"`,
    );
    assert(
      (await hex.getValue()) === "68656c6c6f",
      `expected hex "68656c6c6f", got "${await hex.getValue()}"`,
    );

    // 2. Odd-length hex → ONLY hex errors; Text + Base64 panes CLEAR (D-13 refinement).
    await hex.setValue("6");
    assert(
      (await hex.getAttribute("aria-invalid")) === "true",
      "expected the hex field to be marked aria-invalid for odd length",
    );
    assert(
      (await text.getValue()) === "" && (await base64.getValue()) === "",
      `expected Text + Base64 cleared on hex error, got text="${await text.getValue()}" base64="${await base64.getValue()}"`,
    );

    // 3. base64url drops the "=" padding — the native-toBase64 fix, only observable
    //    on the real WKWebView. Re-establish bytes, then toggle the alphabet.
    await text.setValue("hello");
    assert(
      (await base64.getValue()) === "aGVsbG8=",
      "expected padded base64 before toggling alphabet",
    );
    const base64urlToggle = await $("button=base64url");
    await base64urlToggle.click();
    assert(
      (await base64.getValue()) === "aGVsbG8",
      `expected UNPADDED base64url "aGVsbG8" on the real webview, got "${await base64.getValue()}"`,
    );

    // 4. Copy affordance is a visible, focusable <button> — never hover-only (UX-02).
    const copyBase64 = await $('button[aria-label="Copy Base64"]');
    assert(
      await copyBase64.isDisplayed(),
      "Copy Base64 button is not visible — hover-only copy is forbidden",
    );

    // 5. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[base64] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
