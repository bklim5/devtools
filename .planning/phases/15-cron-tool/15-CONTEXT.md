# Phase 15: Cron tool - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning
**Source:** plan-phase open-questions gate (research-driven; 15-RESEARCH.md open questions resolved)

<domain>
## Phase Boundary

A new **Cron** tool (the 6th and final tool of v1.3) in the offline DevTools desktop app. It:
- Parses a cron expression into a **24-hour human-readable description**, paste-instant.
- Computes the **next 5 run times in local time**, each with an IANA timezone label.
- Supports 5-field and 6-field (with-seconds) expressions, macros, full field grammar, DOM/DOW OR-union semantics, and `L`/`nL`/`L-n` last-day/last-weekday syntax.
- Is built on a **hand-rolled, DST-correct, bounded next-run iterator** — no new runtime dependencies (zero-dep wedge; Temporal unavailable in WKWebView).

Scope is fixed to CRON-01..CRON-11. `W` and `#` scheduling are deferred (CRON-F1).
</domain>

<decisions>
## Implementation Decisions

### Timezone UX (resolves Open Question #1)
- **LOCKED: System zone only.** Use `Intl.DateTimeFormat().resolvedOptions().timeZone` for next-run computation and display its IANA label (e.g. `Asia/Singapore`). **No IANA zone picker** in v1.3 — deferred. CRON-05 requires only a label, which this satisfies.

### Unsupported syntax `W` / `#` (resolves Open Question #3; CRON-F1)
- **LOCKED: Reject cleanly.** Expressions containing `W` (nearest-weekday) or `#` (nth-weekday) — and `LW` — surface a clear inline error such as "`W`/`#` not supported in v1.3" via the error-as-value path (no throw, consistent with CRON-11). No half-feature "describe-but-don't-schedule" behavior. Revisit in CRON-F1.

### DST spring-forward convention (resolves Open Question #2 / Assumption A4)
- **LOCKED: Skip + advance.** When a cron-matched wall-clock time falls in the skipped spring-forward hour (non-existent local time), it produces **no run**; the iterator advances to the next valid match. Fall-back (repeated hour) is **de-duped to a single run**. This must be covered by an explicit DST fixture (CRON-07). This is the chosen, fixtured convention — note it is consistent and crash-free, which is what CRON-07 actually requires.

### `nL` / last-weekday DOW numbering (resolves Assumption A3 — locked, not asked)
- **LOCKED: 0–6 mapping.** `5L` means **"last Friday"** under this tool's existing 0–6 day-of-week mapping (0/7 = Sunday, 5 = Friday) — NOT Quartz's 1–7 convention (where 5 = Thursday). This is the only choice consistent with CRON-06's "treat 0 and 7 as Sunday" rule. Document the 0–6 choice explicitly in code + a dedicated fixture (this is the most likely off-by-one).

### 5-field default seconds (resolves Open Question #4 — locked, not asked)
- **LOCKED: second 0.** 5-field expressions fire at **second 0** (standard Vixie-cron). 6-field expressions take the leading seconds field. Disambiguate 5-vs-6 strictly by field count.

