---
phase: 11-build-and-publish-driver-universal-binary-safety-rails
slug: build-and-publish-driver-universal-binary-safety-rails
status: verified
threats_open: 0
asvs_level: 2
created: 2026-06-03
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Verifies the threat mitigations declared across the three Phase 11 plans
(11-01 pure decision core, 11-02 thin I/O driver, 11-03 live human-gated
acceptance) against the implemented code. All 16 threats are `mitigate`;
all 16 are CLOSED with code/live evidence.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| CLI argv → driver | Maintainer-supplied tokens; only `--dry-run` accepted, anything else throws with usage | Untrusted argv tokens |
| build output (`.sig` glob) → latest.json | The single most security-critical link: the signature every install trusts is derived from a globbed file | Updater payload signature |
| process env → presence checks / inherited subprocess env | Signing key + Apple creds; PRESENCE is read, VALUE is inherited into children, never returned/logged/argv'd | Minisign signing key, Apple notarisation secrets |
| maintainer machine → public releases repo | The irreversible publish: whatever lands becomes the auto-update every install trusts | DMG + .app.tar.gz + latest.json |
| published latest.json → every install's updater | The redirect the updater polls; a stale/wrong manifest ships to everyone | Versioned manifest + dual-key signatures |
| new payload → minisign verify | Pinned-pubkey verify is the last line of defense; mismatch must HALT, not warn-and-apply | Signed updater payload vs `tauri.conf.json` pubkey |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-11-01 | Tampering | `assertSingleSig` | mitigate | Throws on 0 (signing-env hint) AND >1 (lists matches); both branches unit-tested. `publishPlan.ts:70,75`; tests `publishPlan.test.ts:41-52` | closed |
| T-11-02 | Tampering | `parseLipoArchs` | mitigate | Requires BOTH `x86_64` AND `arm64` (`arm64e`/single-arch → false). `publishPlan.ts:92`; tests `publishPlan.test.ts:55-80` | closed |
| T-11-03 | Tampering / DoS | `buildAssetUrl` | mitigate | Hard-coded `RELEASES_REPO = "bklim5/devtools-releases"`; grep confirms the private `bklim5/devtools"` slug never appears. `publishPlan.ts:19,101`; test `publishPlan.test.ts:89-92` | closed |
| T-11-04 | Information disclosure | `hasSigningEnv` / `hasAppleEnv` | mitigate | Return BOOLEANS only; tests assert `typeof === "boolean"` and never the secret string. `publishPlan.ts:140,163`; tests `publishPlan.test.ts:122-146` | closed |
| T-11-05 | Tampering | `assertVersionMatches` | mitigate | Pure equality; mismatch throws printing both versions. `publishPlan.ts:127`; test `publishPlan.test.ts:166-169` | closed |
| T-11-06 | Tampering | all CLI calls | mitigate | `execFileSync` argv arrays only (5 occurrences); zero bare `execSync(` — no shell-injection surface. `build-and-publish.mjs:99,123` | closed |
| T-11-07 | Tampering | fresh-`.sig` glob | mitigate | Glob scoped ONLY to `universal-apple-darwin/release/bundle/macos/*.app.tar.gz.sig`; prior `.sig` cleared via `rmSync` pre-build; `assertSingleSig` fail-on-0/>1. `build-and-publish.mjs:246-248,273-274` | closed |
| T-11-08 | DoS / Tampering | gh publish ordering | mitigate | `gh release create` (assets, line 303) BEFORE `gh release upload latest.json` (manifest, line 318). `build-and-publish.mjs:301-323` | closed |
| T-11-09 | DoS / Tampering | publish target repo | mitigate | Every `gh` call passes `--repo bklim5/devtools-releases` (≥3 occurrences); never `origin`/private source. `build-and-publish.mjs:68,189,212,304,319` | closed |
| T-11-10 | Information disclosure | signing/Apple secrets | mitigate | Presence-booleans only; passed via inherited `{ env: process.env }` (5 sites); grep confirms no secret value is `log()`-ed or argv'd. `build-and-publish.mjs:103,126,159-171` | closed |
| T-11-11 | Tampering | served-version drift | mitigate | Post-publish `curl -L` of the live endpoint → `assertVersionMatches(extractServedVersion(...), version)`. `build-and-publish.mjs:328-329` | closed |
| T-11-12 | DoS | single-arch build mislabeled | mitigate | `lipo -archs` on the real Mach-O must satisfy `parseLipoArchs` (both arches) before publish; abort otherwise. `build-and-publish.mjs:264-269` | closed |
| T-11-13 | Information disclosure | signing env export | mitigate | Human-only export into own shell; resume-signal says do NOT share values; presence-checked without printing. Live-confirmed (11-03-SUMMARY Task 1). `build-and-publish.mjs:159` | closed |
| T-11-14 | Tampering | live updater payload | mitigate | Mandatory minisign verify against committed `tauri.conf.json` pubkey, exercised LIVE on Apple Silicon (detect → verify → relaunch, no `InvalidSignature`). `tauri.conf.json:48`; live evidence 11-03-SUMMARY Task 3 | closed |
| T-11-15 | DoS | dual-arch coverage | mitigate | Round-trip on arm64 live; Intel covered-by-construction (one universal artifact, byte-identical signature under both `latest.json` keys, confirmed via served `curl`). 11-03-SUMMARY Task 2/3 | closed |
| T-11-16 | Tampering | wrong-repo publish | mitigate | Independently confirmed the release landed on PUBLIC `bklim5/devtools-releases` (`gh release view` + `curl` of served `latest.json`), never private `origin`. 11-03-SUMMARY Task 2 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

No accepted risks.

---

## Unregistered Flags

None. SUMMARY.md files carry no `## Threat Flags` section; no new attack surface was flagged by the executors beyond the registered T-11-01..16 set. The two real bugs found during the live run (11-03: `main().catch()` false-failure; 8000% download-progress display) are functional/cosmetic, not security threats.

---

## Advisory Notes (non-blocking, from 11-REVIEW.md)

These are robustness/diagnostic improvements raised in code review (0 critical / 0 blocking). They do NOT reopen any threat — the registered mitigations all hold — and are recorded for a future hardening pass:

- **WR-01** — Post-publish `curl` verify lacks `--fail` + retry: an HTTP error or a lagging `releases/latest` redirect surfaces as an opaque `JSON.parse` error rather than a clear message, and can fail a genuinely-correct publish on timing. T-11-11's version-match guard still fires correctly; this is legibility/robustness only.
- **WR-02** — `assertSingleSig` reused for the `.dmg`/`.app.tar.gz` globs emits signature-specific diagnostics on a missing/duplicated asset. The single-match safety (T-11-07) still holds; only the operator-facing message could mislead.
- **WR-03** — Redundant `existsSync` guard on the stale-`.sig` clear; an mtime-vs-build-start assertion would harden T-11-07 against an unexpected future bundle-path layout. Today the clear and the assert key off the same constant, so the mitigation holds.
- **IN-02** — Preflight accepts `MAINTAIN` while the T-11-09 comment says only WRITE/ADMIN; doc/code wording drift, behaviour is intentional. Worth aligning the comment so a future auditor isn't confused.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-03 | 16 | 16 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-03
