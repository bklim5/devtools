---
phase: quick-260611-dww
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/tools/regex/RegexTool.tsx
  - src/tools/url/UrlTool.tsx
  - src/tools/cron/CronTool.tsx
  - src/tools/_placeholder/ToolPlaceholder.tsx
  - docs/HARNESS.md
autonomous: true
requirements: [QUICK-260611-DWW]

must_haves:
  truths:
    - "Regex, URL, and Cron tools render copy buttons via the shared src/components/CopyButton.tsx — zero local CopyButton definitions remain"
    - "Every copy button's aria-label is byte-identical to before the migration (unit + e2e tests query by these labels)"
    - "src/tools/_placeholder/ no longer exists and nothing references it"
    - "docs/HARNESS.md exists as an operational runbook for the e2e gate"
  artifacts:
    - path: "src/components/CopyButton.tsx"
      provides: "The one CopyButton (unchanged or minimally extended)"
    - path: "docs/HARNESS.md"
      provides: "e2e-gate runbook: ports, env vars, preflight, WebKit quirks, DMG flake, session model, screenshots-as-evidence"
  key_links:
    - from: "src/tools/regex/RegexTool.tsx"
      to: "src/components/CopyButton.tsx"
      via: "import { CopyButton }"
      pattern: "from \"@/components/CopyButton\""
    - from: "src/tools/url/UrlTool.tsx"
      to: "src/components/CopyButton.tsx"
      via: "import { CopyButton }"
      pattern: "from \"@/components/CopyButton\""
    - from: "src/tools/cron/CronTool.tsx"
      to: "src/components/CopyButton.tsx"
      via: "import { CopyButton }"
      pattern: "from \"@/components/CopyButton\""
---

<objective>
Peer-review fixes batch 2/4: de-duplicate three local CopyButton definitions into the existing shared component, delete the never-imported ToolPlaceholder, and write docs/HARNESS.md — an operational runbook for the e2e gate capturing tribal knowledge currently scattered across script/spec comments.

Purpose: ~45 redundant lines removed; one copy affordance to maintain (UX-02); the e2e gate becomes operable from one doc instead of archaeology.
Output: 3 migrated tools, deleted `src/tools/_placeholder/`, new `docs/HARNESS.md`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/components/CopyButton.tsx
@src/tools/regex/RegexTool.tsx
@src/tools/url/UrlTool.tsx
@src/tools/cron/CronTool.tsx
@scripts/e2e-spike.sh
@wdio.conf.ts

<interfaces>
The shared component (src/components/CopyButton.tsx) — already imported by jwt/hash/uuid/unix-time:

```typescript
export interface CopyButtonProps {
  value: string;       // text written to clipboard
  label: string;       // aria-label becomes `Copy ${label}` — NOTE the prefix
  className?: string;  // appended to base styles
}
export function CopyButton({ value, label, className }: CopyButtonProps)
```

Renders: Check/Copy lucide icon + "Copy"/"Copied" text, `px-2 py-1 text-[11.5px] rounded-[7px]`, visible (never hover-gated), platform clipboard seam + useCopyFeedback.

The three LOCAL variants all have signature `{ value: string; label: string }` with `aria-label={label}` (verbatim, NO prefix). Behavioral deltas vs shared:
- ALL three: `shrink-0` in base classes (shared lacks it — pass `className="shrink-0"`).
- regex + cron: smaller (`px-1.5 py-0.5 text-[11px] rounded-[6px] gap-1`), text-only, no icon. COSMETIC per review — adopt the shared appearance, do NOT add a size prop.
- url: visually identical to shared already (icon + same sizing).

Call sites and their current full aria-labels (must stay byte-identical after migration):
- RegexTool.tsx:484 `label={`Copy group ${gi + 1}`}` → pass `label={`group ${gi + 1}`}`
- RegexTool.tsx:509-511 `label={`Copy group ${name}`}` → `label={`group ${name}`}`
- RegexTool.tsx:560 `label="Copy result"` → `label="result"`
- UrlTool.tsx:136 + 209 `label={`Copy ${label}`}` → `label={label}`
- UrlTool.tsx:165-167 `label={`Copy query value ${row.key}`}` → `label={`query value ${row.key}`}`
- CronTool.tsx:113-115 `label="Copy description"` → `label="description"`
- CronTool.tsx:172 `label={`Copy run ${i + 1}`}` → `label={`run ${i + 1}`}`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate regex/url/cron to the shared CopyButton; delete _placeholder</name>
  <files>src/tools/regex/RegexTool.tsx, src/tools/url/UrlTool.tsx, src/tools/cron/CronTool.tsx, src/tools/_placeholder/ToolPlaceholder.tsx</files>
  <action>
