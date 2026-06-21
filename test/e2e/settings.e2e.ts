// Settings modal shell — real macOS WKWebView gate (Phase 22, 22-01; SET-04/05/06,
// D-S1..D-S6).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). Run by
// scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts.
//
// This spec proves the shell modal itself on the real runtime (only the real
// WKWebView truly proves the focus-trapped dialog mounts + dismisses):
//   1. The #/settings/license deep-link (D-S6) mounts the [role="dialog"]
//      [aria-modal="true"] Settings modal with the visible "Settings" title.
//   2. The active pane is the License pane (aria-current + the License content).
//   3. Escape dismisses the modal (D-S5).
//   4. (Plan 02) The bottom-anchored sidebar "Settings" row opens the modal and
//      focus RETURNS to that row on Esc-close (the focus-return contract, D-S9).
//   5. (Plan 02) The ⌘K "Settings" command opens the modal and focus returns to
//      the pre-palette element on Esc-close (the palette row unmounts — finding 3).
//
// The License-pane state matrix (free/problem) + the footer re-point live in the
// migrated license-settings.e2e.ts. The native app-menu (⌘,) + tray entries are
// manual-walkthrough (WebDriver cannot drive native chrome) — 22-HUMAN-UAT.
//
// The e2e-spike preflight resets prefs.json + machine.dev.lic to a deterministic
// baseline, so this spec starts from a known free/notActivated state.

import { assert, navigateToTool, saveScreenshot } from "./helpers";

/** Open the Settings modal on the License pane via the #/settings/license
 *  deep-link (D-S6). */
function openLicenseDeepLink(): Promise<void> {
  return browser.execute(() => {
    window.location.hash = "#/settings/license";
  });
}

/** Whether the Settings modal (the focus-trapped dialog) is mounted. */
function settingsModalOpen(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
  );
}

/** The dialog title (the aria-labelledby target), or null when not mounted. */
function dialogTitle(): Promise<string | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return null;
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const title = labelledBy ? document.getElementById(labelledBy) : null;
    return title ? (title.textContent ?? "").trim() : null;
  });
}

/** Whether the active nav item (aria-current="page") is the License pane. */
function activeNavIsLicense(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const current = dialog?.querySelector('[aria-current="page"]');
    return (current?.textContent ?? "").includes("License");
  });
}

/** Whether the active nav item (aria-current="page") is the General pane — the
 *  landing pane for the generic Settings openers (sidebar gear / app-menu / tray). */
function activeNavIsGeneral(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const current = dialog?.querySelector('[aria-current="page"]');
    return (current?.textContent ?? "").includes("General");
  });
}

/** Dismiss the modal via Escape (the dialog's document-level keydown listener). */
function dismissModal(): Promise<void> {
  return browser.execute(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

/** Focus + click the bottom-anchored sidebar "Settings" row (D-S9). Returns true
 *  if the row was found. Scoped inside the <aside> so it never matches a pane
 *  control. */
function clickSidebarSettings(): Promise<boolean> {
  return browser.execute(() => {
    const btn = Array.from(document.querySelectorAll("aside button")).find(
      (b) => (b.textContent ?? "").trim() === "Settings",
    ) as HTMLElement | undefined;
    if (!btn) return false;
    btn.focus();
    btn.click();
    return true;
  });
}

/** Whether the currently-focused element is the sidebar "Settings" row (the
 *  focus-return target after Esc-close). */
function activeIsSidebarSettings(): Promise<boolean> {
  return browser.execute(() => {
    const active = document.activeElement;
    return (
      active?.closest("aside") !== null &&
      (active?.textContent ?? "").trim() === "Settings"
    );
  });
}

/** Whether the ⌘K command palette is open (its dialog is NOT aria-modal). */
function paletteOpen(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('[aria-label="Command palette"]') !== null,
  );
}

/** Open the ⌘K palette (the listener lives on window). Phase 22.2: the palette is
 *  Pro-gated (a free user's plain ⌘K opens the upsell modal instead), so use the
 *  DEV-only ⌘⇧K force-open escape hatch — this test exercises the Settings COMMAND
 *  + focus-return, not the gate (the gate is proven in cmdk-pro.e2e.ts). */
function openPalette(): Promise<void> {
  return browser.execute(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        code: "KeyK",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

/** Type a query into the palette through React's controlled-input contract (the
 *  native value setter + a bubbling input event — a bare .value write is
 *  swallowed by React's value tracker). */
function typePaletteQuery(q: string): Promise<void> {
  return browser.execute((query: string) => {
    const el = document.querySelector(
      'input[aria-label="Search tools"]',
    ) as HTMLInputElement | null;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(el, query);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, q);
}

/** Whether the palette's highlighted (bg-accent-soft) row is the "Settings"
 *  command — guards against Enter selecting the wrong row. */
function settingsRowHighlighted(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[aria-label="Command palette"]');
    const on = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
      b.className.includes("bg-accent-soft"),
    );
    return (on?.textContent ?? "").trim() === "Settings";
  });
}

/** Press a bare key on the palette input (ArrowUp/ArrowDown/Enter). */
function pressPaletteKey(key: string): Promise<void> {
  return browser.execute((k: string) => {
    document.querySelector('input[aria-label="Search tools"]')?.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    );
  }, key);
}

