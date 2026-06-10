// UUID / ULID Generator + Decoder — registered as a placeholder in Wave 1
// (Plan 04-01) so registry.ts edits are concentrated here; Wave 2 (Plan 04-05)
// swaps `component` for the real tool UI without touching registry.ts.
// Icons/labels/keywords are D-18 discretion.
import { Fingerprint } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const uuidUlidTool: ToolDefinition = {
  id: "uuid-ulid",
  name: "UUID / ULID",
  description: "Generate and decode UUIDs and ULIDs",
  category: "generators",
  keywords: ["uuid", "ulid", "guid", "id", "generate", "v4", "v7"],
  icon: Fingerprint,
  component: () => import("./UuidUlidTool"),
  enabled: true,
};
