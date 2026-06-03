// Regex tester — real macOS WKWebView gate (Phase 14, 14-03; originally the 14-01
// RED wave, shipped here per the user's Rule-4 merge decision).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the same harness as
// url.e2e.ts / base64.e2e.ts. Run by scripts/e2e-spike.sh (starts
// `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears the
// child down). Stable selectors come from RegexTool.tsx: the pattern input
// #regex-pattern, the sample-text overlay textarea #regex-text, the matches
// summary heading "Matches (N)", and the inline [role="alert"] timeout/error node.
//
// The load-bearing real-runtime check is the CATASTROPHIC PATTERN: `(a+)+$` against
// a long "aaaa…!" must surface "Pattern timed out" AND leave the window responsive
// (a trivial pattern still matches afterward). That simultaneously proves (a) the
// worker chunk LOADED in the packaged WKWebView (the A1 Pitfall-2 backstop — a
// 404'd worker would silently never reply, never time out cleanly + respawn) and
// (b) terminate-on-timeout actually killed the wedged worker (RGX-06 / T-14-01).
// Only the real WebKit/JavaScriptCore engine truly proves these worker paths.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "regex-wkwebview.png");

describe("Regex tester (real WKWebView)", () => {
  it("times out on a catastrophic pattern and stays responsive, then matches a sane pattern", async () => {
    // Navigate to the Regex tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await browser.execute(() => {
      window.location.hash = "#/tools/regex";
    });

    const patternInput = await $("#regex-pattern");
    await patternInput.waitForExist({ timeout: 15_000 });

    const textInput = await $("#regex-text");
    await textInput.waitForExist({ timeout: 5_000 });

    // 1. CATASTROPHIC PATTERN (RGX-06 / the A1 worker-chunk-loaded backstop):
    //    a long "aaaa…!" can never satisfy `(a+)+$`, forcing exponential
    //    backtracking — the worker wedges and the watchdog must terminate it.
    await textInput.click();
    await textInput.setValue("a".repeat(40) + "!");
    await patternInput.click();
    await patternInput.setValue("(a+)+$");

    await browser.waitUntil(
      async () => {
        const alert = await $('[role="alert"]');
        if (!(await alert.isExisting())) return false;
        const t = (await alert.getText()).toLowerCase();
        return t.includes("timed out");
      },
      {
        timeout: 8_000,
        timeoutMsg:
          'expected a [role=alert] containing "timed out" for the catastrophic (a+)+$ pattern',
      },
    );

    // 2. STILL RESPONSIVE: after the timeout the window must not be frozen — change
    //    the pattern to a trivial one and confirm matches render (worker respawned).
    await patternInput.setValue("a");
    await browser.waitUntil(
      async () => {
        const summary = await $("h2*=Matches");
        if (!(await summary.isExisting())) return false;
        const t = await summary.getText();
        // "Matches (N)" with N >= 1 (the long "aaaa…!" has many 'a' matches).
        return /Matches \((?!0\))\d+\)/.test(t);
      },
      {
        timeout: 5_000,
        timeoutMsg:
          "expected the UI to stay responsive and match the trivial pattern after the timeout",
      },
    );

    // 3. SANITY MATCH (RGX-01): `\w+` over "hello world" → exactly 2 matches.
    await textInput.setValue("hello world");
    await patternInput.setValue("\\w+");
    await browser.waitUntil(
      async () => {
        const summary = await $("h2*=Matches");
        if (!(await summary.isExisting())) return false;
        return (await summary.getText()).includes("Matches (2)");
      },
      {
        timeout: 5_000,
        timeoutMsg: 'expected "Matches (2)" for \\w+ over "hello world"',
      },
    );

    // 4. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[regex] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
