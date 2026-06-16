// AppearancePreviewStrip (D-23-3) — a CONTAINED, localized preview of the PENDING
// theme + accent. It reflects the user's pending selection WITHOUT touching the
// global app: it NEVER writes to the DOM root element. The whole-app apply is
// the App-root's job (Plan 03), on a PERSISTED (gated) value only — there is no
// revert path here because nothing global ever changed.
//
// HOW it previews without the root cascade: CSS [data-theme="light"] is rooted at
// :root, so we cannot stamp it locally. Instead the strip's surface colors are
// chosen explicitly by the effective theme (a tiny local light/dark surface
// lookup, for the PREVIEW only), and the accent-dependent samples are driven by an
// inline `--color-accent` var set ON the strip root (scoped to this subtree), so
// the accent-styled samples (the chip, the Activate button) recolor to the pending
// accent in the pending theme. Token utility classes inside the strip resolve that
// scoped var at use-site.

import type { ThemeName } from "@/shell/preferences";
import { accentForTheme } from "@/shell/appearance";
import { resolveEffectiveTheme } from "@/shell/theme";
import { SegmentedControl } from "./SegmentedControl";

export interface AppearancePreviewStripProps {
  /** The PENDING theme (not yet saved). */
  theme: ThemeName;
  /** The PENDING accent (the persisted DARK hex). */
  accent: string;
}

// Surface palette for the preview ONLY (a local subset of the dark @theme defaults
// and the light token block). Used so the strip can show the pending theme's
// surface without stamping data-theme on the root.
const PREVIEW_SURFACE = {
  dark: { pane: "#1a1d23", panel: "#15171c", tx: "#e7e9ee", tx2: "#9aa1ab", bd: "rgba(255,255,255,0.07)", inputBg: "#0d0f13" },
  light: { pane: "#ffffff", panel: "#f7f8fa", tx: "#1a1d23", tx2: "#525861", bd: "rgba(0,0,0,0.08)", inputBg: "#f0f1f4" },
} as const;

export function AppearancePreviewStrip({ theme, accent }: AppearancePreviewStripProps) {
  const resolved = resolveEffectiveTheme(theme);
  const surface = PREVIEW_SURFACE[resolved];
  const accentHex = accentForTheme(accent, resolved);
  // Soft accent fill mirroring FieldNode's chip-on look (accent at low alpha).
  const accentSoft = `color-mix(in srgb, ${accentHex} 15%, transparent)`;
  const accentLine = `color-mix(in srgb, ${accentHex} 75%, transparent)`;

  return (
    <div
      data-appearance-preview
      // Scoped --color-accent: the SegmentedControl sample (which uses
      // bg-accent-soft / text-accent token utilities) recolors to the pending
      // accent within this subtree only. NEVER set on the DOM root element.
      style={
        {
          backgroundColor: surface.pane,
          borderColor: surface.bd,
          color: surface.tx,
          ["--color-accent" as string]: accentHex,
          ["--color-accent-soft" as string]: accentSoft,
          ["--color-accent-line" as string]: accentLine,
        } as React.CSSProperties
      }
      className="flex flex-wrap items-center gap-3 rounded-[10px] border p-4"
    >
      {/* A Decoder-style nav item (the selected nav row uses the accent). */}
      <span
        className="flex items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12px] font-medium"
        style={{ backgroundColor: accentSoft, color: accentHex }}
      >
        Decoder
      </span>

      {/* An "Activate"-style accent button. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="rounded-[7px] px-3 py-1.5 text-[12px] font-medium"
        style={{ backgroundColor: accentHex, color: surface.pane }}
      >
        Activate
      </button>

      {/* A `uint` chip mimicking FieldNode chip-on (the SELECTED chip is accent,
          the field number stays NEUTRAL). */}
      <span className="flex items-center gap-1.5 font-mono text-[11px]">
        <span style={{ color: surface.tx }}>#1</span>
        <span
          className="rounded border px-1.5 py-0.5"
          style={{ backgroundColor: accentSoft, borderColor: accentLine, color: accentHex }}
        >
          uint
        </span>
      </span>

      {/* A sample SegmentedControl toggle (its active segment uses the scoped
          accent vars). Inert in the preview — value fixed, onChange is a no-op. */}
      <div aria-hidden="true">
        <SegmentedControl
          options={[
            { value: "cards", label: "Cards" },
            { value: "rows", label: "Rows" },
          ]}
          value="cards"
          onChange={() => {}}
          ariaLabel="Preview sample toggle"
        />
      </div>
    </div>
  );
}
