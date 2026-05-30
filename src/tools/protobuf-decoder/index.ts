// Protobuf Decoder (hero) — ENABLED in Phase 2 as a shared placeholder (D-01);
// Phase 3 replaces `component` with the real schema-less wire-format tree UI.
// Only the registry-facing fields change here (enabled/icon/component/description)
// — no tool logic yet, and decoder.ts/bytes.ts/types.ts stay untouched.
import { Boxes } from "lucide-react";
import { makePlaceholder } from "@/tools/_placeholder/ToolPlaceholder";
import type { ToolDefinition } from "@/lib/tools/types";

export const protobufDecoderTool: ToolDefinition = {
  id: "protobuf-decoder",
  name: "Protobuf Decoder",
  description: "Schema-less Protobuf wire-format decoder",
  category: "inspectors",
  keywords: ["protobuf", "proto", "decode", "wire", "bytes"],
  icon: Boxes,
  component: makePlaceholder("Protobuf Decoder"),
  enabled: true,
};
