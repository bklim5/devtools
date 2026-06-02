# Phase 8: StatusBar Size-Readout Cleanup - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the shared `StatusBar` byte/size readout **opt-in** so it renders only where input/output
size is meaningful. The `byteCount` prop (currently required) becomes optional; absent → no size
text, present → the existing single-count or `input → output` delta rendering, unchanged.

**Keep the readout on:** Base64/Hex/Bytes, the Protobuf decoder, and both Formatters
(JSON/XML — where the minify delta is meaningful).
**Drop the readout from (status/parse text only):** Hash/Checksum, UUID/ULID, Unix Time, JWT.

**In scope:** the optional `byteCount` API change on `StatusBar`; removing the size readout from
the four drop tools (they keep their `ParseState` label); a `StatusBar` unit test for the optional
branch + per-tool present/absent assertions.
**Out of scope:** the hero decoder (`src/lib/protobuf/decoder.ts`) and its 19 tests stay
byte-for-byte untouched; no new runtime deps; no changes to other `StatusBar` behavior (state
label, error text, timing, encoding chip).
</domain>

<decisions>
## Implementation Decisions

### Keep/drop split
- **D-01:** The roadmap's keep/drop split stands unchanged. **Hash is dropped** even though it is
  the only drop-tool that currently passes a *real* `byteCount` (the others pass a meaningless
  `byteCount={0}`). Confirmed: byte size of the hashed input is not worth surfacing here, and
  consistency across Hash/UUID/Unix Time/JWT wins. Keep set: Base64/Hex/Bytes, Protobuf, both
  Formatters. Drop set: Hash/Checksum, UUID/ULID, Unix Time, JWT.

