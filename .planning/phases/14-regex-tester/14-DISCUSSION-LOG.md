# Phase 14: Regex tester - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 14-regex-tester
**Areas discussed:** Highlight technique, Match/Replace layout, Flags & groups display, Pattern library

---

## Highlight technique

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only view | Editable input + separate read-only highlighted render beside it; no font/scroll sync. Research-recommended default. | |
| Overlay on textarea | Transparent textarea over an aligned highlight backdrop; type and see matches glow in place. Richer, fiddlier (font-metric + scroll sync). | ✓ |

**User's choice:** Overlay on textarea.
**Notes:** Chosen against the research's recommended default. Captured the alignment cost
(shared font metrics + mirrored scroll) and flagged it as the planner's main risk (D-02).
XSS safety via escaped React nodes holds regardless of technique (D-03). Read-only view kept
as documented fallback if overlay alignment proves too costly on the WKWebView.

---

## Match/Replace layout

| Option | Description | Selected |
|--------|-------------|----------|
| One combined view | Pattern+flags+text on top; matches+groups AND replace preview all live below, no mode switch. Research-recommended. | ✓ |
| Match \| Replace mode switch | Segmented control toggles between a Match view and a Replace view (Phase 13 URL style). | |

**User's choice:** One combined view.
**Notes:** Mode switch rejected because regex match + replace share the SAME inputs (unlike
Phase 13 URL's two distinct inputs). Replace is just one more field with a live preview (D-04/D-05).

---

## Flags & groups display

| Option | Description | Selected |
|--------|-------------|----------|
| 5 independent buttons | Row of g/i/m/s/u toggle buttons, aria-pressed; g visible, controls replace all-vs-first; enumeration always g-forced. | ✓ |
| 5 buttons, hide g | Expose only i/m/s/u; g always-on internally, hidden. | |

**User's choice:** 5 independent buttons (g visible).

| Option | Description | Selected |
|--------|-------------|----------|
| Per-match list, groups indented | Each match: full text + index; indented numbered + named groups, each copyable; unmatched optional → muted —. | ✓ |
| Table grid | Columns per group; denser but ragged across differing group counts, awkward for named groups. | |

**User's choice:** Per-match list, groups indented.
**Notes:** g toggle controls only the replace preview's all-vs-first; match enumeration is
always g-forced internally because matchAll requires g (D-07).

---

## Pattern library

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly 3 chips | Email/URL/IPv4 as inline clickable chips above the pattern field; frozen const; simple/linear patterns. | ✓ |
| 3 in a dropdown | Same three behind a select; saves space, adds a click. | |

**User's choice:** Exactly 3 chips.

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite directly | Clicking a chip replaces pattern + flags immediately, no confirm. | ✓ |
| Confirm if non-empty | Ask before overwriting a non-empty pattern field. | |

**User's choice:** Overwrite directly.
**Notes:** RGX-F2 (persisting custom patterns) stays deferred; library is a frozen 3-entry const.

## Claude's Discretion

Locked to RESEARCH recommendations (not separately asked, tunable with no UX impact):
worker timeout ~1000ms, optional small pre-worker debounce, eager respawn, message protocol
per RESEARCH Pattern 2, Vite `import.meta.url` worker chunk (+`base:'./'` only if it 404s,
e2e-gated), copy via useCopyFeedback/platform.clipboard, StatusBar omitted, registry metadata
(`id:"regex"`, `icon:Regex`).

## Deferred Ideas

RGX-F1 (streaming + pagination), RGX-F2 (persisted custom patterns), read-only-view highlight
technique (documented fallback for D-01), blob-worker fallback (avoid — needs CSP change).
