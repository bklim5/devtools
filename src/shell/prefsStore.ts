// Shared read/merge/write helpers over the platform Store seam for the single
// prefs blob. Both usePreferences and useRecentTools persist the SAME
// `Preferences` shape under PREFERENCES_STORE_KEY, so the load + untrusted-merge
// logic lives here once rather than being duplicated (and drifting) per hook.
//
// SECURITY (threat T-02-08): values read from the store are UNTRUSTED input
// (the user can hand-edit prefs.json). We never trust the stored shape — we
// merge field-by-field over DEFAULT_PREFERENCES, accepting only known fields of
// the expected type, and discard anything else. A corrupt/absent blob (Plan 01
// already makes get() return undefined on corruption) yields the defaults.

import { initPlatform } from "@/lib/platform";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORE_KEY,
  RECENT_TOOLS_CAP,
  type Preferences,
  type ThemeName,
} from "./preferences";

/** Only "dark" is valid in Phase 2 (D-10). Anything else → default. */
function coerceTheme(value: unknown): ThemeName {
  return value === "dark" ? "dark" : DEFAULT_PREFERENCES.theme;
}

function coerceAccent(value: unknown): string {
  return typeof value === "string" && value.length > 0
    ? value
    : DEFAULT_PREFERENCES.accent;
}

function coerceLastUsedId(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Keep only string ids, de-dupe (most-recent-first wins), cap the length. */
export function normalizeRecents(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue; // untrusted: drop non-strings
    if (seen.has(item)) continue; // de-dupe
    seen.add(item);
    out.push(item);
    if (out.length >= RECENT_TOOLS_CAP) break;
  }
  return out;
}

/** Merge an untrusted stored blob over the defaults, accepting only known
 *  fields/types. The result is always a valid `Preferences`. */
export function mergePreferences(stored: unknown): Preferences {
  const blob = (typeof stored === "object" && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  return {
    theme: coerceTheme(blob.theme),
    accent: coerceAccent(blob.accent),
    lastUsedId: coerceLastUsedId(blob.lastUsedId),
    recentToolIds: normalizeRecents(blob.recentToolIds),
  };
}

// Both helpers `await initPlatform()` (memoised, cheap after the first call) so
// they read/write the REAL store impl. Without this, a read firing before the
// async Tauri impl is installed hits the browser localStorage fallback while
// later writes hit prefs.json on disk — reads and writes land in different
// backings and last-used never restores in the packaged app.

/** Load + validate the prefs blob from the store seam. Never throws: a
 *  corrupt/absent value degrades to DEFAULT_PREFERENCES. */
export async function loadPreferences(): Promise<Preferences> {
  try {
    const { store } = await initPlatform();
    const stored = await store.get(PREFERENCES_STORE_KEY);
    return mergePreferences(stored);
  } catch {
    return { ...DEFAULT_PREFERENCES, recentToolIds: [] };
  }
}

/** Persist the whole prefs blob through the store seam (single set per change,
 *  not per render — Pitfall 5). */
export async function savePreferences(prefs: Preferences): Promise<void> {
  const { store } = await initPlatform();
  await store.set(PREFERENCES_STORE_KEY, prefs);
}
