// Entitlements dev toggle — real macOS WKWebView gate (Phase 18, 18-04; ENT-04,
// D-26/D-28/D-29/D-31/D-32, threat T-18-15).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// sidebar.e2e.ts. Run by scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts
// `specs: ["./test/e2e/*.e2e.ts"]`. `tauri dev` serves a DEV bundle, so the
// D-32 "Toggle free tier (dev)" palette command EXISTS here (RESEARCH Pitfall 6
// — this spec proves the locked UX in dev/e2e; the packaged free-tier proof is
// Phase 21's flip gate, and scripts/check-dev-strip.sh proves the command is
// absent from production bundles).
//
// The load-bearing real-runtime checks — only the real WKWebView truly proves:
//   1. The ⌘K palette's DEV toggle flips the LIVE entitlement snapshot through
//      the real prefs store (prefs.json) + refreshEntitlements() — all sidebar
//      surfaces react together (one central gate, ENT-01/ENT-03).
//   2. Locked ordering/pinning renders the REGISTRY-DEFAULT order with NO
//      pinned group/divider (D-26) and the free-tier-only "Unlock Pro" footer
//      row appears (D-29).
//   3. A locked customization affordance — the REAL macOS Alt+P shape
//      (Option+P composes to "π": key "π", code "KeyP") — opens the shared
//      upsell modal ("Tool ordering & pinning is a Pro feature") instead of
//      pinning (D-28), and Escape dismisses it.
//   4. Toggling back to full tier restores the seeded custom order + pinned
//      section instantly — the stored prefs were NEVER deleted while locked
//      (D-26 prefs preservation; the toggle-back is also the T-18-15 cleanup
//      so no "free" override is left behind on a dev machine).
//
// NOTE on selecting the command: a typed query FILTERS COMMANDS OUT (commands
// append only on the empty query — CommandPalette buildGroups, proven by the
// "filtered out under query" unit test). So the spec selects it the keyboard
// way the unit suite proves: ArrowUp on the empty query wraps the highlight to
// the LAST flat row — the DEV command — then Enter runs it.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");
const LOCKED_SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "entitlements-locked-upsell.png");
const RESTORED_SCREENSHOT_PATH = resolve(SCREENSHOT_DIR, "entitlements-restored.png");

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

// Read the visible sidebar order from the grip handles' aria-labels — a single
// round-trip (WebKit's embedded WebDriver goes stale on chained element handles).
function readOrder(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).map(
      (b) => (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
    ),
  );
}

// The pinned group's tool names ([] when the group is not rendered).
function readPinnedOrder(): Promise<string[]> {
  return browser.execute(() => {
    const grp = document.querySelector('[role="group"][aria-label="Pinned tools"]');
    if (!grp) return [];
    return Array.from(grp.querySelectorAll('button[aria-label^="Reorder "]')).map(
      (b) => (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
    );
  });
}

// Bubbling-KeyboardEvent key dispatch on the focused element — NOT
// browser.keys()/the Actions API (macOS WebKit's embedded WebDriver drops the
// Alt modifier on synthesized key actions; the sidebar.e2e lesson).
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

// Alt+P with the REAL macOS composed shape: Option+P arrives as key "π" (NOT
// "p") with code "KeyP" and altKey true — fails an `e.key`-only check, passes
// the `e.code === "KeyP"` handler (D-17). While ordering is LOCKED this chord
// must open the upsell modal instead of pinning (D-28).
function dispatchAltP(): Promise<void> {
  return browser.execute(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "π",
        code: "KeyP",
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

// Focus the ROW (NavLink <a>) for the named tool (located via its grip's
// stable aria-label, the per-row marker). Returns true if the <a> got focus.
function focusRow(name: string): Promise<boolean> {
  return browser.execute((n: string) => {
    const grip = Array.from(
      document.querySelectorAll('button[aria-label^="Reorder "]'),
    ).find((b) => b.getAttribute("aria-label") === `Reorder ${n}`);
    const link = grip?.closest("div")?.querySelector("a") as HTMLAnchorElement | null;
    link?.focus();
    return document.activeElement === link;
  }, name);
}

// Whether the D-29 free-tier footer "Unlock Pro" button is rendered — the
// stable free-vs-full tier probe (present in free tier only).
function unlockProFooterPresent(): Promise<boolean> {
  return browser.execute(
    () =>
      Array.from(document.querySelectorAll("aside button")).some((b) =>
        (b.textContent ?? "").includes("Unlock Pro"),
      ),
  );
}

// Whether the shared upsell modal is open (the [role="dialog"] carrying the
// UI-SPEC copy contract heading). Distinguished from the ⌘K palette dialog by
// the heading text.
function upsellModalOpen(): Promise<boolean> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll('[role="dialog"]')).some((d) =>
      (d.textContent ?? "").includes("Tool ordering & pinning is a Pro feature"),
    ),
  );
}

