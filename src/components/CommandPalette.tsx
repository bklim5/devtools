// ⌘K command palette — the dedicated no-mouse tool switcher (SHL-02, SHL-03, D-03).
//
// Opens on ⌘K / Ctrl+K and Esc closes; it NEVER auto-opens (D-07 — the app boots
// straight into a tool). An empty query lists RECENT (≤5, most-recent-first) then
// ALL TOOLS in registry order (D-05); a non-empty query is fuzzy-ranked via the
// in-house `rankTools` (D-06), with name-matching DEV commands appended after the
// tool matches (D-32). A miss shows a quiet "No tools match" row — never
// an error (D-07). ↑/↓ move a highlighted index over the visible flat list and
// Enter navigates to the highlighted tool, records the switch (recents push +
// last-used), and closes.
//
// This file never imports any Tauri package directly — recents/prefs go through
// the hooks, which route to the platform Store seam.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { ENT_ORDERING, isToolLocked } from "@/lib/entitlements/entitlements";
import {
  getEntitlementsSnapshot,
  refreshEntitlements,
} from "@/lib/entitlements/store";
import { ENABLED_TOOLS, getToolById } from "@/lib/tools/registry";
import type { ToolDefinition } from "@/lib/tools/types";
import { rankTools, subsequenceScore } from "@/shell/fuzzy";
import { loadPreferences, savePreferences } from "@/shell/prefsStore";
import { useEntitlements } from "@/shell/useEntitlements";
import { useLicenseUi } from "@/shell/useLicenseUi";

/** A selectable palette row: a registry tool OR a non-navigating command
 *  (RESEARCH Pattern 7 — smallest discriminated-union extension). */
type PaletteRow =
  | { kind: "tool"; tool: ToolDefinition }
  | {
      kind: "command";
      id: string;
      name: string;
      icon: ComponentType<{ className?: string }>;
      run: () => void | Promise<void>;
    };

type CommandRow = Extract<PaletteRow, { kind: "command" }>;

interface PaletteGroup {
  label: string | null;
  rows: PaletteRow[];
}

const toolRow = (tool: ToolDefinition): PaletteRow => ({ kind: "tool", tool });

// D-32: DEV-only — import.meta.env.DEV is statically false in production builds,
// so this whole branch (including the command STRING) is tree-shaken out.
// Verified by the Plan 04 dist-grep check (scripts/check-dev-strip.sh greps for
// BOTH dev override values). Post-D-85 the override is a true Pro<->Free toggle
// that drives the live entitlement snapshot: from the effective FREE baseline it
// writes the DEV-only "full" (Pro), and from Pro it writes "free". Both values are
// honored ONLY under import.meta.env.DEV — in a release build the coercer nulls
// "full" and resolve.ts shakes the branch out, so this can never unlock prod
// (T-18-10/T-21-15 downgrade-only invariant intact).
const DEV_COMMANDS: CommandRow[] = import.meta.env.DEV
  ? [
      {
        kind: "command",
        id: "dev-toggle-free-tier",
        name: "Toggle free tier (dev)",
        icon: Lock,
        run: async () => {
          // Toggle the EFFECTIVE tier, not the stored string: after the D-85 flip
          // the baseline (no override / unlicensed) resolves FREE, so a stored-value
          // flip alone could never reach Pro. If Pro is currently live → force FREE;
          // otherwise → grant the DEV-only FULL override.
          const proLive = getEntitlementsSnapshot().has(ENT_ORDERING);
          const next: "free" | "full" = proLive ? "free" : "full";
          const prefs = await loadPreferences();
          await savePreferences({ ...prefs, entitlementsOverride: next });
          // Notify ALL gate consumers (Pitfall 3 — prefs hook instances don't
          // sync; the entitlements store is the one live channel).
          await refreshEntitlements();
        },
      },
    ]
  : [];

/**
 * Build the grouped, visible result model.
 * - Non-empty query → a single unlabelled ranked group: rankTools over the
 *   registry, then any PRODUCTION command (e.g. "License", D-88) and any DEV
 *   command whose NAME matches the same subsequence rule appended at the END
 *   (D-32 — commands never outrank tools, but must be findable by typing; a
 *   command-only match still counts as a match, so "No tools match" stays
 *   reserved for true misses). [] = no match.
 * - Empty query → RECENT (valid recent ids, in order) then ALL TOOLS (the rest in
 *   registry order), then the production + DEV commands at the very END.
 *   Tampered/unknown recent ids are dropped via getToolById (threat T-02-10) so
 *   they can never render or be navigated to.
 */
