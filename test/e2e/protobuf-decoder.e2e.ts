// Protobuf Decoder (hero) — real macOS WKWebView gate (Phase 3, 03-04; HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the way the base64 spec
// does — but against the hero tool. Run by scripts/e2e-spike.sh (starts
// `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears down).
// Stable selectors come from ProtobufDecoder.tsx / FieldNode.tsx: the input
// (#protobuf-input), the detected-encoding chip ([data-encoding-chip]), field
// numbers ([data-fnum]), interpretation chips ([role="radio"]), per-node copy
// (button[data-copy-node]), the "Copy all as JSON" button, the rows/cards toggle,
// and the status footer[role=status].
//
// This is the real-webview proof of the hero flow: paste → instant recursive tree,
// LEN chips + smart default + per-node override, neutral #N / accent-on-selection,
// groups-as-error (no white-screen), a focusable per-node + copy-all-as-JSON, and
// the status bar — none of which jsdom can verify visually.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "protobuf-decoder-wkwebview.png");

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("Protobuf Decoder (real WKWebView)", () => {
  it("decodes on paste, shows chips + neutral #N, overrides per node, copies, and never crashes", async () => {
    // Navigate to the hero tool via HashRouter (deterministic).
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });

    const input = await $("#protobuf-input");
    await input.waitForExist({ timeout: 15_000 });

    // 1. Paste {1:150} -> field tree renders INSTANTLY (no decode button) — PRO-01.
    await input.click();
    await input.setValue("089601");
    const fnum = await $("[data-fnum]");
    await fnum.waitForExist({ timeout: 5_000 });
    assert(
      (await fnum.getText()).includes("#1"),
      `expected field #1, got "${await fnum.getText()}"`,
    );
    const uintChip = await $('[role="radio"][aria-checked="true"]');
    assert(
      (await uintChip.getText()).toLowerCase().includes("uint64"),
      `expected the smart-default chip to be uint64, got "${await uintChip.getText()}"`,
    );

    // 2. #N is NEUTRAL — the fnum element must not be the accent colour.
    const fnumColor = await fnum.getCSSProperty("color");
    // accent is #3b82f6 ~ rgb(59,130,246); assert the fnum is NOT that blue.
    assert(
      !/59,\s*130,\s*246/.test(fnumColor.value ?? ""),
      `#N must be neutral, not accent blue — got ${fnumColor.value}`,
    );

    // 3. The detected-encoding ACCENT chip reads "hex" (D-01 refinement).
    const encChip = await $("[data-encoding-chip]");
    assert(
      (await encChip.getText()).toLowerCase().includes("hex"),
      `expected detected encoding "hex", got "${await encChip.getText()}"`,
    );

    // 4. Nested payload auto-expands the sub-message (D-05): #3 + nested #1 both visible.
    await input.setValue("1a03089601");
    const nested3 = await $("[data-fnum]*=#3");
    await nested3.waitForExist({ timeout: 5_000 });
    const nested1 = await $("[data-fnum]*=#1");
    assert(
      (await nested3.isExisting()) && (await nested1.isExisting()),
      "expected nested #3 and auto-expanded #1 to both be present",
    );

    // 5. Group byte "1c" -> status-bar error + inline error, NOT a white-screen — PRO-02.
    await input.setValue("1c");
    const status = await $("footer[role='status']");
    assert(
      (await status.getText()).toLowerCase().includes("error"),
      `expected the status bar to show an error for a group byte, got "${await status.getText()}"`,
    );
    const alert = await $("[role='alert']");
    assert(
      (await alert.getText()).toLowerCase().includes("group"),
      `expected an inline "group" error, got "${await alert.getText()}"`,
    );
    // The input is still there + editable (no crash).
    assert(await input.isDisplayed(), "input vanished — the tool white-screened on a group byte");

    // 6. Per-node copy + copy-all-as-JSON are VISIBLE, focusable <button>s (no hover-only) — D-10.
    await input.setValue("089601");
    const nodeCopy = await $("button[data-copy-node]");
    assert(
      await nodeCopy.isDisplayed(),
      "per-node copy button is not visible — hover-only copy is forbidden",
    );
    const copyAll = await $('button[aria-label="Copy all as JSON"]');
    assert(
      await copyAll.isDisplayed(),
      "copy-all-as-JSON button is not visible — hover-only copy is forbidden",
    );

    // 7. Per-node override: select the "int64" chip -> accent moves to it.
    const int64Chip = await $('[role="radio"]=int64');
    await int64Chip.click();
    assert(
      (await int64Chip.getAttribute("aria-checked")) === "true",
      "clicking the int64 chip did not move the selection to it",
    );

    // 8. Rows/cards toggle flips the tree layout.
    const rowsToggle = await $("button=rows");
    await rowsToggle.click();
    const treeRows = await $(".tree-rows");
    assert(await treeRows.isExisting(), "rows toggle did not switch the tree to rows layout");

    // 9. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[protobuf] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
