# Phase 3: Hero (Protobuf) + Encoding + UX Constraints - Research

**Researched:** 2026-05-31
**Domain:** React 19 UI over an existing, tested decode/encoding engine (protobuf wire-format tree + bytes converter) inside a Tauri 2 shell; cross-cutting WCAG-AA UX bar
**Confidence:** HIGH (the risk is UI/UX fidelity over already-tested logic; every byte/decode primitive already exists and was read directly this session)

## Summary

Phase 3 is a **UI-over-existing-logic** phase, not a logic phase. The two hard parts — the schema-less protobuf decoder (`src/lib/protobuf/decoder.ts`, 19 immovable tests) and the Base64/Hex/Bytes engine (`src/lib/bytes.ts`, feature-detect + polyfill) — already exist and are correct. This phase ships two real React components into the shell's `<Outlet/>` by swapping each tool's registry `component` from `makePlaceholder(...)` to the real component, applies the cross-cutting UX constraints (paste-instant, no hover-only copy, status bar, WCAG-AA, layout-agnostic), and adds one persisted preference (`protobufTreeStyle`). [VERIFIED: all source files read this session]

The single largest correctness risk is **mapping the UI 1:1 to the decoder's real output shape**. The design mockup (`design/devtools-ui.jsx`) uses *invented* interpretation keys (`uint`/`int`/`sint`/`bool`/`string`/`bytes`/`message`/`float`/`u32`/`u64`/`double`) that do NOT match the decoder's actual `FieldValue`/`LenInterpretation` field names. The real decoder emits a discriminated union keyed on `value.kind` (`"varint" | "i64" | "i32" | "len"`) with specific property names (`asUnsigned`/`asSigned`/`asZigzag`/`asBool` for varint; `interpretations.{hex,string?,message?,packedVarints?,packedFixed32?,packedFixed64?}` for LEN). Plans MUST render off these real keys; the mockup is a *visual* reference (CSS tokens, DOM structure, density), not a data contract. [VERIFIED: decoder.ts + devtools-ui.jsx read this session]

**Primary recommendation:** Build two layout-agnostic React components (`ProtobufDecoder` and `Base64Tool`) co-located with their registry entries, render directly off `decodeMessage()` and `src/lib/bytes.ts` outputs, reuse the existing CSS `@theme` tokens (Tailwind v4 utilities already generated), add `protobufTreeStyle: "cards" | "rows"` to the `Preferences` schema, and gate every plan through the binding harness (simplify → /codex:review → vitest+tsc → real-webview UI) with the 19 decoder tests untouched. No new runtime dependencies — the resizable divider is in-house, decode/encode are zero-dep.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Protobuf input handling (PRO-01)**
- **D-01:** Auto-detect hex vs base64 on paste, with a manual override toggle. Heuristic classifies; decode runs instantly, no decode button. Status bar shows detected encoding; small toggle forces the other interpretation.
- **D-02:** Detection heuristic: treat as **hex** when, after trimming, input is only `[0-9a-fA-F]`, whitespace, optional `0x` prefix, and `:`/`_`/`-` separators **and** has an even nibble count; otherwise **base64**. Empty input = neutral/empty state (not error). Reuse `src/lib/bytes.ts` (`hexToBytes`, `base64ToBytes`) — do not hand-roll byte parsing.
- **D-03:** Ship a small set of one-click example payload chips (mockup `.examples`): canonical `{1:150}`, a nested sub-message, packed varints, and a UTF-8 string LEN. Presentational/local — no persistence, no registry entry.

**Protobuf ambiguity resolution & tree (PRO-03..07)**
- **D-04:** Smart default interpretation per LEN node, pre-selected by precedence **message > string > packed-varints > packed-i32 > packed-i64 > bytes**, choosing the first that `LenInterpretation` actually provides. Override per node by selecting any other available chip. (`bytes`/hex is always the floor.)
- **D-05:** Auto-expand nested sub-messages on paste. Collapse/expand per node still available; only the *default* is expanded. Depth bounded by `MAX_DEPTH`.
- **D-06:** Chips driven directly from the decoder's `LenInterpretation` object — render `message`/`string`/`bytes` **plus** `packed-varints`/`packed-i32`/`packed-i64` exactly when present. Never a hand-curated subset. VARINT nodes additionally surface zigzag (sint) + signed int64 (`asZigzag`/`asSigned`/`asUnsigned`/`asBool`).
- **D-07:** Tree renders as cards by default with a persisted rows/cards toggle (PRO-06). Persist via `usePreferences`/`prefsStore` over `platform.store` — add `protobufTreeStyle` to the `Preferences` schema reserved in Phase 2. Never widen the `Store` seam directly.
- **D-08:** `#N` field numbers render neutral (`--tx`/`--tx-2`, NOT `--accent`), overriding the mockup. Strong accent reserved for selected/active state only (selected chip, active example chip, active toggle). Project-wide "accent = selection only" rule (PRO-07).
- **D-09:** Input and output panes are resizable via a `col-resize` divider (mockup `.divider`).

**Protobuf copy & export (UX-02)**
- **D-10:** Per-node copy + a whole-tree "copy as JSON" action. Every field row/card has a visible, focusable copy button copying that node's *currently-selected* interpretation value; output pane header has "copy all as JSON". Both ≤1 keystroke; **no hover-only copy** (mockup's `copy-btn.is-hover` / `data-copy="hover"` must NOT ship). Copy uses `platform.clipboard`, never `@tauri-apps/*`.
- **D-11:** Copy-as-JSON: pretty-printed JSON, field numbers as keys, each LEN node serialized as its currently-selected interpretation (nested messages recurse as nested objects). A full tree/JSON view-mode switch is DEFERRED — copy-as-JSON covers the export need (keeps PRO-06 to cards/rows only).

