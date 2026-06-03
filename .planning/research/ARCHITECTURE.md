# Architecture Research — v1.3 "More Tools" integration

**Domain:** Adding 3 new tools (Cron, URL, Regex) + a Protobuf decimal-byte-array input mode to an existing registry-driven Tauri/React/TS app
**Researched:** 2026-06-03
**Confidence:** HIGH (every integration point read directly from the codebase; no training-data guesses)

This is an integration map, not greenfield ecosystem research. All four features slot into a mature, well-factored pattern: pure logic in `src/lib/<domain>/`, a thin React tool in `src/tools/<tool>/`, and a one-line registry append. The codebase already proves this twice (the v1.1 formatters). Nothing here requires touching `decoder.ts`, the registry mechanics, or the platform seam contract.

---

## 1. Existing architecture (confirmed from the codebase)

### The three-layer tool pattern

```
┌──────────────────────────────────────────────────────────────────────┐
│  CONTROL PLANE — src/lib/tools/registry.ts                            │
│  TOOLS: ToolDefinition[]  →  ENABLED_TOOLS, getToolById, searchTools  │
│  Sidebar, ⌘K palette, and HashRouter routes ALL derive from this array│
└───────────────┬──────────────────────────────────────────────────────┘
                │ imports one `<tool>Tool` const per tool
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  TOOL UI — src/tools/<tool>/                                          │
│  index.ts        → the ToolDefinition (id, name, icon, component…)    │
│  <Tool>.tsx      → thin React component; owns input + option STATE     │
│  <Tool>.test.tsx → component test                                      │
│  (tool-local pure helpers may also live here, e.g. detectEncoding.ts)  │
└───────────────┬──────────────────────────────────────────────────────┘
                │ imports pure functions (TDD'd before the UI)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PURE LOGIC — src/lib/<domain>/   (no React, no Tauri, vitest-first)  │
│  e.g. format/json.ts, protobuf/decoder.ts, release/version.ts          │
└──────────────────────────────────────────────────────────────────────┘

         All OS access funnels through src/lib/platform/ (the `platform` seam).
         Tools call platform.clipboard.writeText(...) — never @tauri-apps/*.
```

### Component responsibilities (verified)

| Component | Responsibility | File |
|-----------|----------------|------|
| `registry.ts` | Single source of truth; `TOOLS` array; `ENABLED_TOOLS`/`getToolById`/`searchTools` derive sidebar, palette, router | `src/lib/tools/registry.ts` |
| `types.ts` | `ToolDefinition` interface (id, name, description, category, keywords, icon, component, enabled?, status?, premium?, shortcuts?) | `src/lib/tools/types.ts` |
| `FormatterView` | Shared 2-pane shell: top toolbar (indent 2/4/tab + Minify + optional Sort-keys) → resizable input\|output `<textarea>`s → StatusBar. Read-only output, copy via platform seam. **Tuned to the format domain** | `src/components/FormatterView.tsx` |
| `StatusBar` | parse state · OPT-IN byteCount · optional encoding · error · timing. Pure presentational | `src/components/StatusBar.tsx` |
| `CopyButton` | Visible focusable copy, `useCopyFeedback` confirmation, writes through platform seam | `src/components/CopyButton.tsx` |
| `ResizableSplit` | Drag-resizable two-pane split (left/right) | `src/components/ResizableSplit.tsx` |
| `platform` seam | clipboard/store/window/nativeShortcut/updater/events. Synchronous accessor backed by browser fallback until Tauri impl lazily resolves | `src/lib/platform/index.ts` |

### What "register a tool" requires (read from `json-formatter/index.ts`)

The mechanics are exactly two edits, both additive:

1. Create `src/tools/<tool>/index.ts` exporting a `ToolDefinition` const:
   ```ts
   import { SomeIcon } from "lucide-react";          // icon is a lucide-react component
   import ToolComponent from "./ToolComponent";
   import type { ToolDefinition } from "@/lib/tools/types";

   export const <tool>Tool: ToolDefinition = {
     id: "<kebab-id>",          // URL-safe; becomes the HashRouter route segment
     name: "<Sidebar Name>",
     description: "<one-line subtitle>",
     category: "<ToolCategory>", // see §1.1 below
     keywords: ["…"],            // fuzzy/palette match terms
     icon: SomeIcon,
     component: ToolComponent,   // eager import OK; LazyComponent loader allowed
     enabled: true,
   };
   ```
