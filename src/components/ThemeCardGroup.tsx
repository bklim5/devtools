// ThemeCardGroup (D-23-6) — two theme radio cards (Dark / Light). Deliberately a
// card radiogroup, never a segmented toggle. role="radiogroup" over two
// role="radio" cards, aria-checked reflecting the selected value, arrow-key roving
// selection (Left/Up → previous, Right/Down → next, clamp at the ends — no wrap,
// matching the Sidebar's roving convention), and a visible focus ring. Each card
// carries a tiny stylized app-window thumbnail (an accent top bar + neutral content
// rows on the theme's surface) so the choice is recognizable, and selection is
// NEVER by color alone (border-accent + the aria-checked state). Layout-agnostic:
// responsive flex, no fixed px widths beyond the small thumb.

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

/** A tiny stylized app-window skeleton: an accent-colored top bar over 2–3 neutral
 *  horizontal content rows, on that theme's surface color. The accent bar uses the
 *  LIVE accent (bg-accent) so it reads as a real preview. `variant` picks the
 *  surface palette — dark uses the dark tokens; light hardcodes the light surfaces
 *  it previews. aria-hidden — the card label + aria-checked carry the meaning. */
function ThemeThumbnail({ variant }: { variant: "dark" | "light" }) {
  const surface =
    variant === "light"
      ? { box: "#ffffff", row: "rgba(0,0,0,0.12)", line: "rgba(0,0,0,0.12)" }
      : { box: "#1a1d23", row: "rgba(255,255,255,0.14)", line: "rgba(255,255,255,0.12)" };
  return (
    <div
      aria-hidden="true"
      className="flex h-12 w-full flex-col overflow-hidden rounded-[6px] border"
      style={{ backgroundColor: surface.box, borderColor: surface.line }}
    >
      {/* Accent top bar — the live accent (bg-accent) so the swatch choice previews. */}
      <div className="h-3 w-full flex-none bg-accent" />
      {/* 3 neutral content rows below, decreasing width for a window-like skeleton. */}
      <div className="flex flex-1 flex-col justify-center gap-1 px-1.5">
        <div className="h-1 w-3/4 rounded-full" style={{ backgroundColor: surface.row }} />
        <div className="h-1 w-full rounded-full" style={{ backgroundColor: surface.row }} />
        <div className="h-1 w-1/2 rounded-full" style={{ backgroundColor: surface.row }} />
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
            <span
              className={[
                "text-[13px] font-medium",
                selected ? "text-accent" : "text-tx",
              ].join(" ")}
            >
              {THEME_LABELS[theme]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