**Base64 / Hex / Bytes tool (ENC-01..03)**
- **D-12:** Three stacked full-width panes — text (UTF-8), base64, hex — each independently editable. Editing one re-derives the other two from a single internal `Uint8Array` (source of truth); strings live only at the I/O boundary. Reuse `src/lib/bytes.ts` end to end (it already does the modern-API + polyfill feature detection, ENC-02).
- **D-13:** On invalid input in one field, flag only that field + the status bar; keep the last-good value in the other two. Errors explicit (field error state + status bar names the problem, e.g. "Hex must have an even number of digits"), never silent.
- **D-14:** base64 / base64url alphabet toggle on the base64 pane; re-derives the base64 field via `bytesToBase64(bytes, alphabet)` (ENC-03). Whether the alphabet preference persists is Claude's discretion (default: session-local, not persisted).

**Cross-cutting UX — both tools (UX-01..05)**
- **D-15:** Paste transforms instantly (Cmd+V in primary input → immediate transform, no decode button) for both tools (UX-01).
- **D-16:** Status bar on every tool: parse state · byte count · current encoding · errors · timing (UX-03). Protobuf "current encoding" = detected input encoding; Base64 tool = active alphabet. Timing measures paste→interpretation (< 2s; realistically instant).
- **D-17:** WCAG AA throughout (UX-04): visible focus indicators, AA text contrast, **disabled state never signalled by opacity alone** — mockup's `chip:disabled { opacity:.4 }` must be paired with a non-opacity cue (`aria-disabled`, hidden, or distinct treatment). Phase ends with a passing `gsd-ui-review` WCAG-AA audit.
- **D-18:** Tool components are layout-agnostic (UX-05): responsive Tailwind, no fixed widths; layout chrome stays in the shell. Both tools mount inside `<Outlet/>`, replacing their `makePlaceholder` registry `component`.

### Claude's Discretion
- Exact detection-heuristic edge tuning (D-02), example-payload byte contents and count (D-03), tree node component structure and expand/collapse affordance design, per-node copy button placement, JSON serialization details for non-message interpretations (D-11), Base64 tool pane ordering/spacing and whether the alphabet toggle persists (D-14), status-bar formatting/timing precision, and which lucide icons/labels annotate wire types. All within the locked decisions above and the design tokens in `design/DevTools Mockup.html`.

### Deferred Ideas (OUT OF SCOPE)
- **Full tree/JSON view-mode switch** — only cards/rows ship (PRO-06); JSON need met by "copy as JSON" (D-11).
- **Tool-scoped action palette** ("decode clipboard as protobuf", etc.) — V2-01, deferred.
- **Schema-aware `.proto` decoding** — out of scope; v1 is schema-less only.
- **Persisting the base64 alphabet choice** — session-local by default (D-14).
- **Window-geometry persistence** — Phase 5 (SHL-05 deferred clause).
- The other four tools (Unix Time, JWT, Hash, UUID/ULID) — Phase 4. Native polish — Phase 5. Distribution — Phase 6.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRO-01 | Paste hex/base64 → field tree renders instantly (no decode button) | Detection heuristic (D-02) reuses `bytes.ts`; instant transform via React `onChange`/paste on the input (no submit). `decodeMessage(buf)` is synchronous + fast. |
| PRO-02 | Recursive field tree, wire types 0/1/2/5; groups (3/4) surfaced as errors not crashes | `decodeMessage` already throws a descriptive Error on wire type 3/4 ("groups are not supported") and truncation; UI wraps the call in try/catch and renders the error in the status bar + an error state, never crashes. |
| PRO-03 | LEN chips computed from `LenInterpretation` — message/string/bytes + packed-varints/packed-i32/packed-i64 when present | `value.kind === "len"` → `value.interpretations`; render a chip for each present key (`message`/`string`/`packedVarints`/`packedFixed32`/`packedFixed64`); `hex` is the always-present `bytes` floor. |
| PRO-04 | Resolve ambiguity per node by chip; VARINT shows zigzag + signed int64 | Per-node selected-key state (keyed by a stable node path). VARINT `value.kind==="varint"` exposes `asUnsigned`/`asSigned`/`asZigzag`/`asBool`. |
| PRO-05 | Input/output panes resizable | In-house `col-resize` divider (mockup `.divider`) — pointer-drag updating a grid-template / flex-basis; no library. |
| PRO-06 | Tree renders as cards default, persisted rows/cards toggle | Add `protobufTreeStyle: "cards" \| "rows"` to `Preferences` (default `"cards"`); persist via `usePreferences`. Mockup ships `.tree-cards`/`.tree-rows` CSS. |
| PRO-07 | `#N` neutral; accent reserved for selected/active | D-08: render `.fnum` in `--tx`/`--tx-2`, NOT `--accent`. Already the established Sidebar pattern (accent = active only). |
| ENC-01 | Editing text/base64/hex derives the other two; internal `Uint8Array` | D-12: single `Uint8Array` source of truth; `utf8ToBytes`/`bytesToUtf8`, `bytesToBase64`/`base64ToBytes`, `bytesToHex`/`hexToBytes` all exist in `bytes.ts`. |
| ENC-02 | Modern Uint8Array APIs + feature-detect polyfill; explicit errors | `bytes.ts` ALREADY feature-detects `toBase64`/`fromBase64` natives and falls back to `btoa`/`atob`. `hexToBytes` throws explicit errors. UI surfaces them (D-13). |
| ENC-03 | Alphabet toggle base64 vs base64url | `bytesToBase64(bytes, "base64"\|"base64url")` + `base64ToBytes(input, alphabet)` already accept the `Base64Alphabet` param (D-14). |
| UX-01 | Primary input transforms instantly on paste (Cmd+V) | D-15: controlled input `onChange`/paste handler triggers the transform; no button. |
| UX-02 | Visible focusable copy ≤1 keystroke, no hover-only | D-10: ship the mockup's `always`/`inline` copy variants, NOT `is-hover`. The e2e gate already FAILS on hover-only copy. |
| UX-03 | Status bar: parse · bytes · encoding · errors · timing | D-16: mockup `.statusbar`/`.st-left`/`.st-right` structure; `performance.now()` deltas for timing. |
| UX-04 | WCAG AA: visible focus, AA contrast, no opacity-only disabled | D-17: `focus-visible:ring-2 ring-accent` (Sidebar precedent); pair `chip:disabled` opacity with `aria-disabled` + a non-opacity cue. `gsd-ui-review` gate at phase boundary. |
| UX-05 | Layout-agnostic tool components (no fixed widths, responsive Tailwind) | D-18: components own no fixed widths; resizable split is internal but uses fractional/relative units; shell owns the frame. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These have the same authority as locked decisions. Plans MUST NOT contradict them:

