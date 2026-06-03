---
phase: 12-protobuf-decimal-input
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/lib/bytes.ts
  - src/lib/bytes.test.ts
  - src/tools/protobuf-decoder/detectEncoding.ts
  - src/tools/protobuf-decoder/detectEncoding.test.ts
  - src/tools/protobuf-decoder/useDecode.ts
autonomous: true
requirements: [PRO-08, PRO-09]

must_haves:
  truths:
    - "decimalToBytes('10, 3, 80, 81, 82') returns Uint8Array([10,3,80,81,82])"
    - "decimalToBytes throws a named-token Error on >255, negative, non-integer, unparseable, trailing-comma, and doubled-comma input"
    - "detectEncoding('1, 2, 999') returns 'decimal' (NOT base64) — comma anywhere routes to decimal before validation"
    - "detectEncoding('10 3 80') (space-only, no comma) does NOT return decimal"
    - "decodeInput routes encoding==='decimal' through decimalToBytes, and a decimal parse error becomes result.error (no crash)"
    - "decoder.ts and decoder.test.ts are byte-for-byte unmodified"
  artifacts:
    - path: "src/lib/bytes.ts"
      provides: "decimalToBytes(input: string): Uint8Array"
      contains: "export function decimalToBytes"
    - path: "src/tools/protobuf-decoder/detectEncoding.ts"
      provides: "InputEncoding union including 'decimal' + comma-first detection branch"
      contains: "decimal"
    - path: "src/tools/protobuf-decoder/useDecode.ts"
      provides: "three-way encoding switch including decimal"
      contains: "decimalToBytes"
  key_links:
    - from: "src/tools/protobuf-decoder/useDecode.ts"
      to: "src/lib/bytes.ts decimalToBytes"
      via: "import + decode-branch call"
      pattern: "decimalToBytes\\(raw\\)"
    - from: "src/tools/protobuf-decoder/detectEncoding.ts"
      to: "useDecode.ts / ProtobufDecoder.tsx"
      via: "re-exported InputEncoding union widened to include 'decimal'"
      pattern: "\"decimal\""
---

<objective>
Add the pure pre-decode logic layer for decimal-byte-array Protobuf input: a new `decimalToBytes` parser in `src/lib/bytes.ts`, a comma-first branch in `detectEncoding`, and a three-way decode switch in `useDecode.ts`. This is the entire string→bytes path — TDD with node-level vitest, no DOM.

Purpose: De-risk the hardest constraint ("don't touch `decoder.ts`") and answer the auto-detection-precedence design question (D-01/D-02) before any UI work. The decimal path is a pre-decode parse layer that throws plain `Error`s the existing `decodeInput` try/catch already converts to `result.error` — error-as-value for free.

Output: `decimalToBytes` (tested), widened `InputEncoding` union, comma-first `detectEncoding` branch (tested), and the `useDecode.ts` wiring that makes `decimal` route correctly. The decoder and its 19 tests remain byte-for-byte untouched.
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
@CLAUDE.md

<interfaces>
<!-- Contracts the executor works against. Mirror decimalToBytes on the existing hexToBytes shape. -->

From src/lib/bytes.ts (the PATTERN to mirror — trim, validate, throw Error with clear message):
```typescript
export function hexToBytes(input: string): Uint8Array {
  const clean = input.trim().replace(/^0x/i, "").replace(/[\s:_-]/g, "");
  if (clean.length % 2 !== 0) throw new Error("Hex must have an even number of digits");
  if (clean.length > 0 && !/^[0-9a-fA-F]+$/.test(clean)) throw new Error("Invalid hex characters");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
```

From src/tools/protobuf-decoder/detectEncoding.ts (CURRENT — to widen):
```typescript
export type InputEncoding = "hex" | "base64";
export function detectEncoding(raw: string): InputEncoding {
  const trimmed = raw.trim().replace(/^0x/i, "");
  const hexBody = trimmed.replace(/[\s:_-]/g, "");
  const looksHex =
    hexBody.length > 0 && /^[0-9a-fA-F]+$/.test(hexBody) && hexBody.length % 2 === 0;
  return looksHex ? "hex" : "base64";
}
```

