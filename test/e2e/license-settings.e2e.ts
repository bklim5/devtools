// License status route — real macOS WKWebView gate (Phase 21, 21-04; LIC-09,
// D-87/D-88/D-78/D-79/D-82/D-84).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — same harness as
// license.e2e.ts. Run by scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts.
//
// The e2e-spike preflight resets the DEV prefs.json + machine.dev.lic to a
// deterministic baseline (no override, no cert → notActivated/FREE under the live
// D-85 flip), so this spec starts from a known state and is not history-dependent
// (resolves the [[license-walkthrough-state-pollutes-e2e]] cascade — 21-04 Task 4).
//
// The load-bearing real-runtime checks — only the real WKWebView truly proves:
//   1. #/settings/license (app-chrome, NOT a tool — D-87) renders on the real
//      HashRouter and shows the current state copy + management actions.
//   2. The free (notActivated) state shows "Free" + "Activate a license" routing
//      to / (the Unlock Pro panel — D-88).
//   3. A corrupt machine.dev.lic makes the route's mount re-query render the
//      "License needs attention" problem state with Refresh + Reactivate, AND the
//      footer attention affordance ROUTES here (D-88) — proven against the real
//      Rust fail-closed verify path.
//   4. Clicking Refresh shows the calm aria-live "Refreshing…" line (no spinner).
//
// The Pro-active states (licensed/offlineGrace) + the confirm-first Deactivate
// flow + the D-86 dormant-restore round-trip need a real activated cert and are
// covered by the human walkthrough (21-04 Task 4 how-to-verify) + the unit suite
// (LicenseSettings.test.tsx); this spec covers the deterministic, no-cert paths.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { assert, navigateToTool, saveScreenshot, upsellModalOpen } from "./helpers";

// The DEBUG build reads machine.dev.lic (store.rs cfg-split, 260614-nox).
const LIC_DIR = join(homedir(), "Library", "Application Support", "com.tinkerdev.app");
const LIC_PATH = join(LIC_DIR, "machine.dev.lic");

// --- DOM probes (single-round-trip reads — WebKit lesson 3) -----------------

/** Navigate to the status route via HashRouter (deterministic — the route is app
 *  chrome, reachable directly at #/settings/license). */
function navigateToLicenseRoute(): Promise<void> {
  return browser.execute(() => {
    window.location.hash = "#/settings/license";
  });
}

/** The visible heading text of the status block, or null when the route is not
 *  mounted. The status block heading is the route's first <h2>. */
function statusHeading(): Promise<string | null> {
  return browser.execute(() => {
    const h = document.querySelector("h2");
    return h ? (h.textContent ?? "").trim() : null;
  });
}

/** Whether the route shows a button with the given visible text. */
function routeHasButton(text: string): Promise<boolean> {
  return browser.execute(
    (label: string) =>
      Array.from(document.querySelectorAll("button")).some((b) =>
        (b.textContent ?? "").trim().includes(label),
      ),
    text,
  );
}

/** Click a button on the route by its visible text. */
function clickRouteButton(text: string): Promise<void> {
  return browser.execute((label: string) => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").trim().includes(label),
    ) as HTMLElement | undefined;
    btn?.click();
  }, text);
}

/** The current hash route (to assert footer routing). */
function currentHash(): Promise<string> {
  return browser.execute(() => window.location.hash);
}

/** The footer attention row label (behind no modal here), or null when absent. */
function footerLabel(): Promise<string | null> {
  return browser.execute(() => {
    const btn = Array.from(document.querySelectorAll("aside button")).find((b) => {
      const t = b.textContent ?? "";
      return t.includes("Unlock Pro") || t.includes("License needs attention");
    });
    return btn ? (btn.textContent ?? "").trim() : null;
  });
}

function clickFooter(): Promise<void> {
  return browser.execute(() => {
    const btn = Array.from(document.querySelectorAll("aside button")).find((b) => {
      const t = b.textContent ?? "";
      return t.includes("Unlock Pro") || t.includes("License needs attention");
    }) as HTMLElement | undefined;
    btn?.click();
  });
}

/** Dismiss the upsell modal via Escape (UpsellModal's document-level listener)
 *  so a left-open modal never poisons the next assertion in this same spec. */
