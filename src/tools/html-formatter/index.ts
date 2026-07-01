// HTML formatter ToolDefinition (PRT-12, D-06/D-07) — registered by APPENDING this
// to the TOOLS array in src/lib/tools/registry.ts; the sidebar, ⌘K palette, and
// router all auto-derive from it (single control plane, nothing else to wire).
// Mirrors xml-formatter/index.ts. Tool logic lives in HtmlFormatterTool.tsx +
// @/lib/format/{prettier,minify}. Ships FREE — no entitlement gate (D-07). The
// CodeXml icon is visually DISTINCT from XML's FileCode (D-06).
import { CodeXml } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const htmlFormatterTool: ToolDefinition = {
  id: "html-formatter",
  name: "HTML",
  description: "HTML prettify / minify",
  category: "formatting",
  keywords: ["html", "format", "prettify", "minify"],
  icon: CodeXml,
  component: () => import("./HtmlFormatterTool"),
  enabled: true,
};
