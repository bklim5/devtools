---
phase: 04-catalogue
plan: 04
subsystem: ui
tags: [hash, md5, sha, js-md5, web-crypto, crypto.subtle, bytes, react, typescript]

# Dependency graph
requires:
  - phase: 04-catalogue (Plan 01)
    provides: js-md5@0.8.3 dep, shared StatusBar + CopyButton (src/components/), hash/index.ts placeholder, bytes.ts
provides:
  - "Pure digest module src/tools/hash/hashes.ts: md5Hex (sync, js-md5) + shaHex (async, Web Crypto) + digestAll + ALGORITHMS"
  - "Real Hash tool UI (src/tools/hash/HashTool.tsx): input-encoding toggle (UTF-8/hex/base64) → single Uint8Array → 5 stacked digests + casing toggle + per-row copy"
  - "Registry hash entry swapped from makePlaceholder to the real HashTool (registry.ts untouched)"
  - "test/e2e/hash.e2e.ts: real-WKWebView secure-context (A1) check — SHA-256 renders via crypto.subtle.digest on the packaged webview"
affects: [04-05-uuid-ulid, 04-06-phase-boundary]

# Tech tracking
tech-stack:
  added: []  # js-md5 already installed in Plan 01; this plan is the ONLY consumer of js-md5 + Web Crypto
  patterns:
    - "Sync-first / async-guarded digest UI: MD5 renders synchronously (useMemo); the four SHA resolve via subtle.digest and are tagged with their source bytes so resolved-then-retyped results are detected as stale (Pitfall 3) without a synchronous setState in the effect (React Compiler / react-hooks/set-state-in-effect clean)"
    - "Input-encoding toggle mirroring Base64's AlphabetToggle (aria-pressed, accent = selected only) parsing one-directionally into a single internal Uint8Array via bytes.ts"

key-files:
  created:
    - src/tools/hash/hashes.ts
    - src/tools/hash/hashes.test.ts
    - src/tools/hash/HashTool.tsx
    - src/tools/hash/HashTool.test.tsx
    - test/e2e/hash.e2e.ts
  modified:
    - src/tools/hash/index.ts

key-decisions:
  - "MD5 computed synchronously in render (useMemo) so it appears instantly; only the four SHA are async — matches D-14 ('MD5 sync, SHA async') and makes the tool feel paste-instant (UX-01) before the SHA promises resolve"
  - "SHA stale-guard tags the result with its exact source Uint8Array (shaResult.src === bytes) rather than only a useEffect cleanup flag — this also covers the resolved-A-then-typed-B window, and avoids the lint-forbidden synchronous setState-in-effect on parse error"
  - "On parse error, md5Row is null so orderedRows is empty — the now-stale SHA rows are never rendered without needing to flush state in the effect"

patterns-established:
  - "hashes.ts is lowercase-canonical; the casing toggle (D-13) is applied purely on display + to the copied value, never mutating the canonical digest"
  - "e2e secure-context gate asserts a SHA-256 digest (not MD5) renders — MD5 is sync JS and would pass even without crypto.subtle, so only the SHA assertion truly proves A1"

requirements-completed: [HASH-01]

# Metrics
duration: 6min
completed: 2026-05-31
---

# Phase 4 Plan 04: Hash Tool (HASH-01) Summary

**Shipped the Hash tool into the registry: an input-encoding toggle (UTF-8/hex/base64) parses one internal `Uint8Array` via `bytes.ts`, then MD5 (sync, js-md5) + SHA-1/256/384/512 (async, Web Crypto `crypto.subtle.digest`) render all five stacked at once with a lowercase-default/uppercase casing toggle and a visible focusable per-row copy — the async SHA tagged to their source bytes so fast typing never shows a stale digest, and the secure-context Web-Crypto path proven on the real macOS WKWebView.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-31T12:59:00Z
- **Completed:** 2026-05-31T13:05:00Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- Pure `hashes.ts` digest module — `md5Hex` (js-md5, sync), `shaHex` (Web Crypto `subtle.digest`, async), `digestAll`, and `ALGORITHMS` — hex via `bytes.ts` `bytesToHex` (no hand-rolled hex/crypto, T-04-11), lowercase-canonical, 10 TDD cases pinned to known-good vectors (md5("")=`d41d8cd9…`, sha256("")=`e3b0c4…b855`, sha1/256/384/512 "abc" prefixes).
- Real `HashTool.tsx`: input-encoding toggle → single `Uint8Array` (D-11), 5 stacked digests (D-12) with MD5 rendering synchronously and the four SHA resolving async-guarded (Pitfall 3), lowercase-default + uppercase casing toggle on display AND copied value (D-13), field-scoped error on bad encoding (aria-invalid + text-bad, never opacity-only), empty = neutral, per-row `CopyButton` (UX-02), StatusBar with the meaningful selected `encoding`.
- Registry `index.ts` swapped `makePlaceholder("Hash")` → real `HashTool` (registry.ts untouched).
- **Real-WKWebView gate ADDED + GREEN**: `test/e2e/hash.e2e.ts` types "abc" at `#/tools/hash`, asserts MD5 = `900150983cd24fb0d6963f7d28e17f72` AND (load-bearing) SHA-256 starts with `ba7816bf8f01cfea` via `crypto.subtle.digest` on the packaged webview — confirming Assumption A1 (`tauri://` is a secure context). `bash scripts/e2e-spike.sh` → **5 passing on webkit** (base64, hash, jwt, protobuf, unix-time).
- Gate: **247/247 vitest** (decoder 19 untouched, +18 new), tsc clean, eslint 0. **HASH-01 Complete.**