- **HashRouter only** — `BrowserRouter` forbidden. (No router work in this phase; routes derive from registry.)
- **Six tools only** — no additions from the deferred list.
- **Do NOT refactor `decoder.ts` / `bytes.ts` / `types.ts` / `registry.ts`** (port-unchanged bar; the 19 decoder tests are the immovable spec). New tests are added alongside new UI/logic, never by editing the decoder suite.
- **No network at runtime** — no CDN, no new heavy deps; prefer in-house. Decode + encode engines are zero-dep.
- **Tools import `src/lib/platform/`**, never `@tauri-apps/*` directly (clipboard + store via the seam).
- **Registry is the single control plane** — sidebar/palette/router derive from it; Phase 3 only swaps each tool's `component`.
- **Protobuf:** cards default + rows/cards toggle; `#N` numbers neutral (accent = selected only); LEN chips from `LenInterpretation`; no hover-only copy.
- **Tool components layout-agnostic** (responsive Tailwind, no fixed widths) — layout chrome lives in the shell.
- **Do NOT widen the `Store` seam** — the tree-style preference goes through `usePreferences`/`prefsStore`.
- **Binding harness, in order:** `/simplify` → `/codex:review` (`--wait --scope working-tree`) → unit (vitest + `tsc --noEmit`) → real-webview UI verification. Per phase boundary: human sign-off on a fresh `tauri build` + passing `gsd-ui-review` WCAG-AA audit.

## Standard Stack

No new dependencies needed. The phase ships entirely on the existing stack.

### Core (already installed — VERIFIED in package.json this session)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.1.0 | Tool components, hooks | Already the project's UI runtime [VERIFIED: package.json] |
| react-dom | ^19.1.0 | DOM renderer | — [VERIFIED: package.json] |
| react-router-dom | 7.16.0 | Routing (HashRouter via registry) | No router work this phase; tools mount in `<Outlet/>` [VERIFIED: package.json] |
| lucide-react | 1.17.0 | Icons (copy, chevron, wire-type annotations) | Already used by Sidebar/registry icons [VERIFIED: package.json] |
| tailwindcss / @tailwindcss/vite | 4.3.0 | CSS-first styling; `@theme` tokens already define all design vars | CSS-first config, NO tailwind.config.js [VERIFIED: src/index.css] |

### Supporting (existing internal modules — the real "stack" for this phase)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `src/lib/protobuf/decoder.ts` | `decodeMessage(buf): DecodedField[]`; types `DecodedField`/`FieldValue`/`WireType`/`LenInterpretation`/`PackedVarint`/`PackedFixed32`/`PackedFixed64`; `MAX_DEPTH`/`MAX_PAYLOAD_BYTES` | The protobuf tool renders DIRECTLY off this. Port-unchanged. [VERIFIED] |
| `src/lib/bytes.ts` | `bytesToBase64`/`base64ToBytes` (`Base64Alphabet` param + feature-detect), `bytesToHex`/`hexToBytes`, `utf8ToBytes`/`bytesToUtf8` | Both tools route ALL byte conversions through here. Port-unchanged. [VERIFIED] |
| `src/shell/usePreferences.ts` + `preferences.ts` + `prefsStore.ts` | Typed `Preferences` over `platform.store`; `update(patch)` write-on-change | Add `protobufTreeStyle` here + a setter; never touch `platform.store` directly. [VERIFIED] |
| `src/lib/platform/index.ts` (`platform.clipboard`) | `writeText(text)` / `readText()` | All copy affordances (D-10). Tauri impl lazy-loaded; browser fallback in tests. [VERIFIED] |
| `src/lib/tools/registry.ts` + each `index.ts` | Swap `component` from `makePlaceholder(...)` to the real component | The single integration line per tool. registry.ts stays port-unchanged; edit `src/tools/<id>/index.ts`. [VERIFIED] |

### Alternatives Considered (and rejected)
| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| In-house resizable divider | `react-resizable-panels`, `re-resizable`, `allotment` | New runtime dep; "no new heavy deps / prefer in-house" (CLAUDE.md). A pointer-drag updating a CSS grid column is ~30 lines. [CITED: CLAUDE.md] |
| `protobufjs` / `protobuf-es` for decoding | — | The schema-less decoder ALREADY exists and is the hero spec (19 tests). Schema-aware decode is explicitly out of scope. [CITED: REQUIREMENTS Out of Scope] |
| A base64/hex library (e.g. `js-base64`) | — | `bytes.ts` already does modern-API-with-polyfill and alphabet support. [VERIFIED: bytes.ts] |

**Installation:** None. `npm install` is a no-op for this phase.

## Architecture Patterns

