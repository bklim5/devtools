---
phase: quick-260611-ent
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/Sidebar.tsx
  - src/components/useSidebarDragDrop.ts
  - src/components/SidebarResetMenu.tsx
  - src/tools/base64/Base64Tool.tsx
  - src/tools/hash/HashTool.tsx
  - src/tools/unix-time/UnixTimeTool.tsx
  - src/tools/uuid-ulid/UuidUlidTool.tsx
autonomous: false
requirements: [QUICK-260611-ENT]

must_haves:
  truths:
    - "Sidebar rendered DOM, aria attributes, focus behavior, keyboard shortcuts (Alt+P via e.code KeyP, Alt+arrows, plain arrows/Home/End, Shift+F10), drag/drop semantics, and pinned/unpinned partition behavior are byte-identical to before the refactor"
    - "test/e2e/sidebar.e2e.ts and test/e2e/entitlements.e2e.ts pass UNMODIFIED on the real WKWebView"
    - "base64/hash/unix-time/uuid-ulid toggles render via SegmentedControl with identical role=group aria-labels, button labels, and aria-pressed semantics; their unit tests pass UNMODIFIED"
    - "Full e2e suite green via scripts/e2e-spike.sh (15 specs)"
    - "Manual drag reorder in both groups still works on tauri dev (WebDriver cannot cover HTML5 DnD)"
  artifacts:
    - path: "src/components/useSidebarDragDrop.ts"
      provides: "Extracted HTML5 drag/drop state + 5 callbacks (onDragStart/onRowDragOver/onNavDragOver/onDrop/onDragEnd)"
    - path: "src/components/SidebarResetMenu.tsx"
      provides: "Extracted Shift+F10 reset/'Unpin all' menu (open/close/focus-restore/dismiss logic + menu JSX)"
    - path: "src/components/Sidebar.tsx"
      provides: "Composition root, substantially reduced (~under 500 lines), exporting the same `Sidebar` named export"
      contains: "useSidebarDragDrop"
  key_links:
    - from: "src/components/Sidebar.tsx"
      to: "src/components/useSidebarDragDrop.ts"
      via: "hook call wiring drag state into renderRow + nav handlers"
      pattern: "useSidebarDragDrop\\("
    - from: "src/components/Sidebar.tsx"
      to: "src/components/SidebarResetMenu.tsx"
      via: "menu render + openFromMouse/openFromKeyboard handlers on <nav>"
    - from: "src/tools/base64/Base64Tool.tsx"
      to: "src/components/SegmentedControl.tsx"
      via: "import { SegmentedControl }"
      pattern: "SegmentedControl"
    - from: "src/tools/hash/HashTool.tsx"
      to: "src/components/SegmentedControl.tsx"
      via: "import + boolean→string value mapping"
      pattern: "SegmentedControl"
---

<objective>
Peer-review fixes batch 4 of 4 (final, riskiest): two independent pure refactors with UI regression risk.

1. Decompose the 823-line `src/components/Sidebar.tsx` along its existing seams — extract the HTML5 drag/drop cluster into a `useSidebarDragDrop` hook and the Shift+F10 reset/"Unpin all" menu into a `SidebarResetMenu` file; `Sidebar` remains the composition root.
2. Migrate the four inline "accent-on-active" toggle groups (base64 AlphabetToggle, hash CasingToggle, unix-time UnitToggle, uuid-ulid KindToggle) onto the shared `SegmentedControl`.

Purpose: kill the 4-way duplicated toggle markup and make Sidebar maintainable before v1.6 Phase 19/21 touch it again (footer key-entry + status UI land in this file).
Output: 2 new files + 5 reduced files, zero behavior change, full e2e green.

**Pure refactor rule (binding):** rendered DOM, aria attributes, focus behavior, keyboard shortcuts, drag/drop semantics, and partition behavior UNCHANGED. Unit tests and e2e specs pass UNMODIFIED. The single pre-approved markup delta is documented in Task 1.
</objective>

<context>
@./CLAUDE.md
@docs/HARNESS.md
@src/components/Sidebar.tsx
@src/components/SegmentedControl.tsx
@src/tools/url/UrlTool.tsx

Per-task DoD (harness, in order): `/simplify` → `/codex:review --wait --scope working-tree` → unit gate green (vitest + tsc --noEmit + eslint — lefthook enforces per commit) → real-webview verification. Final gate is Task 3.

Do NOT touch `src/lib/protobuf/decoder.ts` or its 19 tests.
</context>

