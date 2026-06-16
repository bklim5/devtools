// License-pane states — real macOS WKWebView gate (Phase 22.1, 22.1-04; D-22.1-4/5/
// 6/7, SET-06 revision).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). Run by
// scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts ("./test/e2e/*.e2e.ts").
//
// WHAT THIS PROVES — the redesigned Settings ▸ License pane renders each license
// state correctly on the real runtime, driven DETERMINISTICALLY by the 22.1-04
// dev-only `dev_set_license_state` Tauri command (the e2e seam). The licensed /
// offlineGrace states need a SIGNED cert whose fingerprint matches THIS dev machine
// (impossible headlessly — the CE Ed25519 signing key is server-side, never
// committed), so before 22.1-04 the green Pro-active UI could only be checked in the
// human walkthrough + the unit suite. The dev override makes `license_status` AND
// `license_status_detail` return a synthetic payload for the requested state,
// bypassing the cert/Keychain, so the real WKWebView can render the full Pro UI.
// The override is DOUBLE-GATED (debug-only command + debug-only manager seam) and is
// compiled out of release builds (scripts/check-dev-strip.sh asserts its absence).
//
// The three states driven here (each: set override → open the pane → assert the
// redesigned UI → screenshot):
//   • free        → the inline pitch ("Thank you for using TinkerDev ❤️", $9, Buy
//                   license, "I have a license key") — InlineActivation variant=upsell.
//   • licensed    → the GREEN success banner (.border-ok-line/.bg-ok-soft) +
//                   "Licensed" + "Pro" pill + Licensee + masked key + Refresh +
//                   "Deactivate this device"; clicking it reveals the full-width
//                   confirm card (Cancel + Deactivate).
//   • problem     → the AMBER attention banner (.border-warn-line) + "License needs
//                   attention" + "Unverified" pill + the inline "Activate a license"
//                   form (no pitch, no stacked modal).
//
// The override is RESET (null) in an after-hook so it never leaks to other specs in
// the WDIO run (the e2e-spike preflight already resets prefs/cert; this resets the
// process-local dev override, which the preflight cannot reach — it lives in the
// running app's managed LicenseState).

import {
  assert,
  navigateToTool,
  saveScreenshot,
  setDevLicenseState,
} from "./helpers";

// --- DOM probes (single-round-trip reads — WebKit lesson 3) -----------------

/** Open the Settings modal on the License pane via the #/settings/license deep-link
 *  (the SettingsDeepLink element calls openSettings("license") then redirects). */
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

/** The License-pane STATUS heading, scoped INSIDE the Settings dialog with the
 *  "Settings" dialog title dropped (Pitfall 4: an unscoped first-h2 read would now
 *  return "Settings"). The status block heading is the first non-"Settings" <h2>.
 *  Returns null when the modal is not mounted. */
function statusHeading(): Promise<string | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return null;
    const h2s = Array.from(dialog.querySelectorAll("h2"))
      .map((h) => (h.textContent ?? "").trim())
      .filter((t) => t !== "Settings");
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

/** Click a License-pane button by its visible text (scoped to the dialog). */
function clickPaneButton(text: string): Promise<void> {
  return browser.execute((label: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
      (b.textContent ?? "").trim().includes(label),
    ) as HTMLElement | undefined;
    btn?.click();
  }, text);
}

/** Whether the License pane shows the given visible text (scoped to the dialog). */
function paneHasText(text: string): Promise<boolean> {
  return browser.execute((needle: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    return (dialog?.textContent ?? "").includes(needle);
  }, text);
}

/** Whether the License pane renders an element matching the given CSS selector
 *  (scoped inside the Settings dialog) — used for the green/amber banner tokens. */
function paneHasSelector(selector: string): Promise<boolean> {
  return browser.execute(
    (sel: string) => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      return !!dialog && dialog.querySelector(sel) !== null;
    },
    selector,
  );
}

/** Whether the License pane renders the INLINE "License key" input (the shared
 *  activation surface) — scoped inside the Settings dialog, matched via the
 *  <label htmlFor> → input id path the unit tests use. */
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

