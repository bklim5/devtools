// Snapshot store backing useSyncExternalStore (ENT-03) + the guarded test seam.
//
// The default snapshot is computed SYNCHRONOUSLY from the environment so the
// pre-resolution and post-resolution sets agree whenever no override exists —
// no startup lock-flash (Pitfall 8). refreshEntitlements() (kicked off in
// main.tsx) folds in the persisted D-31 override and, post-Phase-21, the real
// licensed set; it notifies subscribers only when the set actually changes.

import { loadPreferences } from "@/shell/prefsStore";
import { isTestOrDev } from "@/lib/env";
import {
  updatePreferences,
  whenPreferencesLoaded,
} from "@/shell/usePreferences";
import { FREE_SET, isPro, type EntitlementSet } from "./entitlements";
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
// D-23-5 (flash-free Pro launch): false until the FIRST refreshEntitlements()
// completes (success OR failure). Consumers (useAppearance) hold their apply
// until this flips true so the FREE_SET default never clobbers a Pro user's
// theme before the async license resolve lands. setEntitlementsForTest means
// "entitlements are now known", so it sets this true.
let resolved = false;
// Monotonic refresh sequence (Codex finding). refreshEntitlements now has
// OVERLAPPING callers — the boot refresh, the StoreKit transaction listener
// (storeBoot), and the Buy/Restore handlers — so a slow earlier resolveEntitlements()
// can finish AFTER a newer one. Each call claims the next seq; only the latest-started
// call is allowed to commit `current`, so a stale read can never overwrite a newer
// purchase/refund result (no Pro-after-refund / locked-after-purchase).
let refreshSeq = 0;
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

/** Whether the FIRST entitlement resolution has completed (D-23-5). Drives the
 *  flash-free appearance apply gate — see useAppearance. */
export function getEntitlementsResolved(): boolean {
  return resolved;
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
  // Track whether anything observable changed so we notify exactly once at the end
  // — the `resolved` flip (D-23-5) must propagate even when the SET is unchanged
  // (an unlicensed install: FREE_SET → FREE_SET, but `resolved` goes false→true).
  let changed = false;
  // Claim this refresh's slot. A later refresh started after this one supersedes
  // it; this call must not commit its (now stale) read.
  const seq = ++refreshSeq;
  // Capture the pre-resolution Pro state BEFORE `current` is overwritten so a
  // live Pro→not-Pro transition (a refund/revoke landing while the app runs, or a
  // direct-build license lapse) can be detected below (D-07). `current` is the
  // last resolved set, so this is the true "was Pro a moment ago" signal. The seq
  // guard ensures no newer refresh commits between this capture and the commit
  // below, so wasPro stays the true predecessor of the committed set.
  const wasPro = isPro(current);
  try {
    const next = await resolveEntitlements();
    // Drop a stale completion: a newer refresh was started while this one was in
    // flight, so its result is authoritative — committing this older read would
    // resurrect superseded entitlement state.
    if (seq !== refreshSeq) return;
    if (!setsEqual(next, current)) {
      current = next;
      changed = true;
      // D-07 drop-notice: ONLY on an actual live drop out of Pro (was Pro, now
      // not). An unlock (free→Pro) or a free→free no-op never fires it. The flag
      // routes through the SHARED usePreferences singleton (updatePreferences) so
      // it folds into the same in-flight prefs blob the hooks read — never a
      // second loadPreferences/savePreferences snapshot that would clobber a
      // concurrent theme/pins write (memory prefs-blob-single-writer, T-28-08).
      // Ungated by channel: a live Pro→free drop fires the notice on BOTH builds
      // (the store refund path AND a direct license lapse, which today has no
      // caller — a harmless improvement; the notice copy stays channel-generic).
      //
      // GUARD the async-launch window: a refund/revoke delivered moments after
      // boot (via the storeBoot listener) can fire this BEFORE the prefs singleton
      // has hydrated — and updatePreferences() merges into sharedPrefs + latches
      // dirty=true, so an unguarded write would persist DEFAULT_PREFERENCES over
      // the user's real theme/pins AND block the real load (ensurePreferencesLoaded's
      // `if (!dirty)`). whenPreferencesLoaded() defers the flag write until the real
      // blob is in memory (the same protection useUpdater's lastUpdateCheck stamp
      // uses — memory tauri-store-async-init-race + prefs-blob-single-writer).
      if (wasPro && !isPro(next)) {
        void whenPreferencesLoaded().then(() => {
          updatePreferences({ licenseDropNoticeAck: false });
        });
      }
    }
  } finally {
    // D-23-5: the FIRST resolution is now complete (even if resolveEntitlements
    // threw) — release the appearance apply gate.
    if (!resolved) {
      resolved = true;
      changed = true;
    }
    if (changed) notify();
  }
}

/** Clear the persisted D-31 dev free-tier override (walkthrough 2026-06-12
 *  user decision): a SUCCESSFUL license activation is the ONE event allowed to
 *  remove it, so the Pro unlock is immediately visible behind the panel. The
 *  override stays downgrade-only everywhere else (T-18-10 unchanged — this
 *  never writes anything but null). Callers run it BEFORE refreshEntitlements
 *  so the next resolve sees the cleared prefs. */
export async function clearEntitlementsOverride(): Promise<void> {
  // Hydrate the shared prefs singleton BEFORE writing through it. A successful
  // activation fired during the startup load window would otherwise merge into a
  // not-yet-loaded sharedPrefs (DEFAULT_PREFERENCES) and persist defaults over the
  // user's real theme/pins/toolOrder — `await loadPreferences()` hydrates the
  // prefsStore cache, NOT the usePreferences singleton this writes through (Codex
  // finding; memory prefs-blob-single-writer + tauri-store-async-init-race).
  await whenPreferencesLoaded();
  const prefs = await loadPreferences();
  if (prefs.entitlementsOverride === null) return; // nothing persisted — no write
  // Route through the SHARED usePreferences singleton (prefs-blob-single-writer)
  // rather than a bypass loadPreferences→savePreferences snapshot. refreshEntitlements
  // now also writes the blob (the D-07 drop flag); if this writer used a stale
  // snapshot, the two could clobber each other's fields (and a successful activate
  // runs clear → refresh back-to-back). Keeping every override write on the singleton
  // means the drop flag merges into a blob that already carries the cleared override.
  updatePreferences({ entitlementsOverride: null });
}

/** Test seam: force a specific set and notify. No-op in production builds. Forcing
 *  a set means "entitlements are known", so it also marks resolved (D-23-5) — the
 *  appearance apply gate must release for any test that seeds a tier. */
export function setEntitlementsForTest(set: EntitlementSet): void {
  if (!isTestOrDev()) return;
  let changed = false;
  if (!setsEqual(set, current)) {
    current = set;
    changed = true;
  }
  if (!resolved) {
    resolved = true;
    changed = true;
  }
  if (changed) notify();
}

/** Test cleanup: restore the environment default + the unresolved gate and notify.
 *  No-op in production builds. */
export function resetEntitlementsForTest(): void {
  if (!isTestOrDev()) return;
  const next = defaultSet();
  let changed = false;
  if (!setsEqual(next, current)) {
    current = next;
    changed = true;
  }
  if (resolved) {
    resolved = false;
    changed = true;
  }
  if (changed) notify();
}

