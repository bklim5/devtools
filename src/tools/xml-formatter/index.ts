// XML formatter ToolDefinition (D-12) — registered by APPENDING this to the
// TOOLS array in src/lib/tools/registry.ts; the sidebar, ⌘K palette, and router
// all auto-derive from it (single control plane, nothing else to wire). Mirrors
// json-formatter/index.ts. Tool logic lives in XmlFormatterTool.tsx + @/lib/format/xml.
import { FileCode } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const xmlFormatterTool: ToolDefinition = {
  id: "xml-formatter",
  name: "XML",
  description: "XML validate / prettify / minify",
  category: "formatting",
  keywords: ["xml", "format", "prettify", "minify", "validate"],
  icon: FileCode,
  component: () => import("./XmlFormatterTool"),
  enabled: true,
};
