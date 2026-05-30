import type { ToolDefinition } from "./types";
import { unixTimeTool } from "@/tools/unix-time";
import { base64Tool } from "@/tools/base64";
import { protobufDecoderTool } from "@/tools/protobuf-decoder";

// The single source of truth for which tools exist. The sidebar, search, and
// router are all generated from this array — adding a tool means importing it
// and dropping it in here, nothing else.
export const TOOLS: ToolDefinition[] = [unixTimeTool, base64Tool, protobufDecoderTool];

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
