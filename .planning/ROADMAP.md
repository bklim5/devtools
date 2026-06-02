# Roadmap: DevTools

## Milestones

- ✅ **v1.0 Distribution** — Phases 1–6 (shipped 2026-06-01) — see `milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 Formatters** — Phases 7–8 (shipped 2026-06-02) — see `milestones/v1.1-ROADMAP.md`
- 📋 **Next milestone** — TBD (`/gsd-new-milestone` or `/gsd-review-backlog`)

## Phases

<details>
<summary>✅ v1.0 Distribution (Phases 1–6) — SHIPPED 2026-06-01</summary>

- [x] Phase 1: Scaffold + Harness Proof (4/4 plans) — completed 2026-05-30
- [x] Phase 2: Shell (4/4 plans) — completed 2026-05-30
- [x] Phase 3: Hero (Protobuf) + Encoding + UX Constraints (signed off 2026-05-31)
- [x] Phase 4: Catalogue (Unix Time, JWT, Hash, UUID/ULID) — signed off 2026-06-01
- [x] Phase 5: Native Polish (tray/menu, single-instance, window-geometry) — 2026-06-01
- [x] Phase 6: Distribution (signed DMG + signature-verified auto-updater) — signed off 2026-06-01

Full detail: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Formatters (Phases 7–8) — SHIPPED 2026-06-02</summary>

- [x] Phase 7: Formatters — shared `FormatterView` + JSON formatter + XML formatter (zero-dep, native `JSON`/`DOMParser`) — validate/prettify/minify, plus JSON sort-keys (3/3 plans) — completed 2026-06-02
- [x] Phase 8: StatusBar Size-Readout Cleanup — make `StatusBar` byteCount opt-in; keep it on Base64/Protobuf/Formatters, drop it from Hash/UUID/Unix Time/JWT (1/1 plan) — completed 2026-06-02

Full detail: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 📋 Next milestone (Planned)

No phases scheduled yet. Start the next cycle with `/gsd-new-milestone`, or promote a backlog item below with `/gsd-review-backlog`.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold + Harness Proof | v1.0 | 4/4 | Complete | 2026-05-30 |
| 2. Shell | v1.0 | 4/4 | Complete | 2026-05-30 |
| 3. Hero + Encoding + UX | v1.0 | — | Complete | 2026-05-31 |
| 4. Catalogue | v1.0 | — | Complete | 2026-06-01 |
| 5. Native Polish | v1.0 | — | Complete | 2026-06-01 |
| 6. Distribution | v1.0 | — | Complete | 2026-06-01 |
| 7. Formatters | v1.1 | 3/3 | Complete | 2026-06-02 |
| 8. StatusBar Size-Readout Cleanup | v1.1 | 1/1 | Complete | 2026-06-02 |

## Backlog

Unsequenced ideas captured for future planning. Promote with `/gsd-review-backlog` when ready.

### Phase 999.1: More tools for the app (BACKLOG)

**Goal:** [Captured for future planning] — expand beyond the v1 six tools. NOTE: v1 locked "six tools only" — promoting this means deliberately reopening that constraint. There is no code-level limit (registry is a plain array; router/sidebar/palette auto-derive), so growth is mechanical; the constraint is product focus, not architecture. v1.1 already added the JSON + XML formatters from this list; SQL remains parked.

**Candidate tool wishlist (user-provided, categorized):**

- **Converters** — Cron Parser, Date, JSON Array → Table/CSV, JSON ↔ YAML, Number Base
- **Text** — Escape / Unescape, List Comparer, Markdown Preview, Analyzer & Utilities, Text Comparer
- **Encoders / Decoders** — Base64 Image, Base64 Text, Certificate, GZIP, HTML, JWT, QR Code, URL
- **Formatters** — JSON ✓ (v1.1), XML ✓ (v1.1), **SQL** (still parked — needs `sql-formatter` lib; reformats only, can't lint)
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
