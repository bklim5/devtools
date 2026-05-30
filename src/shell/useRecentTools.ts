// useRecentTools — tracks the recently-used tools list (SHL-03, D-05).
//
// `recentToolIds` lives in the SAME persisted prefs blob as usePreferences (one
// store key), so both hooks load + merge the same `Preferences` shape. This hook
// exposes a `push(id)` API that moves an id to the front, de-dupes, and caps the
// list at RECENT_TOOLS_CAP (≈5), then persists through the store seam.
//
// Like usePreferences, this NEVER imports @tauri-apps — all I/O is via
// `platform.store` (Pitfall 5: write on switch, not per render).

import { useCallback, useEffect, useRef, useState } from "react";
import { RECENT_TOOLS_CAP, type Preferences } from "./preferences";
import { loadPreferences, normalizeRecents, savePreferences } from "./prefsStore";

export interface UseRecentTools {
  recentToolIds: string[];
  /** Record a tool as just-used: move/insert at front, de-dupe, cap at ≈5. */
  push: (id: string) => void;
}

/** Pure recents transform: id to front, de-dupe, cap. Exported-shape kept in
 *  normalizeRecents; here we prepend then re-normalize so order + cap hold. */
function pushRecent(current: string[], id: string): string[] {
  return normalizeRecents([id, ...current]).slice(0, RECENT_TOOLS_CAP);
}

export function useRecentTools(): UseRecentTools {
  const [recentToolIds, setRecentToolIds] = useState<string[]>([]);
  // Hold the full loaded prefs so a recents write does not clobber theme/accent/
  // lastUsedId (they share one blob).
  const prefsRef = useRef<Preferences | null>(null);
  // True once push() has run. The async mount-load must not overwrite recents a
  // user already changed (the load can resolve after an early push — Pitfall 3).
  const dirtyRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void loadPreferences().then((loaded) => {
      if (!alive) return;
      // Always capture the loaded blob so a later push preserves theme/accent,
      // but only adopt the loaded recents if the user hasn't pushed yet.
      if (dirtyRef.current) {
        prefsRef.current = { ...loaded, recentToolIds: prefsRef.current?.recentToolIds ?? [] };
        return;
      }
      prefsRef.current = loaded;
      setRecentToolIds(loaded.recentToolIds);
    });
    return () => {
      alive = false;
    };
  }, []);

  const push = useCallback((id: string) => {
    dirtyRef.current = true;
    const base = prefsRef.current?.recentToolIds ?? [];
    const nextRecents = pushRecent(base, id);
    const nextPrefs: Preferences = {
      ...(prefsRef.current ?? {
        theme: "dark",
        accent: "#3b82f6",
        lastUsedId: null,
        recentToolIds: [],
      }),
      recentToolIds: nextRecents,
    };
    prefsRef.current = nextPrefs;
    setRecentToolIds(nextRecents);
    void savePreferences(nextPrefs);
  }, []);

  return { recentToolIds, push };
}
