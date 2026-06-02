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

### Phase 999.2: Release automation + CI integration (BACKLOG)

**Goal:** [Captured for future planning] — automate the release/distribution pipeline and the build+verify harness. Replace the manual `docs/RELEASE.md` dance (bump version → `tauri build` → publish to the public releases repo → hand-assemble `latest.json`) with local helper scripts, then wire CI on top: CI checks on every push/PR, and a tag-triggered CI release later.

**Pre-discussion decisions (captured 2026-06-02, before formal milestone planning):**

1. **Trigger model:** a git **tag push `vX.Y.Z`** cuts the signed release + updater bump. **CI checks (vitest + tsc + eslint) run on every push/PR to main/master REGARDLESS of publishing.** (Real-WKWebView e2e in CI is a stretch goal — macOS-runner + webview-automation cost.)
2. **Version bump = local helper script first, CI-integratable later.** Something like `pnpm release [patch|minor|major]` that bumps `package.json` + `src-tauri/tauri.conf.json` **in lockstep** (the D-16 lockstep from RELEASE.md; Cargo.toml is currently 0.1.0 and NOT part of it — decide whether to include it), commits, creates the `vX.Y.Z` tag, and pushes (push is what fires the release).
3. **App semver (`0.2.x`) stays DECOUPLED from GSD milestone tags (`v1.1`).** Two numbering systems on purpose: GSD `vMAJOR.MINOR` tracks planning milestones; app `vX.Y.Z` is what the updater compares. The release pipeline keys off the **app** version.
4. **Split the automation into two scripts** (both local now, both CI-callable later):
   - **bump-and-tag** (decision #2 above).
   - **build-and-publish** — runs `pnpm tauri build`, then **generates `latest.json` from the FRESH `*.app.tar.gz.sig`** (automating the fragile manual paste RELEASE.md §5 warns about — never reuse a stale `.sig`), creates the GitHub Release on `bklim5/devtools-releases`, and uploads DMG + `.app.tar.gz` + `latest.json`.

**Context the milestone must fold in (from RELEASE.md + repo state, 2026-06-02):**

- **Split-repo publish:** private source `bklim5/devtools` → public `bklim5/devtools-releases` (assets + `latest.json` only). Updater endpoint pinned to `releases/latest/download/latest.json` on the public repo. CI publishing across repos needs a **cross-repo PAT** — the default `GITHUB_TOKEN` cannot write releases to a different repo.
- **Signing secrets:** minisign **private key (`~/.tauri/devtools.key`) + password** must move into **GitHub Actions secrets** for CI release (mandatory; DST-02 verify-before-apply). Only the public key is in the repo (`tauri.conf.json` `plugins.updater.pubkey`).
- **arm64-only gap (Pitfall 7):** a local Apple-Silicon build serves only `darwin-aarch64`. Intel/`darwin-x86_64` or `--target universal-apple-darwin` coverage is a CI-phase improvement to consider.
- **Apple notarisation stays DEFERRED** (ad-hoc signing) until Apple Developer enrolment (D-02) — but scripts should be **notarisation-ready** (honor `APPLE_*` env if present, per RELEASE.md "post-enrolment flip").
- **macOS runner required** for `tauri build`; private-repo Actions minutes are billed — a reason CI *release* is deferred while CI *checks* run regardless.
- **Stale committed `latest.json`** at repo root (currently 0.2.1) — decide whether to keep it generated-only / stop committing it.

**Requirements:** TBD (define during `/gsd-new-milestone`)
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog or seed `/gsd-new-milestone` when ready)

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
