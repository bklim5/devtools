---
phase: 04-catalogue
plan: 01
subsystem: infra
tags: [ulid, uuidv7, js-md5, intl, registry, react, typescript, crypto]

# Dependency graph
requires:
  - phase: 03-hero-protobuf-encoding-ux-constraints
    provides: shared StatusBar (in src/tools/base64), useCopyFeedback, platform clipboard seam, registry TOOLS pattern, bytes.ts
provides:
  - "Tool-agnostic StatusBar at src/components/StatusBar.tsx (prop/aria contract unchanged)"
  - "Reusable CopyButton affordance (src/components/CopyButton.tsx)"
  - "Pure ULID lib (src/lib/ulid.ts): Crockford base32 encode/decode + CSPRNG randomness"
  - "Pure UUIDv7 lib (src/lib/uuidv7.ts): RFC 9562 build + version/variant/tsMs decode"
  - "Shared timeFormat lib (src/lib/timeFormat.ts): iso/utc/local + relativeTime + classifyUnit + toUnixFromIso"
  - "js-md5@0.8.3 installed (offline, MIT)"
  - "JWT, Hash, UUID/ULID registered as placeholders in registry.ts TOOLS (6 tools total)"
affects: [04-02-unix-time, 04-03-jwt, 04-04-hash, 04-05-uuid-ulid]

# Tech tracking
tech-stack:
  added: [js-md5@0.8.3]
  patterns:
    - "Pure src/lib/ algorithm modules with injected clock/entropy for deterministic vector tests"
    - "Shared presentational components (StatusBar, CopyButton) at tool-agnostic src/components/"
    - "Registry edits concentrated in the Wave-1 foundation plan; Wave-2 plans swap only their own index.ts component"

key-files:
  created:
    - src/components/StatusBar.tsx
    - src/components/CopyButton.tsx
    - src/lib/ulid.ts
    - src/lib/ulid.test.ts
    - src/lib/uuidv7.ts
    - src/lib/uuidv7.test.ts
    - src/lib/timeFormat.ts
    - src/lib/timeFormat.test.ts
    - src/tools/jwt/index.ts
    - src/tools/hash/index.ts
    - src/tools/uuid-ulid/index.ts
  modified:
    - src/tools/base64/Base64Tool.tsx
    - src/tools/protobuf-decoder/ProtobufDecoder.tsx
    - src/lib/tools/registry.ts
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "decodeUuid emits tsMs for v7 only — v1/v6 use a different epoch/unit, so reading their bytes as Unix-ms BE would be a wrong date"
  - "Repo uses pnpm (pnpm-lock.yaml), not package-lock.json; installed js-md5 via pnpm"
  - "ProtobufDecoder already imported the shared StatusBar from base64's path — repointed it to the neutral home (the D-04 Protobuf fold was NOT a no-op as the plan assumed)"

patterns-established:
  - "Pure-lib TDD: assert fixed known-good vectors (never self-referential generate->decode on random data)"
  - "Randomness via crypto.getRandomValues only (CSPRNG), never a non-crypto PRNG"

requirements-completed: []  # foundation only — TIME-01/JWT-01/HASH-01/UID-01 stay PARTIAL until their Wave-2 tool UIs ship (04-02..05)

# Metrics
duration: 6min
completed: 2026-05-31
---

# Phase 4 Plan 01: Catalogue Foundation Scaffold Summary

**Relocated the shared StatusBar to a tool-agnostic home + extracted CopyButton, hand-rolled pure ULID/UUIDv7/timeFormat libs (TDD against fixed vectors), installed js-md5@0.8.3 offline, and registered all four catalogue tools as placeholders — concentrating every registry.ts edit in Wave 1 so the four Wave-2 tool plans run conflict-free.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-31T12:35:29Z
- **Completed:** 2026-05-31T12:41:12Z
- **Tasks:** 4
- **Files modified:** 16 (11 created, 5 modified)

