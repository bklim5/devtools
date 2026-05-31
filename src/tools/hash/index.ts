// Hash Generator — registered in Wave 1 (Plan 04-01) so registry.ts edits stay
// concentrated there; Wave 2 (Plan 04-04) swaps `component` for the real tool UI
// without touching registry.ts. Icons/labels/keywords are D-18 discretion.
import { Hash } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/types";
import HashTool from "./HashTool";

export const hashTool: ToolDefinition = {
  id: "hash",
  name: "Hash",
  description: "MD5 + SHA-1/256/384/512 digests",
  category: "crypto",
  keywords: ["hash", "md5", "sha", "sha256", "digest", "checksum"],
  icon: Hash,
  component: HashTool,
  enabled: true,
};
