# Phase 3: Hero (Protobuf) + Encoding + UX Constraints - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the **real schema-less Protobuf decoder UI** and the **Base64/Hex/Bytes tool** into the shell's routed `<Outlet/>` (replacing the Phase-2 placeholders), with the binding cross-cutting UX constraints applied to both. This proves the riskiest path — the hero feature and its ambiguity/workflow constraints — immediately after the shell.

**In scope:** PRO-01..07 (paste→instant wire-format tree, wire types 0/1/2/5, groups 3/4 as errors not crashes, LEN chips from `LenInterpretation`, per-node ambiguity resolution, resizable panes, cards default + persisted rows/cards toggle, neutral `#N`), ENC-01..03 (text/base64/hex derive each other via internal `Uint8Array`, modern APIs + feature-detect polyfill, explicit encoding errors, base64/base64url toggle), UX-01..05 (paste-instant, visible focusable copy ≤1 keystroke / no hover-only, status bar parse·bytes·encoding·errors·timing, WCAG AA, layout-agnostic responsive tool components).

**Out of scope:** The other four tools (Unix Time, JWT, Hash, UUID/ULID → Phase 4). Native polish — global summon shortcut, tray, single-instance, window-geometry persistence (Phase 5, incl. SHL-05's deferred clause). Distribution/signing (Phase 6). Tool-scoped action palette (V2-01). Schema-aware `.proto` decoding (out of scope, v1 is schema-less only). **No edits to `decoder.ts`, `bytes.ts`, or `types.ts`** — the hero's logic and the encoding engine already exist and are the immovable test bar.
</domain>

<decisions>
## Implementation Decisions

### Protobuf input handling (PRO-01)
- **D-01:** **Auto-detect hex vs base64 on paste, with a manual override toggle.** A heuristic classifies the pasted string; the decode runs instantly with no decode button. The status bar shows which encoding was detected, and a small toggle lets the user force the other interpretation when a blob is valid as both.
- **D-02:** **Detection heuristic:** treat input as **hex** when, after trimming, it consists only of `[0-9a-fA-F]`, whitespace, an optional `0x` prefix, and `:`/`_`/`-` separators **and** has an even nibble count; otherwise treat it as **base64** (decoded via `base64ToBytes`). The empty input is the neutral/empty state, not an error. Reuse `src/lib/bytes.ts` (`hexToBytes`, `base64ToBytes`) for the actual conversion — do not hand-roll byte parsing in the tool.
- **D-03:** **Ship a small set of one-click example payload chips** in the input pane (the mockup's `.examples` chips): canonical `{1:150}`, a nested sub-message, packed varints, and a UTF-8 string LEN. They demonstrate the interpretation model on first open. Example chips are presentational/local — no persistence, no registry entry.

### Protobuf ambiguity resolution & tree (PRO-03, PRO-04, PRO-05, PRO-06, PRO-07)
- **D-04:** **Smart default interpretation per LEN node**, pre-selected by precedence **message > string > packed-varints > packed-i32 > packed-i64 > bytes**, choosing the first that `LenInterpretation` actually provides for that node. The user can override per node by selecting any other available chip. (`bytes`/hex is always present as the floor.)
- **D-05:** **Auto-expand nested sub-messages on paste** so the payload's structure is visible immediately — the hero's whole point is explorability at a glance. (Collapse/expand controls still available per node; only the *default* is expanded.) Depth is naturally bounded by the decoder's `MAX_DEPTH`.
- **D-06:** **Chips are driven directly from the decoder's `LenInterpretation` object** — render `message` / `string` / `bytes` **plus** `packed-varints` / `packed-i32` / `packed-i64` exactly when those keys are present (structurally valid). Never a hand-curated subset. VARINT nodes additionally surface their **zigzag (sint)** and **signed int64** readings (the decoder's `asZigzag`/`asSigned`/`asUnsigned`/`asBool`).
- **D-07:** **Tree renders as cards by default with a persisted rows/cards toggle** (PRO-06). The format value persists via the existing preferences seam (`usePreferences` / `prefsStore` over `platform.store`) — add a `protobufTreeStyle` key to the `Preferences` schema reserved in Phase 2 (D-08/Phase-2). Never widen the `Store` seam directly.
- **D-08:** **`#N` field numbers render neutral** (`--tx`/`--tx-2`, NOT `--accent`), overriding the mockup which shows them in accent blue. Strong accent (`--accent` / `--accent-soft` / `--accent-line`) is reserved for the **selected/active** state only — selected interpretation chip, active example chip, active toggle. This is the project-wide "accent = selection only" rule (PRO-07, UX spec §9).
- **D-09:** **Input and output panes are resizable** via a `col-resize` divider (mockup `.divider`), since protobuf payloads vary from short to deeply nested.

### Protobuf copy & export (UX-02)
- **D-10:** **Per-node copy + a whole-tree "copy as JSON" action.** Every field row/card has a visible, focusable copy button that copies that node's *currently-selected* interpretation value; the output pane header has a "copy all as JSON" affordance. Both reachable in ≤1 keystroke; **no hover-only copy** (the mockup's `copy-btn.is-hover` / `data-copy="hover"` variant must NOT ship).
- **D-11:** **Copy-as-JSON format:** pretty-printed JSON, field numbers as keys, each LEN node serialized as its currently-selected interpretation (nested messages recurse as nested objects). A full tree/JSON **view-mode switch is deferred** — the copy-as-JSON action covers the export need without adding a third view mode beyond cards/rows (keeps PRO-06's scope tight). Copy uses `platform.clipboard`, never `@tauri-apps/*` directly.

### Base64 / Hex / Bytes tool (ENC-01, ENC-02, ENC-03)
- **D-12:** **Three stacked full-width panes** — text (UTF-8), base64, hex — each independently editable. Editing any one re-derives the other two from a single internal `Uint8Array` (the source of truth); strings live only at the I/O boundary. Reuse `src/lib/bytes.ts` end to end (`utf8ToBytes`/`bytesToUtf8`, `bytesToBase64`/`base64ToBytes`, `bytesToHex`/`hexToBytes`) — it already does the modern-API-with-polyfill feature detection (ENC-02).
- **D-13:** **On invalid input in one field, flag only that field + the status bar; keep the last-good value in the other two.** Encoding errors are explicit (the field shows an error state and the status bar names the problem, e.g. "Hex must have an even number of digits"), never silent. Least-jarring while typing.
- **D-14:** **base64 / base64url alphabet toggle** lives on the base64 pane and re-derives the base64 field from the current bytes using `bytesToBase64(bytes, alphabet)` (ENC-03). Whether the alphabet preference persists is Claude's discretion (default: session-local, not persisted — it's per-task, unlike the protobuf tree style).

