---
phase: 11
slug: build-and-publish-driver-universal-binary-safety-rails
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + `tsc --noEmit` |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm vitest run src/lib/release/` |
| **Full suite command** | `pnpm vitest run && pnpm tsc --noEmit` |
| **Estimated runtime** | ~10 seconds (unit); the universal `tauri build` itself is the slow, human-gated path and is NOT unit-tested |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run src/lib/release/`
- **After every plan wave:** Run `pnpm vitest run && pnpm tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green; the decoder's 19 tests remain the immovable bar
- **Max feedback latency:** 15 seconds

---

## Validation Architecture (from RESEARCH.md)

This phase is **imperative shell orchestration around a small pure core**, ending in a **load-bearing live human gate (DST-02)**. The validation split mirrors Phase 10's pure-core ↔ thin-driver shape:

- **Unit-testable (extract to `src/lib/release/publishPlan.ts`, TDD):** argument parsing, `assertSingleSig` (fail loudly on 0 or >1 matches), `parseLipoArchs` (assert both `x86_64`+`arm64`), `buildAssetUrl`, `extractServedVersion`/`assertVersionMatches`, `APPLE_*`/signing-env presence checks, and `renderPublishPlan`/`renderPublishRecovery` formatting. These give REL-05/06/09/12 automated coverage without touching the network or the toolchain.
- **NOT unit-testable (human/real-hardware gate):** the universal `tauri build`, `lipo` against the real Mach-O, `gh release create/upload`, the post-publish `curl`, and the DST-02 updater round-trip (older install → detect → minisign verify → relaunch on both arches). These are proven once, live, at the phase sign-off.
- **`manifest.ts` (Phase 9) is untouched** — its `buildLatestJson`/`platformKey` dual-key assembly is already unit-tested; the driver imports it as-is.

---

## Per-Task Verification Map

> Filled by the planner per task. Every task touching `src/lib/release/publishPlan.ts` gets a `unit` row with a grep/test-verifiable command; driver-orchestration tasks that cannot be unit-tested get a `manual` row with explicit live instructions (no 3 consecutive automated-less tasks without an intervening pure-function task).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-XX-XX | XX | X | REL-XX | T-11-XX / — | {expected secure behavior or "N/A"} | unit | `pnpm vitest run src/lib/release/publishPlan.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/release/publishPlan.test.ts` — stubs for REL-05 (lipo arch parse), REL-06 (single-sig glob assert + url build), REL-12 (served-version match)
- [ ] No framework install needed — vitest + tsc already configured

*Existing infrastructure covers the unit tier; only the new `publishPlan.test.ts` stubs are added.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Universal build emits both arches at the universal bundle path | REL-05 | Requires the multi-minute `tauri build --target universal-apple-darwin` on real macOS toolchain | Run `pnpm release:publish` (non-dry); confirm `lipo -archs` on the built `.app` binary prints `x86_64 arm64` |
| Release published to `bklim5/devtools-releases` with assets-first/manifest-last + served version matches | REL-07, REL-12 | Requires real `gh` auth + network publish to the public releases repo | After publish, `curl -L releases/latest/download/latest.json` and confirm `version` equals the cut version |
| DST-02 updater round-trip (detect → minisign verify → relaunch) on both arches | REL-09 | Load-bearing; can only be proven by an older real install auto-updating on real hardware | Install a prior version, launch, confirm it detects the new release, passes the pinned-pubkey minisign verify, and relaunches into the new version — ideally on both Intel and Apple Silicon |
| `--dry-run` prints full publish plan with zero side effects (and does NOT run the slow build) | REL-10 (build/publish-half) | Output/no-op assertion against a live invocation | Run `pnpm release:publish --dry-run`; confirm the full plan prints, no build runs, no `gh`/`curl` call fires |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Manual-Only row with explicit live instructions
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`publishPlan.test.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
