// useRecentTools — tracks the recently-used tools list (SHL-03, D-05).
//
// `recentToolIds` lives in the SAME persisted prefs blob as usePreferences (one
// store key). To guarantee ONE in-memory source of truth and ONE writer, this
// hook consumes the SAME module-singleton primitives as usePreferences
// (getSharedPreferences / ensurePreferencesLoaded / updatePreferences /
// subscribePreferences). It no longer keeps its own mount-era prefs snapshot —
// a stale snapshot was the cause of the theme/pins-revert-after-tool-switch bug
// (a tool switch wrote back a mount-era blob, clobbering a later theme/pin
// change). Every write here merges against the LIVE blob, so it can never
// clobber theme/accent/pins.
//
// Public API is unchanged: { recentToolIds, loaded, push, recordSwitch }.

import { useCallback, useEffect, useState } from "react";
import { RECENT_TOOLS_CAP } from "./preferences";
import { normalizeRecents } from "./prefsStore";
import {
  ensurePreferencesLoaded,
  getPreferencesLoaded,
  getSharedPreferences,
  subscribePreferences,
  updatePreferences,
} from "./usePreferences";

export interface UseRecentTools {
  recentToolIds: string[];
  /** False until the async mount-load resolves. The on-navigation recorder
   *  (useTrackActiveTool) waits on this so its first write can't clobber the
   *  stored recents before they have loaded (Pitfall 3 timing). */
  loaded: boolean;
  /** Record a tool as just-used: move/insert at front, de-dupe, cap at ≈5. */
  push: (id: string) => void;
  /**
   * Atomically record a tool *switch*: push the id to recents AND set it as
   * `lastUsedId`, persisting BOTH in a single blob write. Both this and `push`
   * merge against the LIVE shared blob (the one writer), so theme/accent/pins
   * are always preserved.
   */
  recordSwitch: (id: string) => void;
}

/** Pure recents transform: id to front, de-dupe, cap. Exported-shape kept in
 *  normalizeRecents; here we prepend then re-normalize so order + cap hold. */
function pushRecent(current: string[], id: string): string[] {
  return normalizeRecents([id, ...current]).slice(0, RECENT_TOOLS_CAP);
}

export function useRecentTools(): UseRecentTools {
  // Re-render on any shared-prefs change; read recents/loaded from the live
  // singleton (no second snapshot — that was the clobber source).
  const [, forceRender] = useState(0);
  const recentToolIds = getSharedPreferences().recentToolIds;
  const loaded = getPreferencesLoaded();

  useEffect(() => {
    const rerender = () => forceRender((n) => n + 1);
    const unsubscribe = subscribePreferences(rerender);
    ensurePreferencesLoaded();
    return unsubscribe;
  }, []);

  const push = useCallback((id: string) => {
    updatePreferences({
      recentToolIds: pushRecent(getSharedPreferences().recentToolIds, id),
    });
  }, []);

  const recordSwitch = useCallback((id: string) => {
    updatePreferences({
      recentToolIds: pushRecent(getSharedPreferences().recentToolIds, id),
      lastUsedId: id,
    });
  }, []);

  return { recentToolIds, loaded, push, recordSwitch };
}
