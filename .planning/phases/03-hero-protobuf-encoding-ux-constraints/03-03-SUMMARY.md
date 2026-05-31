---
phase: 03-hero-protobuf-encoding-ux-constraints
plan: 03
subsystem: base64-hex-bytes-tool
tags: [base64, hex, bytes, encoding, ux, clipboard, e2e, wkwebview, tdd]
requires:
  - "src/lib/bytes.ts (byte conversions — base64/base64url/hex/utf8)"
  - "src/lib/platform (clipboard seam)"
  - "src/lib/tools/registry.ts + types.ts (registry component swap point)"
  - "src/tools/base64/StatusBar.tsx (shared status bar; also consumed by 03-04)"
provides:
  - "Real Base64/Hex/Bytes tool mounted in the shell Outlet (registry component = Base64Tool, no placeholder)"
  - "useBytesConvert: single internal Uint8Array, three-way derive, per-field errors, clear-on-error, alphabet toggle"
  - "StatusBar with OPTIONAL encoding prop (encoding chip reserved for auto-detection; protobuf 03-04 reuses it)"
  - "test/e2e/base64.e2e.ts: real-WKWebView gate; wdio.conf globs test/e2e/*.e2e.ts"
affects:
  - "03-04 (reuses StatusBar; the detected-encoding accent-chip refinement is recorded in 03-CONTEXT.md)"
  - "bytes.ts base64url encoding now omits padding on the native path too (all callers)"
tech-stack:
  added: []
  patterns:
    - "Single-source-of-truth Uint8Array with parameterized parse-error handler (failParse)"
    - "Copy confirmation via a per-click tick that re-arms a useEffect timer"
    - "Per-tool real-WKWebView e2e spec driven by scripts/e2e-spike.sh (HRN-02 driver)"
key-files:
  created:
    - "src/tools/base64/useBytesConvert.ts (+ test)"
    - "src/tools/base64/Base64Tool.tsx (+ test)"
    - "src/tools/base64/StatusBar.tsx"
    - "src/lib/bytes.test.ts (native toBase64 omitPadding regression)"
    - "test/e2e/base64.e2e.ts (real-WKWebView spec)"
  modified:
    - "src/tools/base64/index.ts (component = Base64Tool, off makePlaceholder)"
    - "src/lib/bytes.ts (native toBase64 omitPadding for base64url — approved port-unchanged edit)"
    - "wdio.conf.ts (specs glob test/e2e/*.e2e.ts)"
    - "src/lib/tools/... untouched (registry/types/decoder port-unchanged)"
  removed:
    - "test/e2e/skeleton.e2e.ts (stale; skeleton UI deleted at Phase-1 close, D-05)"
decisions:
  - "D-13 refined (user-directed): on a field parse error the OTHER two panes are CLEARED, not left last-good."
  - "Trimmed the redundant encoding chip from the Base64 status bar; reserved it for auto-detection (protobuf surfaces it as an accent chip — 03-04)."
  - "bytes.ts native toBase64 now passes omitPadding for base64url so the real webview matches the btoa fallback."
metrics:
  completed: 2026-05-31
  tasks: 3
  files-changed: 11
  tests: "155/155 (decoder 19 untouched) + real-WKWebView e2e 1 passing"
---

# Phase 3 Plan 03: Base64/Hex/Bytes Tool Summary

Shipped the real Base64/Hex/Bytes tool into the shell's `<Outlet/>` (replacing the Phase-2 placeholder): three stacked, independently-editable panes (Text / Base64 / Hex) all derived from one internal `Uint8Array`, a base64/base64url alphabet toggle, per-field errors, a status bar, and a visible focusable copy on every pane — all byte work routed through `src/lib/bytes.ts`, clipboard through the platform seam. ENC-01..03 complete; UX-01..05 satisfied for this tool (the Protobuf tool, 03-04, must still satisfy them).

## What Was Built

