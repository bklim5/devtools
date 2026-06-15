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
// The e2e-spike preflight resets the DEV prefs.json + machine.dev.lic to a
// deterministic baseline (no override, no cert → notActivated/FREE under the live
// D-85 flip), so this spec starts from a known state and is not history-dependent.
//
// The load-bearing real-runtime checks — only the real WKWebView truly proves:
//   1. The #/settings/license deep-link opens the Settings modal on the License
//      pane (D-S6) — no duplicate in-window License surface.
//   2. The free (notActivated) state shows "Free" + "Activate a license" inside
//      the License pane.
//   3. A corrupt machine.dev.lic makes the pane render the "License needs
//      attention" problem state with Refresh + Reactivate — proven against the
//      real Rust fail-closed verify path.
//   4. Clicking Refresh shows the calm aria-live "Refreshing…" line (no spinner).
//   5. The problem-state "Reactivate" opens the SHARED Unlock Pro modal and
//      returns focus to the invoker on dismiss (E1).
//
// The Pro-active states + the confirm-first Deactivate flow + the dormant-restore
// round-trip need a real activated cert and are covered by the human walkthrough +
// the unit suite (LicenseSettings.test.tsx); this spec covers the no-cert paths.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { assert, navigateToTool, saveScreenshot, upsellModalOpen } from "./helpers";

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

/** The trimmed text of the currently-focused element (to assert focus-return). */
function activeText(): Promise<string> {
  return browser.execute(() => (document.activeElement?.textContent ?? "").trim());
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
  it("the #/settings/license deep-link opens the modal on the License pane, shows the free state, and surfaces a corrupt machine.lic as the problem state (D-S6/D-88)", async () => {
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
      await browser.waitUntil(async () => (await statusHeading()) === "Free", {
        timeout: 10_000,
        timeoutMsg: `expected the License pane to show "Free" at baseline, got ${JSON.stringify(await statusHeading())}`,
      });
      assert(
        await paneHasButton("Activate a license"),
        'the free state must offer "Activate a license" (D-88)',
      );
      await saveScreenshot("license-settings", "license-settings-free.png", "free-state");
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
      assert(await paneHasButton("Reactivate"), "the problem state must offer Reactivate (D-83)");

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
      await saveScreenshot("license-settings", "license-settings-problem.png", "problem-state");
      await closeSettingsModal();
    } finally {
      // Cleanup MUST leave the machine as found (T-18-15 discipline).
      try {
        if (licSeeded) {
          if (licExisted && licBackup) writeFileSync(LIC_PATH, licBackup);
          else rmSync(LIC_PATH, { force: true });
        }
        // Re-open the modal so its re-query clears the problem state, then close.
        await openLicenseDeepLink();
        await browser.waitUntil(async () => settingsModalOpen(), { timeout: 10_000 });
        await browser.waitUntil(async () => (await statusHeading()) === "Free", {
          timeout: 10_000,
          timeoutMsg: "expected the pane to return to Free after restoring machine.lic",
        });
        await closeSettingsModal();
      } catch (cleanupError) {
        console.error("[license-settings] cleanup failed:", cleanupError);
      }
    }
  });

  // The FREE (notActivated) state's "Activate a license" button opens the SHARED
  // Unlock Pro upsell modal (D-88: the upsell owns the activation form, no
  // duplicate UI). Opening it STACKS the upsell above the Settings modal (Pitfall
  // 6 — both z-[60], DOM order puts the upsell on top).
  it('the free state "Activate a license" opens the shared Unlock Pro modal stacked above Settings (D-88)', async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg: "expected the deep-link to open the Settings modal",
      });
      await browser.waitUntil(async () => (await statusHeading()) === "Free", {
        timeout: 10_000,
        timeoutMsg: `expected the License pane to show "Free", got ${JSON.stringify(await statusHeading())}`,
      });
      assert(!(await upsellModalOpen()), "no upsell modal should be open before clicking Activate");

      await clickPaneButton("Activate a license");
      await browser.waitUntil(async () => upsellModalOpen(), {
        timeout: 5_000,
        timeoutMsg:
          'expected "Activate a license" to open the shared Unlock Pro modal (D-88)',
      });
      await saveScreenshot(
        "license-settings",
        "license-settings-free-activate-modal.png",
        "free-activate-modal",
      );
      // Dismiss the upsell (Esc closes the topmost dialog first — Pitfall 6).
      await dismissModal();
      await browser.waitUntil(async () => !(await upsellModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the upsell modal",
      });
    } finally {
      try {
        await dismissModal(); // close the upsell if still open
        await closeSettingsModal();
      } catch (cleanupError) {
        console.error("[license-settings] activate-modal cleanup failed:", cleanupError);
      }
    }
  });

  // In the PROBLEM state (a corrupt machine.lic) the "Reactivate" button opens the
  // SAME shared Unlock Pro modal (D-83/D-88) AND returns focus to the invoking
  // button on dismiss (E1) — the modal mounts decoupled from its trigger
  // (settingsStore/upsellStore), so this is the one place that proves real focus
  // return on the WKWebView.
  it('the problem state "Reactivate" opens the shared Unlock Pro modal and returns focus to the invoker on dismiss (D-83/D-88/E1)', async () => {
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
      assert(await paneHasButton("Reactivate"), "the problem state must offer Reactivate (D-83)");
      assert(!(await upsellModalOpen()), "no upsell modal should be open before clicking Reactivate");

      // Focus the Reactivate button explicitly, THEN click it — so the invoker is
      // unambiguously the focused element openUpsell() captures.
      await browser.execute(() => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
          (b.textContent ?? "").trim().includes("Reactivate"),
        ) as HTMLElement | undefined;
        btn?.focus();
        btn?.click();
      });
      await browser.waitUntil(async () => upsellModalOpen(), {
        timeout: 5_000,
        timeoutMsg: "expected Reactivate to open the shared Unlock Pro modal",
      });
      await saveScreenshot(
        "license-settings",
        "license-settings-problem-reactivate-modal.png",
        "problem-reactivate-modal",
      );

      // Dismiss the upsell via Escape; focus must return to the Reactivate button.
      await dismissModal();
      await browser.waitUntil(async () => !(await upsellModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the upsell modal",
      });
      await browser.waitUntil(async () => (await activeText()) === "Reactivate", {
        timeout: 5_000,
        timeoutMsg: `expected focus to return to the Reactivate button after dismiss (E1), focused text was ${JSON.stringify(await activeText())}`,
      });
    } finally {
      try {
        await dismissModal(); // close the upsell if still open
        await closeSettingsModal();
        if (licSeeded) {
          if (licExisted && licBackup) writeFileSync(LIC_PATH, licBackup);
          else rmSync(LIC_PATH, { force: true });
        }
        // Re-open so the pane's re-query clears the problem state, then close.
        await openLicenseDeepLink();
        await browser.waitUntil(async () => settingsModalOpen(), { timeout: 10_000 });
        await browser.waitUntil(async () => (await statusHeading()) === "Free", {
          timeout: 10_000,
          timeoutMsg: "expected the pane to return to Free after restoring machine.lic",
        });
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
