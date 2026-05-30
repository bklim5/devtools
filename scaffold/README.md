# scaffold/

Verified starter code. Cleanly split into **port-unchanged** and **rebuild-against-design** halves.

## Port unchanged — `src/lib/`

These files have been written, executed, and tested. Copy them into the new project's `src/lib/` exactly as-is. After porting, run vitest to confirm the test bar holds.

| File | What it is |
|---|---|
| `src/lib/protobuf/decoder.ts` | ~295 lines, zero deps. The schema-less wire-format decoder. Hero feature logic. |
| `src/lib/protobuf/decoder.test.ts` | **19 vitest cases** — the spec for the decoder. |
| `src/lib/bytes.ts` | `Uint8Array` ↔ base64 / base64url / hex with feature-detect + polyfill. |
| `src/lib/tools/types.ts` | The extended `ToolDefinition` contract — id, name, icon, lazy, status, premium, shortcuts. |
| `src/lib/tools/registry.ts` | Central registry; sidebar/palette/router all read from here. |

### What the 19 decoder tests cover

- **Happy path (7):** canonical `{1:150}`, string LEN, nested message, zigzag, I32 float, I64 double, BigInt at `2^53+1`.
- **Errors (4):** truncated varint, group wire type, field number 0, runaway varint with 11 continuation bytes.
- **Hardening (2):** oversize payload rejected, deep nesting bounded by `MAX_DEPTH`.
- **Packed-repeated (3):** packed varints recognised, packed fixed32 recognised, non-multiple-of-4 correctly excluded.
- **Fuzz (1):** 3000 seeded random byte buffers — every result is either a parse or an `Error` (no crashes, no hangs).
- **Golden (2):** hand-verified composite message, Person-shaped message.

**Treat any regression as a blocker.** The decoder is the hero feature; the test bar *is* the spec.

## Rebuild against the design — `src/components/`, `src/tools/`, `src/App.tsx`, `src/main.tsx`, `src/router.tsx`

These exist as React-structure reference only. They were written with a generic Tailwind palette before `design/DevTools Mockup.html` was available — the *structure* is fine (how the router wires the registry; how each tool component composes; how the sidebar reads from the registry), but the *visual layer* must be rebuilt to match the canonical design.

When rebuilding:
- Use the design's CSS variables (`--bg-app`, `--win`, `--titlebar`, `--sidebar`, `--pane`, `--panel`, `--accent`, etc.) rather than ad-hoc colours.
- Use the design's typography (IBM Plex Sans, JetBrains Mono — self-hosted).
- Match the design's component composition (the field cards, the chip rows, the resizable workspace divider, the status bar).
- Apply the binding constraints from `docs/design-and-plan.md` §9 — especially the chip set must drive off `LenInterpretation` directly, and `#N` must be neutral.

## Open questions

None specific to this directory. The architectural decisions encoded here (HashRouter, the registry contract, the BigInt decoder approach) are settled in `docs/design-and-plan.md`. If you find yourself wanting to refactor `src/lib/`, raise it to the user first — the verification cost is high.