// Open the ⌘K palette and run the DEV "Toggle free tier (dev)" command via the
// keyboard path: ArrowUp wraps the highlight from row 0 to the LAST flat row
// (commands append after ALL TOOLS on the empty query), Enter runs it (the
// palette closes first, then the command persists the downgrade-only override
// and awaits refreshEntitlements() — D-31/D-32).
async function runDevToggle(): Promise<void> {
  // The ⌘K listener lives on window — dispatch the chord there directly.
  await browser.execute(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  const input = await $('input[aria-label="Search tools"]');
  await input.waitForExist({ timeout: 10_000 });

  // ArrowUp on the empty query → highlight wraps to the last row (the command).
  await browser.execute(() => {
    document
      .querySelector('input[aria-label="Search tools"]')
      ?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowUp",
          bubbles: true,
          cancelable: true,
        }),
      );
  });
  // Fail loud if the highlighted row is NOT the dev command (Enter would
  // otherwise navigate to a tool and corrupt the rest of the spec).
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const dialog = document.querySelector('[aria-label="Command palette"]');
        const on = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
          b.className.includes("bg-accent-soft"),
        );
        return (on?.textContent ?? "").includes("Toggle free tier (dev)");
      }),
    {
      timeout: 5_000,
      timeoutMsg:
        'expected ArrowUp on the empty query to highlight the LAST palette row — the "Toggle free tier (dev)" command',
    },
  );
  await browser.execute(() => {
    document
      .querySelector('input[aria-label="Search tools"]')
      ?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        }),
      );
  });
  // The palette closes before the async run lands.
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => document.querySelector('input[aria-label="Search tools"]') === null,
      ),
    { timeout: 5_000, timeoutMsg: "palette did not close after running the dev toggle" },
  );
}

// Clear any custom order + pins through the SAME Shift+F10 menu gestures the
// sidebar spec uses, so "registry default" is read from a deterministic state.
async function resetArrangement(): Promise<void> {
  const order = await readOrder();
  assert(order.length >= 2, "expected >= 2 sidebar tools to reset");

  // "Reset order" (always present in the menu).
  const focusedForOrder = await focusRow(order[0]);
  assert(focusedForOrder, "could not focus a row to reset the order");
  await browser.execute(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }),
    );
  });
  await browser.execute(() => {
    const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((b) =>
      (b.textContent ?? "").includes("Reset order"),
    ) as HTMLElement | null;
    item?.click();
  });

  // "Unpin all" (second pass — the first click closes the menu) if pins remain.
  if ((await readPinnedOrder()).length > 0) {
    const focusedForPins = await focusRow((await readOrder())[0]);
    assert(focusedForPins, "could not focus a row to clear pins");
    await browser.execute(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }),
      );
    });
    await browser.execute(() => {
      const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find(
        (b) => (b.textContent ?? "").includes("Unpin all"),
      ) as HTMLElement | null;
      item?.click();
    });
    await browser.waitUntil(async () => (await readPinnedOrder()).length === 0, {
      timeout: 5_000,
      timeoutMsg: "failed to clear pins while resetting the arrangement",
    });
  }
}

