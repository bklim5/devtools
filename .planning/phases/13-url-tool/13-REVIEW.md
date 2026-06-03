---
phase: 13-url-tool
reviewed: 2026-06-03T15:18:35Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/url.ts
  - src/lib/url.test.ts
  - src/components/SegmentedControl.tsx
  - src/components/SegmentedControl.test.tsx
  - src/tools/url/UrlTool.tsx
  - src/tools/url/UrlTool.test.tsx
  - src/tools/url/index.ts
  - src/lib/tools/registry.ts
  - test/e2e/url.e2e.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-06-03T15:18:35Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The Phase 13 URL tool is a clean, well-scoped implementation. `src/lib/url.ts` is a
faithful error-as-value wrapper over native `URL`/`URLSearchParams`/`encodeURI(Component)`
with zero new runtime deps, exactly as the phase constraints require. Every thrower
(`decodeURI*`, `encodeURI`) is caught and converted to `{ error }`; empty input is a
distinct neutral state; the discriminated `ParseResult`/`StrResult` unions are exhaustively
handled in the view. The decoder (`src/lib/protobuf/decoder.ts`) was correctly left
untouched and out of scope.

Security posture is sound for the stated constraints: all pasted/decoded values render as
React text children (default escaping) — no `dangerouslySetInnerHTML`, no `eval`, no raw
HTML sink anywhere in `UrlTool.tsx`. Clipboard writes route through the `platform` seam, not
`@tauri-apps` directly. The `password` field is surfaced plainly by explicit decision (D-09)
and the module never logs or persists it, which the code honors. No network calls are
introduced. Accessibility is handled well: `role="group"`/`aria-label` on the segmented
control, `aria-pressed` on segments, `role="alert"` on inline errors, `aria-invalid` on the
parse input, and `focus-visible` rings throughout (WCAG-AA, D-03). The registry entry is
purely additive and the control plane remains single-sourced.

No correctness or security issues were found. Three Info-level maintainability items are
noted below — none block the phase.

## Info

### IN-01: SegmentedControl comments claim a refactor that did not happen — styling is now duplicated, not shared

**File:** `src/components/SegmentedControl.tsx:1` and `:20`
**Issue:** The header comment says the control was *"promoted out of FormatterView"* and the
`toggleClasses` helper is *"lifted verbatim from FormatterView."* However,
`src/components/FormatterView.tsx` still defines its own identical `toggleClasses`
(FormatterView.tsx:65) and its own inline segmented markup with `role="group"` +
`aria-pressed` (FormatterView.tsx:194-204). So the segment styling now lives in two places
rather than one. The comment overstates what was done: it reads as if FormatterView was
migrated onto the new shared component, but it was not. This is a maintainability/accuracy
issue — the accent-on-active classes can now drift between the two copies, and a future
reader will trust a comment that is false.
**Fix:** Either (a) migrate `FormatterView`'s indent toggle to consume the shared
`SegmentedControl` and delete FormatterView's local `toggleClasses`, completing the "promoted
out of" claim; or (b) soften the comments to describe the truth, e.g.
`"// Accent-on-active segment styling, matching FormatterView's toggle (not yet shared)."`
Option (a) is the better DRY outcome and matches the comment's stated intent.

### IN-02: UrlTool comment says "8 readout rows" but the code renders 9

**File:** `src/tools/url/UrlTool.tsx:4` (also `:84` test comment, `UrlTool.test.tsx:3`/`:72`)
**Issue:** Multiple comments describe *"8 labeled... readout rows"* / *"8 fields"*, but
`READOUT_LABELS` (UrlTool.tsx:72-82) lists nine entries
(scheme, host, port, path, query, fragment, origin, username, password) and the view maps
all nine. The `url.test.ts` test comment at line 84 even self-corrects inline
(`"...username/password = 9 labels"`) while the surrounding prose still says 8. The count of
8 likely predates the `username` row being added. Harmless to runtime, but the recurring
"8 vs 9" mismatch is exactly the kind of stale doc that erodes trust in comments.
**Fix:** Update the comments to "9 readout rows" / "9 fields" (or describe it as "the URL's
components" without a hard count) in UrlTool.tsx:4, UrlTool.test.tsx:3, and url.test.ts:81
("maps all 8 fields" → "maps all 9 fields").

### IN-03: Stale registry block comment describes a pre-Phase-3 state that no longer holds

**File:** `src/lib/tools/registry.ts:17-20`
**Issue:** The comment states *"The three real tools below are registered enabled:false
ID-reserving stubs (they render null until Phase 3...), so ENABLED_TOOLS is currently
EMPTY."* This is no longer true at Phase 13: the array now holds nine tools, the URL tool is
`enabled: true`, and `ENABLED_TOOLS` is clearly non-empty (the router resolves real tools).
The comment documents a long-superseded phase-2/3 transitional state and will actively
mislead anyone reading the control plane today.
**Fix:** Trim the stale paragraph (registry.ts:17-20). Keep the accurate first paragraph
("single source of truth... adding a tool means importing it and dropping it in here") and,
if useful, replace the stale block with a one-liner noting `enabled: false` reserves an ID
without rendering. This is a doc-only edit to the file already changed in this phase, so it
fits the diff.

---

_Reviewed: 2026-06-03T15:18:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
