// Buy-license wiring — real macOS WKWebView gate (Phase 20, 20-01; PAY-01, D-67/
// D-68, threat T-20-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// entitlements.e2e.ts. Run by scripts/e2e-spike.sh; auto-discovered by
// wdio.conf.ts `specs: ["./test/e2e/*.e2e.ts"]`.
//
// What this proves on the real runtime — and what it deliberately does NOT:
//   - PROVES (finding 10, T-20-15 — the load-bearing assertion): clicking the
//     "Buy license" CTA calls the opener seam EXACTLY ONCE with the exact URL
//     https://tinkerdev.io/buy. The app routes openUrl through the native plugin
//     IPC `plugin:opener|open_url` on window.__TAURI_INTERNALS__.invoke; we wrap
//     that invoke to RECORD the url arg and SHORT-CIRCUIT that one command (so no
//     real OS browser actually opens mid-e2e), delegating all other commands to
//     the original invoke. A silently-broken/disconnected onClick now FAILS this
//     spec — the old hash-unchanged + modal-mounted assertions (kept below as
//     corroboration) passed vacuously for a dead handler.
//   - ALSO PROVES: the Buy click does NOT navigate the in-app document — the
//     HashRouter route (window.location.hash) is unchanged and the upsell modal
//     stays mounted (T-20-01: no open-redirect of the app itself; the CTA is a
//     calm best-effort hand-off that never throws).
//   - DOES NOT (cannot) PROVE: that the OS default browser actually opened
//     https://tinkerdev.io/buy. The native browser-open is NON-OBSERVABLE inside
//     WebDriver (HARNESS native-input note: WebDriver cannot synthesize/observe
//     OS-level handoffs) AND we deliberately short-circuit it here. The actual
//     browser-open is a MANUAL walkthrough item at the Phase 20 human-verify gate
//     (per 20-VALIDATION "Manual-Only Verifications"). The unit suite
//     (UpsellPanel.test.tsx) also pins the positive contract at the platform seam.
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

// --- opener recorder (finding 10) -------------------------------------------
// The app's platform singleton is module-private (unreachable from a
// browser.execute context), so we stub at the seam the runtime actually uses:
// the native plugin IPC. `@tauri-apps/plugin-opener` calls
// window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url', { url, with }).
// We wrap that invoke to (a) record the url for the open_url command and (b)
// short-circuit ONLY that command to a resolved no-op so no real OS browser
// opens during the run; every other command delegates to the original invoke.
// Calls are stashed on window.__openUrlCalls and the original is stashed on
// window.__realInvoke for restoration in finally.

// Shape of the window we read/patch inside the browser.execute closures below.
// Type-only — it erases at compile time, so referencing it from the serialized
// closures is safe (no runtime value crosses the WebDriver boundary).
type RecorderInvoke = (cmd: string, args?: unknown, opts?: unknown) => Promise<unknown>;
type RecorderWindow = {
  __TAURI_INTERNALS__?: { invoke: RecorderInvoke };
  __openUrlCalls?: string[];
  __realInvoke?: RecorderInvoke;
};

// Install the recorder. Idempotent: a second install is a no-op (so a retry
// loop cannot double-wrap and lose the original).
function installOpenerRecorder(): Promise<void> {
  return browser.execute(() => {
    const w = window as unknown as RecorderWindow;
    const internals = w.__TAURI_INTERNALS__;
    if (!internals || w.__realInvoke) return; // not in Tauri, or already wrapped
    w.__openUrlCalls = [];
    const real = internals.invoke.bind(internals);
    w.__realInvoke = real;
    internals.invoke = (cmd: string, args?: unknown, opts?: unknown) => {
      if (cmd === "plugin:opener|open_url") {
        const url = (args as { url?: string } | undefined)?.url;
        if (typeof url === "string") (w.__openUrlCalls ??= []).push(url);
        // Short-circuit: do NOT hand off to the real OS browser mid-e2e.
        return Promise.resolve();
      }
      return real(cmd, args, opts);
    };
  });
}

// Read back the recorded openUrl calls.
function recordedOpenUrlCalls(): Promise<string[]> {
  return browser.execute(
    () => (window as unknown as RecorderWindow).__openUrlCalls ?? [],
  );
}

// Restore the original invoke and clear recorder state (finally cleanup, so the
// wrapped invoke never leaks into later specs in the same WDIO run).
function restoreOpenerRecorder(): Promise<void> {
  return browser.execute(() => {
    const w = window as unknown as RecorderWindow;
    if (w.__TAURI_INTERNALS__ && w.__realInvoke) {
      w.__TAURI_INTERNALS__.invoke = w.__realInvoke;
    }
    delete w.__realInvoke;
    delete w.__openUrlCalls;
  });
}

describe("Buy-license wiring (real WKWebView)", () => {
  it("the Buy CTA reaches the opener seam without navigating the in-app route", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // Install the opener recorder (finding 10) BEFORE any Buy interaction. It
    // short-circuits the native open_url IPC, so the assertion below observes
    // the exact URL the CTA hands off — without a real browser opening.
    await installOpenerRecorder();

    // BASELINE: in-Tauri default is FULL — toggle to FREE so the "Unlock Pro"
    // footer (which opens the shared upsell modal) is present. The ⌘K dev-toggle
    // → refreshEntitlements() propagation is racy on this WKWebView worker setup
    // (the same path the unmodified entitlements.e2e.ts shares — see
    // .planning/phases/20-purchase-pipeline/deferred-items.md), so retry the
    // toggle a few times before failing loud rather than depending on a single
    // flip landing within one window.
    let footerUp = await unlockProFooterPresent();
    for (let attempt = 0; attempt < 4 && !footerUp; attempt++) {
      await runDevToggle();
      try {
        await browser.waitUntil(async () => unlockProFooterPresent(), {
          timeout: 8_000,
          interval: 200,
          timeoutMsg: "footer not up yet",
        });
        footerUp = true;
      } catch {
        footerUp = await unlockProFooterPresent();
      }
    }
    assert(
      footerUp,
      'expected the free-tier "Unlock Pro" footer row after the dev toggle (D-29) — retried',
    );

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

      // LOAD-BEARING (finding 10, T-20-15): the CTA must call the opener seam
      // exactly once with the exact buy URL. A silently-broken onClick records
      // zero calls and fails here, where the corroborating assertions below
      // would have passed vacuously. Give the best-effort async open a beat.
      await browser.waitUntil(
        async () => (await recordedOpenUrlCalls()).length >= 1,
        {
          timeout: 5_000,
          timeoutMsg:
            "the Buy CTA never called the opener seam — onClick is disconnected/broken",
        },
      );
      const openUrlCalls = await recordedOpenUrlCalls();
      assert(
        openUrlCalls.length === 1,
        `expected exactly one openUrl call, got ${openUrlCalls.length}: ${JSON.stringify(openUrlCalls)}`,
      );
      assert(
        openUrlCalls[0] === "https://tinkerdev.io/buy",
        `the Buy CTA opened the wrong URL: ${openUrlCalls[0] ?? "(none)"} (expected https://tinkerdev.io/buy)`,
      );

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
      // Restore the wrapped native invoke (finding 10) so the opener short-circuit
      // never leaks into later specs in this WDIO run.
      try {
        await restoreOpenerRecorder();
      } catch (restoreError) {
        console.error("[license-buy] opener recorder restore failed:", restoreError);
      }
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
