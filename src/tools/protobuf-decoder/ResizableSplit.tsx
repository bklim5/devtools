// In-house col-resize two-pane split (D-09 / PRO-05 / UX-05) — no library.
//
// A CSS-grid container with `left | 7px gutter | right` using RELATIVE `fr` units
// (the only px is the fixed-width gutter, never the panes — UX-05: layout-agnostic,
// no fixed pane widths). A draggable `role="separator"` between the panes updates
// the split ratio from the pointer's x relative to the container, clamped to
// [min, 1-min]. Pointer capture keeps the drag tracking even when the cursor leaves
// the thin gutter. Keyboard users can nudge the ratio with the arrow keys (the
// separator is focusable — visible focus, never opacity-only).
import { useCallback, useRef, useState } from "react";

export interface ResizableSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Initial left-pane fraction (0..1). */
  initial?: number;
  /** Minimum fraction for either pane. */
  min?: number;
}

export function ResizableSplit({
  left,
  right,
  initial = 0.5,
  min = 0.2,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(initial);
  const draggingRef = useRef(false);

  const clamp = useCallback(
    (r: number) => Math.min(1 - min, Math.max(min, r)),
    [min],
  );

  const ratioFromClientX = useCallback(
    (clientX: number): number | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return null;
      return clamp((clientX - rect.left) / rect.width);
    },
    [clamp],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;

      const onPointerMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return;
        const next = ratioFromClientX(ev.clientX);
        if (next !== null) setRatio(next);
      };
      const onPointerUp = () => {
        draggingRef.current = false;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [ratioFromClientX],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") setRatio((r) => clamp(r - 0.02));
      else if (e.key === "ArrowRight") setRatio((r) => clamp(r + 0.02));
    },
    [clamp],
  );

  return (
    <div
      ref={containerRef}
      className="grid min-h-0 min-w-0 flex-1"
      style={{ gridTemplateColumns: `${ratio}fr 7px ${1 - ratio}fr` }}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="cursor-col-resize bg-bd outline-none transition-colors hover:bg-accent-line focus-visible:bg-accent-line focus-visible:ring-2 focus-visible:ring-accent"
      />
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">{right}</div>
    </div>
  );
}
