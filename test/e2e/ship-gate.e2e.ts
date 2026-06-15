// Ship-gate matrix — fixture-driven cases on the real macOS WKWebView (Phase 21,
// 21-05; LIC-05/06; D-90, ROADMAP criterion 5).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — same harness as
// license.e2e.ts / license-settings.e2e.ts. Run by scripts/e2e-spike.sh;
// auto-discovered by wdio.conf.ts ("./test/e2e/*.e2e.ts"). `tauri dev` serves a
// DEBUG bundle, which post-260614 reads machine.dev.lic + the dev Keychain
// service (store.rs/keychain.rs cfg-split) — so this spec uses the DEV arm and
// can never clobber a shipped buyer's machine.lic (260614-nox).
//
// SCOPE — this spec is the AUTOMATABLE half of the 8-case D-90 matrix:
//   • Case 4 (corrupted machine.lic → fail-closed to free, problem state)  — DRIVEN here
//   • Case 5 (copied / foreign fingerprint → ForeignMachine → free)        — DRIVEN here
//   • Case 3 (offline launch / valid LOCAL verify → Licensed, network-free) — see note ↓
//   • Case 6 (TTL grace → refresh)                                          — see note ↓
//
// CASE 3 — the LOCAL-VERIFY-IS-NETWORK-FREE path. resolve_status is pure-local
// (D-45): it reads machine.dev.lic and Ed25519-verifies it with ZERO network,
// at every launch. This spec proves that network-free local-verify path lands
// on a DETERMINISTIC, fixture-reachable resolution (the foreign-FP fixture →
// ForeignMachine, case 5 below — the SAME pure-local code path that would land
// on Licensed for a matched cert). The actual *Licensed* resolution requires a
// cert whose embedded fingerprint matches THIS dev machine's real fingerprint,
// which cannot be produced from committed material headlessly (the committed
// ce-machine.lic carries the Plan-01 SYNTHETIC fingerprint b70ebcaf…, and
// re-issuing a cert bound to the live dev fingerprint needs a live CE checkout —
// the Ed25519 signing key is server-side, never committed). The network-free
// Licensed resolution is therefore proven AUTHORITATIVELY by the pure-Rust cargo
// tests (license::tests::valid_cert_with_matching_fingerprint_resolves_to_licensed
// + resolve_status_never_touches_network_on_the_expiry_path, the D-45 NoNetwork
// client panics-on-call) and the live-build walkthrough — see 21-SHIP-GATE-MATRIX.md.
//
// CASE 6 — TTL grace→refresh. OfflineGrace / RefreshNeeded require a verified
// cert whose embedded EXPIRY is in the past (within / beyond GRACE_DAYS). Like a
// matched-FP cert, an arbitrary-expiry SIGNED cert cannot be produced from
// committed material (the CE Ed25519 signing key is server-side; the one
// committed fixture has a fixed 2026-07-12 expiry). The expiry classification +
// the grace→lapsed→refresh transitions are therefore proven AUTHORITATIVELY by
// the pure-Rust CLOCK-INJECTION cargo tests (license::tests::classify_* +
// resolve_status_at / needs_refresh_at, injected `now`, no wall-clock flake) —
// see 21-SHIP-GATE-MATRIX.md. This spec covers only the case-6 state reachable
// with committed fixtures (none on the dev arm without a live checkout), and
// records the mechanism explicitly in the matrix.
//
// The deterministic baseline: the e2e-spike preflight wipes the DEV prefs.json +
// machine.dev.lic + the dev Keychain item, so this spec starts from a known
// notActivated/FREE state and is order-independent. Each test seeds its own
// fixture and RESTORES the machine as found in a finally block (T-18-15
// cleanup discipline) so a failed run never poisons later specs.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  assert,
  dispatchAltP,
  dispatchKey,
  focusRow,
  navigateToTool,
  readOrder,
  saveScreenshot,
  upsellModalOpen,
} from "./helpers";

// The DEBUG build reads machine.dev.lic (store.rs cfg-split, 260614-nox) — seeding
// MUST target that filename or the running app never sees the seeded cert.
const LIC_DIR = join(homedir(), "Library", "Application Support", "com.tinkerdev.app");
const LIC_PATH = join(LIC_DIR, "machine.dev.lic");

