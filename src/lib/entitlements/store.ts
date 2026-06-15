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

