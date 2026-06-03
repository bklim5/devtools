import type { ToolDefinition } from "./types";
import { unixTimeTool } from "@/tools/unix-time";
import { base64Tool } from "@/tools/base64";
import { protobufDecoderTool } from "@/tools/protobuf-decoder";
import { jwtTool } from "@/tools/jwt";
import { hashTool } from "@/tools/hash";
import { uuidUlidTool } from "@/tools/uuid-ulid";
import { jsonFormatterTool } from "@/tools/json-formatter";
import { xmlFormatterTool } from "@/tools/xml-formatter";
import { urlTool } from "@/tools/url";
import { regexTool } from "@/tools/regex";

// The single source of truth for which tools exist. The sidebar, search, and
// router are all generated from this array — adding a tool means importing it
// and dropping it in here, nothing else.
//
// The throwaway Phase-1 walking-skeleton was removed (D-05) once the
// build+verify harness was proven. Every tool below ships enabled; ENABLED_TOOLS
// filters out any `enabled: false` entry. router.tsx still guards the empty case
// and falls back to the bare App shell when no tools are enabled.
export const TOOLS: ToolDefinition[] = [
  unixTimeTool,
  base64Tool,
  protobufDecoderTool,
  jwtTool,
  hashTool,
  uuidUlidTool,
  jsonFormatterTool,
  xmlFormatterTool,
  urlTool,
  regexTool,
];

export const ENABLED_TOOLS: ToolDefinition[] = TOOLS.filter((t) => t.enabled !== false);

export function getToolById(id: string): ToolDefinition | undefined {
  return ENABLED_TOOLS.find((t) => t.id === id);
}

/** Case-insensitive match over name, description, and keywords. */
export function searchTools(query: string): ToolDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return ENABLED_TOOLS;
  return ENABLED_TOOLS.filter((t) =>
    [t.name, t.description, ...t.keywords].some((s) => s.toLowerCase().includes(q)),
  );
}
