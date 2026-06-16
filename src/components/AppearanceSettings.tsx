// AppearanceSettings (SET-07, D-23-3/D-23-6/D-23-7) — the Settings ▸ Appearance
// pane. Holds PENDING theme + accent state, drives a CONTAINED preview strip, and
// gates Save on entitlement:
//   • Pro (ents.has(ENT_THEMING)) Save → setTheme(pending) + setAccent(pending)
//     (persists via the prefs seam; the App root then applies live, Plan 03).
//   • Free Save → openProUpsell(saveButtonEl), persists NOTHING (try-before-buy,
//     D-23-2). The Save button shows a VISIBLE locked affordance (Lock glyph +
//     "Unlock Pro to save"), keyboard-reachable, NOT opacity-only.
// Selecting a theme/accent updates ONLY local pending state + the preview strip —
// the whole app does NOT change before Save, and this component NEVER writes to
// the DOM root element (the contained-preview invariant, D-23-3).

import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { ThemeName } from "@/shell/preferences";
import { usePreferences } from "@/shell/usePreferences";
import { useEntitlements } from "@/shell/useEntitlements";
import { openProUpsell } from "@/shell/proUpsell";
import { ENT_THEMING, gatePreferences } from "@/lib/entitlements/entitlements";
import { ThemeCardGroup } from "./ThemeCardGroup";
import { AccentSwatchGrid } from "./AccentSwatchGrid";
import { AppearancePreviewStrip } from "./AppearancePreviewStrip";

export function AppearanceSettings() {
  const { preferences, setTheme, setAccent } = usePreferences();
  const ents = useEntitlements();
  const entitled = ents.has(ENT_THEMING);
  const saveRef = useRef<HTMLButtonElement>(null);

  // WR-02: seed pending from the GATED view, not the RAW persisted prefs, so a
  // free/lapsed user (whose live app is forced to dark + #5b9bf8 by useAppearance)
  // sees that same selection here — never their previously-persisted Pro values
  // pre-selected against a value the running app is not actually applying.
  // Selecting updates ONLY this + the preview — never the seam, never the DOM root.
  const gated = gatePreferences(preferences, ents);
  const [pendingTheme, setPendingTheme] = useState<ThemeName>(gated.theme);
  const [pendingAccent, setPendingAccent] = useState<string>(gated.accent);

  function onSave() {
    if (!entitled) {
      // D-23-2: free Save routes to the focused Unlock-Pro path; persists NOTHING.
      openProUpsell(saveRef.current);
      return;
    }
    // Pro: persist via the seam; the App root applies live (Plan 03).
    setTheme(pendingTheme);
    setAccent(pendingAccent);
  }

  return (
    <div className="flex flex-col gap-6 overflow-auto p-8">
      <header className="flex flex-col gap-1">
        {/* h3 — one level under the dialog h2 (preserves the Phase-22.1 heading
            order); never h2. */}
        <h3 className="text-[15px] font-semibold text-tx">Appearance</h3>
        <p className="text-[13px] text-tx-2">
          Personalize how TinkerDev looks on this device.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h4 className="text-[13px] font-medium text-tx">Theme</h4>
        <p className="text-[12px] text-tx-3">Choose light or dark.</p>
        <ThemeCardGroup value={pendingTheme} onChange={setPendingTheme} />
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-[13px] font-medium text-tx">Accent color</h4>
        <p className="text-[12px] text-tx-3">
          Used for the active tool, selections, and focus.
        </p>
        <AccentSwatchGrid value={pendingAccent} onChange={setPendingAccent} />
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-[13px] font-medium text-tx">Preview</h4>
        <AppearancePreviewStrip theme={pendingTheme} accent={pendingAccent} />
      </section>

      <div className="flex items-center">
        <button
          ref={saveRef}
          type="button"
          onClick={onSave}
          className={[
            "flex items-center gap-1.5 rounded-[7px] px-4 py-2 text-[13px] font-medium outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-accent",
            entitled
              ? "bg-accent text-win hover:opacity-90"
              : // VISIBLE locked affordance (NOT opacity-only) — full-color accent
                // surface with the lock glyph + "Unlock Pro to save" label.
                "border border-accent-line bg-accent-soft text-accent",
          ].join(" ")}
        >
          {!entitled ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {entitled ? "Save" : "Unlock Pro to save"}
        </button>
      </div>
    </div>
  );
}
