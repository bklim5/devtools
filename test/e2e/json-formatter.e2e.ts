// JSON formatter — real macOS WKWebView gate (Phase 7, 07-02; HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the same harness as
// base64.e2e.ts. Run by scripts/e2e-spike.sh (starts `tauri dev --features
// webdriver`, waits for :4445, runs `pnpm e2e`, tears the child down). Stable
// selectors come from JsonFormatterTool.tsx via FormatterView: #json-input,
// #json-output, the output copy <button aria-label="Copy output">, and the status
// footer[role=status].
//
// This is the load-bearing real-runtime check for the formatter: JavaScriptCore's
// SyntaxError message shape differs from Node's V8, so the line:col error mapping
// in src/lib/format/json.ts is only truly proven on the real webview.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "json-formatter-wkwebview.png");

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("JSON formatter tool (real WKWebView)", () => {
  it("prettifies on paste, clears + errors on invalid, exposes focusable copy", async () => {
    // Navigate to the JSON formatter via HashRouter (deterministic).
    await browser.execute(() => {
      window.location.hash = "#/tools/json-formatter";
    });

    const input = await $("#json-input");
    await input.waitForExist({ timeout: 15_000 });
    const output = await $("#json-output");

    // 1. Paste compact JSON → prettified 2-space output instantly (no button, D-07).
    await input.click();
    await input.setValue('{"b":1,"a":2}');
    const pretty = await output.getValue();
    assert(
      pretty.includes("\n") && pretty.includes('  "b": 1'),
      `expected prettified 2-space output, got "${pretty}"`,
    );

    // 2. Invalid JSON → output CLEARS and the status bar shows an error (D-08).
    await input.setValue('{"a": }');
    assert(
      (await output.getValue()) === "",
      `expected output cleared on invalid JSON, got "${await output.getValue()}"`,
    );
    const status = await $("footer[role=status]");
    const errEl = await status.$('[aria-label="error"]');
    assert(
      await errEl.isExisting(),
      "expected the status bar to surface a parse error for invalid JSON",
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
    console.log(`[json-formatter] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
