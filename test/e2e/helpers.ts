// Shared helpers for the real-WKWebView WDIO specs (test/e2e/*.e2e.ts).
//
// NOT matched by wdio.conf.ts's spec glob ("./test/e2e/*.e2e.ts") — this is a
// plain module the specs import, never a spec itself. It consolidates the
// patterns (and the hard-won WebKit lessons behind them) that were previously
// duplicated verbatim across the per-tool specs. Each lesson below cost a
// debugging session on the real WKWebView — keep the WHY with the fix.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// The exact assertion shape every spec uses: throw with the message so WDIO's
// mocha reporter surfaces it verbatim.
export function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

// Navigate to a tool via HashRouter (deterministic regardless of the
// startup-resolved tool). NOTE the browser.execute closure gotcha: the executed
// function is SERIALIZED over WebDriver — it cannot capture outer variables, so
// the hash travels as a trailing arg.
export function navigateToTool(toolId: string): Promise<void> {
  return browser.execute((hash: string) => {
    window.location.hash = hash;
  }, `#/tools/${toolId}`);
}

// --- Screenshots (the HRN-02 gate artifacts) --------------------------------

export const SCREENSHOT_DIR = resolve(process.cwd(), "test/e2e/__screenshots__");

// Save a screenshot of the real WKWebView into SCREENSHOT_DIR. `label` keeps
// each spec's existing console.log line byte-identical: "real-WKWebView" by
// default, or a state name (e.g. "pinned-state", "locked-upsell") where a spec
// saves more than one artifact.
export async function saveScreenshot(
  tag: string,
  fileName: string,
  label = "real-WKWebView",
): Promise<string> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const path = resolve(SCREENSHOT_DIR, fileName);
  await browser.saveScreenshot(path);
  console.log(`[${tag}] saved ${label} screenshot to ${path}`);
  return path;
}

// --- Keyboard dispatch (WebKit lessons 1 + 2) -------------------------------

// LESSON 1 — WebKit WebDriver drops the Alt modifier.
//
// Drive a keydown via a bubbling KeyboardEvent dispatched on the focused
// element. WHY not browser.keys()/the W3C Actions API: macOS WebKit's embedded
// WebDriver (605.1.15) does NOT deliver the Alt modifier on synthesized key
// actions — the keydown arrives with altKey:false, so an altKey-guarded handler
// (correctly) ignores it (RESEARCH.md:499). React attaches its listeners at the
// document root via native bubbling, so a dispatched bubbling KeyboardEvent on
// the focused element fires the real onKeyDown — the SAME app code path, with
// the real altKey/e.key the handler reads.
//
// In the sidebar the focused element is the ROW (the NavLink <a>), which owns
// the whole keyboard model (plain ↑/↓ + Home/End focus nav, Alt+↑/↓ reorder,
// Alt+P pin); the grip is pointer-only (tabIndex -1, aria-hidden) and carries
// no key handlers.
export function dispatchKey(key: string, altKey: boolean): Promise<void> {
  return browser.execute(
    (k: string, alt: boolean) => {
      const el = document.activeElement as HTMLElement | null;
      el?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: k,
          altKey: alt,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    key,
    altKey,
  );
}

// LESSON 2 — macOS Option+letter COMPOSES to a glyph.
//
// Alt+P on the focused ROW — the pin/unpin chord (D-13/PIN-05), or the upsell
// trigger while ordering is locked (D-28). A bubbling KeyboardEvent (same
// rationale as dispatchKey: WebKit WebDriver drops Alt on synthesized key
// actions). Dispatches the REAL macOS shape: Option+P COMPOSES to "π", so the
// keydown carries `key: "π"` (NOT "p") with `code: "KeyP"` and altKey true.
// This is the exact event the handler sees on the real WKWebView; it FAILS an
// `e.key`-only check and PASSES the `e.code === "KeyP"` fix (D-17 — the prior
// e2e synthesized `key:'p'` and false-positived).
export function dispatchAltP(): Promise<void> {
  return browser.execute(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "π",
        code: "KeyP",
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

// --- Entitlements dev toggle (shared by entitlements + license specs) --------

// Open the ⌘K palette and run the DEV "Toggle free tier (dev)" command via the
// real user path: TYPE "toggle free" (the 18-04 walkthrough regression — the
// command must surface under a query), then ArrowUp wraps the highlight to the
// LAST filtered row (the command appends after any tool matches; a no-op when
// it is the only match), Enter runs it (the palette closes first, then the
// command persists the downgrade-only override and awaits
// refreshEntitlements() — D-31/D-32).
export async function runDevToggle(): Promise<void> {
  // The ⌘K listener lives on window — dispatch the chord there directly.
  await browser.execute(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  const input = await $('input[aria-label="Search tools"]');
  await input.waitForExist({ timeout: 10_000 });

  // TYPE the query through React's controlled-input contract: the native value
  // setter + a bubbling "input" event (a bare .value write is swallowed by
  // React's value tracker and onChange never fires).
  await browser.execute(() => {
    const el = document.querySelector(
      'input[aria-label="Search tools"]',
    ) as HTMLInputElement | null;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, "toggle free");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // The searchable-command regression proof: the typed query SURFACES the row.
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const dialog = document.querySelector('[aria-label="Command palette"]');
        return Array.from(dialog?.querySelectorAll("button") ?? []).some((b) =>
          (b.textContent ?? "").includes("Toggle free tier (dev)"),
        );
      }),
    {
      timeout: 5_000,
      timeoutMsg:
        'expected the typed query "toggle free" to surface the "Toggle free tier (dev)" row (18-04 walkthrough regression)',
    },
  );

  // ArrowUp wraps the highlight from row 0 to the LAST row — the command.
  await browser.execute(() => {
    document.querySelector('input[aria-label="Search tools"]')?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  // Fail loud if the highlighted row is NOT the dev command (Enter would
  // otherwise navigate to a tool and corrupt the rest of the spec).
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const dialog = document.querySelector('[aria-label="Command palette"]');
        const on = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
          b.className.includes("bg-accent-soft"),
        );
        return (on?.textContent ?? "").includes("Toggle free tier (dev)");
      }),
    {
      timeout: 5_000,
      timeoutMsg:
        'expected ArrowUp on the filtered list to highlight the LAST palette row — the "Toggle free tier (dev)" command',
    },
  );
  await browser.execute(() => {
    document.querySelector('input[aria-label="Search tools"]')?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  // The palette closes before the async run lands.
  await browser.waitUntil(
    async () =>
      browser.execute(() => document.querySelector('input[aria-label="Search tools"]') === null),
    { timeout: 5_000, timeoutMsg: "palette did not close after running the dev toggle" },
  );
}

// The D-29 free-tier footer "Unlock Pro" row — the stable free-vs-Pro tier probe
// (present in free tier only). Shared so every spec reads the tier identically.
export function unlockProFooterPresent(): Promise<boolean> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll("aside button")).some((b) =>
      (b.textContent ?? "").includes("Unlock Pro"),
    ),
  );
}

