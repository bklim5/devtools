# Roadmap: DevTools

## Milestones

- ✅ **v1.0 Distribution** — Phases 1–6 (shipped 2026-06-01) — see `milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 Formatters** — Phases 7–8 (shipped 2026-06-02) — see `milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Release Tooling** — Phases 9–11 (shipped 2026-06-03) — see `milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 More Tools** — Phases 12–15 (shipped 2026-06-04) — see `milestones/v1.3-ROADMAP.md`
- 🚧 **v1.4 Reorderable Tools** — Phase 16 (in progress)

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

<details>
<summary>✅ v1.2 Release Tooling (Phases 9–11) — SHIPPED 2026-06-03</summary>

Local release-automation helper scripts over a unit-tested pure core in `src/lib/release/` (zero new runtime deps; hero decoder + its 19 tests byte-untouched). CI parked to backlog 999.2.

- [x] Phase 9: Pure release core + housekeeping — `src/lib/release/version.ts` (bumpSemver + 3 surgical manifest editors) + `manifest.ts` (dual-key `buildLatestJson`); Cargo 0.1.0→0.2.1 reconcile (REL-02), `latest.json` untracked (REL-08) — completed 2026-06-02
- [x] Phase 10: `bump-and-tag` driver — `scripts/bump-and-tag.mjs` + `pnpm release:bump`: lockstep 3-manifest bump + lockfile regen (REL-01/03), `vX.Y.Z` tag + push to origin (REL-04), `--dry-run` (REL-10) + preflights (REL-11); live v0.2.2 cut — completed 2026-06-02
- [x] Phase 11: `build-and-publish` driver + universal binary — `scripts/build-and-publish.mjs` + `pnpm release:publish`: universal `tauri build` (REL-05), fresh-`.sig` dual-key `latest.json` (REL-06), cross-repo `gh` publish (REL-07), `APPLE_*` passthrough (REL-09), post-publish `curl` verify (REL-12); live v0.2.2 published + DST-02 updater round-trip proven on real hardware — completed 2026-06-03

All 12 REL requirements complete. Full detail: `.planning/milestones/v1.2-ROADMAP.md` · audit: `milestones/v1.2-MILESTONE-AUDIT.md`

</details>

<details>
<summary>✅ v1.3 More Tools (Phases 12–15) — SHIPPED 2026-06-04</summary>

Three new high-frequency tools (URL, Regex, Cron) + a Protobuf decimal-byte-array input mode — eight tools → eleven. Four fully-independent features, risk-ordered; zero new runtime deps; hero `decoder.ts` + its 19 tests byte-for-byte untouched throughout.

- [x] Phase 12: Protobuf decimal input — comma/space-separated decimal byte array as a third auto-detected input mode (`decimalToBytes` in `src/lib/bytes.ts`; decoder untouched); PRO-08/09 — completed 2026-06-03
- [x] Phase 13: URL tool (9th) — parse into components + query key→value table, component-vs-full encode/decode both ways over native `URL`/`URLSearchParams`; extracted shared `SegmentedControl`; URL-01..05 — completed 2026-06-03
- [x] Phase 14: Regex tester (10th) — live highlighted matches, capture-group breakdown, g/i/m/s/u flags, `$1`/`$<name>`/`$&` replace preview, 3-pattern library, ReDoS-safe via a Web Worker + timeout watchdog; RGX-01..07 — completed 2026-06-03
- [x] Phase 15: Cron tool (11th) — paste → 24h description + next 5 runs in local time with IANA TZ label; 5/6-field, macros, full syntax, DOM/DOW OR-union, DST-correct bounded next-run, isolated `L`/`nL`/`L-n` slice; CRON-01..11 — completed 2026-06-04

All 25 requirements complete. Full detail: `.planning/milestones/v1.3-ROADMAP.md` · requirements: `milestones/v1.3-REQUIREMENTS.md`

</details>

### 🚧 v1.4 Reorderable Tools (Phase 16) — IN PROGRESS

A focused single-feature milestone: a user-reorderable sidebar tool list. Drag-to-reorder (handle-initiated native drag, no dnd library) plus an accessible Alt+↑/↓ keyboard path with `aria-live` announcements, the custom order persisted as a `toolOrder` overlay over the registry, with graceful reconciliation for new/removed tools and a reset-to-default action. Promoted from backlog 999.6 (12 locked decisions). Zero new runtime deps; WCAG-AA; registry stays the single control plane; `decoder.ts` + its 19 tests untouched.

- [ ] Phase 16: Reorderable sidebar tool list — drag + Alt+↑/↓ keyboard reorder, `aria-live` announcements, persisted `toolOrder` overlay, new-tool-append reconciliation, reset-to-default; REORD-01..07

## Phase Details

### Phase 16: Reorderable Sidebar Tool List
**Goal**: A user can reorder the sidebar tools to suit their own workflow — by drag-and-drop or by keyboard — and that order is remembered across restarts, while the registry stays the canonical source of truth.
**Depends on**: Phase 2 (Shell — `Sidebar.tsx`, registry projection) and Phase 5 (`usePreferences` / `platform.store` persistence seam); both shipped. No intra-milestone dependencies (single phase).
**Requirements**: REORD-01, REORD-02, REORD-03, REORD-04, REORD-05, REORD-06, REORD-07
**Success Criteria** (what must be TRUE):
  1. A user can grab a sidebar tool by its grip handle and drag it to a new position — a subtle, neutral (non-accent) insertion line shows where it will land — and a plain click on a tool still navigates to it without ever starting a drag. *(REORD-01, REORD-02)*
  2. A keyboard user can focus a tool's handle and press Alt+↑ / Alt+↓ to move it one slot per press; plain arrow keys remain unbound in the sidebar (no roving navigation introduced), and the moved tool keeps keyboard focus. *(REORD-03)*
  3. Every reorder (drag or keyboard) is announced through an `aria-live="polite"` region — e.g. "Moved Cron to position 3 of 11" — so the change is perceivable without sight (WCAG-AA). *(REORD-04)*
  4. The custom order survives an app restart: it is stored as a `toolOrder: string[]` of tool IDs through the existing preferences/store seam, applied as a render-time overlay over `ENABLED_TOOLS` (registry array unchanged; ⌘K palette and router stay order-agnostic). *(REORD-05)*
  5. On load the saved order is reconciled against the live registry — a tool shipped in a later version appears at the bottom, an order referencing an unknown/removed ID is ignored — so the list never crashes, drops, or duplicates a tool; and a "Reset order" action restores the default registry order. *(REORD-06, REORD-07)*
**Plans**: 2 plans
- [ ] 16-01-PLAN.md — Persistence + pure ordering/reconciliation backbone (toolOrder field + coercion + setToolOrder + pure reconcileToolOrder/moveToolInOrder helpers with vitest coverage); REORD-05/06/07
- [ ] 16-02-PLAN.md — Reorderable Sidebar UI (grip-handle native drag + neutral insertion line, Alt+↑/↓ keyboard reorder, aria-live announcements, reset affordance) + real-WKWebView e2e + phase sign-off; REORD-01..07
**UI hint**: yes

**Inherited binding constraints**: zero new runtime dependencies (native HTML5 drag events or a small pure pointer handler — no dnd/animation library); WCAG-AA (the keyboard path + `aria-live` are mandatory, not optional); registry is the single control plane (ordering is a presentation overlay, never a registry mutation); accent = selected-only (drop indicator must be neutral/subtle); `decoder.ts` + its 19 tests stay byte-for-byte untouched; macOS real-WKWebView UI gate + per-task `/codex:review` → unit (`vitest`/`tsc`) → real-webview verification, with human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit at the phase boundary.

## Progress

**Execution Order:**
Phases execute in numeric order. v1.4 is a single phase (16) continuing from v1.3's Phase 15.

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
| 9. Pure release core + housekeeping | v1.2 | 2/2 | Complete   | 2026-06-02 |
| 10. bump-and-tag driver | v1.2 | 3/3 | Complete    | 2026-06-02 |
| 11. build-and-publish driver + universal binary + safety rails | v1.2 | 3/3 | Complete    | 2026-06-03 |
| 12. Protobuf decimal input | v1.3 | 2/2 | Complete    | 2026-06-03 |
| 13. URL tool | v1.3 | 2/2 | Complete    | 2026-06-03 |
| 14. Regex tester | v1.3 | 3/3 | Complete    | 2026-06-03 |
| 15. Cron tool | v1.3 | 4/4 | Complete    | 2026-06-04 |
| 16. Reorderable sidebar tool list | v1.4 | 0/0 | Not started | - |

## Backlog

Unsequenced ideas captured for future planning. Promote with `/gsd-review-backlog` when ready.

### Phase 999.1: More tools for the app (PROMOTED → v1.3 More Tools, in progress)

**Status:** PROMOTED — the Cron, URL, Regex tools + Protobuf decimal-byte-array input are being delivered as milestone v1.3 "More Tools" (Phases 12–15). What remains parked here is the rest of the candidate wishlist below (SQL formatter still needs a lib; Date, JSON↔YAML, Number Base, Escape/Unescape, comparers, etc. unscheduled).

**Goal:** [Captured for future planning] — expand beyond the v1 six tools. NOTE: v1 locked "six tools only" — promoting this means deliberately reopening that constraint. There is no code-level limit (registry is a plain array; router/sidebar/palette auto-derive), so growth is mechanical; the constraint is product focus, not architecture. v1.1 already added the JSON + XML formatters from this list; v1.3 adds Cron + URL + Regex; SQL remains parked.

**Candidate tool wishlist (user-provided, categorized):**

- **Converters** — Cron Parser ✓ (v1.3), Date, JSON Array → Table/CSV, JSON ↔ YAML, Number Base
- **Text** — Escape / Unescape, List Comparer, Markdown Preview, Analyzer & Utilities, Text Comparer
- **Encoders / Decoders** — Base64 Image, Base64 Text, Certificate, GZIP, HTML, JWT, QR Code, URL ✓ (v1.3)
- **Formatters** — JSON ✓ (v1.1), XML ✓ (v1.1), **SQL** (still parked — needs `sql-formatter` lib; reformats only, can't lint)
- **Generators** — Hash / Checksum, Lorem Ipsum, Password, UUID
- **Graphic** — Color Blind Simulator, Image Converter
- **Testers** — JSONPath, Regular Expression ✓ (v1.3), XML / XSD

Each candidate must still pass the product wedge: offline/no-network, paste-instant (<2s), keyboard-driven, registry-driven, WCAG-AA, and the build+verify harness.

**Requirements:** TBD (remaining wishlist; Cron/URL/Regex requirements now in `.planning/REQUIREMENTS.md` for v1.3)
**Plans:** 4/4 plans complete

Plans:
- [ ] TBD (promote remaining wishlist with /gsd-review-backlog when ready)

### Phase 999.2: Release automation + CI integration (BACKLOG)

**Goal:** [Captured for future planning] — **the local-scripts half of this item is being delivered as milestone v1.2 (Phases 9–11); what remains parked here is the CI track.** Wire CI on top of the v1.2 scripts: CI checks (vitest + tsc + eslint) on every push/PR to main/master, and a tag-triggered CI release later (an Actions runner cuts the signed release).

**Pre-discussion decisions (captured 2026-06-02, before formal milestone planning):**

1. **Trigger model:** a git **tag push `vX.Y.Z`** cuts the signed release + updater bump. **CI checks (vitest + tsc + eslint) run on every push/PR to main/master REGARDLESS of publishing.** (Real-WKWebView e2e in CI is a stretch goal — macOS-runner + webview-automation cost.)
2. **Version bump = local helper script first, CI-integratable later.** Something like `pnpm release [patch|minor|major]` that bumps `package.json` + `src-tauri/tauri.conf.json` **in lockstep** (the D-16 lockstep from RELEASE.md; Cargo.toml is currently 0.1.0 and NOT part of it — decide whether to include it), commits, creates the `vX.Y.Z` tag, and pushes (push is what fires the release). **→ delivered in v1.2 Phases 9–10 (Cargo.toml folded into the lockstep).**
3. **App semver (`0.2.x`) stays DECOUPLED from GSD milestone tags (`v1.1`).** Two numbering systems on purpose: GSD `vMAJOR.MINOR` tracks planning milestones; app `vX.Y.Z` is what the updater compares. The release pipeline keys off the **app** version.
4. **Split the automation into two scripts** (both local now, both CI-callable later):
   - **bump-and-tag** (decision #2 above). **→ v1.2 Phase 10.**
   - **build-and-publish** — runs `pnpm tauri build`, then **generates `latest.json` from the FRESH `*.app.tar.gz.sig`** (automating the fragile manual paste RELEASE.md §5 warns about — never reuse a stale `.sig`), creates the GitHub Release on `bklim5/devtools-releases`, and uploads DMG + `.app.tar.gz` + `latest.json`. **→ v1.2 Phase 11.**

**Context the milestone must fold in (from RELEASE.md + repo state, 2026-06-02):**

- **Split-repo publish:** private source `bklim5/devtools` → public `bklim5/devtools-releases` (assets + `latest.json` only). Updater endpoint pinned to `releases/latest/download/latest.json` on the public repo. CI publishing across repos needs a **cross-repo PAT** — the default `GITHUB_TOKEN` cannot write releases to a different repo. **(Local `gh` auth suffices for v1.2; the cross-repo PAT stays parked here for CI.)**
- **Signing secrets:** minisign **private key (`~/.tauri/devtools.key`) + password** must move into **GitHub Actions secrets** for CI release (mandatory; DST-02 verify-before-apply). Only the public key is in the repo (`tauri.conf.json` `plugins.updater.pubkey`). **(v1.2 reads these from the local env; Actions secrets stay parked here.)**
- **arm64-only gap (Pitfall 7):** a local Apple-Silicon build serves only `darwin-aarch64`. Intel/`darwin-x86_64` or `--target universal-apple-darwin` coverage is a CI-phase improvement to consider. **→ closed in v1.2 Phase 11 (universal binary).**
- **Apple notarisation stays DEFERRED** (ad-hoc signing) until Apple Developer enrolment (D-02) — but scripts should be **notarisation-ready** (honor `APPLE_*` env if present, per RELEASE.md "post-enrolment flip"). **→ notarisation-ready honored in v1.2 Phase 11; activation still deferred.**
- **macOS runner required** for `tauri build`; private-repo Actions minutes are billed — a reason CI *release* is deferred while CI *checks* run regardless.
- **Stale committed `latest.json`** at repo root (currently 0.2.1) — decide whether to keep it generated-only / stop committing it. **→ v1.2 Phase 9 (generate-only, untracked).**

**Requirements:** TBD (the remaining CI track — define during a future `/gsd-new-milestone`)
**Plans:** 0 plans

Plans:
- [ ] TBD (promote the remaining CI track with /gsd-review-backlog or seed `/gsd-new-milestone` when ready)

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

### Phase 999.5: Protobuf decoder schema-file support (BACKLOG)

**Goal:** [Captured for future planning] — let the user supply a `.proto` schema file so the Protobuf decoder can render *named, typed* fields (e.g. `user_id` instead of `#1`, enums by name, nested message types) instead of the schema-less wire-format-only tree. This is an **additive, opt-in mode layered on top of the hero** — the schema-less decoder stays the default and the product wedge ("paste an unknown blob → usable interpretation in <2s, no setup"); a schema, when provided, only enriches the readout. **Key tension to resolve at promotion:** schema-less decoding is the explicit hero feature and "no setup / no accounts" is a binding constraint, so any schema mode must not dilute the paste-instant zero-config path — schema is an enhancement a power user reaches for, never a precondition. **Open questions:** parsing `.proto` without a new runtime dep (the constraint is zero-new-runtime-deps; a `.proto` parser is non-trivial — may need a vendored/pure parser or a deliberate dep exception decided at promotion); how the schema is supplied offline (file picker / paste / drag-drop, no network fetch of imports); handling `import` statements and well-known types; mismatches between schema and actual bytes (fall back to the schema-less view, never crash); and keeping `decoder.ts` + its 19 tests untouched (the schema layer wraps/annotates the existing wire-format output rather than modifying the core decoder).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Drag-and-drop reorder the tool list (✅ PROMOTED → v1.4 Phase 16)

