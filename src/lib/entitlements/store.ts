// Snapshot store backing useSyncExternalStore (ENT-03) + the guarded test seam.
//
// The default snapshot is computed SYNCHRONOUSLY from the environment so the
// pre-resolution and post-resolution sets agree whenever no override exists —
// no startup lock-flash (Pitfall 8). refreshEntitlements() (kicked off in
// main.tsx) folds in the persisted D-31 override and, post-Phase-21, the real
// licensed set; it notifies subscribers only when the set actually changes.

import { loadPreferences, savePreferences } from "@/shell/prefsStore";
import { FREE_SET, type EntitlementSet } from "./entitlements";
import { resolveEntitlements } from "./resolve";

/** The synchronous default BEFORE async resolution. Phase 21 flip (D-85): the
 *  in-Tauri base is no longer a blanket FULL_SET — it now depends on the licensed
 *  state, which is only knowable after the async `license_status` read. So the
 *  pre-resolution default is FREE everywhere (Tauri AND browser): an unlicensed
 *  install shows the correct locked state immediately, and a licensed install
 *  flips UP to Pro on the first refreshEntitlements() (kicked off in main.tsx).
 *  Defaulting locked-then-unlock is the calm direction — never a flash of Pro
 *  that then snaps to locked (ENT-04). */
function defaultSet(): EntitlementSet {
  return FREE_SET;
}

let current: EntitlementSet = defaultSet();
const listeners = new Set<() => void>();

function setsEqual(a: EntitlementSet, b: EntitlementSet): boolean {
  if (a.size !== b.size) return false;
  for (const e of a) if (!b.has(e)) return false;
  return true;
}

function notify(): void {
  for (const fn of listeners) fn();
}

export function getEntitlementsSnapshot(): EntitlementSet {
  return current;
}

export function subscribeEntitlements(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Re-resolve via resolveEntitlements() and propagate to ALL subscribers —
 *  but only when the set actually CHANGED (set-equality short-circuit, so a
 *  no-op refresh never re-renders every consumer). */
export async function refreshEntitlements(): Promise<void> {
  const next = await resolveEntitlements();
  if (setsEqual(next, current)) return;
  current = next;
  notify();
}

/** Clear the persisted D-31 dev free-tier override (walkthrough 2026-06-12
 *  user decision): a SUCCESSFUL license activation is the ONE event allowed to
 *  remove it, so the Pro unlock is immediately visible behind the panel. The
 *  override stays downgrade-only everywhere else (T-18-10 unchanged — this
 *  never writes anything but null). Callers run it BEFORE refreshEntitlements
 *  so the next resolve sees the cleared prefs. */
export async function clearEntitlementsOverride(): Promise<void> {
  const prefs = await loadPreferences();
  if (prefs.entitlementsOverride === null) return; // nothing persisted — no write
  await savePreferences({ ...prefs, entitlementsOverride: null });
}

/** True under vitest or a dev build — never in a production bundle. Same guard
 *  as setPlatformForTest (src/lib/platform/index.ts). */
function isTestOrDev(): boolean {
  const env = (import.meta as { env?: { MODE?: string; DEV?: boolean } }).env;
  return env?.MODE === "test" || env?.DEV === true;
}

/** Test seam: force a specific set and notify. No-op in production builds. */
export function setEntitlementsForTest(set: EntitlementSet): void {
  if (!isTestOrDev()) return;
  if (setsEqual(set, current)) return;
  current = set;
  notify();
}

/** Test cleanup: restore the environment default and notify. No-op in
 *  production builds. */
export function resetEntitlementsForTest(): void {
  if (!isTestOrDev()) return;
  const next = defaultSet();
  if (setsEqual(next, current)) return;
  current = next;
  notify();
}

/** A deterministic DEV/e2e tier target — the EXACT effective tier to establish,
 *  NOT a toggle. `"pro"` writes the DEV-only `"full"` override (→ FULL_SET under
 *  `import.meta.env.DEV`), `"free"` writes the downgrade-only `"free"` override
 *  (→ FREE_SET in any build), `"default"` clears the override (→ the environment
 *  base resolves). */
export type DevTier = "pro" | "free" | "default";

const TIER_OVERRIDE: Record<DevTier, "free" | "full" | null> = {
  pro: "full",
  free: "free",
  default: null,
};

/** DEV/e2e seam (post-D-85, 21-04 hardening): SET the effective tier to an EXACT
 *  target and await the resolved entitlement set, idempotently. This replaces the
 *  e2e helpers' old read-then-flip dance over the ⌘K palette (~6 timing-sensitive
 *  WKWebView steps that could lag the entitlements snapshot and oscillate the
 *  WRONG way). It writes the persisted override that maps to `target` then awaits
 *  `refreshEntitlements()`, so a caller never depends on reading-then-flipping.
 *
 *  Idempotent: re-setting the same target is a cheap no-op refresh (set-equality
 *  short-circuit). Reuses the SAME `savePreferences` + `refreshEntitlements` path
 *  the ⌘K dev command uses, so it drives the one live entitlement channel every
 *  gate consumer reads.
 *
 *  STRICTLY DEV-only: no-op (returns without writing) outside `isTestOrDev()`, so
 *  it can never alter production behavior. The `"full"` value it writes for `"pro"`
 *  is the same DEV-only Pro override that is tree-shaken + coercer-nulled out of
 *  every release bundle (resolve.ts / prefsStore.ts) — proven absent from
 *  dist/assets by scripts/check-dev-strip.sh. The prod downgrade-only invariant
 *  (T-18-10/T-21-15) is untouched. */
export async function setDevTier(target: DevTier): Promise<void> {
  if (!isTestOrDev()) return;
  const override = TIER_OVERRIDE[target];
  const prefs = await loadPreferences();
  if (prefs.entitlementsOverride !== override) {
    await savePreferences({ ...prefs, entitlementsOverride: override });
  }
  // Always refresh — the persisted override is the source of truth and the
  // live snapshot must reflect the requested target deterministically (a no-op
  // when the set is already correct, via refreshEntitlements' set-equality).
  await refreshEntitlements();
}
