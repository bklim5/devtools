// Cron tool registry entry (Phase 15, CRON-01..11; the 12th tool / 6th and final
// of v1.3). One additive ToolDefinition — the sidebar, command palette, and router
// all auto-derive #/tools/cron from the TOOLS array (registry = single control
// plane). Zero new runtime deps; the Clock glyph is verified present in the
// installed lucide-react@1.17.0.
import { Clock } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";

export const cronTool: ToolDefinition = {
  id: "cron",
  name: "Cron",
  description: "Describe a cron expression & see the next 5 runs",
  category: "converters",
  keywords: ["cron", "crontab", "schedule", "next run", "@daily", "expression"],
  icon: Clock,
  component: () => import("./CronTool"),
  enabled: true,
};
