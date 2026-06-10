import type { ComponentType } from "react";

export type ToolCategory =
  | "time"
  | "encoding"
  | "formatting"
  | "generators"
  | "converters"
  | "inspectors"
  | "web"
  | "crypto";

/** A keyboard binding registered by a tool with the command palette. */
export interface ToolShortcut {
  /** Human-readable label, e.g. "Decode clipboard". */
  label: string;
  /** Key combo in the palette's normalised form, e.g. "mod+enter". */
  combo: string;
  /** Run when the binding fires while the tool is active. */
  run: () => void;
}

/** Lazy-loaded tool component (avoids paying bundle cost until the tool is opened). */
export type LazyComponent = () => Promise<{ default: ComponentType }>;

export interface ToolDefinition {
  /** Stable, URL-safe id, e.g. "unix-time". Used as the route segment. */
  id: string;
  /** Display name in the sidebar and header. */
  name: string;
  /** One-line sidebar subtitle. Shown in detail-mode and search results. */
  description: string;
  category: ToolCategory;
  /** Extra terms the fuzzy search and command palette should match on. */
  keywords: string[];
  /** Sidebar icon (lucide-react component). */
  icon: ComponentType<{ className?: string }>;
  /** The tool UI as a lazy loader (ENT-05): every entry code-splits into its own
   *  Vite chunk, and the router's ToolRoute gate only invokes the loader when the
   *  tool is UNLOCKED — a locked tool's chunk is never fetched, which is what makes
   *  a future free-build decoder exclusion a real seam. */
  component: LazyComponent;
  /** Default true. Set false to hide from the registry. */
  enabled?: boolean;
  /** Maturity hint; surfaced in the sidebar/palette as a small badge. */
  status?: "stable" | "experimental";
  /** Entitlement strings required to USE this tool (ENT-01). Absent/empty = free.
   *  Locked tools stay visible (lock badge) and route to the upsell panel (D-30).
   *  Dormant in v1.6 production: no shipped tool carries this field (D-18). */
  requiredEntitlements?: string[];
  /** Tool-scoped keybindings registered with the command palette. */
  shortcuts?: ToolShortcut[];
}
