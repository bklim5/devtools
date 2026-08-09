// usePreferences — typed hook over the platform Store seam (SHL-05, D-08/D-10).
//
// On mount it loads the prefs blob asynchronously; until that resolves it
// returns DEFAULT_PREFERENCES (no flash of undefined). Each setter updates local
// state AND writes the whole blob through `platform.store.set` (Pattern 3) —
// write on change only, never per render (Pitfall 5).
//
// This hook NEVER imports @tauri-apps — it goes through `platform.store`, which
// the seam routes to the real impl (tauri.ts) or the browser/in-memory fallback.

import { useCallback, useEffect, useState } from "react";
import { isTestOrDev } from "@/lib/env";
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type ProtobufTreeStyle,
  type ThemeName,
} from "./preferences";
import { loadPreferencesResult, savePreferences } from "./prefsStore";

// --- Cross-instance shared prefs store (Rule 1 fix, Phase 23-03) -------------
//
// usePreferences was per-component local state, so a write in one mounted
// instance (e.g. the Appearance pane's Save) NEVER reached another (e.g. the
// App-root useAppearance effect that applies theme live). The live whole-app
// apply (D-23-9) requires every instance to observe the same writes, so the
// current blob + loaded flag live in a module singleton and every instance
// subscribes — the standard module-singleton + listener pattern already used by
// settingsStore / the entitlements store. The public hook API is unchanged.
let sharedPrefs: Preferences = DEFAULT_PREFERENCES;
let sharedLoaded = false;
// True only when sharedPrefs came from a SUCCESSFUL persisted store read (not the
// fail-soft DEFAULT fallback after a read/init error). Auto-writers that fire near
// launch (the updater lastUpdateCheck stamp) gate on this so a transient read
// failure can never persist DEFAULT_PREFERENCES over the user's real on-disk blob.
let sharedLoadOk = false;
let loadStarted = false;
// True once ANY setter has written — the async mount-load must not clobber a
// value the user already changed (Pitfall 3 timing).
let dirty = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

// Monotonic version of `sharedPrefs`, bumped by EVERY mutation. A save records
// the version of the snapshot it wrote, so a write that lands WHILE a save is in
// flight is not mistaken for "already on disk" when that older save resolves
// (see `persistShared`).
let prefsVersion = 0;

function setSharedPrefs(next: Preferences): void {
  sharedPrefs = next;
  prefsVersion++;
  notify();
}

// --- Module-scope singleton primitives (Phase 23 round-3 unification) --------
//
// These are THE single in-memory source of truth + THE single writer for the
// prefs blob. usePreferences AND useRecentTools both consume them, so a write
// from either hook always merges against the LIVE `sharedPrefs` — there is no
// second mount-era snapshot to go stale and clobber the other hook's fields
// (the theme/pins-revert-after-tool-switch bug). Both hooks keep their public
// APIs unchanged; they are thin consumers of these primitives.
//
// NOTE: the direct disk writers in src/lib/entitlements/store.ts
// (clearEntitlementsOverride) and src/components/CommandPalette.tsx (the
// DEV-only "Toggle free tier" command) still go straight through
// loadPreferences→savePreferences and BYPASS this singleton. They write only
// `entitlementsOverride`, which is DEV/test-only (in release the dev toggle is
// tree-shaken and "full" coerces to null), so they are not part of the
// user-visible theme/pins clobber. Unifying them is deferred.

/** Read the live shared prefs blob. */
export function getSharedPreferences(): Preferences {
  return sharedPrefs;
}

/** True once the async mount-load has resolved. */
export function getPreferencesLoaded(): boolean {
  return sharedLoaded;
}

/** True once the mount-load resolved AND it came from a successful persisted read
 *  (not the DEFAULT fallback after a store/init error). Auto-writers gate persisting
 *  on this so a transient read failure never clobbers the real on-disk blob. */
export function getPreferencesLoadOk(): boolean {
  return sharedLoadOk;
}

