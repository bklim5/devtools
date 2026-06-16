// useAppearance (D-23-9/D-23-5) — the ONE place whole-app appearance is applied.
//
// Wired once in App.tsx. It applies the GATED effective theme+accent
// (gatePreferences(prefs, ents) → a free/downgraded user is forced to dark +
// #5b9bf8, NEVER the raw persisted Pro values — Pitfall 3), keeps the
// localStorage paint-hint in sync from that GATED value (Pitfall 4 — the
// index.html pre-paint script reads it next launch so a lapsed/free relaunch
// never flashes a stored Pro light theme), and live-flips while the effective
// theme is "system" (a matchMedia change listener re-applies on OS light↔dark).
//
// It touches only document/localStorage/window.matchMedia + the seams — no
// native platform import (the pre-paint script + persistence are sanctioned local
// storage, MEMORY: tauri-store-async-init-race).

import { useEffect } from "react";
import { usePreferences } from "./usePreferences";
import { useEntitlements } from "./useEntitlements";
import { gatePreferences } from "@/lib/entitlements/entitlements";
import { applyAppearance } from "./theme";

// MUST stay byte-identical to the literal in index.html's pre-paint <script>
// (the synchronous launch-frame reader of this hint). Changing one without the
// other reintroduces the wrong-theme flash (Pitfall 2/4).
export const THEME_HINT_KEY = "td-theme-hint";

/** D-23-9/D-23-5: apply the GATED effective theme+accent on prefs/ents change and
 *  keep the localStorage paint-hint in sync from that gated value. Does nothing
 *  until prefsLoaded (the pre-paint script owns the launch frame). */
export function useAppearance(): void {
  const { preferences, prefsLoaded } = usePreferences();
  const ents = useEntitlements();

  // Apply the gated effective appearance + persist the gated paint-hint.
  useEffect(() => {
    if (!prefsLoaded) return; // the pre-paint script set the launch theme
    const eff = gatePreferences(preferences, ents);
    applyAppearance(eff.theme, eff.accent);
    try {
      // Pitfall 4: the hint is the GATED theme name, so a lapsed/free relaunch
      // never flashes a stored Pro light theme on the launch frame.
      localStorage.setItem(THEME_HINT_KEY, eff.theme);
    } catch {
      /* never block the apply on a storage error */
    }
  }, [preferences.theme, preferences.accent, ents, prefsLoaded, preferences]);

  // Live OS light↔dark flip — subscribe ONLY while the effective theme is system.
  useEffect(() => {
    if (!prefsLoaded) return;
    const eff = gatePreferences(preferences, ents);
    if (eff.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance("system", eff.accent);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preferences.theme, preferences.accent, ents, prefsLoaded, preferences]);
}