- **`useBytesConvert.ts`** — one internal `Uint8Array` is the source of truth; editing any of text/base64/hex re-parses ONLY that field and re-derives the other two. Per-field error state; the alphabet toggle re-derives only the base64 string from current bytes (no round-trip re-parse).
- **`Base64Tool.tsx`** — three layout-agnostic `<Pane>`s (no fixed widths), the alphabet toggle (active = accent, the project's "accent = selected only" rule), per-pane visible focusable `<button>` copy with a momentary "Copied" confirmation, and the status bar.
- **`StatusBar.tsx`** — shared, presentational; parse state · byte count · (encoding) · error · timing. `encoding` is OPTIONAL so tools where the user picks the encoding omit it.
- **`index.ts`** — registry `component` swapped from `makePlaceholder` to `Base64Tool`.

## Verification-Feedback Round (real-WKWebView checkpoint)

The Task-3 human-verify gate surfaced 5 items; all addressed, each with tests:

1. **base64url kept `=` padding on the real webview** — root cause: native `Uint8Array.toBase64` keeps padding unless `omitPadding` is set, while the btoa fallback already stripped it. Fixed in `bytes.ts` (native path now passes `omitPadding: alphabet === "base64url"`). Added `bytes.test.ts` stubbing the native prototype (Node 22 has no native `toBase64`, so the suite couldn't otherwise reach that path).
2. **Field error now CLEARS the other panes** (refines D-13) — odd-length hex blanks Text + Base64 instead of showing stale last-good.
3. **Copy confirmation** — tick + "Copied" for ~1.2s, reverts; a per-click tick re-arms the timer so rapid re-clicks restart the window.
4. **`setAlphabet` guard** (from code-review) — toggling the alphabet while base64 holds unparseable input no longer blanks the raw text.
5. **Trimmed the redundant status-bar encoding chip** — in the Base64 tool the alphabet toggle already shows it; chip reserved for auto-detection.

## Real-Webview Automation (per the verify-gate convention)

- Wrote `test/e2e/base64.e2e.ts` — drives the ACTUAL macOS WKWebView via `tauri-plugin-webdriver`: derive panes, clear-on-error, the base64url-no-padding fix (only provable where native `toBase64` exists), and visible focusable copy; screenshots the real webview.
- Removed the stale Phase-1 `skeleton.e2e.ts` (its UI was deleted at Phase-1 close, D-05) and pointed `wdio.conf` at `test/e2e/*.e2e.ts` so each tool adds its own spec. Resolved the lingering Phase-2 deferred eslint warning.
- **Ran it:** `bash scripts/e2e-spike.sh` → **1 passing on webkit (real WKWebView)**, screenshot at `test/e2e/__screenshots__/base64-wkwebview.png`.

## Deviations from Plan

- **must_have "the other two keep last-good" → CLEARED on error.** User-directed refinement of D-13 during the real-webview review; documented in `03-CONTEXT.md` and `useBytesConvert.ts`. Not drift.
- **Edited `src/lib/bytes.ts` (a port-unchanged file).** Approved: CLAUDE.md locks only `decoder.ts` + its 19 tests; this is a user-reported correctness fix that makes the native and fallback encode paths agree. The 19 decoder tests remain untouched and green.
- **Trimmed the status-bar `encoding` chip** (made the prop optional) — user-directed; the plan's must_have listed "current encoding (alphabet)" in the status bar, now reserved for auto-detection per the recorded 03-04 refinement.

## Requirements

- **ENC-01, ENC-02, ENC-03 → Complete** (three-way derive over internal `Uint8Array`; modern APIs + feature-detect polyfill via `bytes.ts`; explicit per-field errors; base64/base64url toggle).
- **UX-01..05 → Partial** (fully satisfied by the Base64 tool — paste-instant, visible focusable copy, status bar, responsive/layout-agnostic, AA focus/contrast; the Protobuf hero tool in 03-04 must also satisfy them before these flip to Complete).

## Verification

- Unit: **155/155 vitest** across 21 files (decoder 19 untouched); `tsc --noEmit` clean; eslint 0 errors.
- Chromium flow (preview, native `toBase64` present): derive, clear-on-error, base64url `aGVsbG8`, `fbff`→`+/8=`/`-_8`, Copied confirmation, clipboard confirmed holding the value.
- **Real WKWebView e2e: `scripts/e2e-spike.sh` → 1 passing (webkit 605.1.15).**
- Constraints held: tools import `src/lib/platform/` not `@tauri-apps/*`; registry/types/decoder untouched; HashRouter route `#/tools/base64`.

## Commits

- `00296c24`: feat(03-03): useBytesConvert single-Uint8Array derive + per-field errors
- `929fcc39`: feat(03-03): Base64Tool UI + StatusBar; swap registry off placeholder
- `423898ae`: fix(03-03): native toBase64 must omit padding for base64url
- `63a8935d`: fix(03-03): clear derived panes on a field parse error (refine D-13)
- `025b97b5`: feat(03-03): momentary 'Copied' confirmation on copy buttons
- `d16f009d`: refactor(03-03): drop redundant encoding chip from Base64 status bar
- `6bf732d4`: docs(03): record encoding-chip refinement for protobuf decoder (03-04)
- `e1358476`: test(03-03): real-WKWebView e2e spec for the Base64 tool

## Self-Check: PASSED

- All key files FOUND on disk and git-tracked; `skeleton.e2e.ts` removal staged.
- All 8 commits FOUND in git log.
- Real-WKWebView e2e artifact (`base64-wkwebview.png`) present; spike exit 0.