In each of the three tools:
1. Delete the local `function CopyButton(...)` definition (RegexTool.tsx ~line 82, UrlTool.tsx ~line 34, CronTool.tsx ~line 21).
2. Add `import { CopyButton } from "@/components/CopyButton";`.
3. At every call site, strip the leading `Copy ` from the `label` prop per the mapping in <interfaces> — the shared component prepends `Copy ` itself, so rendered aria-labels stay byte-identical. This is the one NON-cosmetic difference; getting it wrong breaks UrlTool.test.tsx, CronTool.test.tsx, url.e2e.ts, regex.e2e.ts which query by aria-label.
4. Add `className="shrink-0"` at every migrated call site (all three locals had shrink-0 in their base classes; shared accepts className — no fork needed).
5. Remove now-unused imports left behind: `useCopyFeedback` and possibly `platform` / `Check` / `Copy` (lucide) — but ONLY if no other use remains in the file (eslint will flag; verify per file, e.g. UrlTool's Check/Copy icons were CopyButton-only).
6. Accept the cosmetic upgrade in regex/cron (icon + 11.5px sizing instead of text-only 11px) — review classed this as cosmetic; do NOT extend the shared component with a size prop.

Then delete `src/tools/_placeholder/` entirely (`git rm -r src/tools/_placeholder`) — ToolPlaceholder.tsx is referenced nowhere outside its own file (grep-confirmed).

Do not touch src/lib/protobuf/decoder.ts or its tests.
  </action>
  <verify>
    <automated>grep -rn "function CopyButton" src/tools/ returns nothing; test ! -d src/tools/_placeholder; pnpm vitest run src/tools/url src/tools/cron src/tools/regex && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>Zero local CopyButton definitions in src/tools/; _placeholder gone; all three tools' unit tests green with unchanged aria-label queries; tsc clean.</done>
</task>

<task type="auto">
  <name>Task 2: Write docs/HARNESS.md — e2e gate runbook</name>
  <files>docs/HARNESS.md</files>
  <action>
Create docs/HARNESS.md: short, operational, a runbook not prose (headings + bullets/tables, target well under ~120 lines). Source facts from scripts/e2e-spike.sh comments, test/e2e/*.e2e.ts comments, and wdio.conf.ts — do not invent. Must cover, in roughly this order:

**Running the gate**
- Entry point: `bash scripts/e2e-spike.sh` — starts `pnpm tauri:dev:e2e` (`tauri dev --features webdriver`; a plain `tauri dev` / every `tauri build` excludes the WebDriver plugin so :4445 never binds outside the gate), polls 127.0.0.1:4445, runs `pnpm e2e` (WDIO), always tears down the process group via trap. Exit code = WDIO's.
- Ports: WebDriver `TAURI_WEBDRIVER_PORT` (default :4445, 127.0.0.1 ONLY — threat T-01-11); vite :1420 is FIXED by tauri.conf.json devUrl — tauri dev needs exactly that port.
- Env vars: `MAX_WAIT` (default 180s, bound on WebDriver-server startup poll); `E2E_DEMO=1` (slow-motion pauses in specs for watching a run live; inert otherwise); `PREFLIGHT_ONLY=1` (run preflight then exit 0 — dry-run).
- Logs: tauri dev output → test/e2e/__logs__/tauri-dev.log (tailed on failure).

**Preflight (why a green run is trustworthy)**
- Kills orphan `devtools-app` processes (pgrep -f matches the dev binary name only — production TinkerDev never matches): TERM → ~5s → KILL → ~10s → fail-loud. Rationale: the single-instance plugin means an orphan blocks relaunch, and an orphan holding :4445 would make WDIO test STALE code while looking green.
- Then kills anything still LISTENING on :4445/:1420 (lsof -sTCP:LISTEN), same TERM→KILL→fail-loud ladder. Never launches over an unkillable holder.

**Session model**
- ONE shared app session across all specs: maxInstances 1, a single empty capability — the embedded server drives the one app window. Full suite ~10 min. Specs live per-tool in test/e2e/*.e2e.ts (launch → navigate → drive → assert → screenshot).
- Screenshots land in test/e2e/__screenshots__/ — these ARE the UI-verify evidence for the gate.

**WebKit / Tauri quirks (each one cost a debugging session)**
- macOS Option+letter composes to a glyph (Option+P → "π"): app code must match physical `e.code` (e.g. "KeyP"), never `e.key`; e2e specs must dispatch the composed key shape (`key: "π", code: "KeyP"`) or they false-positive.
- Stale chained element handles: re-query elements after navigation/re-render instead of holding chained handles across steps.
- `dragDropEnabled: false` in tauri.conf.json is deliberate: Tauri v2's native dragDrop (default true) swallows in-page HTML5 DnD. WebDriver cannot synthesize native OS drag either — drag/drop and other native-OS input is MANUAL-walkthrough coverage; make it an explicit human-verify item.

**DMG bundle flake (phase-boundary builds)**
- `pnpm tauri build`'s DMG step fails when other DMGs are mounted: `hdiutil detach` the mounted volumes, retry. Also note: the build's final non-zero exit can be just the absent updater-signing key — confirm via the .app/.dmg under src-tauri/target/release/bundle/macos/, not the exit code.
  </action>
  <verify>
    <automated>test -f docs/HARNESS.md && grep -c "4445\|1420\|MAX_WAIT\|E2E_DEMO\|PREFLIGHT_ONLY\|e.code\|dragDropEnabled\|hdiutil\|__screenshots__" docs/HARNESS.md</automated>
  </verify>
  <done>docs/HARNESS.md exists; covers ports/env vars, preflight, single shared session + screenshots-as-evidence, all three WebKit/Tauri quirks, and the DMG flake; reads as a runbook.</done>
</task>

<task type="auto">
  <name>Task 3: Harness pass — simplify, review, full unit gate</name>
  <files>src/tools/regex/RegexTool.tsx, src/tools/url/UrlTool.tsx, src/tools/cron/CronTool.tsx</files>
  <action>
Per the binding per-task DoD (CLAUDE.md):
1. `/simplify` over the just-changed files (quality cleanups only).
2. `/codex:review --wait --scope working-tree` — address findings.
3. Full unit gate: `pnpm vitest run` (entire suite — decoder's 19 tests must stay green and untouched), `pnpm exec tsc --noEmit`, `pnpm exec eslint .` (eslint is part of the lefthook unit gate since batch 1).

Real-WKWebView e2e verification is intentionally DEFERRED to batch 3 (helpers extraction) which runs the full e2e gate immediately after this batch — note this explicitly in the SUMMARY. The migration's UI delta is the cosmetic copy-button upgrade in regex/cron (icon + 11.5px); aria-labels are proven unchanged by the unit suite.
  </action>
  <verify>
    <automated>pnpm vitest run && pnpm exec tsc --noEmit && pnpm exec eslint .</automated>
  </verify>
  <done>Full suite green (decoder 19/19 untouched), tsc + eslint clean, codex review findings addressed; SUMMARY notes e2e coverage lands with batch 3's full run.</done>
</task>

</tasks>

<verification>
- `grep -rn "function CopyButton" src/tools/` → empty (shared component is the only definition).
- `git log --stat` shows src/tools/_placeholder/ deleted.
- Full vitest suite + tsc + eslint green; decoder.ts and its 19 tests byte-for-byte untouched.
- docs/HARNESS.md present and covering all required topics.
</verification>

<success_criteria>
- Three tools import the shared CopyButton with byte-identical aria-labels; ~45 duplicated lines gone.
- Dead _placeholder directory deleted.
- docs/HARNESS.md is a usable runbook for operating the e2e gate.
- Unit gates green; e2e gate explicitly deferred to batch 3 (full run scheduled there).
</success_criteria>

<output>
After completion, create `.planning/quick/260611-dww-shared-copybutton-in-regex-url-cron-dele/260611-dww-SUMMARY.md`
</output>
