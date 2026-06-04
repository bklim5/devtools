---
phase: 12-protobuf-decimal-input
plan: 02
type: execute
wave: 2
depends_on: [12-01]
files_modified:
  - src/tools/protobuf-decoder/ProtobufDecoder.tsx
  - test/e2e/protobuf-decoder.e2e.ts
autonomous: false
requirements: [PRO-08, PRO-09]

must_haves:
  truths:
    - "User sees a third 'decimal' segment in the encoding override toggle group (hex / base64 / decimal)"
    - "When the user pastes a comma-separated array, the 'decimal' segment becomes the active (accented) readout — the visible, overridable detected-mode indicator"
    - "User can click the decimal segment to force decimal mode, and click the active segment to clear back to auto-detect"
    - "A decimal example chip '10, 3, 80, 81, 82' sits beside the hex example chips and loads on click"
    - "The textarea placeholder mentions decimal"
    - "Pasting '1, 2, 999' shows a clear inline decimal range error (role=alert), not a base64 error, and the tool does not crash"
  artifacts:
    - path: "src/tools/protobuf-decoder/ProtobufDecoder.tsx"
      provides: "decimal segment in OVERRIDES, generic-value EXAMPLES with a decimal chip, updated placeholder"
      contains: "decimal"
    - path: "test/e2e/protobuf-decoder.e2e.ts"
      provides: "real-WKWebView coverage of the decimal mode + error anchor"
      contains: "decimal"
  key_links:
    - from: "src/tools/protobuf-decoder/ProtobufDecoder.tsx OVERRIDES"
      to: "encoding toggle render (active-segment-is-readout)"
      via: "OVERRIDES.map renders a button per InputEncoding"
      pattern: "OVERRIDES"
    - from: "EXAMPLES chip"
      to: "setRaw(ex.value)"
      via: "generic value field replaces the hex-named field"
      pattern: "ex\\.value"
---

<objective>
Surface the decimal input mode in the Protobuf hero UI: add `decimal` as a third segment to the encoding override toggle (reusing the active-segment-is-the-readout pattern), refactor the `EXAMPLES` array to a generic `value` field so a decimal example chip `10, 3, 80, 81, 82` sits beside the hex chips, and update the textarea placeholder. Then verify on the real WKWebView.

Purpose: Deliver PRO-08's "visible, overridable detected-mode indicator" and the example/placeholder affordances (D-08/D-09/D-10), and prove PRO-09's clear-inline-error-no-crash behavior end-to-end (the `1, 2, 999` anchor) in the actual webview.

Output: Updated ProtobufDecoder.tsx + extended e2e coverage, verified against `tauri dev` per the binding harness.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/12-protobuf-decimal-input/12-CONTEXT.md
@.planning/phases/12-protobuf-decimal-input/12-01-SUMMARY.md
@CLAUDE.md
@design/DevTools Mockup.html

<interfaces>
<!-- From Plan 12-01 (Wave 1) — already shipped before this plan runs: -->
<!-- InputEncoding = "hex" | "base64" | "decimal" (widened union, re-exported through useDecode.ts) -->
<!-- decodeInput routes encoding==="decimal" through decimalToBytes; result.encoding reflects the detected/overridden mode -->

