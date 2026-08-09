// The URL tool (URL-01..05, D-01..D-15; the 9th registry-driven tool). One view,
// two modes behind a top-level SegmentedControl mode switch (Parse default, no
// persistence — D-01/02/03):
//   • PARSE — paste an absolute URL → up to 9 labeled, individually-copyable readout rows
//     (D-07/08/09) + a decoded query key→value table built from scratch (no table
//     primitive exists; D-10/11/12). A relative/scheme-less URL is ONE inline
//     role="alert" error, no rows/table (D-13); empty input is neutral (D-15).
//   • ENCODE/DECODE — one input drives a live Encoded + Decoded output pair
//     (Base64-style, both directions at once, useMemo paste-instant; D-04) under a
//     component|full scope toggle (the shared SegmentedControl; D-05) with a
//     one-line distinction caption (D-06). A bad percent-sequence errors only the
//     affected pane (role="alert"), the other stays intact (D-14).
// RENDERING SAFETY (T-13-04 / URL-05): every pasted/decoded value is a React text
// child (default escaping) — raw-HTML injection is FORBIDDEN here. Copy goes
// through the platform clipboard seam ONLY (never @tauri-apps). Layout-agnostic:
// responsive Tailwind, min-w-0, no fixed widths.
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useToolSuccess } from "@/shell/useToolSuccess";
import {
  parseUrl,
  encodeComponent,
  decodeComponent,
  encodeFull,
  decodeFull,
} from "@/lib/url";

type Mode = "parse" | "encode";
type Scope = "component" | "full";

/** A monospace value, or a muted em-dash placeholder when empty (D-09/12). */
function Value({ value }: { value: string }) {
  if (value === "") {
    return <span className="font-mono text-[13px] text-tx-3">—</span>;
  }
  return (
    <span className="break-all font-mono text-[13px] text-tx">{value}</span>
  );
}

const READOUT_LABELS = [
  "scheme",
  "host",
  "port",
  "path",
  "query",
  "fragment",
  "origin",
  "username",
  "password",
] as const;

interface ParseModeProps {
  input: string;
  onInput: (next: string) => void;
  result: ReturnType<typeof parseUrl>;
}