### Recommended Project Structure
```
src/tools/protobuf-decoder/
├── index.ts                 # EXISTING — swap `component: makePlaceholder(...)` → the real component
├── ProtobufDecoder.tsx      # NEW — tool root: input pane + divider + decoded pane + status bar
├── useDecode.ts             # NEW — input string → {bytes, encoding, fields|error, timingMs}; reuses bytes.ts + decoder.ts
├── detectEncoding.ts        # NEW — D-02 heuristic (hex vs base64); pure, unit-tested
├── FieldTree.tsx            # NEW — recursive DecodedField[] renderer (cards/rows), auto-expand (D-05)
├── FieldNode.tsx            # NEW — single field: head (#N neutral, wire, bytes, copy) + chips + value/submsg
├── interpretationChips.ts   # NEW — pure: DecodedField → ordered chip descriptors from real keys (D-04/D-06)
├── copyAsJson.ts            # NEW — pure: fields + selection map → pretty JSON string (D-11)
├── ResizableSplit.tsx       # NEW — in-house col-resize two-pane divider (D-09); reusable
└── *.test.ts(x)             # NEW TDD cases (NOT touching decoder.test.ts)

src/tools/base64/
├── index.ts                 # EXISTING — swap `component` → the real component
├── Base64Tool.tsx           # NEW — three stacked panes + alphabet toggle + status bar
├── useBytesConvert.ts       # NEW — single Uint8Array source of truth; derive on edit (D-12/D-13)
└── *.test.ts(x)             # NEW TDD cases
```
*Rationale:* keep **pure logic** (heuristic, chip derivation, JSON serialization, byte conversion orchestration) in standalone modules so it is unit-testable in node (the bulk of TDD), and keep React components thin so the real-webview gate covers what jsdom cannot. [ASSUMED — structure is a recommendation; planner may adjust]

### Pattern 1: Render the field tree off the REAL decoder shape (CRITICAL)
**What:** The chips and values come from `DecodedField.value`, a discriminated union on `.kind`. Do NOT use the mockup's invented keys.
**The actual contract** [VERIFIED: decoder.ts read this session]:
```typescript
// decodeMessage(buf: Uint8Array): DecodedField[]   (throws on invalid input)
interface DecodedField { fieldNumber: number; wireType: 0|1|2|5; value: FieldValue; }

type FieldValue =
  | { kind: "varint"; asUnsigned: string; asSigned: string; asZigzag: string; asBool: boolean }
  | { kind: "i64";    hex: string; asUint64: string; asInt64: string; asDouble: number }
  | { kind: "i32";    hex: string; asUint32: number; asInt32: number; asFloat: number }
  | { kind: "len";    byteLength: number; interpretations: LenInterpretation };

interface LenInterpretation {
  hex: string;                       // ALWAYS present — the `bytes` floor
  string?: string;                   // present iff valid UTF-8
  message?: DecodedField[];          // present iff parses as a clean non-empty sub-message
  packedVarints?: PackedVarint[];    // present iff cleanly a varint stream
  packedFixed32?: PackedFixed32[];   // present iff length is a positive multiple of 4
  packedFixed64?: PackedFixed64[];   // present iff length is a positive multiple of 8
}
// PackedVarint { asUnsigned, asSigned, asZigzag }  (strings)
// PackedFixed32 { hex, asUint32, asInt32, asFloat } / PackedFixed64 { hex, asUint64, asInt64, asDouble }
```
**Chip generation per node (D-04/D-06):**
- `varint`: chips `uint64 (asUnsigned)`, `int64 (asSigned)`, `sint (asZigzag)`, `bool (asBool)` — all always present.
- `i64`: `double (asDouble)`, `uint64 (asUint64)`, `int64 (asInt64)`, `hex` — all present.
- `i32`: `float (asFloat)`, `uint32 (asUint32)`, `int32 (asInt32)`, `hex` — all present.
- `len`: emit a chip ONLY for each present `interpretations` key, ordered by D-04 precedence: `message` → `string` → `packedVarints` → `packedFixed32` → `packedFixed64` → `bytes (hex)`. `bytes/hex` is the always-present floor. Default-select the first present per precedence.

### Pattern 2: Per-node selection state by stable path
**What:** Each LEN node's chosen interpretation is user-overridable. Keep a `Map<string, string>` (or object) keyed by a **stable node path** (e.g. `"0.3.0"` = field index path), not by array identity, so re-decodes on every keystroke don't lose selections and so nested nodes are addressable for copy/JSON.
**When:** the recursive tree + the copy-as-JSON serializer both consume it. Reset/prune the map when the input changes structurally. [ASSUMED — path scheme is a recommendation]

### Pattern 3: Single-Uint8Array bidirectional derive (Base64 tool, D-12/D-13)
**What:** One `Uint8Array` is the source of truth. Editing a field parses ITS string → bytes (via `bytes.ts`), then re-derives the OTHER two from the new bytes. On parse failure, set that field's error + status bar, and DO NOT touch the bytes or the other two fields (keep last-good).
**Example:**
```typescript
// Source: derived from src/lib/bytes.ts signatures [VERIFIED]
function onEditHex(input: string) {
  try {
    const bytes = hexToBytes(input);            // throws "Hex must have an even number of digits" / "Invalid hex characters"
    setBytes(bytes);
    setText(bytesToUtf8(bytes));                // lossy display is fine; bytes stay canonical
    setBase64(bytesToBase64(bytes, alphabet));
    clearError("hex");
  } catch (e) {
    setError("hex", (e as Error).message);      // explicit; other two keep last-good
  }
}
```
Switching the alphabet toggle re-derives only the base64 field from the current bytes: `setBase64(bytesToBase64(bytes, nextAlphabet))`. [VERIFIED: bytes.ts]

### Pattern 4: Preference extension (D-07) — single edit, no Store widening
**What:** Add one field + one setter; the merge accepts only known fields.
```typescript
// src/shell/preferences.ts  [VERIFIED current shape]
export type ProtobufTreeStyle = "cards" | "rows";
export interface Preferences {
  theme: ThemeName; accent: string; lastUsedId: string | null; recentToolIds: string[];
  protobufTreeStyle: ProtobufTreeStyle;            // NEW
}
export const DEFAULT_PREFERENCES: Preferences = { /* …existing… */, protobufTreeStyle: "cards" };

// src/shell/prefsStore.ts — add a coercer + include it in mergePreferences()
function coerceTreeStyle(v: unknown): ProtobufTreeStyle { return v === "rows" ? "rows" : "cards"; }
// mergePreferences(): protobufTreeStyle: coerceTreeStyle(blob.protobufTreeStyle)

// src/shell/usePreferences.ts — add: setTreeStyle = (s) => update({ protobufTreeStyle: s })
```
*Note:* the schema comment in `preferences.ts` and `prefsStore.ts` EXPLICITLY anticipates this exact addition. [VERIFIED: comments read this session]

