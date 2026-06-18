// HotkeysSettings (SET-08, D-24-2/4/5/6) — the Settings ▸ Hotkeys pane. Two
// binding rows, each driven by ONE reusable HotkeyCaptureField:
//   • Global summon — a valid capture goes through rebindSummon (native
//     re-register, D-24-5). On the OS-register REJECT (the chord is taken) it
//     catches, surfaces the calm inline "already in use" message, and persists
//     NOTHING — rebindSummon has already restored the prior OS binding (D-24-2,
//     T-05-07). On success it persists summonChord + announces politely.
//   • Command palette — pure-webview (D-24-6): persist paletteChord directly +
//     announce. The matcher (matchesChord) and the coercer already agree, so
//     there is no OS-reject path.
// A single polite aria-live region carries the rebind/reset result (WCAG-AA,
// RESEARCH §9 — not a toast). The pane wrapper/header clone AppearanceSettings.
//
// The pane is appended to SETTINGS_PANES (settingsPanes.tsx); SettingsModal.tsx
// is byte-unchanged (registry is the single control plane, D-23-10).

import { useState } from "react";
import { usePreferences } from "@/shell/usePreferences";
import { DEFAULT_PREFERENCES } from "@/shell/preferences";
import { rebindSummon, SUMMON_CHORD } from "@/shell/summon";
import { HotkeyCaptureField } from "./HotkeyCaptureField";

// Single source of truth for the shipped palette default (mirrors how the summon
// side imports SUMMON_CHORD) — never re-spell the literal.
const PALETTE_CHORD = DEFAULT_PREFERENCES.paletteChord;
// The single OS-reject case (D-24-2): rebindSummon already restored the prior
// binding, so the pane just surfaces this calm inline message and persists nothing.
const TAKEN_MSG = "That shortcut is already in use — try another.";
const sameAsOtherMsg = (other: string) => `That shortcut is already used by ${other}.`;

export function HotkeysSettings() {
  const { preferences, setSummonChord, setPaletteChord } = usePreferences();
  const [rejectSummon, setRejectSummon] = useState<string | null>(null);
  const [rejectPalette, setRejectPalette] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Commit AND Reset share one path — they differ only in the target chord.
  // Reset bypasses HotkeyCaptureField's self-collision guard, so re-check the
  // other binding here too: no two bindings may share a chord (T-24-07). The
  // commit path never trips this (the field already blocks accel === otherChord
  // before onCommit). Every reject also feeds the polite live region (WCAG-AA).
  async function applySummon(accel: string) {
    if (accel === preferences.paletteChord) {
      const msg = sameAsOtherMsg("the command palette");
      setRejectSummon(msg);
      setAnnouncement(msg);
      return;
    }
    try {
      await rebindSummon(preferences.summonChord, accel);
      setSummonChord(accel);
      setRejectSummon(null);
      setAnnouncement(`Global summon set to ${accel}`);
    } catch {
      // OS-register reject: the chord is taken/reserved. rebindSummon already
      // restored the prior OS binding — persist NOTHING (D-24-2, T-05-07).
      setRejectSummon(TAKEN_MSG);
      setAnnouncement(TAKEN_MSG);
    }
  }

  function applyPalette(accel: string) {
    if (accel === preferences.summonChord) {
      const msg = sameAsOtherMsg("the global summon");
      setRejectPalette(msg);
      setAnnouncement(msg);
      return;
    }
    // Pure-webview (D-24-6): no native register, so no OS-reject path.
    setPaletteChord(accel);
    setRejectPalette(null);
    setAnnouncement(`Command palette set to ${accel}`);
  }

  return (
    <div className="flex flex-col gap-6 overflow-auto p-8">
      <header className="flex flex-col gap-1">
        {/* h3 — one level under the dialog h2 (preserves the Phase-22.1 heading
            order); never h2. */}
        <h3 className="text-[15px] font-semibold text-tx">Hotkeys</h3>
        <p className="text-[13px] text-tx-2">
          Rebind the app's keyboard shortcuts.
        </p>
      </header>

      <HotkeyCaptureField
        label="Global summon"
        helper="Show TinkerDev from anywhere."
        chord={preferences.summonChord}
        otherChord={preferences.paletteChord}
        otherLabel="the command palette"
        rejectMessage={rejectSummon}
        onCommit={applySummon}
        onReset={() => applySummon(SUMMON_CHORD)}
        onRecordingClearReject={() => setRejectSummon(null)}
      />

      <HotkeyCaptureField
        label="Command palette"
        helper="Open the ⌘K command palette."
        chord={preferences.paletteChord}
        otherChord={preferences.summonChord}
        otherLabel="the global summon"
        rejectMessage={rejectPalette}
        onCommit={applyPalette}
        onReset={() => applyPalette(PALETTE_CHORD)}
        onRecordingClearReject={() => setRejectPalette(null)}
      />

      {/* Single polite live region for rebind/reset feedback (WCAG-AA). */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
