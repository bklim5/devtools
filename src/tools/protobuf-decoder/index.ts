// Protobuf Decoder (hero) registry entry. Phase 3 (03-04) swaps `component` from
// the shared placeholder to the real schema-less wire-format tree UI. Only the
// registry-facing fields live here — decoder.ts/bytes.ts/types.ts/registry.ts stay
// untouched (the single control plane derives sidebar/palette/router from this).
import { Boxes } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const protobufDecoderTool: ToolDefinition = {
  id: "protobuf-decoder",
  name: "Protobuf Decoder",
  description: "Schema-less Protobuf wire-format decoder",
  category: "inspectors",
  keywords: ["protobuf", "proto", "decode", "wire", "bytes"],
  icon: Boxes,
  component: () => import("./ProtobufDecoder"),
  enabled: true,
};