From src/tools/protobuf-decoder/useDecode.ts (CURRENT decode branch — to extend three-way):
```typescript
import { base64ToBytes, hexToBytes } from "@/lib/bytes";
// ...
const bytes = encoding === "hex" ? hexToBytes(raw) : base64ToBytes(raw);
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: TDD decimalToBytes in src/lib/bytes.ts</name>
  <read_first>
    - src/lib/bytes.ts (mirror the hexToBytes shape exactly: trim → validate → throw Error)
    - src/lib/bytes.test.ts (existing test style: vitest, explicit imports, node env, no DOM)
    - .planning/phases/12-protobuf-decimal-input/12-CONTEXT.md (D-04/D-05/D-06/D-07)
  </read_first>
  <files>src/lib/bytes.ts, src/lib/bytes.test.ts</files>
  <behavior>
    Write these tests FIRST (RED), in src/lib/bytes.test.ts, then implement until GREEN:
    - Valid: decimalToBytes("10, 3, 80, 81, 82") === Uint8Array([10,3,80,81,82]) (canonical example)
    - Valid: space-separated "10 3 80" === Uint8Array([10,3,80]) (D-03: space IS a valid separator once routed to decimal)
    - Valid: comma+space mix "10,3, 80" parses
    - Valid: boundary tokens "0, 255" === Uint8Array([0,255])
    - Error (out of range): "1, 2, 999" throws with message naming 999 and range, e.g. "Decimal byte 999 is out of range (0–255)"
    - Error (negative): "-1" throws naming the token
    - Error (non-integer): "3.5" throws e.g. "Decimal byte '3.5' is not an integer"
    - Error (unparseable): "0x0a" throws; "abc" throws
    - Error (trailing comma, D-05): "10, 3, 80," throws (empty token NOT dropped)
    - Error (doubled comma, D-05): "10,,3" throws (empty token NOT dropped)
    - Error (bracket, D-04): "[10, 3]" throws (NO bracket stripping)
    - Error (newline, D-04): "10\n3" throws (newline is NOT a separator)
  </behavior>
  <action>
    Add `export function decimalToBytes(input: string): Uint8Array` to src/lib/bytes.ts, mirroring `hexToBytes`'s shape (trim, validate, throw plain Error). Implement per D-04/D-05/D-06 (copy these verbatim into the impl reasoning):
    - D-04 STRICT surface: separators are ONLY commas and spaces. Do NOT strip surrounding brackets `[] {} ()`. Do NOT treat newlines (or any whitespace other than the space character) as separators. Smallest predictable surface. (A token containing `\n` or `[`/`]` etc. is unparseable → error.)
    - D-05: trailing/empty/doubled tokens are ERRORS, not silently dropped. "10, 3, 80," and "10,,3" must throw. Do NOT filter out empty tokens.
    - D-06: each token is a base-10 integer in 0–255. Reject >255, negative, non-integer (3.5), and unparseable (0x0a, abc).
    - D-07 error wording (Claude's discretion on exact strings — keep terse, consistent with the hex error voice, and NAME the offending token): out-of-range → "Decimal byte 999 is out of range (0–255)"; non-integer → "Decimal byte '3.5' is not an integer"; unparseable → "Decimal byte '0x0a' is not an integer" (or similar). Use the en-dash `–` in the range to match the context doc, or a hyphen — your discretion, just be consistent.
    - Empty/whitespace-only input: out of scope for THIS function's error contract — `decodeInput` already short-circuits `raw.trim() === ""` to the neutral empty state before calling any converter, so decimalToBytes is only ever called with non-empty raw. Do NOT add special empty-string handling that would mask the trailing-comma error case.
    Implementation approach (Claude's discretion per CONTEXT): split on `/[ ,]/` (space-or-comma) WITHOUT collapsing — so empty tokens survive to be rejected — then validate each token with a strict integer check (e.g. `/^\d+$/` then `Number()` + range, or `Number.isInteger` after a strict parse). Avoid any regex with nested quantifiers over the whole input (ReDoS — see threat model T-12-02): validate per-token against a bounded `/^\d+$/`, never a global backtracking pattern.
  </action>
  <verify>
    <automated>npx vitest run src/lib/bytes.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "export function decimalToBytes" src/lib/bytes.ts` (function exported)
    - `npx vitest run src/lib/bytes.test.ts` exits 0
    - bytes.test.ts includes cases for ALL of: valid "10, 3, 80, 81, 82"; out-of-range 999; negative; non-integer 3.5; unparseable 0x0a/abc; trailing comma; doubled comma; bracket; newline (verify by grep for the literal token strings in the test file)
    - The 999 error message contains the literal "999" (named token): a test asserts `expect(() => decimalToBytes("1, 2, 999")).toThrow(/999/)`
  </acceptance_criteria>
  <done>decimalToBytes exists, all new bytes.test.ts cases green, error messages name the offending token.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Widen InputEncoding + comma-first detectEncoding branch</name>
  <read_first>
    - src/tools/protobuf-decoder/detectEncoding.ts (the union + classifier to widen)
    - src/tools/protobuf-decoder/detectEncoding.test.ts (existing case style)
    - .planning/phases/12-protobuf-decimal-input/12-CONTEXT.md (D-01/D-02/D-03)
  </read_first>
  <files>src/tools/protobuf-decoder/detectEncoding.ts, src/tools/protobuf-decoder/detectEncoding.test.ts</files>
  <behavior>
    Write these tests FIRST (RED) in detectEncoding.test.ts, then implement until GREEN:
    - detectEncoding("10, 3, 80, 81, 82") === "decimal" (canonical example, comma present)
    - detectEncoding("1, 2, 999") === "decimal" (D-01 anchor: comma routes to decimal BEFORE validation — NOT base64)
    - detectEncoding("10,3") === "decimal" (comma with no space)
    - detectEncoding("10 3 80") === "base64" or "hex" but NOT "decimal" (D-03: space-only, no comma, does NOT auto-detect decimal — assert `.not.toBe("decimal")`)
    - Existing cases unchanged: "089601" === "hex"; "aGVsbG8=" === "base64"; "" === "base64"
  </behavior>
  <action>
    Widen the union to `export type InputEncoding = "hex" | "base64" | "decimal";` and add a comma-FIRST branch per D-01/D-02:
    - D-01: a comma ANYWHERE ⇒ "decimal", unconditionally. The "all tokens 0–255" clause is a VALIDATION rule applied later by decimalToBytes, NOT a detection gate. So `1, 2, 999` must return "decimal" so it surfaces a clear DECIMAL range error, never a base64 fallback error.
    - D-02: precedence is decimal(comma) → hex(existing rule) → base64(default). Add the comma check as the FIRST branch: `if (raw.includes(",")) return "decimal";` then fall through to the EXISTING hex-vs-base64 logic completely unchanged.
    - D-03: space-only (no comma) does NOT detect decimal — because the comma check fails, "10 3 80" falls through to the existing hex/base64 classifier. Do NOT add any space-based decimal heuristic.
    Keep this a PURE classifier — it must NOT import from @/lib/bytes and must NOT parse/validate tokens (the file header comment documents this contract; preserve it). The `.includes(",")` check is cheap and not a ReDoS surface.
  </action>
  <verify>
    <automated>npx vitest run src/tools/protobuf-decoder/detectEncoding.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q '"decimal"' src/tools/protobuf-decoder/detectEncoding.ts` (union widened + branch present)
    - detectEncoding.test.ts asserts `detectEncoding("1, 2, 999")` toBe "decimal" (grep for "1, 2, 999" in the test file)
    - detectEncoding.test.ts asserts space-only "10 3 80" is `.not.toBe("decimal")`
    - `npx vitest run src/tools/protobuf-decoder/detectEncoding.test.ts` exits 0
    - The file still does NOT import from @/lib/bytes: `grep -L "@/lib/bytes" src/tools/protobuf-decoder/detectEncoding.ts` lists the file (no such import)
  </acceptance_criteria>
  <done>InputEncoding includes "decimal", comma-first branch present, all detectEncoding tests green, classifier stays pure.</done>
</task>

<task type="auto">
  <name>Task 3: Wire decimal into the useDecode decode boundary</name>
  <read_first>
    - src/tools/protobuf-decoder/useDecode.ts (the single decode boundary + try/catch error-as-value path)
    - src/lib/bytes.ts (decimalToBytes signature from Task 1)
    - .planning/phases/12-protobuf-decimal-input/12-CONTEXT.md (Code Insights — three-way switch)
  </read_first>
  <files>src/tools/protobuf-decoder/useDecode.ts</files>
  <action>
    In src/tools/protobuf-decoder/useDecode.ts, extend the converter selection from two-way to three-way. Current line (inside the try block of `decodeInput`):
    `const bytes = encoding === "hex" ? hexToBytes(raw) : base64ToBytes(raw);`
    Change to a three-way that routes decimal through decimalToBytes, e.g.:
    `const bytes = encoding === "hex" ? hexToBytes(raw) : encoding === "decimal" ? decimalToBytes(raw) : base64ToBytes(raw);`
    Update the import on the existing line `import { base64ToBytes, hexToBytes } from "@/lib/bytes";` to also import `decimalToBytes`. Do NOT touch the try/catch — the decimal path inherits error-as-value for free (a thrown decimalToBytes Error becomes `result.error`, no crash; threat T-12-01 mitigation). Do NOT touch the empty-state short-circuit (`raw.trim() === ""` stays the neutral empty state per D-02). No `decoder.ts` import or call changes.
  </action>
  <verify>
    <automated>npx vitest run && npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "decimalToBytes" src/tools/protobuf-decoder/useDecode.ts` (imported and called)
    - `grep -q 'encoding === "decimal"' src/tools/protobuf-decoder/useDecode.ts` (three-way branch present)
    - `npx tsc --noEmit` exits 0 (union widening flows through with no type errors)
    - `git diff --quiet src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts` exits 0 (decoder + its 19 tests byte-for-byte untouched)
    - `npx vitest run src/lib/protobuf/decoder.test.ts` exits 0 with 19 tests passing (the immovable bar)
  </acceptance_criteria>
  <done>decodeInput routes decimal through decimalToBytes; tsc clean; full vitest green; decoder + 19 tests untouched (git diff clean).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| pasted string → decimalToBytes | Untrusted clipboard text crosses into the parser. No network, no auth, no injection sink — the realistic surface is crash/DoS or incorrect parse. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12-01 | Denial of Service (crash) | decimalToBytes / decodeInput | mitigate | decimalToBytes throws a plain Error on any invalid input; decodeInput's existing single try/catch converts it to result.error (string), never an uncaught throw. Acceptance: Task 1 toThrow tests + Task 3 keeps the try/catch intact. |
