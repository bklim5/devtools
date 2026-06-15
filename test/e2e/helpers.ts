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

// Whether the shared Unlock Pro upsell MODAL is open — the focus-trapped
// [role="dialog"][aria-modal="true"] UpsellModal mounted at the shell (App.tsx)
// via the upsellStore. This is the SAME surface the footer "Unlock Pro" row, the
// locked Alt+P chord, the ⌘K free-tier "License" command, and LicenseSettings'
// Reactivate/Activate buttons all open (D-88 — no duplicate UI). Distinguished
// from the ⌘K command palette dialog (which is NOT aria-modal) by the modal flag.
//
// The panel inside ADAPTS on the resolved license state (UpsellPanel): the FREE
// (notActivated) tier shows "Thank you for using TinkerDev"; the D-44 problem
// state shows "Your license file couldn't be verified" (a paying customer never
// sees the sales pitch). Both ARE the upsell modal, so this probe matches either
// heading — callers wanting a specific copy can read the dialog text themselves.
export function upsellModalOpen(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return false;
    const text = dialog.textContent ?? "";
    return (
      text.includes("Thank you for using TinkerDev") ||
      text.includes("Your license file couldn't be verified")
    );
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
