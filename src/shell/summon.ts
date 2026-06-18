// summon.ts — NAT-01 shell wiring: register the global summon chord on startup
// and summon/focus the window when it fires.
//
// SEAM DISCIPLINE (FND-04 / threat T-05-04): this module reaches the OS ONLY
// through `src/lib/platform/` (`platform.nativeShortcut` + `platform.window`).
// It must NOT import the native runtime packages directly — the seam already
// routes to the real Tauri impl (tauri.ts) inside the WKWebView and to harmless
// no-ops in the browser/jsdom fallback (so unit tests and `vite preview` never
// throw). The grep audit asserts zero native-package imports in this file.

import { initPlatform, platform } from "@/lib/platform";
import { getToolById } from "@/lib/tools/registry";

/**
 * The single source of truth for the summon chord (D-01).
 *
 * `CommandOrControl` maps to Cmd on macOS. `Cmd+Shift+D` avoids Spotlight's
 * `Cmd+Space` and the screenshot chords `Cmd+Shift+3/4` (RESEARCH Pitfall 2 /
 * Assumption A3). Change THIS ONE LINE to adjust the chord everywhere.
 */
export const SUMMON_CHORD = "CommandOrControl+Shift+D";

/**
 * Summon the window in the macOS-safe order (D-03 / RESEARCH Pitfall 1, issue
 * #12834): `unminimize()` → `show()` → `setFocus()`. Focusing a minimized/hidden
 * window is a no-op on macOS, so focus MUST come last. Each step goes through the
 * platform seam (no-op outside Tauri).
 */
async function summon(): Promise<void> {
  await platform.window.unminimize();
  await platform.window.show();
  await platform.window.setFocus();
}

/**
 * Guarded deep-link helper (HashRouter ONLY — CLAUDE.md / threat T-05-08).
 *
 * Any tool id is UNTRUSTED input crossing into navigation, so it is validated
 * through `getToolById` (ENABLED_TOOLS only) before we ever touch the hash. The
 * v1 summon does NOT deep-link (it just summons the current window), but keeping
 * the validated path present means a future deep-link reuses it instead of
 * re-inventing an unvalidated `location.hash` write. NEVER use BrowserRouter or
 * `location.assign` to a path — static files 404 on reload.
 */
// Exported (not dead-code-eliminated) so the validated path stays present for a
// future deep-linking summon; v1's summon does NOT call it.
export function deepLink(id: string): void {
  if (!getToolById(id)) return; // unknown/disabled id → ignore, never navigate
  window.location.hash = `#/tools/${id}`;
}

/**
 * Register the global summon chord through the seam, once, at startup.
 *
 * Takes the PERSISTED chord (getSharedPreferences().summonChord) — NOT the bare
 * SUMMON_CHORD constant — so a user-rebound chord is the one armed at launch
 * (NAT-01/G-05-1 promoted, D-24-1). Awaits `initPlatform()` first so the real
 * Tauri impl is installed before we register (memoised — cheap to await).
 * Registration failure (chord already taken, Pitfall 2 / threat T-05-07) is
 * NON-FATAL: it is caught and logged, never rethrown (D-24-5), so a collision
 * can't crash app startup.
 */
export async function registerSummon(chord: string): Promise<void> {
  try {
    await initPlatform();
    // The handler returns the summon promise. The seam signature is `() => void`,
    // and a `() => Promise<void>` is assignable to it (the OS caller ignores the
    // return); returning it lets the unit test await the full summon chain.
    await platform.nativeShortcut.register(chord, () => summon());
  } catch (err) {
    // Graceful degrade: a taken chord (or a denied permission) disables summon
    // but must not take down startup. The user can rebind via the Hotkeys pane.
    console.warn(`[summon] failed to register global chord "${chord}":`, err);
  }
}

/**
 * USER-initiated rebind of the summon chord (D-24-2/5, threat T-05-07).
 *
 * Ordering: unregister the OLD chord, then register the NEW chord. On a register
 * REJECT (the new chord is taken/reserved — the OS register-result is the final
 * gate, D-24-3) it RE-REGISTERS the old chord so the user keeps a working summon,
 * then RE-THROWS so the caller (the Hotkeys pane) can surface the inline reject
 * and persist NOTHING (D-24-2: persist nothing on reject — persistence is the
 * pane's job AFTER a successful rebind).
 *
 * The old unregister is best-effort: an "old not registered" reject (e.g. the
 * prior registerSummon failed at startup) must not abort the rebind.
 */
export async function rebindSummon(
  oldChord: string,
  newChord: string,
): Promise<void> {
  await initPlatform();
  // Best-effort: an unregister reject (old chord was never registered) must not
  // block binding the new one.
  await platform.nativeShortcut.unregister(oldChord).catch(() => {});
  try {
    await platform.nativeShortcut.register(newChord, () => summon());
  } catch (err) {
    // The new chord is taken/reserved — restore the working binding so the user
    // is never left without a summon, then surface the failure to the pane.
    await platform.nativeShortcut.register(oldChord, () => summon()).catch(() => {});
    throw err;
  }
}