// --- Settings ▸ License pane (the ONE upsell/activation surface) -------------
//
// Phase 22.1-04 (user-approved 2026-06-16): the standalone "Unlock Pro" UpsellModal
// (the focus-trapped dialog uniquely identified by aria-labelledby="upsell-heading")
// was REMOVED. Every former opener — the sidebar footer "Unlock Pro"/"License needs
// attention" row, the locked pin/reorder/reset affordances, and the ⌘K free
// "License" command — now calls openSettings("license", invoker), which opens the
// shell Settings modal on the License pane. The License pane renders the SAME shared
// InlineActivation surface inline, so there is exactly one upsell surface in the app
// (UpsellPanel.tsx header). No [aria-labelledby="upsell-heading"] dialog exists.
//
// Probe for the Settings dialog ON the License pane: the dialog is the
// [role="dialog"][aria-modal="true"] focus-trapped modal (distinguished from the ⌘K
// command palette, which is NOT aria-modal), and the License pane is confirmed by
// its state-adaptive copy inside that dialog. The FREE (notActivated) state shows
// the inline pitch "Thank you for using TinkerDev"; the problem/refreshNeeded
// attention states show "License needs attention" / "Pro is no longer active". Any
// of those confirms the License pane is mounted in the Settings modal — callers
// wanting a specific state read the dialog text/heading themselves.
//
// Kept named `settingsLicensePaneOpen` (clearer), with `upsellModalOpen` retained
// as a back-compat alias so the specs that probed "is the upsell open?" keep reading
// — they now (correctly) assert the Settings ▸ License pane instead of a stacked modal.
export function settingsLicensePaneOpen(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector(
      '[role="dialog"][aria-modal="true"]',
    );
    if (!dialog) return false;
    const text = dialog.textContent ?? "";
    return (
      text.includes("Thank you for using TinkerDev") ||
      text.includes("License needs attention") ||
      text.includes("Pro is no longer active")
    );
  });
}

// Back-compat alias: the former "is the upsell modal open?" probe now resolves to
// "is the Settings ▸ License pane open?" (the single upsell surface, post-22.1-04).
export const upsellModalOpen = settingsLicensePaneOpen;

