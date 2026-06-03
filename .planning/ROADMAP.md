# Roadmap: DevTools

## Milestones

- ✅ **v1.0 Distribution** — Phases 1–6 (shipped 2026-06-01) — see `milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 Formatters** — Phases 7–8 (shipped 2026-06-02) — see `milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Release Tooling** — Phases 9–11 (shipped 2026-06-03) — see `milestones/v1.2-ROADMAP.md`
- 🚧 **v1.3 More Tools** — Phases 12–15 (in progress) — Cron + URL + Regex tools + Protobuf decimal-byte-array input

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

### 🚧 v1.3 More Tools (Phases 12–15) — IN PROGRESS

**Milestone Goal:** Add three new high-frequency tools (Cron, URL, Regex) and extend the Protobuf hero with a decimal-byte-array input mode — each clearing the product wedge with zero new runtime deps. Eight tools → eleven.

The four features are fully independent (no inter-feature dependencies); phase order is purely risk-driven (research SUMMARY, HIGH confidence): smallest/safest first (Protobuf decimal de-risks the untouched-decoder promise), then the thin native-API URL view, then the two deep features (Regex UI + ReDoS structural risk; Cron hand-rolled next-run + DST + the isolated `L`/`nL` slice) last so verification budget concentrates on them. Every phase inherits the binding wedge: offline/no-network, paste-instant (<2s), keyboard-driven, registry-driven single control plane, HashRouter only, WCAG-AA, layout-agnostic components, **zero new runtime dependencies**, and **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**.

- [ ] **Phase 12: Protobuf decimal input** — accept a comma/space-separated decimal byte array as a third auto-detected Protobuf input mode (`decimalToBytes` in `src/lib/bytes.ts`; decoder untouched)
- [ ] **Phase 13: URL tool** — parse a URL into components + query key→value table, component-vs-full encode/decode both ways (native `URL`/`URLSearchParams`/`encodeURI(Component)`)
- [ ] **Phase 14: Regex tester** — live highlighted matches, capture-group breakdown, flag toggles, `$1`/`$<name>`/`$&` replace preview, 3-pattern library, ReDoS-safe via a Web Worker + timeout
- [ ] **Phase 15: Cron tool** — paste an expression → 24h human-readable description + next 5 runs in local time with IANA TZ label; 5/6-field, macros, full field syntax, DOM/DOW OR, DST-correct, and the isolated `L`/`nL` slice

## Phase Details

### Phase 12: Protobuf decimal input
**Goal**: The Protobuf hero accepts a comma/space-separated decimal byte array as a third input mode, auto-detected alongside hex/base64, while `decoder.ts` and its 19 tests stay byte-for-byte untouched.
**Depends on**: Nothing (independent feature; first by risk order — de-risks the untouched-decoder constraint and forces the auto-detection precedence decision early)
**Requirements**: PRO-08, PRO-09
**Success Criteria** (what must be TRUE):
  1. User can paste `10, 3, 80, 81, 82` (comma/space separated) and the decoder decodes it as decimal bytes, paste-instant.
  2. Decimal mode is auto-detected by the rule "a comma anywhere ⇒ decimal list, all tokens integers 0–255," shown via a visible detected-mode indicator the user can override.
  3. Invalid decimal input (token >255, negative, non-integer, unparseable) surfaces a clear inline error without crashing the tool.
  4. `decoder.ts` and its 19 tests are unmodified (verified via `git diff`); the parse lives in a new `decimalToBytes` in `src/lib/bytes.ts`.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] TBD (planned via `/gsd-plan-phase 12`)

### Phase 13: URL tool
**Goal**: A new URL tool parses a pasted URL into its components and query table, and encodes/decodes strings at both the component and full-string level, all over native `URL`/`URLSearchParams`/`encodeURI(Component)` with errors surfaced as values.
**Depends on**: Nothing (independent feature; sequenced second as the lowest-novelty pure-logic view — establishes the bespoke "parsed-components readout + key→value table" layout and the extracted shared `Toggle`)
**Requirements**: URL-01, URL-02, URL-03, URL-04, URL-05
**Success Criteria** (what must be TRUE):
  1. User can encode/decode a string at the component level (`encodeURIComponent`/`decodeURIComponent`), both directions, paste-instant.
  2. User can encode/decode at the full-string level (`encodeURI`/`decodeURI`), with the component-vs-full distinction made clear in the UI.
  3. User can paste a URL and see it split into scheme / host / port / path / query / fragment.
  4. User sees the query string as a key→value table, including repeated keys (`getAll`) and empty values, each value decoded.
  5. A malformed/relative URL or bad percent-sequence surfaces a clear inline error without throwing.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] TBD (planned via `/gsd-plan-phase 13`)

