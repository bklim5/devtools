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
const PINNED_SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "sidebar-pinned-wkwebview.png");

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

// Drive a keydown via a bubbling KeyboardEvent dispatched on the focused element.
// WHY not browser.keys()/the W3C Actions API: macOS WebKit's embedded WebDriver
// (605.1.15) does NOT deliver the Alt modifier on synthesized key actions — the
// keydown arrives with altKey:false, so an altKey-guarded handler (correctly)
// ignores it (RESEARCH.md:499). React attaches its listeners at the document root
// via native bubbling, so a dispatched bubbling KeyboardEvent on the focused
// element fires the real onKeyDown — the SAME app code path, with the real
// altKey/e.key the handler reads.
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

// Alt+P on the focused element — the pin/unpin chord (D-13/PIN-05). A bubbling
// KeyboardEvent with the literal `key: "p", altKey: true` (same rationale as
// dispatchKey: WebKit WebDriver drops Alt on synthesized key actions).
function dispatchAltP(): Promise<void> {
  return browser.execute(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "p", altKey: true, bubbles: true, cancelable: true }),
    );
  });
}

// The pinned group's tool names (the handles inside the [role=group][aria-label=
// "Pinned tools"] wrapper). Empty when no group is rendered (zero pinned, PIN-03).
function readPinnedOrder(): Promise<string[]> {
  return browser.execute(() => {
    const grp = document.querySelector('[role="group"][aria-label="Pinned tools"]');
    if (!grp) return [];
    return Array.from(grp.querySelectorAll('button[aria-label^="Reorder "]')).map(
      (b) => (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
    );
  });
}

// The unpinned group's tool names (the [role=group][aria-label="Tools"] wrapper).
function readUnpinnedOrder(): Promise<string[]> {
  return browser.execute(() => {
    const grp = document.querySelector('[role="group"][aria-label="Tools"]');
    if (!grp) return [];
    return Array.from(grp.querySelectorAll('button[aria-label^="Reorder "]')).map(
      (b) => (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
    );
  });
}

// The current aria-live="polite".sr-only announcement text.
function readLiveRegion(): Promise<string> {
  return browser.execute(() => {
    const region = document.querySelector('[aria-live="polite"].sr-only');
    return region?.textContent ?? "";
  });
}

// Focus the grip handle for the named tool (so the next dispatchKey targets it).
// Returns true if the handle was found + focused.
function focusHandle(name: string): Promise<boolean> {
  return browser.execute((n: string) => {
    const el = Array.from(
      document.querySelectorAll('button[aria-label^="Reorder "]'),
    ).find((b) => b.getAttribute("aria-label") === `Reorder ${n}`) as
      | HTMLButtonElement
      | null;
    el?.focus();
    return document.activeElement === el;
  }, name);
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

    // The Alt chord is driven by the module-level dispatchKey helper — a bubbling
    // KeyboardEvent, NOT browser.keys()/the Actions API (macOS WebKit's embedded
    // WebDriver drops the Alt modifier on synthesized key actions; RESEARCH.md:499).

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

// Pinned sidebar section — real macOS WKWebView gate (Phase 17, 17-02; PIN-01..06,
// PIN-09). The load-bearing real-runtime checks only the real WKWebView proves:
//   1. Alt+P pins/unpins the focused tool, moving it into/out of the
//      [role=group][aria-label="Pinned tools"] wrapper, announced via aria-live (PIN-01/02/05).
//   2. The pinned group + divider exist ONLY when >=1 tool is pinned (PIN-03).
//   3. Per-group Alt+↑/↓ never carries a tool across the pinned↔unpinned boundary (PIN-06).
//   4. "Unpin all" via the Shift+F10 menu clears the whole set (PIN-09).
//   5. A pin PERSISTS through the platform store seam (prefs.json) across a webview
//      reload — the persistence path runs only in the packaged runtime.
//
// Every Alt chord is driven by the module-level dispatchKey bubbling-KeyboardEvent
// helper — NOT browser.keys()/the Actions API (WebKit WebDriver drops Alt;
// RESEARCH.md:499). Native POINTER drag + the hover-only pin reveal are
// manual-walkthrough items at the phase gate (WebDriver can't synth native drag).
describe("Pinned sidebar section (real WKWebView)", () => {
  it("Alt+P pins/unpins (group membership + aria-live), per-group Alt+arrow stays in-group, Unpin all clears, and a pin persists across reload", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // Start from a clean pinned set so assertions are deterministic regardless of
    // any pins left by a prior run's persisted prefs.json.
    const startPinned = await readPinnedOrder();
    if (startPinned.length > 0) {
      // Open the context menu on the first handle and click "Unpin all".
      const focusedForReset = await focusHandle((await readOrder())[0]);
      assert(focusedForReset, "could not focus a handle to clear pre-existing pins");
      await browser.execute(() => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }),
        );
      });
      await browser.execute(() => {
        const item = Array.from(
          document.querySelectorAll('[role="menuitem"]'),
        ).find((b) => (b.textContent ?? "").includes("Unpin all")) as HTMLElement | null;
        item?.click();
      });
      await browser.waitUntil(async () => (await readPinnedOrder()).length === 0, {
        timeout: 5_000,
        timeoutMsg: "failed to clear pre-existing pins before the test",
      });
    }

    // PIN-03: with zero pinned, the pinned group does not exist.
    const groupBefore = await browser.execute(
      () => document.querySelector('[role="group"][aria-label="Pinned tools"]') !== null,
    );
    assert(!groupBefore, "expected NO pinned group when zero tools are pinned (PIN-03)");

    // 1. ALT+P PINS (PIN-01/05): focus the first unpinned tool's handle, Alt+P.
    const targetName = (await readUnpinnedOrder())[0];
    assert(!!targetName, "expected at least one unpinned tool to pin");
    const focused = await focusHandle(targetName);
    assert(focused, `the "${targetName}" grip handle did not accept keyboard focus`);
    await dispatchAltP();

    await browser.waitUntil(
      async () => (await readPinnedOrder()).includes(targetName),
      {
        timeout: 5_000,
        timeoutMsg: `expected "${targetName}" in the pinned group after Alt+P, got ${JSON.stringify(await readPinnedOrder())}`,
      },
    );
    // PIN-03: pinning created the group wrapper.
    const groupAfter = await browser.execute(
      () => document.querySelector('[role="group"][aria-label="Pinned tools"]') !== null,
    );
    assert(groupAfter, "expected the pinned group to appear after one Alt+P (PIN-03)");
    // aria-live announced "Pinned {name}".
    const pinnedLive = await readLiveRegion();
    assert(
      /^Pinned .+/.test(pinnedLive),
      `expected an aria-live "Pinned …" announcement, got "${pinnedLive}"`,
    );

    // 4. PER-GROUP Alt+↓ NO CROSS-BOUNDARY (PIN-06): the lone pinned tool is at the
    //    bottom of the pinned group; Alt+↓ must hit the GROUP boundary, never slide
    //    it into the unpinned list.
    const refocused = await focusHandle(targetName);
    assert(refocused, `could not re-focus "${targetName}" after pinning`);
    await dispatchKey("ArrowDown", true);
    await browser.waitUntil(
      async () =>
        (await readPinnedOrder()).includes(targetName) &&
        !(await readUnpinnedOrder()).includes(targetName),
      {
        timeout: 3_000,
        timeoutMsg: `Alt+↓ at the pinned-group boundary must keep "${targetName}" in the pinned group, not cross into the unpinned list (PIN-06)`,
      },
    );

    // Symmetric: an unpinned tool reordered via Alt+↑ never enters the pinned group.
    const unpinnedFirst = (await readUnpinnedOrder())[0];
    if (unpinnedFirst) {
      const f = await focusHandle(unpinnedFirst);
      assert(f, `could not focus the unpinned tool "${unpinnedFirst}"`);
      await dispatchKey("ArrowUp", true); // boundary bump — stays in-group
      assert(
        !(await readPinnedOrder()).includes(unpinnedFirst),
        `an unpinned tool ("${unpinnedFirst}") must never enter the pinned group via Alt+↑ (PIN-06)`,
      );
    }

    // Screenshot the pinned state (artifact).
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await browser.saveScreenshot(PINNED_SCREENSHOT_PATH);
    console.log(`[sidebar] saved pinned-state screenshot to ${PINNED_SCREENSHOT_PATH}`);

    // 5. PERSISTS ACROSS RELOAD (PIN-07): with "${targetName}" still pinned, reload
    //    the webview entirely; the pinned group + that tool must survive (written
    //    through the platform store seam — packaged-runtime-only path).
    await browser.refresh();
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });
    const reloadHandle = await $('button[aria-label^="Reorder "]');
    await reloadHandle.waitForExist({ timeout: 15_000 });
    await browser.waitUntil(
      async () => (await readPinnedOrder()).includes(targetName),
      {
        timeout: 5_000,
        timeoutMsg: `expected the pin to persist across reload ("${targetName}" still pinned), got ${JSON.stringify(await readPinnedOrder())}`,
      },
    );

    // 2. ALT+P UNPINS (PIN-02/03): focus the pinned tool's handle, Alt+P again —
    //    the pinned group (the lone member removed) vanishes and aria-live reads
    //    "Unpinned {name}".
    const focusedPinned = await focusHandle(targetName);
    assert(focusedPinned, `could not focus the pinned tool "${targetName}" to unpin`);
    await dispatchAltP();
    await browser.waitUntil(
      async () =>
        browser.execute(
          () =>
            document.querySelector('[role="group"][aria-label="Pinned tools"]') === null,
        ),
      {
        timeout: 5_000,
        timeoutMsg: `expected the pinned group to vanish after unpinning the last tool (PIN-03), still present`,
      },
    );
    const unpinnedLive = await readLiveRegion();
    assert(
      /^Unpinned .+/.test(unpinnedLive),
      `expected an aria-live "Unpinned …" announcement, got "${unpinnedLive}"`,
    );

    // 3. "UNPIN ALL" via Shift+F10 (PIN-09): pin a tool, open the context menu on
    //    the focused handle, click the "Unpin all" menuitem — the pinned set clears
    //    and aria-live reads "All tools unpinned".
    const pinAgain = (await readUnpinnedOrder())[0];
    assert(!!pinAgain, "expected an unpinned tool to pin for the Unpin-all check");
    const f2 = await focusHandle(pinAgain);
    assert(f2, `could not focus "${pinAgain}" to pin for Unpin-all`);
    await dispatchAltP();
    await browser.waitUntil(async () => (await readPinnedOrder()).includes(pinAgain), {
      timeout: 5_000,
      timeoutMsg: `expected "${pinAgain}" pinned before exercising Unpin all`,
    });
    // Open the context menu (Shift+F10) on the focused handle, then click "Unpin all".
    await focusHandle(pinAgain);
    await browser.execute(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }),
      );
    });
    const clickedUnpinAll = await browser.execute(() => {
      const item = Array.from(
        document.querySelectorAll('[role="menuitem"]'),
      ).find((b) => (b.textContent ?? "").includes("Unpin all")) as HTMLElement | null;
      item?.click();
      return item !== null;
    });
    assert(clickedUnpinAll, 'could not find the "Unpin all" menuitem to click (PIN-09)');
    await browser.waitUntil(async () => (await readPinnedOrder()).length === 0, {
      timeout: 5_000,
      timeoutMsg: `expected "Unpin all" to clear the pinned set (PIN-09), got ${JSON.stringify(await readPinnedOrder())}`,
    });
    const allUnpinnedLive = await readLiveRegion();
    assert(
      allUnpinnedLive.includes("All tools unpinned"),
      `expected the aria-live region to read "All tools unpinned", got "${allUnpinnedLive}"`,
    );
  });
});
