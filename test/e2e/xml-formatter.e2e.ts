// XML formatter — real macOS WKWebView gate (Phase 7, 07-03; HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the same harness as
// json-formatter.e2e.ts. Run by scripts/e2e-spike.sh (starts `tauri dev --features
// webdriver`, waits for :4445, runs `pnpm e2e`, tears the child down). Stable
// selectors come from XmlFormatterTool.tsx via FormatterView: #xml-input,
// #xml-output, the output copy <button aria-label="Copy output">, and the status
// footer[role=status].
//
// This is the load-bearing real-runtime check for the XML formatter: it proves the
// native DOMParser/XMLSerializer path (well-formedness + parsererror surfacing)
// works on JavaScriptCore, whose behavior can differ from jsdom's.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "xml-formatter-wkwebview.png");

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("XML formatter tool (real WKWebView)", () => {
  it("prettifies on paste, clears + errors on invalid, exposes focusable copy", async () => {
    // Navigate to the XML formatter via HashRouter (deterministic).
    await browser.execute(() => {
      window.location.hash = "#/tools/xml-formatter";
    });

    const input = await $("#xml-input");
    await input.waitForExist({ timeout: 15_000 });
    const output = await $("#xml-output");

    // 1. Paste compact XML → prettified 2-space multi-line output instantly (no button, D-07).
    await input.click();
    await input.setValue("<a><b>1</b></a>");
    const pretty = await output.getValue();
    assert(
      pretty.includes("\n") && pretty.includes("  <b>1</b>"),
      `expected prettified 2-space output, got "${pretty}"`,
    );

    // 2. Invalid XML → output CLEARS and the status bar shows an error (D-08).
    await input.setValue("<a><b></a>");
    assert(
      (await output.getValue()) === "",
      `expected output cleared on invalid XML, got "${await output.getValue()}"`,
    );
    const status = await $("footer[role=status]");
    const errEl = await status.$('[aria-label="error"]');
    assert(
      await errEl.isExisting(),
      "expected the status bar to surface a parse error for invalid XML",
    );

    // 3. Copy affordance is a visible, focusable <button> — never hover-only (FMT-08).
    const copy = await $('button[aria-label="Copy output"]');
    assert(
      await copy.isDisplayed(),
      "Copy output button is not visible — hover-only copy is forbidden",
    );

    // 4. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[xml-formatter] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