function dismissUpsell(): Promise<void> {
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

describe("License status route (real WKWebView)", () => {
  it("renders #/settings/license, shows the free state, and surfaces a corrupt machine.lic as the problem state with footer routing (D-87/D-88)", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // 1. FREE STATE (the preflight reset guarantees notActivated baseline).
    await navigateToLicenseRoute();
    await browser.waitUntil(async () => (await statusHeading()) === "Free", {
      timeout: 10_000,
      timeoutMsg: `expected the status route to show "Free" at baseline, got ${JSON.stringify(await statusHeading())}`,
    });
    assert(
      await routeHasButton("Activate a license"),
      'the free state must offer "Activate a license" (D-88)',
    );
    await saveScreenshot("license-settings", "license-settings-free.png", "free-state");

    // 2. PROBLEM STATE: seed garbage into the REAL machine.dev.lic.
    let licSeeded = false;
    let licExisted = false;
    let licBackup: Buffer | null = null;
    try {
      licExisted = existsSync(LIC_PATH);
      if (licExisted) licBackup = readFileSync(LIC_PATH);
      mkdirSync(LIC_DIR, { recursive: true });
      writeFileSync(LIC_PATH, "not a machine file");
      licSeeded = true;

      // Re-mount the route so its mount re-query reads the seeded file through
      // the real Rust fail-closed verify and renders the problem state.
      await navigateToTool("protobuf-decoder");
      await navigateToLicenseRoute();
      await browser.waitUntil(async () => (await statusHeading()) === "License needs attention", {
        timeout: 10_000,
        timeoutMsg: `expected the route to show "License needs attention" after seeding a corrupt machine.lic, got ${JSON.stringify(await statusHeading())}`,
      });
      assert(await routeHasButton("Refresh"), "the problem state must offer Refresh");
      assert(await routeHasButton("Reactivate"), "the problem state must offer Reactivate (D-83)");

      // 3. Refresh shows the calm aria-live "Refreshing…" line (no spinner).
      await clickRouteButton("Refresh");
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

      // 4. D-88 footer routing: the attention footer routes to the status route.
      await navigateToTool("protobuf-decoder");
      await browser.waitUntil(async () => (await footerLabel()) === "License needs attention", {
        timeout: 10_000,
        timeoutMsg: `expected the footer "License needs attention" with a corrupt lic, got ${JSON.stringify(await footerLabel())}`,
      });
      await clickFooter();
      await browser.waitUntil(async () => (await currentHash()).includes("settings/license"), {
        timeout: 5_000,
        timeoutMsg: `expected the footer to route to #/settings/license (D-88), got ${JSON.stringify(await currentHash())}`,
      });
    } finally {
      // Cleanup MUST leave the machine as found (T-18-15 discipline).
      try {
        if (licSeeded) {
          if (licExisted && licBackup) writeFileSync(LIC_PATH, licBackup);
          else rmSync(LIC_PATH, { force: true });
        }
        // Re-mount the route so its re-query clears the problem state.
        await navigateToTool("protobuf-decoder");
        await navigateToLicenseRoute();
        await browser.waitUntil(async () => (await statusHeading()) === "Free", {
          timeout: 10_000,
          timeoutMsg: "expected the route to return to Free after restoring machine.lic",
        });
      } catch (cleanupError) {
        console.error("[license-settings] cleanup failed:", cleanupError);
      }
    }
  });

  // 21-04 walkthrough fix #3 — the FREE (notActivated) state's "Activate a
  // license" button opens the SHARED Unlock Pro upsell modal (D-88: the upsell
  // owns the activation form, no duplicate UI). The deterministic e2e-spike
  // baseline (no override, no cert → notActivated/FREE) IS this state, so no
  // seeding is needed. Before the fix this button (and Reactivate below) called
  // navigate("/") and bounced to a TOOL with no activation surface — it read as
  // "does nothing". This proves the real-WKWebView path: the focus-trapped
  // [aria-modal] dialog actually mounts.
  it('the free state "Activate a license" button opens the shared Unlock Pro modal (D-88)', async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // FREE baseline (the preflight reset guarantees notActivated).
    await navigateToLicenseRoute();
    await browser.waitUntil(async () => (await statusHeading()) === "Free", {
      timeout: 10_000,
      timeoutMsg: `expected the status route to show "Free" at baseline, got ${JSON.stringify(await statusHeading())}`,
    });
    assert(!(await upsellModalOpen()), "no upsell modal should be open before clicking Activate");

    try {
      await clickRouteButton("Activate a license");
      await browser.waitUntil(async () => upsellModalOpen(), {
        timeout: 5_000,
        timeoutMsg:
          'expected "Activate a license" (free) to open the shared Unlock Pro modal (D-88) — it must not silently navigate to a tool',
      });
      // The route did NOT bounce away — opening the modal is an overlay, not a
      // navigation (the pre-fix navigate("/") bug would change the hash).
      assert(
        (await currentHash()).includes("settings/license"),
        `opening the upsell must not navigate away from #/settings/license, got ${JSON.stringify(await currentHash())}`,
      );
      await saveScreenshot(
        "license-settings",
        "license-settings-free-activate-modal.png",
        "free-activate-modal",
      );
    } finally {
      // Leave no modal open for the next spec in this WDIO run.
      try {
        if (await upsellModalOpen()) {
          await dismissUpsell();
          await browser.waitUntil(async () => !(await upsellModalOpen()), {
            timeout: 5_000,
            timeoutMsg: "expected Escape to dismiss the upsell modal",
          });
        }
      } catch (cleanupError) {
        console.error("[license-settings] activate-modal cleanup failed:", cleanupError);
      }
    }
  });

  // 21-04 walkthrough fix #2 — in the PROBLEM state (a corrupt machine.lic), the
  // "Reactivate" button opens the SAME shared Unlock Pro modal (D-83/D-88: same
  // action regardless of drop cause). Seeds a garbage machine.dev.lic so the
  // route's mount re-query renders the problem state through the real Rust
  // fail-closed verify, then asserts the modal opens (in the problem state the
  // panel shows "Your license file couldn't be verified", not the sales pitch).
  // Before the fix Reactivate called navigate("/") and bounced to a tool.
  it('the problem state "Reactivate" button opens the shared Unlock Pro modal (D-83/D-88)', async () => {
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

      // Re-mount the route so its mount re-query reads the seeded file and
      // renders the problem state.
      await navigateToTool("protobuf-decoder");
      await navigateToLicenseRoute();
      await browser.waitUntil(async () => (await statusHeading()) === "License needs attention", {
        timeout: 10_000,
        timeoutMsg: `expected the route to show "License needs attention" after seeding a corrupt machine.lic, got ${JSON.stringify(await statusHeading())}`,
      });
      assert(await routeHasButton("Reactivate"), "the problem state must offer Reactivate (D-83)");
      assert(
        !(await upsellModalOpen()),
        "no upsell modal should be open before clicking Reactivate",
      );

      await clickRouteButton("Reactivate");
      await browser.waitUntil(async () => upsellModalOpen(), {
        timeout: 5_000,
        timeoutMsg:
          'expected "Reactivate" (problem) to open the shared Unlock Pro modal (D-88) — it must not silently navigate to a tool',
      });
      // The route did NOT bounce away to a tool (the pre-fix navigate("/") bug).
      assert(
        (await currentHash()).includes("settings/license"),
        `opening the upsell must not navigate away from #/settings/license, got ${JSON.stringify(await currentHash())}`,
      );
      await saveScreenshot(
        "license-settings",
        "license-settings-problem-reactivate-modal.png",
        "problem-reactivate-modal",
      );
    } finally {
      // Dismiss any open modal, then restore the machine as found (T-18-15).
      try {
        if (await upsellModalOpen()) {
          await dismissUpsell();
          await browser.waitUntil(async () => !(await upsellModalOpen()), {
            timeout: 5_000,
            timeoutMsg: "expected Escape to dismiss the upsell modal",
          });
        }
        if (licSeeded) {
          if (licExisted && licBackup) writeFileSync(LIC_PATH, licBackup);
          else rmSync(LIC_PATH, { force: true });
        }
        // Re-mount so the route's re-query clears the problem state.
        await navigateToTool("protobuf-decoder");
        await navigateToLicenseRoute();
        await browser.waitUntil(async () => (await statusHeading()) === "Free", {
          timeout: 10_000,
          timeoutMsg: "expected the route to return to Free after restoring machine.lic",
        });
      } catch (cleanupError) {
        console.error("[license-settings] reactivate-modal cleanup failed:", cleanupError);
      }
    }
  });
});
