---
phase: quick/260714-dla
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/tools/registry.ts
  - src/lib/tools/registry.test.ts
  - src/shell/resolveStartupTool.test.ts
autonomous: false
requirements: [QUICK-PROTOBUF-TOP]

must_haves:
  truths:
    - "Protobuf Decoder is the first tool in the registry (TOOLS[0] and ENABLED_TOOLS[0])"
    - "Sidebar and command palette (derived from the registry) show Protobuf Decoder at the top for a default/never-reordered arrangement"
    - "A fresh install (no stored last-used tool, no default-tool pref) opens into Protobuf Decoder"
    - "Existing users with a stored last-used tool still open into that tool (unchanged)"
    - "vitest + tsc --noEmit stay green; decoder.ts and its 19 tests are byte-untouched"
  artifacts:
    - path: "src/lib/tools/registry.ts"
      provides: "TOOLS array with protobufDecoderTool first"
      contains: "protobufDecoderTool"
    - path: "src/lib/tools/registry.test.ts"
      provides: "Test asserting protobuf-decoder is first in TOOLS and ENABLED_TOOLS"
      contains: "protobuf-decoder"
  key_links:
    - from: "src/lib/tools/registry.ts (TOOLS order)"
      to: "Sidebar / CommandPalette / router (ENABLED_TOOLS)"
      via: "ENABLED_TOOLS = TOOLS.filter(...)"
      pattern: "ENABLED_TOOLS"
    - from: "src/shell/resolveStartupTool.ts (HERO_TOOL_ID fallback)"
      to: "first-launch startup navigation"
      via: "resolveStartupTool(undefined, null, null) => HERO_TOOL_ID"
      pattern: "HERO_TOOL_ID"
---

<objective>
Move the Protobuf Decoder to the top of the tool list so the hero tool leads the
sidebar and command palette, and confirm a freshly installed user lands on it by
default — without changing where existing users (with a stored last-used tool)
land.

Purpose: the schema-less Protobuf decoder is the product's hero feature; it should
be the first thing a new user sees and the default-selected tool on first launch.
The registry is the single control plane (sidebar, palette, router all derive from
`ENABLED_TOOLS`), so reordering the registry propagates everywhere for free.