/** Subscribe to shared-prefs changes; returns an unsubscribe fn. */
export function subscribePreferences(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Kick off the load-once-per-session of the persisted blob. Idempotent: the
 *  first caller starts it, later callers no-op. A user write before the load
 *  resolves sets `dirty` so the load only flips the loaded flag and never
 *  clobbers a value the user already changed (Pitfall 3 timing). */
export function ensurePreferencesLoaded(): void {
  if (loadStarted) return;
  loadStarted = true;
  void loadPreferencesResult().then(({ prefs, ok }) => {
    if (!dirty) sharedPrefs = prefs;
    sharedLoadOk = ok;
    sharedLoaded = true;
    notify();
  });
}

/** Resolves once the async mount-load of the persisted blob has landed (or
 *  immediately if it already has). Lets a NON-React writer (the updater
 *  singleton's lastUpdateCheck stamp, Plan 03) wait for the REAL persisted prefs
 *  before merging a field, so it can never persist DEFAULT_PREFERENCES+stamp over
 *  the user's real blob during the load window (memory tauri-store-async-init-race
 *  + prefs-blob-single-writer). It also KICKS the load (ensurePreferencesLoaded)
 *  so a stamp that fires before any hook mounted still resolves.
 *
 *  Additive-only: it reads the existing latches (loadStarted / dirty / sharedLoaded
 *  via ensurePreferencesLoaded + getPreferencesLoaded + subscribePreferences) and
 *  changes NONE of their semantics. */
export function whenPreferencesLoaded(): Promise<void> {
  ensurePreferencesLoaded(); // idempotent kick — resolves even if no hook mounted
  if (getPreferencesLoaded()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = subscribePreferences(() => {
      if (getPreferencesLoaded()) {
        unsubscribe();
        resolve();
      }
    });
  });
}

export interface UpdatePreferencesOptions {
  /** `"now"` (default) writes the whole blob to disk immediately.
   *
   *  `"deferred"` merges + notifies IN MEMORY but does NOT write. It exists for
   *  high-frequency bookkeeping fields whose loss on a hard kill is acceptable —
   *  today only UP5-01's `toolSuccessCount`, which would otherwise rewrite the
   *  entire prefs blob to disk after every settled tool success. The pending
   *  write lands at the next NON-deferred write (savePreferences persists the
   *  whole blob, so any other setter carries it along for free) or at
   *  `flushPreferences()`, which the window-hidden / pagehide listeners below
   *  call. In-memory state is ALWAYS current either way, so every gate that
   *  reads the blob keeps exact semantics — only the I/O is bounded. */
  persist?: "now" | "deferred";
}

/** True while the IN-MEMORY blob is ahead of the on-disk one: a `"deferred"`
 *  write has not been persisted yet, OR a save is in flight, OR the last save
 *  FAILED.
 *
 *  It is cleared ONLY when a save RESOLVES successfully (and only if nothing
 *  changed the blob after the snapshot that save wrote). Clearing it up-front —
 *  as this module used to — silently dropped the outstanding write whenever the
 *  save rejected or the webview was torn down mid-save, with no retry: the
 *  pending counter was gone and `flushPreferences` had nothing left to do. */
let unsavedChanges = false;

/** Serializes saves. Without it, two overlapping `store.set`s can resolve out of
 *  order and leave an OLDER blob on disk. Also makes "await durability" mean what
 *  it says: a durable write cannot resolve before the writes queued ahead of it. */
let saveChain: Promise<void> = Promise.resolve();

/** Write the CURRENT shared blob to the store, behind the save chain.
 *
 *  Resolves `true` when the blob reached the store, `false` when the write
 *  failed (logged in dev/test only — a prefs write failure is never fatal and
 *  must never throw into a React effect or park a caller's queue).
 *
 *  The snapshot + version are taken when this save actually RUNS, so queued
 *  saves coalesce onto the latest blob; the version guard then means a write
 *  that lands mid-save keeps `unsavedChanges` set for the next flush. */
function persistShared(): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    const snapshot = sharedPrefs;
    const version = prefsVersion;
    try {
      await savePreferences(snapshot);
    } catch (err) {
      // Leave `unsavedChanges` SET so a later flush (pagehide / window-hide /
      // any other write) retries instead of the change being lost silently.
      if (isTestOrDev()) console.warn("[prefs] persist failed", err);
      return false;
    }
    if (version === prefsVersion) unsavedChanges = false;
    return true;
  };
  const result = saveChain.then(run, run);
  // The chain must never reject and never carry a value.
  saveChain = result.then(
    () => {},
    () => {},
  );
  return result;
}

/** Apply a partial change to the shared blob AND persist it. The merge ALWAYS
 *  reads the LIVE `sharedPrefs`, so concurrent writers (usePreferences +
 *  useRecentTools) never clobber each other's fields. Notifies all subscribers
 *  (cross-instance live propagation).
 *
 *  Fire-and-forget: use `updatePreferencesDurable` when the CALLER must know the
 *  change reached disk. */
export function updatePreferences(
  patch: Partial<Preferences>,
  options?: UpdatePreferencesOptions,
): void {
  dirty = true;
  setSharedPrefs({ ...sharedPrefs, ...patch });
  unsavedChanges = true;
  if (options?.persist === "deferred") return;
  // This writes the WHOLE blob, so it also satisfies any pending deferred write.
  void persistShared();
}

