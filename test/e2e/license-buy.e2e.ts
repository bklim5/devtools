// Buy-license wiring — real macOS WKWebView gate (Phase 20, 20-01; PAY-01, D-67/
// D-68, threat T-20-01).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — the same harness as
// entitlements.e2e.ts. Run by scripts/e2e-spike.sh; auto-discovered by
// wdio.conf.ts `specs: ["./test/e2e/*.e2e.ts"]`.
//
// What this spec proves on the real runtime — and where the wiring proof lives:
//   - PROVES (the OBSERVABLE in-app contract on the real WKWebView): in the
//     free tier the shared upsell surface — post-22.1-04 the Settings ▸ License
//     pane (the standalone UpsellModal was REMOVED; the footer "Unlock Pro" row now
//     calls openSettings("license")) — renders a Tab-reachable "Buy license" CTA,
//     and clicking it is a CALM, best-effort OS hand-off — it does NOT navigate the
//     in-app document (the HashRouter route window.location.hash is unchanged) and
//     it does NOT crash/unmount the Settings dialog (it survives the click). This is
//     exactly the T-20-01 contract that matters on the real runtime: no
//     open-redirect of the app itself, no throw at the user.
//   - DOES NOT (CANNOT) PROVE HERE: that the click calls the native opener seam
//     with https://tinkerdev.io/buy. That positive openUrl-called-once-with-URL
//     contract is NOT observable from WebDriver on this hardened WKWebView (see
//     the "Why the openUrl call is non-observable here" note below) — it is pinned
//     AUTHORITATIVELY by the unit suite and confirmed by a manual walkthrough:
//       * UNIT (authoritative wiring proof): UpsellPanel.test.tsx
//         "renders the 'Buy license' CTA ... that opens the checkout via the
//         opener seam (PAY-01/D-67)" asserts platform.opener.openUrl is called
//         EXACTLY ONCE with "https://tinkerdev.io/buy", does not navigate, and
//         never throws even if the opener rejects. tauri.ts:131-133 wires that
//         seam to @tauri-apps/plugin-opener's openUrl (the https-only,
//         capability-scoped native call).
//       * MANUAL WALKTHROUGH (human-verify gate item): confirm the Buy CTA opens
//         https://tinkerdev.io/buy in the OS default browser (recorded in the
//         phase manual-verify list + deferred-items.md).
//
// Why the openUrl call is non-observable here (the iteration-3 finding):
//   @tauri-apps/plugin-opener's openUrl routes through
//   window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url', { url }). On this
//   runtime EVERY layer of that IPC transport is installed by Tauri's injected
//   core script with `Object.defineProperty` and NO writable/configurable flags
//   (they default false) — `invoke`, `ipc` (additionally Object.freeze'd), and
//   `postMessage` are all NON-WRITABLE and NON-CONFIGURABLE (tauri 2.11
//   scripts/core.js:81, scripts/ipc.js:142, scripts/ipc-protocol.js:88). A
//   runtime-reassigned wrapper (`internals.invoke = wrapper`) is therefore a
//   SILENT no-op, and `Object.defineProperty` cannot redefine the locked-down
//   property either. The earlier iterations' recorder read `__realInvoke` fine
//   (so it reported installed=true) but its wrapper never went live, so it
//   observed ZERO commands — not even mount-time license_status — confirming the
//   seam is genuinely non-interceptable from a browser.execute context here.
//   tauri-plugin-webdriver also offers no pre-load init-script hook to land a
//   wrapper before core.js defines (and locks) the property. So the positive
//   openUrl contract is proven by the unit test + manual walkthrough, and this
//   spec keeps the NON-VACUOUS observable contract above (a dead/disconnected
//   onClick that navigated the document or threw would still FAIL here).
//
// Reaching the Buy CTA: post-D-85 an unlicensed in-Tauri install resolves FREE,
// but to keep this spec independent of prior-spec tier state in the same WDIO
// run, the spec establishes the FREE tier explicitly via the ⌘K DEV command
// (ensureFreeTier — the same real-user path entitlements.e2e.ts uses) so the
// "Unlock Pro" footer that opens the Settings ▸ License pane is present, then
// re-establishes Pro in cleanup so it leaves no "free" override behind for later
// specs in the same WDIO run.

import {
  assert,
  ensureFreeTier,
  ensureProTier,
  saveScreenshot,
  settingsLicensePaneOpen,
  unlockProFooterPresent,
} from "./helpers";

// Whether Settings ▸ License (the inline upsell surface) is open — post-22.1-04 the
// footer "Unlock Pro" row calls openSettings("license") (the standalone UpsellModal
// was removed). Reads the Settings dialog's License-pane copy.
const upsellModalOpen = settingsLicensePaneOpen;

// The Settings dialog (the focus-trapped [role=dialog][aria-modal] that hosts the
// inline License pane). Scoping the Buy-CTA probes to THIS dialog keeps them off the
// shell's own buttons.
const DIALOG_SEL = '[role="dialog"][aria-modal="true"]';

// Whether the "Buy license" button exists inside the open Settings ▸ License dialog.
function buyButtonPresent(): Promise<boolean> {
  return browser.execute((sel: string) => {
    const dialog = document.querySelector(sel);
    if (!dialog) return false;
    return Array.from(dialog.querySelectorAll("button")).some(
      (b) => (b.textContent ?? "").trim() === "Buy license",
    );
  }, DIALOG_SEL);
}

