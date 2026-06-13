// Buy-license wiring — real macOS WKWebView gate (Phase 20, 20-01; PAY-01, D-67/
// D-68, threat T-20-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// entitlements.e2e.ts. Run by scripts/e2e-spike.sh; auto-discovered by
// wdio.conf.ts `specs: ["./test/e2e/*.e2e.ts"]`.
//
// What this proves on the real runtime — and what it deliberately does NOT:
//   - PROVES: clicking the shared upsell panel's "Buy license" CTA reaches the
//     code path WITHOUT navigating the in-app document. The HashRouter route
//     (window.location.hash) is unchanged, the upsell modal stays mounted, and
//     nothing throws — the negative contract that the Buy click is a hand-off,
//     never an in-page navigation (T-20-01: no open-redirect of the app itself).
//   - DOES NOT (cannot) PROVE: that the OS default browser actually opened
//     https://tinkerdev.io/buy. The native browser-open is NON-OBSERVABLE inside
//     WebDriver (HARNESS native-input note: WebDriver cannot synthesize/observe
//     OS-level handoffs). The actual browser-open is a MANUAL walkthrough item
//     at the Phase 20 human-verify gate (per 20-VALIDATION "Manual-Only
//     Verifications"). The unit suite (UpsellPanel.test.tsx) pins the positive
//     contract: openUrl is called once with the exact https URL.
//
// Reaching the Buy CTA: in-Tauri the entitlements default is FULL (everything
// unlocked) until Phase 21 flips it, so the free-tier "Unlock Pro" footer — the
// only standing affordance that opens the shared upsell modal — is hidden. The
// spec toggles to the FREE tier via the ⌘K DEV command (the same real-user path
// entitlements.e2e.ts uses), opens the modal from the footer row, exercises the
// Buy CTA, then toggles back to FULL (T-18-15 cleanup) so it leaves no "free"
// override behind on the dev machine for later specs in the same WDIO run.

import { assert, runDevToggle, saveScreenshot } from "./helpers";

// Whether the free-tier footer "Unlock Pro" row is rendered (the stable
// free-vs-full tier probe — present in free tier only; D-29).
function unlockProFooterPresent(): Promise<boolean> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll("aside button")).some((b) =>
      (b.textContent ?? "").includes("Unlock Pro"),
    ),
  );
}

// Whether the shared upsell modal is open — the [role="dialog"] carrying the
// UI-SPEC thank-you copy (distinguished from the ⌘K palette dialog by heading).
function upsellModalOpen(): Promise<boolean> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll('[role="dialog"]')).some((d) =>
      (d.textContent ?? "").includes("Thank you for using TinkerDev"),
    ),
  );
}

// Whether the "Buy license" button exists inside the open upsell dialog.
function buyButtonPresent(): Promise<boolean> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll('[role="dialog"] button')).some(
      (b) => (b.textContent ?? "").trim() === "Buy license",
    ),
  );
}

// Click the "Buy license" button inside the open dialog (by accessible name).
function clickBuy(): Promise<boolean> {
  return browser.execute(() => {
    const buy = Array.from(
      document.querySelectorAll('[role="dialog"] button'),
    ).find((b) => (b.textContent ?? "").trim() === "Buy license") as
      | HTMLButtonElement
      | null;
    buy?.click();
    return buy !== null;
  });
}

function currentHash(): Promise<string> {
  return browser.execute(() => window.location.hash);
}

describe("Buy-license wiring (real WKWebView)", () => {
  it("the Buy CTA reaches the opener seam without navigating the in-app route", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // BASELINE: in-Tauri default is FULL — toggle to FREE so the "Unlock Pro"
    // footer (which opens the shared upsell modal) is present.
    if (!(await unlockProFooterPresent())) {
      await runDevToggle();
      await browser.waitUntil(async () => unlockProFooterPresent(), {
        timeout: 10_000,
        timeoutMsg:
          'expected the free-tier "Unlock Pro" footer row after the dev toggle (D-29)',
      });
    }

    try {
      // Open the shared upsell modal from the footer "Unlock Pro" row.
      await browser.execute(() => {
        const btn = Array.from(document.querySelectorAll("aside button")).find(
          (b) => (b.textContent ?? "").includes("Unlock Pro"),
        ) as HTMLButtonElement | null;
        btn?.click();
      });
      await browser.waitUntil(async () => upsellModalOpen(), {
        timeout: 5_000,
        timeoutMsg:
          'expected the "Unlock Pro" footer row to open the upsell modal',
      });

      // The Buy CTA is present and Tab-reachable inside the dialog.
      assert(
        await buyButtonPresent(),
        'expected a "Buy license" button inside the open upsell modal',
      );

      // Screenshot the Buy affordance for the gsd-ui-review audit.
      await saveScreenshot("license-buy", "license-buy-cta.png", "buy-cta");

      // Record the in-app route, then click Buy. The native browser-open is
      // non-observable here (manual walkthrough item — see file header); we
      // assert the OBSERVABLE in-app contract: no in-page navigation.
      const hashBefore = await currentHash();
      assert(await clickBuy(), 'could not click the "Buy license" button');

      // The route/hash must NOT change — the Buy click is a hand-off to the OS
      // browser, never an in-app navigation (T-20-01). Give any (incorrect)
      // navigation a beat to land, then assert it did not.
      await browser.pause(500);
      const hashAfter = await currentHash();
      assert(
        hashAfter === hashBefore,
        `the in-app route changed after clicking Buy (before=${hashBefore}, after=${hashAfter}) — the Buy CTA must never navigate the document`,
      );

      // The modal did not crash — it is still mounted (the panel survived the
      // click; a thrown error would have unmounted/blanked the dialog).
      assert(
        await upsellModalOpen(),
        "the upsell modal unmounted after clicking Buy — the CTA must be calm/best-effort, never throw",
      );

      // Dismiss the modal (Escape — document-level listener).
      await browser.execute(() => {
        document.activeElement?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      await browser.waitUntil(async () => !(await upsellModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the upsell modal",
      });
    } finally {
      // Cleanup (T-18-15): dismiss any open modal and toggle back to FULL so the
      // persisted "free" override never poisons later specs in this WDIO run.
      try {
        if (await upsellModalOpen()) {
          await browser.execute(() => {
            document.activeElement?.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            );
          });
        }
        if (await unlockProFooterPresent()) {
          await runDevToggle();
          await browser.waitUntil(
            async () => !(await unlockProFooterPresent()),
            {
              timeout: 10_000,
              timeoutMsg:
                'expected the "Unlock Pro" footer row to disappear on toggle-back',
            },
          );
        }
      } catch (cleanupError) {
        console.error("[license-buy] toggle-back cleanup failed:", cleanupError);
      }
    }
  });
});
