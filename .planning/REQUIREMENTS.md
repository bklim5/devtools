# Requirements: DevTools

**Defined:** 2026-06-02
**Milestone:** v1.1 Formatters
**Core Value:** Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, offline, without the mouse.

## v1.1 Requirements

Requirements for the Formatters milestone. Each maps to exactly one roadmap phase.
Design spec: `docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md`.

All requirements inherit the standing product constraints: offline/no-network, paste-instant
(<2s), keyboard-driven, registry-driven, WCAG-AA, layout-agnostic, zero new runtime deps, and the
hero decoder (`src/lib/protobuf/decoder.ts`) + its 19 tests stay untouched.

### Formatters (FMT)

- [x] **FMT-01**: User can paste JSON and see it validated instantly; on invalid input the error is shown as line:col + message
- [x] **FMT-02**: User can prettify JSON with a selectable indent (2 spaces / 4 spaces / tab)
- [x] **FMT-03**: User can minify (compress) JSON to a single line
- [x] **FMT-04**: User can sort JSON object keys recursively (array order preserved)
- [ ] **FMT-05**: User can paste XML and see it validated for well-formedness instantly; on invalid input the parser error is surfaced
- [ ] **FMT-06**: User can prettify XML with a selectable indent, preserving comments, CDATA, attributes, and processing instructions
- [x] **FMT-07**: User can minify (compress) XML by stripping insignificant inter-element whitespace
- [x] **FMT-08**: User can copy the formatted output via a visible, keyboard-focusable control (no hover-only)

### UX Cleanup (UIX)

- [ ] **UIX-01**: The status-bar size readout appears only where input/output size is meaningful (Base64/Hex/Bytes, Protobuf decoder, and the Formatters); it is removed from Hash, UUID/ULID, Unix Time, and JWT (status text only)

## Future Requirements (deferred)

- **SQL formatter** — needs the `sql-formatter` library (only reformats, cannot lint). Parked in backlog 999.1.
- **JSON5 / JSONC** (comments, trailing commas) — strict JSON only for v1.1.
- **XML schema/XSD validation** — well-formedness only for v1.1.
- **DevTools CLI** — invoke tools from the command line (e.g. `devtools hash.sha256 xxx`). Backlog 999.4.

## Out of Scope

- **New runtime dependencies** — both formatters are native (`JSON`, `DOMParser`); the zero-dep ethos holds for v1.1.
- **JSON sort by value / XML node sorting** — only JSON key sort is in scope.
- **Schema-aware formatting / conversion (JSON↔YAML, etc.)** — separate tools, future milestones.

## Traceability

Every v1.1 requirement maps to exactly one phase. Coverage: 9/9.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FMT-01 | Phase 7 | Complete |
| FMT-02 | Phase 7 | Complete |
| FMT-03 | Phase 7 | Complete |
| FMT-04 | Phase 7 | Complete |
| FMT-05 | Phase 7 | Pending |
| FMT-06 | Phase 7 | Pending |
| FMT-07 | Phase 7 | Complete |
| FMT-08 | Phase 7 | Complete |
| UIX-01 | Phase 8 | Pending |

---
*Last updated: 2026-06-02 — v1.1 Formatters roadmap created (Phases 7–8); traceability mapped*
