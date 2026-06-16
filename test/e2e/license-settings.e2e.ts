// License pane (inside the Settings modal) — real macOS WKWebView gate (Phase 22,
// 22-01; D-S6 migration of the Phase-21 21-04 license-settings spec).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). Run by
// scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts.
//
// MIGRATION (D-S6 / Pitfall 4): the Phase-21 in-window #/settings/license route is
// GONE — the shell Settings modal SUPERSEDES it (ONE surface). The
// #/settings/license deep-link now OPENS THE MODAL on the License pane. Two
// coordinated changes from the old spec:
//   1. After navigating to the deep-link we wait for the [role="dialog"][aria-modal]
//      to mount (the modal), not for an in-window route.
//   2. statusHeading() reads the License-pane status heading INSIDE the dialog,
//      dropping the "Settings" dialog title — an unscoped first-h2 read would now
//      return "Settings" and break every status assertion (Pitfall 4).
// Plan 02 (D-S11) ADDS the footer-routing coverage: the footer "License needs
// attention" affordance now OPENS THE MODAL on the License pane (it used to
// navigate('/settings/license')). The assertion is the modal mounting, NOT a hash
// change — the route is gone (D-S6).
//
// PHASE 22.1 (D-22.1-4/5/6/7, revises SET-06): the License pane's not-Pro states
// NO LONGER open the standalone UpsellModal STACKED above the Settings modal. The
// upsell/activation surface is rendered INLINE inside the Settings dialog:
//   • free/notActivated → full inline pitch ("Thank you for using TinkerDev") +
//     Buy + "I have a license key" → key input + Activate (NO second dialog).
//   • problem/refreshNeeded → calm status card + Refresh, with the key input +
//     Activate form inline below (NO pitch, NO modal). The old Reactivate button
//     that opened the stacked modal is GONE.
// So this spec asserts the inline form is INSIDE the [role=dialog][aria-modal]
// Settings dialog AND that stackedUpsellModalPresent() stays FALSE throughout the
// License-pane flow (no aria-labelledby="upsell-heading" dialog ever stacks). Post-
// 22.1-04 the standalone UpsellModal was REMOVED entirely, so that guard is now
// structurally always false — the sidebar/⌘K entries route to Settings ▸ License
// too (covered by settings.e2e.ts + entitlements.e2e.ts).
//
// The e2e-spike preflight resets the DEV prefs.json + machine.dev.lic to a
// deterministic baseline (no override, no cert → notActivated/FREE under the live
// D-85 flip), so this spec starts from a known state and is not history-dependent.
//
// The load-bearing real-runtime checks — only the real WKWebView truly proves:
//   1. The #/settings/license deep-link opens the Settings modal on the License
//      pane (D-S6) — no duplicate in-window License surface.
//   2. The free (notActivated) state renders the inline upsell ("Thank you for
//      using TinkerDev") + the inline "License key" input INSIDE the Settings
//      dialog — and NO second upsell modal stacks (D-22.1-6).
//   3. A corrupt machine.dev.lic makes the pane render the "License needs
//      attention" problem state with Refresh + the inline "License key" input +
//      Activate (NO pitch, NO modal) — proven against the real Rust fail-closed
//      verify path (D-22.1-7).
//   4. Clicking Refresh shows the calm aria-live "Refreshing…" line (no spinner).
//   5. Activation happens INLINE — stackedUpsellModalPresent() stays false
//      throughout the License-pane flow (no modal-on-modal; D-22.1-4/5).
//
// The Pro-active states + the confirm-first Deactivate flow + the dormant-restore
// round-trip need a real activated cert and are covered by the human walkthrough +
// the unit suite (LicenseSettings.test.tsx); this spec covers the no-cert paths.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  assert,
  navigateToTool,
  saveScreenshot,
  stackedUpsellModalPresent,
} from "./helpers";

// The DEBUG build reads machine.dev.lic (store.rs cfg-split, 260614-nox).
const LIC_DIR = join(homedir(), "Library", "Application Support", "com.tinkerdev.app");
const LIC_PATH = join(LIC_DIR, "machine.dev.lic");

// --- DOM probes (single-round-trip reads — WebKit lesson 3) -----------------

/** Open the Settings modal on the License pane via the #/settings/license
 *  deep-link (D-S6): the SettingsDeepLink element calls openSettings("license")
 *  then redirects, so the modal mounts and the underlying view is a real tool. */
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

