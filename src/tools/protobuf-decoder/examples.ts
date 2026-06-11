// One-click example payloads for the Protobuf decoder (D-03/D-10) — verified
// against the real decoder. {1:150} canonical · nested {3:{1:150}} · packed
// varints {4:[3,270,150]} · UTF-8 string {2:"hi"} · decimal byte array (same
// bytes as {1:150} would be — 10,3,80,81,82 showcases the decimal input mode).
//
// `encoding` is each example's EXPECTED auto-detection result, not a forced
// override: a chip click clears any override back to auto-detect, which must
// resolve every value to its declared encoding — locked by the
// EXAMPLES-detection contract test in ProtobufDecoder.test.tsx.
//
// Lives in its own module (not ProtobufDecoder.tsx) so the component file only
// exports components (react-refresh/only-export-components).
import type { InputEncoding } from "./detectEncoding";

export const EXAMPLES: ReadonlyArray<{
  label: string;
  value: string;
  encoding: InputEncoding;
}> = [
  { label: "{1:150}", value: "089601", encoding: "hex" },
  { label: "nested message", value: "1a03089601", encoding: "hex" },
  { label: "packed varints", value: "2205038e029601", encoding: "hex" },
  { label: 'string "hi"', value: "12026869", encoding: "hex" },
  { label: "decimal bytes", value: "10, 3, 80, 81, 82", encoding: "decimal" },
];
