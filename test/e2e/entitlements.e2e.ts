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
//      (Option+P composes to "π": key "π", code "KeyP") — opens Settings ▸ License
//      (the inline upsell surface — post-22.1-04 every former upsell entry routes
//      to openSettings("license"), the standalone UpsellModal was REMOVED) instead
//      of pinning (D-28), and Escape dismisses the Settings modal.
//   4. Toggling back to full tier restores the seeded custom order + pinned
//      section instantly — the stored prefs were NEVER deleted while locked
//      (D-26 prefs preservation; the toggle-back is also the T-18-15 cleanup
//      so no "free" override is left behind on a dev machine).
//
// NOTE on selecting the command: the spec drives the REAL user path found in
// the 18-04 walkthrough — TYPE "toggle free" into the palette input (commands
// are searchable by name and append AFTER tool matches; an earlier build
// filtered them out under any query, which this flow regression-proves),
// then ArrowUp wraps the highlight to the LAST row — always the DEV command,
// whether or not tools also matched — and Enter runs it.

// Shared with sidebar.e2e.ts: assert, the bubbling dispatchKey/dispatchAltP
// Alt-chord helpers (WebKit drops Alt on synthesized key actions; Option+P
// composes to "π" — while ordering is LOCKED that chord must open Settings ▸
// License instead of pinning, D-28), and the single-round-trip sidebar readers —
// see the doc comments in helpers.ts for the full WHY behind each.
//
// Post-22.1-04: the standalone "Unlock Pro" UpsellModal was REMOVED — every former
// upsell entry (the footer row, the locked customization affordances, the ⌘K free
// "License" command) now calls openSettings("license"), opening the shell Settings
// modal on the License pane (the inline upsell surface). `settingsLicensePaneOpen`
// (aliased here as the former `upsellModalOpen`) probes that Settings ▸ License pane.
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
  runDevToggle,
  saveScreenshot,
  settingsLicensePaneOpen,
  stackedUpsellModalPresent,
  unlockProFooterPresent,
} from "./helpers";

// Whether Settings ▸ License (the inline upsell surface) is open. The ⌘K "License"
// command (Pro tier) routes here (openSettings). Reads the Settings dialog's
// License-pane copy. (Phase 22.2: the CONTEXTUAL locked triggers no longer route
// here — they open the focused modal, probed via stackedUpsellModalPresent.)
const upsellModalOpen = settingsLicensePaneOpen;

// runDevToggle (the ⌘K "Toggle free tier (dev)" drive) moved to helpers.ts in
// Phase 19 so license.e2e.ts shares the exact same real-user path — see the
// doc comment there for the 18-04 walkthrough regression it encodes.