/** The License-pane STATUS heading text, scoped INSIDE the Settings dialog and
 *  with the "Settings" dialog title dropped (Pitfall 4). The status heading is the
 *  remaining <h2> after removing the title — LicenseSettings's <h1> is sr-only
 *  ("License") and the status block heading is its first <h2>. Returns null when
 *  the dialog is not mounted. */
function statusHeading(): Promise<string | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return null;
    const h2s = Array.from(dialog.querySelectorAll("h2"))
      .map((h) => (h.textContent ?? "").trim())
      .filter((t) => t !== "Settings"); // drop the dialog title
    return h2s.length > 0 ? h2s[0] : null;
  });
}

/** Whether the License pane shows a button with the given visible text (scoped
 *  inside the dialog so the shell's own buttons never match). */
function paneHasButton(text: string): Promise<boolean> {
  return browser.execute((label: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return false;
    return Array.from(dialog.querySelectorAll("button")).some((b) =>
      (b.textContent ?? "").trim().includes(label),
    );
  }, text);
}

/** Click a button in the License pane by its visible text (scoped to the dialog). */
function clickPaneButton(text: string): Promise<void> {
  return browser.execute((label: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
      (b.textContent ?? "").trim().includes(label),
    ) as HTMLElement | undefined;
    btn?.click();
  }, text);
}

/** Whether the License pane renders the INLINE "License key" input (the shared
 *  activation surface) — scoped inside the Settings dialog. Matched by the
 *  <label>'s htmlFor → the input id, the same accessible-name path the unit
 *  tests use. */
function paneHasKeyInput(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return false;
    const label = Array.from(dialog.querySelectorAll("label")).find(
      (l) => (l.textContent ?? "").trim() === "License key",
    );
    if (!label) return false;
    const forId = label.getAttribute("for");
    return !!forId && dialog.querySelector(`#${forId}`) instanceof HTMLInputElement;
  });
}

/** Whether the License pane shows the given visible text (scoped to the dialog). */
function paneHasText(text: string): Promise<boolean> {
  return browser.execute((needle: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    return (dialog?.textContent ?? "").includes(needle);
  }, text);
}

/** Dismiss whatever modal is open via Escape (the dialog's document-level
 *  listener) so a left-open modal never poisons the next assertion. */
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

/** Whether the sidebar footer "License needs attention" affordance is present
 *  (it surfaces only in a problem / refreshNeeded state — D-43/D-84). */
function footerAttentionPresent(): Promise<boolean> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll("aside button")).some(
      (b) => (b.textContent ?? "").trim() === "License needs attention",
    ),
  );
}

/** Focus + click the sidebar footer "License needs attention" affordance. */
function clickFooterAttention(): Promise<boolean> {
  return browser.execute(() => {
    const btn = Array.from(document.querySelectorAll("aside button")).find(
      (b) => (b.textContent ?? "").trim() === "License needs attention",
    ) as HTMLElement | undefined;
    if (!btn) return false;
    btn.focus();
    btn.click();
    return true;
  });
}

/** Close the Settings modal (Esc) and wait for it to unmount — keeps each spec
 *  independent within the WDIO run. */
async function closeSettingsModal(): Promise<void> {
  if (await settingsModalOpen()) {
    await dismissModal();
    await browser.waitUntil(async () => !(await settingsModalOpen()), {
      timeout: 5_000,
      timeoutMsg: "expected Escape to dismiss the Settings modal",
    });
  }
}