### Cross-cutting UX — both tools (UX-01..05)
- **D-15:** **Paste transforms instantly** (Cmd+V in the primary input → immediate transform, no decode button) for both tools (UX-01).
- **D-16:** **Status bar on every tool:** parse state · byte count · current encoding · errors · timing (UX-03). For Protobuf "current encoding" = the detected input encoding (hex/base64, per D-01); for Base64/Hex/Bytes = the active alphabet. Timing measures paste→interpretation (must hold < 2s; realistically instant).
- **D-17:** **WCAG AA throughout** (UX-04): visible focus indicators, AA text contrast, and **disabled state never signalled by opacity alone** — the mockup's `chip:disabled { opacity:.4 }` must be paired with a non-opacity cue (e.g. `aria-disabled`, hidden, or a distinct treatment). Phase boundary ends with a passing `gsd-ui-review` WCAG-AA audit.
- **D-18:** **Tool components are layout-agnostic** (UX-05): responsive Tailwind, no fixed widths; all layout chrome stays in the shell. Both tools mount inside the shell's `<Outlet/>`, replacing their `makePlaceholder` registry `component`.

### Claude's Discretion
- Exact detection-heuristic edge tuning (D-02), example-payload byte contents and count (D-03), tree node component structure and expand/collapse affordance design, per-node copy button placement, JSON serialization details for non-message interpretations (D-11), Base64 tool pane ordering/spacing and whether the alphabet toggle persists (D-14), status-bar formatting/timing precision, and which lucide icons/labels annotate wire types. All within the locked decisions above and the design tokens in `design/DevTools Mockup.html`.

