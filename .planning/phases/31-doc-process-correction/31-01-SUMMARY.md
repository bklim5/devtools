---
phase: 31-doc-process-correction
plan: 01
status: complete
requirements: [PRT-13]
commits:
  - e5fa3da2 docs(31): retire 'six tools only' in CLAUDE.md — wedge-gated growth + two scoped dep exceptions
  - 50476e3d docs(31): fix README + PROJECT.md present-tense lines — wedge-gated growth, reframe adjacent zero-dep bullet
key-files:
  created: []
  modified:
    - CLAUDE.md
    - README.md
    - .planning/PROJECT.md
---

# Phase 31-01 Summary — Doc/Process Correction (PRT-13)

## What was built

A docs-only correction (no code, no bundle, no UI). Retired the stale **"six tools only"** and **"zero new runtime dependencies"** absolutes across the project's LIVING docs, replacing them with honest, present-tense **wedge-gated-growth** framing (11 tools today → 13 in v1.9) and recording the **two deliberate, scoped, reviewed heavy-dep exceptions** (Prettier for prettify + esbuild for minify) — explicitly NOT a precedent for grab-bag deps.

### Task 1 — CLAUDE.md (6 edits, commit e5fa3da2)
- Tagline: `Six tools, not a catalogue` → `A tight, wedge-gated tool set (11 tools today → 13 in v1.9), not a catalogue`.
- Critical-constraints tool-count line + managed-block tool-count line: both `Six tools only` bullets → `Wedge-gated tool set` (growing, wedge-gated, no grab-bag).
- Both `No network at runtime` constraint lines extended to record Prettier standalone + esbuild as two vendored/self-hosted, lazy-loaded, scoped exceptions (network claim preserved), "NOT a precedent for grab-bag deps."
- Managed-block prose (`six high-frequency transforms`) → wedge-gated growth framing.
- Result: `grep -qi "six" CLAUDE.md` now clean; `wedge-gated` ×2; both `No network at runtime` lines retained (count 2); Prettier/esbuild/scoped/not-a-precedent/grab-bag all present.

### Task 2 — README.md + PROJECT.md (3 present-tense lines, commit 50476e3d)
- README.md ~L49: `Six. Not seven.` → wedge-gated-growth framing (11→13, deferred-not-promised, must clear the wedge).
- PROJECT.md prose ~L5: `six at v1.0; JSON+XML in v1.1` → `grown to 11 tools by v1.8 and 13 in v1.9`.
- PROJECT.md ~L178 (`Curated tool set, wedge-gated`): dropped `now eight tools` + the `WCAG-AA, zero new runtime deps` absolute; recorded Prettier+esbuild exceptions; kept the historical quote `v1.0 locked "six tools only"` (now framed as growth).
- PROJECT.md ~L179: bullet TITLE reframed `**Zero new runtime dependencies**` → `**Near-zero runtime dependencies — two scoped exceptions**`, so the adjacent ~178/~179 bullets no longer contradict each other. "Hold this line" discipline preserved.
- Dated milestone-log lines + PROJECT.md ~L17/~23 (already-correct exception records) left untouched.

### Task 3 — Verification only (no writes)
- **Decoder byte-identity:** `git diff --quiet -- src/lib/protobuf/decoder.ts src/lib/protobuf/decoder.test.ts` → exit 0.
- **Source-immutability:** `git diff --name-only -- src/` → empty (no source file touched).
- **Diff-scope gate:** every changed path within {CLAUDE.md, README.md, .planning/PROJECT.md, .planning/ROADMAP.md, .planning/STATE.md, .planning/phases/31-doc-process-correction/**} — nothing outside.
- **Full-repo stale sweep:** `git grep -nE "six tools|Six\. Not seven|zero new runtime dep|Zero new runtime dependencies|now eight tools"` — every surviving hit classified as ALLOWED:
  - `.planning/MILESTONES.md`, `.planning/milestones/**`, `.planning/todos/completed/**` — dated / archived historical logs.
  - `.planning/PROJECT.md` — dated milestone-log lines (L21,62,82,148,201,247) + the intentionally-retained historical quote at L178.
  - `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/research/**`, `.planning/STATE.md` (L240 v1.1-completion log) — quote the wording to describe the PRT-13 correction task / historical completion.
  - `docs/archive/**`, `docs/design-and-plan.md` — point-in-time original v1 spec.
  - `src/lib/cron/cron.ts`, `src/lib/regex/regex.ts`, `src/shell/fuzzy.ts` — source-code comments, out of scope for a docs-only phase (source-immutability guard forbids editing) and not present-tense living-doc constraint assertions (cron/regex truthfully describe those modules' zero-dep implementation; fuzzy is a "ranker is ample for a small N" design-rationale comment).
  - **No present-tense stale assertion survives in any LIVING doc outside the allowlist.**

## Verification

Docs-only phase — grep + git-diff is the correct and complete verification surface (per the plan's `<verification_note>`). No vitest/tsc/build/UI applies. Final confirmations all green:
- `grep -qi "six" CLAUDE.md` → exit 1 (clean)
- `grep -ci "six tools" README.md` → 0
- `grep -c "now eight tools" .planning/PROJECT.md` → 0
- `grep -c "^- \*\*Zero new runtime dependencies\*\*" .planning/PROJECT.md` → 0
- decoder + 19 tests byte-for-byte untouched (git diff exit 0)

## Deviations

None. All target lines matched the plan's FROM text exactly; all six CLAUDE.md edits + three README/PROJECT edits applied as specified.

## Success criteria

1. ✅ CLAUDE.md records the wedge-gated GROWING set (11→13), no "six tools only".
2. ✅ Zero-dep wording (CLAUDE.md both `No network` lines; PROJECT.md ~178 + reframed ~179) records Prettier+esbuild as two scoped, reviewed exceptions, not a precedent; ~178/~179 internally consistent.
3. ✅ decoder.ts + 19 tests byte-for-byte untouched.
4. ✅ No stale present-tense assertion survives in any LIVING doc outside the historical/archive allowlist (full-repo sweep classified).
