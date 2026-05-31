// The real Hash tool (HASH-01, UX-01..05, D-11/D-12/D-13/D-14). A thin, layout-agnostic
// shell over the pure hashes.ts digest functions. One input <textarea> + an INPUT-ENCODING
// toggle (UTF-8 / hex / base64) — on every change (paste-instant, UX-01) the raw text is
// parsed through bytes.ts into a SINGLE internal Uint8Array (D-11, reusing bytes.ts end-to-
// end like Base64). Bad input for the chosen encoding → a field-scoped error (aria-invalid +
// text-bad, never opacity-only, UX-04), no crash, no stale digests (T-04-10).
//
// Reactive digests (D-14): MD5 is sync, the four SHA are async (subtle.digest). They are
// computed in a useEffect keyed on the bytes; a `let live` cleanup guards against out-of-order
// resolution so fast typing never shows a stale SHA (Pitfall 3). All five are shown at once,
// stacked (D-12), each row with its own VISIBLE focusable CopyButton (UX-02). A casing toggle
// (D-13, default lowercase) flips the DISPLAY + copied value to uppercase; the canonical digest
// stays lowercase. Clipboard goes through CopyButton → the platform seam ONLY (never the
// Tauri APIs directly — tools must not import the @tauri‑apps packages).
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { StatusBar, type ParseState } from "@/components/StatusBar";
import {
  base64ToBytes,
  hexToBytes,
  utf8ToBytes,
} from "@/lib/bytes";
import { md5Hex, shaHex, type DigestRow, type ShaAlgorithm } from "./hashes";

/** The four SHA variants, shown after MD5, in order (D-12). */
const SHA_ALGOS: ShaAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

/** The three input-encoding modes (D-11). */
const INPUT_ENCODINGS = ["UTF-8", "hex", "base64"] as const;
type InputEncoding = (typeof INPUT_ENCODINGS)[number];

/** Parse the raw input string for the chosen encoding into a single Uint8Array (D-11). */
function parseInput(raw: string, encoding: InputEncoding): Uint8Array {
  switch (encoding) {
    case "UTF-8":
      return utf8ToBytes(raw);
    case "hex":
      return hexToBytes(raw);
    case "base64":
      return base64ToBytes(raw, "base64");
  }
}

interface EncodingToggleProps {
  value: InputEncoding;
  onChange: (next: InputEncoding) => void;
}

