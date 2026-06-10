// Base64 / Hex / Bytes — Phase 3 swaps `component` from the Phase-2 placeholder to
// the real Base64Tool (three derived panes + alphabet toggle + status bar + copy).
// Only the registry-facing `component` changes here; the tool logic lives in
// Base64Tool.tsx / useBytesConvert.ts / StatusBar.tsx.
import { Binary } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const base64Tool: ToolDefinition = {
  id: "base64",
  name: "Base64",
  description: "Base64 / hex / bytes converter",
  category: "encoding",
  keywords: ["base64", "hex", "bytes", "encode", "decode"],
  icon: Binary,
  component: () => import("./Base64Tool"),
  enabled: true,
};
