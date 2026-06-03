// Regex tester — real macOS WKWebView gate (Phase 14, 14-03; originally the 14-01
// RED wave, shipped here per the user's Rule-4 merge decision).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the same harness as
// url.e2e.ts / base64.e2e.ts. Run by scripts/e2e-spike.sh (starts
// `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears the
// child down). Stable selectors come from RegexTool.tsx: the pattern input
// #regex-pattern, the sample-text overlay textarea #regex-text, the matches
// summary heading "Matches (N)", and the per-match capture-group copy buttons.
//
// The load-bearing real-runtime check is the WORKER ROUND-TRIP: a pattern typed
// into #regex-pattern against #regex-text must produce live matches rendered from
// the OFF-THREAD worker's reply. A match rendering AT ALL proves the Vite worker
// chunk LOADED + replied in the packaged WKWebView (the A1 Pitfall-2 backstop — a
// 404'd worker would silently never reply, so "Matches (N)" would never appear).
// Rapidly swapping the pattern and still getting fresh matches proves the window
// is never frozen (request-id gating + the worker keeps the main thread free).
//
// NOTE — ReDoS timeout on JavaScriptCore: the classic catastrophic patterns
// (`(a+)+$`, `(a*)*$`, `([a-zA-Z]+)*$`, …) DO NOT exhibit unbounded backtracking on
// WebKit/JSC — its regex engine caps backtracking at a fixed budget (~0.4–0.9s,
// measured live on this WKWebView) and bails with no match, so NONE of them exceed
// the 1s watchdog here (they blow up only on V8/node). The terminate-on-timeout
// watchdog is therefore covered by RegexTool's logic + the unit layer, not driven
// by a naturally-catastrophic regex at this gate (it cannot be, on this engine).

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "regex-wkwebview.png");

describe("Regex tester (real WKWebView)", () => {
  it("renders live matches from the off-thread worker and stays responsive across rapid pattern changes", async () => {
    // Navigate to the Regex tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await browser.execute(() => {
      window.location.hash = "#/tools/regex";
    });

    const patternInput = await $("#regex-pattern");
    await patternInput.waitForExist({ timeout: 15_000 });

    const textInput = await $("#regex-text");
    await textInput.waitForExist({ timeout: 5_000 });

    async function matchesSummary(): Promise<string> {
      const h2 = await $("h2*=Matches");
      if (!(await h2.isExisting())) return "";
      return h2.getText();
    }

    // 1. WORKER ROUND-TRIP / SANITY MATCH (RGX-01 + the A1 worker-chunk-loaded
    //    backstop): `\w+` over "hello world" → exactly 2 matches, rendered from the
    //    off-thread worker's reply. If the worker chunk had 404'd, no summary appears.
    await textInput.click();
    await textInput.setValue("hello world");
    await patternInput.click();
    await patternInput.setValue("\\w+");
    await browser.waitUntil(
      async () => (await matchesSummary()).includes("Matches (2)"),
      {
        timeout: 8_000,
        timeoutMsg:
          'expected "Matches (2)" for \\w+ over "hello world" (worker round-trip)',
      },
    );

    // 2. CAPTURE GROUPS (RGX-02): a numbered + named pattern shows a copyable group.
    await textInput.setValue("2026-06");
    await patternInput.setValue("(?<year>\\d{4})-(?<month>\\d{2})");
    const yearCopy = await $('button[aria-label="Copy group year"]');
    await yearCopy.waitForExist({ timeout: 5_000 });

    // 3. STILL RESPONSIVE under rapid pattern swaps — the window never freezes
    //    because matching is off-thread + id-gated. Swap several patterns quickly;
    //    the final one's match count must render promptly.
    await textInput.setValue("aaa bbb ccc ddd");
    for (const p of ["a", "b", "c", "\\w"]) {
      await patternInput.setValue(p);
    }
    await browser.waitUntil(
      async () => /Matches \((?!0\))\d+\)/.test(await matchesSummary()),
      {
        timeout: 5_000,
        timeoutMsg:
          "expected fresh matches to render after rapid pattern swaps (no freeze)",
      },
    );

    // 4. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[regex] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