function EncodingToggle({ value, onChange }: EncodingToggleProps) {
  return (
    <div
      role="group"
      aria-label="Input encoding"
      className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
    >
      {INPUT_ENCODINGS.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={[
              "rounded-[5px] px-2 py-0.5 text-[11px] font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border border-accent-line bg-accent-soft text-accent"
                : "border border-transparent text-tx-2 hover:text-tx",
            ].join(" ")}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

interface CasingToggleProps {
  upper: boolean;
  onChange: (next: boolean) => void;
}

function CasingToggle({ upper, onChange }: CasingToggleProps) {
  const options: { label: string; value: boolean }[] = [
    { label: "lower", value: false },
    { label: "UPPER", value: true },
  ];
  return (
    <div
      role="group"
      aria-label="Hex casing"
      className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === upper;
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={[
              "rounded-[5px] px-2 py-0.5 text-[11px] font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border border-accent-line bg-accent-soft text-accent"
                : "border border-transparent text-tx-2 hover:text-tx",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface DigestRowViewProps {
  algo: string;
  hex: string;
  upper: boolean;
}

function DigestRowView({ algo, hex, upper }: DigestRowViewProps) {
  // Casing applied on display + to the copied value (D-13); canonical digest stays lowercase.
  const shown = upper ? hex.toUpperCase() : hex;
  return (
    <section
      className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-bd bg-input-bg p-3"
      data-algo={algo}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-2">
          {algo}
        </span>
        <CopyButton value={shown} label={algo} />
      </div>
      <code className="min-w-0 break-all font-mono text-[13px] text-tx">{shown}</code>
    </section>
  );
}

export default function HashTool() {
  const [raw, setRaw] = useState("");
  const [encoding, setEncoding] = useState<InputEncoding>("UTF-8");
  const [upper, setUpper] = useState(false);
  // The four async SHA digests, tagged with the exact bytes they were computed from so a
  // resolved-then-retyped result is recognised as stale and not shown (Pitfall 3).
  const [shaResult, setShaResult] = useState<{ src: Uint8Array; rows: DigestRow[] } | null>(
    null,
  );
  const [timingMs, setTimingMs] = useState<number | undefined>(undefined);

  // Parse the input into a single Uint8Array (D-11). A bad encoding for the chosen mode is a
  // bounded field-scoped error, never a crash (T-04-10). Memoized so the digest effect keys
  // on a stable result. `bytes` is null while the input is in error.
  const { bytes, error } = useMemo<{ bytes: Uint8Array | null; error: string | null }>(() => {
    if (raw === "") return { bytes: new Uint8Array(0), error: null };
    try {
      return { bytes: parseInput(raw, encoding), error: null };
    } catch (e) {
      return { bytes: null, error: e instanceof Error ? e.message : "Invalid input" };
    }
  }, [raw, encoding]);

  const isEmpty = raw === "";

  // MD5 is synchronous (js-md5), so it renders the instant the bytes change (D-14) — no
  // waiting on a Promise. Empty/error → no MD5 row.
  const md5Row = useMemo<DigestRow | null>(
    () => (bytes === null || isEmpty ? null : { algo: "MD5", hex: md5Hex(bytes) }),
    [bytes, isEmpty],
  );

  // Reactive async SHA digests (D-14, Pitfall 3 guard). The four SHA are computed when the
  // bytes change; a `live` flag discards out-of-order resolutions so fast typing never shows a
  // stale SHA. On a parse error (bytes === null) we skip computing — and because `md5Row` is
  // then null, orderedRows is empty so the now-stale shaRows are never rendered (no flush
  // needed, keeping the effect free of synchronous setState).
  useEffect(() => {
    if (bytes === null) return;
    let live = true;
    const start = performance.now();
    void Promise.all(SHA_ALGOS.map((algo) => shaHex(algo, bytes))).then((hexes) => {
      if (!live) return;
      setShaResult({
        src: bytes,
        rows: SHA_ALGOS.map((algo, i) => ({ algo, hex: hexes[i] })),
      });
      setTimingMs(performance.now() - start);
    });
    return () => {
      live = false;
    };
  }, [bytes]);

  const parseState: ParseState = error ? "error" : isEmpty ? "empty" : "ok";
  const byteCount = bytes?.length ?? 0;
  // Only trust the SHA rows when they belong to the CURRENT bytes (Pitfall 3); otherwise the
  // rows are blank placeholders until the in-flight digest for these bytes resolves.
  const shaRows = shaResult && shaResult.src === bytes ? shaResult.rows : [];
  // MD5 (sync) first, then the four SHA rows (each "" until its async resolve, D-12 order).
  const orderedRows: DigestRow[] = md5Row
    ? [
        md5Row,
        ...SHA_ALGOS.map(
          (algo) => shaRows.find((r) => r.algo === algo) ?? { algo, hex: "" },
        ),
      ]
    : [];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <section className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="hash-input"
              className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
            >
              Input
            </label>
            <EncodingToggle value={encoding} onChange={setEncoding} />
          </div>
          <textarea
            id="hash-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Paste text, hex, or base64…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "hash-input-error" : undefined}
            className="min-h-[88px] w-full resize-y rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
          {error ? (
            <p id="hash-input-error" aria-live="polite" className="text-[12px] text-bad">
              {error}
            </p>
          ) : null}
        </section>

        {!isEmpty && !error ? (
          <section className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-2">
                Digests
              </span>
              <CasingToggle upper={upper} onChange={setUpper} />
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              {orderedRows.map((row) => (
                <DigestRowView
                  key={row.algo}
                  algo={row.algo}
                  hex={row.hex}
                  upper={upper}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <StatusBar
        parseState={parseState}
        byteCount={byteCount}
        encoding={encoding}
        error={error}
        timingMs={timingMs}
      />
    </div>
  );
}
