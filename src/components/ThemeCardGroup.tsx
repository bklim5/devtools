// ThemeCardGroup (D-23-6) — two theme radio cards (Dark / Light). Deliberately a
// card radiogroup, never a segmented toggle. role="radiogroup" over two
// role="radio" cards, aria-checked reflecting the selected value, arrow-key roving
// selection (Left/Up → previous, Right/Down → next, clamp at the ends — no wrap,
// matching the Sidebar's roving convention), and a visible focus ring. Each card
// carries a tiny stylized app-WINDOW thumbnail (a left sidebar column + a content
// area whose top item is the LIVE accent + neutral content rows, on the theme's
// surface) so the choice is recognizable, and selection is NEVER by color alone
// (a filled-accent radio-check indicator + border-accent + the aria-checked
// state). Layout-agnostic: responsive flex, no fixed px widths beyond the thumb.

import { Check } from "lucide-react";
import type { ThemeName } from "@/shell/preferences";

const THEME_LABELS: Record<ThemeName, string> = {
  dark: "Dark",
  light: "Light",
};

// The visual order of the cards (Dark / Light) — arrow-nav walks this.
const CARD_ORDER: readonly ThemeName[] = ["dark", "light"];

export interface ThemeCardGroupProps {
  value: ThemeName;
  onChange: (theme: ThemeName) => void;
}

/** A tiny stylized app-WINDOW skeleton matching the product chrome: a left
 *  sidebar column (a slightly distinct surface shade) + a content area whose top
 *  item is an accent-colored rounded bar (offset from the content's left edge,
 *  ~60% of the content width — like a highlighted/selected nav item) over two
 *  muted neutral content rows. The accent bar uses the LIVE accent (bg-accent) so
 *  the swatch choice previews. `variant` picks the surface palette — dark uses the
 *  dark tokens, light hardcodes the light surfaces it previews. aria-hidden — the
 *  card label + radio-check + aria-checked carry the meaning. */
function ThemeThumbnail({ variant }: { variant: "dark" | "light" }) {
  const surface =
    variant === "light"
      ? {
          box: "#f0f1f4", // content area (app bg)
          sidebar: "#ffffff", // sidebar — a distinct lighter shade
          row: "rgba(0,0,0,0.14)",
          line: "rgba(0,0,0,0.10)",
        }
      : {
          box: "#0d0f13", // content area (app bg)
          sidebar: "#1a1d23", // sidebar — a distinct lighter shade
          row: "rgba(255,255,255,0.16)",
          line: "rgba(255,255,255,0.10)",
        };
  return (
    <div
      aria-hidden="true"
      className="flex h-[72px] w-full overflow-hidden rounded-[7px] border"
      style={{ backgroundColor: surface.box, borderColor: surface.line }}
    >
      {/* Left sidebar column (~28%), a distinct surface shade with a faint divider. */}
      <div
        className="h-full w-[28%] flex-none border-r"
        style={{ backgroundColor: surface.sidebar, borderColor: surface.line }}
      />
      {/* Content area: accent "selected item" bar (offset, ~60% wide) + 2 rows. */}
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <div className="h-2 w-3/5 rounded-[3px] bg-accent" />
        <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: surface.row }} />
        <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: surface.row }} />
      </div>
    </div>
  );
}

export function ThemeCardGroup({ value, onChange }: ThemeCardGroupProps) {
  function onKeyDown(e: React.KeyboardEvent, theme: ThemeName) {
    const dir =
      e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? -1
        : e.key === "ArrowRight" || e.key === "ArrowDown"
          ? 1
          : 0;
    if (dir === 0) return;
    e.preventDefault();
    const idx = CARD_ORDER.indexOf(theme);
    // Clamp at the ends (no wrap) — matches the Sidebar roving convention.
    const nextIdx = Math.min(CARD_ORDER.length - 1, Math.max(0, idx + dir));
    const next = CARD_ORDER[nextIdx];
    if (next !== theme) onChange(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex flex-wrap gap-3 sm:flex-nowrap"
    >
      {CARD_ORDER.map((theme) => {
        const selected = value === theme;
        const thumbVariant: "dark" | "light" = theme === "light" ? "light" : "dark";
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={selected}
            // The selected card is the only Tab stop for the group (roving
            // tabindex); arrow keys move selection within the group.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(theme)}
            onKeyDown={(e) => onKeyDown(e, theme)}
            className={[
              "flex min-w-0 flex-1 flex-col gap-2 rounded-[10px] border p-3 text-left outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-accent",
              selected
                ? "border-accent-line bg-accent-soft"
                : "border-bd bg-card hover:border-bd-2",
            ].join(" ")}
          >
            <ThemeThumbnail variant={thumbVariant} />
            <span className="flex items-center gap-2">
              {/* Radio-check indicator — filled accent circle + white check when
                  selected, empty bordered circle otherwise. Selection is NEVER
                  by color alone: this icon + the card border carry the state
                  alongside aria-checked (WCAG 1.4.1). aria-hidden — the label
                  text + aria-checked already convey it to AT. */}
              <span
                aria-hidden="true"
                className={[
                  "flex h-4 w-4 flex-none items-center justify-center rounded-full border",
                  selected ? "border-accent bg-accent" : "border-bd-2 bg-transparent",
                ].join(" ")}
              >
                {selected ? (
                  <Check className="h-3 w-3" style={{ color: "#ffffff" }} aria-hidden="true" />
                ) : null}
              </span>
              <span
                className={[
                  "text-[13px] font-medium",
                  selected ? "text-accent" : "text-tx",
                ].join(" ")}
              >
                {THEME_LABELS[theme]}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
