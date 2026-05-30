import { useState } from "react";
import { Binary } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
  type Base64Alphabet,
} from "@/lib/bytes";

type Source = "text" | "base64" | "hex";

// Single source-of-truth model: whichever field the user edits becomes the
// canonical bytes, and the other representations are derived from it. This is
// the shape feature 5.2 wants — Uint8Array <-> base64/base64url/hex, freely.
function Base64Tool() {
  const [source, setSource] = useState<Source>("text");
  const [value, setValue] = useState("Hello, world!");
  const [alphabet, setAlphabet] = useState<Base64Alphabet>("base64");

  let bytes: Uint8Array | null = null;
  let error: string | null = null;
  try {
    if (source === "text") bytes = utf8ToBytes(value);
    else if (source === "base64") bytes = base64ToBytes(value, alphabet);
    else bytes = hexToBytes(value);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const text = bytes ? safe(() => bytesToUtf8(bytes!, true)) : "";
  const b64 = bytes ? bytesToBase64(bytes, alphabet) : "";
  const hex = bytes ? bytesToHex(bytes, { sep: " " }) : "";

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Base64 / Hex / Bytes</h1>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          alphabet
          <select
            value={alphabet}
            onChange={(e) => setAlphabet(e.target.value as Base64Alphabet)}
            className="rounded bg-neutral-800 px-2 py-1 text-neutral-100 outline-none"
          >
            <option value="base64">base64</option>
            <option value="base64url">base64url</option>
          </select>
        </label>
      </div>

      <Field label="Text (UTF-8)" focused={source === "text"} value={source === "text" ? value : text}
        onChange={(v) => { setSource("text"); setValue(v); }} />
      <Field label="Base64" mono focused={source === "base64"} value={source === "base64" ? value : b64}
        onChange={(v) => { setSource("base64"); setValue(v); }} />
      <Field label="Hex" mono focused={source === "hex"} value={source === "hex" ? value : hex}
        onChange={(v) => { setSource("hex"); setValue(v); }} />

      {error && <p className="text-sm text-red-400">{error}</p>}
      {bytes && !error && (
        <p className="text-xs text-neutral-500">{bytes.length} byte(s)</p>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  focused?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-400">{props.label}</span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={2}
        className={`w-full resize-y rounded-md bg-neutral-800 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${
          props.mono ? "font-mono" : ""
        } ${props.focused ? "ring-1 ring-neutral-600" : ""}`}
      />
    </label>
  );
}

function safe(fn: () => string): string {
  try {
    return fn();
  } catch {
    return "(not valid UTF-8)";
  }
}

export const base64Tool: ToolDefinition = {
  id: "base64",
  name: "Base64 / Hex / Bytes",
  description: "Convert between text, base64/base64url, and hex",
  category: "encoding",
  keywords: ["base64", "base64url", "hex", "bytes", "uint8array", "encode", "decode"],
  icon: Binary,
  component: Base64Tool,
};
