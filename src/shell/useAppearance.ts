// useAppearance (D-23-9/D-23-5) — the ONE place whole-app appearance is applied.
//
// Wired once in App.tsx. It applies the GATED effective theme+accent
// (gatePreferences(prefs, ents) → a free/downgraded user is forced to dark +
// #5b9bf8, NEVER the raw persisted Pro values — Pitfall 3) and keeps the
// localStorage paint-hint in sync from that GATED value (Pitfall 4 — the
// index.html pre-paint script reads it next launch so a lapsed/free relaunch
// never flashes a stored Pro light theme). With "system" removed (D-23-4) there
// is no OS-appearance live-flip — the theme IS the effective theme.
//
// FLASH-FREE PRO LAUNCH (D-23-5): the apply waits for BOTH prefsLoaded AND
// entsResolved. Entitlements default to FREE_SET (D-85) and only flip to Pro
// after the async license resolve; applying the GATED value the instant prefs
// load would briefly force a Pro user to dark before that resolve lands. The
// index.html pre-paint script already painted the correct launch frame from the
// last GATED hint, so holding the apply until entitlements are known means no
// dark clobber for a Pro user — and no flash for a free user.
//
// It touches document/localStorage + the platform seam: besides the DOM apply it
// syncs the NATIVE window appearance to the theme (Overlay-titlebar fix) via
// platform.window.setTheme — through the seam, never a direct @tauri-apps import
// (the pre-paint script + persistence are sanctioned local storage, MEMORY:
// tauri-store-async-init-race).

import { useEffect } from "react";
import { usePreferences } from "./usePreferences";
import { useEntitlements, useEntitlementsResolved } from "./useEntitlements";
import { gatePreferences } from "@/lib/entitlements/entitlements";
import { applyAppearance } from "./theme";
import { initPlatform, platform } from "@/lib/platform";

// MUST stay byte-identical to the literal in index.html's pre-paint <script>
// (the synchronous launch-frame reader of this hint). Changing one without the
// other reintroduces the wrong-theme flash (Pitfall 2/4).
export const THEME_HINT_KEY = "td-theme-hint";

/** The GATED theme the pre-paint <script> painted the launch frame from (the
 *  last session's effective theme). Used to sync the native window chrome to the
 *  DOM BEFORE entitlements resolve, so the Overlay titlebar's title text matches
 *  what's on screen at reveal. Defaults to "dark" (the default app theme). */
function readThemeHint(): "light" | "dark" {
  try {
    const h = localStorage.getItem(THEME_HINT_KEY);
    if (h === "light" || h === "dark") return h;
  } catch {
    /* fall through to the default */
  }
  return "dark";
}

/** D-23-9/D-23-5: apply the GATED effective theme+accent on prefs/ents change and
 *  keep the localStorage paint-hint in sync from that gated value. Does nothing
 *  until prefsLoaded AND entsResolved (the pre-paint script owns the launch frame
 *  until entitlements are known — no Pro dark-clobber, no free flash). */
export function useAppearance(): void {
  const { preferences, prefsLoaded } = usePreferences();
  const ents = useEntitlements();
  const entsResolved = useEntitlementsResolved();

  // Apply the gated effective appearance + persist the gated paint-hint.
  useEffect(() => {
    // Hold the apply until BOTH prefs are loaded AND entitlements are resolved
    // (D-23-5): until then the pre-paint script's launch frame stands, so a Pro
    // user never gets a dark clobber from the FREE_SET default and a free user
    // never flashes.
    if (!prefsLoaded || !entsResolved) return;
    const eff = gatePreferences(preferences, ents);
    applyAppearance(eff.theme, eff.accent);
    try {
      // Pitfall 4: the hint is the GATED theme name, so a lapsed/free relaunch
      // never flashes a stored Pro light theme on the launch frame.
      localStorage.setItem(THEME_HINT_KEY, eff.theme);
    } catch {
      /* never block the apply on a storage error */
    }
    // WR-01: deps are ONLY the fields the effect reads via gatePreferences
    // (theme/accent) + ents/prefsLoaded/entsResolved — NOT the whole `preferences`
    // singleton. The shared prefs store replaces the object identity on every write
    // (lastUsedId on every navigation, recents, pins, order…), so a whole-object
    // dep re-fired this full DOM write + localStorage write on every tool switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gatePreferences reads only theme/accent
  }, [preferences.theme, preferences.accent, ents, prefsLoaded, entsResolved]);

  // Native macOS window-chrome sync (Overlay titlebar) — SEPARATE from the gated
  // DOM apply above (Codex review). The native titlebar text + traffic-light
  // rendering follow the NSWindow appearance, which tauri.conf pins to dark; under
  // titleBarStyle:Overlay that makes the title INVISIBLE whenever the in-app theme
  // is light. The native chrome must therefore track whatever the DOM shows:
  // BEFORE entitlements resolve the pre-paint script has painted from the hint, so
  // sync native to the hint as soon as initPlatform() resolves; AFTER they resolve,
  // correct to the gated effective theme (same value the DOM apply uses). This is
  // deliberately NOT gated on entsResolved — gating it (the first cut) left a Pro/
  // light launch under dark chrome until license/IAP resolution finished, or forever
  // if it stalled. Routed through the seam (browser no-ops); fire-and-forget so a
  // chrome-sync failure never blocks rendering.
  useEffect(() => {
    const nativeTheme =
      prefsLoaded && entsResolved
        ? gatePreferences(preferences, ents).theme
        : readThemeHint();
    void initPlatform()
      .then(() => platform.window.setTheme(nativeTheme))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gatePreferences reads only theme; hint read is storage
  }, [preferences.theme, ents, prefsLoaded, entsResolved]);
}
