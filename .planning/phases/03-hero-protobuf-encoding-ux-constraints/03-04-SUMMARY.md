---
phase: 03-hero-protobuf-encoding-ux-constraints
plan: 04
subsystem: protobuf-decoder
tags: [protobuf, react, tdd, ui, resizable, clipboard, e2e, wkwebview, hero]

# Dependency graph
requires:
  - phase: 03 (plan 02)
    provides: "pure logic core — decodeInput(raw, override), chipsForField/defaultChipId, fieldsToJson(fields, selection); path-keyed selection model"
  - phase: 03 (plan 01)
    provides: "Preferences.protobufTreeStyle + usePreferences().setTreeStyle (persisted cards/rows)"
  - phase: 03 (plan 03)
    provides: "shared StatusBar (encoding prop optional); test/e2e/*.e2e.ts glob + scripts/e2e-spike.sh driver"
provides:
  - "ResizableSplit — in-house ~30-line col-resize two-pane divider (relative fr units, no library) — D-09/PRO-05"
  - "FieldTree/FieldNode — recursive cards/rows renderer over the real DecodedField[]; chips from LenInterpretation; neutral #N; auto-expanded sub-messages; stable-path selection; visible focusable per-node copy"
  - "ProtobufStatusBar — thin wrapper over the shared StatusBar (encoding omitted; surfaced as an accent chip instead)"
  - "ProtobufDecoder — the hero tool root mounted in the shell Outlet (registry component swapped off makePlaceholder)"
  - "test/e2e/protobuf-decoder.e2e.ts — real-WKWebView gate for the hero flow (passes on webkit)"
