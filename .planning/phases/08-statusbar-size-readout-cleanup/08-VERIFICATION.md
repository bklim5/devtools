---
phase: 08-statusbar-size-readout-cleanup
verified: 2026-06-02T16:05:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Real-WKWebView UI check via scripts/e2e-spike.sh against `tauri dev`"
    expected: "Hash / UUID·ULID / Unix Time / JWT status bars show NO size text (state label + error/timing only); Base64 / Protobuf / JSON formatter / XML formatter status bars STILL show the size readout (single count or `in → out` delta)"
    why_human: "Requires the real WebKit webview (Chromium screenshots are preview-only per the project verify-gate rule); cannot be confirmed by unit tests / jsdom alone"
  - test: "Phase-boundary gsd-ui-review WCAG-AA audit + human sign-off on a fresh `tauri build`"
    expected: "WCAG-AA audit passes and a human signs off on a fresh production build"
    why_human: "Phase-boundary gate explicitly owned by the orchestrator/human per the binding harness; not an automated check"
---

# Phase 8: StatusBar Size-Readout Cleanup Verification Report

**Phase Goal:** The shared `StatusBar` byte-count readout becomes opt-in so it appears only where input/output size is meaningful — kept on Base64/Hex/Bytes, the Protobuf decoder, and the new Formatters; removed (status text only) from Hash, UUID/ULID, Unix Time, and JWT.
**Verified:** 2026-06-02T16:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `byteCount` prop is OPTIONAL; absent → no `aria-label="byte count"` span; no other StatusBar behavior changed | ✓ VERIFIED | `StatusBar.tsx:18` `byteCount?: number`; `:72` guard `{typeof byteCount === "number" ? (…) : null}`; parse-state, error, timing, encoding spans all outside the guard and unchanged. Tests `StatusBar.test.tsx:47-72` assert absent (omitted, and outputBytes-without-byteCount) → `queryByLabelText("byte count")` null while parse-state span still "Empty". |
| 2 | Size readout PRESENT on Base64/Hex/Bytes, Protobuf decoder, both Formatters | ✓ VERIFIED | Keep components still pass the prop: `Base64Tool.tsx:188 byteCount={byteCount}`, `ProtobufDecoder.tsx:248 byteCount={result.byteCount}`, `FormatterView.tsx:228 byteCount={status.byteCount}` (drives JSON + XML). Behavioral present-assertions: `Base64Tool.test.tsx:191`, `ProtobufDecoder.test.tsx:66`, `JsonFormatterTool.test.tsx:69`, `XmlFormatterTool.test.tsx:69` — all `getByLabelText("byte count")` truthy after valid input. |
| 3 | Size readout ABSENT on Hash/Checksum, UUID/ULID, Unix Time, JWT — parse/status text only | ✓ VERIFIED | `grep -c byteCount` = 0 in all four drop tools; StatusBar JSX confirmed prop-free (`HashTool.tsx:200`, `UuidUlidTool.tsx:302`, `UnixTimeTool.tsx:272-276`, `JwtTool.tsx:223-227`) — parseState/error/timing retained. Absent-assertions in each drop test (`HashTool.test.tsx:73-74`, `Uuid…:189-190`, `UnixTime…:142-143`, `Jwt…:162-163`): `queryByLabelText("byte count")` null + parse-state span present. |
| 4 | Affected tests assert present-where-kept / absent-where-dropped via the span; decoder + its 19 tests byte-for-byte untouched | ✓ VERIFIED | Present/absent matrix confirmed above via `aria-label` span (not text). Decoder last touched in Phase-1 commit `90583b79`; no Phase-8 changes under `src/lib/protobuf/`; `decoder.test.ts` has exactly 19 `it/test` blocks, all green in the run below. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/components/StatusBar.tsx` | Optional `byteCount?` + `typeof === "number"` gate | ✓ VERIFIED | Line 18 optional prop; line 72 render guard; inner single-count/delta byte-identical |
| `src/components/StatusBar.test.tsx` | Absent → no span; present single + delta | ✓ VERIFIED | `describe("StatusBar optional byteCount")` lines 47-72; uses `queryByLabelText` for absent case |
| `src/tools/hash/HashTool.tsx` | StatusBar without `byteCount` + unused const removed | ✓ VERIFIED | Line 200 prop-free; `grep -c byteCount` = 0 (dead const removed) |
| `src/tools/uuid-ulid/UuidUlidTool.tsx` | StatusBar without `byteCount` | ✓ VERIFIED | Line 302 prop-free; grep 0 |
| `src/tools/unix-time/UnixTimeTool.tsx` | StatusBar without `byteCount` | ✓ VERIFIED | Lines 272-276 prop-free; grep 0 |
| `src/tools/jwt/JwtTool.tsx` | StatusBar without `byteCount` | ✓ VERIFIED | Lines 223-227 prop-free; grep 0 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `StatusBar.tsx` | size `<span aria-label="byte count">` | `typeof byteCount === "number"` guard | ✓ WIRED | Line 72 guard wraps the span; verified present |
| drop tools (hash/uuid/unix/jwt) | `StatusBar` | JSX with no `byteCount` attribute | ✓ WIRED | All four render `<StatusBar>` without the prop |
| keep tools (base64/protobuf/formatter) | `StatusBar` | JSX passing `byteCount={…}` | ✓ WIRED | Real values: `byteCount`, `result.byteCount`, `status.byteCount` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| Protobuf StatusBar | `result.byteCount` | `useDecode` real decode (test drives `089601` → field #1, uint64=150) | Yes — span renders in test | ✓ FLOWING |
| JSON/XML formatter StatusBar | `status.byteCount` | `FormatterView` status, real paste input in tests | Yes — span renders in test | ✓ FLOWING |
| Base64 StatusBar | `byteCount` | real input ("5 bytes" asserted) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| StatusBar + 4 drop + 4 keep + decoder tests | `npx vitest run` (10 files) | 10 files / 105 tests passing | ✓ PASS |
| Type safety | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Decoder untouched | `git log -1 -- src/lib/protobuf/decoder.ts` | last touch = Phase-1 commit `90583b79` | ✓ PASS |
| Drop set has no byteCount | `grep -c byteCount` ×4 | 0 in all four | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| UIX-01 | 08-01-PLAN | Status-bar size readout appears only where input/output size is meaningful; removed from Hash/UUID·ULID/Unix Time/JWT | ✓ SATISFIED | Truths 1-4 verified; REQUIREMENTS.md:29 marks UIX-01 complete, traceability table maps it solely to Phase 8 |

No orphaned requirements: REQUIREMENTS.md maps only UIX-01 to Phase 8, and the plan declares `requirements: [UIX-01]`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | None | — | Drop-tool StatusBar guard is `typeof === "number"` (not truthy), so the removed prop — not a `byteCount={0}` — is the correct mechanism; review (08-REVIEW.md) confirms 0 critical / 0 warning. |

### Human Verification Required

1. **Real-WKWebView UI check** (`scripts/e2e-spike.sh` against `tauri dev`)
   - Expected: Hash / UUID·ULID / Unix Time / JWT status bars show NO size text; Base64 / Protobuf / JSON / XML formatter status bars STILL show the size readout (single count or `in → out` delta).
   - Why human: requires the real WebKit webview per the project verify-gate; jsdom unit tests cannot stand in.

2. **Phase-boundary gsd-ui-review WCAG-AA audit + human sign-off on a fresh `tauri build`**
   - Expected: WCAG-AA audit passes; human signs off on a fresh production build.
   - Why human: explicitly an orchestrator/human-owned phase-boundary gate.

### Gaps Summary

No automated gaps. All four success criteria are verified in the codebase: `byteCount` is optional and gated, the readout is present on the keep tools and absent on the drop tools, every affected tool test asserts the correct present/absent state via the stable `aria-label="byte count"` span, and the hero decoder plus its 19 tests are byte-for-byte untouched (last modified in Phase 1). 105 tests pass, `tsc --noEmit` is clean.

Status is `human_needed` solely because the binding harness defers two phase-boundary gates to a human: the real-WKWebView UI verification and the `gsd-ui-review` WCAG-AA audit + `tauri build` sign-off. These are environment/human-owned per CLAUDE.md and the plan, not implementation gaps.

---

_Verified: 2026-06-02T16:05:00Z_
_Verifier: Claude (gsd-verifier)_
