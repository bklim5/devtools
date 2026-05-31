// The schema-less Protobuf hero tool (PRO-01..07, UX-01..05, D-01/03/04/05/07/08/10/11).
//
// A thin, layout-agnostic UI over the pure logic from 03-02 (decodeInput,
// chipsForField/defaultChipId via FieldTree, fieldsToJson) and the 03-01 preference
// (protobufTreeStyle). Pasted hex/base64 decodes INSTANTLY on change (no button —
// PRO-01); a group/truncation surfaces as a status-bar + inline error, never a crash
// (PRO-02); the auto-detected encoding shows as an ACCENT chip with a manual override
// (D-01 refinement); LEN nodes render LenInterpretation chips with a smart default +
// per-node override (D-04/06) and auto-expanded sub-messages (D-05); the tree defaults
// to cards with a persisted rows/cards toggle (D-07); #N is neutral, accent = selection
// only (D-08); every node has a visible focusable copy + a copy-all-as-JSON action
// (D-10/11). Input/output panes are resizable (D-09). Clipboard goes through the
// platform seam ONLY — never @tauri-apps/*.
import { useMemo, useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { platform } from "@/lib/platform";
import { usePreferences } from "@/shell/usePreferences";
import type { ProtobufTreeStyle } from "@/shell/preferences";
import { ResizableSplit } from "./ResizableSplit";
import { FieldTree } from "./FieldTree";
import { ProtobufStatusBar } from "./ProtobufStatusBar";
import { decodeInput, type InputEncoding } from "./useDecode";
import { fieldsToJson } from "./copyAsJson";
import type { ParseState } from "@/tools/base64/StatusBar";

// One-click example payloads (D-03) — verified against the real decoder.
// {1:150} canonical · nested {3:{1:150}} · packed varints {4:[3,270,150]} ·
// UTF-8 string {2:"hi"}.
const EXAMPLES: ReadonlyArray<{ label: string; hex: string }> = [
  { label: "{1:150}", hex: "089601" },
  { label: "nested message", hex: "1a03089601" },
  { label: "packed varints", hex: "2205038e029601" },
  { label: 'string "hi"', hex: "12026869" },
];

const OVERRIDES: ReadonlyArray<InputEncoding> = ["hex", "base64"];
const TREE_STYLES: ReadonlyArray<ProtobufTreeStyle> = ["cards", "rows"];

export default function ProtobufDecoder() {
  const [raw, setRaw] = useState("");
  const [override, setOverride] = useState<InputEncoding | undefined>(undefined);
  // Per-node interpretation selection + collapsed set, keyed by stable node path.
  // Expanded is the default (D-05), so we track the COLLAPSED set.
  const [selection, setSelection] = useState<Map<string, string>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { preferences, setTreeStyle } = usePreferences();

  const result = useMemo(() => decodeInput(raw, override), [raw, override]);
  const fields = result.fields ?? [];

  const parseState: ParseState = result.error
    ? "error"
    : raw.trim() === ""
      ? "empty"
      : "ok";

  function selectChip(path: string, chipId: string) {
    setSelection((prev) => new Map(prev).set(path, chipId));
  }
  function toggleExpand(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }
  function copyNode(text: string) {
    void platform.clipboard.writeText(text);
  }
  function copyAllAsJson() {
    void platform.clipboard.writeText(fieldsToJson(fields, selection));
  }

  const inputPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-tx-3">
          Examples
        </span>
        {EXAMPLES.map((ex) => {
          const active = raw === ex.hex;
          return (
            <button
              key={ex.label}
              type="button"
              data-example
              onClick={() => setRaw(ex.hex)}
              aria-pressed={active}
              className={[
                "ex rounded border px-2 py-0.5 font-mono text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                active
                  ? "ex-on border-accent-line bg-accent-soft text-accent"
                  : "border-bd bg-input-bg text-tx-2 hover:text-tx",
              ].join(" ")}
            >
              {ex.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Auto-detected encoding as an ACCENT chip (D-01 refinement); the override
            toggle below selects it — accent = the active interpretation (D-08). */}
        <span
          data-encoding-chip
          className="rounded border border-accent-line bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent"
          aria-label="detected encoding"
        >
          {result.encoding}
        </span>
        <div
          role="group"
          aria-label="Override encoding"
          className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
        >
          {OVERRIDES.map((enc) => {
            const active = override === enc;
            return (
              <button
                key={enc}
                type="button"
                onClick={() => setOverride(active ? undefined : enc)}
                aria-pressed={active}
                className={[
                  "rounded-[5px] px-2 py-0.5 font-mono text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "border border-accent-line bg-accent-soft text-accent"
                    : "border border-transparent text-tx-2 hover:text-tx",
                ].join(" ")}
              >
                {enc}
              </button>
            );
          })}
        </div>
      </div>

      <textarea
        id="protobuf-input"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Paste hex or base64 protobuf bytes…"
        aria-label="Protobuf input"
        className="min-h-[120px] w-full flex-1 resize-none rounded-lg border border-bd bg-input-bg p-3 font-mono text-[13px] text-tx outline-none transition-colors focus-visible:border-accent-line focus-visible:ring-2 focus-visible:ring-accent"
      />
    </div>
  );

  const outputPane = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-bd px-4 py-2.5">
        <div
          role="group"
          aria-label="Tree style"
          className="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5"
        >
          {TREE_STYLES.map((style) => {
            const active = preferences.protobufTreeStyle === style;
            return (
              <button
                key={style}
                type="button"
                onClick={() => setTreeStyle(style)}
                aria-pressed={active}
                className={[
                  "rounded-[5px] px-2 py-0.5 text-[11px] font-medium capitalize outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "border border-accent-line bg-accent-soft text-accent"
                    : "border border-transparent text-tx-2 hover:text-tx",
                ].join(" ")}
              >
                {style}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={copyAllAsJson}
          aria-label="Copy all as JSON"
          className="flex items-center gap-1.5 rounded-[7px] border border-bd bg-input-bg px-2 py-1 text-[11.5px] text-tx-2 outline-none transition-colors hover:border-bd-2 hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Copy all as JSON</span>
        </button>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4">
        {result.error ? (
          <p role="alert" className="font-mono text-[12.5px] text-bad">
            {result.error}
          </p>
        ) : fields.length === 0 ? (
          <p className="font-mono text-[12.5px] text-tx-3">
            Paste hex or base64 protobuf bytes to decode.
          </p>
        ) : (
          <FieldTree
            fields={fields}
            style={preferences.protobufTreeStyle}
            selection={selection}
            onSelect={selectChip}
            collapsed={collapsed}
            onToggleExpand={toggleExpand}
            onCopyNode={copyNode}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ResizableSplit left={inputPane} right={outputPane} />
      <ProtobufStatusBar
        parseState={parseState}
        byteCount={result.byteCount}
        error={result.error}
        timingMs={result.timingMs}
      />
    </div>
  );
}
