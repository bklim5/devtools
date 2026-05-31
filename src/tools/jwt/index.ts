// JWT Debugger — registered as a placeholder in Wave 1 (Plan 04-01) so registry.ts
// edits are concentrated here; Wave 2 (Plan 04-03) swaps `component` for the real
// tool UI without touching registry.ts. Icons/labels/keywords are D-18 discretion.
import { KeyRound } from "lucide-react";
import { makePlaceholder } from "@/tools/_placeholder/ToolPlaceholder";
import type { ToolDefinition } from "@/lib/tools/types";

export const jwtTool: ToolDefinition = {
  id: "jwt",
  name: "JWT",
  description: "Decode JWT header / payload / signature",
  category: "crypto",
  keywords: ["jwt", "token", "jose", "decode", "bearer"],
  icon: KeyRound,
  component: makePlaceholder("JWT"),
  enabled: true,
};
