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
// It touches only document/localStorage + the seams — no native platform import
// (the pre-paint script + persistence are sanctioned local storage, MEMORY:
// tauri-store-async-init-race).

import { useEffect } from "react";
import { usePreferences } from "./usePreferences";
import { useEntitlements, useEntitlementsResolved } from "./useEntitlements";
import { gatePreferences } from "@/lib/entitlements/entitlements";
import { applyAppearance } from "./theme";

// MUST stay byte-identical to the literal in index.html's pre-paint <script>
// (the synchronous launch-frame reader of this hint). Changing one without the
// other reintroduces the wrong-theme flash (Pitfall 2/4).
export const THEME_HINT_KEY = "td-theme-hint";

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
}