// The committed real-CE fixture (Plan 01): a byte-verbatim CE-issued machine
// certificate whose embedded fingerprint is the Plan-01 SYNTHETIC value
// (b70ebcaf…) — it verifies against the real config pubkey but does NOT match
// any live dev machine's fingerprint, so it resolves to ForeignMachine (case 5).
const FOREIGN_FP_FIXTURE = resolve(
  process.cwd(),
  "src-tauri/fixtures/ce-machine.lic",
);

// --- DOM probes (single-round-trip reads — WebKit lesson 3) -----------------

/** Open the License surface via the #/settings/license deep-link. Phase 22 (D-S6):
 *  the in-window route is GONE — the deep-link now opens the shell Settings modal
 *  on the License pane (the SettingsDeepLink element calls openSettings then
 *  redirects). */
function navigateToLicenseRoute(): Promise<void> {
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

/** Close the Settings modal (Esc) if open and wait for it to unmount — so the
 *  next deep-link open REMOUNTS the License pane and re-queries the cert on disk
 *  (an already-open modal is a no-op for openSettings, leaving a stale pane). */
async function closeSettingsModal(): Promise<void> {
  if (await settingsModalOpen()) {
    await browser.execute(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    await browser.waitUntil(async () => !(await settingsModalOpen()), {
      timeout: 5_000,
      timeoutMsg: "expected Escape to dismiss the Settings modal",
    });
  }
}

/** The License-pane STATUS heading text, scoped INSIDE the Settings dialog with
 *  the "Settings" dialog title dropped (Pitfall 4: an unscoped first-h2 read would
 *  now return "Settings"). Carries the per-state label: "Free" | "Licensed" |
 *  "Licensed (offline)" | "Pro is no longer active" | "License needs attention".
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
function routeHasButton(text: string): Promise<boolean> {
  return browser.execute(
    (label: string) => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!dialog) return false;
      return Array.from(dialog.querySelectorAll("button")).some((b) =>
        (b.textContent ?? "").trim().includes(label),
      );
    },
    text,
  );
}

/** Whether the License pane renders the INLINE "License key" input (the shared
 *  activation surface) — scoped inside the Settings dialog. Phase 22.1 (D-22.1-7):
 *  the problem state no longer offers a modal-opening "Reactivate" button; it
 *  renders the key-input + Activate form INLINE below the status card. This probe
 *  is the calm-reactivation-path proof that replaces the old Reactivate assertion. */
function routeHasKeyInput(): Promise<boolean> {
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

/** Whether the route shows a confirm-first Deactivate trigger — the Pro-active
 *  affordance (only rendered for licensed/offlineGrace). Its ABSENCE is the
 *  fail-closed proof: a corrupt/foreign cert must NEVER expose Pro management. */
function hasDeactivate(): Promise<boolean> {
  return routeHasButton("Deactivate this device");
}

/** Prove entitlements actually dropped to FREE in the problem state — NOT via the
 *  notActivated-only "Unlock Pro" footer (which a problem-state cert never shows:
 *  Sidebar.tsx `hasManageableLicense = licenseState !== "notActivated"` is TRUE
 *  for "problem", so the footer reads "License needs attention" instead). Instead
 *  use the LOCKED-CUSTOMIZATION observable the entitlements spec relies on
 *  (D-26/D-28): when ordering is locked (free), focusing a sidebar row and firing
 *  the real macOS Alt+P chord opens the shared upsell modal rather than pinning.
 *  This is a true entitlements-locked proof, not a label change. Returns true when
 *  the locked chord opened the upsell modal — its problem-state copy ("Your license
 *  file couldn't be verified") is matched by the shared `upsellModalOpen` probe. */
async function lockedCustomizationOpensUpsell(): Promise<boolean> {
  await navigateToTool("protobuf-decoder");
  const order = await readOrder();
  if (order.length === 0) return false;
  const focused = await focusRow(order[0]);
  if (!focused) return false;
  await dispatchAltP();
  return upsellModalOpen();
}

/** Dismiss the upsell modal via Escape so a left-open modal never poisons the
 *  case's screenshot or the finally cleanup. */
function dismissUpsell(): Promise<void> {
  return dispatchKey("Escape", false);
}

/** The footer attention row label (D-43), or null when absent. */
function footerLabel(): Promise<string | null> {
  return browser.execute(() => {
    const btn = Array.from(document.querySelectorAll("aside button")).find((b) => {
      const t = b.textContent ?? "";
      return t.includes("Unlock Pro") || t.includes("License needs attention");
    });
    return btn ? (btn.textContent ?? "").trim() : null;
  });
}

// --- Fixture seeding helpers (own the machine.dev.lic lifecycle) -------------

interface SeedBackup {
  seeded: boolean;
  existed: boolean;
  backup: Buffer | null;
}

/** Back up any existing machine.dev.lic, then write `contents` in its place.
 *  Returns the restore token for `restoreLic` (call it in a finally). */
function seedLic(contents: string | Buffer): SeedBackup {
  const existed = existsSync(LIC_PATH);
  const backup = existed ? readFileSync(LIC_PATH) : null;
  mkdirSync(LIC_DIR, { recursive: true });
  writeFileSync(LIC_PATH, contents);
  return { seeded: true, existed, backup };
}

/** Restore machine.dev.lic to exactly how it was found (T-18-15). */
function restoreLic(token: SeedBackup): void {
  if (!token.seeded) return;
  if (token.existed && token.backup) writeFileSync(LIC_PATH, token.backup);
  else rmSync(LIC_PATH, { force: true });
}

/** Re-mount the route so its mount re-query (pure-local, D-45) re-reads the
 *  seeded machine.dev.lic through the real Rust fail-closed verify path. */
async function remountLicenseRoute(): Promise<void> {
  // Close any open Settings modal FIRST so the deep-link below actually REMOUNTS
  // the License pane (openSettings is a no-op while already open — a stale pane
  // would keep the previous cert's resolved state, D-S6/Pitfall). Then navigate
  // to a tool (the deep-link redirects to "/", so the underlying view is real)
  // and open the modal via the deep-link, waiting for it to mount.
  await closeSettingsModal();
  await navigateToTool("protobuf-decoder");
  await navigateToLicenseRoute();
  await browser.waitUntil(async () => settingsModalOpen(), {
    timeout: 10_000,
    timeoutMsg: "expected the #/settings/license deep-link to open the Settings modal (D-S6)",
  });
}

describe("Ship-gate matrix — fixture-driven cases (real WKWebView)", () => {
  // CASE 4 — a corrupted machine.dev.lic must FAIL CLOSED: the route shows the
  // calm "License needs attention" problem state, Pro management (Deactivate) is
  // NOT offered, the footer swaps to the attention affordance, and entitlements
  // drop to free — proven by LOCKED customization (the Alt+P chord opens the
  // upsell instead of pinning), NOT the notActivated-only "Unlock Pro" footer
  // (the problem state never renders that row — D-88/Sidebar.tsx). Proven against
  // the real Rust Ed25519 fail-closed verify path — T-21-16 (never licensed on a
  // bad cert).
  it("Case 4 — a corrupted machine.lic fails closed to the calm problem state (LIC-06, T-21-16)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    let token: SeedBackup = { seeded: false, existed: false, backup: null };
    try {
      // Garble the cert so Ed25519 verify fails → ProblemKind::Corrupt.
      token = seedLic("not a valid machine certificate — corrupted for case 4");

      await remountLicenseRoute();
      await browser.waitUntil(
        async () => (await statusHeading()) === "License needs attention",
        {
          timeout: 10_000,
          timeoutMsg: `Case 4: expected the calm problem state "License needs attention" for a corrupt machine.lic, got ${JSON.stringify(await statusHeading())}`,
        },
      );

      // Fail-closed: NO Pro management surface, but the calm reactivation path IS
      // offered (D-83). A corrupt cert must never read as licensed (T-21-16).
      // Phase 22.1 (D-22.1-7): the calm path is the INLINE key-input + Activate
      // form below the status card (the old modal-opening Reactivate button is gone).
      assert(
        !(await hasDeactivate()),
        "Case 4: a corrupt cert must NOT expose Pro management (Deactivate) — fail-closed (T-21-16)",
      );
      assert(
        await routeHasKeyInput(),
        "Case 4: the problem state must offer the calm inline reactivation form (License key input, D-22.1-7/D-83)",
      );

      // Entitlements actually dropped to FREE — proven the problem-state-correct
      // way (21-05): NOT the notActivated-only "Unlock Pro" footer (problem shows
      // "License needs attention" instead — Sidebar.tsx hasManageableLicense),
      // but (a) the footer attention affordance, and (b) LOCKED customization:
      // the Alt+P chord opens the upsell instead of pinning (ordering/theming
      // locked = free). Both are real entitlements-locked observables.
      // Close the Settings modal before the sidebar-focused checks below (the
      // modal traps focus + overlays the sidebar; the footer/locked-Alt+P probes
      // read the underlying shell).
      await closeSettingsModal();
      await navigateToTool("protobuf-decoder");
      await browser.waitUntil(
        async () => (await footerLabel()) === "License needs attention",
        {
          timeout: 10_000,
          timeoutMsg: `Case 4: expected the footer "License needs attention" with a corrupt cert, got ${JSON.stringify(await footerLabel())}`,
        },
      );
      assert(
        await lockedCustomizationOpensUpsell(),
        "Case 4: a corrupt cert must drop entitlements to free — the locked Alt+P customization chord must open the upsell modal (ordering/theming locked), not pin",
      );
      await dismissUpsell();

      await remountLicenseRoute();
      await saveScreenshot(
        "ship-gate",
        "ship-gate-case4-corrupt.png",
        "case4-corrupt-fail-closed",
      );
    } finally {
      try {
        restoreLic(token);
        await remountLicenseRoute();
        // Phase 22.1 (D-22.1-6): the restored free state shows the inline upsell
        // pitch heading (no "Free" status card now).
        await browser.waitUntil(
          async () => (await statusHeading()) === "Thank you for using TinkerDev ❤️",
          {
            timeout: 10_000,
            timeoutMsg:
              "Case 4 cleanup: expected the route to return to the free inline upsell after restoring machine.lic",
          },
        );
        await closeSettingsModal(); // leave no modal open for the next spec
      } catch (cleanupError) {
        console.error("[ship-gate] case 4 cleanup failed:", cleanupError);
      }
    }
  });

  // CASE 5 — a COPIED machine.lic from another machine (the committed CE fixture
  // carries the Plan-01 synthetic fingerprint, which never matches this dev
  // machine's real fingerprint) must FAIL CLOSED via the SAME pure-local verify
  // path as case 3's Licensed resolution: a real, signature-valid cert whose
  // FINGERPRINT does not match → ForeignMachine → the calm problem state → free.
  // This is the case-3 network-free local-verify path proven on the real
  // WKWebView (the resolution that would be Licensed for a matched cert is the
  // ForeignMachine fail-closed branch for a foreign cert). T-21-16: a foreign
  // cert must land on free/problem, NEVER licensed.
  it("Case 5 — a copied machine.lic fails closed on a foreign fingerprint (LIC-06, T-21-16)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    assert(
      existsSync(FOREIGN_FP_FIXTURE),
      `Case 5: the committed CE fixture is missing at ${FOREIGN_FP_FIXTURE}`,
    );

    let token: SeedBackup = { seeded: false, existed: false, backup: null };
    try {
      // Seed the byte-verbatim real-CE cert — it verifies (good signature) but its
      // embedded fingerprint is foreign to this machine → ForeignMachine.
      token = seedLic(readFileSync(FOREIGN_FP_FIXTURE));

      await remountLicenseRoute();
      await browser.waitUntil(
        async () => (await statusHeading()) === "License needs attention",
        {
          timeout: 10_000,
          timeoutMsg: `Case 5: expected the calm problem state for a foreign-fingerprint cert, got ${JSON.stringify(await statusHeading())}`,
        },
      );

      // Fail-closed: a signature-valid but foreign cert must NEVER expose Pro
      // management, and must offer the calm reactivation path instead (T-21-16).
      // Phase 22.1 (D-22.1-7): the calm path is the INLINE key-input + Activate form.
      assert(
        !(await hasDeactivate()),
        "Case 5: a foreign-fingerprint cert must NOT expose Pro management — fail-closed (T-21-16)",
      );
      assert(
        await routeHasKeyInput(),
        "Case 5: the foreign-cert problem state must offer the calm inline reactivation form (License key input, D-22.1-7)",
      );

      // Entitlements dropped to FREE (the case-3/5 fail-closed contract) — proven
      // the problem-state-correct way (21-05): the footer attention affordance
      // ("License needs attention", NOT the notActivated-only "Unlock Pro" row)
      // plus the LOCKED customization observable (Alt+P opens the upsell instead
      // of pinning → ordering/theming locked = free).
      // Close the Settings modal before the sidebar-focused checks below (the
      // modal traps focus + overlays the sidebar; the footer/locked-Alt+P probes
      // read the underlying shell).
      await closeSettingsModal();
      await navigateToTool("protobuf-decoder");
      await browser.waitUntil(
        async () => (await footerLabel()) === "License needs attention",
        {
          timeout: 10_000,
          timeoutMsg: `Case 5: expected the footer "License needs attention" with a foreign cert, got ${JSON.stringify(await footerLabel())}`,
        },
      );
      assert(
        await lockedCustomizationOpensUpsell(),
        "Case 5: a foreign cert must drop entitlements to free — the locked Alt+P customization chord must open the upsell modal (ordering/theming locked), not pin",
      );
      await dismissUpsell();

      await remountLicenseRoute();
      await saveScreenshot(
        "ship-gate",
        "ship-gate-case5-foreign.png",
        "case5-foreign-fingerprint",
      );
    } finally {
      try {
        restoreLic(token);
        await remountLicenseRoute();
        // Phase 22.1 (D-22.1-6): the restored free state shows the inline upsell
        // pitch heading (no "Free" status card now).
        await browser.waitUntil(
          async () => (await statusHeading()) === "Thank you for using TinkerDev ❤️",
          {
            timeout: 10_000,
            timeoutMsg:
              "Case 5 cleanup: expected the route to return to the free inline upsell after restoring machine.lic",
          },
        );
        await closeSettingsModal(); // leave no modal open for the next spec
      } catch (cleanupError) {
        console.error("[ship-gate] case 5 cleanup failed:", cleanupError);
      }
    }
  });

  // CASE 3 (network-free local verify) + CASE 6 (TTL grace→refresh) — DOCUMENTED
  // mechanism, not a runtime assertion here. Both Licensed (case 3) and the
  // OfflineGrace/RefreshNeeded transitions (case 6) require a SIGNED cert that
  // cannot be produced from committed material headlessly (a matched live-dev
  // fingerprint / an arbitrary past expiry both need a live CE checkout with the
  // server-side Ed25519 signing key). They are proven authoritatively by the
  // pure-Rust cargo tests:
  //   • Case 3 Licensed + network-free: license::tests::
  //       valid_cert_with_matching_fingerprint_resolves_to_licensed,
  //       resolve_status_never_touches_network_on_the_expiry_path (D-45 NoNetwork
  //       client panics on any call).
  //   • Case 6 grace→lapsed→refresh: license::tests::classify_within_grace_is_grace,
  //       classify_past_grace_is_lapsed, classify_boundaries_are_inclusive_*,
  //       needs_refresh_* (clock-injected `now`, wall-clock-independent).
  // The real-WKWebView half of cases 3/6 (Licensed/offline-grace UI on a genuine
  // activated cert) is covered by the live-build walkthrough. This placeholder
  // test documents that division so a future reader sees WHY they are not driven
  // here, and keeps the file's case list complete. See 21-SHIP-GATE-MATRIX.md.
  it("Cases 3 & 6 — local-verify-network-free + TTL grace are proven by cargo (mechanism documented)", () => {
    // No runtime assertion: the proof lives in the Rust suite (cited above) and
    // the live-build walkthrough. This test exists to document the mechanism
    // explicitly in the e2e matrix (D-90 honesty: record the method per case).
    assert(true, "documentation-only — see the comment above and the matrix doc");
  });
});
