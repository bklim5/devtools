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

// Shared with entitlements.e2e.ts (and friends): assert, the bubbling
// dispatchKey/dispatchAltP Alt-chord helpers (the WebKit Alt-drop +
// Option-compose lessons), and the single-round-trip sidebar readers — see the
// doc comments in helpers.ts for the full WHY behind each.
import {
  assert,
  dispatchAltP,
  dispatchKey,
  ensureFreeTier,
  ensureProTier,
  focusRow,
  navigateToTool,
  readOrder,
  readPinnedOrder,
  readPrefsBlob,
  resetPrefsBlob,
  saveScreenshot,
} from "./helpers";

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

// The hrefs of every visible tool row (NavLink <a>) in DOM order — pinned then
// unpinned as one flat sequence. The roving-nav focus target is asserted by href.
function readRowHrefs(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll('nav a[href^="#/tools/"]')).map(
      (a) => a.getAttribute("href") ?? "",
    ),
  );
}

// The href of the currently focused row (or null if focus is not on a tool row).
function activeRowHref(): Promise<string | null> {
  return browser.execute(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a.tagName !== "A") return null;
    return a.getAttribute("href");
  });
}

// The current aria-live="polite".sr-only announcement text.
function readLiveRegion(): Promise<string> {
  return browser.execute(() => {
    const region = document.querySelector('[aria-live="polite"].sr-only');
    return region?.textContent ?? "";
  });
}

