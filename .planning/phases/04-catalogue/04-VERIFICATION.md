---
phase: 04-catalogue
verified: 2026-05-31T15:18:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Unix Time on the packaged macOS app (#/tools/unix-time)"
    expected: "Paste 1469922850259 → local + UTC + ISO 2016-07-30T23:54:10.259Z instantly; s/ms toggle reinterprets; reverse ISO field derives the timestamp; live now updates on 1s tick and copies."
    why_human: "Packaged-WKWebView UX feel + visual match; the user is AFK and explicitly deferred sign-off (04-HUMAN-UAT.md)."
  - test: "JWT on the packaged macOS app (#/tools/jwt)"
    expected: "Paste a real JWT → header + payload pretty-printed, signature raw, alg surfaced; expired token shows expired flag; 2-segment string shows a clear field-scoped error, no crash."
    why_human: "Visual/badge appearance + packaged-webview behavior; sign-off deferred."
  - test: "Hash on the packaged macOS app (#/tools/hash)"
    expected: "Type abc → MD5 900150983cd24fb0d6963f7d28e17f72 + SHA-256 ba7816bf… (proves Web Crypto in the packaged webview); hex 616263 → same digests; UPPER casing toggle works; ≤1-keystroke copy."
    why_human: "Packaged secure-context Web Crypto + casing visuals; sign-off deferred (e2e already passed on real WKWebView)."
  - test: "UUID/ULID on the packaged macOS app (#/tools/uuid-ulid)"
    expected: "Id appears on open; Generate changes it; v4/v7/ULID toggle switches format; batch count > 1 yields copyable entries + copy-all; pasting a UUID and a ULID renders correct breakdowns; garbage → clear error."
    why_human: "Packaged-webview generation + breakdown visuals; sign-off deferred."
  - test: "Cross-cutting on the packaged macOS app (all four tools)"
    expected: "Every output has a visible (non-hover) focusable copy; each tool shows a status bar; ⌘K switches tools with no mouse; relaunch opens to the last-used tool; visuals match the Phase-3 look (accent = selected/active only)."
    why_human: "No-mouse switching + opens-to-last + visual consistency need a human on the packaged bundle; sign-off explicitly deferred per 04-HUMAN-UAT.md."
---

# Phase 4: Catalogue Verification Report

**Phase Goal:** The remaining four tools — Unix Time, JWT, Hash, UUID/ULID — ship under the identical binding workflow constraints, completing the six-tool v1 catalogue.
**Verified:** 2026-05-31T15:18:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The four catalogue tools render real components in the registry (no `makePlaceholder` remains for any of the six), each consumes the shared scaffolding, the decoder's 19 tests are untouched, and the cross-cutting UX constraints hold in code. All automated gates are green. The ONLY outstanding item is the packaged-build human sign-off, which the user explicitly deferred (AFK) — tracked as verification debt in `04-HUMAN-UAT.md`, NOT a code gap.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Unix Time: paste s/ms → local + UTC + ISO instantly, auto-detect + override, reverse derive, live now + copy | ✓ VERIFIED | `UnixTimeTool.tsx` (280 lines) imports `classifyUnit`/`formatTimestamp`/`toUnixFromIso` from `@/lib/timeFormat`; `setInterval(...,1000)` live now; UnixTimeTool.test.tsx green; e2e screenshot `unix-time-wkwebview.png` present |
| 2 | JWT: paste → decoded header + payload (pretty JSON) + raw signature + alg; malformed field-scoped; exp/iat/nbf humanized + flagged; display-only | ✓ VERIFIED | `decodeJwt.ts` uses `base64ToBytes` (no hand-rolled base64); `JwtTool.tsx` imports `@/lib/timeFormat`; no `verify/secret/HMAC` (display-only D-09); tests green; `jwt-wkwebview.png` present |
| 3 | Hash: text/hex/base64 → MD5 + SHA-1/256/384/512 stacked; MD5 sync js-md5, SHA async Web Crypto; per-row copy; casing toggle; async stale-guard | ✓ VERIFIED | `hashes.ts` `ALGORITHMS` 5 entries, `subtle.digest` + `js-md5`; `HashTool.tsx` `useEffect` + `let live` stale-guard, `CasingToggle` lower/UPPER applied on display; tests green; `hash-wkwebview.png` present |
| 4 | UUID/ULID: generate v4/v7/ULID on open + 1-keystroke regen + batch + copy-all; paste auto-detects + full breakdown; malformed flagged | ✓ VERIFIED | `UuidUlidTool.tsx` uses `crypto.randomUUID`/`generateUuidV7`/`generateUlid`, on-open `useEffect`, `generateBatch` + copy-all; `decodeId.ts` calls `decodeUuid`/`decodeUlid`; no `Math.random`; tests green; `uuid-ulid-wkwebview.png` present |
| 5 | All four tools render the real component in the registry (no placeholders) | ✓ VERIFIED | `registry.ts` TOOLS = 6 entries; `grep makePlaceholder` across all six index.ts → NONE; each index.ts has `component: <RealTool>` |
| 6 | Each tool consumes the shared scaffolding (timeFormat/bytes/ulid/uuidv7, CopyButton, StatusBar) | ✓ VERIFIED | All four import CopyButton + StatusBar; key-link greps all ≥1 (timeFormat×2 tools, bytes, ulid+uuidv7, subtle.digest+js-md5); Base64 repointed to `@/components/StatusBar` |
| 7 | The decoder's 19 tests are untouched and pass | ✓ VERIFIED | `src/lib/protobuf/decoder.ts`/`.test.ts` last touched commit 90583b79 (Phase 1); `vitest run` → 19/19 passing |
| 8 | UX-01 paste-instant transform | ✓ VERIFIED | onChange transforms in all four (no convert button); UI-REVIEW Pillar 6 4/4 |
| 9 | UX-02 visible focusable ≤1-keystroke copy (no hover-only) | ✓ VERIFIED | `CopyButton.tsx` renders a visible `<button aria-label="Copy …">` with `focus-visible:ring-2`; no `group-hover`/`opacity-0`; e2e asserts `isDisplayed()` |
| 10 | UX-03 status bar present | ✓ VERIFIED | StatusBar (`role="status"`) rendered in all four tools |
| 11 | UX-05 layout-agnostic (no fixed widths) | ✓ VERIFIED | UI-REVIEW Pillar 5 4/4 — all four `flex min-w-0 flex-1 flex-col`, standard spacing scale only |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/StatusBar.tsx` | tool-agnostic status footer | ✓ VERIFIED | 69 lines, `role="status"`, Base64 repointed |
| `src/components/CopyButton.tsx` | visible focusable copy | ✓ VERIFIED | 49 lines, exports CopyButton, focus-visible ring |
| `src/lib/ulid.ts` | Crockford base32 ULID | ✓ VERIFIED | 102 lines, no Math.random |
| `src/lib/uuidv7.ts` | RFC 9562 UUIDv7 | ✓ VERIFIED | 69 lines, no Math.random |
| `src/lib/timeFormat.ts` | ms↔local/UTC/ISO + relative | ✓ VERIFIED | 85 lines, native Intl/Date |
| `src/tools/unix-time/UnixTimeTool.tsx` | two-way converter | ✓ VERIFIED | 280 lines, wired to timeFormat |
| `src/tools/jwt/decodeJwt.ts` | pure decode + error taxonomy | ✓ VERIFIED | 95 lines, uses base64ToBytes |
| `src/tools/jwt/JwtTool.tsx` | JWT UI | ✓ VERIFIED | 231 lines, display-only |
| `src/tools/hash/hashes.ts` | md5 + sha digests | ✓ VERIFIED | 49 lines, subtle.digest + js-md5 |
| `src/tools/hash/HashTool.tsx` | hash UI | ✓ VERIFIED | 277 lines, stale-guard + casing |
| `src/tools/uuid-ulid/decodeId.ts` | auto-detect + breakdown | ✓ VERIFIED | 71 lines, decodeUuid/decodeUlid |
| `src/tools/uuid-ulid/UuidUlidTool.tsx` | generate + batch + decode | ✓ VERIFIED | 290 lines, CSPRNG |
| `src/lib/tools/registry.ts` | six real tools | ✓ VERIFIED | 6 entries, no placeholders |
| `.planning/phases/04-catalogue/04-UI-REVIEW.md` | WCAG-AA audit | ✓ VERIFIED | 24/24 PASS recorded |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| Base64Tool.tsx | components/StatusBar | `@/components/StatusBar` | ✓ WIRED |
| UnixTimeTool.tsx | timeFormat.ts | classifyUnit/formatTimestamp/toUnixFromIso | ✓ WIRED |
| decodeJwt.ts | bytes.ts | base64ToBytes | ✓ WIRED |
| JwtTool.tsx | timeFormat.ts | humanize exp/iat/nbf | ✓ WIRED |
| hashes.ts | Web Crypto + js-md5 | subtle.digest + md5 | ✓ WIRED |
| HashTool.tsx | bytes.ts | single Uint8Array | ✓ WIRED |
| UuidUlidTool.tsx | ulid.ts + uuidv7.ts | generateUlid/generateUuidV7 | ✓ WIRED |
| decodeId.ts | ulid.ts + uuidv7.ts | decodeUlid/decodeUuid | ✓ WIRED |
| registry TOOLS | six real components | no makePlaceholder | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| UnixTimeTool | formatted/nowMs | formatTimestamp(toMs(...)) + setInterval Date.now | Yes | ✓ FLOWING |
| JwtTool | header/payload/claims | decodeJwt(value) → real base64url+JSON | Yes | ✓ FLOWING |
| HashTool | orderedRows | digestAll(bytes) via js-md5 + subtle.digest, stale-guarded | Yes | ✓ FLOWING |
| UuidUlidTool | generated ids / decoded | crypto.randomUUID/generateUuidV7/generateUlid + decodeId | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit suite | `npx vitest run` | 269 passed (34 files) | ✓ PASS |
| Decoder hero spec | `npx vitest run src/lib/protobuf/decoder.test.ts` | 19 passed | ✓ PASS |
| Type check | `npx tsc --noEmit` | clean | ✓ PASS |
| Lint | `npm run lint` | 0 errors | ✓ PASS |
| js-md5 vector | `node -e "md5('')"` | d41d8cd98f00b204e9800998ecf8427e | ✓ PASS |
| Real-WKWebView e2e (per UI-REVIEW + HUMAN-UAT) | `bash scripts/e2e-spike.sh` | 6/6 on webkit (screenshots present) | ✓ PASS (recorded) |
| Fresh tauri build | bundle present | devtools-app.app + .dmg | ✓ PASS (recorded) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TIME-01 | 04-01, 04-02, 04-06 | paste unix s/ms → local+UTC datetimes + reverse | ✓ SATISFIED | UnixTimeTool wired to timeFormat; tests + e2e green |
| JWT-01 | 04-01, 04-03, 04-06 | paste JWT → header+payload (+signature), malformed reported | ✓ SATISFIED | decodeJwt + JwtTool, display-only; tests + e2e green |
| HASH-01 | 04-01, 04-04, 04-06 | text/bytes → MD5 + SHA-1/256/384/512 | ✓ SATISFIED | hashes.ts js-md5 + Web Crypto vectors; tests + e2e green |
| UID-01 | 04-01, 04-05, 04-06 | generate + decode UUID/ULID | ✓ SATISFIED | decodeId + UuidUlidTool, CSPRNG; tests + e2e green |

No orphaned requirements: REQUIREMENTS.md maps exactly TIME-01/JWT-01/HASH-01/UID-01 to Phase 4, all claimed by phase plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `@tauri-apps/*` direct imports in any tool | — | clean (platform seam honored) |
| — | — | No `Math.random` in generators/libs | — | clean (CSPRNG only) |
| — | — | No TODO/FIXME/placeholder/coming-soon in tools or libs | — | clean |
| — | — | No hover-only / opacity-0 copy | — | clean (UX-02 honored) |

No blockers, warnings, or info-level anti-patterns found.

### Human Verification Required

The 04-06 phase-boundary human sign-off on the packaged macOS bundle was explicitly DEFERRED by the user (AFK; will manually verify Phase 4 + Phase 5 together), tracked in `04-HUMAN-UAT.md` (status: partial, 5/5 pending). This is verification debt, not a code gap. The 5 deferred tests are surfaced in the frontmatter `human_verification` block. Automated layers backing them are all green (269/269 vitest, tsc clean, eslint 0, e2e 6/6 on real WKWebView, fresh tauri build .app+.dmg, WCAG-AA 24/24).

### Gaps Summary

No code-level gaps. Every must-have (4 tool truths + registry-real + shared-scaffold + decoder-19-untouched + 4 cross-cutting UX) is verified against the actual codebase, not just SUMMARY claims:
- Registry holds 6 real components; `makePlaceholder` is gone from all six index files.
- All shared scaffolding (timeFormat, bytes, ulid, uuidv7, CopyButton, StatusBar) is imported AND used with real data flowing.
- The hero decoder (`src/lib/protobuf/decoder.ts`) is byte-for-byte untouched since Phase 1 and its 19 tests pass.
- Cross-cutting UX (paste-instant, visible focusable copy, status bar, layout-agnostic, WCAG-AA) holds in code and is corroborated by the recorded UI-REVIEW (24/24) and 6/6 real-WKWebView e2e.

Status is `human_needed` solely because of the explicitly-deferred packaged-build sign-off (the binding harness's per-phase human checkpoint). No `gaps_found` items exist.

---

_Verified: 2026-05-31T15:18:00Z_
_Verifier: Claude (gsd-verifier)_
