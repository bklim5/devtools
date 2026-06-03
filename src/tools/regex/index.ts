// Regex tester registry entry (Phase 14, RGX-01..07; the 11th tool). One additive
// ToolDefinition — the sidebar, command palette, and router all auto-derive
// #/tools/regex from the TOOLS array (registry = single control plane). Zero new
// runtime deps; the Regex glyph is verified present in the installed lucide-react@1.17.0.
import { Regex } from "lucide-react";
import RegexTool from "./RegexTool";
import type { ToolDefinition } from "@/lib/tools/types";

export const regexTool: ToolDefinition = {
  id: "regex",
  name: "Regex",
  description: "Test patterns, see matches, groups & replace",
  category: "inspectors",
  keywords: [
    "regex",
    "regexp",
    "regular expression",
    "match",
    "replace",
    "pattern",
    "groups",
  ],
  icon: Regex,
  component: RegexTool,
  enabled: true,
};
