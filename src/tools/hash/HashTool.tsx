// The real Hash tool (HASH-01, UX-01..05, D-12/D-13; G-04-1/G-04-2). A thin, layout-agnostic
// shell over the pure hashes.ts digest functions. One input <textarea> — input is ALWAYS
// treated as TEXT (G-04-1, supersedes D-11): on every change (paste-instant, UX-01) the raw
// text is parsed through bytes.ts `utf8ToBytes` into a SINGLE internal Uint8Array. UTF-8 of any
// string never throws, so there is NO error path and NO encoding selector.
//
// Reactive digests (D-14): MD5 is sync, the four SHA are async (subtle.digest). They are
// computed in a useEffect keyed on the bytes; a `let live` cleanup guards against out-of-order
// resolution so fast typing never shows a stale SHA (Pitfall 3). All five rows ALWAYS render,
// stacked (D-12), in FIXED-HEIGHT containers from mount so typing never reflows/flickers
// (G-04-2) — only the inner digest text swaps. Each row has its own VISIBLE focusable
// CopyButton (UX-02). A casing toggle (D-13, default lowercase) flips the DISPLAY + copied
// value to uppercase; the canonical digest stays lowercase. Clipboard goes through CopyButton
// → the platform seam ONLY (never the Tauri APIs directly).
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { StatusBar, type ParseState } from "@/components/StatusBar";
import { utf8ToBytes } from "@/lib/bytes";
import { md5Hex, shaHex, type DigestRow, type ShaAlgorithm } from "./hashes";

/** The four SHA variants, shown after MD5, in order (D-12). */
const SHA_ALGOS: ShaAlgorithm[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

/** All five algorithms, in display order — used to render a STABLE row list every render. */
const ALL_ALGOS = ["MD5", ...SHA_ALGOS] as const;

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
              "cursor-pointer rounded-[5px] px-2 py-0.5 text-[11px] font-medium outline-none transition-colors",
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
      {/* Fixed line-height + reserved min-height so an empty "" row and a filled 128-char
          SHA-512 row occupy identical height — typing swaps text only, never geometry
          (G-04-2, no reflow). Layout-agnostic: no fixed pixel WIDTH (UX-05). */}
      <code className="block min-w-0 break-all font-mono text-[13px] leading-5 min-h-[2.5rem] text-tx">
        {shown}
      </code>
    </section>
  );
}

export default function HashTool() {
  const [raw, setRaw] = useState("");
  const [upper, setUpper] = useState(false);
  // The four async SHA digests, tagged with the exact bytes they were computed from so a
  // resolved-then-retyped result is recognised as stale and not shown (Pitfall 3).
  const [shaResult, setShaResult] = useState<{ src: Uint8Array; rows: DigestRow[] } | null>(
    null,
  );
  const [timingMs, setTimingMs] = useState<number | undefined>(undefined);

  // Input is ALWAYS text (G-04-1). UTF-8 of any string never throws, so `bytes` is never null
  // and there is no error path. Memoized so the digest effect keys on a stable result.
  const bytes = useMemo<Uint8Array>(
    () => (raw === "" ? new Uint8Array(0) : utf8ToBytes(raw)),
    [raw],
  );

  const isEmpty = raw === "";

  // MD5 is synchronous (js-md5), so it renders the instant the bytes change (D-14) — no
  // waiting on a Promise. Empty → no MD5 value.
  const md5Hex5 = useMemo<string>(
    () => (isEmpty ? "" : md5Hex(bytes)),
    [bytes, isEmpty],
  );

  // Reactive async SHA digests (D-14, Pitfall 3 guard). The four SHA are computed when the
  // bytes change; a `live` flag discards out-of-order resolutions so fast typing never shows a
  // stale SHA. Empty input → skip (no work); the rows simply show "".
  useEffect(() => {
    if (isEmpty) return;
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
  }, [bytes, isEmpty]);

  const parseState: ParseState = isEmpty ? "empty" : "ok";
  // Only trust the SHA rows when they belong to the CURRENT bytes (Pitfall 3); otherwise the
  // rows are blank placeholders until the in-flight digest for these bytes resolves.
  const shaRows = shaResult && shaResult.src === bytes ? shaResult.rows : [];
  // A STABLE list of all five rows every render (G-04-2): MD5 (sync) + the four SHA (each ""
  // until its async resolve). hex = "" when empty or not-yet-resolved.
  const orderedRows: DigestRow[] = ALL_ALGOS.map((algo) => {
    if (algo === "MD5") return { algo, hex: md5Hex5 };
    return shaRows.find((r) => r.algo === algo) ?? { algo, hex: "" };
  });

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
          </div>
          <textarea
            id="hash-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Paste text…"
            className="min-h-[88px] w-full resize-y rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
        </section>

        {/* The Digests section + all five rows ALWAYS render (from mount) so typing never
            mounts/unmounts or reflows the layout (G-04-2). */}
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
      </div>
      <StatusBar parseState={parseState} timingMs={timingMs} />
    </div>
  );
}
