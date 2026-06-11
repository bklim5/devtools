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

import { assert, navigateToTool, saveScreenshot } from "./helpers";

// Slow-motion for watching the run on the real app: set E2E_DEMO=1. Inert (no-op)
// in normal gate runs, so the committed gate stays fast.
async function demoPause(ms: number): Promise<void> {
  if (process.env.E2E_DEMO) await browser.pause(ms);
}

describe("Protobuf Decoder (real WKWebView)", () => {
  it("decodes on paste, shows chips + neutral #N, overrides per node, copies, and never crashes", async () => {
    // Navigate to the hero tool via HashRouter (deterministic).
    await navigateToTool("protobuf-decoder");

    const input = await $("#protobuf-input");
    await input.waitForExist({ timeout: 15_000 });
    await demoPause(1200);

    // 1. Paste {1:150} -> field tree renders INSTANTLY (no decode button) — PRO-01.
    await input.click();
    await input.setValue("089601");
    await demoPause(1800);
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
    // accent is #5b9bf8 ~ rgb(91,155,248); assert the fnum is NOT that blue.
    assert(
      !/91,\s*155,\s*248/.test(fnumColor.value ?? ""),
      `#N must be neutral, not accent blue — got ${fnumColor.value}`,
    );

    // 3. The encoding toggle's ACTIVE segment reflects the detected encoding (hex) —
    //    a single control doubling as the detection readout (D-01 refinement).
    const hexToggle = await $("button=hex");
    assert(
      (await hexToggle.getAttribute("aria-pressed")) === "true",
      "expected the hex encoding segment to be active for detected hex",
    );

    await demoPause(1200);
    // 4. Nested payload auto-expands the sub-message (D-05): #3 + nested #1 both visible.
    await input.setValue("1a03089601");
    await demoPause(1800);
    const nested3 = await $("[data-fnum]*=#3");
    await nested3.waitForExist({ timeout: 5_000 });
    const nested1 = await $("[data-fnum]*=#1");
    assert(
      (await nested3.isExisting()) && (await nested1.isExisting()),
      "expected nested #3 and auto-expanded #1 to both be present",
    );

    // 5. Group byte "1c" -> status-bar error + inline error, NOT a white-screen — PRO-02.
    await input.setValue("1c");
    await demoPause(1800);
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

    // 6b. Clicking copy-all shows the momentary "Copied" confirmation (it wrote to
    //     the real clipboard) — the shared useCopyFeedback affordance.
    await copyAll.click();
    assert(
      (await copyAll.getText()).includes("Copied"),
      `expected copy-all to confirm "Copied", got "${await copyAll.getText()}"`,
    );
    await demoPause(1800);

    // 7. Per-node override: select the "int64" chip -> accent moves to it.
    const int64Chip = await $('[role="radio"]=int64');
    await int64Chip.click();
    assert(
      (await int64Chip.getAttribute("aria-checked")) === "true",
      "clicking the int64 chip did not move the selection to it",
    );
    await demoPause(1500);

    // 8. Rows/cards toggle flips the tree layout.
    const rowsToggle = await $("button=rows");
    await rowsToggle.click();
    const treeRows = await $(".tree-rows");
    assert(await treeRows.isExisting(), "rows toggle did not switch the tree to rows layout");
    await demoPause(1500);

    // 9. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    await saveScreenshot("protobuf", "protobuf-decoder-wkwebview.png");
  });

  // Phase 12 (12-02): the decimal byte-array input mode (PRO-08/PRO-09). A comma
  // anywhere auto-detects decimal; the decimal toggle segment is the accented
  // readout; an out-of-range token surfaces a clear inline error that names the
  // offending value (NOT a base64 error) without crashing.
  it("auto-detects decimal input, shows a named range error, and loads the decimal example", async () => {
    // Navigate to the hero tool via HashRouter (deterministic).
    await navigateToTool("protobuf-decoder");

    const input = await $("#protobuf-input");
    await input.waitForExist({ timeout: 15_000 });
    await demoPause(1200);

    // 1. Paste the canonical decimal array -> auto-detect routes to decimal, the
    //    `decimal` toggle segment becomes the active accented readout (PRO-08), and
    //    the bytes decode (a field renders, no error alert).
    await input.click();
    await input.setValue("10, 3, 80, 81, 82");
    await demoPause(1800);
    const decimalToggle = await $("button=decimal");
    await decimalToggle.waitForExist({ timeout: 5_000 });
    assert(
      (await decimalToggle.getAttribute("aria-pressed")) === "true",
      "expected the decimal encoding segment to be the active/accented readout for a comma-separated array",
    );
    const decFnum = await $("[data-fnum]");
    await decFnum.waitForExist({ timeout: 5_000 });
    assert(
      await decFnum.isExisting(),
      "expected the decimal bytes to decode into at least one field",
    );
    const noAlert = await $("[role='alert']");
    assert(
      !(await noAlert.isExisting()),
      "a valid decimal array must NOT produce an error alert",
    );

    // 2. Paste the error anchor `1, 2, 999` -> a role=alert inline error that NAMES
    //    the offending token 999 and is a decimal range error, NOT a base64 error
    //    (PRO-09). The tool must stay responsive (no crash, input still editable).
    await input.setValue("1, 2, 999");
    await demoPause(1800);
    const rangeAlert = await $("[role='alert']");
    await rangeAlert.waitForExist({ timeout: 5_000 });
    const alertText = (await rangeAlert.getText()).toLowerCase();
    assert(
      alertText.includes("999"),
      `expected the inline error to name the offending token 999, got "${alertText}"`,
    );
    assert(
      !alertText.includes("base64"),
      `expected a DECIMAL range error, not a base64 error, got "${alertText}"`,
    );
    // The input is still present + editable (no crash / white-screen) — T-12-05.
    assert(
      await input.isDisplayed(),
      "input vanished — the tool white-screened on an out-of-range decimal token",
    );
    await input.setValue("");
    assert(
      (await input.getValue()) === "",
      "input is not editable after the decimal range error — the tool is unresponsive",
    );

    // 3. The decimal example chip loads the canonical array into the textarea (D-10).
    const decimalChip = await $("button=decimal bytes");
    await decimalChip.waitForExist({ timeout: 5_000 });
    await decimalChip.click();
    await demoPause(1200);
    assert(
      (await input.getValue()) === "10, 3, 80, 81, 82",
      `expected the decimal example chip to fill the textarea with the canonical array, got "${await input.getValue()}"`,
    );
  });

  // Quick 260610-w61 (+ follow-up fix): an example chip click CLEARS the encoding
  // override back to auto-detect, which resolves the example's own format
  // (EXAMPLES-detection contract) — so the example always decodes even after a
  // forced mismatched encoding, AND typed input afterwards re-detects normally
  // (the original explicit-override version left a sticky encoding that broke
  // typed decimal after a hex chip).
  it("an example chip click flips a forced mismatched encoding to the example's format", async () => {
    // Navigate to the hero tool via HashRouter (deterministic).
    await navigateToTool("protobuf-decoder");

    const input = await $("#protobuf-input");
    await input.waitForExist({ timeout: 15_000 });
    await demoPause(1200);

    // 1. Seed a hex value (detected hex) so the base64 click genuinely FORCES a
    //    mismatched override — on hex-active input, clicking base64 sets the
    //    override instead of clearing it.
    await input.click();
    await input.setValue("6869");
    await demoPause(1200);
    const base64Toggle = await $("button=base64");
    await base64Toggle.click();
    assert(
      (await base64Toggle.getAttribute("aria-pressed")) === "true",
      "expected the base64 segment to be forced active before the example-chip click",
    );
    await demoPause(1200);

    // 2. Click the "nested message" hex example chip → the segmented control flips
    //    to hex (base64 released) AND the example decodes under the matching mode.
    const nestedChip = await $("button=nested message");
    await nestedChip.waitForExist({ timeout: 5_000 });
    await nestedChip.click();
    await demoPause(1800);
    const hexToggle = await $("button=hex");
    assert(
      (await hexToggle.getAttribute("aria-pressed")) === "true",
      "expected the hex segment to become active after clicking the hex example chip",
    );
    assert(
      (await base64Toggle.getAttribute("aria-pressed")) === "false",
      "expected the forced base64 segment to release after the hex example-chip click",
    );
    const hexFnum = await $("[data-fnum]");
    await hexFnum.waitForExist({ timeout: 5_000 });
    const hexAlert = await $("[role='alert']");
    assert(
      !(await hexAlert.isExisting()),
      "the hex example must decode cleanly after the chip click — no error alert",
    );

    // 3. Regression (follow-up fix): TYPE a decimal array after the hex chip —
    //    the chip must not leave a sticky override, so auto-detect re-activates
    //    the decimal segment and the typed input decodes (was: stuck forced-hex
    //    → "Hex must have an even number of digits").
    await input.setValue("10, 3, 50, 51, 52");
    await demoPause(1800);
    const decimalToggle = await $("button=decimal");
    assert(
      (await decimalToggle.getAttribute("aria-pressed")) === "true",
      "typed decimal after a hex example chip must re-activate the decimal segment (stale-override regression)",
    );
    const typedFnum = await $("[data-fnum]");
    await typedFnum.waitForExist({ timeout: 5_000 });
    const typedAlert = await $("[role='alert']");
    assert(
      !(await typedAlert.isExisting()),
      "typed decimal after a hex example chip must decode cleanly — no stale forced-hex error",
    );

    // 4. Click the "decimal bytes" chip → the segmented control flips to decimal
    //    and the canonical array decodes (the second user-named flip).
    const decimalChip = await $("button=decimal bytes");
    await decimalChip.click();
    await demoPause(1800);
    assert(
      (await decimalToggle.getAttribute("aria-pressed")) === "true",
      "expected the decimal segment to become active after clicking the decimal example chip",
    );
    const decimalFnum = await $("[data-fnum]");
    await decimalFnum.waitForExist({ timeout: 5_000 });
    const decimalAlert = await $("[role='alert']");
    assert(
      !(await decimalAlert.isExisting()),
      "the decimal example must decode cleanly after the chip click — no error alert",
    );
  });
});
