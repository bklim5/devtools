// JSON formatter ToolDefinition (D-12) — registered by APPENDING this to the
// TOOLS array in src/lib/tools/registry.ts; the sidebar, ⌘K palette, and router
// all auto-derive from it (single control plane, nothing else to wire). Mirrors
// base64/index.ts. Tool logic lives in JsonFormatterTool.tsx + @/lib/format/json.
import { Braces } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const jsonFormatterTool: ToolDefinition = {
  id: "json-formatter",
  name: "JSON",
  description: "JSON validate / prettify / minify / sort keys",
  category: "formatting",
  keywords: ["json", "format", "prettify", "minify", "validate", "lint", "sort"],
  icon: Braces,
  component: () => import("./JsonFormatterTool"),
  enabled: true,
};
