// Hash tool — real macOS WKWebView gate (Phase 4, 04-04; HASH-01, HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// jwt.e2e.ts / base64.e2e.ts, but against the real Hash tool. Run by
// scripts/e2e-spike.sh (starts `tauri dev --features webdriver`, waits for :4445,
// runs `pnpm e2e`, tears the child down). Stable selectors come from HashTool.tsx:
// the input textarea (#hash-input), per-algo digest rows ([data-algo="…"] > code),
// and per-row copy <button aria-label="Copy …">.
//
// The LOAD-BEARING assertion is the SHA-256 digest rendering on the real webview —
// crypto.subtle.digest requires a SECURE CONTEXT (Assumption A1). If tauri:// is not
// a secure context, crypto.subtle is undefined and this gate fails loudly (Phase-3
// precedent: production-only bugs only surface on the real WKWebView). MD5 (js-md5,
// sync) would still render, so asserting the SHA-256 row is the true secure-context check.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "hash-wkwebview.png");

// Known-good vectors for "abc".
const MD5_ABC = "900150983cd24fb0d6963f7d28e17f72";
const SHA256_ABC_PREFIX = "ba7816bf8f01cfea";

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("Hash tool (real WKWebView)", () => {
  it("renders MD5 + SHA-256 digests instantly on paste (secure-context Web Crypto check)", async () => {
    // Navigate to the Hash tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await browser.execute(() => {
      window.location.hash = "#/tools/hash";
    });

    const input = await $("#hash-input");
    await input.waitForExist({ timeout: 15_000 });

    // 1. Type "abc" → MD5 (js-md5, sync) renders instantly (no compute button, UX-01).
    await input.click();
    await input.setValue("abc");

    const md5Code = await $('[data-algo="MD5"] code');
    await md5Code.waitForExist({ timeout: 15_000 });
    await browser.waitUntil(async () => (await md5Code.getText()) === MD5_ABC, {
      timeout: 15_000,
      timeoutMsg: `expected MD5("abc")=${MD5_ABC} on the real webview`,
    });

    // 2. The SHA-256 digest renders via crypto.subtle.digest — the load-bearing
    //    secure-context check (A1). If crypto.subtle is undefined this never resolves.
    const sha256Code = await $('[data-algo="SHA-256"] code');
    await sha256Code.waitForExist({ timeout: 15_000 });
    await browser.waitUntil(
      async () => (await sha256Code.getText()).startsWith(SHA256_ABC_PREFIX),
      {
        timeout: 15_000,
        timeoutMsg:
          "SHA-256 digest did not render — crypto.subtle.digest unavailable (secure-context A1 failed) on the real WKWebView",
      },
    );

    // 3. Each digest row carries a VISIBLE focusable <button> copy — never hover-only (UX-02).
    const copyMd5 = await $('button[aria-label="Copy MD5"]');
    assert(
      await copyMd5.isDisplayed(),
      "Copy MD5 button is not visible — hover-only copy is forbidden",
    );

    // 4. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[hash] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