## Task Commits

1. **Task 1: hashes.ts — md5 (sync) + sha (async) → hex** - `59eb09ff` (feat, TDD test+impl together)
2. **Task 2: HashTool UI + registry swap + e2e** - `544bf64f` (feat)

**Plan metadata:** (this commit) `docs(04-04): complete Hash tool plan`

_TDD note: lefthook blocks committing a red suite (Phase-2/3/4 precedent); RED was verified locally via `vitest run` before the impl landed, so each TDD task's test + impl land together in one GREEN commit._

## Files Created/Modified
- `src/tools/hash/hashes.ts` - Pure digest fns: `md5Hex`/`shaHex`/`digestAll`/`ALGORITHMS`; js-md5 + Web Crypto; lowercase-canonical hex via bytes.ts
- `src/tools/hash/hashes.test.ts` - 10 TDD cases pinned to known-good MD5/SHA vectors
- `src/tools/hash/HashTool.tsx` - Hash tool UI: encoding toggle + single Uint8Array + 5 stacked digests + casing toggle + per-row copy, async-guarded
- `src/tools/hash/HashTool.test.tsx` - 8 jsdom cases (encoding equivalence, casing, error, empty, focusable copy, copied-value casing)
- `test/e2e/hash.e2e.ts` - Real-WKWebView secure-context (A1) gate: SHA-256 renders on the packaged webview
- `src/tools/hash/index.ts` - Registry entry swapped `makePlaceholder("Hash")` → real `HashTool`

## Decisions Made
- **MD5 sync in render, SHA async.** D-14 specifies MD5 sync / SHA async; rather than computing MD5 inside the async `digestAll`, MD5 is a `useMemo` so it appears the instant the bytes change (paste-instant, UX-01), while the four SHA resolve via `subtle.digest`. `digestAll` remains in `hashes.ts` for completeness/tests but the UI uses `md5Hex` + `shaHex` directly for the sync/async split.
- **SHA stale-guard by source-bytes identity.** The async SHA result is stored as `{ src: bytes, rows }` and only displayed when `src === bytes`. This is stronger than a bare `live` cleanup flag — it also rejects the "A resolved, then I typed B" window — and lets the effect avoid a synchronous `setState` on parse error (which `react-hooks/set-state-in-effect` forbids). On error `md5Row` is null so the whole digest block is hidden, so no flush is needed.
- **e2e asserts SHA-256, not MD5, for the secure-context check.** MD5 (js-md5, pure JS) would render even if `crypto.subtle` were undefined; only the SHA-256 assertion truly proves A1 on the real WKWebView.

## Deviations from Plan

None - plan executed exactly as written. (The MD5-sync-in-render and source-bytes stale-guard are implementation choices explicitly within D-14 + Pitfall 3 + D-19 discretion, not scope changes.)

## Issues Encountered
- During the first e2e run, `base64.e2e.ts` failed once with `#base64-pane-text still not existing` on the cold-start navigation — the pre-existing intermittent base64 click/navigation flake already logged at the 04-03 sign-off (STATE.md). An immediate re-run was **5/5 green** (exit 0), confirming the flake is not introduced by this plan's code; `hash.e2e.ts` passed on both runs.

## User Setup Required
None - no external service configuration required. js-md5 is the vendored offline dep from Plan 01; SHA uses native Web Crypto.

## Next Phase Readiness
- HASH-01 Complete. Wave 2 remaining: **04-05 (UUID/ULID)**, then **04-06 / phase boundary** (human sign-off on `tauri build` + gsd-ui-review WCAG-AA covering all four catalogue tools).
- Assumption A1 (`tauri://` secure context for Web Crypto) is now **confirmed for `crypto.subtle.digest`** on the real WKWebView — de-risks 04-05's `crypto.getRandomValues`/`crypto.randomUUID` usage, though its own e2e should still confirm those specific APIs.

---
*Phase: 04-catalogue*
*Completed: 2026-05-31*

## Self-Check: PASSED

All 5 created source/test files + the SUMMARY exist on disk; both task commits (`59eb09ff`, `544bf64f`) are present in git history.
