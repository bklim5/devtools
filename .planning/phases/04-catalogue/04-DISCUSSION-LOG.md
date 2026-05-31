# Phase 4: Catalogue - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 4-catalogue
**Areas discussed:** Dependencies & scaffolding, Unix Time + JWT, Hash Generator, UUID/ULID

---

## Area selection

| Option | Selected |
|--------|----------|
| Deps & scaffolding | ✓ |
| Unix Time + JWT | ✓ |
| Hash Generator | ✓ |
| UUID / ULID | ✓ |

**User's choice:** All four areas.

---

## Dependencies & scaffolding

| Question | Options | User's choice |
|----------|---------|---------------|
| MD5 | Vendor tiny MD5 lib / Hand-roll in-house | **Vendor a tiny MD5 lib** (→ D-01) |
| ULID | Hand-roll in-house / Vendor `ulid` lib | **Hand-roll ULID in-house** (→ D-02) |
| Dates | Native Intl/Date only / Vendor a date lib | **Native Intl / Date only** (→ D-03) |
| Scaffolding | Promote shared StatusBar+shell / Per-tool copy / You decide | **Promote shared StatusBar + simple-tool shell** (→ D-04) |

---

## Unix Time + JWT

| Question | Options | User's choice |
|----------|---------|---------------|
| Unix s/ms | Auto-detect by magnitude + override / Explicit unit toggle only | **Auto-detect + override** (→ D-05) |
| Reverse direction | Editable datetime + live 'now' / ISO paste only / You decide | **Editable datetime + live 'now'** (→ D-06) |
| JWT signature | Display-only / Optional HMAC verify | **Display-only, no verification** (→ D-07/D-09) |
| JWT claims | Humanize + flag expired / Raw claims only | **Humanize + flag expired** (→ D-10) |

---

## Hash Generator

| Question | Options | User's choice |
|----------|---------|---------------|
| Input modes | Text + hex/bytes (reuse bytes engine) / Plain text only | **Text + hex/base64, reuse bytes engine** (→ D-11) |
| Digests | All five at once, stacked / Selectable subset | **All five at once, stacked** (→ D-12) |
| Casing | Lowercase default + toggle / Lowercase only / You decide | **Lowercase default + uppercase toggle** (→ D-13) |

---

## UUID / ULID

| Question | Options | User's choice |
|----------|---------|---------------|
| Versions | v4+v7+ULID / v4+ULID only / You decide | **UUID v4 + v7 + ULID** (→ D-15) |
| Generate | One + regenerate key + batch N / Single, regenerate only | **One + regenerate key + batch N** (→ D-16) |
| Decode | Auto-detect + full breakdown / Minimal type+validity | **Auto-detect + full breakdown** (→ D-17) |

---

## Claude's Discretion

- Sidebar/registry ordering, icons, labels/keywords, example content (D-18).
- Hash debounce/large-input + async-state UX (D-19).
- Unit-toggle granularity (µs/ns), datetime input parsing, JWT relative-time wording, batch-count control, per-tool layout/spacing (D-20).

## Deferred Ideas

- JWT signature verification (optional HMAC) — deferred.
- Tool-scoped action palette (V2-01) — deferred.
- Persisting per-tool preferences — session-local by default.
- Protobuf decimal-byte-array input mode — backlog (Protobuf tool, not this phase).
- Window-geometry/native polish (Phase 5); distribution (Phase 6).
