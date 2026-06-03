# Phase 13: URL tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 13-url-tool
**Areas discussed:** Overall layout, Encode/decode controls, Parsed components readout, Query key→value table, Error handling

---

## Overall layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two stacked panels | Parser panel + encode/decode panel both always visible | |
| Mode switch (tabs) | Top segmented `[Parse] [Encode/Decode]`, each owns the view | ✓ |
| One input drives all | Single textarea feeds parse + table + enc/dec at once | |

**User's choice:** Mode switch (tabs).
**Notes:** The two jobs operate on different inputs (whole URL vs arbitrary string); conflating on one input rejected.

### Follow-up: default mode

| Option | Description | Selected |
|--------|-------------|----------|
| Parse first (default) | Order `[Parse] [Encode/Decode]`, Parse on open | ✓ |
| Encode/Decode first | Encode/Decode primary | |
| Remember last used | Persist last mode across launches | |

**User's choice:** Parse first, no persistence.

---

## Encode/decode controls

User first asked for clarification on "component vs full" and "encode vs decode" — explained in plain terms (encode = add %-escapes, decode = reverse; component escapes everything incl. `/?:@&=#`, full preserves URL structure). Re-asked with clearer framing.

### Direction handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show both at once (no switch) | Encoded + Decoded outputs live, like Base64 | ✓ |
| Encode/decode switch | Flip a direction toggle, one output | |

**User's choice:** Show both at once; `component | full` scope toggle picks the function pair.

### Follow-up: making component-vs-full clear (URL-02)

| Option | Description | Selected |
|--------|-------------|----------|
| One-line helper under the toggle | Mode-aware caption explaining the difference | ✓ |
| Labels only | Just the toggle labels | |
| Labels + info tooltip | Labels + focusable (i) tooltip | |

**User's choice:** One-line helper caption under the toggle.

---

## Parsed components readout

### Presentation + copy

| Option | Description | Selected |
|--------|-------------|----------|
| Labeled rows, each copyable | Vertical label→value rows, per-row copy | ✓ |
| Card grid, each copyable | Responsive card grid | |
| Labeled rows, copy-all only | Rows with a single copy-all | |

**User's choice:** Labeled rows, each copyable.

### Scope of parts + empty handling

| Option | Description | Selected |
|--------|-------------|----------|
| Six only; show empties as — | Required six, absent as muted — | |
| Six + origin/userinfo; show empties | Six + origin + username/password when present | ✓ |
| Six only; hide empties | Only render present parts | |

**User's choice:** Six + origin/userinfo; empties shown as muted —.
**Notes:** Password is mildly sensitive — surfaced plainly, planner should be aware.

---

## Query key→value table

### Repeated keys + ordering

| Option | Description | Selected |
|--------|-------------|----------|
| One row per occurrence, URL order | Iterate URLSearchParams, preserve order/multiplicity | ✓ |
| Grouped by key | One row per distinct key, values listed | |

**User's choice:** One row per occurrence, URL order.

### Value display + copy

| Option | Description | Selected |
|--------|-------------|----------|
| Decoded, value copyable, empty as — | Decoded key+value, per-value copy, empty as — | ✓ |
| Decoded + raw shown | Decoded plus original percent-encoded raw | |
| Decoded, copy-all only | Decoded values, single copy-all | |

**User's choice:** Decoded, value copyable, empty as —.

---

## Error handling (URL-05)

### Relative / scheme-less URL

| Option | Description | Selected |
|--------|-------------|----------|
| Clear inline error | Error-as-value "enter an absolute URL with a scheme" | ✓ |
| Auto-resolve against https:// | Retry with an assumed base | |
| Error + offer a toggle | Default error, opt-in "treat as relative" | |

**User's choice:** Clear inline error.
**Notes:** Confirmed alongside: empty input = neutral empty state (not error); bad percent-sequence = caught inline error.

---

## Claude's Discretion

- Helper-caption and error-string wording; `scheme` trailing-`:` display; StatusBar/byteCount (likely omit); shared `Toggle` component name/file and whether FormatterView usages migrate this phase; tool registry metadata (`id`/`name`/`category`/`keywords`/icon); pure-logic module boundary (`src/lib/url.ts` recommended).

## Deferred Ideas

- Auto-resolve relative URLs / "treat as relative" toggle — decided against (not just deferred).
- Raw + decoded query values side by side — rejected for table lightness.
- Persisting last-used mode — possible future polish.
