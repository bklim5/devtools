# Roadmap: DevTools — v1.1 Formatters

## Overview

v1.0 shipped the six-tool, distributable, self-updating macOS app (Phases 1–6, signed off 2026-06-01). **v1.1 "Formatters"** adds the first two post-v1.0 tools — a **JSON formatter** and an **XML formatter** — both implemented **zero-runtime-dependency** over native browser APIs (`JSON`, `DOMParser`), in a shared two-pane paste-instant `FormatterView` that follows the existing tool patterns exactly. A small sibling cleanup makes the shared `StatusBar` byte-count readout **opt-in** so it only appears where input/output size is meaningful.

The work splits along the boundary the approved design spec prescribes (`docs/superpowers/specs/2026-06-02-json-xml-formatters-design.md`): **Phase 7** delivers the `FormatterView` + both formatter tools (FMT-01..08); **Phase 8** ships the opt-in `StatusBar` cleanup (UIX-01) once the Formatters are consuming `StatusBar`, so the keep/drop decision is made against a complete, real set of callers. Every phase is gated by the standing binding harness — per-task DoD (`/simplify` → `/codex:review` → `vitest`+`tsc`+`eslint` green → real-WKWebView UI verification) and a phase-boundary human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit. Plans within a phase may run in parallel but never bypass those gates. The hero decoder (`src/lib/protobuf/decoder.ts`) and its 19 tests stay byte-for-byte untouched; no new runtime dependencies; HashRouter only; offline-by-design holds.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order. v1.1 continues the project's phase sequence — v1.0 ended at Phase 6, so v1.1 starts at **Phase 7** (numbering does NOT reset).

- [ ] **Phase 7: Formatters** - Shared `FormatterView` + JSON formatter tool + XML formatter tool (zero-dep, native `JSON`/`DOMParser`) — validate/prettify/minify, plus JSON sort-keys
- [ ] **Phase 8: StatusBar Size-Readout Cleanup** - Make `StatusBar` byteCount opt-in; keep it on Base64/Protobuf/Formatters, drop it from Hash/UUID/Unix Time/JWT

## Phase Details

### Phase 7: Formatters
**Goal**: Two new tools — `json-formatter` and `xml-formatter` under `category: "formatting"` — ship into the registry-driven shell behind a shared two-pane paste-instant `FormatterView`, giving the user a jsonlint-style validate/prettify/minify (+ JSON sort-keys) experience entirely offline with zero new runtime dependencies.
**Depends on**: Nothing within v1.1 (builds on the shipped v1.0 shell, registry, `StatusBar`, `CopyButton`/`useCopyFeedback`, and platform clipboard seam)
**Requirements**: FMT-01, FMT-02, FMT-03, FMT-04, FMT-05, FMT-06, FMT-07, FMT-08
**Success Criteria** (what must be TRUE):
  1. Pasting JSON validates instantly (no format button) and renders the prettified result; invalid JSON clears the output pane and surfaces the error as **line:col + message** in the status bar, and empty input shows an "empty" status (not an error) — FMT-01.
  2. The JSON tool's toolbar drives the output live: selectable indent **2 / 4 / tab** (FMT-02), a **minify** toggle that compresses to a single line (FMT-03, minify wins over prettify when on), and a **sort-keys** toggle that recursively sorts object keys while preserving array order (FMT-04).
  3. Pasting XML validates well-formedness instantly via `DOMParser`; a `<parsererror>` surfaces its message (with line where the engine provides one) and clears the output (FMT-05); prettify re-emits with the selected indent **preserving comments, CDATA, attributes, and processing instructions** (FMT-06); and minify strips insignificant inter-element whitespace (FMT-07).
  4. Each tool's output pane exposes a **visible, keyboard-focusable copy control** reachable in ≤1 keystroke (no hover-only), copying through the platform clipboard seam (FMT-08).
  5. Both tools appear in the sidebar, ⌘K palette, and router solely by appending to the `TOOLS` array (single control plane, no other wiring); they are layout-agnostic (responsive Tailwind, no fixed widths); the pure formatters live in `src/lib/format/` and are independently unit-tested (TDD); and the phase ends with the decoder's 19 tests still green, a passing `gsd-ui-review` WCAG-AA audit, and human sign-off on a fresh `tauri build`.
