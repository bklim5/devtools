---
phase: 14-regex-tester
reviewed: 2026-06-03T00:00:00Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - src/lib/regex/regex.ts
  - src/lib/regex/worker.ts
  - src/tools/regex/RegexTool.tsx
  - src/tools/regex/index.ts
  - src/lib/tools/registry.ts
  - src/index.css
  - src/lib/regex/regex.test.ts
  - src/tools/regex/RegexTool.test.tsx
  - test/e2e/regex.e2e.ts
findings:
  critical: 0
  high: 0
  medium: 2
  low: 3
  total: 5
status: medium
---

# Phase 14: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** deep (cross-file: view ↔ worker ↔ pure core, watchdog/id-gating, registry)
**Files Reviewed:** 9
**Status:** issues_found (highest: Medium)

## Summary

Phase 14 adds a Regex tester as the 11th registry-driven tool: a pure/total core
(`regex.ts`), a thin Web Worker transport (`worker.ts`), and an overlay-editor view
(`RegexTool.tsx`) with a terminate-on-timeout watchdog, request-id gating, and an
XSS-safe highlight backdrop.

**Constraint compliance is clean.** All explicitly-flagged constraints hold:

- **XSS / no `dangerouslySetInnerHTML`** — the highlight backdrop slices text into
  `<span>`/`<mark>` React children (RegexTool.tsx:120-145); no HTML string is built;
  a runtime absence-grep test enforces it (RegexTool.test.tsx:211-232). PASS.
- **Platform seam** — clipboard goes through `platform.clipboard.writeText`
  (RegexTool.tsx:85); no `@tauri-apps/*` import anywhere in the tool. PASS.
- **Registry single control plane** — one additive `ToolDefinition` appended to
  `TOOLS` (registry.ts), router/sidebar/palette auto-derive. PASS.
- **Zero new runtime deps** — uses native `RegExp`/`matchAll`/`replace` + existing
  `lucide-react` glyph. PASS.
- **Watchdog correctness** — armed BEFORE worker construction (RegexTool.tsx:201
  vs 207-209), `terminate()` on timeout (202), lazy respawn (203,209), id-gated
  replies (212). zero-length-match enumeration uses native `matchAll` which
  self-advances, no manual exec loop, no hang (regex.ts:67-75; test 198-204). PASS.
- **decoder.ts + 19 tests** — NOT touched by the diff. PASS.
- **vite.config.ts** — listed in scope but the diff shows NO changes to it. The
  worker is bundled via the in-source `new URL("./worker.ts", import.meta.url)`
  literal (no config change needed). Noted, not a finding.

The findings below are correctness/robustness edge cases and minor quality items.
None are security or data-loss issues.

## Medium

### MD-01: Watchdog timer handle is not nulled when the timeout fires, leaving a dead handle in `timerRef`

**File:** `src/tools/regex/RegexTool.tsx:201-205`
**Issue:** The effect clears the previous watchdog at entry (line 178) and arms a new
one inside the debounce (line 201), and the id-gate (line 212) correctly drops stale
worker *replies*. The genuine gap is narrower: after a **timeout fires** (line
201-205), `timerRef.current` still holds the now-elapsed timer handle; it is never
nulled. A later `onmessage` or the unmount cleanup then calls `clearTimeout` on an
already-fired handle — harmless today, but it means `timerRef` can hold a dead handle
indefinitely. This makes the "is a run in flight?" signal ambiguous and is a latent
footgun if anyone later keys logic off `timerRef.current` being non-null.
**Fix:** Null the handle when the watchdog fires:
```ts
timerRef.current = setTimeout(() => {
  workerRef.current?.terminate();
  workerRef.current = null;
  timerRef.current = null; // <- mark the run as no longer in flight
  if (id === reqIdRef.current) setResult({ timedOut: true });
}, TIMEOUT_MS);
```

### MD-02: A slow-but-valid run cannot recover from a spurious timeout because an unchanged input never re-triggers the effect

**File:** `src/tools/regex/RegexTool.tsx:201-219`
**Issue:** When a watchdog fires it terminates the worker (line 202), destroying the
computation. If that run was actually about to reply — a run that took slightly longer
than `TIMEOUT_MS` but was NOT catastrophic (e.g. a large but linear input on a busy
machine) — the user permanently sees `timedOut` for a pattern that is in fact fine,
with no retry, because the effect only re-runs when the input identity changes and an
unchanged slow input never re-fires. On the real WKWebView (JSC caps backtracking at
~0.4-0.9s per the e2e note) the margin to `TIMEOUT_MS = 1000` is thin for large but
legitimate pastes. This is an inherent tradeoff of the terminate-only model (correctly
documented), but it is a single hard wall with no re-arm and no "still working…"
affordance.
**Fix:** Either (a) validate/raise `TIMEOUT_MS` against the largest expected paste at
the real-WKWebView gate (already a planned tuning point per the D-15 comment — make it
explicit), or (b) on timeout, re-post the same request once to the freshly respawned
worker before declaring `timedOut`, distinguishing "slow" from "catastrophic." At
minimum, document that an unchanged input cannot recover from a spurious timeout.

## Low

### LO-01: Replace with no `g` flag silently differs from the (g-forced) highlighted match count, with no UI cue

**File:** `src/lib/regex/regex.ts:99-104`
**Issue:** Enumeration is g-forced (line 54), so the Matches list and highlight
backdrop always show ALL matches. The replace preview uses the user's TRUE flags
(line 103), so with no `g` it replaces only the FIRST match (intended, D-07). The
result is correct but the UI can show, e.g., 5 highlighted matches while the Result
pane replaced only 1 — with no visual cue that the missing `g` is why. This is a
documented design decision, not a bug, but it is a usability sharp edge.
**Fix (optional):** When `replace !== ""` and `g` is not set, show a subtle hint near
the Result pane ("no `g` flag — first match only"). No code-correctness change
required.

### LO-02: Named-group React key is derived from the user-controlled group name

**File:** `src/tools/regex/RegexTool.tsx:489` (`key={`n${name}`}`)
**Issue:** `m.named` is built from `m.groups` (regex.ts:73); named group names are
unique within a single pattern by RegExp construction, so the `n${name}` key is safe
in practice. The minor smell is keying off user-derived content (the group name, which
the user controls in the pattern). Guaranteed-unique here, so this is informational
only.
**Fix:** None required; if defensiveness is wanted, key off the entry index instead:
`Object.entries(m.named).map(([name, val], ni) => <div key={`n${ni}`} …>`.

### LO-03: The trailing-newline height guard is appended unconditionally, adding a stray zero-width character even when the text has no trailing newline

**File:** `src/tools/regex/RegexTool.tsx:142-143`
**Issue:** Line 143 unconditionally pushes a `<span>` containing a single U+200B
(zero-width space) to keep the trailing-newline height in lockstep with the textarea.
For text without a trailing newline (the common case) this injects a zero-width
character into the backdrop that has no counterpart in the textarea. Because the
backdrop is `aria-hidden` and the character is zero-width, it is visually and
a11y-invisible, and the overlay-alignment e2e (regex.e2e.ts:103-153) passes — so this
is cosmetic/defensive only. Worth narrowing to the trailing-`\n` case if precise
glyph-count parity ever matters.
**Fix (optional):** Only emit the guard when the text ends in a newline (push the same
U+200B span guarded by `if (text.endsWith("\n"))`).

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
