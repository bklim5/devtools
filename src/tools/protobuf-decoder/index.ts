// PHASE 1 STUB — Phase 3 replaces this with the real (hero) Protobuf Decoder tool.
// Exists only so registry.ts (ported verbatim) resolves its
// `@/tools/protobuf-decoder` import and `tsc`/build pass. enabled:false keeps it
// out of ENABLED_TOOLS/router.
import type { ToolDefinition } from "@/lib/tools/types";

const StubIcon = () => null;
const StubComponent = () => null;

export const protobufDecoderTool: ToolDefinition = {
  id: "protobuf-decoder",
  name: "Protobuf Decoder",
  description: "Phase 1 stub — implemented in Phase 3.",
  category: "inspectors",
  keywords: ["protobuf", "proto", "decode", "wire", "bytes"],
  icon: StubIcon,
  component: StubComponent,
  enabled: false,
};
