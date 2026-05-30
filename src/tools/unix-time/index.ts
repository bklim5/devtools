// PHASE 1 STUB — Phase 3 replaces this with the real Unix Time Converter tool.
// Exists only so registry.ts (ported verbatim) resolves its `@/tools/unix-time`
// import and `tsc`/build pass. enabled:false keeps it out of ENABLED_TOOLS/router.
import type { ToolDefinition } from "@/lib/tools/types";

const StubIcon = () => null;
const StubComponent = () => null;

export const unixTimeTool: ToolDefinition = {
  id: "unix-time",
  name: "Unix Time",
  description: "Phase 1 stub — implemented in Phase 3.",
  category: "time",
  keywords: ["unix", "time", "timestamp", "epoch"],
  icon: StubIcon,
  component: StubComponent,
  enabled: false,
};
