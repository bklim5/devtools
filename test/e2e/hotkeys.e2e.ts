// Hotkeys pane — real macOS WKWebView gate (Phase 24, 24-03; SET-08, D-24-1/6).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). Run by
// scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts.
//
// This spec proves the WebDriver-drivable half of SET-08 — the NATIVE summon
// re-register, the OS-taken reject, and restart-persistence are the Manual-Only
// items in the phase-boundary human walkthrough (Task 4; WebDriver cannot drive
// native chrome or synthesize an OS global-shortcut collision — RESEARCH
// Pitfall 6):
//   1. Pane reachable: open Settings, navigate to the Hotkeys pane, assert both
//      binding rows render (Global summon, Command palette) with their chords.
//   2. Palette opens on the configured chord: the default ⌘K opens the palette
//      (Pro tier, so the palette — not the upsell — opens, D-24-6).
//   3. Rebind reflected: capture a new palette chord (Cmd+Shift+J, code "KeyJ"),
//      assert the displayed chord updates AND the palette now opens on the new
//      chord and NO LONGER on ⌘K.
//   4. Escape cancels capture: activate capture, press Escape, chord unchanged.
//
// MEMORY: macos-option-key-composes-letters — every dispatched chord carries the
// PHYSICAL `code` (matchesChord + keyEventToAccelerator read e.code, never the
// composed character). MEMORY: license-walkthrough-state-pollutes-e2e — the
// e2e-spike preflight wipes prefs.json to a deterministic baseline; the finally
// block resets the palette chord to ⌘K + drops to FREE so no state leaks.

import {
  assert,
  ensureFreeTier,
  ensureProTier,
  navigateToTool,
  saveScreenshot,
} from "./helpers";

/** Open the Settings modal on the License pane via the deep-link, then click the
 *  named pane-nav button (asserting aria-current lands on it). One opener for
 *  every pane — call openHotkeysPane()/openGeneralPane() for readability. */
async function openSettingsPane(paneName: string): Promise<void> {
  await browser.execute(() => {
    window.location.hash = "#/settings/license";
  });
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
      ),
    {
      timeout: 10_000,
      timeoutMsg: "expected the Settings modal to open from the #/settings/license deep-link",
    },
  );
  await browser.execute((name: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("nav button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === name,
    ) as HTMLElement | undefined;
    btn?.click();
  }, paneName);
  await browser.waitUntil(
    async () =>
      browser.execute((name: string) => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        const current = dialog?.querySelector('[aria-current="page"]');
        return (current?.textContent ?? "").includes(name);
      }, paneName),
    {
      timeout: 5_000,
      timeoutMsg: `expected the ${paneName} pane nav button to carry aria-current="page"`,
    },
  );
}

const openHotkeysPane = () => openSettingsPane("Hotkeys");
const openGeneralPane = () => openSettingsPane("General");

/** Whether a binding-row label (h4) is present inside the dialog. */
function rowLabelPresent(label: string): Promise<boolean> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    return Array.from(dialog?.querySelectorAll("h4") ?? []).some(
      (h) => (h.textContent ?? "").trim() === l,
    );
  }, label);
}

/** Whether a control with the given accessible text is present inside the dialog
 *  (matches a role="switch" aria-label, a <label>, or any element's trimmed text). */
function controlPresent(text: string): Promise<boolean> {
  return browser.execute((t: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return false;
    const sw = Array.from(dialog.querySelectorAll('[role="switch"]')).some(
      (s) => s.getAttribute("aria-label") === t,
    );
    const labelled = Array.from(dialog.querySelectorAll("label, span")).some(
      (el) => (el.textContent ?? "").trim() === t,
    );
    return sw || labelled;
  }, text);
}

/** Click the General-pane toggle whose accessible name (role="switch" aria-label)
 *  matches `label`, returning its resulting aria-checked. */
function toggleSwitch(label: string): Promise<string | null> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const sw = Array.from(dialog?.querySelectorAll('[role="switch"]') ?? []).find(
      (s) => s.getAttribute("aria-label") === l,
    ) as HTMLElement | undefined;
    sw?.click();
    return sw?.getAttribute("aria-checked") ?? null;
  }, label);
}

/** The aria-checked of a General-pane toggle by accessible name, or null. */
function switchChecked(label: string): Promise<string | null> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const sw = Array.from(dialog?.querySelectorAll('[role="switch"]') ?? []).find(
      (s) => s.getAttribute("aria-label") === l,
    );
    return sw?.getAttribute("aria-checked") ?? null;
  }, label);
}

/** Whether the sidebar's license/upgrade affordance ("Unlock Pro" / "License
 *  needs attention") is currently rendered. */
function sidebarLicenseAffordancePresent(): Promise<boolean> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll("aside button")).some((b) => {
      const t = b.textContent ?? "";
      return t.includes("Unlock Pro") || t.includes("License needs attention");
    }),
  );
}

/** Whether the bottom unconditional sidebar "Settings" gear row is present
 *  (SET-04 invariant — must survive the show-license toggle in both states). */
