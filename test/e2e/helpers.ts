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
    Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).map(
      (b) => (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
    ),
  );
}

// The pinned group's tool names (the handles inside the [role=group][aria-label=
// "Pinned tools"] wrapper). Empty when no group is rendered (zero pinned, PIN-03).
export function readPinnedOrder(): Promise<string[]> {
  return browser.execute(() => {
    const grp = document.querySelector('[role="group"][aria-label="Pinned tools"]');
    if (!grp) return [];
    return Array.from(grp.querySelectorAll('button[aria-label^="Reorder "]')).map(
      (b) => (b.getAttribute("aria-label") ?? "").replace(/^Reorder /, ""),
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
    const grip = Array.from(
      document.querySelectorAll('button[aria-label^="Reorder "]'),
    ).find((b) => b.getAttribute("aria-label") === `Reorder ${n}`);
    // The row wrapper is the nearest ancestor that also contains the NavLink <a>.
    const link = grip?.closest("div")?.querySelector("a") as
      | HTMLAnchorElement
      | null;
    link?.focus();
    return document.activeElement === link;
  }, name);
}
