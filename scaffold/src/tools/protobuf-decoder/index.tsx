import { useMemo, useState } from "react";
import { FileCode } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";
import { base64ToBytes, hexToBytes } from "@/lib/bytes";
import { decodeMessage, type DecodedField, type LenInterpretation } from "@/lib/protobuf/decoder";

type InputFormat = "hex" | "base64";

function ProtobufDecoder() {
  const [raw, setRaw] = useState("1a 03 08 96 01"); // {3: {1: 150}}
  const [format, setFormat] = useState<InputFormat>("hex");

  const result = useMemo(() => {
    if (!raw.trim()) return { fields: [] as DecodedField[], error: null as string | null };
    try {
      const bytes = format === "hex" ? hexToBytes(raw) : base64ToBytes(raw);
      return { fields: decodeMessage(bytes), error: null as string | null };
    } catch (e) {
      return { fields: [] as DecodedField[], error: e instanceof Error ? e.message : String(e) };
    }
  }, [raw, format]);

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Protobuf Decoder</h1>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as InputFormat)}
            className="rounded bg-neutral-800 px-2 py-1 text-xs outline-none"
          >
            <option value="hex">hex</option>
            <option value="base64">base64</option>
          </select>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full resize-y rounded-md bg-neutral-800 px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-blue-500"
          placeholder={format === "hex" ? "08 96 01 …" : "CJYB …"}
        />
        {result.error && <p className="text-sm text-red-400">{result.error}</p>}
      </div>

      <div className="space-y-1">
        <h2 className="text-sm text-neutral-400">Decoded fields</h2>
        {result.fields.length === 0 && !result.error ? (
          <p className="text-sm text-neutral-500">No fields.</p>
        ) : (
          <ul className="space-y-1">
            {result.fields.map((f, i) => (
              <FieldNode key={i} field={f} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FieldNode({ field }: { field: DecodedField }) {
  const v = field.value;
  return (
    <li className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-mono text-blue-400">#{field.fieldNumber}</span>
        <span className="text-xs text-neutral-500">{wireTypeName(field.wireType)}</span>
      </div>
      {v.kind === "varint" && (
        <Interp
          rows={[
            ["uint", v.asUnsigned],
            ["int (signed)", v.asSigned],
            ["sint (zigzag)", v.asZigzag],
            ["bool", String(v.asBool)],
          ]}
        />
      )}
      {v.kind === "i64" && (
        <Interp rows={[["uint64", v.asUint64], ["int64", v.asInt64], ["double", String(v.asDouble)], ["hex", v.hex]]} />
      )}
      {v.kind === "i32" && (
        <Interp rows={[["uint32", String(v.asUint32)], ["int32", String(v.asInt32)], ["float", String(v.asFloat)], ["hex", v.hex]]} />
      )}
      {v.kind === "len" && <LenNode byteLength={v.byteLength} interp={v.interpretations} />}
    </li>
  );
}

function LenNode({ byteLength, interp }: { byteLength: number; interp: LenInterpretation }) {
  // Schema-less LEN decoding is fundamentally ambiguous, so all viable
  // interpretations are kept and the user picks. Only options the payload
  // actually supports are shown; "bytes" is always available as a fallback.
  type View = "message" | "string" | "bytes" | "packed-varints" | "packed-i32" | "packed-i64";
  const options: View[] = [
    ...(interp.message ? (["message"] as const) : []),
    ...(interp.string !== undefined ? (["string"] as const) : []),
    "bytes",
    ...(interp.packedVarints ? (["packed-varints"] as const) : []),
    ...(interp.packedFixed32 ? (["packed-i32"] as const) : []),
    ...(interp.packedFixed64 ? (["packed-i64"] as const) : []),
  ];
  const [view, setView] = useState<View>(options[0]);

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-500">{byteLength} bytes ·</span>
        <div className="flex flex-wrap gap-1">
          {options.map((o) => (
            <button
              key={o}
              onClick={() => setView(o)}
              className={`rounded px-2 py-0.5 ${
                view === o ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
      {view === "message" && interp.message && (
        <ul className="space-y-1 border-l border-neutral-700 pl-3">
          {interp.message.map((f, i) => (
            <FieldNode key={i} field={f} />
          ))}
        </ul>
      )}
      {view === "string" && (
        <pre className="whitespace-pre-wrap break-all rounded bg-neutral-800 px-2 py-1 font-mono text-xs">
          {interp.string ?? "(not valid UTF-8)"}
        </pre>
      )}
      {view === "bytes" && (
        <pre className="whitespace-pre-wrap break-all rounded bg-neutral-800 px-2 py-1 font-mono text-xs">
          {interp.hex || "(empty)"}
        </pre>
      )}
      {view === "packed-varints" && interp.packedVarints && (
        <PackedList rows={interp.packedVarints.map((v, i) => [`[${i}]`, v.asUnsigned])} />
      )}
      {view === "packed-i32" && interp.packedFixed32 && (
        <PackedList rows={interp.packedFixed32.map((v, i) => [`[${i}]`, `${v.asInt32} (${v.asFloat.toPrecision(6)}f)`])} />
      )}
      {view === "packed-i64" && interp.packedFixed64 && (
        <PackedList rows={interp.packedFixed64.map((v, i) => [`[${i}]`, `${v.asInt64} (${v.asDouble.toPrecision(8)}d)`])} />
      )}
    </div>
  );
}

function PackedList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[3rem_1fr] gap-x-3 gap-y-0.5 rounded bg-neutral-800 px-2 py-1 font-mono text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Interp({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-1 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5 text-xs">
      {rows.map(([k, val]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="break-all font-mono">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

function wireTypeName(w: DecodedField["wireType"]): string {
  return { 0: "varint", 1: "i64", 2: "len", 5: "i32" }[w];
}

export const protobufDecoderTool: ToolDefinition = {
  id: "protobuf-decoder",
  name: "Protobuf Decoder",
  description: "Decode protobuf wire format without a schema",
  category: "inspectors",
  keywords: ["protobuf", "proto", "grpc", "wire", "decode", "varint"],
  icon: FileCode,
  component: ProtobufDecoder,
};
