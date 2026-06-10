// URL tool registry entry (Phase 13, URL-01..05; the 9th tool). One additive
// ToolDefinition — the sidebar, command palette, and router all auto-derive
// #/tools/url from the TOOLS array (registry = single control plane). Zero new
// runtime deps; the Link glyph is verified present in the installed lucide-react.
import { Link } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const urlTool: ToolDefinition = {
  id: "url",
  name: "URL",
  description: "Parse, encode & decode URLs",
  category: "encoding",
  keywords: ["url", "uri", "encode", "decode", "query", "percent"],
  icon: Link,
  component: () => import("./UrlTool"),
  enabled: true,
};
