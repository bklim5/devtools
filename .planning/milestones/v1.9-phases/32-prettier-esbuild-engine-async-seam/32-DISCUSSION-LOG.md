# Phase 32: Prettier/esbuild Engine & Async Seam - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** 32-prettier-esbuild-engine-async-seam
**Areas discussed:** Async pending-state UX, Minify UX model, printWidth control shape, Error surface

---

## Async pending-state UX

| Option | Description | Selected |
|--------|-------------|----------|
| Keep last output + status hint | Last-good output stays; subtle "Formatting…" in StatusBar; no flicker | ✓ |
| Dim output + spinner | Dim/spinner overlay while formatting | |
| Nothing (rely on speed) | No pending indicator | |

**User's choice:** Keep last output + status hint.

| Option | Description | Selected |
|--------|-------------|----------|
| Short debounce (~150-200ms) | Coalesce typing; latest-wins guard still protects ordering | ✓ |
| No debounce, format every change | Mirror JSON/XML D-07 paste-instant exactly | |

**User's choice:** Short debounce (~150-200ms).

---

## Minify UX model

| Option | Description | Selected |
|--------|-------------|----------|
| Disable indent/printWidth when ON | Controls disabled while Minify ON | |
| Keep visible + inert | Controls do nothing while ON | |
| Hide them when ON | Remove controls while ON | |

**User's choice (free text):** Make minify **mutually exclusive** — when minify is selected we shouldn't have spaces; reconsider JSON/XML the same way.

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent toggle (keep current) | Minify stays a live pressed toggle | |
| One-shot action button | Click-once minify then revert | |

**User's choice (free text):** Leans one-shot action button; open to changing JSON/XML too.

### Follow-up (clarifying the model + PRT-11 conflict)

| Option | Description | Selected |
|--------|-------------|----------|
| Mode selector, live-derived | Segmented Prettify\|Minify, output still live; Minify hides indent/printWidth | ✓ |
| One-shot action buttons | Prettify/Minify buttons; output only changes on click (abandons live-derive) | |
| Mutually-exclusive toggle | Keep live-derive; Minify toggle disables indent/printWidth | |

**User's choice:** Mode selector, live-derived (preview approved).

| Option | Description | Selected |
|--------|-------------|----------|
| Amend PRT-11, change all 4 in P32 | Unify model across JSON/XML + 2 new tools this phase | ✓ |
| New Prettier tools only now | Apply only to new tools; JSON/XML later | |
| Defer JSON/XML change to backlog | Lock new tools; retrofit JSON/XML later | |

**User's choice:** Amend PRT-11, change all 4 in Phase 32.

**Notes:** Engines stay per-tool (JSON/XML native minify; esbuild-wasm for JS/TS/CSS; offline HTML minifier for HTML) — only the UI model unifies. Overrides research FEATURES.md "drop minify" recommendation.

---

## printWidth control shape

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented 80/100/120, default 80 | Mirrors indent segments; Prettier-tools only | ✓ |
| Number stepper/input | Free numeric printWidth | |

**User's choice:** Segmented 80/100/120 default 80 — after asking "what's the difference between indent and printWidth?" and receiving the explanation (indent = depth per level; printWidth = wrap threshold), confirmed "cool yes lets go".

---

## Error surface (role=alert)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse StatusBar, upgrade to alert | Single footer error surface, role=alert, line:col | ✓ |
| Separate alert line above output | Dedicated alert line, StatusBar status-only | |

**User's choice:** Reuse StatusBar, upgrade to alert.

## Claude's Discretion

Exact debounce ms (150–200), `useAsyncFormat` hook shape, chunk-guard clone + self-test mechanics, golden parity test harness structure, offline e2e mechanics.

## Deferred Ideas

None new. JSON/XML minify-model change was folded INTO Phase 32 (PRT-11 amendment) rather than deferred.