## Accomplishments
- Shared `StatusBar` moved to `src/components/StatusBar.tsx` with its Phase-3 prop/markup/aria contract byte-for-byte intact; Base64 AND Protobuf imports repointed.
- New reusable `CopyButton` (visible, focusable, `useCopyFeedback`-backed, platform-seam clipboard) for the Wave-2 tools.
- Three pure `src/lib/` modules, each TDD-tested against the exact known-good vectors: `ulid.ts` (`01ARZ3NDEKTSV4RRFFQ69G5FAV`→1469922850259, `7ZZZZZZZZZ` max, overflow throws), `uuidv7.ts` (`017f22e2-79b0-7cc3-98c4-dc0c0c180cc3` build + decode), `timeFormat.ts` (ISO `2016-07-30T23:54:10.259Z`, s/ms classify boundaries).
- `js-md5@0.8.3` installed (MIT, offline, ships its own `.d.ts`); empty-string vector `d41d8cd98f00b204e9800998ecf8427e` confirmed post-install (T-04-02 integrity check).
- JWT, Hash, UUID/ULID registered as placeholders → registry now lists six tools.
- Suite grew 182 → 206 (decoder 19 untouched), tsc clean, eslint 0.

## Task Commits

1. **Task 1: Relocate StatusBar + extract CopyButton** - `be31358a` (refactor)
2. **Task 2: Install js-md5 + ULID + UUIDv7 libs** - `3e32b0c3` (feat, TDD test+impl together)
3. **Task 3: Shared timeFormat lib** - `ac0a892d` (feat, TDD test+impl together)
4. **Task 4: Register four catalogue tools as placeholders** - `4c8bbe27` (feat)

_TDD note: lefthook blocks committing a red suite (Phase-2/3 precedent), so each TDD task's test + impl land together in one GREEN commit; RED was verified locally via `vitest run` before writing the impl._

## Files Created/Modified
- `src/components/StatusBar.tsx` - Relocated tool-agnostic status footer (parse·bytes·encoding?·error·timing)
- `src/components/CopyButton.tsx` - Visible focusable ≤1-keystroke copy affordance with Copied feedback
- `src/lib/ulid.ts` (+`.test.ts`) - Crockford base32 ULID encode/decode + CSPRNG randomness, overflow + malformed guards
- `src/lib/uuidv7.ts` (+`.test.ts`) - RFC 9562 UUIDv7 build + decode (version/variant/tsMs)
- `src/lib/timeFormat.ts` (+`.test.ts`) - ms↔local/UTC/ISO + relativeTime + classifyUnit + toUnixFromIso
- `src/tools/{jwt,hash,uuid-ulid}/index.ts` - Placeholder ToolDefinitions (makePlaceholder component)
- `src/tools/base64/Base64Tool.tsx` - StatusBar import repointed to `@/components/StatusBar`
- `src/tools/protobuf-decoder/ProtobufDecoder.tsx` - StatusBar import repointed to `@/components/StatusBar`
- `src/lib/tools/registry.ts` - +3 imports, TOOLS now 6 entries
- `package.json` / `pnpm-lock.yaml` - js-md5@0.8.3 pinned