### Pattern 5: Component + test conventions (match Phase 2)
- Component test files carry `// @vitest-environment jsdom` (default env is `node`) and import `{ describe, it, expect }` explicitly (`globals: false`). [VERIFIED: vitest config + CommandPalette.test.tsx]
- Use `@testing-library/react` (`render`, `fireEvent`, `waitFor`, `cleanup` in `afterEach`). [VERIFIED]
- For anything touching the platform seam, use `setPlatformForTest(makeMemoryPlatform(store))` + `resetPlatformForTest()` and `createStoreStub()` (from `@/shell/testStore` + `@/lib/platform`). [VERIFIED: CommandPalette.test.tsx]
- Path alias `@/` → `src/` resolves in app, build, AND test (vite config). [VERIFIED]

### Anti-Patterns to Avoid
- **Using the mockup's `interps` keys as a data contract** — they are invented (`uint`/`u32`/`sint`/…). Map to the real `FieldValue` keys. [VERIFIED]
- **Shipping `copy-btn.is-hover` / `data-copy="hover"`** — forbidden (D-10); the e2e gate FAILS on hover-only copy. Ship `always`/`inline` only. [VERIFIED: e2e-spike.sh comment + STATE.md]
- **`#N` in accent** — the mockup uses `--accent` for `.fnum`; D-08 overrides to neutral. [VERIFIED: mockup line 193]
- **`opacity:.4`-only disabled chips** — pair with `aria-disabled` / distinct treatment (D-17/UX-04). [VERIFIED: mockup line 208]
- **Editing `decoder.ts`/`bytes.ts`/`types.ts`/`registry.ts`** — port-unchanged bar. [CITED: CLAUDE.md]
- **Reading/writing `platform.store` for the tree style directly** — go through `usePreferences`. [CITED: CLAUDE.md]
- **A decode button** — paste is instant (D-15/PRO-01). `decodeMessage` is synchronous and fast.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hex ⇄ bytes | Custom hex parser in the tool | `hexToBytes`/`bytesToHex` from `bytes.ts` | Already handles `0x` prefix, `:`/`_`/`-`/whitespace separators, odd-length + invalid-char errors [VERIFIED] |
| base64 ⇄ bytes (+ url) | `btoa`/`atob` glue | `base64ToBytes`/`bytesToBase64` | Already feature-detects native `fromBase64`/`toBase64` (Safari 18.2+) with btoa/atob polyfill + alphabet handling [VERIFIED] |
| UTF-8 ⇄ bytes | Manual `TextEncoder` calls | `utf8ToBytes`/`bytesToUtf8` | Single source; consistent fatal/non-fatal handling [VERIFIED] |
| Protobuf wire walking | Any decode logic in the UI | `decodeMessage(buf)` | The hero spec; 19 tests; depth/size hardening; all interpretations precomputed [VERIFIED] |
| Preference persistence | `platform.store.get/set` in the tool | `usePreferences` + schema field | Keeps the schema in one place, untrusted-merge protection, no Store widening [VERIFIED] |
| Resizable split | A new npm panel library | ~30-line in-house `col-resize` divider | No new runtime dep; no-network constraint; the mockup's `.divider` is purely presentational [CITED: CLAUDE.md] |

**Key insight:** The entire byte/decode substrate is done and tested. Every line of "logic" the planner is tempted to write in a tool component should first be checked against `bytes.ts` / `decoder.ts` — it almost certainly already exists. The new code is *presentation, selection state, and orchestration* only.

## Common Pitfalls

### Pitfall 1: Mapping the tree UI to the mockup's data instead of the decoder's
**What goes wrong:** Chips show `uint`/`u32`/`sint`/`message`; code references `f.interps`/`it.k`/`it.v` and `f.children`.
**Why it happens:** `design/devtools-ui.jsx` is a self-contained mock with hand-authored sample data whose shape diverges from `decoder.ts`.
**How to avoid:** Treat the mockup as *visual/structural* reference only. Derive chips and values from `value.kind` + `LenInterpretation` keys. Sub-messages are `value.interpretations.message` (a `DecodedField[]`), not `f.children`.
**Warning signs:** Code importing nothing from `@/lib/protobuf/decoder`; chip labels hard-coded as a fixed array.

### Pitfall 2: Re-decode on every keystroke loses per-node selections / expansion
**What goes wrong:** Selecting "string" on a node, typing one more hex byte, re-decode produces fresh objects and the selection/expansion resets.
**Why it happens:** Selection keyed by object identity rather than a stable path.
**How to avoid:** Key selection + expansion state by a stable structural path (field-index path). Prune entries that no longer exist after a re-decode.
**Warning signs:** Flicker of selected chip / collapse on typing.

### Pitfall 3: Treating `decodeMessage` errors as crashes
**What goes wrong:** Groups (wire 3/4), truncated varints, oversize payloads throw; an unguarded call white-screens the tool.
**Why it happens:** `decodeMessage` throws (by design) rather than returning a partial tree.
**How to avoid:** Wrap in try/catch; render `(e as Error).message` in the status bar + an inline error state; keep the input editable. Empty input = neutral state, not an error (D-02).
**Warning signs:** No try/catch around `decodeMessage`; pasting `1c` (group) blanks the pane.

### Pitfall 4: `bytesToUtf8` of arbitrary bytes mangles the text field
**What goes wrong:** Non-UTF-8 bytes round-trip lossily through the text pane, corrupting the canonical bytes if text is treated as source after a hex/base64 edit.
**Why it happens:** The text pane shows a lossy view of arbitrary bytes.
**How to avoid:** Bytes are the source of truth (D-12). Only re-derive bytes FROM the field the user actually edited; never re-derive bytes from the text pane unless the text pane was the edited field. Default `bytesToUtf8` to non-fatal for *display*.
**Warning signs:** Hex edit changes, text shows replacement chars, then a later unrelated action re-encodes from that text.