describe("Entitlements dev toggle (real WKWebView)", () => {
  it("locks the sidebar UX (default order, hidden pinned, footer row, Alt+P upsell modal) and toggle-back restores the preserved arrangement", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // 0. BASELINE TIER: if a prior failed run left the persisted "free"
    //    override behind, toggle back to full first (T-18-15 hygiene).
    if (await unlockProFooterPresent()) {
      await runDevToggle();
      await browser.waitUntil(async () => !(await unlockProFooterPresent()), {
        timeout: 10_000,
        timeoutMsg: "could not restore full tier from a leftover free override",
      });
    }

    // 1. DETERMINISTIC BASELINE: reset order + pins, then read the registry
    //    default order from the live DOM.
    await resetArrangement();
    const registryDefault = await readOrder();
    assert(
      registryDefault.length >= 2,
      `expected >= 2 tools in the registry-default order, got ${JSON.stringify(registryDefault)}`,
    );

    // 2. SEED a custom arrangement through the UI: move the first tool down one
    //    (Alt+ArrowDown) and pin the now-second tool (the moved one) via Alt+P.
    const movedTool = registryDefault[0];
    const focusedToMove = await focusRow(movedTool);
    assert(focusedToMove, `the "${movedTool}" row did not accept keyboard focus`);
    await dispatchKey("ArrowDown", true);
    await browser.waitUntil(async () => (await readOrder())[1] === movedTool, {
      timeout: 5_000,
      timeoutMsg: `expected "${movedTool}" at index 1 after Alt+ArrowDown (seeding the custom order)`,
    });

    const pinnedTool = registryDefault[1]; // now at index 0 after the move
    const focusedToPin = await focusRow(pinnedTool);
    assert(focusedToPin, `the "${pinnedTool}" row did not accept keyboard focus to pin`);
    await dispatchAltP();
    await browser.waitUntil(
      async () => (await readPinnedOrder()).includes(pinnedTool),
      {
        timeout: 5_000,
        timeoutMsg: `expected "${pinnedTool}" pinned while seeding, got ${JSON.stringify(await readPinnedOrder())}`,
      },
    );
    const customOrder = await readOrder(); // pinned-then-unpinned flat sequence
    assert(
      JSON.stringify(customOrder) !== JSON.stringify(registryDefault),
      "seeding failed — the custom arrangement equals the registry default",
    );

    // 3. TOGGLE FREE TIER via the ⌘K DEV command — the one central gate flips
    //    every surface live (footer row appears = the resolved set is FREE).
    await runDevToggle();
    await browser.waitUntil(async () => unlockProFooterPresent(), {
      timeout: 10_000,
      timeoutMsg:
        'expected the free-tier-only "Unlock Pro" footer row after the dev toggle (D-29)',
    });

    // From here until the toggle-back, the persisted "free" override is live.
    // The finally block guarantees restoration even if a locked-state assertion
    // throws — otherwise the override would poison every later spec in this
    // same WDIO run (bail: 0, shared prefs.json — codex P2 / T-18-15).
    try {
      // (a) D-26: registry-default order, NO pinned group, NO divider — while
      //     the stored prefs stay untouched on disk.
      const lockedOrder = await readOrder();
      assert(
        JSON.stringify(lockedOrder) === JSON.stringify(registryDefault),
        `locked sidebar must render the registry-default order, got ${JSON.stringify(lockedOrder)} (expected ${JSON.stringify(registryDefault)})`,
      );
      const lockedChrome = await browser.execute(() => ({
        pinnedGroup:
          document.querySelector('[role="group"][aria-label="Pinned tools"]') !== null,
        divider: document.querySelector("nav hr") !== null,
      }));
      assert(
        !lockedChrome.pinnedGroup && !lockedChrome.divider,
        `locked sidebar must hide the pinned group AND its divider (D-26), got ${JSON.stringify(lockedChrome)}`,
      );

      // (c) D-28: the real macOS Alt+P shape (key "π" / code "KeyP") on a
      //     focused row opens the shared upsell modal instead of pinning.
      const focusedLocked = await focusRow(registryDefault[0]);
      assert(focusedLocked, "could not focus a row to invoke the locked Alt+P chord");
      await dispatchAltP();
      await browser.waitUntil(async () => upsellModalOpen(), {
        timeout: 5_000,
        timeoutMsg:
          'expected Alt+P while locked to open the [role="dialog"] upsell modal ("Tool ordering & pinning is a Pro feature")',
      });
      assert(
        (await readPinnedOrder()).length === 0,
        "the locked Alt+P chord must never actually pin (no write path while locked)",
      );

      // Screenshot the locked state with the modal up (the gate artifact).
      mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await browser.saveScreenshot(LOCKED_SCREENSHOT_PATH);
      console.log(`[entitlements] saved locked-upsell screenshot to ${LOCKED_SCREENSHOT_PATH}`);

      // (d) Escape dismisses the modal (document-level listener — bubble it
      //     from the focused element inside the dialog).
      await dispatchKey("Escape", false);
      await browser.waitUntil(async () => !(await upsellModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the upsell modal",
      });
    } finally {
      // (e) TOGGLE BACK — also the unconditional cleanup. Best-effort under a
      // failure (an assertion error above must win over a cleanup error).
      try {
        if (await upsellModalOpen()) await dispatchKey("Escape", false);
        if (await unlockProFooterPresent()) {
          await runDevToggle();
          await browser.waitUntil(async () => !(await unlockProFooterPresent()), {
            timeout: 10_000,
            timeoutMsg: 'expected the "Unlock Pro" footer row to disappear on toggle-back',
          });
        }
      } catch (cleanupError) {
        console.error("[entitlements] toggle-back cleanup failed:", cleanupError);
      }
    }

    // The custom order + pinned section restore instantly on unlock — the
    // stored prefs were never deleted while locked (D-26 preservation proof).
    await browser.waitUntil(
      async () => (await readPinnedOrder()).includes(pinnedTool),
      {
        timeout: 5_000,
        timeoutMsg: `expected the pinned section (with "${pinnedTool}") to restore on unlock, got ${JSON.stringify(await readPinnedOrder())}`,
      },
    );
    const restoredOrder = await readOrder();
    assert(
      JSON.stringify(restoredOrder) === JSON.stringify(customOrder),
      `expected the seeded custom arrangement to restore on unlock, got ${JSON.stringify(restoredOrder)} (expected ${JSON.stringify(customOrder)})`,
    );

    await browser.saveScreenshot(RESTORED_SCREENSHOT_PATH);
    console.log(`[entitlements] saved restored-state screenshot to ${RESTORED_SCREENSHOT_PATH}`);

    // Leave the machine the way we found it (clean order + no pins) so the
    // other sidebar specs start deterministic.
    await resetArrangement();
  });
});