// Drive the ⌘K palette's production "License" command via the real user path —
// open the palette, TYPE "License" (the same controlled-input contract runDevToggle
// uses: native value setter + bubbling "input" event, since a bare .value write is
// swallowed by React's value tracker), wait for the row to surface, then click it.
// In the FREE tier its run() opens Settings ▸ License (post-22.1-04: openSettings
// ("license") — the standalone upsell modal was removed) instead of navigating
// (the pre-fix arm did navigate("/") — a silent no-op on "/", read as broken).
async function runLicenseCommand(): Promise<void> {
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

  await browser.execute(() => {
    const el = document.querySelector(
      'input[aria-label="Search tools"]',
    ) as HTMLInputElement | null;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, "License");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // The typed query surfaces the "License" command row inside the palette.
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const dialog = document.querySelector('[aria-label="Command palette"]');
        return Array.from(dialog?.querySelectorAll("button") ?? []).some(
          (b) => (b.textContent ?? "").trim() === "License",
        );
      }),
    {
      timeout: 5_000,
      timeoutMsg:
        'expected typing "License" to surface the production "License" command row in the ⌘K palette (D-88)',
    },
  );

  // Click the exact "License" row (production command). It is a SHIPPED command
  // — not under the DEV guard — so it is present in this dev bundle and in prod.
  await browser.execute(() => {
    const dialog = document.querySelector('[aria-label="Command palette"]');
    const row = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "License",
    ) as HTMLElement | undefined;
    row?.click();
  });

  // The palette closes before/while the command's run() lands.
  await browser
    .waitUntil(
      async () =>
        browser.execute(() => document.querySelector('input[aria-label="Search tools"]') === null),
      {
        timeout: 5_000,
        timeoutMsg: "palette did not close after running the License command",
      },
    )
    .catch(() => {
      // The upsell modal opening may race the palette teardown poll — the
      // load-bearing assertion is the modal opening, not the palette closing.
    });
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
      const item = Array.from(document.querySelectorAll('[role="menuitem"]')).find((b) =>
        (b.textContent ?? "").includes("Unpin all"),
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
  it("locks the sidebar UX (default order, hidden pinned, footer row, Alt+P opens Settings ▸ License) and toggle-back restores the preserved arrangement", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // 0. BASELINE TIER: post-D-85 the e2e baseline is FREE (the unlicensed
    //    in-Tauri flip; the e2e-spike preflight wipes prefs.json + machine.dev.lic).
    //    Establish Pro via the dev toggle's DEV-only "full" override so the seeding
    //    below (reorder + pin, both pro.ordering) can run.
    await ensureProTier();

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
    await browser.waitUntil(async () => (await readPinnedOrder()).includes(pinnedTool), {
      timeout: 5_000,
      timeoutMsg: `expected "${pinnedTool}" pinned while seeding, got ${JSON.stringify(await readPinnedOrder())}`,
    });
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
      timeoutMsg: 'expected the free-tier-only "Unlock Pro" footer row after the dev toggle (D-29)',
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
        pinnedGroup: document.querySelector('[role="group"][aria-label="Pinned tools"]') !== null,
        divider: document.querySelector("nav hr") !== null,
      }));
      assert(
        !lockedChrome.pinnedGroup && !lockedChrome.divider,
        `locked sidebar must hide the pinned group AND its divider (D-26), got ${JSON.stringify(lockedChrome)}`,
      );

      // (c) D-28 (revised Phase 22.2): the real macOS Alt+P shape (key "π" / code
      //     "KeyP") on a focused row, while FREE (notActivated), opens the focused
      //     Unlock-Pro MODAL instead of pinning — the contextual locked trigger now
      //     routes through openProUpsell → openUpsell (not Settings).
      const focusedLocked = await focusRow(registryDefault[0]);
      assert(focusedLocked, "could not focus a row to invoke the locked Alt+P chord");
      await dispatchAltP();
      await browser.waitUntil(async () => stackedUpsellModalPresent(), {
        timeout: 5_000,
        timeoutMsg:
          "expected Alt+P while locked to open the focused Unlock-Pro modal (the contextual trigger, Phase 22.2)",
      });
      assert(
        (await readPinnedOrder()).length === 0,
        "the locked Alt+P chord must never actually pin (no write path while locked)",
      );

      // Screenshot the locked state with the focused Unlock-Pro modal up (the gate artifact).
      await saveScreenshot("entitlements", "entitlements-locked-modal.png", "locked-modal");

      // (d) Escape dismisses the focused modal (document-level listener — bubble
      //     it from the focused element inside the dialog).
      await dispatchKey("Escape", false);
      await browser.waitUntil(async () => !(await stackedUpsellModalPresent()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the focused Unlock-Pro modal",
      });
    } finally {
      // (e) TOGGLE BACK — also the unconditional cleanup. Best-effort under a
      // failure (an assertion error above must win over a cleanup error).
      try {
        if (await stackedUpsellModalPresent()) {
          await dispatchKey("Escape", false);
          await browser
            .waitUntil(async () => !(await stackedUpsellModalPresent()), { timeout: 5_000 })
            .catch(() => {});
        }
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
    await browser.waitUntil(async () => (await readPinnedOrder()).includes(pinnedTool), {
      timeout: 5_000,
      timeoutMsg: `expected the pinned section (with "${pinnedTool}") to restore on unlock, got ${JSON.stringify(await readPinnedOrder())}`,
    });
    const restoredOrder = await readOrder();
    assert(
      JSON.stringify(restoredOrder) === JSON.stringify(customOrder),
      `expected the seeded custom arrangement to restore on unlock, got ${JSON.stringify(restoredOrder)} (expected ${JSON.stringify(customOrder)})`,
    );

    await saveScreenshot("entitlements", "entitlements-restored.png", "restored-state");

    // Leave the machine the way we found it (clean order + no pins) so the
    // other sidebar specs start deterministic.
    await resetArrangement();
  });

  // Phase 22.2 — the ⌘K palette is Pro-gated, so the production "License" command is
  // reachable from the palette only by a PRO user. This proves the real WKWebView
  // path: as a Pro user, ⌘K opens the palette, typing "License" surfaces the command,
  // and running it opens the [aria-modal] Settings dialog on the License pane (the
  // dev-override Pro user's license state is still notActivated, so the pane renders
  // the inline upsell — settingsLicensePaneOpen). (A FREE user's ⌘K can't reach this
  // command at all — that gate is proven in cmdk-pro.e2e.ts.)
  it('the ⌘K "License" command (Pro tier) opens the Settings ▸ License pane', async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // Establish PRO explicitly so the palette opens (the gate requires isPro).
    await ensureProTier();
    assert(
      !(await unlockProFooterPresent()),
      "expected NO Unlock-Pro footer after establishing the Pro tier",
    );
    assert(
      !(await upsellModalOpen()),
      "no Settings ▸ License pane should be open before running the License command",
    );

    try {
      await runLicenseCommand();
      await browser.waitUntil(async () => upsellModalOpen(), {
        timeout: 5_000,
        timeoutMsg:
          'expected the Pro-tier ⌘K "License" command to open the Settings ▸ License pane — it must not silently navigate',
      });
      await saveScreenshot(
        "entitlements",
        "entitlements-license-command-settings.png",
        "license-command-settings",
      );
    } finally {
      // Dismiss any open modal and reset to the FREE baseline so no "full" override
      // is left behind for later specs in this WDIO run (best-effort — T-18-15).
      try {
        if (await upsellModalOpen()) {
          await dispatchKey("Escape", false);
          await browser.waitUntil(async () => !(await upsellModalOpen()), {
            timeout: 5_000,
            timeoutMsg: "expected Escape to dismiss the Settings ▸ License modal",
          });
        }
        await ensureFreeTier();
      } catch (cleanupError) {
        console.error("[entitlements] license-command cleanup failed:", cleanupError);
      }
    }
  });
});