// The "Buy license" button's tabIndex inside the dialog (>= 0 ⇒ Tab-reachable; the
// Settings modal's focus-trap cycles only focusable controls). -2 = not found.
function buyButtonTabIndex(): Promise<number> {
  return browser.execute((sel: string) => {
    const dialog = document.querySelector(sel);
    const buy = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "Buy license",
    ) as HTMLButtonElement | null;
    return buy ? buy.tabIndex : -2;
  }, DIALOG_SEL);
}

// Click the "Buy license" button inside the open dialog (by accessible name).
function clickBuy(): Promise<boolean> {
  return browser.execute((sel: string) => {
    const dialog = document.querySelector(sel);
    const buy = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "Buy license",
    ) as HTMLButtonElement | null;
    buy?.click();
    return buy !== null;
  }, DIALOG_SEL);
}

function currentHash(): Promise<string> {
  return browser.execute(() => window.location.hash);
}

describe("Buy-license wiring (real WKWebView)", () => {
  it("the Buy CTA is a Tab-reachable, calm OS hand-off — it never navigates the in-app route or crashes the modal", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await browser.execute(() => {
      window.location.hash = "#/tools/protobuf-decoder";
    });
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // BASELINE: post-D-85 the e2e baseline is FREE (the unlicensed in-Tauri flip),
    // but to keep this spec independent of prior-spec tier state in the same WDIO
    // run, drop to FREE explicitly so the "Unlock Pro" footer (which opens the
    // Settings ▸ License pane) is present. ensureFreeTier carries the racy-propagation
    // retry the ⌘K dev-toggle→refreshEntitlements() path needs on this WKWebView
    // worker (deferred-items / [[license-walkthrough-state-pollutes-e2e]]).
    await ensureFreeTier();
    assert(
      await unlockProFooterPresent(),
      'expected the free-tier "Unlock Pro" footer row after establishing the free tier (D-29)',
    );

    try {
      // Open the Settings ▸ License pane from the footer "Unlock Pro" row
      // (openSettings("license") — post-22.1-04).
      await browser.execute(() => {
        const btn = Array.from(document.querySelectorAll("aside button")).find(
          (b) => (b.textContent ?? "").includes("Unlock Pro"),
        ) as HTMLButtonElement | null;
        btn?.click();
      });
      await browser.waitUntil(async () => upsellModalOpen(), {
        timeout: 5_000,
        timeoutMsg:
          'expected the "Unlock Pro" footer row to open the Settings ▸ License pane',
      });

      // The Buy CTA is present AND Tab-reachable inside the Settings dialog (WCAG-AA
      // — the modal's focus-trap cycles it). A hidden/tabIndex=-1 CTA would fail here.
      assert(
        await buyButtonPresent(),
        'expected a "Buy license" button inside the open Settings ▸ License pane',
      );
      assert(
        (await buyButtonTabIndex()) >= 0,
        "the Buy CTA must be keyboard/Tab-reachable inside the Settings ▸ License dialog (WCAG-AA)",
      );

      // Screenshot the Buy affordance for the gsd-ui-review audit.
      await saveScreenshot("license-buy", "license-buy-cta.png", "buy-cta");

      // Record the in-app route, then click Buy. The native browser-open and the
      // openUrl(url) call are non-observable from WebDriver on this hardened
      // WKWebView (see the file header — the IPC transport is non-writable/
      // non-configurable); the positive openUrl-called-once-with-URL contract is
      // pinned by UpsellPanel.test.tsx + a manual walkthrough item. Here we
      // assert the OBSERVABLE in-app contract that a dead/broken onClick would
      // still violate: no in-page navigation and no modal crash.
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

      // The dialog did not crash — it is still mounted (the pane survived the
      // click; a thrown error would have unmounted/blanked the dialog). This is
      // the runtime proof that the best-effort opener call is CALM (D-67) — the
      // unit suite pins that openUrl is called once with the URL and that a
      // rejected open does not throw.
      assert(
        await upsellModalOpen(),
        "the Settings ▸ License pane unmounted after clicking Buy — the CTA must be calm/best-effort, never throw",
      );

      // Dismiss the Settings modal (Escape — document-level listener).
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
        timeoutMsg: "expected Escape to dismiss the Settings ▸ License modal",
      });
    } finally {
      // Cleanup (T-18-15): dismiss any open modal and re-establish Pro best-effort
      // so the persisted "free" override is not left behind for later specs in
      // this WDIO run. The suite is now setup-per-spec (every tier-touching spec
      // calls ensureFreeTier/ensureProTier first), so this is best-effort only —
      // it deliberately does NOT assert the tier flipped (the prior cleanup
      // assertion was e2e-harness fragility, not a product contract).
      try {
        if (await upsellModalOpen()) {
          await browser.execute(() => {
            document.activeElement?.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            );
          });
          await browser
            .waitUntil(async () => !(await upsellModalOpen()), { timeout: 5_000 })
            .catch(() => {});
        }
        await ensureProTier();
      } catch (cleanupError) {
        console.error("[license-buy] toggle-back cleanup failed:", cleanupError);
      }
    }
  });
});