**Plans**: 3 plans
- [x] 07-01-shared-foundation-PLAN.md — promote ResizableSplit to shared, additive StatusBar byte-delta, shared FormatResult type
- [x] 07-02-json-formatter-PLAN.md — pure formatJson + shared FormatterView + json-formatter tool + registry + e2e
- [ ] 07-03-xml-formatter-PLAN.md — pure formatXml (DOMParser) + xml-formatter tool + registry + e2e
**UI hint**: yes

### Phase 8: StatusBar Size-Readout Cleanup
**Goal**: The shared `StatusBar` byte-count readout becomes opt-in so it appears only where input/output size is meaningful — kept on Base64/Hex/Bytes, the Protobuf decoder, and the new Formatters; removed (status text only) from Hash, UUID/ULID, Unix Time, and JWT.
**Depends on**: Phase 7 (the `FormatterView`/Formatters land first and consume `StatusBar` for the minify size delta, so the opt-in `byteCount` change is made against the complete, real set of callers — and the keep/drop split is verified end-to-end)
**Requirements**: UIX-01
**Success Criteria** (what must be TRUE):
  1. `StatusBar`'s `byteCount` prop is **optional** and the size readout renders only when a caller provides it (absent prop → no size text), with no other `StatusBar` behavior changed.
  2. The byte/size readout is **present** on Base64/Hex/Bytes, the Protobuf decoder, and both Formatters (where the minify delta, e.g. `1,240 → 890 bytes`, is meaningful).
  3. The byte/size readout is **absent** on Hash/Checksum, UUID/ULID, Unix Time, and JWT — those tools show parse/status text only.
  4. Affected tools' tests assert byte count is present where kept and absent where dropped; the decoder and its 19 tests stay untouched; and the phase ends with a passing `gsd-ui-review` WCAG-AA audit and human sign-off on a fresh `tauri build`.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Formatters | 0/3 | Not started | - |
| 8. StatusBar Size-Readout Cleanup | 0/TBD | Not started | - |

## Backlog

Unsequenced ideas captured for future planning. Promote with `/gsd-review-backlog` when ready.

### Phase 999.1: More tools for the app (BACKLOG)

**Goal:** [Captured for future planning] — expand beyond the v1 six tools. NOTE: v1 locked "six tools only" — promoting this means deliberately reopening that constraint. There is no code-level limit (registry is a plain array; router/sidebar/palette auto-derive), so growth is mechanical; the constraint is product focus, not architecture.

**Candidate tool wishlist (user-provided, categorized):**

- **Converters** — Cron Parser, Date, JSON Array → Table/CSV, JSON ↔ YAML, Number Base
- **Text** — Escape / Unescape, List Comparer, Markdown Preview, Analyzer & Utilities, Text Comparer
- **Encoders / Decoders** — Base64 Image, Base64 Text, Certificate, GZIP, HTML, JWT, QR Code, URL
- **Formatters** — JSON, SQL, XML  ← **active focus (being designed now; see spec under docs/superpowers/specs/)**
- **Generators** — Hash / Checksum, Lorem Ipsum, Password, UUID
- **Graphic** — Color Blind Simulator, Image Converter
- **Testers** — JSONPath, Regular Expression, XML / XSD

Each candidate must still pass the product wedge: offline/no-network, paste-instant (<2s), keyboard-driven, registry-driven, WCAG-AA, and the build+verify harness.

**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.2: CI integration (BACKLOG)

**Goal:** [Captured for future planning] — automate the build+verify harness in CI (vitest + tsc + eslint + real-WKWebView e2e, and possibly `tauri build` + release publishing to the public releases repo).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: Theme settings (BACKLOG)

**Goal:** [Captured for future planning] — user-facing theme/appearance settings (beyond the current theme/accent persistence), e.g. light/dark/system toggle and accent customization in a settings surface.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: DevTools CLI (BACKLOG)

**Goal:** [Captured for future planning] — let users invoke the tools from the command line, e.g. `devtools hash.sha256 xxx` to print a SHA-256 hash, `devtools base64.encode ...`, etc. Implies sharing the pure transform logic (`src/lib/`) between the GUI and a CLI entrypoint so behavior stays identical. Open questions for promotion: distribution of the CLI binary (bundled with the app vs separate), namespacing/command grammar (`tool.action`), stdin/pipe support, and how it coexists with the offline/no-network ethos (a CLI is inherently offline-friendly). The pure-logic-in-`src/lib/` separation already in place is the enabler.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
