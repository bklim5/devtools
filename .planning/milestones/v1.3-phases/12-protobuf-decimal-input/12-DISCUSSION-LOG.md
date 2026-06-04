# Phase 12: Protobuf decimal input - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 12-protobuf-decimal-input
**Areas discussed:** Detection rule, Input shapes, Error detail, UI surface

---

## Detection rule (comma-present, invalid token behavior)

| Option | Description | Selected |
|--------|-------------|----------|
| Comma ⇒ decimal, then validate | Any comma routes to decimal unconditionally; bad tokens then produce a clear decimal error | ✓ |
| Comma + all-valid required | Detection picks decimal only when comma present AND all tokens valid 0–255; else falls to base64 | |

**User's choice:** Comma ⇒ decimal, then validate.
**Notes:** Keeps PRO-09's "clear inline error" coherent — `1,2,999` shows a decimal range error rather than a confusing base64 error.

---

## Input shapes accepted by `decimalToBytes`

| Option | Description | Selected (initial) | Final |
|--------|-------------|--------------------|-------|
| Bracketed arrays | Strip surrounding `[ ] { } ( )` | ✓ | |
| Newlines as separators | Treat newlines like commas/spaces | ✓ | |
| Trailing/empty tokens | Tolerate trailing comma / collapse doubled separators | | |
| Strict comma/space only | Accept only documented comma/space form; anything else errors | ✓ | ✓ |

**User's choice:** Initial multi-select was contradictory (Bracketed + Newlines + Strict). Reconciliation question asked. **Final: Fully strict — comma/space only.**
**Notes:** Brackets and newlines were explicitly dropped on reconciliation. Smallest, most predictable surface; trailing/empty tokens are errors.

### Reconciliation question

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — widen separators, strict tokens | Accept brackets + newlines, but trailing/empty tokens error | |
| Fully strict — comma/space only | Accept ONLY comma/space form | ✓ |
| Widen everything, lenient tokens | Brackets + newlines + tolerate trailing/empty | |

**User's choice:** Fully strict — comma/space only.

---

## Error detail (PRO-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Name the offending token | e.g. "Decimal byte 999 is out of range (0–255)" | ✓ |
| General message | e.g. "Decimal bytes must be integers 0–255." | |

**User's choice:** Name the offending token.
**Notes:** More helpful for long lists; surfaces through the existing error-as-value path.

---

## UI surface

| Option | Description | Selected |
|--------|-------------|----------|
| Third toggle segment | Add `decimal` to the hex/base64 override group | ✓ |
| Update placeholder text | Mention decimal in the textarea placeholder | ✓ |
| Add a decimal example chip | One decimal example button (`10, 3, 80, 81, 82`) | ✓ |

**User's choice:** All three.
**Notes:** The third segment is required for PRO-08's overridable detected-mode indicator.

## Claude's Discretion

- Exact error-string wording; `decimalToBytes` tokenizer-vs-regex internals; the `EXAMPLES`
  array field rename (`hex` → generic `value`) to host the decimal example.

## Deferred Ideas

- None. Bracketed-array and newline-separator support were considered and decided against
  (strict surface), not deferred.
