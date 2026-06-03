# Phase 12: Protobuf decimal input - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a **third input mode** to the existing Protobuf hero tool: a comma/space-separated
decimal byte array (e.g. `10, 3, 80, 81, 82`), auto-detected alongside the current
hex/base64 modes, with a visible overridable mode indicator. The parse lives in a new
`decimalToBytes` in `src/lib/bytes.ts`; **`src/lib/protobuf/decoder.ts` and its 19 tests
stay byte-for-byte untouched** (verified via `git diff`).

This phase only widens the *input* layer of the Protobuf decoder. It does NOT change the
decoder, the field tree, the LEN-interpretation chips, copy-as-JSON, or any output behavior.
Requirements: **PRO-08, PRO-09**.

</domain>

<decisions>
## Implementation Decisions

### Detection rule (PRO-08)
- **D-01:** **A comma anywhere ⇒ decimal mode, unconditionally** — then validate. Presence
  of a comma is the sole detection trigger; the "all tokens integers 0–255" clause is a
  *validation* rule applied AFTER routing, not a detection gate. So `1, 2, 999` routes to
  decimal and surfaces a clear DECIMAL error ("byte 999 out of range"), never a confusing
  base64 fallback error. This is what makes PRO-09's "clear inline error" land.
- **D-02:** **Detection precedence is: comma-present ⇒ decimal, FIRST.** Only if there is no
  comma does the existing hex-vs-base64 classification run. So the order in `detectEncoding`
  becomes: `decimal` (comma) → `hex` (existing rule) → `base64` (default).
- **D-03:** **Space-only decimal (no comma) does NOT auto-detect as decimal.** Input like
  `10 3 80` has no comma, so it falls through to hex/base64 (where it will likely error or
  mis-classify) — this is expected and acceptable. The user reaches decimal for that shape by
  **manually selecting the `decimal` override**, after which space-separation parses fine.

### Input shapes accepted by `decimalToBytes` (strict)
- **D-04:** **Strict comma/space-separated integers only.** Separators are commas and spaces.
  **No surrounding-bracket stripping** (`[ ]` / `{ }` / `( )` are NOT accepted) and
  **newlines are NOT treated as separators.** Smallest, most predictable surface.
- **D-05:** **Trailing and empty tokens are errors, not silently dropped.** `10, 3, 80,`
  (trailing comma) and `10,,3` (doubled comma) produce a clear error rather than collapsing
  the empties. No lenient token tolerance.
- **D-06:** Each token must be a base-10 integer in `0–255`. Reject `>255`, negative,
  non-integer (`3.5`), and unparseable tokens (`0x0a`, `abc`).

### Error messaging (PRO-09)
- **D-07:** **Name the offending token** in the inline error — e.g.
  "Decimal byte 999 is out of range (0–255)" / "Decimal byte '3.5' is not an integer".
  More helpful than a terse general message for a long list. The error must surface as a
  status STRING through the existing `decodeInput` try/catch — **never a crash** (same path
  hex/base64 errors already use; threat T-03-03 / Pitfall 3 pattern).

### UI affordances
- **D-08:** **Add `decimal` as a third segment** to the existing encoding override toggle
  group (`hex` / `base64` / `decimal`), reusing the established active-segment-IS-the-readout
  pattern (D-08 from Phase 3 — the active segment shows the effective/detected mode; clicking
  the active segment clears the override back to auto-detect). Required for PRO-08's
  "visible, overridable detected-mode indicator."
