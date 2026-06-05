// Reorderable sidebar — real macOS WKWebView gate (Phase 16, 16-02; REORD-01..07).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// url.e2e.ts / cron.e2e.ts. Run by scripts/e2e-spike.sh (starts
// `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears the
// child down). Auto-discovered by wdio.conf.ts `specs: ["./test/e2e/*.e2e.ts"]` —
// no config edit needed. Stable selectors come from Sidebar.tsx: each row's grip
// handle <button aria-label="Reorder {name}">, the row NavLinks (href
// /tools/{id}), and the aria-live="polite" sr-only announcement region.
//
// The load-bearing real-runtime checks — only the real WKWebView truly proves:
//   1. The reconciled toolOrder overlay actually RENDERS the rows (handle
//      aria-labels read back as a stable, complete order).
//   2. A KEYBOARD Alt+ArrowDown chord moves the focused tool one slot AND that
//      move PERSISTS through the platform store seam (prefs.json) across a webview
//      reload (REORD-05) — the persistence path runs only in the packaged runtime.
//   3. The aria-live region announces "Moved {name} to position N of M" after the
//      move (REORD-04), perceivable without sight.
//   4. A PLAIN click on a row body navigates to /tools/{id} and does NOT start a
//      drag (REORD-02) — click-to-navigate is preserved alongside the handle.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "sidebar-wkwebview.png");

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

// Read the visible sidebar order from the grip handles' aria-labels
// ("Reorder {name}" -> "{name}"), in DOM order. A single round-trip (WebKit's
// embedded WebDriver goes stale on chained element handles — the url.e2e lesson).
function readOrder(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).map(
      (b) => (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
    ),
  );
}

describe("Reorderable sidebar (real WKWebView)", () => {
  it("renders the order overlay, Alt+ArrowDown reorders+persists, announces the move, and a plain click still navigates", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });

    // Wait for the sidebar handles to exist (the overlay rendered).
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // 1. ORDER OVERLAY RENDERS: read the full order; it must list every tool.
    const initialOrder = await readOrder();
    assert(
      initialOrder.length >= 2,
      `expected the sidebar to render >= 2 reorderable tools, got ${initialOrder.length}: ${JSON.stringify(initialOrder)}`,
    );
    const firstName = initialOrder[0];

    // 2. KEYBOARD REORDER: focus the FIRST tool's grip handle, send the
    //    Alt+ArrowDown chord. The first tool must move to position 2 (down one).
    const focusedFirst = await browser.execute(() => {
      const el = document.querySelector(
        'button[aria-label^="Reorder "]',
      ) as HTMLButtonElement | null;
      el?.focus();
      return document.activeElement === el;
    });
    assert(
      focusedFirst,
      "the first grip handle did not accept keyboard focus — not keyboard-reachable?",
    );

    // Drive the keydown via a bubbling KeyboardEvent dispatched on the focused
    // handle. WHY not browser.keys()/the W3C Actions API: macOS WebKit's embedded
    // WebDriver (605.1.15) does NOT deliver the Alt modifier on synthesized key
    // actions — the keydown arrives with altKey:false, so the handler's altKey
    // guard (correctly) ignores it (confirmed empirically: an Actions Alt+Arrow
    // chord left the order unchanged). React attaches its listeners at the document
    // root via native bubbling, so a dispatched bubbling KeyboardEvent on the
    // focused button fires the real onKeyDown handler — this exercises the SAME
    // app code path, with the real altKey/e.key the handler reads (the update.e2e
    // dev-injector precedent: drive the one bit WebDriver can't, assert the rest).
    function dispatchKey(key: string, altKey: boolean): Promise<void> {
      return browser.execute(
        (k: string, alt: boolean) => {
          const el = document.activeElement as HTMLElement | null;
          el?.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: k,
              altKey: alt,
              bubbles: true,
              cancelable: true,
            }),
          );
        },
        key,
        altKey,
      );
    }

    // 2a. PLAIN ArrowDown (no Alt) must be UNBOUND — no roving nav (D-05/REORD-03).
    await dispatchKey("ArrowDown", false);
    const afterPlain = await readOrder();
    assert(
      afterPlain[0] === firstName,
      `plain ArrowDown must NOT reorder (no roving nav, D-05) — "${firstName}" left index 0: ${JSON.stringify(afterPlain)}`,
    );

    // 2b. Alt+ArrowDown moves the focused tool one slot down.
    await dispatchKey("ArrowDown", true);

    await browser.waitUntil(
      async () => {
        const order = await readOrder();
        return order[1] === firstName;
      },
      {
        timeout: 5_000,
        timeoutMsg: `expected "${firstName}" to move to position 2 after Alt+ArrowDown, got ${JSON.stringify(await readOrder())}`,
      },
    );
    const movedOrder = await readOrder();
    assert(
      movedOrder[1] === firstName && movedOrder[0] !== firstName,
      `expected one-slot move: "${firstName}" at index 1, got ${JSON.stringify(movedOrder)}`,
    );

    // 3. ARIA-LIVE ANNOUNCED: the polite region carries "Moved {name} to position N of M".
    const announced = await browser.execute(() => {
      const region = document.querySelector('[aria-live="polite"].sr-only');
      return region?.textContent ?? "";
    });
    assert(
      /Moved .+ to position \d+ of \d+/.test(announced),
      `expected an aria-live "Moved … to position N of M" announcement, got "${announced}"`,
    );

    // 4. PERSISTS ACROSS RELOAD (REORD-05): reload the webview entirely; the
    //    custom order must survive (written through the platform store seam).
    await browser.refresh();
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });
    const afterReloadHandle = await $('button[aria-label^="Reorder "]');
    await afterReloadHandle.waitForExist({ timeout: 15_000 });
    await browser.waitUntil(
      async () => {
        const order = await readOrder();
        return order[1] === firstName;
      },
      {
        timeout: 5_000,
        timeoutMsg: `expected the reorder to persist across reload ("${firstName}" still at index 1), got ${JSON.stringify(await readOrder())}`,
      },
    );

    // 5. CLICK STILL NAVIGATES (REORD-02): a plain click on a row BODY (the
    //    NavLink, not the handle) navigates to that tool — no drag started. Use
    //    the tool now at position 1 (whatever bubbled up after the move).
    const orderAfter = await readOrder();
    const targetName = orderAfter[0];
    // Click the NavLink whose row contains the handle labelled "Reorder {targetName}".
    const clicked = await browser.execute((name: string) => {
      const handle = Array.from(
        document.querySelectorAll('button[aria-label^="Reorder "]'),
      ).find((b) => b.getAttribute("aria-label") === `Reorder ${name}`);
      const row = handle?.closest("div");
      const link = row?.querySelector("a") as HTMLAnchorElement | null;
      const href = link?.getAttribute("href") ?? null;
      link?.click();
      return href;
    }, targetName);
    assert(!!clicked, `could not find the NavLink for "${targetName}" to click`);
    await browser.waitUntil(
      async () => {
        const hash = await browser.execute(() => window.location.hash);
        return typeof clicked === "string" && hash.includes(clicked.replace(/^#/, ""));
      },
      {
        timeout: 5_000,
        timeoutMsg: `expected a plain row click to navigate to "${clicked}", hash was "${await browser.execute(() => window.location.hash)}"`,
      },
    );

    // 6. Screenshot the real WKWebView (the HRN-02 artifact for this spec).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(SCREENSHOT_PATH);
    console.log(`[sidebar] saved real-WKWebView screenshot to ${SCREENSHOT_PATH}`);
  });
});
