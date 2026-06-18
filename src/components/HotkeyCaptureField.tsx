// HotkeyCaptureField (SET-08, D-24-1/2/3/4) — the reusable live-capture control
// that drives BOTH Hotkeys-pane binding rows (Global summon + Command palette).
//
// Behavior (RESEARCH §4 / 24-UI-SPEC Keyboard & A11y):
//   • idle: a real <button> showing the current chord in font-mono; accessible
//     name "Rebind {label}". Activating it (click OR Enter/Space — button
//     semantics, no mouse-only path) enters recording.
//   • recording: a window-level keydown listener captures the chord from the
//     PHYSICAL key code + modifier flags (never the composed character — macOS
//     Option+letter glyph corruption, project memory macos-option-key-composes-
//     letters). preventDefault() on every key so the captured chord can't trigger
//     an app shortcut.
//       - Escape → cancel, no onCommit (D-24-1).
//       - no non-shift modifier (keyEventToAccelerator → null) → keep recording,
//         show the calm "add a modifier" hint.
//       - a reserved chord (isReservedChord) → reject inline, no onCommit.
//       - a chord equal to the OTHER binding (otherChord) → reject inline, no
//         onCommit (T-24-07 self-collision guard).
//       - else → onCommit(accel); the PARENT decides persist vs OS-reject.
//   • reject: the parent passes rejectMessage (e.g. the OS-taken case); this
//     component ALSO surfaces its own invalid/reserved/same-as-other messages.
//     Either way the prior chord stays displayed; persist nothing (D-24-2).
//   • Reset: a keyboard-reachable RotateCcw icon button, accessible name
//     "Reset {label} to default", calls onReset().
//
// All surfaces use theme tokens ONLY (no hardcoded dark-only hex — Phase-23
// Pitfall 5), so the control clears WCAG-AA in both themes. Layout-agnostic
// (no fixed widths) — the field + reset fill their row.

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  isReservedChord,
  keyEventToAccelerator,
} from "@/shell/hotkeyAccelerator";

export interface HotkeyCaptureFieldProps {
  /** "Global summon" | "Command palette" — drives the accessible names. */
  label: string;
  /** The per-control helper line (UI-SPEC copy). */
  helper: string;
  /** The current persisted accelerator, shown in the idle field (mono). */
  chord: string;
  /** The OTHER binding's chord — a capture equal to it is rejected (no two
   *  bindings may collide, T-24-07). */
  otherChord: string;
  /** The OTHER binding's human name (e.g. "the command palette"), used verbatim
   *  in the self-collision message. Travels with otherChord so this control
   *  stays binding-agnostic. */
  otherLabel: string;
  /** A parent-supplied calm inline message (e.g. the OS-taken case). null = none.
   *  Rendered below the field; the field's own invalid/reserved/same-as-other
   *  messages take precedence while recording. */
  rejectMessage: string | null;
  /** Called with a validated, non-reserved, non-duplicate chord — the parent then
   *  decides persist vs OS-reject (D-24-2). */
  onCommit: (accel: string) => void;
  /** Restore the shipped default for this binding (D-24-4). */
  onReset: () => void;
  /** Clear any parent reject when a fresh, clean capture starts. */
  onRecordingClearReject: () => void;
}

// The verbatim UI-SPEC copy for the field's own (non-OS) classifications.
const INVALID_MSG = "Add Cmd, Ctrl, or Alt to set a shortcut.";
const RESERVED_MSG = "That shortcut is reserved by macOS — try another.";
function sameAsOtherMsg(otherLabel: string): string {
  return `That shortcut is already used by ${otherLabel}.`;
}

export function HotkeyCaptureField({
  label,
  helper,
  chord,
  otherChord,
  otherLabel,
  rejectMessage,
  onCommit,
  onReset,
  onRecordingClearReject,
}: HotkeyCaptureFieldProps) {
  const [recording, setRecording] = useState(false);
  // The field's OWN inline message (invalid / reserved / same-as-other). The
  // parent's rejectMessage covers the OS-taken case after a commit.
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  // Keep the latest props in a ref so the window keydown listener (attached once
  // per recording session) always reads current values without re-subscribing.
  // Synced in an effect (never during render).
  const propsRef = useRef({ otherChord, onCommit, onRecordingClearReject });
  useEffect(() => {
    propsRef.current = { otherChord, onCommit, onRecordingClearReject };
  });

  function startRecording() {
    setLocalMessage(null);
    setRecording(true);
  }

  useEffect(() => {
    if (!recording) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Never let the captured chord trigger an app shortcut while recording.
      e.preventDefault();
      e.stopPropagation();

      if (e.code === "Escape") {
        // Cancel — return to idle, no commit (D-24-1). Detected via the PHYSICAL
        // code (consistent with the rest of capture; never the composed character).
        setRecording(false);
        return;
      }

      const accel = keyEventToAccelerator(e);
      if (accel === null) {
        // No non-shift modifier (or modifier-only press) — keep recording, nudge.
        setLocalMessage(INVALID_MSG);
        return;
      }
      if (isReservedChord(accel)) {
        setLocalMessage(RESERVED_MSG);
        setRecording(false);
        return;
      }
      if (accel === propsRef.current.otherChord) {
        setLocalMessage(sameAsOtherMsg(otherLabel));
        setRecording(false);
        return;
      }
      // A clean, validated chord — clear any prior reject and hand it to the parent.
      propsRef.current.onRecordingClearReject();
      setLocalMessage(null);
      setRecording(false);
      propsRef.current.onCommit(accel);
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, otherLabel]);

  // The field's own message wins while it has one; otherwise the parent's reject.
  const message = localMessage ?? rejectMessage;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <h4 className="text-[13px] font-medium text-tx">{label}</h4>
        <p className="text-[12px] text-tx-3">{helper}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={
            recording ? `Recording ${label} shortcut` : `Rebind ${label}`
          }
          onClick={() => {
            if (!recording) startRecording();
          }}
          className={[
            "flex min-h-11 flex-1 items-center rounded-[7px] border px-4 py-2 text-left outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-accent",
            recording
              ? "border-accent-line bg-accent-soft ring-2 ring-accent text-accent"
              : "border-bd bg-input-bg text-tx hover:border-bd-2",
          ].join(" ")}
        >
          {recording ? (
            <span className="text-[13px] text-accent">Press a shortcut…</span>
          ) : (
            <span className="font-mono text-[13px] text-tx">{chord}</span>
          )}
        </button>

        <button
          type="button"
          aria-label={`Reset ${label} to default`}
          onClick={onReset}
          className="flex h-6 w-6 items-center justify-center rounded-[5px] text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {recording ? (
        <p className="text-[12px] text-tx-3">Esc to cancel</p>
      ) : null}

      {message ? <p className="text-[12px] text-tx-2">{message}</p> : null}
    </div>
  );
}
