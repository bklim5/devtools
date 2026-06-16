// ThemeCardGroup (D-23-6) — three theme radio cards (Dark / Light / System).
// Deliberately a card radiogroup, never a segmented toggle. role="radiogroup" over three
// role="radio" cards, aria-checked reflecting the selected value, arrow-key roving
// selection (Left/Up → previous, Right/Down → next, clamp at the ends — no wrap,
// matching the Sidebar's roving convention), and a visible focus ring. Each card
// carries a tiny stylized app-preview thumbnail (sidebar + pane + accent dot) so
// the choice is recognizable, and selection is NEVER by color alone (border-accent
// + the aria-checked state). Layout-agnostic: responsive flex, no fixed px widths.

import type { ThemeName } from "@/shell/preferences";

const THEME_LABELS: Record<ThemeName, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

// The visual order of the cards (Dark / Light / System) — arrow-nav walks this.
const CARD_ORDER: readonly ThemeName[] = ["dark", "light", "system"];

export interface ThemeCardGroupProps {
  value: ThemeName;
  onChange: (theme: ThemeName) => void;
}

/** A tiny stylized app-preview thumbnail: a two-pane (sidebar + content) box with
 *  an accent dot. `variant` picks the surface palette — dark/system use the live
 *  dark tokens; light hardcodes the light surfaces (RESEARCH note: the light card
 *  previews the light theme, so it illustrates the light surfaces directly). */
function ThemeThumbnail({ variant }: { variant: "dark" | "light" }) {
  const surface =
    variant === "light"
      ? { box: "#ffffff", sidebar: "#f0f1f4", pane: "#ffffff", line: "rgba(0,0,0,0.12)" }
      : { box: "#0d0f13", sidebar: "#15171c", pane: "#1a1d23", line: "rgba(255,255,255,0.12)" };
  return (
    <div
      aria-hidden="true"
      className="flex h-12 w-full overflow-hidden rounded-[6px] border"
      style={{ backgroundColor: surface.box, borderColor: surface.line }}
    >
      <div className="h-full w-1/3" style={{ backgroundColor: surface.sidebar }} />
      <div className="relative h-full flex-1" style={{ backgroundColor: surface.pane }}>
        <span
          className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-accent"
          aria-hidden="true"
        />
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
