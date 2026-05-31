// UUID / ULID tool — real macOS WKWebView gate (Phase 4, 04-05; UID-01, HRN-02/D-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// hash.e2e.ts / base64.e2e.ts, against the real UUID/ULID tool. Run by
// scripts/e2e-spike.sh. Stable selectors come from UuidUlidTool.tsx: generated rows
// ([data-generated-id]), per-row copy <button aria-label^="Copy">, the "Generate"
// button, and the decode field (#uuid-ulid-decode) → breakdown (#uuid-ulid-breakdown).
//
// The LOAD-BEARING assertion is that a generated id appears on open: generation uses
// crypto.randomUUID (v4 default) + crypto.getRandomValues (v7/ULID via the Plan-01
// libs), which require a SECURE CONTEXT (Assumption A1). If tauri:// were not a secure
// context those APIs would be undefined and the on-open id would be empty — this gate
// fails loudly, the way production-only bugs only surface on the real WKWebView.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "uuid-ulid-wkwebview.png");

// Canonical ULID spec vector → decoded timestamp 2016-07-30T23:54:10.259Z.
const ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

describe("UUID / ULID tool (real WKWebView)", () => {
  it("generates on open, regenerates on Generate, and decodes a pasted ULID (secure-context crypto check)", async () => {
    // Navigate to the UUID/ULID tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await browser.execute(() => {
      window.location.hash = "#/tools/uuid-ulid";
    });

    const firstRow = await $("[data-generated-id]");
    await firstRow.waitForExist({ timeout: 15_000 });

    // 1. A v4 UUID is generated on open via crypto.randomUUID (secure-context, A1).
    const before = await firstRow.getAttribute("data-generated-id");
    assert(
      typeof before === "string" && before.length > 0,
      "no id generated on open — crypto.randomUUID unavailable (secure-context A1 failed)?",
    );

    // 2. The per-row copy affordance is a VISIBLE focusable <button> — never hover-only (UX-02).
    const copy = await $('[data-generated-id] button[aria-label^="Copy"]');
    assert(
      await copy.isDisplayed(),
      "generated-id Copy button is not visible — hover-only copy is forbidden",
    );

    // 3. Clicking Generate produces a DIFFERENT id (single-keystroke regen, D-16).
    const generateBtn = await $("button=Generate");
    await generateBtn.click();
    await browser.waitUntil(
      async () => {
        const now = await $("[data-generated-id]").getAttribute("data-generated-id");
        return typeof now === "string" && now.length > 0 && now !== before;
      },
      {
        timeout: 15_000,
        timeoutMsg: "Generate did not produce a different id on the real webview",
      },
    );

    // 4. Paste a ULID into the decode field → its decoded timestamp renders (D-17).
    const decode = await $("#uuid-ulid-decode");
    await decode.click();
    await decode.setValue(ULID);
    const breakdown = await $("#uuid-ulid-breakdown");
    await breakdown.waitForExist({ timeout: 15_000 });
    await browser.waitUntil(
      async () => (await breakdown.getText()).includes("2016"),
      {
        timeout: 15_000,
        timeoutMsg: "decoded ULID timestamp (2016-07-30) did not render",
      },
    );

    // 5. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[uuid-ulid] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