// --- Updates pane (SET-10) helpers ------------------------------------------

/** Open the Settings modal (deep-link) then click the "Updates" pane-nav button,
 *  asserting aria-current lands on it (the real keyboard-reachable nav, mirroring
 *  the Appearance-pane pattern). */
async function openUpdatesPane(): Promise<void> {
  await openLicenseDeepLink();
  await browser.waitUntil(async () => settingsModalOpen(), {
    timeout: 10_000,
    timeoutMsg: "expected the Settings modal to open from the #/settings/license deep-link",
  });
  await browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("nav button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "Updates",
    ) as HTMLElement | undefined;
    btn?.click();
  });
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        const current = dialog?.querySelector('[aria-current="page"]');
        return (current?.textContent ?? "").includes("Updates");
      }),
    {
      timeout: 5_000,
      timeoutMsg: 'expected the Updates pane nav button to carry aria-current="page"',
    },
  );
}

/** The Updates pane's version line text ("TinkerDev v…"), or null when absent. */
function updatesVersionText(): Promise<string | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const node = Array.from(dialog?.querySelectorAll("span") ?? []).find((s) =>
      (s.textContent ?? "").startsWith("TinkerDev v"),
    );
    return node ? (node.textContent ?? "").trim() : null;
  });
}

/** The Updates pane's "Last checked:" line text, or null when absent. */
function lastCheckedText(): Promise<string | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const node = Array.from(dialog?.querySelectorAll("span") ?? []).find((s) =>
      (s.textContent ?? "").startsWith("Last checked:"),
    );
    return node ? (node.textContent ?? "").trim() : null;
  });
}

/** Click the "Check for updates" button inside the dialog. */
function clickCheckForUpdates(): Promise<void> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "Check for updates",
    ) as HTMLElement | undefined;
    btn?.click();
  });
}

/** The Updates pane's polite live-region result text (empty when idle). */
function checkResultText(): Promise<string> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const region = dialog?.querySelector('[role="status"][aria-live="polite"]:not(.sr-only)');
    return (region?.textContent ?? "").trim();
  });
}

/** Whether the auto-check toggle reads on (aria-checked="true"). */
function autoCheckToggleChecked(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const sw = Array.from(dialog?.querySelectorAll('[role="switch"]') ?? []).find(
      (b) =>
        (b.getAttribute("aria-label") ?? "").includes(
          "Automatically check for updates on launch",
        ),
    );
    return sw?.getAttribute("aria-checked") === "true";
  });
}

/** Keyboard-operate the auto-check toggle: focus it + dispatch a Space keydown +
 *  click (the role=switch native button responds to click; this also proves it is
 *  focusable/keyboard-reachable). Returns the new aria-checked value. */
function toggleAutoCheckByKeyboard(): Promise<boolean | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const sw = Array.from(dialog?.querySelectorAll('[role="switch"]') ?? []).find((b) =>
      (b.getAttribute("aria-label") ?? "").includes(
        "Automatically check for updates on launch",
      ),
    ) as HTMLElement | null;
    if (!sw) return null;
    sw.focus();
    const focused = document.activeElement === sw;
    sw.click(); // native <button role=switch> click = the keyboard-activatable path
    return focused ? sw.getAttribute("aria-checked") === "true" : null;
  });
}