<interfaces>
<!-- Contracts the executor needs — extracted from the codebase, no exploration required. -->

From src/components/SegmentedControl.tsx (use as-is, do NOT extend):
```typescript
export interface SegmentOption<T extends string> { value: T; label: string; }
export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>): JSX.Element;
// Renders: <div role="group" aria-label={ariaLabel} class="flex items-center gap-1 rounded-[7px] border border-bd bg-input-bg p-0.5">
//   one <button type="button" aria-pressed={active}> per option, accent classes on active only.
```

Inline toggles to replace (all render the IDENTICAL wrapper + button classes as SegmentedControl, except the noted cursor delta):
- `Base64Tool.tsx` — `AlphabetToggle` (~lines 90–125): options `["base64","base64url"]`, aria-label `"Base64 alphabet"`, call site `headerExtra={<AlphabetToggle value={alphabet} onChange={timed(setAlphabet)} />}` (~line 176)
- `HashTool.tsx` — `CasingToggle` (~lines 27–66): BOOLEAN-valued (`upper: boolean`), labels `"lower"`/`"UPPER"`, aria-label `"Hex casing"`, call site `<CasingToggle upper={upper} onChange={setUpper} />` (~line 186)
- `UnixTimeTool.tsx` — `UnitToggle` (~lines 35–69): options `["s","ms"]` (`type Unit = "s" | "ms"`), aria-label `"Timestamp unit"`, call site `<UnitToggle value={activeUnit} onChange={(u) => setOverride(u)} />` (~line 188)
- `UuidUlidTool.tsx` — `KindToggle` (~lines 85–119): `KINDS: {id: Kind; label: string}[]` where `type Kind = "uuid-v4" | "uuid-v7" | "ulid"`, aria-label `"ID kind"`, call site `<KindToggle value={kind} onChange={handleKind} />` (~line 221)

Sidebar drag/drop cluster to extract (Sidebar.tsx lines 96–101 state + 230–312 callbacks):
```typescript
// State: draggingId: string | null; draggingGroup: ToolGroup | null; dropIndex: number | null
// Callbacks: onDragStart(e, id, group)  — locked → preventDefault + openOrderingUpsell, never starts (T-18-12)
//            onRowDragOver(e, index, group) — same-group only, stopPropagation, above/below midpoint → gap index
//            onNavDragOver(e)            — end-of-list zone, dropIndex = active group length
//            onDrop(e)                   — gap-index math (from < dropIndex → dropIndex - 1), bail if id left the order
//            onDragEnd()                 — clear all three states
// Inputs the hook needs: orderingUnlocked, openOrderingUpsell, groupOrder(group), commitMove(group, id, toIndex)
// type ToolGroup = "pinned" | "unpinned" — currently declared in Sidebar.tsx; move it to the hook file and re-export (or export from the hook and import in Sidebar)
```

