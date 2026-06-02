// The real UUID / ULID tool (UID-01, UX-01..05; D-15/D-16/D-17). A thin, layout-agnostic
// shell over the Plan-01 pure libs (generateUlid / generateUuidV7) + native crypto.randomUUID
// (v4) and the Task-1 decodeId — NO id encode/decode is duplicated here.
//
// Generate region (D-15/D-16): a kind toggle (UUID v4 / UUID v7 / ULID, accent = selected
// only) + a count. ONE id is generated on open (useEffect), and the default-focused
// "Generate" <button> regenerates with a single keystroke/click. count>1 → that many fresh
// entries, each with its own VISIBLE focusable CopyButton (UX-02) + a Copy-all (newline-
// joined). All randomness comes from crypto / the Plan-01 CSPRNG libs — never a non-crypto
// PRNG (T-04-15).
//
// Decode region (D-17): paste a UUID or ULID → decodeId auto-detects it on every change
// (paste-instant, UX-01) and renders the breakdown; empty is neutral; malformed is a single
// field-scoped error (aria-invalid + text-bad, never opacity-only, UX-04), never a crash.
// Clipboard goes through the platform seam ONLY (via CopyButton).
import { useCallback, useMemo, useState } from "react";
import { platform } from "@/lib/platform";
import { CopyButton } from "@/components/CopyButton";
import { StatusBar, type ParseState } from "@/components/StatusBar";
import { useCopyFeedback } from "@/shell/useCopyFeedback";
import { generateUlid } from "@/lib/ulid";
import { generateUuidV7 } from "@/lib/uuidv7";
import { formatTimestamp, relativeTime } from "@/lib/timeFormat";
import { bytesToHex } from "@/lib/bytes";
import { decodeId, type DecodedId } from "./decodeId";

type Kind = "uuid-v4" | "uuid-v7" | "ulid";

const KINDS: { id: Kind; label: string }[] = [
  { id: "uuid-v4", label: "UUID v4" },
  { id: "uuid-v7", label: "UUID v7" },
  { id: "ulid", label: "ULID" },
];

const COPY_LABEL: Record<Kind, string> = {
  "uuid-v4": "UUID",
  "uuid-v7": "UUID",
  ulid: "ULID",
};

/** Generate one id of the chosen kind from a CSPRNG (never a non-crypto PRNG, T-04-15). */
function generate(kind: Kind): string {
  switch (kind) {
    case "uuid-v4":
      return crypto.randomUUID();
    case "uuid-v7":
      return generateUuidV7();
    case "ulid":
      return generateUlid();
  }
}

/** Hard cap on batch generation — no path may produce more than 100 entries (G-04-4). */
const MAX_COUNT = 100;

function generateBatch(kind: Kind, count: number): string[] {
  const n = Math.max(1, Math.min(count, MAX_COUNT));
  return Array.from({ length: n }, () => generate(kind));
}

/** Clamp a raw count string to a valid 1..100 number for generation (G-04-3/G-04-4). */
function clampCount(text: string): number {
  const n = Number.parseInt(text, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_COUNT);
}

interface GeneratedRowProps {
  id: string;
  label: string;
}

function GeneratedRow({ id, label }: GeneratedRowProps) {
  return (
    <div
      data-generated-id={id}
      className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-bd bg-input-bg px-3 py-2"
    >
      <code className="min-w-0 truncate font-mono text-[13px] text-tx">{id}</code>
      <CopyButton value={id} label={label} />
    </div>
  );
}

interface KindToggleProps {
  value: Kind;
  onChange: (next: Kind) => void;
}

