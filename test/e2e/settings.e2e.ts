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
//
// Open-from-sidebar / open-from-⌘K coverage lands in Plan 02 (the entry points are
// Plan 02 work); the License-pane state matrix (free/problem) lives in the
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
});
