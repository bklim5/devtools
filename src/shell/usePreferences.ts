// usePreferences — typed hook over the platform Store seam (SHL-05, D-08/D-10).
//
// On mount it loads the prefs blob asynchronously; until that resolves it
// returns DEFAULT_PREFERENCES (no flash of undefined). Each setter updates local
// state AND writes the whole blob through `platform.store.set` (Pattern 3) —
// write on change only, never per render (Pitfall 5).
//
// This hook NEVER imports @tauri-apps — it goes through `platform.store`, which
// the seam routes to the real impl (tauri.ts) or the browser/in-memory fallback.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type ProtobufTreeStyle,
  type ThemeName,
} from "./preferences";
import { loadPreferences, savePreferences } from "./prefsStore";

export interface UsePreferences {
  preferences: Preferences;
  /** False until the async mount-load resolves. Consumers that must use the REAL
   *  persisted values (e.g. last-used startup redirect, Pitfall 3) wait on this
   *  rather than acting on the default `lastUsedId: null` during the load window. */
  prefsLoaded: boolean;
  setTheme: (theme: ThemeName) => void;
  setAccent: (accent: string) => void;
  setLastUsedId: (id: string | null) => void;
  setTreeStyle: (style: ProtobufTreeStyle) => void;
  /** Persist the first-run update-check opt-in (D-09). true = silent launch check,
   *  false = no automatic network call ever, null = ask again. */
  setAutoUpdateCheck: (v: boolean | null) => void;
}

export function usePreferences(): UsePreferences {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  // Keep a ref to the latest prefs so setters merge against the current value
  // without re-subscribing the persist effect to every field. Kept in sync by
  // the load effect and every `update` (never written during render).
  const prefsRef = useRef(preferences);
  // True once the user has written through a setter. The async mount-load must
  // NOT clobber a value the user already changed (the load can resolve after an
  // early setter call — Pitfall 3 timing).
  const dirtyRef = useRef(false);

  // Load persisted prefs once on mount (async store). Guard against setting
  // state after unmount, and against overwriting a post-mount user write.
  useEffect(() => {
    let alive = true;
    void loadPreferences().then((loaded) => {
      if (!alive) return;
      if (!dirtyRef.current) {
        prefsRef.current = loaded;
        setPreferences(loaded);
      }
      setPrefsLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Apply a partial change to local state AND persist the merged blob.
  const update = useCallback((patch: Partial<Preferences>) => {
    dirtyRef.current = true;
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPreferences(next);
    void savePreferences(next);
  }, []);

  const setTheme = useCallback((theme: ThemeName) => update({ theme }), [update]);
  const setAccent = useCallback((accent: string) => update({ accent }), [update]);
  const setLastUsedId = useCallback(
    (id: string | null) => update({ lastUsedId: id }),
    [update],
  );
  const setTreeStyle = useCallback(
    (style: ProtobufTreeStyle) => update({ protobufTreeStyle: style }),
    [update],
  );
  const setAutoUpdateCheck = useCallback(
    (v: boolean | null) => update({ autoUpdateCheck: v }),
    [update],
  );

  return {
    preferences,
    prefsLoaded,
    setTheme,
    setAccent,
    setLastUsedId,
    setTreeStyle,
    setAutoUpdateCheck,
  };
}