function sidebarSettingsRowPresent(): Promise<boolean> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll("aside button")).some(
      (b) => (b.textContent ?? "").trim() === "Settings",
    ),
  );
}

/** The text of a binding row's capture field (the <button> with accessible name
 *  "Rebind {label}"), or null when not found. */
function captureFieldText(label: string): Promise<string | null> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => b.getAttribute("aria-label") === `Rebind ${l}`,
    );
    return btn ? (btn.textContent ?? "").trim() : null;
  }, label);
}

/** Activate a binding row's capture field (enter recording). */
function activateCapture(label: string): Promise<void> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => b.getAttribute("aria-label") === `Rebind ${l}`,
    ) as HTMLElement | undefined;
    btn?.click();
  }, label);
}

/** Dispatch a composed chord keydown on window (where the capture listener lives,
 *  capture phase). Carries the PHYSICAL code per macos-option-key-composes-letters. */
function dispatchKey(init: KeyboardEventInit): Promise<void> {
  return browser.execute((opts: KeyboardEventInit) => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...opts }),
    );
  }, init);
}

/** Whether the ⌘K command palette is open (its search input is mounted). */
function paletteOpen(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('input[aria-label="Search tools"]') !== null,
  );
}

/** Close any open overlay (modal/palette) with Escape, dispatched on document. */
function pressEscape(): Promise<void> {
  return browser.execute(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
    );
  });
}

function settingsModalOpen(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
  );
}