describe("Reorderable sidebar (real WKWebView)", () => {
  // Start from a clean (zero-pinned) set, the same way the pinned-section block
  // establishes clean state. Without this, a pin left by a prior run (or the
  // pinned-section block's persisted prefs.json) can make the first tool the sole
  // member of the pinned group — turning the Alt+ArrowDown below into a correct
  // PIN-06 single-group boundary no-op, which flakes the "moves to position 2"
  // assertion. The reorder test reasons about a single ungrouped list, so we reset
  // pins via the same Shift+F10 -> "Unpin all" gesture the pinned-section block uses.
  beforeEach(async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // Post-D-85 the e2e baseline is FREE (the unlicensed in-Tauri flip). Reorder +
    // pinning are pro.ordering features, so establish Pro BEFORE the reset gestures
    // (Unpin all is itself gated) and the test body's Alt+chord assertions.
    await ensureProTier();

    const startPinned = await readPinnedOrder();
    if (startPinned.length > 0) {
      const focusedForReset = await focusRow((await readOrder())[0]);
      assert(focusedForReset, "could not focus a row to clear pre-existing pins");
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
        timeoutMsg: "failed to clear pre-existing pins before the reorder test",
      });
    }
  });

  it("renders the order overlay, Alt+ArrowDown reorders+persists, announces the move, and a plain click still navigates", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");

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

    // 2. KEYBOARD REORDER: focus the FIRST tool's ROW (the NavLink — now the single
    //    Tab stop carrying the keyboard model), send the Alt+ArrowDown chord. The
    //    first tool must move to position 2 (down one).
    const focusedFirst = await focusRow(firstName);
    assert(
      focusedFirst,
      "the first tool ROW did not accept keyboard focus — not keyboard-reachable?",
    );

    // Alt chords go via the shared dispatchKey — see the WebKit Alt-drop lesson
    // in helpers.ts.

    // 2a. PLAIN ArrowDown (no Alt) is now roving FOCUS nav (the new model): it moves
    //    focus to the next row but must NEVER reorder. Assert the order is unchanged
    //    AND that focus advanced to the second row (then re-focus the first row so
    //    the Alt chord below reorders the intended tool).
    await dispatchKey("ArrowDown", false);
    const afterPlain = await readOrder();
    assert(
      afterPlain[0] === firstName,
      `plain ArrowDown must move FOCUS only, never reorder — "${firstName}" left index 0: ${JSON.stringify(afterPlain)}`,
    );
    const focusAdvanced = await browser.execute((second: string) => {
      const a = document.activeElement as HTMLElement | null;
      return a?.tagName === "A" && (a.textContent ?? "").includes(second);
    }, afterPlain[1]);
    assert(
      focusAdvanced,
      `plain ArrowDown must move focus to the second row ("${afterPlain[1]}") — roving nav`,
    );

    // 2b. Alt+ArrowDown moves the focused tool one slot down. Re-focus the first
    //     tool's row first (the plain ArrowDown above moved focus to row 2).
    await focusRow(firstName);
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
    await navigateToTool("protobuf-decoder");
    const afterReloadHandle = await $('button[aria-label^="Reorder "]');
    await afterReloadHandle.waitForExist({ timeout: 15_000 });
    // D-86: under FREE the persisted toolOrder is DORMANT (default render); the
    // custom order only renders under Pro. The reload drops the live entitlement
    // snapshot back to the resolved baseline, which after the D-85 flip needs the
    // DEV "full" override to resolve to Pro — and the dev-toggle→refreshEntitlements
    // propagation is racy on this WKWebView (helpers.ts). Re-establish Pro AFTER the
    // reload (idempotent — a no-op if the persisted override already resolved Pro)
    // so this asserts persistence of the ORDER, not of the tier flip.
    await ensureProTier();
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
    await saveScreenshot("sidebar", "sidebar-wkwebview.png");
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
// Every Alt chord is driven by the shared dispatchKey bubbling-KeyboardEvent
// helper (see the WebKit Alt-drop lesson in helpers.ts). Native POINTER drag +
// the hover-only pin reveal are manual-walkthrough items at the phase gate
// (WebDriver can't synth native drag).
describe("Pinned sidebar section (real WKWebView)", () => {
  it("Alt+P pins/unpins (group membership + aria-live), per-group Alt+arrow stays in-group, Unpin all clears, and a pin persists across reload", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // Pinning is a pro.ordering feature — establish Pro before the reset + Alt+P
    // assertions (post-D-85 the e2e baseline is FREE).
    await ensureProTier();

    // Start from a clean pinned set so assertions are deterministic regardless of
    // any pins left by a prior run's persisted prefs.json.
    const startPinned = await readPinnedOrder();
    if (startPinned.length > 0) {
      // Open the context menu on the first handle and click "Unpin all".
      const focusedForReset = await focusRow((await readOrder())[0]);
      assert(focusedForReset, "could not focus a row to clear pre-existing pins");
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
    const focused = await focusRow(targetName);
    assert(focused, `the "${targetName}" row did not accept keyboard focus`);
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
    const refocused = await focusRow(targetName);
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
      const f = await focusRow(unpinnedFirst);
      assert(f, `could not focus the unpinned tool "${unpinnedFirst}"`);
      await dispatchKey("ArrowUp", true); // boundary bump — stays in-group
      assert(
        !(await readPinnedOrder()).includes(unpinnedFirst),
        `an unpinned tool ("${unpinnedFirst}") must never enter the pinned group via Alt+↑ (PIN-06)`,
      );
    }

    // Screenshot the pinned state (artifact).
    await saveScreenshot("sidebar", "sidebar-pinned-wkwebview.png", "pinned-state");

    // 5. PERSISTS ACROSS RELOAD (PIN-07): with "${targetName}" still pinned, reload
    //    the webview entirely; the pinned group + that tool must survive (written
    //    through the platform store seam — packaged-runtime-only path).
    await browser.refresh();
    await navigateToTool("protobuf-decoder");
    const reloadHandle = await $('button[aria-label^="Reorder "]');
    await reloadHandle.waitForExist({ timeout: 15_000 });
    // D-86: under FREE the persisted pinnedToolIds are DORMANT (the pinned group
    // does not render). The reload drops the live entitlement snapshot to the
    // resolved baseline; after the D-85 flip Pro needs the DEV "full" override,
    // whose dev-toggle propagation is racy on this WKWebView (helpers.ts). Re-
    // establish Pro AFTER the reload (idempotent) so this asserts persistence of
    // the PIN, not of the tier flip.
    await ensureProTier();
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
    const focusedPinned = await focusRow(targetName);
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
    const f2 = await focusRow(pinAgain);
    assert(f2, `could not focus "${pinAgain}" to pin for Unpin-all`);
    await dispatchAltP();
    await browser.waitUntil(async () => (await readPinnedOrder()).includes(pinAgain), {
      timeout: 5_000,
      timeoutMsg: `expected "${pinAgain}" pinned before exercising Unpin all`,
    });
    // Open the context menu (Shift+F10) on the focused handle, then click "Unpin all".
    await focusRow(pinAgain);
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

// Keyboard model — real macOS WKWebView gate (Phase 17 gap fix). Every NavLink row
// is a Tab stop and carries the whole keyboard model; arrows are the fast path ON TOP
// of Tab. The load-bearing real-runtime checks only the real WKWebView proves:
//   1. Plain ↑/↓ move FOCUS between rows, traversing pinned then unpinned as one
//      continuous sequence ACROSS the divider (focus only; clamp at the ends, no wrap).
//   2. EVERY row is tabbable (tabIndex 0) and the pin button is a Tab stop too
//      (the keyboard fallback for pinning — Enter/Space on a focused pin toggles),
//      while the grip stays pointer-only (tabIndex -1).
describe("Sidebar keyboard model (real WKWebView)", () => {
  // Land clean (zero pinned) so the flat order is deterministic.
  beforeEach(async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });
    // The roving/Tab-pin tests pin tools (a pro.ordering feature) — establish Pro
    // before the reset + the test body (post-D-85 the e2e baseline is FREE).
    await ensureProTier();
    const startPinned = await readPinnedOrder();
    if (startPinned.length > 0) {
      const focusedForReset = await focusRow((await readOrder())[0]);
      assert(focusedForReset, "could not focus a row to clear pre-existing pins");
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
        timeoutMsg: "failed to clear pre-existing pins before the roving test",
      });
    }
  });

  it("plain ↑/↓ move focus between rows and cross the pinned↔unpinned divider, clamped at the ends", async () => {
    // Pin the FIRST unpinned tool so we have a pinned group above the divider.
    const toPin = (await readUnpinnedOrder())[0];
    assert(!!toPin, "expected at least one unpinned tool to pin");
    const focusedToPin = await focusRow(toPin);
    assert(focusedToPin, `the "${toPin}" row did not accept keyboard focus`);
    await dispatchAltP();
    await browser.waitUntil(async () => (await readPinnedOrder()).includes(toPin), {
      timeout: 5_000,
      timeoutMsg: `expected "${toPin}" pinned before the roving check`,
    });

    // Work in HREF-space: readRowHrefs() returns the rows in DOM order — pinned then
    // unpinned as one flat sequence — using the ROUTE id (`#/tools/{id}`), not the
    // display name (the grip aria-label name and the route id can differ in case,
    // e.g. "Base64" vs base64). The divider sits between the pinned rows and the
    // unpinned rows; with exactly one tool pinned, hrefs[0] is the last pinned row
    // and hrefs[1] is the first unpinned row.
    const pinnedCount = (await readPinnedOrder()).length;
    const hrefs = await readRowHrefs();
    assert(
      pinnedCount === 1 && hrefs.length >= 2,
      `expected exactly one pinned row above >=1 unpinned to test the divider crossing, got pinnedCount=${pinnedCount} hrefs=${JSON.stringify(hrefs)}`,
    );
    const lastPinnedHref = hrefs[pinnedCount - 1]; // = hrefs[0]
    const firstUnpinnedHref = hrefs[pinnedCount]; // = hrefs[1]

    // focus a row by its href (the route id is stable across the name/id case gap).
    const focusByHref = (href: string) =>
      browser.execute((h: string) => {
        const a = Array.from(
          document.querySelectorAll('nav a[href^="#/tools/"]'),
        ).find((el) => el.getAttribute("href") === h) as HTMLElement | null;
        a?.focus();
        return document.activeElement === a;
      }, href);

    // 1. CROSS THE DIVIDER (↓): focus the LAST pinned row, plain ArrowDown must land
    //    focus on the FIRST unpinned row — one continuous sequence across the divider.
    const focusedLastPinned = await focusByHref(lastPinnedHref);
    assert(focusedLastPinned, `could not focus the last pinned row "${lastPinnedHref}"`);
    await dispatchKey("ArrowDown", false);
    await browser.waitUntil(async () => (await activeRowHref()) === firstUnpinnedHref, {
      timeout: 3_000,
      timeoutMsg: `plain ArrowDown at the last pinned row must move focus across the divider to "${firstUnpinnedHref}", got "${await activeRowHref()}"`,
    });

    // 2. CROSS BACK (↑): from the first unpinned row, plain ArrowUp returns focus to
    //    the last pinned row.
    await dispatchKey("ArrowUp", false);
    await browser.waitUntil(async () => (await activeRowHref()) === lastPinnedHref, {
      timeout: 3_000,
      timeoutMsg: `plain ArrowUp at the first unpinned row must move focus back to "${lastPinnedHref}", got "${await activeRowHref()}"`,
    });

    // 3. CLAMP AT THE FIRST ROW (↑, no wrap): focus the very first visible row, plain
    //    ArrowUp must keep focus there (never wraps to the last).
    const firstHref = hrefs[0];
    await focusByHref(firstHref);
    await dispatchKey("ArrowUp", false);
    assert(
      (await activeRowHref()) === firstHref,
      `plain ArrowUp at the first row must CLAMP (no wrap) — focus left "${firstHref}" for "${await activeRowHref()}"`,
    );

    // 4. CLAMP AT THE LAST ROW (↓, no wrap).
    const lastHref = hrefs[hrefs.length - 1];
    await browser.execute((href: string) => {
      const a = Array.from(
        document.querySelectorAll('nav a[href^="#/tools/"]'),
      ).find((el) => el.getAttribute("href") === href) as HTMLElement | null;
      a?.focus();
    }, lastHref);
    await dispatchKey("ArrowDown", false);
    assert(
      (await activeRowHref()) === lastHref,
      `plain ArrowDown at the last row must CLAMP (no wrap) — focus left "${lastHref}" for "${await activeRowHref()}"`,
    );

    // Clean up: unpin so the next spec/run starts clean.
    const refocus = await focusRow(toPin);
    if (refocus) await dispatchAltP();
  });

  it("every row is tabbable, the pin button is a Tab stop (Enter toggles), and the grip stays pointer-only", async () => {
    // EVERY row carries tabindex 0 (Tab steps through all tools); arrows are the fast
    // path on top. No row is -1 anymore (the single-stop roving model was walked back).
    const rowTabindices = await browser.execute(() =>
      Array.from(document.querySelectorAll('nav a[href^="#/tools/"]')).map(
        (a) => a.getAttribute("tabindex"),
      ),
    );
    assert(
      rowTabindices.length >= 2 && rowTabindices.every((t) => t === "0"),
      `expected EVERY tool row to be tabindex 0, got ${JSON.stringify(rowTabindices)}`,
    );

    // The pin button is a Tab stop (tabindex 0 — the keyboard fallback for pinning);
    // the grip stays pointer-only (tabindex -1 — keyboard reorder is Alt+↑/↓ on the row).
    const controlTabindices = await browser.execute(() => {
      const pins = Array.from(
        document.querySelectorAll('nav button[aria-label^="Pin "], nav button[aria-label^="Unpin "]'),
      ).map((b) => b.getAttribute("tabindex"));
      const grips = Array.from(
        document.querySelectorAll('nav button[aria-label^="Reorder "]'),
      ).map((b) => b.getAttribute("tabindex"));
      return { pins, grips };
    });
    assert(
      controlTabindices.pins.length > 0 &&
        controlTabindices.pins.every((t) => t === "0"),
      `expected every pin button to be tabindex 0 (Tab-reachable fallback), got ${JSON.stringify(controlTabindices.pins)}`,
    );
    assert(
      controlTabindices.grips.length > 0 &&
        controlTabindices.grips.every((t) => t === "-1"),
      `expected every grip handle to be tabindex -1 (pointer-only), got ${JSON.stringify(controlTabindices.grips)}`,
    );

    // FALLBACK PATH: focus an unpinned tool's PIN BUTTON directly and press Enter —
    // a native <button> toggles on Enter/Space, so this must pin the tool (move it
    // into the pinned group) WITHOUT relying on the Alt+P row chord.
    const toPin = (await readUnpinnedOrder())[0];
    assert(!!toPin, "expected at least one unpinned tool to pin via the pin button");
    const focusedPinBtn = await browser.execute((name: string) => {
      const btn = Array.from(
        document.querySelectorAll('nav button[aria-label^="Pin "]'),
      ).find((b) => b.getAttribute("aria-label") === `Pin ${name}`) as HTMLElement | null;
      btn?.focus();
      return document.activeElement === btn;
    }, toPin);
    assert(focusedPinBtn, `could not focus the pin button for "${toPin}"`);
    await browser.execute(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      // jsdom/WebKit do not always synthesize the click from a dispatched keydown on a
      // <button>; a focused button's Enter activates onClick natively when the user
      // presses it. Emulate that activation explicitly for the WebDriver path.
      (document.activeElement as HTMLButtonElement | null)?.click();
    });
    await browser.waitUntil(async () => (await readPinnedOrder()).includes(toPin), {
      timeout: 5_000,
      timeoutMsg: `expected Enter/activation on the focused pin button to pin "${toPin}" (keyboard fallback), got ${JSON.stringify(await readPinnedOrder())}`,
    });

    // Clean up: unpin via the pin button so the next spec/run starts clean.
    await browser.execute((name: string) => {
      const btn = Array.from(
        document.querySelectorAll('nav button[aria-label^="Unpin "]'),
      ).find((b) => b.getAttribute("aria-label") === `Unpin ${name}`) as HTMLButtonElement | null;
      btn?.click();
    }, toPin);
    await browser.waitUntil(async () => !(await readPinnedOrder()).includes(toPin), {
      timeout: 5_000,
      timeoutMsg: `failed to clean up the "${toPin}" pin after the fallback check`,
    });
  });
});