/** Apply a partial change AND AWAIT its durable persistence.
 *
 *  Resolves `true` once the whole blob (including this patch) has reached the
 *  store, `false` if that write failed — never rejects, so an `await` on it can
 *  never poison the caller's promise chain. The in-memory merge is applied
 *  SYNCHRONOUSLY either way, so every in-session gate that reads the blob keeps
 *  exact semantics even when the disk write fails.
 *
 *  Exists for the ONE write whose loss changes behaviour: UP5-02's
 *  `lastReviewRequestAt` stamp. It is written immediately after the OS was asked
 *  for a review, and losing it (a quit, or a store rejection, right after the
 *  native call) would let the app ask again at the very next boundary instead of
 *  honouring the 7-day floor. Ordinary preference writes stay fire-and-forget. */
export function updatePreferencesDurable(patch: Partial<Preferences>): Promise<boolean> {
  dirty = true;
  setSharedPrefs({ ...sharedPrefs, ...patch });
  unsavedChanges = true;
  return persistShared();
}

/** Persist an outstanding write, if any. Idempotent and cheap when there is
 *  nothing outstanding. Called on window-hide / pagehide (below) and safe to
 *  call from anywhere that wants the on-disk blob current.
 *
 *  Returns the save's outcome for callers that care; the event listeners ignore
 *  it. `true` with nothing outstanding means "already current". */
export function flushPreferences(): Promise<boolean> {
  if (!unsavedChanges) return Promise.resolve(true);
  // NOT cleared here — `persistShared` clears it only once the save RESOLVES,
  // so a rejected/torn-down save stays flushable.
  return persistShared();
}

// The "beforeunload" half of the deferred-write contract. macOS quit and window
// close both hide the webview first, so these two events between them cover the
// realistic exits.
//
// ACCEPTED BY DESIGN: a HARD kill (SIGKILL, crash, power loss) can still lose an
// outstanding deferred write — the webview never gets a hide event, and no
// browser API can make an async store write survive it. That is exactly why only
// LOSABLE bookkeeping may use `"deferred"`: today only UP5-01's sub-boundary
// `toolSuccessCount` increments, where the cost is at most ~2 lost counts, i.e.
// one review boundary arriving a little late. The one write whose loss WOULD
// change behaviour — the UP5-02 stamp — does not use this path at all; it goes
// through `updatePreferencesDurable` and is awaited.
if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("pagehide", () => void flushPreferences());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPreferences();
  });
}

/** TEST-ONLY: reset the module-singleton between tests so the shared prefs blob,
 *  loaded flag, and dirty/load latches never leak across test cases (each test
 *  installs its own platform store and expects a fresh load). Not used in app
 *  code. */
export function resetPreferencesForTest(): void {
  sharedPrefs = DEFAULT_PREFERENCES;
  sharedLoaded = false;
  sharedLoadOk = false;
  loadStarted = false;
  dirty = false;
  unsavedChanges = false;
  prefsVersion = 0;
  saveChain = Promise.resolve();
  listeners.clear();
}

export interface UsePreferences {
  preferences: Preferences;
  /** False until the async mount-load resolves. Consumers that must use the REAL
   *  persisted values (e.g. last-used startup redirect, Pitfall 3) wait on this
   *  rather than acting on the default `lastUsedId: null` during the load window. */
  prefsLoaded: boolean;
  setTheme: (theme: ThemeName) => void;
  setAccent: (accent: string) => void;
  setLastUsedId: (id: string | null) => void;
  /** Persist the user's custom sidebar tool order (REORD-05, D-09). The array is
   *  the raw ordered tool IDs; D-11 reconciliation against the live registry
   *  happens at sidebar render, not here. */
  setToolOrder: (order: string[]) => void;
  /** Persist the user's pinned tool IDs (PIN-07). The array is the raw ordered
   *  pinned IDs (pinned group order = this order); PIN-08 reconciliation against
   *  the live registry happens at sidebar render via partitionTools, not here. */
  setPinnedToolIds: (ids: string[]) => void;
  /** Toggle a tool's pinned membership (PIN-07): append-on-pin (bottom of the
   *  pinned group) or remove-on-unpin. */
  togglePinned: (id: string) => void;
  setTreeStyle: (style: ProtobufTreeStyle) => void;
  /** Persist the first-run update-check opt-in (D-09). true = silent launch check,
   *  false = no automatic network call ever, null = ask again. */
  setAutoUpdateCheck: (v: boolean | null) => void;
  /** Persist the epoch-ms timestamp of the last completed update check (D-25-6).
   *  Routed through the single-writer updatePreferences singleton. */
  setLastUpdateCheck: (ms: number) => void;
  /** Mark a license-drop notice (D-84) and acknowledge/dismiss it. `mark()` sets
   *  the flag false (a drop is pending), surfacing the one-time inline notice on
   *  the status route; `ack()` sets it true (dismissed / nothing to show). */
  markLicenseDropNotice: () => void;
  ackLicenseDropNotice: () => void;
  /** Persist the global summon hotkey accelerator (SET-08). Caller validates/coerces
   *  before calling; the coercer is the final defensive gate on load. */
  setSummonChord: (chord: string) => void;
  /** Persist the ⌘K palette hotkey accelerator (SET-08). */
  setPaletteChord: (chord: string) => void;
  /** Persist the launch-at-login toggle (SET-09). The native autostart side effect
   *  is wired by a later Phase-24 plan; this only persists the preference. */
  setLaunchAtLogin: (v: boolean) => void;
  /** Persist the start-in-tray toggle (SET-09). */
  setStartInTray: (v: boolean) => void;
  /** Persist the default tool to open into (SET-09). null = "Last used". */
  setDefaultToolId: (id: string | null) => void;
}