### Pitfall 5: Persisting prefs per-render instead of on-change
**What goes wrong:** Writing the tree style to the store on every render thrashes disk and can race the async mount-load.
**Why it happens:** Calling the setter in render rather than in an event handler.
**How to avoid:** Follow the existing `usePreferences.update` pattern — set state AND persist only inside the toggle handler (write-on-change). The hook already guards the mount-load clobber via `dirtyRef`/`prefsLoaded`. [VERIFIED: usePreferences.ts]
**Warning signs:** `setTreeStyle` called outside an event handler.

### Pitfall 6: Store split-brain in the packaged app (known project memory)
**What goes wrong:** A pref read firing before `initPlatform()` resolves hits localStorage, while writes hit `prefs.json` — the tree style doesn't restore in the packaged `.app`. Invisible to unit tests.
**Why it happens:** Async store init race (documented in project MEMORY).
**How to avoid:** Read the tree style through `usePreferences` (which already `await initPlatform()` via `prefsStore`); verify persistence on the REAL WKWebView (`tauri dev`), not just jsdom. [VERIFIED: MEMORY.md tauri-store-async-init-race]
**Warning signs:** Tree style persists in `vite preview` but not in `tauri build`.

### Pitfall 7: Fixed widths break UX-05 + the resizable split
**What goes wrong:** A tool component hard-codes a width; layout chrome leaks out of the shell.
**How to avoid:** Use fractional/relative units (grid `1fr 7px 1.05fr` per mockup `.workspace`), `min-w-0`, responsive Tailwind. The shell's `<main>` already provides the frame (`flex-1 min-w-0 overflow-auto`). [VERIFIED: App.tsx + mockup line 149]

## Code Examples

### Detection heuristic (D-02) — pure, unit-testable
```typescript
// detectEncoding.ts — classify pasted protobuf input. Reuses bytes.ts for the
// actual conversion; this only picks which converter to call.
export type InputEncoding = "hex" | "base64";

export function detectEncoding(raw: string): InputEncoding {
  const trimmed = raw.trim().replace(/^0x/i, "");
  const hexBody = trimmed.replace(/[\s:_-]/g, "");
  const looksHex = hexBody.length > 0
    && /^[0-9a-fA-F]+$/.test(hexBody)
    && hexBody.length % 2 === 0;
  return looksHex ? "hex" : "base64";
}
// Caller (with manual override toggle, D-01):
//   const enc = override ?? detectEncoding(raw);
//   const bytes = enc === "hex" ? hexToBytes(raw) : base64ToBytes(raw);
```

### Status-bar timing (D-16/UX-03)
```typescript
// Source: derived from decoder.ts + Web performance API
const t0 = performance.now();
let result: { fields?: DecodedField[]; error?: string };
try { result = { fields: decodeMessage(bytes) }; }
catch (e) { result = { error: (e as Error).message }; }
const timingMs = performance.now() - t0;   // realistically << 2s; surface in status bar
```

### Copy-as-JSON shape (D-11)
```typescript
// copyAsJson.ts — field numbers as keys; each node = its SELECTED interpretation.
// message → nested object (recurse); scalar → the selected reading; len/bytes → hex string.
// Use platform.clipboard.writeText(JSON.stringify(obj, null, 2)) — NOT @tauri-apps/*.
```

### Wire-type 0/1/2/5 + group error (PRO-02) — already enforced by the engine
```typescript
// decoder.ts already throws on groups: "Unsupported wire type 3 (field N); groups are not supported"
// The UI only needs to catch + display — no group handling logic in the tool.
```

## Runtime State Inventory

> This is a greenfield UI phase (new components + one new pref field), not a rename/refactor/migration. No existing stored data, OS-registered state, or build artifacts are renamed or invalidated.
- **Stored data:** New pref key `protobufTreeStyle` is additive; existing `shell.preferences` blobs without it merge to the `"cards"` default via `coerceTreeStyle` (untrusted-merge already drops/defaults unknown shapes). No migration needed. [VERIFIED: prefsStore merge pattern]
- **Live service config / OS-registered state / secrets:** None — no external services, schedulers, or secrets touched.
- **Build artifacts:** None invalidated. Swapping a registry `component` is a source change picked up by the normal build.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `btoa`/`atob` + manual char loops for base64 | Native `Uint8Array.prototype.toBase64` / `Uint8Array.fromBase64` | Landed Chrome 140 / Firefox 133 / Safari 18.2 (2025) | `bytes.ts` already feature-detects the native and polyfills older WKWebViews — DO NOT remove the polyfill; macOS WKWebViews older than Safari 18.2 still need it [VERIFIED: WebSearch MDN + bytes.ts] |

**Deprecated/outdated:**
- The mockup's CDN font links (Google Fonts) and `data-copy="hover"` variant are deliberately NOT carried over (fonts vendored via @fontsource; hover-copy forbidden). [VERIFIED: index.css + D-10]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended file/module split (pure logic vs thin components) | Architecture Patterns | Low — planner may restructure; doesn't affect correctness |
| A2 | Stable-path keying scheme (`"0.3.0"`) for per-node selection/expansion | Pattern 2 | Low — any stable structural key works; just must not be object identity |
| A3 | base64 alphabet toggle defaults to session-local (not persisted) | D-14 | None — explicitly Claude's discretion in CONTEXT |
| A4 | `bytesToUtf8` non-fatal for display is acceptable for the text pane | Pitfall 4 | Medium — if product wants to FLAG non-UTF-8 in the text pane, that's an extra error state; confirm with planner |