### TDD / harness expectation
- Per the binding harness, every plan passes the per-task gate **simplify → /codex:review → vitest+tsc → real-webview UI** in order; the decoder's **19 tests stay green** and each new feature adds its own TDD cases. Plans may run in parallel but none advances past the gates. Phase ends with human sign-off on a `tauri build` + `gsd-ui-review`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### Product spec & UX constraints
- `docs/design-and-plan.md` §7 — hero Protobuf decoder: interpretation model (message/string/bytes + packed-varints/packed-i32/packed-i64), VARINT zigzag+signed readings, hardening (MAX_DEPTH/MAX_PAYLOAD_BYTES), 19-test bar.
- `docs/design-and-plan.md` §8 — Base64/Hex/Bytes: Uint8Array-internal, feature-detect polyfill, explicit errors, base64/base64url toggle.
- `docs/design-and-plan.md` §9 — binding cross-cutting UX constraints (paste-instant, copy-instant/no hover-only, resizable panes, sparing accent / neutral `#N`, all-interpretations-from-`LenInterpretation`, dense layout, status-bar contents).
- `docs/harness-and-decisions.md` — build+verify harness (simplify → /codex:review → vitest+tsc → real-webview UI; phase-boundary human sign-off + WCAG-AA audit). Row 4: **cards default + rows/cards toggle persisted** (DEVIATION from handoff `tree: rows`).

### Visual system (rebuild visuals against this; do NOT load its CDN fonts)
- `design/DevTools Mockup.html` — decoded-tree tokens and structure: `.tree-cards`/`.tree-rows`, `.field`/`.field-head`/`.fnum`/`.wire`/`.field-bytes`, `.chips`/`.chip`(`.on`/`:disabled`), `.val`(`.bad`)/`.submsg`, `.divider` (resizable), `.examples`/`.ex`(`.on`), copy affordances (`.copy-btn`/`.copy-inline` — ship `always`/`inline`, NOT the `is-hover` variant), `.json` view styles. CSS vars: `--bg-app #0a0b0d`, `--accent #3b82f6`, `--accent-soft`/`--accent-line`, `--tx`/`--tx-2`/`--tx-3`, `--bd`/`--bd-2`, `--card`/`--card-2`, `--input-bg`, `--bad`. **Spec overrides the mockup:** `#N` neutral (not accent), no hover-only copy, cards default.

### Code to build on (do NOT modify the port-unchanged files)
- `src/lib/protobuf/decoder.ts` — `decodeMessage(buf)`, types `DecodedField`/`FieldValue`/`WireType`/`LenInterpretation`/`PackedVarint`/`PackedFixed32`/`PackedFixed64`, `MAX_DEPTH`/`MAX_PAYLOAD_BYTES`. **Port-unchanged + 19 tests immovable.** The UI consumes this output directly; chips come from `LenInterpretation` keys.
- `src/lib/bytes.ts` — `bytesToBase64`/`base64ToBytes` (alphabet param, feature-detect), `bytesToHex`/`hexToBytes`, `utf8ToBytes`/`bytesToUtf8`, `Base64Alphabet`. **Port-unchanged.** Both tools' byte conversions route through here (covers ENC-01/02/03 engine).
- `src/lib/tools/registry.ts` + `src/lib/tools/types.ts` — single control plane; **port-unchanged.** Phase 3 only swaps each tool's `component` from `makePlaceholder(...)` to the real component in `src/tools/<id>/index.ts`.
- `src/tools/protobuf-decoder/index.ts`, `src/tools/base64/index.ts` — registry entries currently pointing at `makePlaceholder`; replace `component` here.
- `src/shell/preferences.ts` / `src/shell/prefsStore.ts` / `src/shell/usePreferences.ts` — preferences seam; add the `protobufTreeStyle` key here for D-07 (schema was reserved for it in Phase 2). `src/lib/platform/` — `clipboard` (copy) + `store` (persistence); tools use these, never `@tauri-apps/*`.

