// ⌘K command palette — the dedicated no-mouse tool switcher (SHL-02, SHL-03, D-03).
//
// Opens on ⌘K / Ctrl+K and Esc closes; it NEVER auto-opens (D-07 — the app boots
// straight into a tool). An empty query lists RECENT (≤5, most-recent-first) then
// ALL TOOLS in registry order (D-05); a non-empty query is fuzzy-ranked via the
// in-house `rankTools` (D-06). A miss shows a quiet "No tools match" row — never
// an error (D-07). ↑/↓ move a highlighted index over the visible flat list and
// Enter navigates to the highlighted tool, records the switch (recents push +
// last-used), and closes.
//
// This file never imports any Tauri package directly — recents/prefs go through
// the hooks, which route to the platform Store seam.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ENABLED_TOOLS, getToolById } from "@/lib/tools/registry";
import type { ToolDefinition } from "@/lib/tools/types";
import { rankTools } from "@/shell/fuzzy";
import { loadPreferences } from "@/shell/prefsStore";

interface PaletteGroup {
  label: string | null;
  tools: ToolDefinition[];
}

/**
 * Build the grouped, visible result model.
 * - Non-empty query → a single unlabelled ranked group (rankTools; [] = no match).
 * - Empty query → RECENT (valid recent ids, in order) then ALL TOOLS (the rest in
 *   registry order). Tampered/unknown recent ids are dropped via getToolById
 *   (threat T-02-10) so they can never render or be navigated to.
 */
function buildGroups(query: string, recentToolIds: string[]): PaletteGroup[] {
  if (query.trim() !== "") {
    return [{ label: null, tools: rankTools(query, ENABLED_TOOLS) }];
  }

  const recents: ToolDefinition[] = [];
  const seen = new Set<string>();
  for (const id of recentToolIds) {
    const tool = getToolById(id); // ENABLED_TOOLS only — skips unknown/tampered ids
    if (tool && !seen.has(tool.id)) {
      recents.push(tool);
      seen.add(tool.id);
    }
  }
  const rest = ENABLED_TOOLS.filter((t) => !seen.has(t.id));

  const groups: PaletteGroup[] = [];
  if (recents.length > 0) groups.push({ label: "RECENT", tools: recents });
  groups.push({ label: "ALL TOOLS", tools: rest });
  return groups;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  // Recents are READ-ONLY here — recording happens centrally on navigation
  // (useTrackActiveTool in App). We reload them from the store each time the
  // palette opens so the RECENT group is always current within the session
  // (the central writer lives in a different hook instance).
  const [recentToolIds, setRecentToolIds] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void loadPreferences().then((prefs) => {
      if (alive) setRecentToolIds(prefs.recentToolIds);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // ⌘K toggles the palette; Esc closes it. Global so it works from anywhere.
  // Opening resets the query + highlight HERE (an event handler, not an effect)
  // so there is no open→reset cascade.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) {
            setQuery("");
            setHighlight(0);
          }
          return !o;
        });
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus the input when the palette opens (an external-system sync — DOM focus).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const groups = useMemo(
    () => buildGroups(query, recentToolIds),
    [query, recentToolIds],
  );

  // Flat, ordered list of selectable tools (the highlight index walks this).
  const flatTools = useMemo(() => groups.flatMap((g) => g.tools), [groups]);

  // Clamp the highlight to the current result set at render time (derived — no
  // effect, so a shrinking list can never point past the end).
  const activeIndex =
    flatTools.length === 0 ? 0 : Math.min(highlight, flatTools.length - 1);

  const selectTool = useCallback(
    (tool: ToolDefinition) => {
      navigate(`/tools/${tool.id}`); // the route change records the switch (App)
      setOpen(false);
    },
    [navigate],
  );

  const onListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatTools.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((activeIndex + 1) % flatTools.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((activeIndex - 1 + flatTools.length) % flatTools.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const tool = flatTools[activeIndex];
        if (tool) selectTool(tool);
      }
    },
    [flatTools, activeIndex, selectTool],
  );

  if (!open) return null;

  let flatIndex = -1; // running index across groups → maps each row to the highlight

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-[min(560px,92vw)] overflow-hidden rounded-[14px] border border-bd-2 bg-palette shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[11px] border-b border-bd px-[18px] py-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onListKeyDown}
            placeholder="Search tools…"
            aria-label="Search tools"
            className="flex-1 bg-transparent text-[16px] text-tx outline-none placeholder:text-tx-3"
          />
        </div>

        <div className="max-h-[340px] overflow-auto p-2">
          {flatTools.length === 0 ? (
            <div className="px-[10px] py-[9px] text-[14px] text-tx-3">No tools match</div>
          ) : (
            groups.map((group) =>
              group.tools.length === 0 ? null : (
                <div key={group.label ?? "results"}>
                  {group.label && (
                    <div className="px-[10px] pb-[5px] pt-[10px] text-[10.5px] font-semibold uppercase tracking-[0.09em] text-tx-3">
                      {group.label}
                    </div>
                  )}
                  {group.tools.map((tool) => {
                    flatIndex += 1;
                    const isOn = flatIndex === activeIndex;
                    const Icon = tool.icon;
                    const idx = flatIndex;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => selectTool(tool)}
                        className={[
                          "flex w-full items-center gap-3 rounded-[8px] px-[10px] py-[9px] text-left",
                          isOn ? "bg-accent-soft text-tx" : "text-tx-2",
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-[18px] w-[18px] flex-none",
                            isOn ? "text-accent" : "text-tx-2",
                          ].join(" ")}
                        />
                        <span className="flex-1 text-[14px] font-medium text-tx">
                          {tool.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ),
            )
          )}
        </div>

        <div className="flex gap-4 border-t border-bd px-[18px] py-[10px] font-mono text-[11px] text-tx-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
