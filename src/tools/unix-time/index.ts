// Unix Time Converter — ENABLED in Phase 2 as a shared placeholder (D-01); Phase 3
// replaces `component` with the real tool UI. Only the registry-facing fields
// change here (enabled/icon/component/description) — no tool logic yet.
import { Clock } from "lucide-react";
import { makePlaceholder } from "@/tools/_placeholder/ToolPlaceholder";
import type { ToolDefinition } from "@/lib/tools/types";

export const unixTimeTool: ToolDefinition = {
  id: "unix-time",
  name: "Unix Time",
  description: "Convert unix timestamps to human-readable datetimes",
  category: "time",
  keywords: ["unix", "time", "timestamp", "epoch"],
  icon: Clock,
  component: makePlaceholder("Unix Time"),
  enabled: true,
};
