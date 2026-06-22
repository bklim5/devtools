// IAP spike button (the temporary D-11 block in Settings ▸ License) — real macOS
// WKWebView gate (Phase 26, 26-03 Task 2).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). Run by
// scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts.
//
// WHAT THIS PROVES (the seam-wiring smoke, 26-VALIDATION 26-03-2, T-26-09):
// the temporary IAP spike block (LicenseSettings IapSpikeBlock) RENDERS in the
// License pane, is keyboard-reachable, and clicking Fetch products / Buy Pro /
// Restore DISPATCHES the platform.iap seam and DEGRADES CALMLY on this build's
// arm — the aria-live readout updates and the app never white-screens.
//
// WHICH ARM RUNS HERE: this is the DIRECT build (no `appstore` cargo feature),
// so the `iap_*` Rust commands are NOT registered. The WKWebView IS Tauri (the
// real tauri.ts arm runs), so each invoke(iap_*) REJECTS — and the block must
// render that reject as calm "IAP unavailable (code: ...)" text (T-26-09). The
// no-op browser arm's "No products (direct build / no-op arm)" string is also
// accepted for Fetch products: BOTH outcomes prove the same thing — the seam is
// wired into the UI and the unavailable arm is handled gracefully, no crash.
//
// NOT covered here (the Plan 06 human gate, D-06 — WebDriver-impossible):
// the LIVE native purchase sheet and the LIVE Restore re-grant readout (the
// observed currentEntitlements() codes after a real sandbox purchase) run
// out-of-process on the signed/sandboxed build and cannot be synthesized by
// WebDriver. This spec is the in-process smoke ONLY.
//
// The e2e-spike preflight resets the DEV prefs.json + machine.dev.lic to a
// deterministic FREE baseline (no override, no cert → notActivated), so the
// pane starts in the free inline-upsell state — which renders the spike block.

import { assert, navigateToTool, saveScreenshot } from "./helpers";

// --- DOM probes (single-round-trip reads — WebKit lesson 3) -----------------

/** Open the Settings modal on the License pane via the #/settings/license
 *  deep-link (mirrors license-settings.e2e.ts). */
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

/** Whether the temporary IAP spike block is present INSIDE the Settings dialog. */
function spikeBlockPresent(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    return dialog?.querySelector('[data-testid="iap-spike"]') !== null;
  });
}

/** Whether the spike block's three buttons are real, focusable <button>s
 *  (keyboard-operable: a <button> handles click + Enter/Space natively). */
function spikeButtonsKeyboardReachable(): Promise<boolean> {
  return browser.execute(() => {
    const block = document
      .querySelector('[role="dialog"][aria-modal="true"]')
      ?.querySelector('[data-testid="iap-spike"]');
    if (!block) return false;
    const labels = ["Fetch products", "Buy Pro (spike)", "Restore (spike)"];
    return labels.every((label) => {
      const btn = Array.from(block.querySelectorAll("button")).find((b) =>
        (b.textContent ?? "").trim().includes(label),
      ) as HTMLButtonElement | undefined;
      if (!btn) return false;
      // A real <button> is keyboard-operable: focusing it makes it the active
      // element (it is in the Tab order — no tabindex="-1"), and Enter/Space
      // fire its onClick natively.
      btn.focus();
      return document.activeElement === btn;
    });
  });
}

/** Click a spike-block button by its visible text (scoped to the block). */
function clickSpikeButton(text: string): Promise<void> {
  return browser.execute((label: string) => {
    const block = document
      .querySelector('[role="dialog"][aria-modal="true"]')
      ?.querySelector('[data-testid="iap-spike"]');
    const btn = Array.from(block?.querySelectorAll("button") ?? []).find((b) =>
      (b.textContent ?? "").trim().includes(label),
    ) as HTMLElement | undefined;
    btn?.click();
  }, text);
}