function buildGroups(
  query: string,
  recentToolIds: string[],
  commands: CommandRow[],
): PaletteGroup[] {
  const q = query.trim().toLowerCase();
  if (q !== "") {
    const rows: PaletteRow[] = rankTools(query, ENABLED_TOOLS).map(toolRow);
    for (const cmd of commands) {
      if (subsequenceScore(q, cmd.name.toLowerCase()) !== null) rows.push(cmd);
    }
    return [{ label: null, rows }];
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
  if (recents.length > 0) groups.push({ label: "RECENT", rows: recents.map(toolRow) });
  groups.push({ label: "ALL TOOLS", rows: rest.map(toolRow) });
  if (commands.length > 0) groups.push({ label: null, rows: commands });
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

  // D-23/D-24: tool rows mirror the sidebar's lock badge through the SAME
  // central predicate — the one resolved set, no per-feature checks (ENT-01).
  const ents = useEntitlements();

  // D-88: the "License" command — a SHIPPED production command (NOT under the
  // import.meta.env.DEV guard, so check-dev-strip.sh leaves it in the bundle; it
  // carries no privileged action — it only navigates, T-21-15). Routes by state:
  // there IS a license to manage (anything but the pure free notActivated) → the
  // status route; the free tier → "/" where the sidebar's Unlock Pro panel lives.
  const licenseState = useLicenseUi().state;
  const licenseCommand = useMemo<CommandRow>(
    () => ({
      kind: "command",
      id: "license-status",
      name: "License",
      icon: Lock,
      run: () =>
        navigate(licenseState === "notActivated" ? "/" : "/settings/license"),
    }),
    [licenseState, navigate],
  );

  // Production commands first, then DEV commands (dev tooling always last).
  const commands = useMemo<CommandRow[]>(
    () => [licenseCommand, ...DEV_COMMANDS],
    [licenseCommand],
  );

  const groups = useMemo(
    () => buildGroups(query, recentToolIds, commands),
    [query, recentToolIds, commands],
  );

  // Flat, ordered list of selectable rows (the highlight index walks this).
  const flatRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  // Clamp the highlight to the current result set at render time (derived — no
  // effect, so a shrinking list can never point past the end).
  const activeIndex =
    flatRows.length === 0 ? 0 : Math.min(highlight, flatRows.length - 1);

  const selectRow = useCallback(
    (row: PaletteRow) => {
      if (row.kind === "tool") {
        navigate(`/tools/${row.tool.id}`); // the route change records the switch (App)
        setOpen(false);
        return;
      }
      // Commands never navigate (D-32): close first, then run — the palette is
      // gone before any async work lands.
      setOpen(false);
      void row.run();
    },
    [navigate],
  );

  const onListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatRows.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((activeIndex + 1) % flatRows.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((activeIndex - 1 + flatRows.length) % flatRows.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = flatRows[activeIndex];
        if (row) selectRow(row);
      }
    },
    [flatRows, activeIndex, selectRow],
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
          {flatRows.length === 0 ? (
            <div className="px-[10px] py-[9px] text-[14px] text-tx-3">No tools match</div>
          ) : (
            groups.map((group) =>
              group.rows.length === 0 ? null : (
                <div key={group.label ?? "results"}>
                  {group.label && (
                    <div className="px-[10px] pb-[5px] pt-[10px] text-[10.5px] font-semibold uppercase tracking-[0.09em] text-tx-3">
                      {group.label}
                    </div>
                  )}
                  {group.rows.map((row) => {
                    flatIndex += 1;
                    const isOn = flatIndex === activeIndex;
                    const idx = flatIndex;
                    const key = row.kind === "tool" ? row.tool.id : row.id;
                    const Icon = row.kind === "tool" ? row.tool.icon : row.icon;
                    const name = row.kind === "tool" ? row.tool.name : row.name;
                    // D-23: locked TOOL rows get the badge; selection still
                    // navigates (the route shows the upsell — D-30). Commands
                    // are never "locked".
                    const locked = row.kind === "tool" && isToolLocked(row.tool, ents);
                    return (
                      <button
                        key={key}
                        type="button"
                        onMouseEnter={() => setHighlight(idx)}
                        onClick={() => selectRow(row)}
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
                          {name}
                        </span>
                        {locked ? (
                          <>
                            {/* D-24: neutral tx-2, aria-hidden — accent forbidden.
                                D-25: sr-only suffix joins the accessible name. */}
                            <Lock
                              aria-hidden="true"
                              className="h-3 w-3 flex-none text-tx-2"
                            />
                            <span className="sr-only"> — locked</span>
                          </>
                        ) : null}
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
