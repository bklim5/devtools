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
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type ProtobufTreeStyle,
  type ThemeName,
} from "./preferences";
import { loadPreferences, savePreferences } from "./prefsStore";

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
let loadStarted = false;
// True once ANY setter has written — the async mount-load must not clobber a
// value the user already changed (Pitfall 3 timing).
let dirty = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function setSharedPrefs(next: Preferences): void {
  sharedPrefs = next;
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
  void loadPreferences().then((loaded) => {
    if (!dirty) sharedPrefs = loaded;
    sharedLoaded = true;
    notify();
  });
}

/** Apply a partial change to the shared blob AND persist it. The merge ALWAYS
 *  reads the LIVE `sharedPrefs`, so concurrent writers (usePreferences +
 *  useRecentTools) never clobber each other's fields. Notifies all subscribers
 *  (cross-instance live propagation). */
export function updatePreferences(patch: Partial<Preferences>): void {
  dirty = true;
  setSharedPrefs({ ...sharedPrefs, ...patch });
  void savePreferences(sharedPrefs);
}

/** TEST-ONLY: reset the module-singleton between tests so the shared prefs blob,
 *  loaded flag, and dirty/load latches never leak across test cases (each test
 *  installs its own platform store and expects a fresh load). Not used in app
 *  code. */
export function resetPreferencesForTest(): void {
  sharedPrefs = DEFAULT_PREFERENCES;
  sharedLoaded = false;
  loadStarted = false;
  dirty = false;
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