| T-12-02 | Denial of Service (ReDoS) | decimalToBytes token regex | mitigate | Validate each token with a bounded, anchored pattern (`/^\d+$/`) — never a global pattern with nested/overlapping quantifiers over the whole input. detectEncoding's comma check is a plain `.includes(",")` (no regex). Acceptance: code review + the parse is linear in input length. |
| T-12-03 | Tampering (incorrect parse) | decimalToBytes strict surface | mitigate | Strict D-04/D-05/D-06 rules reject brackets, newlines, empty/trailing/doubled tokens, and out-of-range values rather than silently coercing — wrong input becomes a named error, not silently-wrong bytes. Acceptance: Task 1 error-case tests. |
| T-12-04 | Denial of Service (oversize) | decodeMessage downstream | accept | Unbounded input length to decimalToBytes is bounded downstream by the decoder's existing MAX_PAYLOAD_BYTES guard (oversize → caught error). Decimal expands ~3 input chars → 1 byte, so it cannot exceed hex/base64 byte volume for a given paste. No new bound needed; decoder.ts stays untouched. |
</threat_model>

<verification>
Per-task Definition of Done (binding harness, in order):
1. `/simplify` the just-written changes (reuse/efficiency/altitude cleanups only — no bug-hunting).
2. `/codex:review --wait --scope working-tree` — address findings.
3. Unit tests green: `npx vitest run` AND `npx tsc --noEmit` clean. The decoder's 19 tests are the immovable bar — they must still pass and the file must be byte-for-byte untouched.
4. (Real-WKWebView UI verification is N/A for this plan — pure logic, no UI change. The UI gate runs in Plan 02.)

Plan-level checks:
- `git diff --quiet src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts` exits 0.
- `npx vitest run` all green (including the 19 decoder tests).
- `npx tsc --noEmit` exits 0.
</verification>

<success_criteria>
- decimalToBytes("10, 3, 80, 81, 82") returns the correct Uint8Array (canonical example).
- detectEncoding("1, 2, 999") returns "decimal" and decimalToBytes("1, 2, 999") throws a clear range error naming 999 — proving the comma-routes-to-decimal-then-validate rule (D-01), never a base64 fallback error.
- detectEncoding("10 3 80") (space-only) does NOT return decimal (D-03).
- decodeInput routes decimal correctly and a decimal parse error becomes result.error (no crash).
- decoder.ts and its 19 tests are byte-for-byte unmodified (git diff clean); tsc clean.
</success_criteria>

<output>
After completion, create `.planning/phases/12-protobuf-decimal-input/12-01-SUMMARY.md`
</output>