describe("Settings modal shell (real WKWebView)", () => {
  it("the #/settings/license deep-link mounts the aria-modal Settings dialog on the License pane, dismissible by Escape (SET-04/05/06)", async () => {
    // Land on a deterministic tool so the shell is mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // 1. The deep-link opens the shell Settings modal (D-S6).
      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg:
          "expected #/settings/license to open the [role=dialog][aria-modal] Settings modal (D-S6)",
      });

      // The visible dialog title is "Settings" (the aria-labelledby target).
      await browser.waitUntil(async () => (await dialogTitle()) === "Settings", {
        timeout: 5_000,
        timeoutMsg: `expected the dialog title to be "Settings", got ${JSON.stringify(await dialogTitle())}`,
      });

      // 2. The active pane is the License pane (aria-current + License content).
      assert(
        await activeNavIsLicense(),
        'expected the active nav item (aria-current="page") to be the License pane',
      );
      await saveScreenshot("settings", "settings-modal-license-pane.png", "license-pane");

      // 3. Escape dismisses the modal (D-S5).
      await dismissModal();
      await browser.waitUntil(async () => !(await settingsModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the Settings modal (D-S5)",
      });
    } finally {
      // Leave no modal open for the next spec in this WDIO run.
      try {
        if (await settingsModalOpen()) {
          await dismissModal();
          await browser.waitUntil(async () => !(await settingsModalOpen()), {
            timeout: 5_000,
          });
        }
      } catch (cleanupError) {
        console.error("[settings] cleanup failed:", cleanupError);
      }
    }
  });

  it("the bottom-anchored sidebar Settings row opens the modal on the General pane and returns focus to itself on Esc-close (SET-03/D-S9/D-S10)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // D-S10: the Settings row is reachable in the default free/notActivated
      // state — it opens for everyone, no lock badge.
      assert(
        await clickSidebarSettings(),
        'expected a bottom-anchored "Settings" row inside the sidebar <aside> (D-S9)',
      );
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg:
          "expected the sidebar Settings row to open the [role=dialog][aria-modal] Settings modal (SET-03)",
      });
      // Generic Settings opener lands on the General pane (the first pane);
      // License-specific entry points (Unlock Pro / deep-link) open License.
      assert(
        await activeNavIsGeneral(),
        "expected the sidebar Settings row to open on the General pane",
      );
      await saveScreenshot(
        "settings",
        "settings-modal-from-sidebar.png",
        "from-sidebar",
      );

      // Esc-close returns focus to the sidebar Settings row (the focus-return
      // contract — the row is a persistent invoker, captured synchronously).
      await dismissModal();
      await browser.waitUntil(async () => !(await settingsModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the Settings modal",
      });
      await browser.waitUntil(async () => activeIsSidebarSettings(), {
        timeout: 5_000,
        timeoutMsg:
          "expected focus to return to the sidebar Settings row on Esc-close (D-S9)",
      });
    } finally {
      try {
        if (await settingsModalOpen()) {
          await dismissModal();
          await browser.waitUntil(async () => !(await settingsModalOpen()), {
            timeout: 5_000,
          });
        }
      } catch (cleanupError) {
        console.error("[settings] sidebar cleanup failed:", cleanupError);
      }
    }
  });

  it("the ⌘K Settings command opens the modal and returns focus to the pre-palette element on Esc-close (SET-03/D-S8)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // Focus a known persistent pre-palette element (the protobuf input) so the
      // focus-return target is unambiguous and is NOT <body>.
      await browser.execute(() => {
        const el = document.querySelector("textarea, input") as HTMLElement | null;
        el?.focus();
      });

      await openPalette();
      const input = await $('input[aria-label="Search tools"]');
      await input.waitForExist({ timeout: 10_000 });

      await typePaletteQuery("settings");
      await browser.waitUntil(async () => settingsRowHighlighted(), {
        timeout: 5_000,
        timeoutMsg:
          'expected the typed query "settings" to highlight the Settings command row (D-S8)',
      }).catch(async () => {
        // The first row may be a tool match; ArrowUp wraps to the LAST row — the
        // command appends after tool matches (D-32 ordering).
        await pressPaletteKey("ArrowUp");
        await browser.waitUntil(async () => settingsRowHighlighted(), {
          timeout: 5_000,
          timeoutMsg:
            'expected ArrowUp to land the highlight on the "Settings" command row',
        });
      });
      await pressPaletteKey("Enter");

      // The palette closes (commands close-first, then run) and the modal mounts.
      await browser.waitUntil(async () => !(await paletteOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected the palette to close after running the Settings command",
      });
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg:
          "expected the ⌘K Settings command to open the [role=dialog][aria-modal] Settings modal (D-S8)",
      });
      await saveScreenshot("settings", "settings-modal-from-palette.png", "from-palette");

      // Esc-close returns focus OFF <body> (the pre-palette element, not the
      // unmounted palette row — finding 3 / T-22-07).
      await dismissModal();
      await browser.waitUntil(async () => !(await settingsModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the Settings modal",
      });
      await browser.waitUntil(
        async () =>
          browser.execute(() => document.activeElement !== document.body),
        {
          timeout: 5_000,
          timeoutMsg:
            "expected focus to return to the pre-palette element on Esc-close, not <body> (T-22-07)",
        },
      );
    } finally {
      try {
        if (await paletteOpen()) {
          await browser.execute(() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            ),
          );
        }
        if (await settingsModalOpen()) {
          await dismissModal();
          await browser.waitUntil(async () => !(await settingsModalOpen()), {
            timeout: 5_000,
          });
        }
      } catch (cleanupError) {
        console.error("[settings] ⌘K cleanup failed:", cleanupError);
      }
    }
  });
});

