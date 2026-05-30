// Base64 / Hex / Bytes — ENABLED in Phase 2 as a shared placeholder (D-01); Phase 3
// replaces `component` with the real tool UI. Only the registry-facing fields
// change here (enabled/icon/component/description) — no tool logic yet.
import { Binary } from "lucide-react";
import { makePlaceholder } from "@/tools/_placeholder/ToolPlaceholder";
import type { ToolDefinition } from "@/lib/tools/types";

export const base64Tool: ToolDefinition = {
  id: "base64",
  name: "Base64",
  description: "Base64 / hex / bytes converter",
  category: "encoding",
  keywords: ["base64", "hex", "bytes", "encode", "decode"],
  icon: Binary,
  component: makePlaceholder("Base64"),
  enabled: true,
};