**Note:** All decoder/bytes/preferences/platform/registry API shapes and the mockup CSS/DOM are `[VERIFIED]` by direct source reads this session — not assumed.

## Open Questions

1. **Should the text pane in the Base64 tool flag non-UTF-8 bytes, or silently show a lossy decode?**
   - What we know: D-13 wants explicit errors per field; `bytesToUtf8(bytes, fatal=true)` can throw on invalid UTF-8.
   - What's unclear: whether arbitrary bytes (valid hex/base64 but not valid UTF-8) should mark the *text* field as "not valid UTF-8" or just render replacement chars.
   - Recommendation: treat the text pane as a best-effort lossy *view* of arbitrary bytes (non-fatal), but show a subtle "not valid UTF-8" note in the status bar when `bytesToUtf8(bytes, true)` would throw — keeps bytes canonical without a blocking error. Planner/discuss to confirm.

2. **Copy-as-JSON serialization for non-message LEN nodes selected as packed/bytes (D-11 detail).**
   - What we know: message → nested object; scalar → selected reading; the exact JSON value for a node currently showing `packedVarints` or `bytes` is Claude's discretion.
   - Recommendation: packed → JSON array of the selected reading; bytes → hex string; string → the string. Document the chosen mapping in the plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node toolchain / vitest | Unit gate | ✓ | vitest 4.1.7 | — [VERIFIED: package.json] |
| tsc | Type gate | ✓ | typescript ~5.8.3 | — [VERIFIED] |
| `tauri dev` + WebDriver gate (`scripts/e2e-spike.sh`) | Real-webview UI verification (per-task gate) | ✓ | macOS WKWebView, port 4445 | `screencapture`+chrome-devtools-mcp (HRN-02) | [VERIFIED: STATE.md, e2e-spike.sh] |
| `tauri build` | Phase-boundary sign-off | ✓ | proven in Phase 1 | — [VERIFIED: STATE.md HRN-04] |
| Native `Uint8Array.toBase64`/`fromBase64` | ENC-02 fast path | conditional | Safari 18.2+ WKWebView | btoa/atob polyfill in `bytes.ts` (already present) | [VERIFIED: WebSearch + bytes.ts] |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Native base64 Uint8Array methods on pre-Safari-18.2 WKWebViews — `bytes.ts` already polyfills, so this is transparent.

## Validation Architecture

