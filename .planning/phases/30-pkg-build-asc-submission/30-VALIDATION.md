---
phase: 30
slug: pkg-build-asc-submission
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-25
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Note (this phase's reality):** Phase 30 is a build-pipeline + ship-artifact phase, not
> a feature-code phase. Most verification is **shell-assert based** (signing/structure checks
> run *inside* the build scripts as FATAL tail-calls) plus a **mandatory human ship-gate
> walkthrough** that automation cannot drive (StoreKit purchase, Sandbox, refund→Pro-drop,
> Transporter upload, and the MAS-SHIP-05 REAL direct DMG build+sign+notarise+staple which
> needs human-held Apple notary creds — the dry-run alone is a false-GREEN, Finding 1). The
> decoder's 19 vitest tests + `tsc --noEmit` remain the immovable regression bar (MAS-SHIP-05:
> decoder byte-for-byte untouched).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) + shell asserts (`scripts/verify-appstore-bundle.sh`, new pkg-verify gate) |
| **Config file** | `vite.config.ts` (existing — vitest config inline); build scripts self-gate |
| **Quick run command** | `pnpm test` (vitest) + `pnpm tsc --noEmit` |
| **Full suite command** | `pnpm test && pnpm tsc --noEmit && bash scripts/verify-appstore-bundle.sh <app>` |
| **Estimated runtime** | ~30–60s (vitest+tsc); pkg build+verify minutes |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test && pnpm tsc --noEmit` (guards the decoder bar + types)
- **After every plan wave:** Run the full suite (+ the relevant shell verify gate)
- **Before `/gsd-verify-work`:** Full suite green; `.pkg` static-verify gate green
- **Max feedback latency:** ~60 seconds (unit) / build-time (pkg gates)

---

## Per-Task Verification Map

> Populated during planning/execution. Each task's automated verify (shell assert, grep,
> vitest, or `git diff` cleanliness for the decoder) is recorded here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 30-01-1 | 01 | 1 | MAS-SHIP-04 | T-30-01 | ALL THREE version sources 1.0.0 (package.json + tauri.conf.json + Cargo.toml); overlay never overrides (Finding 2) | node assert | `node -e "const fs=require('fs');const pkg=require('./package.json');const tc=require('./src-tauri/tauri.conf.json');const cv=(fs.readFileSync('./src-tauri/Cargo.toml','utf8').match(/^versions*=s*"([^"]+)"/m)||[])[1];const o=require('./src-tauri/tauri.appstore.conf.json');process.exit(pkg.version==='1.0.0'&&tc.version==='1.0.0'&&cv==='1.0.0'&&!('version' in o)?0:1)"` | ✅ | ⬜ pending |
| 30-01-2 | 01 | 1 | MAS-SHIP-04 | T-30-02 | PrivacyInfo Data Not Collected + CA92.1, lints clean | shell (plutil/PlistBuddy) | `plutil -lint src-tauri/PrivacyInfo.xcprivacy` | ❌ W0 (new) | ⬜ pending |
| 30-01-3 | 01 | 1 | MAS-SHIP-05 | T-30-03 | HALF A (cheap): dry-run preflight passes (vs 1.0.0 tag); decoder byte-identical | preflight + unit + git | `test -f src/lib/protobuf/decoder.ts && test -f src/lib/protobuf/decoder.test.ts && pnpm release:publish --dry-run && pnpm vitest run src/lib/protobuf/decoder.test.ts && git diff --quiet HEAD -- src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts` | ✅ | ⬜ pending |
| 30-01-4 | 01 | 1 | MAS-SHIP-05 | T-30-04 | HALF B (load-bearing, Finding 1/D-Discretion L39): REAL universal DMG build+sign+notarise+staple, NO gh release/tag | MANUAL (human — needs APPLE_API_KEY* notary creds) | `lipo -archs` x86_64+arm64 + `codesign --verify --deep --strict` + `xcrun stapler validate` + `spctl -a -t open --context context:primary-signature` ACCEPT on the .dmg; `git tag --points-at HEAD` empty | — | ⬜ pending |
| 30-02-1 | 02 | 1 | MAS-SHIP-03/04 | T-30-06 | Runbook + Notes tie metadata; on-device StoreKit IAP documented | shell (grep) | `test -f docs/appstore/SUBMISSION-RUNBOOK.md && grep -q 'com.tinkerdev.app.pro' docs/appstore/Notes-for-Review.md && grep -q 'Mac Installer Distribution' docs/appstore/SUBMISSION-RUNBOOK.md` | ❌ W0 (new) | ⬜ pending |
| 30-02-2 | 02 | 1 | MAS-SHIP-03/04 | T-30-05/07 | /support page exists; /privacy channel-aware | shell (grep) | `test -f .../tinkerdev-io/app/support/page.tsx && grep -q LegalShell .../support/page.tsx && grep -qiE 'App Store edition\|StoreKit' .../privacy/page.tsx` | ❌ W0 (cross-repo) | ⬜ pending |
| 30-03-1 | 03 | 2 | MAS-SHIP-01/02 | T-30-09..16 | pkg script signs Apple Distribution→productbuild→Installer; injects PrivacyInfo before seal; per-Mach-O sandbox + root-only gates; STRONG profile validity gate (TeamId+app-id+ExpirationDate+get-task-allow, Finding 3); fail-closed on absent cert; no notarise/spctl-gate | shell (bash -n + grep) | `bash -n scripts/build-appstore-pkg.sh && grep -q 'productbuild --component' scripts/build-appstore-pkg.sh && grep -q 'security cms -D' scripts/build-appstore-pkg.sh && grep -qE 'TeamIdentifier|application-identifier' scripts/build-appstore-pkg.sh && grep -q 'ExpirationDate' scripts/build-appstore-pkg.sh && grep -q 'tauri:build:appstore:pkg' package.json` | ❌ W0 (new) | ⬜ pending |
| 30-03-2 | 03 | 2 | MAS-SHIP-01/02/03 | T-30-09..15 | .pkg built+locally-verified; ship-gate walkthrough; Transporter upload; Submit | MANUAL (human ship-gate) | local gates run inside `pnpm tauri:build:appstore:pkg`; StoreKit/Transporter/Submit are human-only (D-01/D-04) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Confirm existing vitest + `verify-appstore-bundle.sh` infrastructure covers the regression bar (no new framework needed).

*Existing infrastructure (vitest, tsc, verify-appstore-bundle.sh) covers all automatable phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signed `.pkg` accepted by ITMS | MAS-SHIP-02 | Transporter upload is human-only (D-01); no API key (D-02) | Human uploads `.pkg` via Transporter.app; observe successful delivery / ITMS bounce reasons |
| REAL direct DMG build+sign+notarise+staple | MAS-SHIP-05 | notarytool contacts Apple; needs human-held APPLE_API_KEY* notary creds + signing key (not in agent env) | Human exports the full direct release env, runs a real universal DMG build STOPPING before `gh release` (no tag), asserts lipo x86_64+arm64 / codesign --deep --strict / stapler validate / spctl accept on the .dmg (Finding 1, D-Discretion L39 — the dry-run alone is a false-GREEN) |
| Pro IAP purchase round-trip | MAS-SHIP-04 | StoreKit/Sandbox cannot be driven by WebDriver | Human ship-gate: launch dev-signed `.app`, real Sandbox purchase, restore on fresh container, refund→Pro-drop |
| Support + privacy URLs resolve | MAS-SHIP-03/04 | Live web deploy in separate repo | Human confirms `https://tinkerdev.io/support` + `/privacy` resolve before Submit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or are recorded as Manual-Only with justification
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (unit tier)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
