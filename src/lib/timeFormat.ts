// timeFormat — pure module (D-03/D-05/D-06/D-10). Native Intl/Date ONLY, no date
// library. Shared by Unix Time (Plan 02) and JWT claim humanization (Plan 03) so
// the timestamp logic lives here ONCE rather than duplicated in each tool.
// Invalid inputs throw bounded explicit Errors (no silent "Invalid Date" leaking).

export interface FormattedTimestamp {
  /** UTC ISO 8601, e.g. "2016-07-30T23:54:10.259Z". */
  iso: string;
  /** Locale-aware human string in UTC. */
  utc: string;
  /** Locale-aware human string in the local zone. */
  local: string;
}

/** Format a ms timestamp as ISO + human local/UTC. Throws on invalid input. */
export function formatTimestamp(ms: number): FormattedTimestamp {
  if (!Number.isFinite(ms)) throw new Error("Invalid timestamp");
  const d = new Date(ms);
  if (isNaN(d.getTime())) throw new Error("Invalid timestamp");
  const utc = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "UTC",
  }).format(d);
  const local = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "long",
  }).format(d);
  return { iso: d.toISOString(), utc, local };
}

const REL_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "day", ms: 86400_000 },
  { unit: "hour", ms: 3600_000 },
  { unit: "minute", ms: 60_000 },
  { unit: "second", ms: 1000 },
];

/**
 * Human relative time ("in 3 days" / "5 minutes ago") via Intl.RelativeTimeFormat
 * when present; returns "" (so callers fall back to absolute) if it is absent.
 * Never throws.
 */
export function relativeTime(targetMs: number, nowMs: number = Date.now()): string {
  try {
    const RTF = (Intl as { RelativeTimeFormat?: typeof Intl.RelativeTimeFormat })
      .RelativeTimeFormat;
    if (typeof RTF !== "function") return "";
    const diff = targetMs - nowMs;
    const rtf = new RTF(undefined, { numeric: "auto" });
    for (const { unit, ms } of REL_UNITS) {
      if (Math.abs(diff) >= ms || unit === "second") {
        return rtf.format(Math.round(diff / ms), unit);
      }
    }
    return rtf.format(0, "second");
  } catch {
    return "";
  }
}

/**
 * Classify an integer timestamp's unit by magnitude (D-05):
 *   seconds → [1e9, 1e11)  (≈ 2001–5138 AD as seconds)
 *   ms      → [1e12, 1e14)
 * Outside those bands: pick "s" if reading the value as seconds lands in a sane
 * window (1973–2100), else "ms". (µs/ns are D-20 discretion; s/ms are required.)
 */
export function classifyUnit(value: number): "s" | "ms" {
  const v = Math.abs(value);
  if (v >= 1e9 && v < 1e11) return "s";
  if (v >= 1e12 && v < 1e14) return "ms";
  // Sane window for a value-as-seconds interpretation: 1973-01-01 .. 2100-01-01.
  const asSeconds = value * 1000;
  const lo = Date.UTC(1973, 0, 1);
  const hi = Date.UTC(2100, 0, 1);
  return asSeconds >= lo && asSeconds < hi ? "s" : "ms";
}

/** Parse an ISO/datetime string to ms (D-06 reverse). Throws on NaN. */
export function toUnixFromIso(isoOrDatetime: string): number {
  const ms = new Date(isoOrDatetime).getTime();
  if (isNaN(ms)) throw new Error("Invalid date string");
  return ms;
}