> `workflow.nyquist_validation: true` (config.json) — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 + @testing-library/react 16.3.2 [VERIFIED] |
| Config file | `vite.config.ts` (`test:` block; env `node`, `globals:false`, excludes `scaffold/**`) [VERIFIED] |
| Quick run command | `npx vitest run <path>` (or `npm test -- <path>`) |
| Full suite command | `npm test` (`vitest run`) + `npx tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRO-01/D-02 | hex/base64 detection heuristic correctness (incl. `0x`, separators, empty, ambiguous) | unit (node) | `npx vitest run src/tools/protobuf-decoder/detectEncoding.test.ts` | ❌ Wave 0 |
| PRO-03/PRO-04/D-04/D-06 | chip set + default selection derived from real `LenInterpretation`/`FieldValue` keys, precedence order | unit (node) | `npx vitest run src/tools/protobuf-decoder/interpretationChips.test.ts` | ❌ Wave 0 |
| PRO-02 | groups (3/4) + truncation surface as error string, not throw past the boundary | unit (node) | `npx vitest run src/tools/protobuf-decoder/useDecode.test.ts` | ❌ Wave 0 |
| PRO-06/D-07 | `protobufTreeStyle` round-trips through prefs (default cards; rows persists; corrupt → cards) | unit (jsdom) | `npx vitest run src/shell/prefsStore.test.ts src/shell/usePreferences.test.ts` | ⚠️ extend existing |
| PRO-04/D-05 | recursive tree renders arbitrary depth; sub-messages auto-expanded; #N neutral; selection by chip | component (jsdom) | `npx vitest run src/tools/protobuf-decoder/FieldTree.test.tsx` | ❌ Wave 0 |
| D-11 | copy-as-JSON shape (field numbers as keys, selected interpretation, nested recurse) | unit (node) | `npx vitest run src/tools/protobuf-decoder/copyAsJson.test.ts` | ❌ Wave 0 |
| ENC-01/ENC-03/D-12/D-14 | edit-one-derives-two via single Uint8Array; alphabet toggle re-derives base64 | unit (node) | `npx vitest run src/tools/base64/useBytesConvert.test.ts` | ❌ Wave 0 |
| ENC-02/D-13 | explicit per-field errors (odd hex, invalid chars); other two keep last-good | unit (node) | `npx vitest run src/tools/base64/useBytesConvert.test.ts` | ❌ Wave 0 |
| UX-01 | paste triggers instant transform (no button) | component (jsdom) | `npx vitest run src/tools/.../*.test.tsx` | ❌ Wave 0 |
| UX-02 | visible focusable copy button present; NO hover-only variant in DOM | component (jsdom) + real-webview | `npx vitest run` + `bash scripts/e2e-spike.sh` | ⚠️ e2e exists; extend spec |
| UX-03 | status bar renders parse·bytes·encoding·errors·timing | component (jsdom) | `npx vitest run src/tools/.../StatusBar.test.tsx` | ❌ Wave 0 |
| UX-04 | visible focus ring; chip disabled has non-opacity cue (`aria-disabled`) | component (jsdom) + `gsd-ui-review` | `npx vitest run` + phase-boundary audit | ⚠️ audit at boundary |
| (immovable) | decoder behavior unchanged | unit (node) | `npx vitest run src/lib/protobuf/decoder.test.ts` (19 green) | ✅ exists — MUST stay green |

*Manual-only / real-webview-only:* paste behavior fidelity, copy actually reaching the OS clipboard, resizable drag feel, AA contrast against the dark palette, and packaged-app pref persistence (Pitfall 6) — covered by the per-task real-webview gate (`scripts/e2e-spike.sh`) and the phase-boundary `gsd-ui-review` + `tauri build` sign-off.

### Sampling Rate
- **Per task commit:** `npx vitest run <changed test files>` + `npx tsc --noEmit` (lefthook pre-commit blocks a red suite).
- **Per wave merge:** `npm test` (full vitest) + `tsc --noEmit` + `eslint .`.
- **Phase gate:** Full suite green (decoder 19 included) → real-webview UI verify per task → `tauri build` + `gsd-ui-review` WCAG-AA at the boundary.

### Wave 0 Gaps
- [ ] `src/tools/protobuf-decoder/detectEncoding.test.ts` — PRO-01/D-02
- [ ] `src/tools/protobuf-decoder/interpretationChips.test.ts` — PRO-03/04/D-04/D-06
- [ ] `src/tools/protobuf-decoder/useDecode.test.ts` — PRO-02 error handling
- [ ] `src/tools/protobuf-decoder/copyAsJson.test.ts` — D-11
- [ ] `src/tools/protobuf-decoder/FieldTree.test.tsx` + `FieldNode.test.tsx` — PRO-04/05/07, UX-03/04 (jsdom)
- [ ] `src/tools/base64/useBytesConvert.test.ts` — ENC-01/02/03, D-13
- [ ] Extend `src/shell/prefsStore.test.ts` + `usePreferences.test.ts` for `protobufTreeStyle`
- [ ] Extend the e2e spec / `scripts/e2e-spike.sh` assertions for the two real tools (focusable copy present, instant paste)
- Framework install: none — vitest + testing-library already configured.

## Security Domain

> No explicit `security_enforcement: false` in config.json — treated as enabled. This phase processes UNTRUSTED pasted bytes and an untrusted persisted pref.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Offline desktop app, no accounts |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Local-only |
| V5 Input Validation | **yes** | Pasted blob is untrusted: `decodeMessage` already hardens with `MAX_PAYLOAD_BYTES` (16 MiB) + `MAX_DEPTH` (64) + throws on malformed input; `hexToBytes` validates length/charset. UI must catch + display, never crash. Persisted `protobufTreeStyle` is untrusted → coerced by `mergePreferences`. [VERIFIED] |
| V6 Cryptography | no | No crypto in this phase (Hash tool is Phase 4) |

### Known Threat Patterns for {React UI over untrusted bytes}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| DoS-by-paste (huge/deeply-nested payload) | Denial of Service | `MAX_PAYLOAD_BYTES` + `MAX_DEPTH` already enforced in `decodeMessage`; UI shows the thrown error, stays responsive [VERIFIED] |
| Hand-edited `prefs.json` injecting a bad tree style | Tampering | `coerceTreeStyle` in `mergePreferences` accepts only `"cards"`/`"rows"`, defaults otherwise (untrusted-merge pattern from Phase 2) [VERIFIED] |
| XSS via rendered decoded strings | Tampering/Injection | React escapes text content by default; render decoded strings as text nodes (never `dangerouslySetInnerHTML`) [ASSUMED — standard React] |
| Clipboard reaching `@tauri-apps/*` directly (capability bypass) | Elevation of Privilege | All copy via `platform.clipboard`; only `tauri.ts` imports `@tauri-apps/*` (grep-verified in prior phases) [VERIFIED: platform seam] |

## Sources

### Primary (HIGH confidence — read directly this session)
- `src/lib/protobuf/decoder.ts` — `decodeMessage`, `FieldValue`/`LenInterpretation`/`PackedVarint`/`PackedFixed32`/`PackedFixed64` shapes, `MAX_DEPTH`/`MAX_PAYLOAD_BYTES`, group/truncation error throwing
- `src/lib/bytes.ts` — `bytesToBase64`/`base64ToBytes` (alphabet + feature-detect/polyfill), `bytesToHex`/`hexToBytes` (explicit errors), `utf8ToBytes`/`bytesToUtf8`
- `src/shell/preferences.ts` / `prefsStore.ts` / `usePreferences.ts` — `Preferences` schema (extension point), untrusted-merge, write-on-change + `dirtyRef`/`prefsLoaded` guards
- `src/lib/platform/index.ts` / `browser.ts` / `stub.ts` — `platform.clipboard` + `Store` seam, `setPlatformForTest`/`resetPlatformForTest`
- `src/tools/protobuf-decoder/index.ts`, `src/tools/base64/index.ts`, `src/lib/tools/registry.ts`, `types.ts` — `makePlaceholder` swap point, `ToolDefinition`
- `design/DevTools Mockup.html` + `design/devtools-ui.jsx` — tree/chip/divider/examples/json CSS tokens + DOM structure (and the invented-keys caveat)
- `src/index.css` — `@theme` tokens (all design vars already generated as Tailwind utilities)
- `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/CommandPalette.test.tsx` — shell `<Outlet/>` frame, focus-visible/accent precedent, test conventions
- `.planning/config.json` — nyquist_validation true, code_review standard
- Project `MEMORY.md` — tauri store async-init race (Pitfall 6)

### Secondary (MEDIUM confidence — verified with official source)
- [MDN: Uint8Array.prototype.toBase64](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64) — native base64 method availability
- [MDN: Uint8Array.fromBase64](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/fromBase64)
- [web.dev: New to the web platform](https://web.dev/blog/web-platform-11-2024) — Chrome 140 / Firefox 133 / Safari 18.2 (2025) baseline for the native methods → confirms `bytes.ts` polyfill is still required for older WKWebViews

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all modules read directly
- Architecture (data contract, derive pattern, prefs extension): HIGH — decoder/bytes/prefs shapes verified by source read
- Pitfalls: HIGH — drawn from the actual code + project MEMORY + STATE.md (prior bugs)
- Native base64 baseline: MEDIUM — MDN/web.dev; polyfill presence makes it non-blocking regardless

**Research date:** 2026-05-31
**Valid until:** ~2026-06-30 (stable; internal APIs are port-unchanged for the phase, so effectively pinned)