- **D-09:** **Update the textarea placeholder** to mention decimal (e.g. "Paste hex, base64,
  or decimal bytes…").
- **D-10:** **Add one decimal example chip** (`10, 3, 80, 81, 82`) alongside the existing hex
  examples to showcase the mode.

### Claude's Discretion
- Exact error-string wording (keep it terse, consistent with the existing hex error voice).
- Whether `decimalToBytes` uses a single regex split or a small tokenizer — implementation
  detail, as long as D-04/05/06 hold and it's covered by tests.
- The minor refactor of the `EXAMPLES` array shape (see Code Insights) to carry a generic
  `value` instead of a `hex`-named field, so a decimal example can live alongside hex ones.
- Empty/whitespace-only input stays the neutral empty state (existing D-02 behavior) — not
  an error — regardless of detected mode.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 12: Protobuf decimal input" — goal, success criteria, and
  the risk-order rationale (decimal first to de-risk the untouched-decoder promise).
- `.planning/REQUIREMENTS.md` — **PRO-08** (decimal as a third auto-detected mode + detection
  rule + overridable indicator) and **PRO-09** (invalid-input inline error; decoder + 19 tests
  unmodified; parse lives in a new `decimalToBytes`).

### Binding project constraints
- `CLAUDE.md` — Critical constraints: zero new runtime deps, do NOT refactor `decoder.ts` or
  its 19 tests, no network at runtime, registry-as-single-control-plane, HashRouter only,
  layout-agnostic tool components, the build+verify harness (simplify → /codex:review →
  vitest+tsc → real-WKWebView UI verification).
- `.planning/PROJECT.md` § Current Milestone — v1.3 wedge gates (paste-instant <2s,
  keyboard-driven, WCAG-AA) and the "decoder + 19 tests byte-for-byte untouched" guarantee.

No external ADRs/specs beyond the above — requirements are fully captured in the decisions here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets / Integration Points (the exact seams to touch)
- **`src/lib/bytes.ts`** — home of the new `decimalToBytes(input: string): Uint8Array`.
  Mirror the shape of the existing `hexToBytes` (trim, validate, throw `Error` with a clear
  message on bad input). Add unit tests to the existing **`src/lib/bytes.test.ts`**.
- **`src/tools/protobuf-decoder/detectEncoding.ts`** — extend `InputEncoding` from
  `"hex" | "base64"` to `"hex" | "base64" | "decimal"` and add the comma-first branch
  (D-02). This type is re-exported through `useDecode.ts`, so the new member flows out to the
  UI automatically. Tests already exist: **`detectEncoding.test.ts`** — add decimal cases.
- **`src/tools/protobuf-decoder/useDecode.ts`** — the single decode boundary. Currently:
  `encoding === "hex" ? hexToBytes(raw) : base64ToBytes(raw)`. Extend to a three-way:
  `decimal → decimalToBytes(raw)`. The existing single try/catch already converts any thrown
  parse error into `result.error` (no crash) — the decimal path inherits this for free.
- **`src/tools/protobuf-decoder/ProtobufDecoder.tsx`**:
  - `OVERRIDES = ["hex", "base64"]` → add `"decimal"` (the toggle renders from this array).
  - `EXAMPLES` is `{ label, hex }[]` and active-checks `raw === ex.hex`. Generalize to a
    `value` field (or similar) so a **decimal** example (`10, 3, 80, 81, 82`) can sit beside
    the hex ones without the field name lying. Small, contained refactor.
  - Update the textarea `placeholder`.

### Established Patterns (follow, don't reinvent)
- **Error-as-value, never crash:** all conversion/decoding errors must throw inside
  `decodeInput`'s try/catch and become `result.error` → rendered as an inline `role="alert"`
  + StatusBar `error` state. `decimalToBytes` throwing a plain `Error` is the right shape.
- **Active-segment-as-readout (D-08, Phase 3):** the override toggle's accented active segment
  *is* the detected-mode indicator — there is no separate chip. The decimal segment plugs into
  this exact pattern.
- **Paste-instant via `useMemo`:** `decodeInput` runs in a `useMemo` on `[raw, override]` —
  the decimal path is pure and instant, no extra wiring needed.
- **`decoder.ts` is off-limits:** the new logic is entirely pre-decode (string → bytes).
  Plan must assert `git diff --quiet src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts`.

</code_context>

<specifics>
## Specific Ideas

- Canonical example to use everywhere (success criteria + example chip): `10, 3, 80, 81, 82`.
- Detection example that exercises the "comma ⇒ decimal then validate" rule (D-01): `1, 2, 999`
  must show a decimal range error, NOT a base64 error — a good test/verification anchor.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Bracketed-array stripping and newline-separated
input were explicitly considered and rejected in favor of the strict comma/space surface — see
D-04. Not "deferred," decided against.)

</deferred>

---

*Phase: 12-protobuf-decimal-input*
*Context gathered: 2026-06-03*
