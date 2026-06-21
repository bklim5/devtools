# Quick Task 260621-den — Summary

**Completed:** 2026-06-21
**Outcome:** Fixed the two release-pipeline notarization gaps found cutting v0.4.0 (todo
`2026-06-21-release-notarization-pipeline-gaps.md`), so the NEXT release is one-shot clean — no
manual DMG-notarize / env-var hand-holding.

## What changed

**`src/lib/release/publishPlan.ts`** (new pure, unit-tested helpers):
- `shouldMaterializeSigningKey(env)` — returns the key PATH to read into `TAURI_SIGNING_PRIVATE_KEY`
  (content) when only the `_PATH` form is set. Fixes Bug 2: `tauri build` ignores `_PATH`, so the
  old flow ran the full ~15-min build then died at the `.sig` step.
- `notarizeDmgArgs(env, dmg)` — builds the `xcrun notarytool submit … --wait` argv (API-key auth;
  `.p8` stays a file). Fixes Bug 1: Tauri notarises only the `.app`, leaving the DMG unnotarised
  → Gatekeeper rejects a downloaded DMG.
- `hasNotaryApiKeyEnv` / `someNotaryApiKeyEnv` / `hasAppleIdNotaryEnv` — notary-auth predicates
  that drive a **fail-closed** preflight.

**`scripts/build-and-publish.mjs`**:
- Materialize the signing key from `_PATH` before the build (Bug 2).
- New step 6.5: when the API-key notary env is present, `notarytool submit --wait` → `stapler
  staple` → `spctl` assert the DMG is `accepted`, all BEFORE publish (fail-closed). Uses `run()`
  (not `runGate()`) so key-id/issuer never hit the logs (T-11-10).
- Preflight fail-closed: if notarisation is signalled (partial API-key OR the complete Apple-ID
  auth set) without the complete API-key set → abort before the build. Bare `APPLE_SIGNING_IDENTITY`
  (sign-only) is preserved. The preflight log now states what will actually happen.

**`docs/RELEASE.md`** — Option B (key by path) now noted as reliable through `release:publish`.

## Review trail (full binding harness)
- `/simplify` (4 agents) → caught an altitude issue: the API-key requirement was asserted deep in
  `publish()` after the 15-min build → moved to preflight (fail fast).
- `/code-review` (3 correctness finders + verify) → caught a regression: keying off `hasAppleEnv`
  (broad 7-var OR) wrongly aborted a legitimate sign-only build → retargeted to API-key predicates.
- `/codex:adversarial-review` → caught the Apple-ID-auth gap: a complete Apple-ID set would skip the
  DMG-notarize step and ship an unnotarised DMG → now fails closed.

## Verification
- vitest publishPlan: **54 tests** (added coverage for all new helpers); full suite + tsc + eslint
  green (lefthook).
- Behavioral dry-run across all auth modes: Apple-ID set → fail-closed abort; sign-only → passes
  (no notarisation); full API-key → "notarising the .app + DMG". (Full integrated proof — a real
  notarised DMG from `release:publish` — lands at the next real release.)
- No webview/UI surface → real-WKWebView gate N/A.
