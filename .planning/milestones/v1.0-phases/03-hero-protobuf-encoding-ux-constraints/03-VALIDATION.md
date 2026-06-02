---
phase: 3
slug: hero-protobuf-encoding-ux-constraints
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.7 + @testing-library/react 16.3.2 |
| **Config file** | `vite.config.ts` (`test:` block; env `node`, `globals:false`, excludes `scaffold/**`) |
| **Quick run command** | `npx vitest run <path>` (or `npm test -- <path>`) |
| **Full suite command** | `npm test` (`vitest run`) + `npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds (full vitest + tsc) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test files>` + `npx tsc --noEmit` (lefthook pre-commit blocks a red suite)
- **After every plan wave:** Run `npm test` (full vitest) + `npx tsc --noEmit` + `eslint .`
- **Before `/gsd-verify-work`:** Full suite must be green (decoder's 19 tests included)
- **Phase gate:** Full suite green → per-task real-webview UI verify (`scripts/e2e-spike.sh`) → `tauri build` + `gsd-ui-review` WCAG-AA audit at the boundary
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PRO-01 / D-02 | hex/base64 detection heuristic (incl. `0x`, separators, empty, ambiguous) | unit (node) | `npx vitest run src/tools/protobuf-decoder/detectEncoding.test.ts` | ❌ W0 | ⬜ pending |
| PRO-03/04 / D-04/D-06 | chip set + default selection derived from real `LenInterpretation`/`FieldValue` keys, precedence order | unit (node) | `npx vitest run src/tools/protobuf-decoder/interpretationChips.test.ts` | ❌ W0 | ⬜ pending |
| PRO-02 | groups (3/4) + truncation surface as error string, not throw past the boundary | unit (node) | `npx vitest run src/tools/protobuf-decoder/useDecode.test.ts` | ❌ W0 | ⬜ pending |
| PRO-06 / D-07 | `protobufTreeStyle` round-trips through prefs (default cards; rows persists; corrupt → cards) | unit (jsdom) | `npx vitest run src/shell/prefsStore.test.ts src/shell/usePreferences.test.ts` | ⚠️ extend | ⬜ pending |
| PRO-04/05/07 / D-05/D-08 | recursive tree renders arbitrary depth; sub-messages auto-expanded; #N neutral; selection by chip | component (jsdom) | `npx vitest run src/tools/protobuf-decoder/FieldTree.test.tsx` | ❌ W0 | ⬜ pending |
| D-11 | copy-as-JSON shape (field numbers as keys, selected interpretation, nested recurse) | unit (node) | `npx vitest run src/tools/protobuf-decoder/copyAsJson.test.ts` | ❌ W0 | ⬜ pending |
| ENC-01/03 / D-12/D-14 | edit-one-derives-two via single Uint8Array; alphabet toggle re-derives base64 | unit (node) | `npx vitest run src/tools/base64/useBytesConvert.test.ts` | ❌ W0 | ⬜ pending |
| ENC-02 / D-13 | explicit per-field errors (odd hex, invalid chars); other two keep last-good | unit (node) | `npx vitest run src/tools/base64/useBytesConvert.test.ts` | ❌ W0 | ⬜ pending |
| UX-01 / D-15 | paste triggers instant transform (no button) | component (jsdom) | `npx vitest run src/tools/**/*.test.tsx` | ❌ W0 | ⬜ pending |
| UX-02 / D-10 | visible focusable copy button present; NO hover-only variant in DOM | component (jsdom) + real-webview | `npx vitest run` + `bash scripts/e2e-spike.sh` | ⚠️ extend | ⬜ pending |
| UX-03 / D-16 | status bar renders parse · bytes · encoding · errors · timing | component (jsdom) | `npx vitest run src/tools/**/StatusBar.test.tsx` | ❌ W0 | ⬜ pending |
| UX-04 / D-17 | visible focus ring; chip disabled has non-opacity cue (`aria-disabled`) | component (jsdom) + audit | `npx vitest run` + `gsd-ui-review` | ⚠️ boundary | ⬜ pending |
| UX-05 / D-18 | tool components layout-agnostic (no fixed widths) | component (jsdom) + real-webview | `npx vitest run` + `scripts/e2e-spike.sh` | ⚠️ extend | ⬜ pending |
| (immovable) | decoder behavior unchanged | unit (node) | `npx vitest run src/lib/protobuf/decoder.test.ts` (19 green) | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tools/protobuf-decoder/detectEncoding.test.ts` — PRO-01 / D-02
- [ ] `src/tools/protobuf-decoder/interpretationChips.test.ts` — PRO-03/04 / D-04/D-06
- [ ] `src/tools/protobuf-decoder/useDecode.test.ts` — PRO-02 error handling
- [ ] `src/tools/protobuf-decoder/copyAsJson.test.ts` — D-11
- [ ] `src/tools/protobuf-decoder/FieldTree.test.tsx` (+ `FieldNode.test.tsx`) — PRO-04/05/07, UX-03/04 (jsdom)
- [ ] `src/tools/base64/useBytesConvert.test.ts` — ENC-01/02/03, D-13
- [ ] Extend `src/shell/prefsStore.test.ts` + `usePreferences.test.ts` for `protobufTreeStyle`
- [ ] Extend the e2e spec / `scripts/e2e-spike.sh` assertions for the two real tools (focusable copy present, instant paste, no fixed widths)

*Framework install: none — vitest + @testing-library/react already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Paste behavior fidelity (Cmd+V → instant transform) | UX-01 | Real keystroke + clipboard event timing only meaningful in WKWebView | `tauri dev`, focus input, Cmd+V a hex/base64 blob, confirm tree renders < 2s with no button |
| Copy reaching the OS clipboard | UX-02 / D-10 | jsdom mocks clipboard; only the real `platform.clipboard` proves the write | `tauri dev`, click/keyboard a copy affordance, paste into another app, confirm value |
| Resizable divider drag feel | PRO-07 / D-09 | Pointer-drag ergonomics not assertable in jsdom | `tauri dev`, drag the `.divider`, confirm both panes resize smoothly |
| AA contrast against the dark palette | UX-04 / D-17 | Contrast ratios on rendered tokens need a real render | `gsd-ui-review` WCAG-AA audit at phase boundary |
| Packaged-app pref persistence (`protobufTreeStyle`) | PRO-06 / D-07 | Store split-brain bug ([[tauri-store-async-init-race]]) is packaged-only | `tauri build`, toggle rows/cards, relaunch, confirm choice persisted from prefs.json |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