// Registry head — Protobuf Decoder leads (real macOS WKWebView gate).
//
// The schema-less Protobuf decoder was moved to the HEAD of the TOOLS registry
// (src/lib/tools/registry.ts). The sidebar, ⌘K palette, and router all derive from
// that single array, so the DEFAULT (no-custom-order) sidebar order must now lead
// with "Protobuf Decoder", and a fresh install (no stored prefs) must open on it
// via the HERO_TOOL_ID fallback (resolveStartupTool). HERO_TOOL_ID was already
// protobuf-decoder, so the startup landing is unchanged code — but the two must
// stay ALIGNED (the registry head IS the hero), which only the real webview proves
// against the rendered rows.
//
// Only the real WKWebView proves the load-bearing bits: (1) the reconciled
// two-group overlay actually RENDERS the registry-head row first (the grip
// aria-labels read back protobuf-first), and (2) a full webview reload with the
// on-disk prefs wiped re-opens on the protobuf hero (the persistence/startup path
// runs only in the packaged runtime).
//
// TIER NOTE: ordering/pinning is a pro.ordering feature, but the grip handles and
// the [role=group][aria-label="Tools"] wrapper render in EVERY tier (Sidebar.tsx
// renderRow is not tier-gated). Under FREE, partitionTools forces the pinned group
// empty AND reverts any persisted custom toolOrder to the registry DEFAULT (D-26/
// D-86) WITHOUT touching stored prefs — so establishing FREE is exactly what makes
// the registry-default order (the thing under test) the one that renders,
// regardless of a custom order/pins a prior spec in this shared session persisted.
describe("Registry head — Protobuf Decoder leads (real WKWebView)", () => {
  const HERO_NAME = "Protobuf Decoder";
  const HERO_ROUTE = "tools/protobuf-decoder";

  beforeEach(async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");
    const protoInput = await $("#protobuf-input");
    await protoInput.waitForExist({ timeout: 15_000 });
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });
    // Establish FREE so the registry-DEFAULT order renders: under FREE the pinned
    // group is forced empty and any persisted custom toolOrder is dormant (D-86),
    // so a reorder/pin left by an earlier block in this shared session can't skew
    // "what leads the default order". This is the order the registry-head change
    // is about.
    await ensureFreeTier();
  });

  it("with prefs reset (fresh install), the sidebar leads with the Protobuf Decoder head and the app opens on it", async () => {
    // GENUINE fresh install: wipe the on-disk prefs blob (no lastUsedId / custom
    // order / pins / entitlement override), then reload so usePreferences re-reads
    // the cleared store from disk (the in-memory snapshot is otherwise stale).
    await resetPrefsBlob();
    await browser.refresh();

    // 1. THE APP OPENS ON THE PROTOBUF HERO — its input renders (summon.e2e style:
    //    a blank/crashed startup would leave #protobuf-input absent).
    const protoInput = await $("#protobuf-input");
    await protoInput.waitForExist({ timeout: 15_000 });
    assert(
      await protoInput.isDisplayed(),
      "the protobuf-decoder input did not render after a fresh-install reload — " +
        "app may have opened on the wrong tool or launched blank",
    );

    // 2. THE STARTUP ROUTE landed on the protobuf-decoder tool (the registry head /
    //    HERO_TOOL_ID fallback), not some other tool.
    const startupHash = await browser.execute(() => window.location.hash);
    assert(
      startupHash.includes(HERO_ROUTE),
      `expected the fresh-install startup route to land on ${HERO_ROUTE}, hash was "${startupHash}"`,
    );

    // 3. THE SIDEBAR DEFAULT ORDER LEADS WITH THE REGISTRY HEAD. Wait for the
    //    overlay to render its grip handles, then read the full order.
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });
    const order = await readOrder();
    assert(
      order.length >= 2,
      `expected the sidebar to render >= 2 tool rows, got ${order.length}: ${JSON.stringify(order)}`,
    );
    assert(
      order[0] === HERO_NAME,
      `expected the FIRST sidebar tool row to be "${HERO_NAME}" (registry head), got ${JSON.stringify(order)}`,
    );
    // The first tool is genuinely the ungrouped list head, not a pin: a fresh
    // install has no pinned group (dormant under FREE anyway).
    assert(
      (await readPinnedOrder()).length === 0,
      `expected NO pinned group on a fresh install, got ${JSON.stringify(await readPinnedOrder())}`,
    );

    // 4. THE INDEX / STARTUP SEAM resolves to the head too: navigate to the bare
    //    index route and assert resolveStartupTool sends the app to the protobuf
    //    hero (StartupRedirect > resolveStartupTool). With no default-tool set this
    //    is the registry head / last-used — both the protobuf hero.
    await browser.execute(() => {
      window.location.hash = "#/";
    });
    await browser.waitUntil(
      async () => (await browser.execute(() => window.location.hash)).includes(HERO_ROUTE),
      {
        timeout: 5_000,
        timeoutMsg: `expected the bare index route to resolve to ${HERO_ROUTE}, hash was "${await browser.execute(() => window.location.hash)}"`,
      },
    );

    // 5. Screenshot the real WKWebView sidebar (the HRN-02 artifact for this spec).
    await saveScreenshot("sidebar", "sidebar-registry-head-wkwebview.png", "registry-head");
  });

  it("an existing user on Base64 keeps Base64 — restored via the startup redirect (last-used) — while the default order still leads with Protobuf Decoder", async () => {
    // The last-used precedence check (no prefs-seeding pattern exists in this
    // harness — the only IPC seed is setDevLicenseState — so we DRIVE Base64 as the
    // last-used tool rather than seeding lastUsedId at launch): an existing user on
    // Base64 must NOT be hijacked to the new registry head, and the reorder must not
    // disturb a tool that isn't the head.
    //
    // The EARLIER form of this test called browser.refresh() while the URL was still
    // `#/tools/base64` — a concrete tool route that matches ToolRoute DIRECTLY, so
    // StartupRedirect/resolveStartupTool never ran and a regression that stopped
    // persisting or restoring lastUsedId would still have passed (Codex finding). We
    // instead (1) assert the switch actually PERSISTED lastUsedId="base64" to the
    // on-disk prefs blob, then (2) drive the BARE INDEX route `#/` so
    // resolveStartupTool's lastUsedId precedence is exercised for real.
    await navigateToTool("base64");
    const b64Input = await $("#base64-pane-text");
    await b64Input.waitForExist({ timeout: 15_000 });
    assert(
      await b64Input.isDisplayed(),
      "the Base64 tool did not render after navigating to it",
    );
    const b64Hash = await browser.execute(() => window.location.hash);
    assert(
      b64Hash.includes("tools/base64"),
      `expected the route to be on tools/base64, hash was "${b64Hash}"`,
    );

    // The registry-head reorder is a DEFAULT-order change, independent of the open
    // tool: the sidebar still leads with the Protobuf Decoder head while the user
    // works in Base64.
    const order = await readOrder();
    assert(
      order[0] === HERO_NAME,
      `expected the default sidebar order to still lead with "${HERO_NAME}" while on Base64, got ${JSON.stringify(order)}`,
    );

    // PERSISTED lastUsedId: navigating to Base64 fires useTrackActiveTool ->
    // recordSwitch -> updatePreferences -> `void savePreferences` (fire-and-forget,
    // then fsync'd via store.save()), so the on-disk write is async — POLL the SAME
    // plugin-store seam resetPrefsBlob uses until the blob carries lastUsedId
    // "base64". This is the value StartupRedirect will read; a regression that stops
    // persisting last-used fails HERE (the earlier concrete-route reload could not
    // see it).
    await browser.waitUntil(
      async () => (await readPrefsBlob())?.lastUsedId === "base64",
      {
        timeout: 5_000,
        timeoutMsg: `expected the Base64 switch to persist lastUsedId="base64" to the prefs blob, got ${JSON.stringify(await readPrefsBlob())}`,
      },
    );

    // Screenshot the painted Base64-user state (Protobuf Decoder still first in the
    // sidebar). Captured HERE — before the reload below — because a screenshot taken
    // immediately after browser.refresh() catches the WKWebView mid-reload white
    // flash (the DOM element exists before the first paint lands).
    await saveScreenshot("sidebar", "sidebar-base64-user-wkwebview.png", "base64-user");

    // Full reload so usePreferences re-reads the persisted blob from DISK (its
    // in-memory React snapshot is otherwise stale) — this proves the last-used value
    // survives a genuine relaunch, not just an in-session write.
    await browser.refresh();
    const b64AfterReload = await $("#base64-pane-text");
    await b64AfterReload.waitForExist({ timeout: 15_000 });

    // NOW drive the BARE INDEX route: after the reload the URL is still
    // `#/tools/base64` (matches ToolRoute directly, bypassing StartupRedirect), so
    // navigate to `#/` to make StartupRedirect > resolveStartupTool run against the
    // reloaded-from-disk lastUsedId. With no default-tool set, the last-used rung
    // must send the app BACK to Base64 — the real restore path.
    await browser.execute(() => {
      window.location.hash = "#/";
    });
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => window.location.hash)).includes("tools/base64"),
      {
        timeout: 5_000,
        timeoutMsg: `expected the bare index route to restore the last-used Base64 tool via resolveStartupTool, hash was "${await browser.execute(() => window.location.hash)}"`,
      },
    );

    // The redirect landed the Base64 VIEW, not just the hash — the tool actually
    // mounted after the startup resolve.
    const b64Restored = await $("#base64-pane-text");
    await b64Restored.waitForExist({ timeout: 15_000 });
    assert(
      await b64Restored.isDisplayed(),
      "the Base64 tool did not render after the startup redirect restored the last-used tool",
    );

    // And the DEFAULT order still leads with the registry head after the restore —
    // the last-used restore repoints the OPEN tool, never the default order.
    const orderAfter = await readOrder();
    assert(
      orderAfter[0] === HERO_NAME,
      `expected the default sidebar order to still lead with "${HERO_NAME}" after the startup restore, got ${JSON.stringify(orderAfter)}`,
    );
  });
});