Sidebar reset-menu cluster to extract (Sidebar.tsx lines 47–50 + 415–529 + menu JSX 777–814):
```typescript
// State: resetMenu: {x, y} | null; refs: resetItemRef, menuReturnFocusRef
// Logic: openResetMenu(x,y) (captures document.activeElement), openResetMenuFromMouse, openResetMenuFromKeyboard
//        (Shift+F10 / ContextMenu key, anchored to focused row), closeResetMenu({restoreFocus}) with the
//        connected/not-body/tabIndex>=0 fallback chain (navRef → any live row ref),
//        focus-first-item layout effect, click-away (timeout-0 deferred) + Escape document listeners
// Actions wired from Sidebar: resetOrder (locked → upsell; else setToolOrder([]) + announce), unpinAll
//        (setPinnedToolIds([]) + announce) — these stay in Sidebar (they own prefs setters + announce);
//        the menu file receives them as props/args.
// Menu JSX: role="menu" aria-label="Sidebar order", menuitem "Reset order" (RotateCcw), conditional
//        menuitem "Unpin all" (PinOff) when pinned.length > 0, stopPropagation on container click.
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Migrate base64/hash/unix-time/uuid-ulid inline toggles to SegmentedControl</name>
  <files>src/tools/base64/Base64Tool.tsx, src/tools/hash/HashTool.tsx, src/tools/unix-time/UnixTimeTool.tsx, src/tools/uuid-ulid/UuidUlidTool.tsx</files>
  <action>
In each of the 4 tools, delete the inline toggle component (AlphabetToggle / CasingToggle / UnitToggle / KindToggle and their Props interfaces) and render `SegmentedControl` from `@/components/SegmentedControl` at the existing call site. Do NOT modify SegmentedControl itself, and do NOT touch the URL tool.

Per-tool mapping (preserve aria-labels and visible button labels EXACTLY):
- **base64**: `<SegmentedControl options={ALPHABET_OPTIONS} value={alphabet} onChange={timed(setAlphabet)} ariaLabel="Base64 alphabet" />` with `const ALPHABET_OPTIONS = [{ value: "base64", label: "base64" }, { value: "base64url", label: "base64url" }] as const;` — keep the `timed(...)` wrapper.
- **hash**: SegmentedControl is generic over `T extends string`; `upper` is boolean. Map at the call site: `const CASING_OPTIONS = [{ value: "lower", label: "lower" }, { value: "upper", label: "UPPER" }] as const;` then `<SegmentedControl options={CASING_OPTIONS} value={upper ? "upper" : "lower"} onChange={(v) => setUpper(v === "upper")} ariaLabel="Hex casing" />`. Do NOT widen SegmentedControl to non-string values.
- **unix-time**: `<SegmentedControl options={UNIT_OPTIONS} value={activeUnit} onChange={(u) => setOverride(u)} ariaLabel="Timestamp unit" />` with `const UNIT_OPTIONS = [{ value: "s", label: "s" }, { value: "ms", label: "ms" }] as const;` (`Unit` already extends string).
- **uuid-ulid**: derive options from the existing `KINDS` array (`KINDS.map(({ id, label }) => ({ value: id, label }))` or a static const), `value={kind}`, `onChange={handleKind}`, `ariaLabel="ID kind"`.

**Pre-approved markup delta (the ONLY one):** the hash and uuid-ulid inline buttons carry `cursor-pointer`; SegmentedControl's buttons do not. Accepting the migration drops `cursor-pointer` on those two toggles (mouse cursor shows default arrow instead of pointer). This is acceptable because: (a) no unit test or e2e spec queries cursor styling, (b) it makes all 6 SegmentedControl call sites consistent with the URL tool + FormatterView-mirrored baseline, (c) extending SegmentedControl would instead change the URL tool's rendered classes — a larger delta. No other class, attribute, label, or structure may change: wrapper `role="group"` + aria-label, `aria-pressed` per button, and visible labels stay byte-identical (the tests query exactly these — Base64Tool.test.tsx `button[aria-pressed='false']`, UnixTimeTool.test.tsx `button[aria-pressed='true'/'false']`, UuidUlidTool.test.tsx aria-pressed on the 3 kind buttons).

Unit tests must pass UNMODIFIED — if any test fails, fix the migration, never the test.

Then run the per-task harness: /simplify → /codex:review → unit gate. Commit separately from Task 2: `refactor(quick-260611-ent): migrate 4 inline toggles to shared SegmentedControl`.
  </action>
  <verify>
    <automated>pnpm vitest run src/tools/base64 src/tools/hash src/tools/unix-time src/tools/uuid-ulid src/components/SegmentedControl.test.tsx && pnpm tsc --noEmit && git diff HEAD~1 --stat -- '*.test.*' | wc -l | grep -q '^ *0$'</automated>
  </verify>
  <done>All 4 inline toggle components deleted; 4 tools render SegmentedControl with identical aria-labels/labels/aria-pressed; full unit gate (vitest + tsc + eslint via lefthook) green with ZERO test-file diffs; committed.</done>
</task>

<task type="auto">
  <name>Task 2: Decompose Sidebar.tsx — extract useSidebarDragDrop hook + SidebarResetMenu</name>
  <files>src/components/Sidebar.tsx, src/components/useSidebarDragDrop.ts, src/components/SidebarResetMenu.tsx</files>
  <action>
Pure refactor along the two seams identified in the interfaces block. Be conservative: MOVE code, do not redesign state flow, rename handlers, reorder JSX, or change any className/aria/tabIndex/event-binding. Preserve every code comment with its code (they encode D-XX decisions and pitfalls — especially the e.code "KeyP" macOS Option-compose comment, the T-18-12 locked-before-setter ordering, and the T-16-06/T-17-05 registry-name announce rule).

**Extraction 1 — `src/components/useSidebarDragDrop.ts`:**
- Move the `ToolGroup` type, the three drag states (`draggingId`, `draggingGroup`, `dropIndex`), and the five callbacks (`onDragStart`, `onRowDragOver`, `onNavDragOver`, `onDrop`, `onDragEnd`) verbatim into a hook:
  `useSidebarDragDrop({ orderingUnlocked, openOrderingUpsell, groupOrder, commitMove })` returning `{ draggingId, draggingGroup, dropIndex, onDragStart, onRowDragOver, onNavDragOver, onDrop, onDragEnd }`.
- Export `ToolGroup` from this file; Sidebar imports it. Keep the exact locked-path order in `onDragStart` (preventDefault + upsell BEFORE any state set — T-18-12) and the exact gap-index math + bail-on-missing-id in `onDrop`.
- The 15 drag-related bindings in Sidebar's JSX (`onDragOver`/`onDrop` on row wrappers, `draggable`/`onDragStart`/`onDragEnd` on grips, `onDragOver`/`onDrop` on `<nav>`, plus the two insertion-line conditionals reading `draggingGroup`/`dropIndex`) keep IDENTICAL call shapes — only the handler source changes from local consts to hook returns. WebDriver cannot exercise HTML5 DnD (dragDropEnabled=false context), so this code has NO automated net — diff-review it line-by-line against the original; manual coverage is Task 3.

**Extraction 2 — `src/components/SidebarResetMenu.tsx`:**
- Move the `ResetMenu` interface, menu state + refs, `openResetMenu`/`openResetMenuFromMouse`/`openResetMenuFromKeyboard`/`closeResetMenu`, the focus-first-item layout effect, the click-away/Escape effect (keep the timeout-0 deferred click listener and its rationale comment), and the `role="menu"` JSX verbatim.
- Suggested shape (keep it simple): a `useSidebarResetMenu({ navRef, rowRefs })` hook in this file returning `{ resetMenu, openFromMouse, openFromKeyboard, closeResetMenu, resetItemRef }`, plus a `SidebarResetMenu` component rendering the menu JSX with props `{ menu, resetItemRef, onResetOrder, onUnpinAll, showUnpinAll }`. `resetOrder` and `unpinAll` STAY in Sidebar.tsx (they own `setToolOrder`/`setPinnedToolIds`/`announce`/the upsell branch) and are passed down; they keep calling `closeResetMenu({ restoreFocus: true })`.
- The fallback-focus chain in `closeResetMenu` (connected + not-body + tabIndex>=0, else navRef, else first live row ref) must survive verbatim — it needs `navRef` and `rowRefs` passed in.

**Sidebar.tsx after:** composition root keeping registry partition, entitlements gate, announce/aria-live, `togglePin`, `commitMove`, `onRowKeyDown` (the WHOLE keyboard model incl. Alt+P `e.code === "KeyP"`), `renderRow`, the footer/upsell, and all JSX structure. Update `renderRow`'s dep array for the hook-returned values. The file header comment stays (trim only what moved, pointing at the new files).

**Invariant check before committing** — these e2e-queried surfaces must be byte-identical in rendered output: `button[aria-label^="Reorder "]` grips, `aria-label={Pin/Unpin X}` + `aria-pressed` pin buttons, `role="group"` aria-labels "Pinned tools"/"Tools", the `aria-live="polite"` region and its message strings, `role="menu"` aria-label "Sidebar order" with menuitems "Reset order"/"Unpin all", `aria-keyshortcuts="Alt+P"`, every tabIndex value, and the insertion-line spans. `Sidebar.test.tsx`, `Sidebar.locked.test.tsx`, and both e2e specs pass UNMODIFIED.

Then run the per-task harness: /simplify → /codex:review → unit gate. Commit separately: `refactor(quick-260611-ent): decompose Sidebar into drag-drop hook + reset-menu file`.
  </action>
  <verify>
    <automated>pnpm vitest run src/components/Sidebar.test.tsx src/components/Sidebar.locked.test.tsx && pnpm tsc --noEmit && git diff HEAD~1 --stat -- '*.test.*' 'test/e2e' | wc -l | grep -q '^ *0$'</automated>
  </verify>
  <done>useSidebarDragDrop.ts + SidebarResetMenu.tsx exist with the moved code verbatim; Sidebar.tsx is the composition root (substantially reduced, same export); all Sidebar unit tests green UNMODIFIED; tsc + eslint clean; committed.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Full e2e gate + screenshot review + manual drag sanity</name>
  <files>test/e2e/__screenshots__/ (evidence only — no source changes in this task)</files>
  <action>
Run the mandatory final verification, then hand off the manual drag walkthrough (WebDriver cannot synthesize HTML5 drag — dragDropEnabled=false; native-OS input is manual coverage per HARNESS.md).

Claude does steps 1-2 BEFORE pausing:
1. `bash scripts/e2e-spike.sh` — full real-WKWebView suite. ALL 15 specs must pass UNMODIFIED; sidebar.e2e.ts + entitlements.e2e.ts are the critical regression net (pinning, per-group reorder, plain-arrow nav across the divider, Shift+F10 reset menu, locked-UX loop). The specs' composed-key dispatch (key:"π", code:"KeyP") proves the Alt+P physical-key path survived the extraction.
2. Confirm fresh screenshots exist in `test/e2e/__screenshots__/` for base64, hash, unix-time, uuid-ulid and report their absolute paths — toggle groups must look identical (the only allowed delta, mouse-cursor style on hash/uuid-ulid, is invisible in screenshots).

Then pause for the human walkthrough below.
  </action>
  <what-built>Two pure refactors: (1) Sidebar.tsx decomposed into useSidebarDragDrop + SidebarResetMenu with Sidebar as composition root; (2) base64/hash/unix-time/uuid-ulid toggles migrated to the shared SegmentedControl. Zero intended behavior change. Full e2e suite already green (step 1 above).</what-built>
  <how-to-verify>
On `pnpm tauri dev` (the extracted drag callbacks have NO automated net):
1. Pin 2 tools (Alt+P or pin button). Drag-reorder within the PINNED group via the grip — neutral insertion line appears, drop lands where the line shows.
2. Drag-reorder within the UNPINNED group, including dropping in the empty area below the last row (end-zone → lands at group bottom).
3. Attempt to drag a pinned row over the unpinned group — the indicator must NOT follow (no cross-boundary).
4. Reload the app — order persists.
5. Glance at the 4 migrated tools' toggles: render, click-to-switch, focus ring.
  </how-to-verify>
  <verify>
    <automated>bash scripts/e2e-spike.sh && ls test/e2e/__screenshots__/ | grep -iE 'base64|hash|unix|uuid'</automated>
  </verify>
  <done>scripts/e2e-spike.sh green 15/15 with specs unmodified; screenshots of the 4 migrated tools reviewed; human approved the manual drag walkthrough (both groups, end-zone, no cross-boundary, persistence).</done>
  <resume-signal>Type "approved" or describe issues (any drag regression → fix in useSidebarDragDrop.ts only, re-run gate)</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

No new boundaries — pure refactor, no new input paths, no network, no deps.

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-Q-01 | Tampering | useSidebarDragDrop onDrop | mitigate | Preserve verbatim the bail-on-missing-id guard (overlay mutated mid-drag) and gap-index math — verified by line-diff against original |
| T-Q-02 | Elevation | onDragStart / togglePin / resetOrder locked paths | mitigate | T-18-12 invariant preserved: locked branch returns BEFORE any prefs setter/state set; entitlements e2e spec proves it unmodified |
| T-Q-03 | Spoofing | announce() messages | mitigate | T-16-06/T-17-05 preserved: aria-live always speaks registry `tool.name`, never raw stored ids — announce stays in Sidebar, untouched |
</threat_model>

<verification>
- Full unit suite + tsc + eslint green per commit (lefthook enforces).
- `git diff` shows ZERO changes under `*.test.*` and `test/e2e/` for Tasks 1–2.
- `bash scripts/e2e-spike.sh` → 15/15 specs green on the real WKWebView.
- Human walkthrough: manual drag (both groups, end-zone, no cross-boundary, persistence) + 4 migrated tools.
- `decoder.ts` + its 19 tests byte-for-byte untouched (`git diff --stat src/lib/protobuf/` empty).
</verification>

<success_criteria>
- Sidebar.tsx substantially reduced (composition root), 2 new files own drag/drop + reset menu.
- 4 duplicated inline toggle components deleted; 6 total SegmentedControl call sites.
- Zero behavior/DOM/aria change except the documented cursor-pointer loss on hash/uuid-ulid toggles.
- All tests (unit + e2e) pass unmodified; human approved the drag walkthrough.
- 2 separate commits (toggles, sidebar) + this plan's docs commit.
</success_criteria>

<output>
After completion, create `.planning/quick/260611-ent-sidebar-tsx-decomposition-drag-drop-rese/260611-ent-SUMMARY.md`
</output>