function KindToggle({ value, onChange }: KindToggleProps) {
  return (
    <div
      role="group"
      aria-label="ID kind"
      className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
    >
      {KINDS.map(({ id, label }) => {
        const active = id === value;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={[
              "cursor-pointer rounded-[5px] px-2 py-0.5 text-[11px] font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border border-accent-line bg-accent-soft text-accent"
                : "border border-transparent text-tx-2 hover:text-tx",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Render the decoded breakdown for an ok UUID / ULID result. */
function Breakdown({ decoded }: { decoded: Extract<DecodedId, { kind: "ok" }> }) {
  const rows: { label: string; value: string }[] = [];
  if (decoded.type === "uuid") {
    rows.push({ label: "Type", value: "UUID" });
    rows.push({ label: "Version", value: String(decoded.version) });
    rows.push({ label: "Variant", value: decoded.variant });
    if (typeof decoded.tsMs === "number") {
      const ts = formatTimestamp(decoded.tsMs);
      const rel = relativeTime(decoded.tsMs);
      rows.push({ label: "Timestamp", value: ts.iso });
      rows.push({ label: "Local", value: rel ? `${ts.local} (${rel})` : ts.local });
    }
  } else {
    const ts = formatTimestamp(decoded.tsMs);
    const rel = relativeTime(decoded.tsMs);
    rows.push({ label: "Type", value: "ULID" });
    rows.push({ label: "Timestamp", value: ts.iso });
    rows.push({ label: "Local", value: rel ? `${ts.local} (${rel})` : ts.local });
    rows.push({ label: "Randomness", value: bytesToHex(decoded.randomness) });
  }

  return (
    <section
      id="uuid-ulid-breakdown"
      className="flex min-w-0 flex-col gap-2 rounded-lg border border-bd bg-input-bg p-3"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-2">
        Breakdown
      </span>
      <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-[12px] text-tx-2">{r.label}</dt>
            <dd className="flex min-w-0 items-center gap-2">
              <code className="min-w-0 break-all font-mono text-[13px] text-tx">
                {r.value}
              </code>
              <CopyButton value={r.value} label={r.label} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function UuidUlidTool() {
  const [kind, setKind] = useState<Kind>("uuid-v4");
  // The count is held as the RAW STRING so the field can be cleared and retyped normally
  // (transient empty allowed, G-04-3); the numeric count for generation is derived by
  // clamping on read (1..100, G-04-4).
  const [countText, setCountText] = useState("1");
  const [ids, setIds] = useState<string[]>(() => generateBatch("uuid-v4", 1));
  const [decodeRaw, setDecodeRaw] = useState("");
  const [copiedAll, confirmCopyAll] = useCopyFeedback();

  const regenerate = useCallback(
    (k: Kind = kind, c: number = clampCount(countText)) => setIds(generateBatch(k, c)),
    [kind, countText],
  );

  // Generate ONE on open (D-16) via the lazy useState initializer above — no mount
  // effect needed (and the React Compiler lint forbids setState directly in an effect).
  // Subsequent regeneration is explicit (Generate / kind / count).

  function handleKind(next: Kind) {
    setKind(next);
    regenerate(next, clampCount(countText));
  }

  // Store the raw text as typed (so the user can clear it / type 2-9 without select-then-
  // replace, G-04-3) and regenerate using the clamped value (G-04-4). The field is
  // normalized back to a valid number on blur.
  function handleCount(raw: string) {
    setCountText(raw);
    regenerate(kind, clampCount(raw));
  }

  function handleCopyAll() {
    void platform.clipboard.writeText(ids.join("\n"));
    confirmCopyAll();
  }

  const decoded = decodeId(decodeRaw);
  const decodeError = decoded.kind === "error" ? decoded.message : null;
  const parseState: ParseState =
    decoded.kind === "error" ? "error" : decoded.kind === "empty" ? "empty" : "ok";

  const generatedLabel = useMemo(() => COPY_LABEL[kind], [kind]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-auto p-4">
        {/* Generate region */}
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-tx-2">
              Generate
            </span>
            <KindToggle value={kind} onChange={handleKind} />
            <label
              htmlFor="uuid-ulid-count"
              className="flex items-center gap-1.5 text-[12px] text-tx-2"
            >
              Count
              <input
                id="uuid-ulid-count"
                type="number"
                min={1}
                max={100}
                value={countText}
                onChange={(e) => handleCount(e.target.value)}
                onBlur={() => setCountText(String(clampCount(countText)))}
                className="w-16 rounded-[7px] border border-bd bg-input-bg px-2 py-1 font-mono text-[12px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            <button
              type="button"
              autoFocus
              onClick={() => regenerate()}
              className="cursor-pointer rounded-[7px] border border-accent-line bg-accent-soft px-3 py-1 text-[12px] font-medium text-accent outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
            >
              Generate
            </button>
            {ids.length > 1 ? (
              <button
                type="button"
                onClick={handleCopyAll}
                aria-label="Copy all generated ids"
                className={[
                  "cursor-pointer rounded-[7px] border bg-input-bg px-3 py-1 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  copiedAll
                    ? "border-accent-line text-accent"
                    : "border-bd text-tx-2 hover:border-bd-2 hover:text-tx",
                ].join(" ")}
              >
                {copiedAll ? "Copied all" : "Copy all"}
              </button>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            {ids.map((id, i) => (
              <GeneratedRow key={`${id}-${i}`} id={id} label={generatedLabel} />
            ))}
          </div>
        </section>

        {/* Decode region */}
        <section className="flex min-w-0 flex-col gap-2">
          <label
            htmlFor="uuid-ulid-decode"
            className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
          >
            Decode
          </label>
          <textarea
            id="uuid-ulid-decode"
            value={decodeRaw}
            onChange={(e) => setDecodeRaw(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Paste a UUID or ULID…"
            aria-invalid={decodeError ? true : undefined}
            aria-describedby={decodeError ? "uuid-ulid-decode-error" : undefined}
            className="min-h-[64px] w-full resize-y rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
          />
          {decodeError ? (
            <p
              id="uuid-ulid-decode-error"
              aria-live="polite"
              className="text-[12px] text-bad"
            >
              {decodeError}
            </p>
          ) : null}
          {decoded.kind === "ok" ? <Breakdown decoded={decoded} /> : null}
        </section>
      </div>
      <StatusBar parseState={parseState} error={decodeError} />
    </div>
  );
}