### Drop-tool appearance
- **D-02:** The drop tools keep their `ParseState` label exactly as-is ("OK"/"Empty"/"Error") —
  only the size text is removed. **No other `StatusBar` behavior changes** (matches success
  criterion #1). The right side (error text, timing) is unaffected. No "quieter on empty"
  behavior — the state label still renders on empty input as it does today.

### API shape
- **D-03:** **Minimal, additive change** — make `byteCount` optional (`byteCount?: number`). The
  size `<span>` renders only when `typeof byteCount === "number"`. The existing branch logic is
  preserved inside that guard: `outputBytes` present → `input → output` delta (which needs
  `byteCount` too), else the single `N byte(s)` count. `outputBytes` passed *without* `byteCount`
  simply renders nothing (the delta requires both). **No discriminated/conditional type** to
  compile-enforce the pairing — keep the presentational component simple.
- **D-04:** Update the four drop tools to stop passing `byteCount` (today they pass `0` or, for
  Hash, the real count). Keep tools (Base64/Protobuf/Formatters) are unchanged — they already pass
  real counts.

### Testing
- **D-05:** Add a `StatusBar` unit test for the optional branch: **absent `byteCount` → no
  `byte count` span; present → it renders** (single count and delta forms). **Plus per-tool
  assertions** — the four drop tools assert the size readout is **absent**; Base64/Protobuf/
  Formatters assert it is **present**. Query the existing `aria-label="byte count"` span
  (`getByLabelText`/`queryByLabelText`) rather than matching on text. Satisfies success
  criterion #4.

### Claude's Discretion
- Exact wording/structure of the optional-`byteCount` JSDoc on `StatusBarProps`.
- Whether per-tool assertions live in each tool's existing test file or a focused addition, as
  long as present-where-kept / absent-where-dropped is covered.
- Minor refactor of the render guard, provided the single-count and delta outputs stay
  byte-identical for existing keep callers.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design spec (authoritative for the StatusBar cleanup framing)
- `docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md` — the approved v1.1 design;
  frames the StatusBar opt-in cleanup as the Phase 8 sibling to the Formatters.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §UIX-01 — the single acceptance criterion for this phase
  (size readout appears only where meaningful; removed from Hash/UUID/Unix Time/JWT).
- `.planning/ROADMAP.md` §"Phase 8: StatusBar Size-Readout Cleanup" — goal + 4 success criteria.

### Code to read before writing
- `src/components/StatusBar.tsx` — the shared status bar; `byteCount` becomes optional here.
  Phase 7 already added the optional `outputBytes` delta prop (D-04/D-05 of Phase 7) — this phase
  is the planned coordinating change.
- `src/components/StatusBar.test.tsx` — existing tests; extend with the optional-branch coverage.
- Drop-tool callers to edit: `src/tools/hash/HashTool.tsx` (passes a **real** count today),
  `src/tools/uuid-ulid/UuidUlidTool.tsx`, `src/tools/unix-time/UnixTimeTool.tsx`,
  `src/tools/jwt/JwtTool.tsx` (last three pass `byteCount={0}`).
- Keep-tool callers (unchanged, assert present): `src/tools/base64/Base64Tool.tsx`,
  `src/tools/protobuf-decoder/*`, `src/tools/json-formatter/JsonFormatterTool.tsx`,
  `src/tools/xml-formatter/XmlFormatterTool.tsx`, `src/components/FormatterView.tsx`.

### Project guardrails
- `CLAUDE.md` and `.planning/PROJECT.md` §Constraints — decoder + 19 tests untouched, no new deps,
  HashRouter only, WCAG-AA, per-task DoD harness order (`/simplify` → `/codex:review` →
  `vitest`+`tsc`+`eslint` → real-WKWebView UI verification), phase-boundary human sign-off on a
  fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit.

### Phase 7 context (coordinating predecessor)
- `.planning/phases/07-formatters/07-CONTEXT.md` §"Status bar size readout" (D-04/D-05) — the
  additive `outputBytes` delta prop this phase coordinates with.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`StatusBar.tsx`**: single small edit — `byteCount?: number` + gate the size `<span>` on
  `typeof byteCount === "number"`. The delta/single-count logic stays inside that guard.
- **`aria-label="byte count"` span**: already present — the stable test hook for present/absent
  assertions (no text-matching needed).
- **`data-status="error"` and other state spans**: unchanged; only the size span is conditional.

### Established Patterns
- Each tool is self-contained under `src/tools/<id>/` with colocated tests; drop-tool edits are
  one-line `<StatusBar>` prop removals plus a test assertion each.
- `StatusBar` is presentational and primitive-only — keep it that way (no tool logic, no new deps).

### Integration Points
- `src/components/StatusBar.tsx` — shared by all tools; the change must stay backward-compatible
  for the keep callers (Base64/Protobuf/Formatters) which already pass real counts.
- Drop-tool components — remove the `byteCount` prop; their `ParseState` label and error/timing
  rendering are untouched.
</code_context>

<specifics>
## Specific Ideas

- Hash is the borderline keep/drop case (the only drop-tool with a real count today); it was
  explicitly confirmed as a **drop** for cross-tool consistency, not left in the keep set.
- Prefer querying the `aria-label="byte count"` span for present/absent rather than asserting on
  rendered text — message-independent and stable.
</specifics>

<deferred>
## Deferred Ideas

- **Richer status-left text for the drop tools** (e.g. Unix Time showing the detected format, Hash
  showing the algorithm) — considered and declined; it would change `StatusBar` behavior beyond
  the opt-in size readout and conflicts with success criterion #1 ("no other behavior changed").
  A future UX phase could revisit if desired.
- **Compile-time enforcement of the `outputBytes`/`byteCount` pairing** (discriminated/conditional
  prop type) — declined in favor of the minimal optional-prop change; revisit only if misuse
  surfaces.

None of the above were scope creep from this discussion — they are alternatives weighed and
declined while clarifying the in-scope work.
</deferred>

---

*Phase: 08-statusbar-size-readout-cleanup*
*Context gathered: 2026-06-02*