2. Import it in `src/lib/tools/registry.ts` and append to the `TOOLS` array (one import line + one array entry). Sidebar, ⌘K palette, and router auto-derive — **nothing else to wire** (the `json-formatter/index.ts` header documents this verbatim).

No router file edit, no sidebar edit, no manual route registration. `ENABLED_TOOLS = TOOLS.filter(t => t.enabled !== false)`.

#### 1.1 `ToolCategory` already has the right buckets

`types.ts` defines: `time | encoding | formatting | generators | converters | inspectors | web | crypto`. The new tools map cleanly with **no type change needed**:
- **Cron** → `time` (mirrors Unix Time) or `converters`. Recommend `time`.
- **URL** → `web` (this category exists and is currently unused — it was clearly reserved for exactly this).
- **Regex** → `inspectors` (alongside Protobuf) or `web`. Recommend `inspectors`.

---

## 2. Where the new pure modules live (proposed folders under `src/lib/`)

Follow the established `src/lib/<domain>/` convention (one folder per domain, e.g. `format/`, `protobuf/`, `release/`). All are pure, zero-dep, vitest-first.

| Tool | Pure module folder | Files | Notes |
|------|-------------------|-------|-------|
| **Cron** | `src/lib/cron/` | `parse.ts` (5/6-field + `@daily`/`@hourly` macro expansion → normalized field model), `describe.ts` (field model → human text), `nextRuns.ts` (field model + `from: Date`, `count: N` → `Date[]`), `index.ts` (re-export), + `*.test.ts` each | Hand-rolled next-run (no `cron-parser`), consistent with hand-rolled-decoder ethos. **The only non-trivial logic in the milestone** — deserves the most test surface. Render next-runs in local time via the existing `src/lib/timeFormat.ts`. |
| **URL** | `src/lib/url/` | `parseUrl.ts` (native `URL` → `{scheme,host,port,path,query,fragment}` + query `[key,value][]`), `encode.ts` (component vs full-string `encodeURIComponent`/`encodeURI` both ways), `index.ts`, + `*.test.ts` | Native `URL` + `URLSearchParams`. Zero dep. |
| **Regex** | `src/lib/regex/` | `run.ts` (pattern + flags + input → matches with index/groups/named-groups), `replace.ts` (substitution preview with `$1` refs), `patterns.ts` (the small library: email/URL/IPv4 literals), `index.ts`, + `*.test.ts` | Native `RegExp`. **Guard against ReDoS / catastrophic backtracking** — see PITFALLS; wrap construction in try/catch (invalid pattern → error string, never crash, mirroring `decodeInput`). |
| **Protobuf decimal** | (tool-local, NOT `src/lib/`) — see §5 | extend `src/tools/protobuf-decoder/detectEncoding.ts` + add `decimalToBytes` | The new byte-array parse layer is tool-local input handling, exactly where `detectEncoding.ts` already lives. `src/lib/protobuf/decoder.ts` stays byte-for-byte untouched. |

**Convention match:** every existing pure domain (`format`, `release`) keeps a thin `index.ts` re-export and per-concern files. Cron's three-file split (parse / describe / nextRuns) mirrors release's four-file decision split (`version`/`manifest`/`bumpPlan`/`publishPlan`) and keeps each unit independently testable.

---

## 3. Reused vs new UI (per tool)

### FormatterView fit assessment

`FormatterView` is **not** a generic two-pane shell — read its source: its `FormatterControls` are hard-coded to the formatting domain (`indent: "2"|"4"|"tab"`, `minify`, optional `sortKeys`), and its toolbar renders an indent segmented group + Minify/Sort-keys toggles. It is shaped for "input text → reformatted text." **None of the three new tools are reformatters**, so reusing `FormatterView` as-is would require either bending unrelated controls or widening it into a god-component. Recommendation: **do NOT reuse `FormatterView`** for any of the three; instead reuse the smaller, genuinely generic primitives (`ResizableSplit`, `StatusBar`, `CopyButton`, `useCopyFeedback`, the platform seam).