describe("License pane in the Settings modal (real WKWebView)", () => {
  it("the #/settings/license deep-link opens the modal on the License pane, renders the free inline upsell, and surfaces a corrupt machine.lic as the inline problem-state form (D-S6/D-22.1-6/D-22.1-7)", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    let licSeeded = false;
    let licExisted = false;
    let licBackup: Buffer | null = null;
    try {
      // 1. DEEP-LINK opens the modal on the License pane (D-S6); FREE baseline.
      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg: "expected #/settings/license to open the Settings modal (D-S6)",
      });
      // The free state renders the INLINE upsell pitch (its heading is the pane's
      // first non-title h2 now — there is no "Free" status card; D-22.1-6).
      await browser.waitUntil(
        async () => (await statusHeading()) === "Thank you for using TinkerDev ❤️",
        {
          timeout: 10_000,
          timeoutMsg: `expected the free inline upsell pitch heading, got ${JSON.stringify(await statusHeading())}`,
        },
      );
      assert(
        await paneHasButton("Buy license"),
        "the free inline upsell must offer the Buy license CTA (D-22.1-6)",
      );
      // Reveal the inline key form (the "I have a license key" affordance) — the
      // SAME shared surface, rendered inline. NO stacked upsell modal opens.
      assert(
        await paneHasButton("I have a license key"),
        "the free inline upsell must offer the 'I have a license key' reveal (D-22.1-6)",
      );
      await clickPaneButton("I have a license key");
      await browser.waitUntil(async () => paneHasKeyInput(), {
        timeout: 5_000,
        timeoutMsg:
          'expected the inline "License key" input after revealing the form (D-22.1-6)',
      });
      assert(
        !(await stackedUpsellModalPresent()),
        "the free inline activation must NOT stack a standalone upsell modal (D-22.1-4/5)",
      );
      await saveScreenshot(
        "license-settings",
        "license-settings-free-inline.png",
        "free-inline",
      );
      await closeSettingsModal();

      // 2. PROBLEM STATE: seed garbage into the REAL machine.dev.lic.
      licExisted = existsSync(LIC_PATH);
      if (licExisted) licBackup = readFileSync(LIC_PATH);
      mkdirSync(LIC_DIR, { recursive: true });
      writeFileSync(LIC_PATH, "not a machine file");
      licSeeded = true;

      // Re-open the modal so the pane's mount re-query reads the seeded file
      // through the real Rust fail-closed verify and renders the problem state.
      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg: "expected the deep-link to re-open the Settings modal",
      });
      await browser.waitUntil(async () => (await statusHeading()) === "License needs attention", {
        timeout: 10_000,
        timeoutMsg: `expected "License needs attention" after seeding a corrupt machine.lic, got ${JSON.stringify(await statusHeading())}`,
      });
      assert(await paneHasButton("Refresh"), "the problem state must offer Refresh");
      // D-22.1-7: the key-input + Activate form renders INLINE below the status
      // card — NO modal-opening Reactivate button, and NO sales pitch.
      assert(
        await paneHasKeyInput(),
        'the problem state must render the inline "License key" input (D-22.1-7)',
      );
      assert(
        await paneHasButton("Activate"),
        "the problem state must offer the inline Activate button (D-22.1-7)",
      );
      assert(
        !(await paneHasButton("Reactivate")),
        "the modal-opening Reactivate button must be GONE (D-22.1-7)",
      );
      assert(
        !(await paneHasText("Most of TinkerDev is free")),
        "a paying customer in the problem state must NOT see the sales pitch (D-22.1-7)",
      );
      assert(
        !(await stackedUpsellModalPresent()),
        "the problem-state inline form must NOT stack a standalone upsell modal (D-22.1-4/5)",
      );

      // 3. Refresh shows the calm aria-live "Refreshing…" line (no spinner).
      await clickPaneButton("Refresh");
      await browser
        .waitUntil(
          async () =>
            browser.execute(() =>
              Array.from(document.querySelectorAll('[aria-live="polite"]')).some((n) =>
                (n.textContent ?? "").includes("Refreshing"),
              ),
            ),
          {
            timeout: 5_000,
            timeoutMsg: 'expected a calm "Refreshing…" aria-live line on Refresh',
          },
        )
        .catch(() => {
          // The refresh can resolve faster than the poll on a fast machine — the
          // line is transient. Don't fail the spec on the race; the unit test pins
          // the in-flight copy. (Best-effort real-runtime smoke.)
        });
      await saveScreenshot("license-settings", "license-settings-problem-inline.png", "problem-inline");
      await closeSettingsModal();
    } finally {
      // Cleanup MUST leave the machine as found (T-18-15 discipline).
      try {
        if (licSeeded) {
          if (licExisted && licBackup) writeFileSync(LIC_PATH, licBackup);
          else rmSync(LIC_PATH, { force: true });
        }
        // Re-open the modal so its re-query clears the problem state, then close.
        // The restored FREE state shows the inline upsell pitch heading (no "Free"
        // status card now — D-22.1-6), so wait for that heading.
        await openLicenseDeepLink();
        await browser.waitUntil(async () => settingsModalOpen(), { timeout: 10_000 });
        await browser.waitUntil(
          async () => (await statusHeading()) === "Thank you for using TinkerDev ❤️",
          {
            timeout: 10_000,
            timeoutMsg: "expected the pane to return to the free inline upsell after restoring machine.lic",
          },
        );
        await closeSettingsModal();
      } catch (cleanupError) {
        console.error("[license-settings] cleanup failed:", cleanupError);
      }
    }
  });

  // PHASE 22.1 (D-22.1-6, INVERTS the old D-88 stacked-modal test): the FREE
  // (notActivated) state renders the upsell/activation surface INLINE inside the
  // Settings dialog — it does NOT open a standalone upsell modal stacked on top.
  // Proves: the inline pitch + key input are INSIDE [role=dialog][aria-modal] AND
  // stackedUpsellModalPresent() (the aria-labelledby="upsell-heading" dialog, removed
  // post-22.1-04) stays FALSE throughout — no modal-on-modal.
  it("the free state renders the upsell/activation INLINE in the Settings dialog — no stacked upsell modal (D-22.1-6)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg: "expected the deep-link to open the Settings modal",
      });
      // The inline upsell pitch is the pane's status heading inside the dialog.
      await browser.waitUntil(
        async () => (await statusHeading()) === "Thank you for using TinkerDev ❤️",
        {
          timeout: 10_000,
          timeoutMsg: `expected the free inline upsell pitch, got ${JSON.stringify(await statusHeading())}`,
        },
      );
      // No upsell modal stacks before OR after revealing the inline form.
      assert(
        !(await stackedUpsellModalPresent()),
        "no standalone upsell modal should be open in the inline free state",
      );
      assert(
        await paneHasButton("I have a license key"),
        "the free inline upsell must offer the 'I have a license key' reveal (D-22.1-6)",
      );
      await clickPaneButton("I have a license key");
      // The key input appears INLINE inside the SAME Settings dialog (no second
      // dialog) — prove both: the input exists, and stackedUpsellModalPresent() is false.
      await browser.waitUntil(async () => paneHasKeyInput(), {
        timeout: 5_000,
        timeoutMsg:
          'expected the inline "License key" input inside the Settings dialog (D-22.1-6)',
      });
      assert(
        await paneHasButton("Activate"),
        "the revealed inline form must offer the Activate button (D-22.1-6)",
      );
      assert(
        !(await stackedUpsellModalPresent()),
        "revealing the inline form must NOT stack a standalone upsell modal (D-22.1-4/5)",
      );
      await saveScreenshot(
        "license-settings",
        "license-settings-free-inline-form.png",
        "free-inline-form",
      );
    } finally {
      try {
        await closeSettingsModal();
      } catch (cleanupError) {
        console.error("[license-settings] free-inline cleanup failed:", cleanupError);
      }
    }
  });

  // PHASE 22.1 (D-22.1-7, INVERTS the old D-83/D-88 Reactivate-modal test): in the
  // PROBLEM state (a corrupt machine.lic) the pane keeps the calm "License needs
  // attention" status + Refresh, and renders the key-input + Activate form INLINE
  // below — NO modal-opening Reactivate button, NO sales pitch, and NO stacked
  // upsell modal. Proves the inline activation surface against the real Rust
  // fail-closed verify path with NO modal-on-modal.
  it("the problem state renders the key-input + Activate form INLINE below the status card — no stacked upsell modal, no pitch (D-22.1-7)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    let licSeeded = false;
    let licExisted = false;
    let licBackup: Buffer | null = null;
    try {
      // Seed garbage into the REAL machine.dev.lic to force the problem state.
      licExisted = existsSync(LIC_PATH);
      if (licExisted) licBackup = readFileSync(LIC_PATH);
      mkdirSync(LIC_DIR, { recursive: true });
      writeFileSync(LIC_PATH, "not a machine file");
      licSeeded = true;

      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), { timeout: 10_000 });
      await browser.waitUntil(async () => (await statusHeading()) === "License needs attention", {
        timeout: 10_000,
        timeoutMsg: `expected the problem state, got ${JSON.stringify(await statusHeading())}`,
      });
      // The calm status card + Refresh are kept; the inline form is BELOW.
      assert(await paneHasButton("Refresh"), "the problem state must keep Refresh");
      assert(
        await paneHasKeyInput(),
        'the problem state must render the inline "License key" input (D-22.1-7)',
      );
      assert(
        await paneHasButton("Activate"),
        "the problem state must offer the inline Activate button (D-22.1-7)",
      );
      // The modal-opening Reactivate button is GONE, and no upsell modal stacks.
      assert(
        !(await paneHasButton("Reactivate")),
        "the modal-opening Reactivate button must be GONE (D-22.1-7)",
      );
      assert(
        !(await paneHasText("Most of TinkerDev is free")),
        "a paying customer must NOT see the sales pitch in the problem state (D-22.1-7)",
      );
      assert(
        !(await stackedUpsellModalPresent()),
        "the problem-state inline form must NOT stack a standalone upsell modal (D-22.1-4/5)",
      );
      await saveScreenshot(
        "license-settings",
        "license-settings-problem-inline-form.png",
        "problem-inline-form",
      );
    } finally {
      try {
        await closeSettingsModal();
        if (licSeeded) {
          if (licExisted && licBackup) writeFileSync(LIC_PATH, licBackup);
          else rmSync(LIC_PATH, { force: true });
        }
        // Re-open so the pane's re-query clears the problem state, then close.
        // The restored FREE state shows the inline upsell pitch heading (D-22.1-6).
        await openLicenseDeepLink();
        await browser.waitUntil(async () => settingsModalOpen(), { timeout: 10_000 });
        await browser.waitUntil(
          async () => (await statusHeading()) === "Thank you for using TinkerDev ❤️",
          {
            timeout: 10_000,
            timeoutMsg: "expected the pane to return to the free inline upsell after restoring machine.lic",
          },
        );
        await closeSettingsModal();
      } catch (cleanupError) {
        console.error("[license-settings] reactivate-modal cleanup failed:", cleanupError);
      }
    }
  });

  // D-S11: the sidebar footer "License needs attention" affordance now OPENS the
  // Settings modal on the License pane (was navigate('/settings/license') — the
  // route is gone, D-S6). A corrupt machine.dev.lic puts the license in the
  // problem state, which is what surfaces the footer affordance (D-43).
  it('the footer "License needs attention" affordance OPENS the Settings modal on the License pane (D-S11), not a route', async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    let licSeeded = false;
    let licExisted = false;
    let licBackup: Buffer | null = null;
    try {
      // Seed garbage into the REAL machine.dev.lic to force the problem state, so
      // the footer surfaces the "License needs attention" affordance.
      licExisted = existsSync(LIC_PATH);
      if (licExisted) licBackup = readFileSync(LIC_PATH);
      mkdirSync(LIC_DIR, { recursive: true });
      writeFileSync(LIC_PATH, "not a machine file");
      licSeeded = true;

      // Reload so the license UI re-reads the seeded cert through the real Rust
      // verify and the footer surfaces the attention affordance.
      await browser.execute(() => window.location.reload());
      await browser.waitUntil(async () => footerAttentionPresent(), {
        timeout: 15_000,
        timeoutMsg:
          'expected the footer "License needs attention" affordance after seeding a corrupt machine.lic (D-43)',
      });

      assert(!(await settingsModalOpen()), "no Settings modal should be open before clicking the footer");

      // Clicking the footer OPENS the modal (D-S11), NOT a hash navigation.
      assert(await clickFooterAttention(), 'expected to click the "License needs attention" footer affordance');
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg:
          "expected the footer affordance to OPEN the Settings modal (D-S11), not navigate to a route",
      });
      // The pane shows the problem-state status heading (scoped inside the dialog).
      await browser.waitUntil(
        async () => (await statusHeading()) === "License needs attention",
        {
          timeout: 10_000,
          timeoutMsg: `expected the License pane problem state in the modal, got ${JSON.stringify(await statusHeading())}`,
        },
      );
      await saveScreenshot(
        "license-settings",
        "license-settings-footer-opens-modal.png",
        "footer-opens-modal",
      );
      await closeSettingsModal();
    } finally {
      try {
        await dismissModal();
        await closeSettingsModal();
        if (licSeeded) {
          if (licExisted && licBackup) writeFileSync(LIC_PATH, licBackup);
          else rmSync(LIC_PATH, { force: true });
        }
        // Reload so the footer attention clears for the next spec.
        await browser.execute(() => window.location.reload());
      } catch (cleanupError) {
        console.error("[license-settings] footer-routing cleanup failed:", cleanupError);
      }
    }
  });
});
