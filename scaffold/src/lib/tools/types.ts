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
  /**
   * The tool UI. Either an eagerly-imported component or a lazy loader.
   * Lazy is preferred for any tool not on the default startup path.
   */
  component: ComponentType | LazyComponent;
  /** Default true. Set false to hide from the registry. */
  enabled?: boolean;
  /** Maturity hint; surfaced in the sidebar/palette as a small badge. */
  status?: "stable" | "experimental";
  /**
   * Reserved architectural seam for future paid features. Has **zero UX
   * manifestation in v1** — no badges, no upsells, no gates. Present only so
   * the registry can become a licensing control plane later without a refactor.
   */
  premium?: boolean;
  /** Tool-scoped keybindings registered with the command palette. */
  shortcuts?: ToolShortcut[];
}
