// Snapshot store backing useSyncExternalStore (ENT-03) + the guarded test seam.
//
// The default snapshot is computed SYNCHRONOUSLY from the environment so the
// pre-resolution and post-resolution sets agree whenever no override exists —
// no startup lock-flash (Pitfall 8). refreshEntitlements() (kicked off in
// main.tsx) folds in the persisted D-31 override and, post-Phase-21, the real
// licensed set; it notifies subscribers only when the set actually changes.

import { FREE_SET, FULL_SET, type EntitlementSet } from "./entitlements";
import { isTauriEnv, resolveEntitlements } from "./resolve";

/** The environment base BEFORE async resolution (Tauri → FULL, browser → FREE). */
function defaultSet(): EntitlementSet {
  return isTauriEnv() ? FULL_SET : FREE_SET;
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
