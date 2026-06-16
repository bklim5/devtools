// Executable WCAG-AA assertions over the accent scale + light-token tables
// (D-23-7 / D-23-8). This MECHANIZES the "AA in both themes" bar — the contrast
// math is enforced by vitest, never eyeballed. If a swatch/token ever fails, the
// fix is to hand-tune the failing hex in appearance.ts (darken the light variant
// / brighten the dark variant) until it clears 4.5:1 — NEVER weaken the 4.5:1
// threshold below.
//
// Pure WCAG 2.x relative-luminance contrast (no deps): srgb → linear →
// 0.2126R + 0.7152G + 0.0722B, ratio = (L1 + 0.05) / (L2 + 0.05).
import { describe, expect, it } from "vitest";
import { ACCENT_SCALE, LIGHT_TOKENS, accentForTheme } from "./appearance";

/** Parse a 3- or 6-digit hex into [r, g, b] (0–255). */
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance of a hex color. */
function lum(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (symmetric, ≥1). */
function contrastRatio(a: string, b: string): number {
  const la = lum(a);
  const lb = lum(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** accent-soft is `pct` accent alpha-composited over an OPAQUE card hex. Composite
 *  each channel: accent*pct + card*(1-pct), then format back to hex. */
function softFill(accentHex: string, cardHex: string, pct: number): string {
  const a = parseHex(accentHex);
  const c = parseHex(cardHex);
  const blend = (ai: number, ci: number) => ai * pct + ci * (1 - pct);
  return toHex([blend(a[0], c[0]), blend(a[1], c[1]), blend(a[2], c[2])]);
}

const DARK_CARD = "#181b21"; // index.css --color-card (dark)
const LIGHT_CARD = "#ffffff"; // LIGHT_TOKENS.card

describe("contrast function sanity", () => {
  it("contrastRatio for tx on white is ~16.9", () => {
    expect(contrastRatio("#1a1d23", "#ffffff")).toBeCloseTo(16.9, 0);
  });

  it("contrastRatio is symmetric", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(contrastRatio("#000", "#fff"), 5);
  });
});

describe("WCAG-AA accent scale — selected-label text on accent-soft, BOTH themes", () => {
  for (const p of ACCENT_SCALE) {
    it(`${p.key} dark hex on dark accent-soft (15%) >= 4.5:1`, () => {
      expect(
        contrastRatio(p.dark, softFill(p.dark, DARK_CARD, 0.15)),
      ).toBeGreaterThanOrEqual(4.5);
    });
    it(`${p.key} light hex on light accent-soft (12%) >= 4.5:1`, () => {
      expect(
        contrastRatio(p.light, softFill(p.light, LIGHT_CARD, 0.12)),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("WCAG-AA light text ramp on white pane", () => {
  for (const t of ["tx", "tx-2", "tx-3"] as const) {
    it(`${t} >= 4.5:1 on white`, () => {
      expect(contrastRatio(LIGHT_TOKENS[t], "#ffffff")).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("WCAG-AA light status tokens on their light surface", () => {
  // warn renders on bg-pane (#ffffff) and the panel card (#f7f8fa); ok likewise.
  it("warn (#b45309) >= 4.5:1 on white pane", () => {
    expect(contrastRatio(LIGHT_TOKENS.warn, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
  it("ok (#15722f) >= 4.5:1 on white pane", () => {
    expect(contrastRatio(LIGHT_TOKENS.ok, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("accentForTheme reverse-maps the persisted dark hex (D-23-7)", () => {
  it("returns the dark hex unchanged under dark", () => {
    expect(accentForTheme("#5b9bf8", "dark")).toBe("#5b9bf8");
  });

  it("maps the default blue dark hex to its light variant", () => {
    expect(accentForTheme("#5b9bf8", "light")).toBe("#1763d6");
  });

  it("maps every scale entry to its light variant (case-insensitive)", () => {
    for (const p of ACCENT_SCALE) {
      expect(accentForTheme(p.dark.toUpperCase(), "light")).toBe(p.light);
    }
  });

  it("returns an unknown hex UNCHANGED (fail-soft, never throws — T-23-02)", () => {
    expect(accentForTheme("#abcdef", "light")).toBe("#abcdef");
    expect(accentForTheme("#abcdef", "dark")).toBe("#abcdef");
  });
});