/** Presentational: the input + result live in UrlTool (see the seam note there). */
function ParseMode({ input, onInput, result }: ParseModeProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="flex min-w-0 flex-col gap-2">
        <label
          htmlFor="url-parse-input"
          className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
        >
          URL
        </label>
        <textarea
          id="url-parse-input"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="https://user:pass@host:8080/path?a=1&b=2#frag"
          aria-invalid={"error" in result ? true : undefined}
          className="min-h-[72px] w-full resize-y rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
        />
      </section>

      {"empty" in result ? (
        <p className="text-[12px] text-tx-3">
          Paste an absolute URL to split it into its parts and decode its query.
        </p>
      ) : "error" in result ? (
        <p role="alert" className="text-[12px] text-bad">
          {result.error}
        </p>
      ) : (
        <>
          <section className="flex min-w-0 flex-col gap-1.5">
            {READOUT_LABELS.map((label) => {
              const value = result.url[label];
              return (
                <div
                  key={label}
                  data-readout-row
                  className="flex min-w-0 items-center gap-3 rounded-md border border-bd bg-input-bg/40 px-3 py-1.5"
                >
                  <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-tx-2">
                    {label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Value value={value} />
                  </span>
                  <CopyButton value={value} label={label} className="shrink-0" />
                </div>
              );
            })}
          </section>

          <section className="flex min-w-0 flex-col gap-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tx-2">
              Query ({result.url.queryRows.length})
            </h2>
            {result.url.queryRows.length === 0 ? (
              <p className="text-[12px] text-tx-3">No query parameters.</p>
            ) : (
              <div className="flex min-w-0 flex-col gap-1.5">
                {result.url.queryRows.map((row, i) => (
                  <div
                    key={`${row.key}-${i}`}
                    data-query-row
                    className="flex min-w-0 items-center gap-3 rounded-md border border-bd bg-input-bg/40 px-3 py-1.5"
                  >
                    <span className="min-w-0 max-w-[40%] shrink-0 break-all font-mono text-[12px] text-tx-2">
                      {row.key}
                    </span>
                    <span className="text-tx-3" aria-hidden="true">
                      →
                    </span>
                    <span className="min-w-0 flex-1">
                      <Value value={row.value} />
                    </span>
                    <CopyButton
                      value={row.value}
                      label={`query value ${row.key}`}
                      className="shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const SCOPE_OPTIONS = [
  { value: "component", label: "component" },
  { value: "full", label: "full" },
] as const;

const SCOPE_CAPTION: Record<Scope, string> = {
  component:
    "Escapes / ? : @ & = # too — for a single query value or path segment.",
  full: "Keeps URL structure (/ ? : @ & =) intact — for a whole URL.",
};

/** A read-only output pane: shows the value, or an inline error (D-14). */
function OutputPane({
  id,
  label,
  result,
}: {
  id: string;
  label: string;
  result: { value: string } | { error: string };
}) {
  const errored = "error" in result;
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-tx-2">
          {label}
        </span>
        {!errored ? (
          <CopyButton value={result.value} label={label} className="shrink-0" />
        ) : null}
      </div>
      <div
        id={id}
        className="min-h-[44px] w-full break-all rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx"
      >
        {errored ? (
          <span role="alert" className="text-bad">
            {result.error}
          </span>
        ) : result.value === "" ? (
          <span className="text-tx-3">—</span>
        ) : (
          result.value
        )}
      </div>
    </section>
  );
}

type PaneResult = { value: string } | { error: string };

interface EncodeModeProps {
  input: string;
  onInput: (next: string) => void;
  scope: Scope;
  onScope: (next: Scope) => void;
  encoded: PaneResult;
  decoded: PaneResult;
}

/** Presentational: the input/scope + both derived panes live in UrlTool. */
function EncodeMode({
  input,
  onInput,
  scope,
  onScope,
  encoded,
  decoded,
}: EncodeModeProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label
            htmlFor="url-encode-input"
            className="text-[12px] font-semibold uppercase tracking-wide text-tx-2"
          >
            Input
          </label>
          <SegmentedControl
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={onScope}
            ariaLabel="Encoding scope"
          />
        </div>
        <textarea
          id="url-encode-input"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Type or paste a string to percent-encode / decode…"
          className="min-h-[72px] w-full resize-y rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
        />
        <p className="text-[12px] text-tx-3">{SCOPE_CAPTION[scope]}</p>
      </section>

      <OutputPane id="url-encoded-output" label="Encoded" result={encoded} />
      <OutputPane id="url-decoded-output" label="Decoded" result={decoded} />
    </div>
  );
}

const MODE_OPTIONS = [
  { value: "parse", label: "Parse" },
  { value: "encode", label: "Encode/Decode" },
] as const;

export default function UrlTool() {
  const [mode, setMode] = useState<Mode>("parse");
  // Both modes' state lives HERE, not in the mode components. The mode
  // components mount/unmount as the user toggles, and the UP5-01 seam's dedup
  // memory is a ref — so a seam call inside them (directly or through a
  // null-rendering reporter) forgot what it had already counted on every mode
  // switch, and switching back re-counted the same work. One call at this level
  // stays mounted for the tool's whole life.
  //
  // Switching modes still CLEARS both inputs and resets the scope, so the
  // previously observable behaviour (each mode component remounted empty; D-01/02/03
  // "no persistence") is unchanged.
  const [parseInput, setParseInput] = useState("");
  const [encodeInput, setEncodeInput] = useState("");
  const [scope, setScope] = useState<Scope>("full");

  const parseResult = useMemo(() => parseUrl(parseInput), [parseInput]);
  const encoded = useMemo(
    () =>
      scope === "component"
        ? encodeComponent(encodeInput)
        : encodeFull(encodeInput),
    [encodeInput, scope],
  );
  const decoded = useMemo(
    () =>
      scope === "component"
        ? decodeComponent(encodeInput)
        : decodeFull(encodeInput),
    [encodeInput, scope],
  );

  function switchMode(next: Mode) {
    setMode(next);
    setParseInput("");
    setEncodeInput("");
    setScope("full");
  }

  // PARSE success: an absolute URL that split cleanly. Empty input and a
  // relative/scheme-less URL are not successes.
  const parsedOk = !("empty" in parseResult) && !("error" in parseResult);
  // ENCODE success (D-04): a non-empty input plus at least one pane that
  // produced a value — a bad percent-sequence errors only the affected pane
  // (D-14), which is still a usable result on the other side.
  const encodeOk =
    encodeInput !== "" &&
    (("error" in encoded ? "" : encoded.value) !== "" ||
      ("error" in decoded ? "" : decoded.value) !== "");

  // UP5-01: identity = the mode plus THAT mode's submitted source. The mode is
  // part of it because the same string means different work on each side; the
  // encoding-scope toggle is NOT, because it re-presents the same submission.
  const identityInput = useMemo(
    () => `${mode}\n${mode === "parse" ? parseInput : encodeInput}`,
    [mode, parseInput, encodeInput],
  );
  useToolSuccess("url", mode === "parse" ? parsedOk : encodeOk, identityInput);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-4">
        <SegmentedControl
          options={MODE_OPTIONS}
          value={mode}
          onChange={switchMode}
          ariaLabel="URL tool mode"
        />
        {mode === "parse" ? (
          <ParseMode
            input={parseInput}
            onInput={setParseInput}
            result={parseResult}
          />
        ) : (
          <EncodeMode
            input={encodeInput}
            onInput={setEncodeInput}
            scope={scope}
            onScope={setScope}
            encoded={encoded}
            decoded={decoded}
          />
        )}
      </div>
    </div>
  );
}
