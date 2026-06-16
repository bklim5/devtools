// AccentSwatchGrid (D-23-7) — seven AA-tuned accent swatches as an accessible
// radiogroup. role="radiogroup" over role="radio" round buttons, aria-checked
// reflecting the selected dark hex, arrow-key roving selection (clamped, no wrap),
// and a visible focus ring. The SELECTED swatch shows a Check glyph + ring so
// selection is NEVER by color alone (WCAG 1.4.1). The swatch count is driven by
// ACCENT_SCALE.length (not hardcoded). The persisted/display value is the pair.dark
// hex; onChange emits that dark hex. Layout-agnostic: responsive flex-wrap grid.

import { Check } from "lucide-react";
import { ACCENT_SCALE } from "@/shell/appearance";

export interface AccentSwatchGridProps {
  /** The currently selected accent (the persisted DARK hex). */
  value: string;
  onChange: (darkHex: string) => void;
}

export function AccentSwatchGrid({ value, onChange }: AccentSwatchGridProps) {
  const selectedIdx = ACCENT_SCALE.findIndex(
    (p) => p.dark.toLowerCase() === value.toLowerCase(),
  );

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    const dir =
      e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? -1
        : e.key === "ArrowRight" || e.key === "ArrowDown"
          ? 1
          : 0;
    if (dir === 0) return;
    e.preventDefault();
    // Clamp at the ends (no wrap) — matches the Sidebar roving convention.
    const nextIdx = Math.min(ACCENT_SCALE.length - 1, Math.max(0, idx + dir));
    if (nextIdx !== idx) onChange(ACCENT_SCALE[nextIdx].dark);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Accent color"
      className="flex flex-wrap gap-2"
    >
      {ACCENT_SCALE.map((pair, idx) => {
        const selected = pair.dark.toLowerCase() === value.toLowerCase();
        // If the persisted value isn't in the scale, make the first swatch the
        // single Tab stop so the group is still keyboard-reachable.
        const isTabStop = selected || (selectedIdx === -1 && idx === 0);
        return (
          <button
            key={pair.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={pair.label}
            tabIndex={isTabStop ? 0 : -1}
            onClick={() => onChange(pair.dark)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            style={{ backgroundColor: pair.dark }}
            className={[
              "flex h-7 w-7 items-center justify-center rounded-full outline-none transition-shadow",
              "ring-offset-2 ring-offset-pane focus-visible:ring-2 focus-visible:ring-accent",
              selected ? "ring-2 ring-tx" : "ring-1 ring-bd",
            ].join(" ")}
          >
            {selected ? (
              <Check
                className="h-4 w-4"
                style={{ color: "#ffffff" }}
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