affects: [phase-04-remaining-tools, phase-05-native-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Selection/expansion state OWNED by the tool root (Map<path,chipId> / collapsed Set<path>), threaded down into a presentational recursive FieldTree — keyed by STABLE node path, never object identity (Pitfall 2)"
    - "In-house pointer-drag resizable split using a CSS-grid `fr | 7px | fr` template (relative units, layout-agnostic — UX-05), no react-resizable dependency"
    - "Detected encoding surfaced as an ACCENT chip (the active interpretation per D-08), not a redundant status-bar word — 03-CONTEXT <refinements>"
    - "Per-tool real-WKWebView e2e spec mirroring the 03-03 base64 pattern, run via scripts/e2e-spike.sh"

key-files:
  created:
    - src/tools/protobuf-decoder/ResizableSplit.tsx (+ test)
    - src/tools/protobuf-decoder/FieldNode.tsx
    - src/tools/protobuf-decoder/FieldTree.tsx (+ test)
    - src/tools/protobuf-decoder/ProtobufStatusBar.tsx
    - src/tools/protobuf-decoder/ProtobufDecoder.tsx (+ test)
    - test/e2e/protobuf-decoder.e2e.ts
  modified:
    - src/tools/protobuf-decoder/index.ts (component = ProtobufDecoder, off makePlaceholder)
    - src/router.test.tsx (stale placeholder assertion → real tool UI; Rule 1)

key-decisions:
  - "ProtobufStatusBar REUSES the shared 03-03 StatusBar (props fit verbatim) and OMITS the encoding prop — the detected encoding is surfaced more prominently as an accent chip near the override toggle (03-CONTEXT refinement, D-08)."
  - "Expanded-by-default tracked as a COLLAPSED Set<path> (D-05): message nodes auto-expand; collapse is opt-in. No reset of selection/collapsed on re-decode — stable-path keying makes stale paths harmless."
  - "Example payloads (D-03) verified against the real decoder: {1:150}=089601, nested {3:{1:150}}=1a03089601, packed varints {4:[3,270,150]}=2205038e029601 (clean packed-only, no message ambiguity), string {2:\"hi\"}=12026869."
  - "ResizableSplit attaches pointermove/up listeners on window inside pointerdown (scoped per-drag), avoiding the self-referential useCallback the linter flagged."

patterns-established:
  - "Tool-owns-state / tree-is-presentational: the recursive renderer never holds selection — survives re-decodes with fresh field objects"
  - "Accent = selection only enforced in tests: a jsdom assertion that #N (data-fnum) carries no text-accent, and a real-webview assertion that #N is not the accent-blue rgb"

requirements-completed: [PRO-01, PRO-02, PRO-03, PRO-04, PRO-05, PRO-06, PRO-07, UX-01, UX-02, UX-03, UX-04, UX-05]

# Metrics
duration: ~7 min active (excl. background Rust e2e builds)
completed: 2026-05-31
---

# Phase 3 Plan 04: Protobuf Hero UI Summary

**The schema-less Protobuf hero shipped into the shell Outlet: paste hex/base64 → instant recursive wire-format tree, LenInterpretation chips with a smart default + per-node override, VARINT zigzag/signed readings, auto-expanded sub-messages, an in-house resizable split, a persisted cards/rows toggle, neutral #N with accent reserved for selection, visible focusable per-node copy + copy-all-as-JSON, and a status bar — all thin React over 03-02's pure logic, proven on the real macOS WKWebView.**

## Performance

- **Duration:** ~7 min active development (real-WKWebView e2e Rust builds ran in the background)
- **Started:** 2026-05-31T08:36:09Z
- **Completed:** 2026-05-31T08:44:02Z
- **Tasks:** 2 auto tasks executed + e2e gate; Task 3 is the phase-boundary human-verify checkpoint (PENDING sign-off)
- **Files modified:** 8 created, 2 modified

## Accomplishments

- **ResizableSplit** (D-09/PRO-05): an in-house ~30-line pointer-drag col-resize divider using a CSS-grid `fr 7px fr` template — relative units only, no fixed pane widths (UX-05), no library; keyboard-nudgeable, visible focus.
- **FieldTree/FieldNode** (PRO-03/04/07, D-06/08): a recursive cards/rows renderer over the REAL `DecodedField[]`. Chips come straight from `chipsForField` (the real `LenInterpretation` keys); the smart default is selected and accent moves on click; `#N` renders NEUTRAL (text-tx, never accent); sub-messages recurse via `value.interpretations.message` and auto-expand (D-05); selection is keyed by a stable node path so a re-decode with fresh field objects does not reset it (Pitfall 2); every node has a visible focusable copy `<button>` (no hover-only, D-10).
- **ProtobufDecoder** (PRO-01/02/06, D-01/03/07/11): decodes on input change with NO decode button; a group byte surfaces a status-bar + inline `role="alert"` error and never crashes; the auto-detected encoding shows as an ACCENT chip with a manual hex/base64 override (D-01 refinement); four verified example payload chips; a persisted rows/cards toggle via `usePreferences().setTreeStyle`; per-node copy + a copy-all-as-JSON action through the platform clipboard seam.
- **Registry swap**: `component` moved from `makePlaceholder("Protobuf Decoder")` to the real `ProtobufDecoder` — the single control plane now renders the hero in the Outlet.
- **Real-WKWebView gate**: `test/e2e/protobuf-decoder.e2e.ts` drives the actual webview (paste→tree, neutral #N asserted against the accent-blue rgb, detected-encoding chip, auto-expanded nested message, group-byte-as-error with no white-screen, focusable per-node + copy-all-as-JSON, per-node override, rows/cards toggle). `bash scripts/e2e-spike.sh` → **2 passing on webkit 605.1.15** (base64 + protobuf).

## Task Commits

1. **Task 1 (RED+GREEN): ResizableSplit + FieldNode/FieldTree** - `7f799d9d` (feat)
2. **Task 2 (RED+GREEN): ProtobufStatusBar + ProtobufDecoder root + registry swap** - `45c88634` (feat)
3. **Real-WKWebView e2e spec** - `11373bca` (test)

_(TDD RED+GREEN landed together per the lefthook precedent — a red suite cannot be committed.)_

## Files Created/Modified

- `src/tools/protobuf-decoder/ResizableSplit.tsx` (+ `.test.tsx`) - in-house col-resize split, relative fr units.
- `src/tools/protobuf-decoder/FieldNode.tsx` - single field: #N neutral, wire badge, byte length, chips, value/submsg, copy.
- `src/tools/protobuf-decoder/FieldTree.tsx` (+ `.test.tsx`) - recursive cards/rows renderer, stable-path keying.
- `src/tools/protobuf-decoder/ProtobufStatusBar.tsx` - thin wrapper over the shared StatusBar (encoding omitted).
- `src/tools/protobuf-decoder/ProtobufDecoder.tsx` (+ `.test.tsx`) - the hero tool root.
- `src/tools/protobuf-decoder/index.ts` - registry component swapped off the placeholder.
- `src/router.test.tsx` - stale placeholder assertion updated to the real tool UI (Rule 1).
- `test/e2e/protobuf-decoder.e2e.ts` - real-WKWebView hero-flow gate.

## Decisions Made

- **ProtobufStatusBar reuses the shared StatusBar and omits `encoding`** — the detected encoding is the accent chip near the override toggle (more prominent, and consistent with D-08 since the override toggle selects it). Documented per the 03-CONTEXT `<refinements>` note.
- **Collapsed-set model for expand state** — message nodes default expanded (D-05); a `Set<path>` tracks collapses. Selection/collapsed are not reset on re-decode; stable-path keying makes any stale paths harmless (no crash, the entry is simply unused).
- **Example bytes verified against the real decoder** before shipping; the packed-varints example uses `2205038e029601` (length-prefixed `05 03 8e02 9601`) which decodes cleanly as packed varints `[3,270,150]` with no competing message interpretation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale router test asserted the protobuf placeholder**
- **Found during:** Task 2 (full-suite run after the registry swap)
- **Issue:** `src/router.test.tsx` asserted `findByText("Coming in Phase 3")` at the hero route — correct while the tool was a placeholder, now false because Task 2 swapped in the real component (the intended change).
- **Fix:** Updated the assertion to `findByLabelText("Protobuf input")` — verifies the real hero UI mounts at its route.
- **Files modified:** `src/router.test.tsx`
- **Verification:** Full suite 176/176 green.
- **Committed in:** `45c88634` (Task 2 commit)

**2. [Test infra] e2e `$$(...)` is not directly iterable**
- **Found during:** First e2e-spike run (the spec reached the WKWebView and decoded correctly, then threw on `Promise.all($$(...).map(...))`).
- **Issue:** WDIO's `$$` returns a chainable collection, not a plain array — `Promise.all`/`.map` over it throws "object is not iterable".
- **Fix:** Replaced the bulk text-read with two scoped `$("[data-fnum]*=#3")` / `*=#1` existence checks for the nested-message assertion.
- **Files modified:** `test/e2e/protobuf-decoder.e2e.ts` (pre-commit; landed in `11373bca`)
- **Verification:** Re-ran `scripts/e2e-spike.sh` → 2 passing on webkit.

---

**Total deviations:** 2 (1 Rule-1 stale-test fix, 1 e2e-spec API fix). No port-unchanged file touched; no scope creep.
**Impact on plan:** Both necessary for a green gate. The Rule-1 fix is a direct consequence of the intended registry swap.

## Issues Encountered

- The first e2e run left orphan dev-server (vite :1420) + app (:4445) processes after the spike's teardown trap; killed manually and confirmed both ports released. No impact on results.

## Known Stubs

None — the tool wires real data end to end (decodeInput → FieldTree → fieldsToJson). The output-pane empty state ("Paste hex or base64 protobuf bytes to decode.") is an intentional neutral empty state, not a stub.

## User Setup Required

None - no external service configuration required.

## Verification

- **Unit:** 176/176 vitest across 23 files (decoder's 19 untouched + 21 new in this plan's 3 suites); `tsc --noEmit` clean; `eslint .` 0 errors.
- **Real WKWebView e2e:** `bash scripts/e2e-spike.sh` → **2 passing on webkit 605.1.15** (base64 + protobuf). Screenshot at `test/e2e/__screenshots__/protobuf-decoder-wkwebview.png`.
- **Constraints held:** no `@tauri-apps/*` import in the tool (clipboard via the platform seam); registry/types/decoder/bytes untouched; `Store` seam not widened (toggle via `usePreferences`); HashRouter route `#/tools/protobuf-decoder`; no hover-only copy; no fixed pane widths.

## Requirements

- **PRO-01..07 → Complete** (paste-instant tree; groups-as-error; LenInterpretation chips + smart default + per-node override; VARINT zigzag/signed via chipsForField; auto-expanded sub-messages; resizable panes; persisted cards/rows toggle; neutral #N).
- **UX-01..05 → Complete** (both Phase-3 tools now satisfy paste-instant, visible focusable copy/no hover-only, status bar, AA focus/contrast, layout-agnostic responsive components).

## Next Phase Readiness

- Phase 3's two tools (Protobuf hero + Base64/Hex/Bytes) are both shipped, layout-agnostic, in the Outlet. **Task 3 — the phase-boundary human-verify checkpoint — is PENDING:** the user must sign off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit across both tools (steps 1-8 in the plan), including a relaunch to confirm the rows/cards pref persisted from prefs.json. Per the standing harness rule, the orchestrator runs `/simplify` + `/codex:review` and presents this sign-off.
- After sign-off, Phase 4 (the remaining four tools) is unblocked.

## Self-Check: PASSED

- All 11 created/modified files FOUND on disk.
- All 3 task commits (`7f799d9d`, `45c88634`, `11373bca`) FOUND in git history.

---
*Phase: 03-hero-protobuf-encoding-ux-constraints*
*Completed: 2026-05-31 (pending phase-boundary sign-off)*
