---
phase: 33-html-prettifier-tool
kind: harness-remediation
gates_run: [simplify, code-review-xhigh, codex-adversarial-review]
codex_rounds: 5
status: findings-addressed
updated: 2026-07-01
---

# Phase 33 — Binding Harness Remediation (orchestrator-run at phase boundary)

Per CLAUDE.md the code-quality gates are orchestrator-run over the whole phase
diff (`9d69375a..HEAD`) at the boundary, since plans 01–03 have no independently
mountable UI surface. This records what the gates found and how each was resolved.

## Gate 1 — /simplify (4 cleanup agents)
Production code assessed clean by all four angles (reuse/simplification/efficiency/
altitude). **Applied:** removed an unreachable line-only branch in the HTML tool's
error ternary to match the JSON sibling + D-11 intent (`refactor(33)`). **Skipped
(with cause):** charCodeAt micro-extraction (pessimizes the ASCII hot path + risks
the Codex-hardened surrogate counter), `exactBytes` "redundancy" (load-bearing
null→undefined type conversion), test-helper dedup (spans files outside the diff).
The double-`trim()` note was initially dismissed — Codex later proved it real (see R1).

## Gate 2 — /code-review xhigh (9 finder angles + sweep)
No confirmed correctness bugs. The esbuild-test-state-leak candidate was **refuted**
(vitest default `isolate:true` gives each test file an isolated module registry).
Other sweep items were by-design (golden locks are meant to freeze; the e2e
resource-timing check is honestly labelled best-effort with the human Wi-Fi gate as
the authoritative offline proof; OFFLINE-PROOF.md TBD rows are the pending checkpoint).

## Gate 3 — /codex:adversarial-review (5 rounds)
Each round re-run after the fix to confirm closure. Findings + resolution:

| R | Severity | Finding | Resolution |
|---|----------|---------|------------|
| R1 | high | Over-cap **all-whitespace** paste bypassed the byte guard: `isEmpty=input.trim()` ran before the bounded counter, so a >2 MB whitespace blob got a full-length `trim()` scan (the exact DoS) and was mislabeled empty. | FIXED — bounded byte scan runs first; trim only when under-cap (`fix(33)`; hook regression test). |
| R2 | high | Tool re-opened the same DoS: `HtmlFormatterTool` ran its OWN `input.trim()` on the raw value each render. | FIXED — expose `isEmpty` from the hook; tool consumes it, never re-trims (`fix(33)`; mounted 2.1M-whitespace regression). |
| R3 | high | **Pre-existing** minify bug (Phase 32) now user-reachable: `collapseMarkup` ran `\s+`→` ` over raw markup incl. tag definitions → quoted attribute values (`title="a   b"`, alt/aria-label newlines, data-*) silently corrupted. | FIXED in-phase (**user-approved** deviation) — attribute-safe collapse preserves quoted values verbatim (`fix(33)`; multi-space/newline/single-quote regressions). SC2 golden unchanged. |
| R4 | high | `>` inside a quoted attribute split the tag early (`[^>]*`): ordinary tags corrupted, `<script data-x="a > b">` gave a FALSE error on valid input. | FIXED — ReDoS-safe quote-aware `ATTRS` fragment in `HTML_SEGMENT` + `TAG` (`fix(33)`; ordinary + script `>`-in-attr regressions). |
| R4 | medium | D-07 error offset used `m[0].indexOf(">")` — after the quote-aware change that finds the inner quoted `>`, mis-mapping a broken-script error's line:col. | FIXED — `bodyStart` derived from captured start-tag length (`fix(33)`; malformed-script `>`+newline line-2 regression). |
| R5 | high | Minify strips all non-conditional comments → framework hydration markers (React `<!--$-->`) removed. | **User-dispositioned: ACCEPT.** Pre-existing Phase-32 behavior, standard minifier semantics (html-minifier-terser et al. strip by default), outside this phase's diff. Known caveat: minifying SSR output for re-hydration is unsupported. |

## Deviation from the "engines byte-for-byte unchanged" constraint
Plan 33-02's SUMMARY claimed `minify.ts` frozen. R3/R4 required editing it. This was
**explicitly approved by the user** (fix the attribute-corruption class in-phase, not
a full HTML-tokenizer re-engineer). The SC2 golden is UNCHANGED (the fixture exercises
no multi-space/quoted-`>` attributes), so the freeze's intent — no silent behavior
drift for the golden — holds; only genuinely-broken edge cases changed.

## Stopping rule
Adversarial review on a best-effort regex HTML minifier surfaces unbounded HTML spec
edge cases. The line drawn: fix every finding the phase diff *introduced* (R1/R2 guard,
R4 error-mapping) + the specific corruption class the user approved (R3/R4 tokenizer);
route pre-existing *design-policy* questions (R5 comment stripping) to the owner. All
substantive wrong-output-on-common-input bugs are fixed + regression-tested.

## Rebuild required before the 33-04 human gate
R1–R4 committed source AFTER the 33-04 executor built both channel `.app`s, so those
bundles are STALE. Both channels MUST be rebuilt (last step, all source landed) and
their binary mtime verified newer than the last source commit before any walkthrough.