// Whether a STACKED standalone upsell modal is present — the old modal-on-modal
// guard (D-22.1-4/5). Post-22.1-04 the standalone UpsellModal (uniquely identified
// by aria-labelledby="upsell-heading") was REMOVED, so this is now structurally
// always false; it is kept as an EXPLICIT guard so the License-pane specs can assert
// "no second modal stacked above Settings" without that intent silently flipping to
// "the Settings pane itself" (the `upsellModalOpen` alias would). A regression that
// reintroduced a stacked modal would make this true and fail those assertions.
export function stackedUpsellModalPresent(): Promise<boolean> {
  return browser.execute(
    () =>
      document.querySelector(
        '[role="dialog"][aria-modal="true"][aria-labelledby="upsell-heading"]',
      ) !== null,
  );
}

// --- DEV-only license-state override (the 22.1-04 e2e seam) ------------------
//
// Drive the #[cfg(debug_assertions)] `dev_set_license_state` Tauri command so the
// License pane resolves a SYNTHETIC state (free/licensed/offlineGrace/refreshNeeded/
// problem) without a live CE checkout (which needs a server-side signing key,
// impossible headlessly). `state === null` CLEARS the override (real behavior) — call
// it in an after-hook so the override never leaks to other specs in the WDIO run.
//
// Invoke path: the command runs through window.__TAURI_INTERNALS__.invoke — the SAME
// IPC the app itself uses (withGlobalTauri is off, so window.__TAURI__ is absent, but
// __TAURI_INTERNALS__.invoke is always injected). `browser.execute`'s sync
// executeScript does NOT await a returned Promise, so we await the invoke INSIDE a
// browser.executeAsync callback (WDIO resolves it via the injected `done` callback) —
// the command returns the now-resolved status, so the await guarantees the override
// is live before the caller opens the pane. The override only changes what
// resolve_status* returns; the License pane's mount re-query (refreshLicenseUiDetailed)
// then renders it, so callers re-open the modal AFTER setting the state.
export function setDevLicenseState(state: string | null): Promise<void> {
  return browser.executeAsync(
    (s: string | null, done: (v: unknown) => void) => {
      const internals = (
        window as unknown as {
          __TAURI_INTERNALS__?: {
            invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown>;
          };
        }
      ).__TAURI_INTERNALS__;
      if (!internals) {
        done({ error: "__TAURI_INTERNALS__ unavailable — not in the Tauri WKWebView" });
        return;
      }
      // The Tauri command param is `new_state: Option<String>` → camelCase `newState`.
      internals
        .invoke("dev_set_license_state", { newState: s })
        .then(() => done(null))
        .catch((err: unknown) => done({ error: String(err) }));
    },
    state,
  ).then((result) => {
    if (result && typeof result === "object" && "error" in result) {
      throw new Error(
        `setDevLicenseState(${JSON.stringify(state)}) failed: ${(result as { error: string }).error}`,
      );
    }
  });
}

// --- DEV-only tier control (post-D-85) --------------------------------------
//
// After the Phase 21 D-85 flip an unlicensed in-Tauri install resolves FREE, so
// the e2e baseline (the e2e-spike preflight wipes prefs.json + machine.dev.lic)
// is FREE. Pro-gated UX (reorder/pin/theming) MUST establish Pro first; locked-UX
// checks establish FREE. These two helpers make a spec's required tier EXPLICIT
// and idempotent instead of assuming a baseline.
//
// WHY runDevToggle (not a `window.__devSetTier` JS seam):
// An earlier 21-04 hardening attempt added a deterministic `window.__devSetTier`
// hook in main.tsx (under `import.meta.env.DEV`) and drove it from here. It
// REGRESSED the real-WKWebView gate DETERMINISTICALLY: every run threw "the DEV
// __devSetTier seam is unavailable" because `browser.execute` read
// `window.__devSetTier` as undefined in the served `tauri dev` page (the hook is
// reached via `browser.execute(async fn)`, whose returned Promise WDIO's sync
// executeScript does not await — and the hook never registered observably on the
// realm `browser.execute` runs in). It could not be made reliable HEADLESS, so the
// seam (+ its main.tsx wiring + its check-dev-strip.sh line) was REMOVED. The
// PROVEN path is the ⌘K palette dev-toggle (`runDevToggle()` passed in 5 prior
// real-WKWebView runs), so both helpers drive that — with the original ~1-in-9
// flake HARDENED out (see below).
//
// THE ORIGINAL FLAKE — and the hardening here:
// The dev "Toggle free tier (dev)" command flips the EFFECTIVE tier
// (CommandPalette.tsx): from FREE it grants the DEV-only "full" Pro override, from
// Pro it forces "free". The old helpers had two defects: (1) `runDevToggle()` sat
// OUTSIDE the retry try/catch, so a transient mid-dance WKWebView failure aborted
// the whole helper with NO retry; (2) the toggle is BIDIRECTIONAL on a possibly-
// lagging snapshot, so an over-toggle could leave the WRONG tier. The fix:
//   - runDevToggle() runs INSIDE the try/catch — a transient failure RETRIES.
//   - the effective tier is RE-READ from the footer at the TOP of every attempt,
//     and the toggle only fires when the live tier differs from the target — so a
//     prior over-toggle SELF-CORRECTS on the next pass (it toggles back).
//   - a generous bounded waitUntil lets refreshEntitlements() propagate to the
//     footer before the attempt is judged.
// Only after all bounded attempts fail does the helper throw loud.
//
// runDevToggle() is ALSO exercised on its own in entitlements.e2e.ts as the
// genuine ⌘K-palette regression proof (D-31/D-32 searchable-dev-command).