/** The spike block's aria-live readout text (role="status"), scoped to the block. */
function spikeReadout(): Promise<string> {
  return browser.execute(() => {
    const block = document
      .querySelector('[role="dialog"][aria-modal="true"]')
      ?.querySelector('[data-testid="iap-spike"]');
    const region = block?.querySelector('[role="status"]');
    return (region?.textContent ?? "").trim();
  });
}

/** A crude white-screen guard: the shell sidebar + the Settings dialog are both
 *  still in the DOM (a crash/white-screen would tear the React tree down). */
function appAlive(): Promise<boolean> {
  return browser.execute(
    () =>
      document.querySelector("aside") !== null &&
      document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
  );
}

/** Dismiss whatever modal is open via Escape so it never poisons the next spec. */
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

async function closeSettingsModal(): Promise<void> {
  if (await settingsModalOpen()) {
    await dismissModal();
    await browser
      .waitUntil(async () => !(await settingsModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the Settings modal",
      })
      .catch(() => {});
  }
}

/** Click a spike button, wait for the aria-live readout to change away from the
 *  in-flight "…" line to a settled result, and assert the app stayed alive. The
 *  readout starts empty; we accept ANY non-empty settled result (the calm
 *  "IAP unavailable (code: ...)" reject text on the unregistered arm, or the
 *  no-op "No products" / a success/cancelled/pending line) — the smoke is that
 *  the seam dispatched and the UI handled the result without crashing. */
async function clickAndExpectCalmUpdate(label: string): Promise<string> {
  await clickSpikeButton(label);
  await browser.waitUntil(
    async () => {
      const text = await spikeReadout();
      // Settled = non-empty AND not the transient "…" in-flight line.
      return text.length > 0 && !text.endsWith("…");
    },
    {
      timeout: 10_000,
      timeoutMsg: `expected the spike readout to settle after clicking "${label}"`,
    },
  );
  assert(await appAlive(), `the app must not white-screen after clicking "${label}"`);
  return spikeReadout();
}

describe("IAP spike button in the License pane (real WKWebView)", () => {
  it("renders the temporary spike block, is keyboard-reachable, and dispatches products/purchase/restore — degrading calmly on the no-op/unregistered arm (T-26-09)", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // Open the Settings modal on the License pane (FREE baseline → the free
      // inline-upsell state, which renders the spike block).
      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg: "expected #/settings/license to open the Settings modal",
      });

      // 1. The block renders and is keyboard-reachable.
      await browser.waitUntil(async () => spikeBlockPresent(), {
        timeout: 10_000,
        timeoutMsg: 'expected the [data-testid="iap-spike"] block in the License pane',
      });
      assert(
        await spikeButtonsKeyboardReachable(),
        "the three spike buttons must be real, focusable, keyboard-operable <button>s",
      );

      // 2. Fetch products → the readout updates calmly, no white-screen.
      const fetched = await clickAndExpectCalmUpdate("Fetch products");
      assert(
        fetched.includes("No products") || fetched.includes("IAP unavailable"),
        `Fetch products must render the no-op "No products" OR a calm "IAP unavailable" line, got: ${JSON.stringify(fetched)}`,
      );

      // 3. Buy Pro → a calm result/again no crash (the direct build has no
      //    iap_* handler → reject → calm code text; proves the unavailable arm).
      const bought = await clickAndExpectCalmUpdate("Buy Pro (spike)");
      assert(
        bought.length > 0,
        `Buy Pro must render a calm result line, got: ${JSON.stringify(bought)}`,
      );

      // 4. Restore → the aria-live region updates calmly (the no-op arm rejects
      //    restore() → calm code text; the LIVE re-grant readout is Plan 06).
      const restored = await clickAndExpectCalmUpdate("Restore (spike)");
      assert(
        restored.length > 0,
        `Restore must render a calm result line, got: ${JSON.stringify(restored)}`,
      );

      await saveScreenshot("iap-spike", "iap-spike-no-op-arm.png", "no-op-arm");
    } finally {
      try {
        await closeSettingsModal();
      } catch (cleanupError) {
        console.error("[iap-spike] cleanup failed:", cleanupError);
      }
    }
  });
});
