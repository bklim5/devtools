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
import { Lock, Settings } from "lucide-react";
import { ENT_ORDERING, isPro, isToolLocked } from "@/lib/entitlements/entitlements";
import {
  getEntitlementsSnapshot,
  refreshEntitlements,
} from "@/lib/entitlements/store";
import { ENABLED_TOOLS, getToolById } from "@/lib/tools/registry";
import type { ToolDefinition } from "@/lib/tools/types";
import { rankTools, subsequenceScore } from "@/shell/fuzzy";
import { loadPreferences, savePreferences } from "@/shell/prefsStore";
import { openSettings } from "@/shell/settingsStore";
import { openProUpsell } from "@/shell/proUpsell";
import { useEntitlements } from "@/shell/useEntitlements";
import { usePreferences } from "@/shell/usePreferences";
import { matchesChord } from "@/shell/hotkeyAccelerator";

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
  // The element focused BEFORE the palette opened, captured at open time. The
  // palette button the user selects unmounts when the palette closes, so it
  // can't be the Settings modal's focus-return target (codex finding 3) — the
  // License/Settings commands pass THIS persistent pre-palette element to
  // openSettings(), so focus returns to a still-connected control on modal close,
  // never <body>. State (not a ref) so the command's `run` closure stays
  // render-safe (no ref reads flowing through buildGroups during render).
  const [preOpenFocus, setPreOpenFocus] = useState<HTMLElement | null>(null);

  // D-23/D-24: tool rows mirror the sidebar's lock badge through the SAME central
  // predicate — the one resolved set, no per-feature checks (ENT-01). Declared
  // HERE (above the ⌘K key effect) because the palette itself is now Pro-gated
  // (D-22.2-1): `pro` decides whether ⌘K opens the palette or the upsell modal.
  const ents = useEntitlements();
  const pro = isPro(ents);

  // D-24-6: the palette open chord is configurable (Hotkeys pane). Already coerced
  // to a valid accelerator by the prefs coercer (Plan 01) — default ⌘K. Matched
  // via matchesChord (physical e.code), so an Option-composed-glyph chord still
  // matches (Pitfall 2, macos-option-key-composes-letters).
  const { preferences } = usePreferences();
  const paletteChord = preferences.paletteChord;

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
  //
  // Phase 22.2 (D-22.2-1/3): the palette is Pro-gated. A FREE user's ⌘K opens the
  // focused Unlock-Pro modal (via the shared upsellStore) instead of the palette —
  // returning focus to whatever was focused (the header ⌘K pill dispatches the
  // SAME synthetic ⌘K, so it routes here too). DEV escape hatch (D-22.2-10): under
  // import.meta.env.DEV, ⌘⇧K force-opens the palette regardless of tier so the
  // in-palette "toggle free" command stays reachable for an interactive dev; this
  // branch is tree-shaken out of release. Re-binds when `pro` flips.
  useEffect(() => {
    // The DEV escape (D-22.2-10) is the palette chord with Shift added. The OLD
    // hardcoded handler entered the ⌘K branch regardless of Shift and gated with
    // `import.meta.env.DEV && e.shiftKey`; with the strict matcher (exact modifier
    // set) the base chord no longer matches when Shift is held, so we instead match
    // the shift-augmented chord explicitly (same DEV-only force-open semantics).
    // Built only under DEV (tree-shaken from release).
    const devForceChord = import.meta.env.DEV
      ? paletteChord.includes("Shift+")
        ? null // already has Shift; no distinct escape
        : paletteChord.replace(/\+([^+]+)$/, "+Shift+$1")
      : null;
    const onKey = (e: KeyboardEvent) => {
      const devForce =
        import.meta.env.DEV &&
        devForceChord !== null &&
        matchesChord(e, devForceChord);
      if (matchesChord(e, paletteChord) || devForce) {
        e.preventDefault();
        if (!pro && !devForce) {
          // Not Pro → route by license state (openProUpsell): a free user gets the
          // focused Unlock-Pro modal; a lapsed/attention paying customer gets the
          // Settings ▸ License recovery form (never the pitch — D-44). Capture the
          // focused element synchronously as the return target.
          const active = document.activeElement;
          openProUpsell(active instanceof HTMLElement ? active : null);
          return;
        }
        setOpen((o) => {
          if (!o) {
            setQuery("");
            setHighlight(0);
            // Remember where focus was before the palette opened, so a command
            // that opens the Settings modal (License/Settings) can return focus
            // there on close (the palette button itself unmounts — finding 3).
            const active = document.activeElement;
            setPreOpenFocus(active instanceof HTMLElement ? active : null);
          }
          return !o;
        });
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pro, paletteChord]);

  // Focus the input when the palette opens (an external-system sync — DOM focus).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // D-88/D-S11 (revised 22.1-04): the "License" command — a SHIPPED production
  // command (NOT under the import.meta.env.DEV guard, so check-dev-strip.sh leaves
  // it in the bundle; it carries no privileged action, T-21-15). BOTH tiers now
  // converge on the single Settings modal on the License pane (openSettings — the
  // one Settings surface, D-S6): the standalone "Unlock Pro" upsell modal is gone,
  // and the License pane itself renders the inline upsell for the free tier and
  // the status card for a managed license. The PRE-PALETTE focus is passed as the
  // explicit return target: the palette button the user selected unmounts on
  // close, so it can't be the modal's focus-return element (finding 3).
  const licenseCommand = useMemo<CommandRow>(
    () => ({
      kind: "command",
      id: "license-status",
      name: "License",
      icon: Lock,
      run: () => openSettings("license", preOpenFocus),
    }),
    [preOpenFocus],
  );

  // D-S8: the "Settings" command — sibling to the License command, opens the
  // single Settings modal on the License pane (the only pane this phase). Passes
  // the pre-palette focus as the explicit return target (the palette row unmounts
  // on close — finding 3).
  const settingsCommand = useMemo<CommandRow>(
    () => ({
      kind: "command",
      id: "settings",
      name: "Settings",
      icon: Settings,
      run: () => openSettings("license", preOpenFocus),
    }),
    [preOpenFocus],
  );

  // Production commands first, then DEV commands (dev tooling always last).
  const commands = useMemo<CommandRow[]>(
    () => [licenseCommand, settingsCommand, ...DEV_COMMANDS],
    [licenseCommand, settingsCommand],
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
        <div className="flex items-center gap-3 border-b border-bd px-4 py-4">
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
            <div className="px-2.5 py-2 text-[14px] text-tx-3">No tools match</div>
          ) : (
            groups.map((group) =>
              group.rows.length === 0 ? null : (
                <div key={group.label ?? "results"}>
                  {group.label && (
                    <div className="px-2.5 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-tx-3">
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
                          "flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left",
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

        <div className="flex gap-4 border-t border-bd px-4 py-2.5 font-mono text-[11px] text-tx-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
