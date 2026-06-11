// Unix Time tool — real macOS WKWebView gate (Phase 4, 04-02; TIME-01, HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// base64.e2e.ts, but against the real Unix Time tool. Run by scripts/e2e-spike.sh
// (starts `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears
// the child down). Stable selectors come from UnixTimeTool.tsx: the timestamp input
// (#unix-time-input), the derived ISO row (#unix-time-iso), and the per-row copy
// <button aria-label="Copy …">.
//
// The load-bearing assertions are (1) paste-instant ms-precise ISO rendering via the
// shared timeFormat lib (Intl/Date in the real WKWebView, not jsdom — RESEARCH A2)
// and (2) a VISIBLE focusable copy button (UX-02, the hover-only-copy gate).

import { assert, navigateToTool, saveScreenshot } from "./helpers";

describe("Unix Time tool (real WKWebView)", () => {
  it("renders an ms-precise ISO instantly on paste and exposes focusable copy", async () => {
    // Navigate to the Unix Time tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await navigateToTool("unix-time");

    const input = await $("#unix-time-input");
    await input.waitForExist({ timeout: 15_000 });

    // 1. Type a millisecond timestamp → the ISO row derives instantly (no convert
    //    button, UX-01); auto-detected as ms by magnitude (classifyUnit).
    await input.click();
    await input.setValue("1469922850259");

    const iso = await $("#unix-time-iso");
    await iso.waitForExist({ timeout: 15_000 });
    const isoText = await iso.getText();
    assert(
      isoText.includes("2016-07-30T23:54:10.259Z"),
      `expected ISO "2016-07-30T23:54:10.259Z" on the real webview, got "${isoText}"`,
    );

    // 2. The ISO row carries a visible, focusable <button> copy — never hover-only (UX-02).
    const copyIso = await $('button[aria-label="Copy ISO 8601"]');
    assert(
      await copyIso.isDisplayed(),
      "Copy ISO 8601 button is not visible — hover-only copy is forbidden",
    );

    // 3. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    await saveScreenshot("unix-time", "unix-time-wkwebview.png");
  });
});
