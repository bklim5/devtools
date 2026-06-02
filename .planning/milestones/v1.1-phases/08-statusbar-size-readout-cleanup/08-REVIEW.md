---
phase: 08-statusbar-size-readout-cleanup
reviewed: 2026-06-02T16:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/components/StatusBar.tsx
  - src/components/StatusBar.test.tsx
  - src/tools/hash/HashTool.tsx
  - src/tools/hash/HashTool.test.tsx
  - src/tools/jwt/JwtTool.tsx
  - src/tools/jwt/JwtTool.test.tsx
  - src/tools/unix-time/UnixTimeTool.tsx
  - src/tools/unix-time/UnixTimeTool.test.tsx
  - src/tools/uuid-ulid/UuidUlidTool.tsx
  - src/tools/uuid-ulid/UuidUlidTool.test.tsx
  - src/tools/protobuf-decoder/ProtobufDecoder.test.tsx
  - src/tools/json-formatter/JsonFormatterTool.test.tsx
  - src/tools/xml-formatter/XmlFormatterTool.test.tsx
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 8: Code Review Report

**Reviewed:** 2026-06-02T16:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** clean

## Summary

Phase 8 (UIX-01) is a tightly-scoped presentational refactor: it makes the shared
`StatusBar.byteCount` prop optional and gates the size span on
`typeof byteCount === "number"`, then removes the prop from the four "drop" tools
(Hash, JWT, Unix Time, UUID/ULID) and adds present/absent coverage on the keep
tools (Protobuf, JSON/XML formatters) plus the StatusBar itself.

The implementation is correct, minimal, and faithful to the constraints. Verified
during review:

- **Gating is sound.** The size span is `typeof byteCount === "number" ? … : null`,
  so `byteCount={0}` would still render (number) — the four drop tools correctly
  *remove* the prop rather than passing `0`, and the diff confirms each dropped a
  `byteCount={0}` or a computed value. The `outputBytes`-without-`byteCount` edge
  renders nothing (the delta branch is nested inside the `byteCount` guard), and a
  dedicated test asserts exactly this.
- **No dead code left behind.** `HashTool` dropped its now-unused
  `const byteCount = bytes.length;` line; the other three tools only removed a prop.
  A repo-wide grep confirms zero residual `byteCount` references in the four drop
  tools.
- **Keep tools untouched in behavior.** Base64, the JSON/XML formatters (via
  `FormatterView`, whose `FormatterStatus.byteCount` stays a required `number`), and
  the protobuf decoder (`byteCount={result.byteCount}`) all still pass the prop. The
  optional change is purely additive and backward-compatible — existing single-count
  and `input → output` delta callers are byte-identical.
- **No discriminated prop type** was introduced (constraint honored) — a single
  optional `byteCount?: number` with a runtime `typeof` guard.
- **Decoder out of scope and untouched.** `git diff` confirms no changes under
  `src/lib/protobuf/`; the 19 decoder tests are not in the changeset.
- **Zero new runtime deps** — no import changes beyond removing now-unused locals.
- **Harness gates green:** `tsc --noEmit` clean; the 11 affected test files run
  103 tests, all passing.

Test coverage for the new behavior is thorough: StatusBar has an "optional byteCount"
describe block covering omitted / present / delta / outputBytes-without-byteCount; each
drop tool asserts `queryByLabelText("byte count")` is null while the parse-state label
survives; each keep tool asserts the byte count IS present. This is the right
present-AND-absent matrix.

The two Info items below are minor observations, not defects — no fix is required for
this phase.

## Info

### IN-01: Doc comment on `outputBytes` could mirror the new runtime guard wording

**File:** `src/components/StatusBar.tsx:26-33`
**Issue:** The `byteCount` JSDoc was updated to describe the opt-in behavior, and the
`outputBytes` JSDoc gained a correct sentence ("passing `outputBytes` WITHOUT
`byteCount` renders nothing"). This is accurate. The top-of-file header still reads
"parse state · byte count · current encoding" as if byte count is always present;
a reader skimming only the header (vs. the prop doc) could miss that the size readout
is now conditional. Minor.
**Fix:** Optionally tweak the header summary line to note the size readout is opt-in
(the body already says this two lines down), e.g. append "(byte count opt-in, UIX-01)".
Cosmetic only — the prop-level docs are already clear and correct.

### IN-02: Drop-tool "no size readout" tests assert via `queryByLabelText` scoped to the footer — consistent, but `parse state` assertion uses `getByLabelText` without a textContent check in some

**File:** `src/tools/hash/HashTool.test.tsx:68-75` (and the parallel tests in
`JwtTool.test.tsx:156-164`, `UnixTimeTool.test.tsx:136-144`,
`UuidUlidTool.test.tsx:185-191`)
**Issue:** Each drop tool's UIX-01 test asserts `queryByLabelText("byte count")` is
null (good, the load-bearing assertion) and that `getByLabelText("parse state")` is
truthy. The truthiness check confirms the parse-state span survives the refactor,
which is the intended regression guard — but it does not assert the *value* (e.g.
"OK" after content is entered). This is intentional minimalism and matches the
phase's narrow scope; calling it out only so the pattern is a conscious choice, not
an oversight. No change needed.
**Fix:** None required. If future hardening is desired, the existing per-tool "empty →
status 'empty'" / "error → status 'Error'" tests already cover parse-state *values*
independently, so this assertion is appropriately limited to "the span still exists".

---

_Reviewed: 2026-06-02T16:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
