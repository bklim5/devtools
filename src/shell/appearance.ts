// The single source of truth for the dual-theme accent scale + light token set
// (D-23-7, D-23-8). Pure data + one pure mapper — no DOM, no deps.
//
// PERSISTED ACCENT REPRESENTATION (RESEARCH A1): the persisted `accent` is the
// DARK hex (so DEFAULT_PREFERENCES.accent stays a real color and gatePreferences'
// default keeps working). `accentForTheme` reverse-maps that dark hex to the hex
// to apply under the effective theme.

export const THEME_NAMES = ["light", "dark", "system"] as const;

/** Per-swatch two-value accent scale (D-23-7). `dark` = --color-accent in the
 *  dark theme AND the swatch's display color; `light` = --color-accent under
 *  [data-theme="light"]. A single hex CANNOT pass WCAG-AA in BOTH themes
 *  (math-proven, RESEARCH Pattern 2 — the dark default #5b9bf8 is 4.88:1 on the
 *  dark soft-fill but only 2.44:1 on a white light surface), so the scale is
 *  required, not optional. Persisted accent = the dark hex. */
export interface AccentPair {
  key: string;
  label: string;
  dark: string;
  light: string;
}

export const ACCENT_SCALE: readonly AccentPair[] = [
  { key: "blue", label: "Blue", dark: "#5b9bf8", light: "#1763d6" }, // default; dark FIXED (D-23-7)
  { key: "violet", label: "Violet", dark: "#a78bfa", light: "#6d28d9" },
  { key: "green", label: "Green", dark: "#4ade80", light: "#15722f" },
  { key: "amber", label: "Amber", dark: "#fbbf24", light: "#a14708" },
  { key: "rose", label: "Rose", dark: "#fb7185", light: "#be123c" },
  { key: "teal", label: "Teal", dark: "#2dd4bf", light: "#0d6e66" },
  { key: "slate", label: "Slate", dark: "#94a3b8", light: "#475569" },
];

/** The blue dark hex (D-23-7) — equals DEFAULT_PREFERENCES.accent (Pitfall 1). */
export const DEFAULT_ACCENT = "#5b9bf8";

/** Map a persisted (dark) accent hex to the hex to apply under `resolved` theme.
 *  Reverse-maps via ACCENT_SCALE; an unknown hex (a hand-edited/legacy value not
 *  in the scale) is returned UNCHANGED — fail-soft, never throws (T-23-02). */
export function accentForTheme(darkHex: string, resolved: "light" | "dark"): string {
  if (resolved === "dark") return darkHex;
  const pair = ACCENT_SCALE.find((p) => p.dark.toLowerCase() === darkHex.toLowerCase());
  return pair ? pair.light : darkHex;
}

/** The full light token set (D-23-8) — names mirror src/index.css @theme. The CSS
 *  itself lives in index.css (Plan 02 re-declares these under [data-theme="light"]);
 *  these values are the single source the contrast test enforces against the AA
 *  bar. Every value is WCAG-AA verified by appearanceContrast.test.ts. */
export const LIGHT_TOKENS = {
  "bg-app": "#f3f4f6",
  win: "#ffffff",
  titlebar: "#f7f8fa",
  sidebar: "#f0f1f4",
  pane: "#ffffff",
  panel: "#f7f8fa",
  card: "#ffffff",
  palette: "#ffffff",
  "input-bg": "#f0f1f4",
  tx: "#1a1d23",
  "tx-2": "#525861",
  "tx-3": "#6b7280",
  warn: "#b45309",
  ok: "#15722f",
} as const;
