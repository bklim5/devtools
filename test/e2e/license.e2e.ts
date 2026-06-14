// License activation UX — real macOS WKWebView gate (Phase 19, 19-04; LIC-01/
// LIC-06, D-33/D-34/D-37/D-43/D-44, threats T-19-21/T-19-22).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only) — same harness as
// entitlements.e2e.ts. Run by scripts/e2e-spike.sh; auto-discovered by
// wdio.conf.ts. `tauri dev` serves a DEV bundle, so the D-32 "Toggle free tier
// (dev)" palette command exists here (the release entry point is the D-43
// attention footer instead — walkthrough coverage).
//
// The load-bearing real-runtime checks — only the real WKWebView truly proves:
//   1. Flow A (form mechanics): the D-22 button reveals the inline key form in
//      place (D-33); submitting a key drives the real Rust activate command —
//      the aria-live region shows a status and then SOME inline error renders
//      (the local CE may or may not be up — the assertion is error-region-non-
//      empty, not a specific message) while the field RETAINS its value (D-37).
//   2. Flow B (fail-closed surfacing): garbage seeded into the REAL app-data
//      machine.lic (`~/Library/Application Support/com.tinkerdev.app/`) makes
//      the panel's mount re-query render the D-44 problem state and the footer
//      swap to "License needs attention" (D-43) — no crash, no interruption
//      (T-19-22), proven against the real Rust verify path.
//
// Cleanup discipline (T-18-15 precedent): the finally block restores/deletes
// the seeded machine.lic, re-queries status so the attention state clears, and
// untoggles the free tier — a failed run must not poison later specs or leave
// a fake license problem on the dev machine.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  assert,
  dispatchKey,
  ensureFreeTier,
  ensureProTier,
  navigateToTool,
  saveScreenshot,
} from "./helpers";

// The REAL app-data path (tauri.conf.json identifier com.tinkerdev.app) — the
// same file the Rust license_status command reads. This e2e runs against
// `tauri dev` (a DEBUG build), which post-260614 reads `machine.dev.lic` (the
// store.rs cfg-split that isolates dev/e2e from a shipped buyer's machine.lic).
// Seeding must target that debug filename or the app never sees the corruption.
const LIC_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "com.tinkerdev.app",
);
const LIC_PATH = join(LIC_DIR, "machine.dev.lic");

const TEST_KEY = "TEST-KEY-E2E";

// --- DOM probes (single-round-trip reads — WebKit lesson 3) -----------------

// The shared upsell dialog (aria-labelledby is its stable marker; the ⌘K
// palette dialog carries aria-label="Command palette" instead).
function upsellDialogOpen(): Promise<boolean> {
  return browser.execute(
    () =>
      document.querySelector(
        '[role="dialog"][aria-labelledby="upsell-heading"]',
      ) !== null,
  );
}

// The footer row's current label, or null when absent. ONE row carries both
// states: "Unlock Pro" (D-29 free tier) / "License needs attention" (D-43).
function footerLabel(): Promise<string | null> {
  return browser.execute(() => {
    const btn = Array.from(document.querySelectorAll("aside button")).find(
      (b) => {
        const t = b.textContent ?? "";
        return t.includes("Unlock Pro") || t.includes("License needs attention");
      },
    );
    return btn ? (btn.textContent ?? "").trim() : null;
  });
}

function clickFooter(): Promise<void> {
  return browser.execute(() => {
    const btn = Array.from(document.querySelectorAll("aside button")).find(
      (b) => {
        const t = b.textContent ?? "";
        return t.includes("Unlock Pro") || t.includes("License needs attention");
      },
    ) as HTMLElement | undefined;
    btn?.click();
  });
}

// Click a button inside the upsell dialog by its visible text.
function clickDialogButton(text: string): Promise<void> {
  return browser.execute((label: string) => {
    const dialog = document.querySelector(
      '[role="dialog"][aria-labelledby="upsell-heading"]',
    );
    const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
      (b.textContent ?? "").includes(label),
    ) as HTMLElement | undefined;
    btn?.click();
  }, text);
}