## Decisions Made
- **`decodeUuid` tsMs for v7 only.** v1/v6 store a 60-bit 100ns count since 1582 (and v6 reorders it); decoding their bytes as a 48-bit BE Unix ms would emit a wrong date, so `tsMs` is left undefined for non-v7 (bug prevention).
- **pnpm, not npm-lock.** The repo's actual lockfile is `pnpm-lock.yaml` (the plan's `files_modified` listed `package-lock.json`); installed via `pnpm add`.
- **The D-04 Protobuf fold was NOT a no-op.** The plan asserted `grep StatusBar src/tools/protobuf-decoder/` returns nothing; in fact `ProtobufDecoder.tsx:24` imported `@/tools/base64/StatusBar`. Deleting the old file would have broken it, so it was repointed to the new neutral home — which is exactly what D-04 intends.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ProtobufDecoder imported the shared StatusBar from base64's path**
- **Found during:** Task 1 (StatusBar relocation)
- **Issue:** Plan claimed protobuf-decoder had no StatusBar import (a stale grep claim); `ProtobufDecoder.tsx:24` imported `@/tools/base64/StatusBar`, so deleting the old file broke the build (6 test files failed, tsc TS2307).
- **Fix:** Repointed that import to `@/components/StatusBar` (the relocation's intended target).
- **Files modified:** src/tools/protobuf-decoder/ProtobufDecoder.tsx
- **Verification:** 182/182 suite green, tsc 0.
- **Committed in:** be31358a (Task 1 commit)

**2. [Rule 3 - Blocking] Project uses pnpm, not npm**
- **Found during:** Task 2 (dependency install)
- **Issue:** Plan instructed `npm install js-md5@0.8.3` updating `package-lock.json`; the repo has `pnpm-lock.yaml` + `"packageManager": "pnpm@11.5.0"` and no `package-lock.json`.
- **Fix:** Installed via `pnpm add js-md5@0.8.3` (updates `pnpm-lock.yaml`).
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** `node -e "require('js-md5').md5('')"` → `d41d8cd98f00b204e9800998ecf8427e`.
- **Committed in:** 3e32b0c3 (Task 2 commit)

**3. [Rule 1 - Bug prevention] decodeUuid tsMs restricted to v7**
- **Found during:** Task 2 (UUIDv7 lib)
- **Issue:** Plan's decode spec mentioned extracting bytes 0-5 as 48-bit BE ms "for version 7 (and 1/6)". v1/v6 use a 100ns-since-1582 timestamp (v6 reordered), so that extraction would emit an incorrect Unix-ms date for v1/v6.
- **Fix:** Only v7 sets `tsMs`; v1/v6 leave it undefined with an explanatory comment.
- **Files modified:** src/lib/uuidv7.ts
- **Verification:** v7 vector decodes to 1645557742000 (2022-02-22T19:22:22Z); v4 has no tsMs.
- **Committed in:** 3e32b0c3 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug-prevention)
**Impact on plan:** All three were necessary for correctness/build; no scope creep. Deviation 1 actually fulfills D-04's intent more completely than the plan's stale assumption.

## Known Stubs

The three new tool `index.ts` files (`jwt`, `hash`, `uuid-ulid`) use `makePlaceholder(...)` as their `component`. **These stubs are intentional and explicitly required by this plan** — registration is concentrated in Wave 1 so the Wave-2 tool plans (04-03 JWT, 04-04 Hash, 04-05 UUID/ULID) each swap ONLY their own `index.ts` component without editing `registry.ts`. They render the neutral "coming soon" panel until then. No data-flow stubs in the pure libs (all fully implemented + vector-tested).

## Issues Encountered
None beyond the deviations above (all resolved inline).

## User Setup Required
None - no external service configuration required. js-md5 is a vendored offline dependency.

## Next Phase Readiness
- **Wave 2 is fully unblocked and conflict-free.** Each tool plan imports the shared `StatusBar`/`CopyButton` + its relevant lib and swaps only its own `index.ts` component.
- Unix Time (04-02) + JWT (04-03) both consume `timeFormat.ts`; UUID/ULID (04-05) consumes `ulid.ts` + `uuidv7.ts`; Hash (04-04) consumes `js-md5` + Web Crypto.
- **Standing harness reminder:** the pure libs are unit-verified in jsdom/Node; `crypto.subtle`/`randomUUID`/`Intl.RelativeTimeFormat` availability in the packaged WKWebView must still be confirmed in each Wave-2 tool's real-webview e2e gate (RESEARCH assumptions A1/A2).

---
*Phase: 04-catalogue*
*Completed: 2026-05-31*

## Self-Check: PASSED

All 11 created source files + the SUMMARY exist on disk; all 4 task commits (be31358a, 3e32b0c3, ac0a892d, 4c8bbe27) are present in git history.