### Phase 14: Regex tester
**Goal**: A new Regex tester runs a user-supplied pattern against sample text with live highlighted matches, capture-group breakdown, flag toggles, and a replace preview — and a catastrophic-backtracking pattern can never freeze the window because matching runs in a Web Worker with a timeout watchdog.
**Depends on**: Nothing (independent feature; sequenced second-to-last — highest UI novelty plus the structural ReDoS risk, so it gets concentrated UI-verification budget). Flagged for `/gsd-research-phase` at plan time (Web-Worker-vs-debounce model, highlight-overlay technique, Vite worker bundling).
**Requirements**: RGX-01, RGX-02, RGX-03, RGX-04, RGX-05, RGX-06, RGX-07
**Success Criteria** (what must be TRUE):
  1. User can test a regex against sample text and see all matches highlighted, paste-instant, with a per-match capture-group breakdown (numbered and named groups).
  2. User can toggle flags `g`, `i`, `m`, `s`, `u` and matching updates live.
  3. User sees a live replace/substitution preview supporting `$1`, `$<name>`, and `$&`.
  4. User can insert a pattern from a small common-pattern library (email, URL, IPv4).
  5. A catastrophic-backtracking pattern does not freeze the window — matching runs in a Web Worker with a timeout watchdog; on timeout the user sees a clear "pattern timed out" message and the UI stays responsive.
  6. An invalid regex surfaces a clear inline error without throwing; highlighting renders escaped text safely (span overlay, never `dangerouslySetInnerHTML`).
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] TBD (planned via `/gsd-plan-phase 14`)

### Phase 15: Cron tool
**Goal**: A new Cron tool parses an expression into a 24-hour human-readable description and computes the next 5 run times in local time (with an IANA timezone label) over a hand-rolled, DST-correct, bounded next-run iterator — supporting 5/6-field, macros, full field syntax, DOM/DOW OR-union semantics, and last-day / last-weekday (`L`/`nL`/`L-n`) as an isolated high-risk slice.
**Depends on**: Nothing (independent feature; sequenced last as the highest logic novelty + most unit-test surface). Flagged for `/gsd-research-phase` at plan time (DST wall-clock read-back, the bounded field-jump algorithm, and `L`/`nL` leap-year/month-length fixtures). The `L`/`nL` work (CRON-10) is planned as an explicitly isolated final plan with dedicated edge-case fixtures so the rest of cron ships even if it proves hard.
**Requirements**: CRON-01, CRON-02, CRON-03, CRON-04, CRON-05, CRON-06, CRON-07, CRON-08, CRON-09, CRON-10, CRON-11
**Success Criteria** (what must be TRUE):
  1. User can paste a 5-field or 6-field (with-seconds) cron expression, or a macro (`@yearly`/`@monthly`/`@weekly`/`@daily`/`@hourly`/`@reboot`), and see a human-readable description in 24-hour time, paste-instant — with full field syntax supported (`*`, ranges, steps, lists, and `MON`/`JAN` names).
  2. User sees the next 5 run times in local time, each with an IANA timezone label; computation honors cron's day-of-month / day-of-week OR-union semantics, treats `0` and `7` as Sunday, and is DST-correct (iterates wall-clock fields, not millisecond deltas).
  3. User can use last-day / last-weekday syntax (`L`, `nL`, `L-n`) and see correct, leap-year- and month-length-aware next-run times.
  4. `@reboot` is described as run-at-startup with no scheduled next-run (no clock computation attempted).
  5. An impossible/never-firing expression (e.g. `0 0 30 2 *`) terminates gracefully with a clear "no upcoming runs" message via a bounded iteration cap — it never freezes the window.
  6. An invalid cron expression (wrong field count, out-of-range value, unparseable token) surfaces a clear inline error without throwing.
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] TBD (planned via `/gsd-plan-phase 15`)

## Progress

**Execution Order:**
Phases execute in numeric order. v1.3 phases (12–15) are independent and may be planned/executed in any order or in parallel, but the recommended risk order is 12 → 13 → 14 → 15.

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
| 12. Protobuf decimal input | v1.3 | 0/TBD | Not started | - |
| 13. URL tool | v1.3 | 0/TBD | Not started | - |
| 14. Regex tester | v1.3 | 0/TBD | Not started | - |
| 15. Cron tool | v1.3 | 0/TBD | Not started | - |

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
**Plans:** 3/3 plans complete

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