### Prior phase decisions (consistency)
- `.planning/phases/02-shell/02-CONTEXT.md` — shell decisions; esp. D-08/D-09 (persistence seam + reserved Protobuf tree-style key), D-10 (CSS-variable theming), layout-chrome-in-shell. `.planning/phases/01-scaffold-harness-proof/01-CONTEXT.md` — platform seam + macOS real-webview UI-gate driver (`scripts/e2e-spike.sh`).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`decoder.ts`** — the entire schema-less decode + ambiguity model already exists and is tested (19 cases). Phase 3 is a *UI over its output*, not new decode logic. Chips map 1:1 to `LenInterpretation` keys.
- **`bytes.ts`** — the full Base64/Hex/Bytes engine (modern-API + polyfill, alphabet support, explicit errors) already exists. ENC-01..03 are a UI shell over it; the protobuf input layer (D-02) also reuses `hexToBytes`/`base64ToBytes`.
- **Preferences seam** (`usePreferences`/`prefsStore`/`preferences.ts`) — already persists theme/accent/last-used/recents over `platform.store`; the `Preferences` schema was deliberately left extensible for the `protobufTreeStyle` key (D-07).
- **`platform.clipboard`** — real clipboard already wired (used in Phase 1 skeleton) for the copy affordances (D-10).
- **`makePlaceholder` swap point** — each tool's registry `component` is the single line to change; sidebar/palette/router already render whatever the registry points at (single control plane proven in Phase 2).
- **Design tokens + tree/chip/divider/examples/json CSS** — fully specified in `design/DevTools Mockup.html`.

### Established Patterns
- **Registry-as-control-plane** and **HashRouter-only** — locked; tools just provide a `component`. No routing/sidebar work needed.
- **No `@tauri-apps/*` in tools** — clipboard and store go through `src/lib/platform/` (FND-04).
- **No network at runtime; no new heavy deps** — decode + encoding engines are zero-dep; prefer in-house over libraries.
- **Layout chrome lives in the shell** — tool components are layout-agnostic (UX-05); the resizable input/output split (D-09) is internal to the Protobuf tool, not shell chrome.

### Integration Points
- `src/tools/protobuf-decoder/index.ts` and `src/tools/base64/index.ts` — swap `component` from placeholder to real.
- `src/shell/preferences.ts` — add `protobufTreeStyle: "cards" | "rows"` to the schema + default `"cards"` (D-07).
- New components live under `src/tools/protobuf-decoder/` and `src/tools/base64/` (co-located with their registry entry).

### Constraints from existing architecture
- Do NOT touch `decoder.ts` / `bytes.ts` / `types.ts` / `registry.ts` internals (port-unchanged bar; the 19 decoder tests are the spec). New tests are added alongside new UI/logic, never by editing the decoder suite.
- Do NOT widen the `Store` seam — the tree-style preference goes through `usePreferences`/`prefsStore`.
</code_context>

<specifics>
## Specific Ideas

- **First impression matters most for the hero:** on paste, smart-default interpretations + auto-expanded nested messages mean the user sees a fully explored structure immediately (D-04/D-05). Example chips (D-03) let a first-time user see this without having a payload handy.
- **Accent discipline is a visible product value:** neutral `#N`, accent reserved for the selected chip/active state (D-08) — explicitly overriding the mockup's accent-blue field numbers.
- **No hover-only copy, ever** (D-10) — the Phase-1 harness already treats a hover-only-copy regression as a gate *failure* (`scripts/e2e-spike.sh`).
- **Reuse over reinvention:** both tools are thin UIs over `decoder.ts` and `bytes.ts`; the phase's risk is UI/UX fidelity and the ambiguity interaction, not byte logic.
</specifics>

<deferred>
## Deferred Ideas

- **Full tree/JSON view-mode switch** — only cards/rows ship (PRO-06); the JSON need is met by "copy as JSON" (D-11). A dedicated JSON view could be revisited later if users want it.
- **Tool-scoped action palette** ("decode clipboard as protobuf", "copy as base64url", "reinterpret all LEN as packed varints") — V2-01, deferred.
- **Schema-aware `.proto` decoding** — out of scope; v1 is schema-less only (future paid candidate via `protobuf-es`).
- **Persisting the base64 alphabet choice** — left session-local by default (D-14); could persist later if users expect it to stick.
- **Window-geometry persistence** — Phase 5 (SHL-05 deferred clause, Phase-2 D-11). Not this phase.

None of the above were scope creep — they surfaced as natural boundaries while scoping the hero + encoding tools.
</deferred>

---

*Phase: 03-hero-protobuf-encoding-ux-constraints*
*Context gathered: 2026-05-31*
