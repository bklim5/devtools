# Roadmap: DevTools

## Milestones

- ✅ **v1.0 Distribution** — Phases 1–6 (shipped 2026-06-01) — see `milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 Formatters** — Phases 7–8 (shipped 2026-06-02) — see `milestones/v1.1-ROADMAP.md`
- 🚧 **v1.2 Release Tooling** — Phases 9–11 (in progress, started 2026-06-02) — local release-automation helper scripts; CI parked

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

### 🚧 v1.2 Release Tooling (Phases 9–11) — IN PROGRESS

Local release-automation helper scripts for the existing Tauri 2 macOS app (CI explicitly parked to backlog 999.2). Replaces the manual `docs/RELEASE.md` dance with two composable scripts — `bump-and-tag` and `build-and-publish` — over a unit-tested pure core in a new `src/lib/release/`. **Zero new runtime dependencies** (devDeps OK for tooling; Node builtins + `tsx` + Tauri CLI + `gh` + `rustup` cover everything); the hero decoder `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched. Phases 9–11 touch **no app UI** — the per-task real-WKWebView UI gate is N/A except Phase 11's **real updater round-trip**, which is the load-bearing DST-02 proof and the milestone's human sign-off.

- [x] Phase 9: Pure release core + housekeeping — new `src/lib/release/` (`version.ts` semver bump + per-manifest content edits incl. `[package]`-scoped Cargo edit; `manifest.ts` `buildLatestJson` + dual-key `platformKey`), unit-tested via the existing `tsc`+`vitest` gate; one-time `Cargo.toml` 0.1.0 → current reconcile + untrack the stale `latest.json` (completed 2026-06-02)
- [x] Phase 10: `bump-and-tag` driver — thin `scripts/bump-and-tag.mjs` importing Phase 9; lockstep 3-file write + lockfile regen, `vX.Y.Z` tag + push to private `origin`, `--dry-run` + preflights (bump half); wire `pnpm release:bump` (completed 2026-06-02)
- [ ] Phase 11: `build-and-publish` driver + universal binary + safety rails — `scripts/build-and-publish.mjs`; universal `tauri build`, fresh-`.sig` dual-key `latest.json`, cross-repo `gh` publish, `APPLE_*` passthrough, `--dry-run` + build-time preflights (publish half), post-publish `curl` verify; wire `pnpm release:publish` + `release` umbrella; **real updater round-trip is the human-gate acceptance criterion**

## Phase Details

### Phase 9: Pure release core + housekeeping
**Goal**: The only logic that can silently corrupt a release — version-bump math, per-manifest content edits, and `latest.json` assembly — exists as pure, deterministic functions in a new `src/lib/release/`, fully unit-tested, with the latent `Cargo.toml` version drift and the stale tracked `latest.json` reconciled so the first real bump starts from a clean, aligned state.
**Depends on**: Nothing (first phase of v1.2; builds only on existing repo state)
**Requirements**: REL-02, REL-08 (REL-01's bump math + REL-06's manifest assembly are authored here as pure functions but are *delivered* — wired to real I/O — by Phases 10 and 11 respectively; mapped there to avoid double-counting)
**Success Criteria** (what must be TRUE):
  1. `pnpm vitest run` (the existing gate, no new wiring) covers `src/lib/release/version.ts` and `manifest.ts` green, including a test proving `setCargoVersion` rewrites only the `[package]` `version` line and leaves dependency `version = "…"` pins untouched
  2. `bumpSemver` returns the correct next version for `patch`/`minor`/`major` from a single computed source, and `buildLatestJson` emits the dual `darwin-aarch64` + `darwin-x86_64` keys (same URL + signature, no invented `darwin-universal` key) from a passed-in signature string
  3. `src-tauri/Cargo.toml` `[package].version` is reconciled from `0.1.0` to the current app version (matching `package.json` / `tauri.conf.json`), with dependency version pins unchanged
  4. `git ls-files latest.json` returns empty (the stale tracked root copy is untracked via `git rm --cached` if present) and `/latest.json` remains gitignored — verified against actual repo state, not assumed
  5. `tsc --noEmit` + `eslint` are clean and the decoder's 19 tests still pass byte-for-byte; zero new runtime dependencies added
**Plans**: 2 plans (1/2 complete)
  - [x] 09-01-PLAN.md — version.ts (hand-rolled bumpSemver + the three surgical setXVersion editors) + tests; dogfooded Cargo 0.1.0→0.2.1 reconcile (REL-02) + latest.json untrack/gitignore verify (REL-08) — ✓ complete (25 tests, 403/403 suite green, REL-02 + REL-08 done)
  - [x] 09-02-PLAN.md — manifest.ts (pure buildLatestJson + dual-key platformKey: darwin-aarch64 + darwin-x86_64, same url+signature, no darwin-universal) + tests (authors REL-06 pure core, delivered Phase 11)