export function usePreferences(): UsePreferences {
  // Subscribe every instance to the module-singleton so a write in ANY instance
  // (e.g. the Appearance pane Save, OR a useRecentTools tool switch) propagates
  // to all of them (e.g. the App-root live-apply effect) — the live whole-app
  // apply contract (D-23-9) AND the one-writer unification (round 3).
  const [, forceRender] = useState(0);
  const preferences = getSharedPreferences();
  const prefsLoaded = getPreferencesLoaded();

  useEffect(() => {
    const rerender = () => forceRender((n) => n + 1);
    const unsubscribe = subscribePreferences(rerender);
    // Load persisted prefs ONCE per app session (idempotent across hooks).
    ensurePreferencesLoaded();
    return unsubscribe;
  }, []);

  // Apply a partial change to the shared blob AND persist it. The change
  // notifies every subscribed instance (cross-instance live propagation) and
  // always merges against the live blob (one writer).
  const update = useCallback(
    (patch: Partial<Preferences>) => updatePreferences(patch),
    [],
  );

  const setTheme = useCallback((theme: ThemeName) => update({ theme }), [update]);
  const setAccent = useCallback((accent: string) => update({ accent }), [update]);
  const setLastUsedId = useCallback(
    (id: string | null) => update({ lastUsedId: id }),
    [update],
  );
  const setToolOrder = useCallback(
    (order: string[]) => update({ toolOrder: order }),
    [update],
  );
  const setPinnedToolIds = useCallback(
    (ids: string[]) => update({ pinnedToolIds: ids }),
    [update],
  );
  // The preferences.pinnedToolIds dep is REQUIRED so the closure re-creates on
  // change and reads the current pinned set (RESEARCH.md:223 prefsRef pitfall).
  const togglePinned = useCallback(
    (id: string) =>
      setPinnedToolIds(
        preferences.pinnedToolIds.includes(id)
          ? preferences.pinnedToolIds.filter((x) => x !== id) // unpin → remove
          : [...preferences.pinnedToolIds, id], // pin → append to bottom
      ),
    [preferences.pinnedToolIds, setPinnedToolIds],
  );
  const setTreeStyle = useCallback(
    (style: ProtobufTreeStyle) => update({ protobufTreeStyle: style }),
    [update],
  );
  const setAutoUpdateCheck = useCallback(
    (v: boolean | null) => update({ autoUpdateCheck: v }),
    [update],
  );
  const setLastUpdateCheck = useCallback(
    (ms: number) => update({ lastUpdateCheck: ms }),
    [update],
  );
  const markLicenseDropNotice = useCallback(
    () => update({ licenseDropNoticeAck: false }),
    [update],
  );
  const ackLicenseDropNotice = useCallback(
    () => update({ licenseDropNoticeAck: true }),
    [update],
  );
  const setSummonChord = useCallback(
    (chord: string) => update({ summonChord: chord }),
    [update],
  );
  const setPaletteChord = useCallback(
    (chord: string) => update({ paletteChord: chord }),
    [update],
  );
  const setLaunchAtLogin = useCallback(
    (v: boolean) => update({ launchAtLogin: v }),
    [update],
  );
  const setStartInTray = useCallback(
    (v: boolean) => update({ startInTray: v }),
    [update],
  );
  const setDefaultToolId = useCallback(
    (id: string | null) => update({ defaultToolId: id }),
    [update],
  );

  return {
    preferences,
    prefsLoaded,
    setTheme,
    setAccent,
    setLastUsedId,
    setToolOrder,
    setPinnedToolIds,
    togglePinned,
    setTreeStyle,
    setAutoUpdateCheck,
    setLastUpdateCheck,
    markLicenseDropNotice,
    ackLicenseDropNotice,
    setSummonChord,
    setPaletteChord,
    setLaunchAtLogin,
    setStartInTray,
    setDefaultToolId,
  };
}