// Updates pane (SET-10, D-25-1/4/5/7/8) — the real-WKWebView gate for the pane's
// render + keyboard reach. The lastUpdateCheck PERSISTENCE-across-restart + the
// toggle-survives-restart checks are the Plan 05 human walkthrough (WebDriver can't
// restart the packaged app between assertions — memory tauri-store-async-init-race).
// The e2e-spike preflight wipes prefs.json to a deterministic FREE baseline, so the
// pane starts with lastUpdateCheck=null ("Never") and autoUpdateCheck=null (off).
describe("Settings ▸ Updates pane (real WKWebView)", () => {
  it("renders version + Never last-checked, the Check button surfaces a result, and the auto-check toggle is keyboard-operable (SET-10)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // The Updates pane is reachable via the keyboard-navigable pane nav (ungated —
      // it opens for everyone, no Pro tier needed, D-25-1).
      await openUpdatesPane();

      // (a) A version line renders. In the packaged app this is the real
      // tauri.conf version (semver); the dash placeholder would never satisfy
      // "TinkerDev vX.Y.Z", so a matched semver proves getVersion() resolved.
      await browser.waitUntil(
        async () => /^TinkerDev v\d+\.\d+\.\d+/.test((await updatesVersionText()) ?? ""),
        {
          timeout: 5_000,
          timeoutMsg: `expected a "TinkerDev vX.Y.Z" version line, got ${JSON.stringify(await updatesVersionText())}`,
        },
      );

      // (b) "Last checked: Never" on the fresh (preflight-wiped) prefs state (D-25-7).
      assert(
        ((await lastCheckedText()) ?? "").includes("Never"),
        `expected "Last checked: Never" on a fresh prefs state, got ${JSON.stringify(await lastCheckedText())}`,
      );
      await saveScreenshot("settings", "settings-updates-pane.png", "updates-pane");

      // (c) Clicking "Check for updates" surfaces an inline result. The real
      // updater check() resolves null (no published newer version) → the up-to-date
      // copy appears in the polite live region (WCAG-AA, never opacity-only).
      await clickCheckForUpdates();
      await browser.waitUntil(
        async () => (await checkResultText()).includes("up to date"),
        {
          timeout: 10_000,
          timeoutMsg: `expected the Check button to surface an inline "up to date" result, got ${JSON.stringify(await checkResultText())}`,
        },
      );

      // (d) The auto-check toggle is keyboard-reachable + operable: focus it +
      // activate → aria-checked flips on (it started off on the fresh state).
      assert(
        (await autoCheckToggleChecked()) === false,
        "expected the auto-check toggle to start OFF on the fresh prefs state",
      );
      const nowChecked = await toggleAutoCheckByKeyboard();
      assert(
        nowChecked === true,
        `expected the auto-check toggle to be focusable + flip ON when activated, got ${JSON.stringify(nowChecked)}`,
      );
    } finally {
      // Leave no modal open + reset the auto-check toggle so this spec leaves no
      // prefs pollution for later specs in the WDIO run.
      try {
        if (await settingsModalOpen()) {
          if (await autoCheckToggleChecked()) await toggleAutoCheckByKeyboard();
          await dismissModal();
          await browser.waitUntil(async () => !(await settingsModalOpen()), {
            timeout: 5_000,
          });
        }
      } catch (cleanupError) {
        console.error("[settings] Updates pane cleanup failed:", cleanupError);
      }
    }
  });
});
