---
created: 2026-06-21
completed: 2026-06-21
title: release:publish notarization-pipeline gaps (2 bugs found during the v0.4.0 first notarized release)
area: release/build
files:
  - scripts/build-and-publish.mjs
  - src/lib/release/ (hasSigningEnv / publish preflight)
  - docs/RELEASE.md
---

## ✅ Completed 2026-06-21 — quick-task 260621-den (commit 93e210d4)

Both bugs fixed: DMG now notarised+stapled (fail-closed `notarytool submit --wait` → `stapler
staple` → `spctl` before publish); signing key materialized from `_PATH` into the content var so
the path form works end-to-end. Notary preflight is fail-closed across all auth modes (partial
API-key AND the complete Apple-ID set abort before the build; bare `APPLE_SIGNING_IDENTITY`
sign-only preserved). Full harness ran: `/simplify` (altitude) → `/code-review` (sign-only
regression) → `/codex:adversarial-review` (Apple-ID gap), all fixed. 54 new/updated unit tests +
behavioral dry-run across auth modes. Integrated proof (a real notarised DMG straight from
`release:publish`) lands at the next real release. See `260621-den-SUMMARY.md`.

## Context

Found while cutting **v0.4.0** — the first Developer-ID-notarised release (backlog 999.10 #1).
Both are latent "notarised-era" bugs: invisible while the direct channel was ad-hoc-signed, exposed
the moment the `APPLE_*` flip went live. Both were manually worked around for v0.4.0; the pipeline
itself still needs fixing so the next release is clean without hand-holding.

## Bug 1 — `release:publish` ships an UNNOTARISED DMG

`tauri build` notarises + staples only the **`.app`** (so the updater `.app.tar.gz` is clean), but the
**DMG** is Developer-ID-signed and **not notarised**:

```
spctl -a -t open --context context:primary-signature TinkerDev_0.4.0_universal.dmg
  -> rejected   source=Unnotarized Developer ID
```

A new user downloading the DMG hits "Apple cannot check it for malicious software" — the exact
Gatekeeper friction 999.10 #1 set out to remove. (The auto-updater path was unaffected.)

**v0.4.0 remediation (manual):** `xcrun notarytool submit <dmg> --wait` (submission
`b33e7836-1b00-417f-88bc-0cce368a4dd5`, Accepted) → `xcrun stapler staple <dmg>` → re-assess
`accepted / Notarized Developer ID` → `gh release upload v0.4.0 <dmg> --clobber`.

**Fix:** add a DMG notarise+staple step to `build-and-publish.mjs` after the universal build and
**before** the `gh release` upload (submit the DMG, `--wait`, staple, verify `spctl` accepted, fail
the publish if not). Then the published DMG is Gatekeeper-clean on first cut.

## Bug 2 — `hasSigningEnv` preflight is too lenient (doomed build runs ~15 min before failing)

The publish preflight's `hasSigningEnv` accepts **either** `TAURI_SIGNING_PRIVATE_KEY` **or**
`TAURI_SIGNING_PRIVATE_KEY_PATH`. But `tauri build`'s updater signing only honours
`TAURI_SIGNING_PRIVATE_KEY` (the key **content**) — it ignores `_PATH`. So a run with only `_PATH`
set **passes preflight**, builds + notarises (~15 min), then dies at the very last `.sig` step:

```
A public key has been found, but no private key. Make sure to set TAURI_SIGNING_PRIVATE_KEY ...
```

(This is exactly what happened on the first v0.4.0 attempt.)

**Fix (pick one):**
- Preflight should require `TAURI_SIGNING_PRIVATE_KEY` **specifically** (don't accept `_PATH` alone),
  failing fast before the build; **or**
- Have the script derive it — if only `_PATH` is set, export
  `TAURI_SIGNING_PRIVATE_KEY="$(cat "$TAURI_SIGNING_PRIVATE_KEY_PATH")"` itself; **and**
- Update `docs/RELEASE.md` to show the content form:
  `export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/devtools.key)"`.

## Priority

Medium — neither blocks shipping (both have a known manual workaround, proven on v0.4.0), but both
should be fixed before the next release so `release:publish` is one-shot clean again. Natural home:
fold into backlog **999.2 (Release automation + CI)** when promoted, or a standalone `/gsd-quick`.
