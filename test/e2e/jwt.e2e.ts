// JWT tool — real macOS WKWebView gate (Phase 4, 04-03; JWT-01, HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// unix-time.e2e.ts, but against the real JWT tool. Run by scripts/e2e-spike.sh
// (starts `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears
// the child down). Stable selectors come from JwtTool.tsx: the token input
// (#jwt-input), the decoded payload block (#jwt-payload), and the per-block copy
// <button aria-label="Copy …">.
//
// The load-bearing assertions are (1) paste-instant base64url-decode + JSON
// pretty-print of the payload in the real WKWebView (bytes.ts native base64url path,
// not jsdom) and (2) a VISIBLE focusable copy button (UX-02, the hover-only-copy gate).

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "jwt-wkwebview.png");

// A standard HS256 token: header {alg:HS256,typ:JWT}, payload {sub:1234567890,name:John Doe,iat:1516239022}.
const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ" +
  ".SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("JWT tool (real WKWebView)", () => {
  it("decodes the payload instantly on paste and exposes focusable copy", async () => {
    // Navigate to the JWT tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await browser.execute(() => {
      window.location.hash = "#/tools/jwt";
    });

    const input = await $("#jwt-input");
    await input.waitForExist({ timeout: 15_000 });

    // 1. Paste a known token → the payload block decodes instantly (no decode button,
    //    UX-01); base64url-decoded via bytes.ts native path on the real webview.
    await input.click();
    await input.setValue(SAMPLE_JWT);

    const payload = await $("#jwt-payload");
    await payload.waitForExist({ timeout: 15_000 });
    const payloadText = await payload.getText();
    assert(
      payloadText.includes("John Doe") && payloadText.includes("1234567890"),
      `expected the decoded payload (sub / name) on the real webview, got "${payloadText}"`,
    );

    // 2. The Payload block carries a visible, focusable <button> copy — never hover-only (UX-02).
    const copyPayload = await $('button[aria-label="Copy Payload"]');
    assert(
      await copyPayload.isDisplayed(),
      "Copy Payload button is not visible — hover-only copy is forbidden",
    );

    // 3. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[jwt] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
