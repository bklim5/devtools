// JS/TS formatter ToolDefinition (PRT-12, D-08) — registered by APPENDING this to
// the TOOLS array in src/lib/tools/registry.ts, immediately AFTER htmlFormatterTool
// (the formatting group). The sidebar, ⌘K palette, and router all auto-derive from
// it (single control plane, nothing else to wire). Mirrors html-formatter/index.ts.
// Tool logic lives in JsFormatterTool.tsx + @/lib/format/{prettier,minify}. Ships
// FREE — no entitlement gate. The Braces icon is visually DISTINCT from HTML's
// CodeXml (D-08).
import { Braces } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const jsFormatterTool: ToolDefinition = {
  id: "js-formatter",
  name: "JS/TS",
  description: "JavaScript / TypeScript prettify / minify",
  category: "formatting",
  keywords: [
    "javascript",
    "typescript",
    "jsx",
    "tsx",
    "js",
    "ts",
    "format",
    "prettify",
    "minify",
    "prettier",
    "es6",
    "esbuild",
  ],
  icon: Braces,
  component: () => import("./JsFormatterTool"),
  enabled: true,
};
