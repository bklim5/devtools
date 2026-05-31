// Protobuf tool status bar (UX-03): parse state · byte count · error · timing.
//
// Reuses the shared, presentational `StatusBar` from the Base64 tool (its props —
// parseState/byteCount/error/timingMs — fit verbatim; both are app source so the
// cross-tool import is fine). The `encoding` prop is deliberately OMITTED: per the
// 2026-05-31 refinement (03-CONTEXT <refinements>), the AUTO-DETECTED encoding is
// surfaced more prominently as an ACCENT CHIP next to the override toggle in the
// input pane (the active/selected interpretation per D-08), so repeating the word
// here would be redundant. This thin wrapper just fixes the tool's status-bar
// contract in one place.
import { StatusBar, type ParseState } from "@/tools/base64/StatusBar";

export interface ProtobufStatusBarProps {
  parseState: ParseState;
  byteCount: number;
  error?: string | null;
  timingMs?: number;
}

export function ProtobufStatusBar({
  parseState,
  byteCount,
  error,
  timingMs,
}: ProtobufStatusBarProps) {
  return (
    <StatusBar
      parseState={parseState}
      byteCount={byteCount}
      error={error}
      timingMs={timingMs}
    />
  );
}