describe("Hotkeys pane (real WKWebView)", () => {
  afterEach(async () => {
    // Reset the palette chord to ⌘K + drop to the FREE baseline so the next spec
    // starts clean (the native summon chord is never rebound in this spec).
    try {
      await pressEscape();
      // Re-open the pane and Reset the Command palette binding to ⌘K.
      if (!(await settingsModalOpen())) await openHotkeysPane();
      await browser.execute(() => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        const reset = Array.from(dialog?.querySelectorAll("button") ?? []).find(
          (b) => b.getAttribute("aria-label") === "Reset Command palette to default",
        ) as HTMLElement | undefined;
        reset?.click();
      });
      await pressEscape();
      await browser.waitUntil(async () => !(await settingsModalOpen()), { timeout: 5_000 }).catch(() => {});
      await ensureFreeTier();
    } catch (cleanupError) {
      console.error("[hotkeys] cleanup failed:", cleanupError);
    }
  });

  it("renders both binding rows, opens the palette on the configured chord, reflects a rebind, and cancels capture on Escape (SET-08)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // The palette is Pro-gated (a free user's ⌘K opens the upsell) — establish Pro
    // so ⌘K opens the PALETTE, the surface SET-08 actually rebinds.
    await ensureProTier();

    // 1. Pane reachable: both binding rows render with their current chords.
    await openHotkeysPane();
    assert(await rowLabelPresent("Global summon"), "expected the Global summon binding row");
    assert(await rowLabelPresent("Command palette"), "expected the Command palette binding row");
    const defaultChord = await captureFieldText("Command palette");
    assert(
      defaultChord === "CommandOrControl+K",
      `expected the palette capture field to show the default chord, got ${JSON.stringify(defaultChord)}`,
    );
    await saveScreenshot("hotkeys", "hotkeys-pane.png", "pane");

    // Close the modal so the palette chord is dispatched against a clean shell.
    await pressEscape();
    await browser.waitUntil(async () => !(await settingsModalOpen()), { timeout: 5_000 });

    // 2. The palette opens on the configured chord (default ⌘K).
    await dispatchKey({ key: "k", code: "KeyK", metaKey: true });
    await browser.waitUntil(async () => paletteOpen(), {
      timeout: 8_000,
      timeoutMsg: "expected the default ⌘K to open the command palette (D-24-6)",
    });
    await pressEscape();
    await browser.waitUntil(async () => !(await paletteOpen()), { timeout: 5_000 });

    // 3. Rebind reflected: capture Cmd+Shift+J in the palette field.
    await openHotkeysPane();
    await activateCapture("Command palette");
    await dispatchKey({ key: "j", code: "KeyJ", metaKey: true, shiftKey: true });
    let reboundChord: string | null = null;
    await browser.waitUntil(
      async () =>
        (reboundChord = await captureFieldText("Command palette")) ===
        "CommandOrControl+Shift+J",
      {
        timeout: 5_000,
        timeoutMsg: `expected the palette capture field to update to the rebound chord, got ${JSON.stringify(reboundChord)}`,
      },
    );
    await saveScreenshot("hotkeys", "hotkeys-rebound.png", "rebound");

    // The palette now opens on the NEW chord and NO LONGER on ⌘K.
    await pressEscape();
    await browser.waitUntil(async () => !(await settingsModalOpen()), { timeout: 5_000 });
    await dispatchKey({ key: "j", code: "KeyJ", metaKey: true, shiftKey: true });
    await browser.waitUntil(async () => paletteOpen(), {
      timeout: 8_000,
      timeoutMsg: "expected the rebound Cmd+Shift+J chord to open the palette",
    });
    await pressEscape();
    await browser.waitUntil(async () => !(await paletteOpen()), { timeout: 5_000 });
    // The old ⌘K must no longer open the palette.
    await dispatchKey({ key: "k", code: "KeyK", metaKey: true });
    await browser.pause(500);
    assert(
      !(await paletteOpen()),
      "expected the old ⌘K to NO LONGER open the palette after the rebind",
    );

    // 4. Escape cancels capture: activate, press Escape, the chord is unchanged.
    await openHotkeysPane();
    const before = await captureFieldText("Command palette");
    await activateCapture("Command palette");
    await dispatchKey({ key: "Escape", code: "Escape" });
    await browser.pause(300);
    const after = await captureFieldText("Command palette");
    assert(
      after === before,
      `expected Escape to cancel capture with no chord change (was ${JSON.stringify(before)}, now ${JSON.stringify(after)})`,
    );
  });

  // SET-09 (the webview-testable half): the General pane renders its four controls,
  // and "Show license status in sidebar" gates the sidebar license/upgrade
  // affordance while the unconditional Settings gear row is unaffected (SET-04).
  // Launch-at-login / start-in-tray-no-flash / default-tool-on-open are
  // native/launch-time (RESEARCH Pitfall 6) — they ride the Task-4 human walkthrough.
  it("renders the four General controls and gates the sidebar license affordance on the show-license toggle (SET-09)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // FREE tier so the sidebar's "Unlock Pro" affordance is present (it is what
      // the show-license toggle gates). Close any pane the tier-toggle opened.
      await ensureFreeTier();
      if (await settingsModalOpen()) {
        await pressEscape();
        await browser.waitUntil(async () => !(await settingsModalOpen()), { timeout: 5_000 });
      }

      // 1. The four controls render in the General pane.
      await openGeneralPane();
      assert(await controlPresent("Launch at login"), "expected the Launch at login toggle");
      assert(
        await controlPresent("Start in the menu bar"),
        "expected the Start in the menu bar toggle",
      );
      assert(await controlPresent("Open to"), "expected the Open to default-tool label");
      assert(
        await controlPresent("Show license status in sidebar"),
        "expected the Show license status in sidebar toggle",
      );
      await saveScreenshot("hotkeys", "general-pane.png", "general pane");

      // The toggle defaults ON, and the FREE-tier sidebar affordance is present.
      assert(
        (await switchChecked("Show license status in sidebar")) === "true",
        "expected Show license status in sidebar to default ON",
      );
      assert(
        await sidebarLicenseAffordancePresent(),
        "expected the sidebar license affordance to be present at the start (FREE tier, toggle ON)",
      );
      assert(
        await sidebarSettingsRowPresent(),
        "expected the unconditional Settings row to be present initially (SET-04)",
      );

      // 2. Toggle OFF → the sidebar affordance disappears; aria-checked flips to false.
      const offChecked = await toggleSwitch("Show license status in sidebar");
      assert(
        offChecked === "false",
        `expected aria-checked false after toggling off, got ${JSON.stringify(offChecked)}`,
      );
      await browser.waitUntil(async () => !(await sidebarLicenseAffordancePresent()), {
        timeout: 5_000,
        timeoutMsg: "expected the sidebar license affordance to disappear when the toggle is OFF",
      });
      // SET-04 invariant: the bottom Settings gear row survives.
      assert(
        await sidebarSettingsRowPresent(),
        "expected the unconditional Settings row to remain when the toggle is OFF (SET-04)",
      );
      await saveScreenshot("hotkeys", "general-license-hidden.png", "license affordance hidden");

      // 3. Toggle ON → the affordance reappears; aria-checked flips back to true.
      const onChecked = await toggleSwitch("Show license status in sidebar");
      assert(
        onChecked === "true",
        `expected aria-checked true after toggling on, got ${JSON.stringify(onChecked)}`,
      );
      await browser.waitUntil(async () => sidebarLicenseAffordancePresent(), {
        timeout: 5_000,
        timeoutMsg: "expected the sidebar license affordance to reappear when the toggle is ON",
      });
      assert(
        await sidebarSettingsRowPresent(),
        "expected the unconditional Settings row to remain when the toggle is ON (SET-04)",
      );
    } finally {
      // Restore the show-license toggle to its default (ON) so no state leaks to
      // the next spec (license-walkthrough-state-pollutes-e2e). Re-open the pane if
      // a prior step closed it, then ensure the toggle reads ON.
      try {
        if (!(await settingsModalOpen())) await openGeneralPane();
        if ((await switchChecked("Show license status in sidebar")) === "false") {
          await toggleSwitch("Show license status in sidebar");
        }
        await pressEscape();
        await browser
          .waitUntil(async () => !(await settingsModalOpen()), { timeout: 5_000 })
          .catch(() => {});
      } catch (restoreError) {
        console.error("[hotkeys] show-license restore failed:", restoreError);
      }
    }
  });
});
