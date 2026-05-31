// A single decoded field — the unit of the protobuf tree (PRO-03/04/07, D-06/08/10).
//
// Layout: a head row (#N · wire badge · byte length · copy) then a chips row then
// the selected value (or, for a "message" selection, a collapse toggle + the nested
// FieldTree). Binding rules:
//   - #N renders NEUTRAL (text-tx/text-tx-2) — accent is reserved for the SELECTED
//     chip only (D-08 / PRO-07); the mockup's accent-blue #N is overridden.
//   - chips come straight from chipsForField (the real LenInterpretation keys, D-06);
//     the selected chip (selection.get(path) ?? defaultChipId) carries accent classes.
//   - sub-messages live at value.interpretations.message and recurse FieldTree,
//     auto-expanded by default (D-05) — collapse is opt-in, tracked as a collapsed set.
//   - a visible, focusable <button> copies the selected reading (no hover-only, D-10).
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import type { DecodedField, WireType } from "@/lib/protobuf/decoder";
import { useCopyFeedback } from "@/shell/useCopyFeedback";
import { chipsForField, defaultChipId } from "./interpretationChips";
import { FieldTree } from "./FieldTree";

const WIRE_LABEL: Record<WireType, string> = {
  0: "VARINT",
  1: "I64",
  2: "LEN",
  5: "I32",
};

export interface FieldNodeProps {
  field: DecodedField;
  /** Stable path key: "<index>" at top level, "<parentPath>.<index>" nested. */
  path: string;
  style: "cards" | "rows";
  selection: Map<string, string>;
  onSelect: (path: string, chipId: string) => void;
  /** Paths whose message sub-tree is collapsed (expanded is the default — D-05). */
  collapsed: Set<string>;
  onToggleExpand: (path: string) => void;
  onCopyNode: (text: string) => void;
}

export function FieldNode({
  field,
  path,
  style,
  selection,
  onSelect,
  collapsed,
  onToggleExpand,
  onCopyNode,
}: FieldNodeProps) {
  const chips = chipsForField(field);
  const selectedId = selection.get(path) ?? defaultChipId(field);
  const selectedChip = chips.find((c) => c.id === selectedId) ?? chips[0];
  const [copied, confirmCopy] = useCopyFeedback();

  const isLen = field.value.kind === "len";
  const message =
    field.value.kind === "len" ? field.value.interpretations.message : undefined;
  const showMessage = selectedId === "message" && message !== undefined;
  const expanded = !collapsed.has(path);

  const cardBase =
    style === "cards"
      ? "rounded-[11px] border border-bd bg-card p-3"
      : "border-b border-bd py-2.5 last:border-b-0";

  return (
    <div className={`field min-w-0 ${cardBase}`}>
      <div className="field-head flex items-center gap-2">
        <span data-fnum className="font-mono text-[13px] font-semibold text-tx">
          #{field.fieldNumber}
        </span>
        <span className="wire rounded bg-input-bg px-1.5 py-0.5 font-mono text-[10.5px] text-tx-2">
          {WIRE_LABEL[field.wireType]}
        </span>
        {isLen && field.value.kind === "len" ? (
          <span className="field-bytes ml-auto font-mono text-[11px] text-tx-3">
            {field.value.byteLength}{" "}
            {field.value.byteLength === 1 ? "byte" : "bytes"}
          </span>
        ) : null}
        <button
          type="button"
          data-copy-node
          onClick={() => {
            onCopyNode(selectedChip?.value ?? "");
            confirmCopy();
          }}
          aria-label={`Copy field ${field.fieldNumber} value`}
          className={[
            isLen ? "" : "ml-auto",
            "flex items-center gap-1 rounded-[6px] border bg-input-bg px-1.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
            copied
              ? "border-accent-line text-accent"
              : "border-bd text-tx-2 hover:border-bd-2 hover:text-tx",
          ].join(" ")}
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        className="chips mt-2 flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label={`Field ${field.fieldNumber} interpretation`}
      >
        {chips.map((chip) => {
          const on = chip.id === selectedId;
          return (
            <button
              key={chip.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(path, chip.id)}
              className={[
                "chip rounded border px-1.5 py-0.5 font-mono text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                on
                  ? "chip-on border-accent-line bg-accent-soft text-accent"
                  : "border-bd bg-input-bg text-tx-2 hover:text-tx",
              ].join(" ")}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {showMessage ? (
        <div className="mt-2">
          <button
            type="button"
            data-expand-toggle
            onClick={() => onToggleExpand(path)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse sub-message" : "Expand sub-message"}
            className="flex items-center gap-1 rounded-[6px] px-1 py-0.5 font-mono text-[11px] text-tx-2 outline-none transition-colors hover:text-tx focus-visible:ring-2 focus-visible:ring-accent"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{message!.length} {message!.length === 1 ? "field" : "fields"}</span>
          </button>
          {expanded ? (
            <div
              data-submsg
              className="submsg mt-1.5 border-l-2 border-accent-line pl-3.5"
            >
              <FieldTree
                fields={message!}
                parentPath={path}
                style={style}
                selection={selection}
                onSelect={onSelect}
                collapsed={collapsed}
                onToggleExpand={onToggleExpand}
                onCopyNode={onCopyNode}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={`val mt-2 break-all font-mono text-[12.5px] ${
            selectedId === "bytes" || selectedChip?.id === "hex"
              ? "text-tx-2"
              : "text-tx"
          }`}
        >
          {selectedChip?.value ?? ""}
        </div>
      )}
    </div>
  );
}