Output: `src/lib/tools/registry.ts` with `protobufDecoderTool` first; a new
`registry.test.ts` locking that ordering; a strengthened fresh-install-default
assertion in `resolveStartupTool.test.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
<!-- Current registry (src/lib/tools/registry.ts) — TOOLS drives everything. -->
```typescript
// unixTimeTool is currently first; protobufDecoderTool is third (index 2).
export const TOOLS: ToolDefinition[] = [
  unixTimeTool,
  base64Tool,
  protobufDecoderTool,
  jwtTool,
  hashTool,
  uuidUlidTool,
  jsonFormatterTool,
  xmlFormatterTool,
  htmlFormatterTool,
  jsFormatterTool,
  urlTool,
  regexTool,
  cronTool,
];
export const ENABLED_TOOLS: ToolDefinition[] = TOOLS.filter((t) => t.enabled !== false);
export function getToolById(id: string): ToolDefinition | undefined { /* ENABLED_TOOLS.find */ }
```

<!-- Startup precedence (src/shell/resolveStartupTool.ts) — ALREADY falls back to
     protobuf on first run; the fresh-install default needs no code change. -->
```typescript
export const HERO_TOOL_ID = "protobuf-decoder";
export function resolveStartupTool(
  target: string | undefined,
  defaultToolId: string | null | undefined,
  lastUsedId: string | undefined | null,
): string {
  if (target && getToolById(target)) return target;          // explicit deep-link
  if (defaultToolId && getToolById(defaultToolId)) return defaultToolId; // SET-09 default tool
  if (lastUsedId && getToolById(lastUsedId)) return lastUsedId;          // D-13 restore last-used
  return HERO_TOOL_ID;                                        // D-12 first-run / invalid fallback
}
```

<!-- Fresh-install prefs defaults (src/shell/preferences.ts) confirm first launch
     yields resolveStartupTool(undefined, null, null) => protobuf-decoder:
       lastUsedId: null,  defaultToolId: null  (null = "Last used") -->
</interfaces>

<!-- Order-sensitivity audit (already performed during planning — do NOT re-derive,
     but DO re-run the suite to confirm): every order-sensitive test derives from
     the LIVE registry, so the reorder is safe:
       - router.test.tsx: uses ENABLED_TOOLS.map + HERO_TOOL_ID (dynamic)
       - Sidebar.test.tsx: uses ENABLED_TOOLS[0]/[1] and registryIds.map (dynamic)
       - resolveStartupTool.test.ts: id-based, not position-based
       - e2e (settings/sidebar): aria-label^="Reorder " prefix match (order-agnostic)
     No unit test hardcodes unix-time as the first tool. -->
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reorder registry so Protobuf Decoder is first + lock it with tests</name>
  <files>src/lib/tools/registry.ts, src/lib/tools/registry.test.ts, src/shell/resolveStartupTool.test.ts</files>
  <action>
1. In `src/lib/tools/registry.ts`, move `protobufDecoderTool` to be the FIRST
   element of the `TOOLS` array (currently index 2). Keep all other tools in their
   existing relative order. Result:
   ```
   protobufDecoderTool,
   unixTimeTool,
   base64Tool,
   jwtTool,
   hashTool,
   uuidUlidTool,
   jsonFormatterTool,
   xmlFormatterTool,
   htmlFormatterTool,
   jsFormatterTool,
   urlTool,
   regexTool,
   cronTool,
   ```
   Do NOT change imports, `ENABLED_TOOLS`, `getToolById`, or `searchTools`.
   Do NOT touch `src/tools/protobuf-decoder/*`, `src/lib/protobuf/decoder.ts`, or
   its 19 tests (byte-untouched — the immovable bar).

2. Create `src/lib/tools/registry.test.ts` asserting the hero-first invariant so a
   future reorder RED-flags:
   - `TOOLS[0].id === "protobuf-decoder"`
   - `ENABLED_TOOLS[0].id === "protobuf-decoder"` (the hero must be enabled, so it
     leads the derived sidebar/palette/router order too)
   - `getToolById("protobuf-decoder")` is defined (still resolvable)
   - the registry still contains all 13 tool ids with no drop/dup — e.g.
     `new Set(TOOLS.map(t => t.id)).size === TOOLS.length` and `TOOLS.length === 13`.

3. In `src/shell/resolveStartupTool.test.ts`, strengthen the fresh-install-default
   coverage. The existing "all absent (first run) → hero" test already proves the
   default; ADD one explicit test tying the fresh-install default to the
   registry-first hero so intent is unambiguous:
   `expect(resolveStartupTool(undefined, null, null)).toBe(ENABLED_TOOLS[0].id)`
   (import `ENABLED_TOOLS` from `@/lib/tools/registry`). This locks "fresh install
   opens into the first/registry-hero tool" AND that HERO_TOOL_ID stays aligned
   with the registry head. Leave the existing existing-user cases
   (e.g. `resolveStartupTool(undefined, null, "unix-time") === "unix-time"`)
   untouched — they prove existing users with a stored last-used tool are unaffected.
  </action>
  <verify>
    <automated>cd /Users/boonkhailim/Documents/projects/bk/playground/devtools && pnpm vitest run src/lib/tools/registry.test.ts src/shell/resolveStartupTool.test.ts src/router.test.tsx src/components/Sidebar.test.tsx && pnpm exec tsc --noEmit && git diff --quiet HEAD -- src/lib/protobuf/</automated>
  </verify>
  <done>
  `protobufDecoderTool` is TOOLS[0]; registry.test.ts and resolveStartupTool.test.ts
  green; router + Sidebar suites still green (no order-sensitive regression); tsc
  clean; `src/lib/protobuf/` byte-untouched. Then run the per-task harness gate:
  `/simplify` → `/code-review xhigh` → `/codex:adversarial-review` over the diff,
  and address any confirmed findings before the checkpoint.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Real-webview verification — Protobuf Decoder leads and is the first-launch default</name>
  <what-built>
  Reordered the tool registry so Protobuf Decoder is first; the sidebar, command
  palette, and startup routing all derive from `ENABLED_TOOLS`, so the hero now
  leads them. Fresh-install default already resolves to protobuf via the existing
  HERO fallback (now locked by a test).
  </what-built>
  <how-to-verify>
  AGENT-RUN FIRST (do not defer the automatable parts to the human):
  1. Run the full unit suite once more (`pnpm vitest run` + `pnpm exec tsc --noEmit`)
     to confirm no order-sensitive test regressed across the whole suite.
  2. Real WKWebView content check (`scripts/e2e-spike.sh` / `tauri dev`): confirm the
     Sidebar's first tool row is "Protobuf Decoder" (top of the list) and the command
     palette (⌘K) lists it at the top with no custom order applied. Screenshot + DOM
     check the first `a[href^="/tools/"]` resolves to `/tools/protobuf-decoder`.
  3. Fresh-install default: with a clean prefs state (no `lastUsedId`, no
     `defaultToolId`), launch and confirm the app opens directly into the Protobuf
     Decoder tool (index redirect → `/tools/protobuf-decoder`).
  4. Existing-user non-regression: seed `lastUsedId: "base64"` and confirm launch
     still opens into Base64 (unchanged behavior).
  5. Native window capture per the binding harness — build/launch the `.app` and
     `scripts/ui-capture.sh "<pgrep>" out.png`, then Read the PNG to confirm the
     sidebar visibly leads with Protobuf Decoder (capture the channel(s) the change
     can affect; light theme is sufficient — this is not theme-sensitive chrome).

  THEN human sign-off: launch the freshly built app, confirm Protobuf Decoder sits
  at the top of the sidebar and a first launch opens into it.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (e.g. wrong order, wrong default tool).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| prefs.json → startup routing | `lastUsedId` / `defaultToolId` are user-writable, hand-editable, UNTRUSTED |
| `#/tools/<id>` deep-link → router | explicit navigation target is untrusted |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-Q-01 | Tampering | resolveStartupTool inputs (persisted prefs / deep-link) | accept (existing) | Already validated via `getToolById` (ENABLED_TOOLS only) before return — unchanged by this plan; no new input path introduced. |
| T-Q-02 | Denial of Service | registry ordering | accept | Pure array reorder, no user input; `new Set` no-dup/count assertion in registry.test.ts guards against an accidental drop/duplicate. |

No new trust boundary or input surface is introduced; this plan only reorders a
static array and adds tests. Existing untrusted-input validation is untouched.
</threat_model>

<verification>
- `pnpm vitest run` full suite green (no order-sensitive regression anywhere).
- `pnpm exec tsc --noEmit` clean.
- `git diff --quiet HEAD -- src/lib/protobuf/` — decoder.ts + 19 tests byte-untouched.
- Real WKWebView: sidebar + palette lead with Protobuf Decoder; fresh install opens
  into it; seeded last-used still restores that tool.
- Per-task harness gate run (`/simplify` → `/code-review xhigh` →
  `/codex:adversarial-review`) with findings addressed.
</verification>

<success_criteria>
- `TOOLS[0].id === "protobuf-decoder"` and `ENABLED_TOOLS[0].id === "protobuf-decoder"`.
- Sidebar and command palette show Protobuf Decoder at the top (default arrangement).
- Fresh install (no stored last-used, no default-tool pref) opens into Protobuf Decoder.
- Existing users with a stored last-used tool are unaffected.
- Full vitest + tsc green; `src/lib/protobuf/` byte-untouched.
- Human sign-off recorded.
</success_criteria>

<output>
After completion, create
`.planning/quick/260714-dla-move-protobuf-decoder-to-top-of-tool-lis/260714-dla-SUMMARY.md`
</output>