### Architecture (from RESEARCH.md — Standard Stack / Architecture Patterns)
- **Hand-roll everything; zero new runtime deps.** Both the next-run engine AND the human-readable description are hand-rolled. `cron-parser` (new dep + luxon) and `cronstrue` (~42 KB) are both disqualified by the zero-dep wedge.
- **DST substrate:** `Intl.DateTimeFormat.formatToParts` round-trip (Temporal is unavailable in WKWebView — verified). Follow the existing `src/lib/timeFormat.ts` precedent.
- **Three-layer template (mirror Phase 13 URL / Phase 14 Regex):** pure error-as-value `CronResult` discriminated union in `src/lib/cron/`; thin layout-agnostic view in `src/tools/cron/`; one append to the `TOOLS` registry. Tools import from `src/lib/platform/`, never `@tauri-apps/*`.
- **Bounded iteration cap** (~5-year / 5×366 candidate-day walk) guarantees termination → `{ kind: "never" }` for impossible expressions (CRON-08). Runs **synchronously on the main thread** — cron is cheap/bounded, so no Web Worker (unlike Phase 14's regex). The cap, not a Worker, is the freeze protection.
- **`@reboot`** is described as run-at-startup with **no** next-run computation (CRON-09).
- **Sidebar icon:** `Clock` glyph from `lucide-react@1.17.0` (verified present).

### CRON-10 isolation (locked decision from ROADMAP)
- `L` / `nL` / `L-n` (last-day / last-weekday) is planned as an **explicitly isolated final plan** with dedicated leap-year / month-length edge-case fixtures, so the rest of cron ships even if this slice proves hard.

### Claude's Discretion
- Internal module/file naming under `src/lib/cron/` and `src/tools/cron/` (mirror url/regex conventions).
- Exact shape of the `CronResult` / parsed-spec types, helper decomposition, and description-string phrasing (24-hour time required).
- Test file organization within the established vitest + `tsc --noEmit` setup.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research & requirements
- `.planning/phases/15-cron-tool/15-RESEARCH.md` — algorithm, DST substrate, DOM/DOW union, L-syntax fixtures, pitfalls, code examples, validation + security domains
- `.planning/REQUIREMENTS.md` — CRON-01..CRON-11 (+ deferred CRON-F1)
- `.planning/ROADMAP.md` — Phase 15 goal, success criteria, CRON-10 isolation decision

### Project constraints & harness
- `CLAUDE.md` — offline / six-tools / HashRouter / platform-abstraction / registry-control-plane constraints
- `docs/harness-and-decisions.md` — locked decisions + the per-task build/verify gate (authoritative)

### Reference implementations to mirror (read before coding)
- `src/lib/url.ts`, `src/lib/regex/regex.ts` — error-as-value pure-core pattern
- `src/lib/timeFormat.ts` — `Intl.DateTimeFormat` / `formatToParts` precedent (DST substrate)
- `src/lib/tools/registry.ts`, `src/lib/tools/types.ts` — registry control plane + tool type
- `src/tools/url/index.ts`, `src/tools/regex/index.ts`, `src/tools/regex/RegexTool.tsx` — thin view + registration template
- `test/e2e/url.e2e.ts`, `test/e2e/regex.e2e.ts` — real-WKWebView e2e spec template (add `cron.e2e.ts` to `scripts/e2e-spike.sh`)
</canonical_refs>

<specifics>
## Specific Ideas

- **Description must be 24-hour time** (project constraint, CRON-01).
- **Macros (CRON-03):** `@yearly`/`@annually`, `@monthly`, `@weekly`, `@daily`/`@midnight`, `@hourly`, `@reboot`.
- **Full grammar (CRON-04):** `*`, ranges `1-5`, steps `*/15` and `0-30/10` (step from non-zero base), lists `1,3,5`, day/month names `MON`/`JAN`.
- **DOM/DOW OR-union (CRON-06):** when BOTH day-of-month and day-of-week are restricted (non-wildcard), a run matches **either**; when one is `*`, AND with the other. `0` and `7` both = Sunday.
- **Impossible expr (CRON-08):** e.g. `0 0 30 2 *` (Feb 30) → "no upcoming runs" via the cap; never freezes.
- **Invalid expr (CRON-11):** wrong field count / out-of-range / unparseable token → clear inline error, no throw.
- **Known pitfalls to fixture** (from RESEARCH.md): step-from-non-zero-base (`0-30/10`), 0-vs-7 Sunday, seconds-field shifting all other fields, range off-by-one, the `5L` numbering trap, DST skip/fall-back.

## TDD note (from MEMORY + STATE)
lefthook rejects failing commits — do **not** plan standalone RED-only test commits. Land each test file GREEN with its implementation (the Phase-14 Rule-4 pattern).
</specifics>

<deferred>
## Deferred Ideas

- **CRON-F1:** `W` (nearest-weekday) and `#` (nth-weekday) next-run scheduling — rejected cleanly in v1.3 (see decision above), revisit later.
- **IANA timezone picker** — system zone only for v1.3.
</deferred>

---

*Phase: 15-cron-tool*
*Context gathered: 2026-06-03 via plan-phase open-questions gate*
