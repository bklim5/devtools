// PHASE 1 STUB — Phase 3 replaces this with the real Base64 / Hex / Bytes tool.
// Exists only so registry.ts (ported verbatim) resolves its `@/tools/base64`
// import and `tsc`/build pass. enabled:false keeps it out of ENABLED_TOOLS/router.
import type { ToolDefinition } from "@/lib/tools/types";

const StubIcon = () => null;
const StubComponent = () => null;

export const base64Tool: ToolDefinition = {
  id: "base64",
  name: "Base64",
  description: "Phase 1 stub — implemented in Phase 3.",
  category: "encoding",
  keywords: ["base64", "hex", "bytes", "encode", "decode"],
  icon: StubIcon,
  component: StubComponent,
  enabled: false,
};