**Status:** PROMOTED into milestone v1.4 "Reorderable Tools" as **Phase 16** (2026-06-04). Requirements REORD-01..07. Its 12 design decisions moved with it to `.planning/phases/16-reorderable-sidebar-tool-list/16-CONTEXT.md`. See the v1.4 milestone section above for the live phase. (The pinning idea it split out remains an unscheduled future feature.)

**Goal:** [Captured for future planning] — let the user drag-and-drop to reorder the tools in the sidebar (and the order should persist), so the most-used tools can sit at the top instead of the fixed registry order. **Architectural fit:** the registry (`src/lib/tools/registry.ts`) is the single control plane — sidebar, ⌘K palette, and router all derive from it — so a user-defined ordering is a presentation-layer overlay (a persisted array of tool IDs applied over the registry), NOT a mutation of the registry array itself; the registry stays the canonical source. **Open questions for promotion:** persistence via the existing `platform.store` seam (a `toolOrder: string[]` pref, same mechanism as theme/last-used — no new dep); keyboard-accessible reordering (WCAG-AA is binding — drag-drop alone is insufficient; needs a keyboard affordance, e.g. move-up/down or an aria-grabbed pattern); how new tools shipped in a later version slot into an existing custom order (append unknown IDs); whether the ⌘K palette and router care about order (they shouldn't — only the sidebar render order changes); and a reset-to-default affordance. Zero-new-runtime-deps still applies (HTML5 drag events or a small pure handler, not a dnd library).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
