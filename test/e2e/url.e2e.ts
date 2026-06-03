// URL tool — real macOS WKWebView gate (Phase 13, 13-02; HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the same harness as
// base64.e2e.ts / json-formatter.e2e.ts. Run by scripts/e2e-spike.sh (starts
// `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears the
// child down). Stable selectors come from UrlTool.tsx: the parse textarea
// #url-parse-input, the encode textarea #url-encode-input, the read-only output
// divs #url-encoded-output / #url-decoded-output, the SegmentedControl segment
// buttons (text "Encode/Decode", "component", "full"), the per-readout copy
// <button aria-label="Copy host"> and per-query-value copy buttons, and the
// inline [role="alert"] error nodes.
//
// The load-bearing real-runtime checks: that native `URL`/`URLSearchParams`
// parse + decode the anchor URL identically on JavaScriptCore (host/port/decoded
// query), that a relative URL surfaces an inline error instead of a parsed result
// (error-as-value, never a throw that blanks the view), and that the component vs
// full encode distinction (encodeURIComponent vs encodeURI of "/") is visible —
// only the real WKWebView truly proves these native-API paths.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "url-wkwebview.png");

const ANCHOR =
  "https://user:pass@api.example.com:8080/v1/users?tag=a&tag=b&q=hello%20world&empty=#section";

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("URL tool (real WKWebView)", () => {
  it("parses the anchor URL, surfaces the relative-URL error, and shows the component-vs-full distinction", async () => {
    // Navigate to the URL tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await browser.execute(() => {
      window.location.hash = "#/tools/url";
    });

    const parseInput = await $("#url-parse-input");
    await parseInput.waitForExist({ timeout: 15_000 });

    // 1. PARSE: paste the anchor URL → host + port readout rows populate and the
    //    decoded "q" query value shows "hello world" (decoded, not %20).
    await parseInput.click();
    await parseInput.setValue(ANCHOR);

    // Wait for the parse to render (the host readout row appears).
    const hostCopy = await $('button[aria-label="Copy host"]');
    await hostCopy.waitForExist({ timeout: 5_000 });

    // Read the rendered row text in a single round-trip (no chained stale
    // element handles) — find each readout/query row by its copy button's
    // aria-label and return the containing row's textContent.
    function rowTextByCopyLabel(label: string): string | null {
      const btn = document.querySelector(`button[aria-label="${label}"]`);
      const row = btn?.closest("[data-readout-row],[data-query-row]");
      return row ? (row.textContent ?? "") : null;
    }

    const hostText = await browser.execute(rowTextByCopyLabel, "Copy host");
    assert(
      !!hostText && hostText.includes("api.example.com"),
      `expected host readout "api.example.com", got "${hostText}"`,
    );

    const portText = await browser.execute(rowTextByCopyLabel, "Copy port");
    assert(
      !!portText && portText.includes("8080"),
      `expected port readout "8080", got "${portText}"`,
    );

    const qText = await browser.execute(rowTextByCopyLabel, "Copy query value q");
    assert(
      !!qText && qText.includes("hello world") && !qText.includes("hello%20world"),
      `expected decoded query value "hello world", got "${qText}"`,
    );

    // At least 4 query rows render (tag=a, tag=b, q, empty).
    const queryRowCount = await browser.execute(
      () => document.querySelectorAll("[data-query-row]").length,
    );
    assert(
      queryRowCount >= 4,
      `expected >= 4 query rows, got ${queryRowCount}`,
    );

    // 2. PARSE ERROR: a relative URL "/foo?x=1" → one inline alert, NO host row.
    await parseInput.setValue("/foo?x=1");
    const alert = await $('[role="alert"]');
    await alert.waitForExist({ timeout: 5_000 });
    assert(
      await alert.isDisplayed(),
      "expected an inline [role=alert] error for the relative URL",
    );
    const hostAfterError = await $('button[aria-label="Copy host"]');
    assert(
      !(await hostAfterError.isExisting()),
      "expected NO host readout row in the relative-URL error state (D-13)",
    );

    // 3. ENCODE/DECODE: switch mode, type a string with a slash. The default
    //    `full` scope keeps the slash "/". Switch to `component` → it escapes to %2F.
    const encodeSegment = await $("button=Encode/Decode");
    await encodeSegment.click();

    const encodeInput = await $("#url-encode-input");
    await encodeInput.waitForExist({ timeout: 5_000 });
    await encodeInput.click();
    await encodeInput.setValue("a b/c");

    const encodedOut = await $("#url-encoded-output");
    await browser.waitUntil(
      async () => {
        const t = await encodedOut.getText();
        return t.includes("/") && !t.includes("%2F");
      },
      {
        timeout: 5_000,
        timeoutMsg: `expected default full scope to keep "/" intact (no %2F), got "${await encodedOut.getText()}"`,
      },
    );

    const componentSegment = await $("button=component");
    await componentSegment.click();
    await browser.waitUntil(
      async () => (await encodedOut.getText()).includes("%2F"),
      {
        timeout: 5_000,
        timeoutMsg: `expected component scope to escape "/" as %2F, got "${await encodedOut.getText()}"`,
      },
    );

    // 4. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[url] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