/** Dismiss whatever modal is open via Escape (the dialog's document-level listener). */
function dismissModal(): Promise<void> {
  return browser.execute(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
}

/** Close the Settings modal (Esc) and wait for it to unmount — keeps each test
 *  independent and ensures the next deep-link open REMOUNTS the License pane (an
 *  already-open modal is a no-op for openSettings, leaving a stale pane). */
async function closeSettingsModal(): Promise<void> {
  if (await settingsModalOpen()) {
    await dismissModal();
    await browser.waitUntil(async () => !(await settingsModalOpen()), {
      timeout: 5_000,
      timeoutMsg: "expected Escape to dismiss the Settings modal",
    });
  }
}

/** Set the synthetic license state, then (re)open the License pane so its mount
 *  re-query (refreshLicenseUiDetailed) renders the now-synthetic status. Closes any
 *  open modal first so the deep-link genuinely remounts the pane. */
async function openPaneInState(state: string): Promise<void> {
  await setDevLicenseState(state);
  await closeSettingsModal();
  await navigateToTool("protobuf-decoder");
  await openLicenseDeepLink();
  await browser.waitUntil(async () => settingsModalOpen(), {
    timeout: 10_000,
    timeoutMsg: `expected #/settings/license to open the Settings modal for the "${state}" state`,
  });
}

describe("License-pane states via the dev override (real WKWebView)", () => {
  // Reset the process-local dev override after EVERY test so it never leaks to the
  // next test here or to another spec in the WDIO run (the e2e-spike preflight resets
  // prefs/cert on disk but cannot reach this in-process override).
  afterEach(async () => {
    try {
      await closeSettingsModal();
      await setDevLicenseState(null);
      // Clearing the Rust override does NOT refresh the webview's cached license
      // store — it still holds the last synthetic snapshot until something
      // re-queries. Re-open the License pane (its mount re-queries with the
      // override gone → the real notActivated state) then close, so the stale
      // snapshot never leaks into the next spec's footer/tier logic.
      await navigateToTool("protobuf-decoder");
      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg: "expected the License pane to reopen for the override-reset re-query",
      });
      await closeSettingsModal();
    } catch (err) {
      console.error("[license-states] override reset failed:", err);
    }
  });

  it("free → renders the inline pitch ($9 + Buy license + I have a license key) in the License pane (D-22.1-6)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    await openPaneInState("free");
    await browser.waitUntil(
      async () => (await statusHeading()) === "Thank you for using TinkerDev ❤️",
      {
        timeout: 10_000,
        timeoutMsg: `expected the free inline pitch heading, got ${JSON.stringify(await statusHeading())}`,
      },
    );
    assert(await paneHasText("$9"), "the free pitch must show the $9 price (D-22.1-6)");
    assert(
      await paneHasButton("Buy license"),
      "the free pitch must offer the Buy license CTA",
    );
    assert(
      await paneHasButton("I have a license key"),
      "the free pitch must offer the 'I have a license key' reveal",
    );
    await saveScreenshot("license-states", "license-states-free.png", "free");
  });

  it("licensed → green status banner + Pro pill + Licensee/masked key + Refresh + Deactivate (which reveals the confirm card)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    await openPaneInState("licensed");
    await browser.waitUntil(async () => (await statusHeading()) === "Licensed", {
      timeout: 10_000,
      timeoutMsg: `expected the "Licensed" status heading, got ${JSON.stringify(await statusHeading())}`,
    });

    // The GREEN success banner (ok tokens) — the calm Pro-active surface.
    assert(
      await paneHasSelector(".border-ok-line"),
      "the licensed state must render the green ok-line banner (.border-ok-line)",
    );
    assert(
      await paneHasSelector(".bg-ok-soft"),
      "the licensed state must render the green ok-soft banner (.bg-ok-soft)",
    );
    // The Pro pill + the synthetic cert's Licensee email + masked key detail rows.
    assert(await paneHasText("Pro"), "the licensed banner must carry the Pro pill");
    assert(await paneHasText("Licensee"), "the licensed pane must show the Licensee row");
    assert(
      await paneHasText("test@tinkerdev.io"),
      "the licensed pane must show the synthetic licensee email",
    );
    assert(
      await paneHasText("••••••••TEST"),
      "the licensed pane must show the synthetic masked License key",
    );
    assert(await paneHasButton("Refresh"), "the licensed pane must offer the secondary Refresh");
    assert(
      await paneHasButton("Deactivate this device"),
      "the licensed pane must offer the Deactivate trigger",
    );
    await saveScreenshot("license-states", "license-states-licensed.png", "licensed");

    // Clicking "Deactivate this device" reveals the full-width confirm card with
    // Cancel + a destructive Deactivate (confirm-first — D-78).
    await clickPaneButton("Deactivate this device");
    // The green "Licensed" banner stays rendered ABOVE the confirm card, so
    // statusHeading() (the first <h2>) still reads "Licensed" — probe the confirm
    // card's heading by text instead.
    await browser.waitUntil(
      async () => await paneHasText("Deactivate Pro on this device?"),
      {
        timeout: 5_000,
        timeoutMsg: "expected the Deactivate confirm card after clicking Deactivate",
      },
    );
    assert(await paneHasButton("Cancel"), "the confirm card must offer Cancel");
    assert(
      await paneHasButton("Deactivate"),
      "the confirm card must offer the destructive Deactivate",
    );
    await saveScreenshot(
      "license-states",
      "license-states-licensed-confirm.png",
      "licensed-deactivate-confirm",
    );
  });

  it("problem → amber attention banner + Unverified pill + the inline Activate-a-license form (D-22.1-7)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    await openPaneInState("problem");
    await browser.waitUntil(
      async () => (await statusHeading()) === "License needs attention",
      {
        timeout: 10_000,
        timeoutMsg: `expected the "License needs attention" status heading, got ${JSON.stringify(await statusHeading())}`,
      },
    );

    // The AMBER attention banner (warn tokens) — the calm WARNING surface.
    assert(
      await paneHasSelector(".border-warn-line"),
      "the problem state must render the amber warn-line attention banner (.border-warn-line)",
    );
    // The UNVERIFIED amber pill (problem-only) + the inline Activate form (no pitch).
    assert(
      await paneHasText("Unverified"),
      "the problem state must show the UNVERIFIED pill",
    );
    assert(await paneHasButton("Refresh"), "the problem state must keep the Refresh re-check");
    assert(
      await paneHasText("Activate a license"),
      "the problem state must render the inline 'Activate a license' section (D-22.1-7)",
    );
    assert(
      await paneHasKeyInput(),
      'the problem state must render the inline "License key" input (D-22.1-7)',
    );
    assert(
      await paneHasButton("Activate"),
      "the problem state must offer the inline Activate button (D-22.1-7)",
    );
    // A paying customer in the problem state must NOT see the sales pitch.
    assert(
      !(await paneHasText("Most of TinkerDev is free")),
      "the problem state must NOT show the sales pitch (D-22.1-7)",
    );
    await saveScreenshot("license-states", "license-states-problem.png", "problem");
  });
});