// The revealed key input inside the dialog (the form's only text input).
function keyInputValue(): Promise<string | null> {
  return browser.execute(() => {
    const input = document.querySelector(
      '[role="dialog"][aria-labelledby="upsell-heading"] form input[type="text"]',
    ) as HTMLInputElement | null;
    return input ? input.value : null;
  });
}

// The single aria-live status/error line under the field (D-34/D-37).
function statusLineText(): Promise<string> {
  return browser.execute(() => {
    const live = document.querySelector(
      '[role="dialog"][aria-labelledby="upsell-heading"] [aria-live="polite"]',
    );
    return (live?.textContent ?? "").trim();
  });
}

// Whether the dialog shows the D-44 problem heading.
function problemHeadingVisible(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector(
      '[role="dialog"][aria-labelledby="upsell-heading"]',
    );
    return (dialog?.textContent ?? "").includes("couldn't be verified");
  });
}

// Type into the revealed key input through React's controlled-input contract
// (native value setter + bubbling "input" event — a bare .value write is
// swallowed by React's value tracker).
function typeKey(value: string): Promise<void> {
  return browser.execute((v: string) => {
    const input = document.querySelector(
      '[role="dialog"][aria-labelledby="upsell-heading"] form input[type="text"]',
    ) as HTMLInputElement | null;
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

// Open the panel via the footer and wait for the dialog.
async function openPanel(): Promise<void> {
  await clickFooter();
  await browser.waitUntil(upsellDialogOpen, {
    timeout: 5_000,
    timeoutMsg: "expected the footer click to open the shared upsell dialog",
  });
}

// Close the dialog via Escape (document-level listener — bubble it from the
// focused element inside the dialog, same as entitlements.e2e.ts).
async function closePanel(): Promise<void> {
  if (await upsellDialogOpen()) {
    await dispatchKey("Escape", false);
    await browser.waitUntil(async () => !(await upsellDialogOpen()), {
      timeout: 5_000,
      timeoutMsg: "expected Escape to dismiss the upsell dialog",
    });
  }
}

describe("License activation UX (real WKWebView)", () => {
  it("reveals the inline form, renders errors with value retention (D-33/D-37), and surfaces a corrupt machine.lic as footer attention + panel problem state (D-43/D-44)", async () => {
    // Land on a deterministic tool so the shell + sidebar are mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // BASELINE TIER: post-D-85 the e2e baseline is FREE (the unlicensed in-Tauri
    // flip; the e2e-spike preflight wipes prefs.json + machine.dev.lic). Establish
    // Pro first so the cleanup below has a deterministic "Pro restored" end state
    // and toggledFree tracks an actual Pro→free transition.
    await ensureProTier();

    let toggledFree = false;
    let licSeeded = false;
    let licExisted = false;
    let licBackup: Buffer | null = null;
    try {
      // ---------------- Flow A: form mechanics (D-33/D-34/D-37) ------------
      // Drop to FREE so the "Unlock Pro" footer (the only standing affordance that
      // opens the activation panel) is present.
      await ensureFreeTier();
      toggledFree = true;
      await browser.waitUntil(
        async () => (await footerLabel()) === "Unlock Pro",
        {
          timeout: 10_000,
          timeoutMsg:
            'expected the free-tier "Unlock Pro" footer row after the dev toggle (D-29)',
        },
      );

      await openPanel();
      // D-33: the D-22 button reveals the key form IN PLACE — same dialog.
      await clickDialogButton("I have a license key");
      await browser.waitUntil(async () => (await keyInputValue()) !== null, {
        timeout: 5_000,
        timeoutMsg:
          'expected "I have a license key" to reveal the inline key input (D-33)',
      });

      await typeKey(TEST_KEY);
      assert(
        (await keyInputValue()) === TEST_KEY,
        "the key input did not accept the typed value",
      );
      await clickDialogButton("Activate");

      // D-34: the aria-live region shows a status... then D-37: SOME inline
      // error renders (CE may or may not be running — assert non-empty +
      // not-in-flight, never a specific message; reqwest's timeout is 15s, so
      // allow 30s).
      await browser.waitUntil(
        async () => {
          const text = await statusLineText();
          return text !== "" && !text.includes("Activating");
        },
        {
          timeout: 30_000,
          timeoutMsg:
            "expected an inline activation error in the aria-live region (D-37)",
        },
      );
      // D-37: the field RETAINS its value for correction.
      assert(
        (await keyInputValue()) === TEST_KEY,
        `the key field must keep its value after an error (D-37), got ${JSON.stringify(await keyInputValue())}`,
      );
      await saveScreenshot("license", "license-error-retention.png", "activation-error");

      // ------------- Flow B: fail-closed surfacing (D-43/D-44) -------------
      // Seed garbage into the REAL machine.lic (backing up any existing file).
      licExisted = existsSync(LIC_PATH);
      if (licExisted) licBackup = readFileSync(LIC_PATH);
      mkdirSync(LIC_DIR, { recursive: true });
      writeFileSync(LIC_PATH, "not a machine file");
      licSeeded = true;

      // Reopen the panel: the mount re-query (pure-local) reads the seeded
      // file through the real Rust fail-closed verify and renders D-44.
      await closePanel();
      await openPanel();
      await browser.waitUntil(problemHeadingVisible, {
        timeout: 10_000,
        timeoutMsg:
          'expected the D-44 problem heading ("couldn\'t be verified") after seeding a corrupt machine.lic',
      });
      // D-43: the footer (behind the modal) now shows the attention state.
      await browser.waitUntil(
        async () => (await footerLabel()) === "License needs attention",
        {
          timeout: 10_000,
          timeoutMsg:
            'expected the footer to read "License needs attention" (D-43)',
        },
      );
      await saveScreenshot("license", "license-problem-state.png", "problem-state");
    } finally {
      // Cleanup MUST leave the machine as found (T-18-15 discipline). Best-
      // effort under a failure — an assertion error above wins over a cleanup
      // error.
      try {
        // 1. Restore/delete the seeded machine.lic FIRST.
        if (licSeeded) {
          if (licExisted && licBackup) writeFileSync(LIC_PATH, licBackup);
          else rmSync(LIC_PATH, { force: true });
        }
        // 2. Re-query status so the attention state clears (open + close the
        //    panel — the mount refresh is the only re-read path, D-45).
        await closePanel();
        if ((await footerLabel()) === "License needs attention") {
          await openPanel();
          await closePanel();
          await browser.waitUntil(
            async () => (await footerLabel()) !== "License needs attention",
            {
              timeout: 10_000,
              timeoutMsg:
                "expected the attention state to clear after restoring machine.lic",
            },
          );
        }
        // 3. Re-establish Pro (clears the persisted free override AND survives the
        //    racy dev-toggle→refreshEntitlements propagation via ensureProTier's
        //    retry — a single runDevToggle could leave FREE if the one flip missed).
        //    Under Pro the "Unlock Pro" footer is gone, the deterministic end state.
        if (toggledFree) {
          await ensureProTier();
        }
      } catch (cleanupError) {
        console.error("[license] cleanup failed:", cleanupError);
      }
    }

    // Default state returned: no footer row at all — Pro is live (the dev "full"
    // override resolves FULL post-D-85), so neither the "Unlock Pro" free row nor
    // the "License needs attention" hint renders.
    await browser.waitUntil(async () => (await footerLabel()) === null, {
      timeout: 10_000,
      timeoutMsg: `expected the footer row gone after re-establishing Pro in cleanup, got ${JSON.stringify(await footerLabel())}`,
    });
  });
});