| Tool | Layout | Reuse | New UI |
|------|--------|-------|--------|
| **Cron** | **Bespoke single-input → structured output.** Top: cron input + "next N" count control. Below: human description card + an ordered **next-runs list** (local-time, mirroring Unix Time's date formatting). Not a 2-pane editor. | `StatusBar` (parse state + error + timing; no byteCount), `CopyButton` (copy a run time / the description), `useCopyFeedback`, `timeFormat.ts`, platform seam | `CronTool.tsx`; a next-runs list section. Closest existing reference: `UnixTimeTool.tsx` (single-input, structured local-time output, no FormatterView). |
| **URL** | **Could fit a 2-pane mental model but NOT `FormatterView`** (no indent/minify/sort). Bespoke: an input field, an encode/decode direction + component/full toggle, a **query-string key→value table**, and a split-components readout (scheme/host/port/path/query/fragment) each with its own `CopyButton`. | `StatusBar`, `CopyButton` (per component + per row), `useCopyFeedback`, platform seam; optionally `ResizableSplit` if a 2-pane raw\|parsed view is wanted | `UrlTool.tsx`; a small key→value table component (tool-local) and a components readout list. |
| **Regex** | **Bespoke, the most custom.** Pattern input + flag toggles (g/i/m/s/u) + a pattern-library inserter; a **test-input textarea with inline match highlighting** (overlay technique — render highlighted spans behind/over the textarea, NOT raw-HTML injection; respect the formatter's D-03/T-07-05 no-raw-HTML rule); a capture-group breakdown list; a live replace/substitution preview pane. | `StatusBar` (match count + error + timing), `CopyButton`, `useCopyFeedback`, flag toggles can reuse the `Toggle`/`toggleClasses` accent-on-selected pattern (currently private inside `FormatterView` — see §6), platform seam | `RegexTool.tsx`; a match-highlighting component (the genuinely new, careful piece); a capture-group list; the flag toggle row. |
| **Protobuf decimal** | **No new layout.** Extends the existing `ProtobufDecoder.tsx` input pane: the encoding toggle group (`OVERRIDES`) grows from `["hex","base64"]` to `["hex","base64","decimal"]`, and the placeholder text updates. The output tree, StatusBar, ResizableSplit all unchanged. | Entire existing `ProtobufDecoder.tsx` UI | One added segment in the existing `role="group" aria-label="Encoding"` toggle; updated placeholder copy. |

**Bottom line on shared UI:** reuse the small primitives everywhere; build three bespoke tool layouts (Cron, URL, Regex) plus one trivial Protobuf input extension. `FormatterView` is correctly left alone.

---

## 4. Exact registry entries to add

Three new `index.ts` files + three `TOOLS` appends (Protobuf needs NO registry change — it's the same tool):

```ts
// src/tools/cron/index.ts
import { Clock } from "lucide-react";            // or CalendarClock
import CronTool from "./CronTool";
import type { ToolDefinition } from "@/lib/tools/types";
export const cronTool: ToolDefinition = {
  id: "cron",
  name: "Cron",
  description: "Describe a cron expression and preview next runs",
  category: "time",
  keywords: ["cron", "crontab", "schedule", "next run", "@daily", "@hourly"],
  icon: Clock,
  component: CronTool,
  enabled: true,
};

// src/tools/url/index.ts
import { Link } from "lucide-react";
import UrlTool from "./UrlTool";
import type { ToolDefinition } from "@/lib/tools/types";
export const urlTool: ToolDefinition = {
  id: "url",
  name: "URL",
  description: "Parse, encode, and decode URLs and query strings",
  category: "web",
  keywords: ["url", "uri", "encode", "decode", "query", "querystring", "percent"],
  icon: Link,
  component: UrlTool,
  enabled: true,
};

// src/tools/regex/index.ts
import { Regex } from "lucide-react";            // lucide-react ships a `Regex` glyph
import RegexTool from "./RegexTool";
import type { ToolDefinition } from "@/lib/tools/types";
export const regexTool: ToolDefinition = {
  id: "regex",
  name: "Regex",
  description: "Test patterns, inspect capture groups, preview replacements",
  category: "inspectors",
  keywords: ["regex", "regexp", "regular expression", "match", "pattern", "replace"],
  icon: Regex,
  component: RegexTool,
  enabled: true,
};
```

Then in `src/lib/tools/registry.ts`: add three imports and three array entries:
```ts
import { cronTool } from "@/tools/cron";
import { urlTool } from "@/tools/url";
import { regexTool } from "@/tools/regex";
// …append to TOOLS: cronTool, urlTool, regexTool
```

Verify the lucide-react glyph names against the installed version during the phase (icon is a `ComponentType<{className?:string}>`; any lucide icon works — `Regex`, `Link`, `Clock` are all standard but confirm at build). **Confidence on exact glyph availability: MEDIUM** (training data) — everything else here is HIGH (read from source).

---

## 5. The Protobuf decimal seam (decoder.ts UNTOUCHED) — precise location

### Where input parsing/auto-detection lives today

Two tool-local files, NOT in `src/lib/protobuf/`:
- `src/tools/protobuf-decoder/detectEncoding.ts` — a **pure classifier**: `detectEncoding(raw): "hex" | "base64"`. It only inspects string shape, imports nothing from `@/lib/bytes`. Header explicitly states "it never parses bytes, it only inspects the shape."
- `src/tools/protobuf-decoder/useDecode.ts` — `decodeInput(raw, override?)`: picks encoding (or honors override), converts to bytes via `hexToBytes`/`base64ToBytes` from `@/lib/bytes`, runs `decodeMessage` from `@/lib/protobuf/decoder`, wraps both in ONE try/catch so any error becomes a status string.

`src/lib/protobuf/decoder.ts` only ever receives a `Uint8Array` (`decodeMessage(bytes)`). It has no knowledge of hex/base64/decimal. **This is the clean seam: the input→bytes conversion is entirely outside the decoder.**

### Minimal change to add a third "decimal" mode (no decoder edit)

Three small, additive edits — all in the tool folder, none touching `decoder.ts` or its 19 tests:

1. **`detectEncoding.ts`** — widen the union and add one detection branch:
   ```ts
   export type InputEncoding = "hex" | "base64" | "decimal";
   // After the hex check, add: if the body splits on /[,\s]+/ into all-numeric
   // base-10 tokens each 0–255 → "decimal". Order matters: keep hex FIRST so a
   // bare "1003 50" with NO commas still reads as hex when even-length all-hex.
   // A decimal array is disambiguated by a comma and/or a token > 255-as-hex.
   // Recommend the simplest unambiguous trigger: "a comma anywhere ⇒ decimal",
   // with space-only-separated all-≤255 decimal as a secondary heuristic. This
   // precedence rule is the ONE design judgement to lock in the plan.
   ```
   Add a pure `decimalToBytes(raw: string): Uint8Array` (tool-local next to `detectEncoding`, or in `@/lib/bytes` if reuse is wanted — see §6). It splits on `/[\s,]+/`, parses base-10, validates each 0–255 (throw on out-of-range so the existing try/catch turns it into a status string).
2. **`useDecode.ts`** — one line in the converter selection:
   ```ts
   const bytes =
     encoding === "hex" ? hexToBytes(raw)
     : encoding === "decimal" ? decimalToBytes(raw)
     : base64ToBytes(raw);
   ```
   The surrounding try/catch already turns a bad decimal token into a non-crashing error (threat T-03-03 path preserved).
3. **`ProtobufDecoder.tsx`** — extend `const OVERRIDES = ["hex","base64"]` → `["hex","base64","decimal"]` and update the placeholder/empty-state copy to mention decimal. The encoding toggle group renders the new segment automatically (it `.map`s over `OVERRIDES`).

That is the entire seam. `decoder.ts` and `decoder.test.ts` are not opened.

---

## 6. Build order, dependencies, and shared helpers to extract

### Inter-tool dependencies: effectively NONE

The three new tools are independent pure-logic islands (cron parsing, URL parsing, regex execution share nothing). The Protobuf decimal mode is independent of all three. They can be built in **any order or in parallel plans** (the harness explicitly allows parallel plans, gated per-task). The only shared touchpoint is the registry append, which is mechanical and conflict-trivial.

### Recommended phase decomposition (continues from Phase 11 → starts at Phase 12)

Sequence by risk and by shared-helper extraction, not by hard dependency:

1. **Phase 12 — Protobuf decimal input** (smallest; de-risks the "don't touch decoder" promise first; ~3 file edits + tests for `decimalToBytes` and the widened `detectEncoding`). Also forces the input-mode-detector question to be answered early.
2. **Phase 13 — URL tool** (native `URL`/`URLSearchParams`, lowest-novelty pure logic; establishes the bespoke "parsed-components readout + key→value table" layout other tools can echo).
3. **Phase 14 — Regex tool** (highest UI novelty: match-highlighting overlay, capture-group breakdown, replace preview; allow extra UI-verification budget; ReDoS guard).
4. **Phase 15 — Cron tool** (highest *logic* novelty: hand-rolled next-run computation; reuse `timeFormat.ts` for local-time display; most unit-test surface).

Cron and Regex are the two with real depth — sequencing them last (or as parallel side-plans after URL + Protobuf land) keeps the easy wins flowing and concentrates verification effort.

### Shared helpers worth extracting (deliberately, not speculatively)

| Candidate | Extract? | Where |
|-----------|----------|-------|
| **`decimalToBytes`** | Maybe → `@/lib/bytes.ts` | `bytes.ts` already owns `hexToBytes`/`base64ToBytes`; a sibling `decimalToBytes`/`bytesToDecimal` keeps the family together and is unit-tested with the rest. If only Protobuf uses it, tool-local is also fine. Lean toward `bytes.ts` for symmetry. |
| **`Toggle` + `toggleClasses` (accent-on-selected)** | **Yes** | Currently private inside `FormatterView.tsx`. Regex flag toggles, URL direction/mode toggles, and Cron count controls all want the same accent-on-selected segmented-group styling. Extract to a shared `src/components/Toggle.tsx` (or `SegmentedGroup`) so it stops being formatter-private. This is the single most reused piece across the three new tools. |
| **A generic "input-mode detector"** | **No — do not over-abstract** | The only detector in the codebase is the protobuf `detectEncoding`, and no new tool has a comparable auto-detect need (URL/Regex/Cron take explicit input). A generic detector would be speculative. Keep `detectEncoding` tool-local and just widen its union. |
| **Local-time formatting** | Already shared | `src/lib/timeFormat.ts` exists (used by Unix Time); Cron reuses it directly. No extraction needed. |

---

## Patterns to follow (from the existing code)

- **Pure-first, TDD:** write + test the `src/lib/<domain>/` functions before the React component (release core + formatters both did this).
- **Error-as-string, never crash:** mirror `decodeInput`'s single try/catch → status string. Invalid cron / invalid regex / out-of-range decimal byte all become a `StatusBar` error, never a thrown crash.
- **`useMemo` over the pure call, synchronous, no debounce:** `JsonFormatterTool` computes in `useMemo(() => timed(() => formatJson(...)))`. Time the pure call where the work happens.
- **State-adjust-during-render to reset on input change:** `ProtobufDecoder` resets selection/collapsed when the decode key changes — Regex/Cron can use the same pattern if they hold derived selection state.
- **Copy through the platform seam only; visible focusable button:** reuse `CopyButton`/`useCopyFeedback`. No hover-only copy (UX-02).
- **Layout-agnostic Tailwind:** `min-w-0`/`min-h-0`, no fixed widths (UX-05).

## Anti-patterns to avoid

- **Do NOT widen `FormatterView` to absorb non-format tools.** It is intentionally format-shaped; bending it adds coupling. Build bespoke layouts on the small primitives instead.
- **Do NOT inject raw HTML for regex match highlighting.** The formatters deliberately use read-only `<textarea>` plain text to avoid the D-03 / T-07-05 injection class. Highlighting must use a span-overlay technique over escaped text, not `dangerouslySetInnerHTML`.
- **Do NOT open `decoder.ts` or `decoder.test.ts`** for the decimal mode. The seam is entirely in `detectEncoding.ts` + `useDecode.ts` + the toggle in `ProtobufDecoder.tsx`.
- **Do NOT add a runtime dependency** (`cron-parser`, `query-string`, regex libs). Native `URL`/`URLSearchParams`/`RegExp` + hand-rolled cron hold the zero-dep wedge.

## Sources

- `src/lib/tools/registry.ts`, `src/lib/tools/types.ts` — registry mechanics + `ToolDefinition`/`ToolCategory` (HIGH)
- `src/tools/json-formatter/index.ts`, `src/tools/json-formatter/JsonFormatterTool.tsx` — register-a-tool + thin-tool pattern (HIGH)
- `src/components/FormatterView.tsx`, `StatusBar.tsx`, `CopyButton.tsx` — shared UI surface + format-specific shaping (HIGH)
- `src/tools/protobuf-decoder/detectEncoding.ts`, `useDecode.ts`, `ProtobufDecoder.tsx` — the exact decimal seam (HIGH)
- `src/lib/platform/index.ts` — the OS-capability seam contract (HIGH)
- `src/lib/bytes.ts` — `hexToBytes`/`base64ToBytes` family (candidate home for `decimalToBytes`) (HIGH)
- `.planning/PROJECT.md` — milestone goal, constraints, zero-dep wedge (HIGH)
- lucide-react exact glyph names (`Regex`, `Link`, `Clock`) — training data, verify at build (MEDIUM)