From src/tools/protobuf-decoder/ProtobufDecoder.tsx (CURRENT shapes to refactor):
```typescript
const EXAMPLES: ReadonlyArray<{ label: string; hex: string }> = [
  { label: "{1:150}", hex: "089601" },
  { label: "nested message", hex: "1a03089601" },
  { label: "packed varints", hex: "2205038e029601" },
  { label: 'string "hi"', hex: "12026869" },
];
const OVERRIDES: ReadonlyArray<InputEncoding> = ["hex", "base64"];
// Chip active-check uses: const active = raw === ex.hex;
// Chip onClick uses: onClick={() => setRaw(ex.hex)}
// Toggle renders OVERRIDES.map; active = result.encoding === enc; onClick sets/clears override.
// textarea placeholder="Paste hex or base64 protobuf bytes…"
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add decimal segment, decimal example chip, and updated placeholder</name>
  <read_first>
    - src/tools/protobuf-decoder/ProtobufDecoder.tsx (EXAMPLES, OVERRIDES, the chip render loop, the toggle render loop, the textarea placeholder)
    - .planning/phases/12-protobuf-decimal-input/12-CONTEXT.md (D-08/D-09/D-10 + the EXAMPLES refactor note in Claude's Discretion)
    - design/DevTools Mockup.html (chip/toggle visual system — keep the existing classes, no new visual language)
  </read_first>
  <files>src/tools/protobuf-decoder/ProtobufDecoder.tsx</files>
  <action>
    Three contained edits to src/tools/protobuf-decoder/ProtobufDecoder.tsx:
    1. D-08 — add `"decimal"` to OVERRIDES: `const OVERRIDES: ReadonlyArray<InputEncoding> = ["hex", "base64", "decimal"];`. The toggle already renders `OVERRIDES.map(...)` with the active-segment-is-readout pattern (active = `result.encoding === enc`; clicking active clears the override, clicking inactive sets it). No render-logic change needed — the third segment plugs in. The decimal segment becomes the accented active readout automatically when decodeInput returns `encoding: "decimal"`.
    2. D-10 + EXAMPLES refactor — rename the `hex` field to a generic `value` field so a decimal example can sit beside hex ones without the field name lying. Change the type to `ReadonlyArray<{ label: string; value: string }>`, update each existing entry (`hex: "089601"` → `value: "089601"`, etc.), update the chip active-check `raw === ex.hex` → `raw === ex.value`, and the chip `onClick={() => setRaw(ex.hex)}` → `setRaw(ex.value)`. Then APPEND the decimal example: `{ label: "decimal bytes", value: "10, 3, 80, 81, 82" }` (canonical example — use this string exactly, including the spaces after commas). Keep the `key={ex.label}` — labels are unique.
    3. D-09 — update the textarea placeholder from "Paste hex or base64 protobuf bytes…" to mention decimal, e.g. `placeholder="Paste hex, base64, or decimal bytes…"`. Also update the empty-state hint paragraph text in the output pane ("Paste hex or base64 protobuf bytes to decode.") to match, e.g. "Paste hex, base64, or decimal bytes to decode." for consistency.
    Do NOT add a separate detected-mode chip — the active toggle segment IS the readout (D-08, no duplication). Keep the component layout-agnostic (no fixed widths). No changes outside ProtobufDecoder.tsx in this task.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx vitest run</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q '"hex", "base64", "decimal"' src/tools/protobuf-decoder/ProtobufDecoder.tsx` (decimal segment in OVERRIDES)
    - `grep -q '10, 3, 80, 81, 82' src/tools/protobuf-decoder/ProtobufDecoder.tsx` (canonical decimal example chip present)
    - `grep -q 'ex.value' src/tools/protobuf-decoder/ProtobufDecoder.tsx` AND `! grep -q 'ex.hex' src/tools/protobuf-decoder/ProtobufDecoder.tsx` (EXAMPLES refactored to generic value; no lingering ex.hex)
    - `grep -qi 'decimal' src/tools/protobuf-decoder/ProtobufDecoder.tsx` placeholder line includes "decimal" (grep the placeholder string)
    - `npx tsc --noEmit` exits 0
    - `npx vitest run` exits 0 (19 decoder tests still green)
    - `git diff --quiet src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts` exits 0 (decoder untouched)
  </acceptance_criteria>
  <done>Decimal segment renders in the toggle, decimal example chip loads "10, 3, 80, 81, 82", placeholder mentions decimal, tsc + vitest green, decoder untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Extend the protobuf-decoder e2e spec for decimal mode</name>
  <read_first>
    - test/e2e/protobuf-decoder.e2e.ts (existing e2e style — selectors, how it drives the textarea and reads results/errors)
    - scripts/e2e-spike.sh (the runner that drives the real WKWebView)
    - .planning/phases/12-protobuf-decimal-input/12-CONTEXT.md (canonical example + the 1, 2, 999 anchor)
  </read_first>
  <files>test/e2e/protobuf-decoder.e2e.ts</files>
  <action>
    Extend test/e2e/protobuf-decoder.e2e.ts (do NOT create a new file — append to the existing protobuf spec, following its established driving/assertion style) with decimal coverage:
    1. Paste the canonical decimal array `10, 3, 80, 81, 82` into the protobuf input, assert the decimal toggle segment becomes the active/accented readout (aria-pressed=true on the decimal segment), and assert the decoder produces a non-error result (fields render, no role=alert).
    2. Paste the error anchor `1, 2, 999`, assert a role=alert inline error appears whose text names the offending token "999" and indicates a range/decimal error (NOT a base64 error), and assert the tool is still responsive (no crash, input still editable).
    3. (Optional, if cheap in the existing style) click the decimal example chip and assert the textarea fills with `10, 3, 80, 81, 82`.
    Use the exact canonical strings. Keep assertions text/aria/DOM based (no screenshot-only checks — screenshots are a preview, the DOM/a11y assertions are the gate).
  </action>
  <verify>
    <automated>bash scripts/e2e-spike.sh protobuf-decoder</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q '10, 3, 80, 81, 82' test/e2e/protobuf-decoder.e2e.ts` (canonical example exercised)
    - `grep -q '1, 2, 999' test/e2e/protobuf-decoder.e2e.ts` (error anchor exercised)
    - `grep -q '999' test/e2e/protobuf-decoder.e2e.ts` in an error-text assertion (named-token error checked)
    - `bash scripts/e2e-spike.sh protobuf-decoder` runs against the real WKWebView and the decimal cases pass (per MEMORY: reap orphan vite/app, ensure :1420/:4445 free before running)
  </acceptance_criteria>
  <done>e2e spec covers decimal decode + the 1,2,999 named-error anchor and passes on the real WKWebView.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human sign-off on tauri build + gsd-ui-review (phase boundary)</name>
  <what-built>
    The Protobuf hero now accepts a comma/space-separated decimal byte array as a third auto-detected input mode: a `decimal` segment in the encoding toggle (active-segment-is-readout), a `10, 3, 80, 81, 82` example chip, an updated placeholder, and clear named-token inline errors for invalid decimal input — all with decoder.ts + its 19 tests byte-for-byte untouched.
  </what-built>
  <how-to-verify>
    1. Run a fresh `tauri build` (per MEMORY: if the DMG step flakes, `hdiutil detach` any mounted DMGs and retry).
    2. Launch the built app, open the Protobuf decoder.
    3. Paste `10, 3, 80, 81, 82` — confirm the `decimal` toggle segment lights up as the active accented readout and the bytes decode (fields render), paste-instant (<2s).
    4. Click the `decimal` active segment — confirm it clears back to auto-detect; click it again to force decimal.
    5. Paste `1, 2, 999` — confirm a clear inline error names 999 / says out-of-range (NOT a base64 error), and the tool stays responsive (no crash).
    6. Paste `10 3 80` (space-only, no comma) — confirm it does NOT auto-detect decimal (D-03); selecting the decimal override then parses it.
    7. Click the `10, 3, 80, 81, 82` example chip — confirm it loads and decodes.
    8. Run `gsd-ui-review` — confirm a passing WCAG-AA audit (toggle segments keyboard-focusable, aria-pressed correct, error has role=alert).
  </how-to-verify>
  <files>(verification only — no files modified)</files>
  <action>Human verifies the built app per the steps below — Claude has already automated build, e2e, and unit checks in Tasks 1-2 and the prior plan; this checkpoint confirms the decimal mode and error behavior on the real app + a passing WCAG-AA audit.</action>
  <verify>Human confirms all how-to-verify steps pass and gsd-ui-review reports WCAG-AA pass.</verify>
  <done>User types "approved"; tauri build launches, decimal mode works, 1,2,999 shows a clear non-crashing error, gsd-ui-review WCAG-AA passes.</done>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| pasted string → UI → decodeInput | Untrusted clipboard text rendered and decoded in the webview. No network/auth/injection sink; the surface is crash/DoS or mis-render of error text. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12-05 | Denial of Service (crash) | ProtobufDecoder input path | mitigate | Decode runs in a useMemo over the pure decodeInput, which converts any decimal parse throw to result.error (string) rendered as a role=alert — never an uncaught render error. Acceptance: Task 2 e2e asserts the 1,2,999 error renders and the tool stays responsive. Inherited from Plan 12-01 T-12-01. |
| T-12-06 | Information disclosure / Tampering (XSS in error text) | error rendering | accept | The inline error and field values are rendered as React text children (auto-escaped); no dangerouslySetInnerHTML is introduced. Named-token error strings come from decimalToBytes (controlled wording), not raw HTML. Low risk, no new sink. |
| T-12-07 | Denial of Service (huge paste freeze) | textarea → useMemo decode | accept | Inherited bound: decodeInput's downstream decoder enforces MAX_PAYLOAD_BYTES; decimal expands ~3 chars→1 byte so paste volume is bounded below hex/base64. Existing paste-instant (<2s) behavior unchanged; no new bound added in the UI. |
</threat_model>

<verification>
Per-task Definition of Done (binding harness, in order):
1. `/simplify` the just-written changes (quality only).
2. `/codex:review --wait --scope working-tree` — address findings.
3. Unit tests green: `npx vitest run` + `npx tsc --noEmit` clean (19 decoder tests immovable).
4. Real-WKWebView UI verification: update test/e2e/protobuf-decoder.e2e.ts then RUN `bash scripts/e2e-spike.sh protobuf-decoder` on the real WKWebView (Chromium screenshots are preview only; DOM/a11y assertions are the gate). Per MEMORY: reap orphan vite/app, ensure :1420/:4445 free.

Phase boundary: human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit (Task 3 checkpoint).

Plan-level checks:
- `git diff --quiet src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts` exits 0.
- No lingering `ex.hex` reference; EXAMPLES use the generic `value` field.
</verification>

<success_criteria>
- The encoding toggle shows three segments (hex / base64 / decimal); pasting a comma array makes decimal the active accented readout (PRO-08 visible overridable indicator).
- Clicking the active decimal segment clears to auto-detect; clicking inactive forces decimal.
- The `10, 3, 80, 81, 82` example chip loads and decodes.
- The placeholder mentions decimal.
- Pasting `1, 2, 999` shows a clear inline error naming 999 (role=alert), not a base64 error, no crash (PRO-09).
- Real-WKWebView e2e passes; human signs off on tauri build + gsd-ui-review WCAG-AA.
- decoder.ts + its 19 tests byte-for-byte untouched (git diff clean).
</success_criteria>

<output>
After completion, create `.planning/phases/12-protobuf-decimal-input/12-02-SUMMARY.md`
</output>
