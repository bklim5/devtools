// Unix Time Converter — the real tool (Phase 4, 04-02; TIME-01). The placeholder
// shipped in Phase 2 (D-01); this plan swaps `component` to the real UnixTimeTool.
// unixTimeTool is already in registry.ts's TOOLS array (no registry edit needed).
import { Clock } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";
import UnixTimeTool from "./UnixTimeTool";

export const unixTimeTool: ToolDefinition = {
  id: "unix-time",
  name: "Unix Time",
  description: "Convert unix timestamps to human-readable datetimes",
  category: "time",
  keywords: ["unix", "time", "timestamp", "epoch"],
  icon: Clock,
  component: UnixTimeTool,
  enabled: true,
};