// Establish the EXACT effective tier via the proven ⌘K dev-toggle, hardened
// against transient mid-dance failures and over-toggle. `target === "free"` means
// the "Unlock Pro" footer MUST be present (the free-only observable invariant);
// `target === "pro"` means it MUST be absent.
async function establishTier(target: "pro" | "free"): Promise<void> {
  const wantFree = target === "free";
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Re-read the EFFECTIVE tier each attempt so an earlier over-toggle (or a
      // lagging snapshot from the last pass) self-corrects: only toggle when the
      // live tier differs from the requested target.
      const free = await unlockProFooterPresent();
      if (free === wantFree) return; // already at the target — idempotent no-op

      // The toggle and the footer wait are BOTH inside the try: a transient
      // mid-dance WKWebView failure (the ~1-in-9 flake) RETRIES instead of
      // aborting the helper.
      await runDevToggle();
      await browser.waitUntil(
        async () => (await unlockProFooterPresent()) === wantFree,
        {
          timeout: 8_000,
          interval: 200,
          timeoutMsg: `${target} tier not live yet (footer did not propagate)`,
        },
      );
      return; // the live snapshot now matches the requested target
    } catch {
      // Transient failure or non-propagation — loop and re-read the tier; the
      // next pass toggles only if still off-target (so over-toggle self-corrects).
    }
  }
  throw new Error(
    wantFree
      ? 'could not establish the free tier via the ⌘K dev toggle (the "Unlock Pro" footer never appeared)'
      : "could not establish Pro tier via the ⌘K dev toggle (the free-tier footer never cleared) — Pro-gated assertions cannot run",
  );
}

// Ensure Pro is the live effective tier (idempotent — a no-op if already Pro).
export async function ensureProTier(): Promise<void> {
  await establishTier("pro");
}

// Ensure FREE is the live effective tier (idempotent — a no-op if already free).
export async function ensureFreeTier(): Promise<void> {
  await establishTier("free");
}

// --- Sidebar DOM readers (WebKit lesson 3) ----------------------------------

// LESSON 3 — stale chained element handles.
//
// WebKit's embedded WebDriver goes STALE on chained element handles across
// navigation/re-render (the url.e2e lesson) — so read DOM state in a SINGLE
// browser.execute round-trip instead of holding handles across steps. The
// readers below are the shared sidebar-state probes built on that rule.

// Read the visible sidebar order from the grip handles' aria-labels
// ("Reorder {name}" -> "{name}"), in DOM order.
export function readOrder(): Promise<string[]> {
  return browser.execute(() =>
    Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).map((b) =>
      (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
    ),
  );
}

// The pinned group's tool names (the handles inside the [role=group][aria-label=
// "Pinned tools"] wrapper). Empty when no group is rendered (zero pinned, PIN-03).
export function readPinnedOrder(): Promise<string[]> {
  return browser.execute(() => {
    const grp = document.querySelector('[role="group"][aria-label="Pinned tools"]');
    if (!grp) return [];
    return Array.from(grp.querySelectorAll('button[aria-label^="Reorder "]')).map((b) =>
      (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
    );
  });
}

// Focus the ROW (the NavLink <a>) for the named tool, so the next dispatchKey
// targets the element that owns the keyboard model. The row is located via its
// grip's stable `aria-label="Reorder {name}"` (the grip is pointer-only chrome
// but still the per-row marker), then `.closest()` up to the row wrapper and
// down to the <a>. Returns true if the row <a> received focus.
export function focusRow(name: string): Promise<boolean> {
  return browser.execute((n: string) => {
    const grip = Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).find(
      (b) => b.getAttribute("aria-label") === `Reorder ${n}`,
    );
    // The row wrapper is the nearest ancestor that also contains the NavLink <a>.
    const link = grip?.closest("div")?.querySelector("a") as HTMLAnchorElement | null;
    link?.focus();
    return document.activeElement === link;
  }, name);
}