### Phase 10: `bump-and-tag` driver
**Goal**: A maintainer can run a single command to bump the app semver in lockstep across all three manifests, regenerate and stage the lockfiles so the tagged commit is clean and reproducible, and create + push the `vX.Y.Z` tag to the private source remote — with a `--dry-run` that proves the plan changes nothing and preflights that abort before any irreversible git action.
**Depends on**: Phase 9 (imports the pure `version.ts` functions)
**Requirements**: REL-01, REL-03, REL-04, REL-10, REL-11 (REL-10 `--dry-run` and REL-11 preflights span both scripts — first delivered here for the bump half; their build/publish-half counterparts land in Phase 11 and are noted there, not double-mapped)
**Success Criteria** (what must be TRUE):
  1. Running `pnpm release:bump patch` (and `minor`/`major`) writes the identical next version into `package.json` + `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml` (`[package]` only) from one computed version, with no other file content touched
  2. After the bump, `pnpm-lock.yaml` and `Cargo.lock` are regenerated and staged in the same commit, and `git status --porcelain` is empty before the tag is created (the tag points at a clean, reproducible tree)
  3. The bump creates the `vX.Y.Z` tag (version derived from the written file, never typed twice) and pushes the commit + tag to the private `origin` (`bklim5/devtools`)
  4. Running the script with `--dry-run` prints the full intended plan (computed version, file edits, git commands, push target) and changes zero files and performs zero git/network actions
  5. Preflights fail fast and abort non-zero before any write when the working tree is dirty, the branch is not `master`, the target tag already exists (local or remote), or `vitest`/`tsc` are not green
**Plans**: 3 plans (3 waves)
  - [x] 10-01-PLAN.md — Commit the deferred Cargo.lock 0.1.0→0.2.1 reconcile as standalone housekeeping (clean tree before the driver runs)
  - [x] 10-02-PLAN.md — Pure, unit-tested bump-driver decision core `src/lib/release/bumpPlan.ts` (arg parsing, single-computed-version plan, allowlist diff, dry-run/recovery text) — REL-01/10/11 automated coverage
  - [x] 10-03-PLAN.md — Thin I/O driver `scripts/bump-and-tag.mjs` + `pnpm release:bump` (preflights → lockstep bump → lockfiles → commit → annotated tag → y/N → push), with --dry-run + human-gated real push

### Phase 11: `build-and-publish` driver + universal binary + safety rails
**Goal**: A maintainer can build a signed universal (Intel + Apple Silicon) macOS binary and publish it to the public releases repo with a `latest.json` generated from this build's fresh signature, such that an older install on either architecture detects, signature-verifies, and relaunches into the new version — guarded by `--dry-run`, build-time preflights, and a post-publish endpoint check so a broken release can never silently auto-install onto every user.
**Depends on**: Phase 9 (imports the pure `manifest.ts` functions) + Phase 10 (consumes the `vX.Y.Z` tag a bump produces)
**Requirements**: REL-05, REL-06, REL-07, REL-09, REL-12 (also delivers the build/publish-half of REL-10 `--dry-run` and REL-11 preflights — the `rustup` both-targets check, signing-key/password presence, `gh` push permission on the releases repo, and tests-green gate — counted under Phase 10 to avoid double-mapping)
**Success Criteria** (what must be TRUE):
  1. The script produces a **universal** macOS binary via `tauri build --target universal-apple-darwin`, resolves artifacts at the universal output path (`target/universal-apple-darwin/release/bundle/...`), and asserts `lipo -archs` lists both `x86_64 arm64` (a `rustup target add x86_64-apple-darwin` preflight guards the missing target)
  2. `latest.json` is generated from a single-match glob of **this build's fresh** `*.app.tar.gz.sig` (failing loudly on 0 or >1 matches), listing the universal artifact under **both** `darwin-aarch64` and `darwin-x86_64` keys with the same URL and signature
  3. The release is published to the public `bklim5/devtools-releases` repo via `gh release create --repo` (never `origin`), uploading the DMG + `.app.tar.gz` + the generated `latest.json` (assets first, manifest last), and a post-publish `curl -L` of `releases/latest/download/latest.json` confirms the served `version` matches the version just cut
  4. `APPLE_*` notarisation env is honored if present but never required (ad-hoc signing stays the default; no secret is ever echoed or passed as a CLI arg); `--dry-run` prints the full publish plan with zero side effects
  5. **Human-gate acceptance:** a real updater round-trip is proven live — an older install detects the new release, passes the mandatory minisign verify against the committed pubkey, and relaunches into the new version (the load-bearing DST-02 proof; flagged for deeper validation during planning since the universal dual-key behavior must be confirmed on real hardware, not just unit-asserted)
**Plans**: TBD

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
| 9. Pure release core + housekeeping | v1.2 | 2/2 | Complete   | 2026-06-02 |
| 10. bump-and-tag driver | v1.2 | 3/3 | Complete    | 2026-06-02 |
| 11. build-and-publish driver + universal binary + safety rails | v1.2 | 0/0 | Not started | - |

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
**Plans:** 3/3 plans complete

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

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
