// Recursive renderer for DecodedField[] (cards or rows) — presentational only.
//
// Maps each field to a FieldNode keyed by a STABLE path ("<index>" at the top,
// "<parentPath>.<index>" nested), so selection/expansion state (owned by
// ProtobufDecoder and threaded down) survives a re-render with fresh field objects
// from a re-decode (Pitfall 2 — never key on object identity). The cards/rows style
// is a prop (D-07): `.tree-cards` is a gap stack, `.tree-rows` is border-divided.
import type { DecodedField } from "@/lib/protobuf/decoder";
import { FieldNode } from "./FieldNode";

export interface FieldTreeProps {
  fields: DecodedField[];
  /** Path of the parent node, "" at the root. */
  parentPath?: string;
  style: "cards" | "rows";
  selection: Map<string, string>;
  onSelect: (path: string, chipId: string) => void;
  collapsed: Set<string>;
  onToggleExpand: (path: string) => void;
  onCopyNode: (text: string) => void;
}

export function FieldTree({
  fields,
  parentPath = "",
  style,
  selection,
  onSelect,
  collapsed,
  onToggleExpand,
  onCopyNode,
}: FieldTreeProps) {
  return (
    <div
      className={
        style === "cards"
          ? "tree-cards flex min-w-0 flex-col gap-2"
          : "tree-rows flex min-w-0 flex-col"
      }
    >
      {fields.map((field, i) => {
        const path = parentPath === "" ? String(i) : `${parentPath}.${i}`;
        return (
          <FieldNode
            key={path}
            field={field}
            path={path}
            style={style}
            selection={selection}
            onSelect={onSelect}
            collapsed={collapsed}
            onToggleExpand={onToggleExpand}
            onCopyNode={onCopyNode}
          />
        );
      })}
    </div>
  );
}
