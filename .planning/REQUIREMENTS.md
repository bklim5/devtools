# Requirements: DevTools — v1.2 "Release Tooling"

**Defined:** 2026-06-02
**Core Value:** Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse.
**Milestone goal:** Replace the manual `docs/RELEASE.md` dance with local helper scripts that bump versions in lockstep and build/publish signed, multi-arch releases reproducibly. CI is explicitly parked.

> **Scope note:** This milestone is dev-tooling, not a runtime feature. It adds **zero new runtime dependencies** (Node builtins + existing `tsx` + Tauri CLI + `gh` + `rustup` cover everything). The app's user-facing surface is unchanged; the hero decoder + its 19 tests stay byte-for-byte untouched.

## v1 Requirements

Requirements for milestone v1.2. Each maps to a roadmap phase.

### Version Lockstep & Tagging

- [ ] **REL-01**: Maintainer runs `pnpm release [patch|minor|major]` to bump the app semver across `package.json` + `src-tauri/tauri.conf.json` + `src-tauri/Cargo.toml` (`[package].version` only) in lockstep from a single computed version
- [x] **REL-02**: The drifted `Cargo.toml` version (currently `0.1.0`) is reconciled to the current app version as a one-time fix, with the `[package]` version targeted precisely (dependency `version = "…"` lines untouched) — ✓ Phase 9 Plan 01 (dogfooded `setCargoVersion`, 0.1.0 → 0.2.1, only line 3 changed)
- [ ] **REL-03**: Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`) are regenerated and staged so the tagged commit is clean and reproducible (no dirty tree after a bump)
- [ ] **REL-04**: The bump creates the `vX.Y.Z` git tag and pushes the commit + tag to the private source remote (`origin`, `bklim5/devtools`)

### Universal Build & Publish

- [ ] **REL-05**: The publish script produces a **universal** macOS binary covering Intel + Apple Silicon via `tauri build --target universal-apple-darwin` (closing the local arm64-only gap), resolving artifacts at the universal output path
- [ ] **REL-06**: `latest.json` is generated from **this build's fresh** `*.app.tar.gz.sig` (single-match glob; fail loudly on 0 or >1 matches), with the universal artifact listed under **both** `darwin-aarch64` and `darwin-x86_64` keys (same URL + same signature — no invented `darwin-universal` key)
- [ ] **REL-07**: The release is published to the public `bklim5/devtools-releases` repo (`gh release create --repo`), uploading the DMG + `.app.tar.gz` + `latest.json`
- [x] **REL-08**: `latest.json` is generate-only — never committed; the stale tracked/root copy is removed from version control and confirmed gitignored — ✓ Phase 9 Plan 01 (verify-only: `git ls-files latest.json` empty, `/latest.json` gitignored, on-disk copy left intact)
- [ ] **REL-09**: Apple notarisation env (`APPLE_*`) is honored if present (notarisation-ready), but ad-hoc signing remains the default and notarisation itself stays deferred

### Safety & Verification

- [ ] **REL-10**: Both scripts support `--dry-run`, printing the full intended plan with zero side effects (no file writes, no git/network actions)
- [ ] **REL-11**: Preflight checks fail fast before the slow build — clean working tree, on `master`, target tag absent (local + remote), signing key/password present, and `vitest` + `tsc` green
- [ ] **REL-12**: After publishing, the script verifies the live updater endpoint (`releases/latest/download/latest.json`) and asserts the served `version` matches the version just cut

## v2 Requirements

Deferred to a future milestone. Tracked but not in this roadmap.

### Release Ergonomics

- **REL-F1**: Auto-generated changelog / release notes from `git log` since the last tag (deferred — would impose a conventional-commit contract the project hasn't adopted)
- **REL-F2**: DMG-mount flake auto-recovery (`hdiutil detach` + retry). v1.2 ships the clear-error minimum pointing at the runbook fix; the auto-retry loop is added only if the flake keeps biting

## Out of Scope

Explicitly excluded for v1.2. The entire CI track is the parked backlog item **999.2 (CI integration)** — pulling any of it into v1.2 is scope creep.

| Feature | Reason |
|---------|--------|
| GitHub Actions CI checks (vitest/tsc/eslint on push/PR) | Parked to a follow-on CI milestone; v1.2 is local scripts only |
| Tag-triggered CI **release** (Actions runner cuts the signed release) | Parked; needs cross-repo PAT + minisign secrets in Actions — out of scope for local tooling |
| Cross-repo PAT / minisign secrets in GitHub Actions | Only needed for CI publishing, which is parked; local `gh` auth + local key suffice now |
| Real-WKWebView e2e in CI | macOS-runner + billed minutes; a CI-milestone stretch goal |
| Per-arch build matrix publishing | The universal binary deliberately replaces a per-arch matrix |
| Windows / Linux release pipeline | Platform deferred project-wide; macOS only for now |
| Rollback / un-publish automation, key-rotation tooling | Not needed for a solo-maintainer local flow; revert-by-republish suffices |
| Apple notarisation **activation** | Deferred until Apple Developer enrolment (D-02); scripts stay notarisation-ready only |
| Any change to runtime app behavior or the decoder | Dev-tooling milestone; the hero decoder + its 19 tests stay byte-for-byte untouched |

## Traceability

Which phases cover which requirements. Each v1 requirement maps to exactly one phase (where it is first/primarily delivered).

> **Cross-phase note:** REL-10 (`--dry-run`) and REL-11 (preflights) apply to *both* scripts. Each is mapped to **Phase 10** (the bump driver, where it is first delivered); Phase 11 also delivers the build/publish-half of each (the `rustup`/signing-key/`gh`-permission/tests-green preflights and the publish dry-run), described in the Phase 11 detail but not double-mapped here. Likewise, the *pure* logic behind REL-01 (bump math) and REL-06 (manifest assembly) is authored in Phase 9 but mapped to the phase that wires it to real I/O (Phase 10 and Phase 11 respectively).

| Requirement | Phase | Status |
|-------------|-------|--------|
| REL-01 | Phase 10 | Pending |
| REL-02 | Phase 9 | Done (Plan 01) |
| REL-03 | Phase 10 | Pending |
| REL-04 | Phase 10 | Pending |
| REL-05 | Phase 11 | Pending |
| REL-06 | Phase 11 | Pending |
| REL-07 | Phase 11 | Pending |
| REL-08 | Phase 9 | Done (Plan 01) |
| REL-09 | Phase 11 | Pending |
| REL-10 | Phase 10 | Pending |
| REL-11 | Phase 10 | Pending |
| REL-12 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12 ✓ (Phase 9: REL-02, REL-08 · Phase 10: REL-01, REL-03, REL-04, REL-10, REL-11 · Phase 11: REL-05, REL-06, REL-07, REL-09, REL-12)
- Unmapped: 0 ✓
- Duplicated: 0 ✓ (cross-phase REL-10/REL-11 mapped once to Phase 10; REL-01/REL-06 pure logic authored in Phase 9, mapped to their delivery phase)

---
*Requirements defined: 2026-06-02*
*Last updated: 2026-06-02 — roadmap created; traceability filled (Phases 9–11, 12/12 mapped)*
