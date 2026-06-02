# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Formatters

**Shipped:** 2026-06-02
**Phases:** 2 (7–8) | **Plans:** 4 | **Commits:** 49 (same-day)

### What Was Built
- A shared two-pane paste-instant `FormatterView` (promoted from the protobuf `ResizableSplit`) with a read-only copy-bearing output pane and a shared toolbar, reused by both formatters.
- A JSON formatter — pure zero-dep `formatJson` over native `JSON`: validate (engine-portable line:col), prettify 2/4/tab, minify-wins, recursive sort-keys (array order preserved).
- An XML formatter — pure zero-dep `formatXml` over native `DOMParser`/`XMLSerializer`: well-formedness validation (parsererror + line), prettify preserving comments/CDATA/attributes/PIs + the `<?xml?>` declaration, minify, XXE-safe.
- An opt-in `StatusBar` byte/size readout (UIX-01): optional prop gated on a type guard, kept on Base64/Hex/Bytes + Protobuf + both Formatters, dropped from Hash/UUID·ULID/Unix Time/JWT — locked by a present-where-kept / absent-where-dropped test matrix.

### What Worked
- **Wave-1 shared-foundation plan landed all cross-cutting surfaces first** (`ResizableSplit` promotion, additive `StatusBar` byte-delta, `FormatResult` contract), so the JSON and XML plans ran conflict-free on a stable base.
- **Sequencing Phase 8 after Phase 7** meant the `StatusBar` keep/drop decision was made against the complete, real set of callers rather than anticipated ones — the opt-in API was minimal and correct on the first pass (code review clean, 0 issues).
- **The real-WKWebView e2e gate earned its keep again** — it caught an XML `<parsererror>` regression that unit tests missed (real WebKit concatenates the error text with no newlines, breaking the line-based boilerplate stripper). jsdom did not reproduce it.
- **Pure-logic-in-`src/lib/format/`** kept the React layer thin and made TDD straightforward — formatters were green before any rendering.

### What Was Inefficient
- **XML prettify dropped the `<?xml?>` declaration + doc-level comments/PIs** initially (caught at code review, WR-01) — the serializer round-trip assumptions weren't fully spec'd up front; a more careful enumeration of "what must survive prettify" in the design would have caught it pre-implementation.
- **Two distinct error-offset bugs** (V8 first-match `indexOf` mislocation; timing chip measuring a state setter not the format pass) both stemmed from not pinning down the exact measurement/locating contract before coding.
- **The `<parsererror>` shape differs between jsdom and real WebKit** — unit tests were written against the jsdom shape and had to be corrected to the real captured shape after the live gate failed. Capturing the real engine's output shape earlier would have avoided the rework.

### Patterns Established
- **Shared presentational view + per-tool thin wrappers** — `FormatterView` consumed by `JsonFormatterTool` / `XmlFormatterTool` with conditional toolbar affordances (sort-keys only for JSON). A reusable template for future tool families.
- **Opt-in additive props over discriminated unions** — `byteCount?` + `typeof … === "number"` guard kept the `StatusBar` change minimal and backward-compatible.
- **Test against stable selectors, not text** — the present/absent byte-readout matrix queries the `aria-label="byte count"` span, immune to copy changes.
- **Schedule "cleanup that depends on real callers" after those callers land** — the Phase 8-depends-on-7 ordering generalized well.

### Key Lessons
1. When a transform must *preserve* structure (XML prettify), enumerate the preserved node types — declaration, comments, CDATA, PIs, attributes — explicitly in the spec; "prettify" alone under-specifies it.
2. Browser-API behavior (`DOMParser` error shape) varies by engine; capture the **real target engine's** output shape for unit fixtures, don't trust jsdom's.
3. Defer API-shape decisions (`StatusBar` opt-in) until the full set of consumers exists — it makes the minimal correct design obvious.

### Cost Observations
- Model mix: not separately instrumented this milestone (GSD `quality` profile — primarily Opus for planning/execution).
- Notable: a tightly-scoped milestone (2 phases, 4 plans, same-day) with the shared-foundation-first wave structure kept rework low; the only material churn was the two code-review fixes + the live-gate `<parsererror>` correction.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 Distribution | 6 (1–6) | 28 | Established the full build+verify harness (review → unit → ui + phase sign-off) on a walking skeleton before any feature |
| v1.1 Formatters | 2 (7–8) | 4 | Shared-foundation-first wave; cleanup phase deliberately sequenced after its real callers landed |

### Cumulative Quality

| Milestone | Tests (end) | Zero-Dep Additions | New Runtime Deps |
|-----------|-------------|--------------------|------------------|
| v1.0 Distribution | 269 vitest | — | `js-md5` (only one), `lucide-react`, `@tauri-apps/plugin-store` |
| v1.1 Formatters | 378 vitest / 44 files | JSON + XML formatters (native APIs) | **0** |

Constant across both: the hero decoder (`src/lib/protobuf/decoder.ts`) + its **19 tests** stayed byte-for-byte untouched.

### Top Lessons (Verified Across Milestones)

1. **The real-WKWebView gate catches what unit tests can't** — v1.0 (production-only startup bugs, secure-context crypto) and v1.1 (`<parsererror>` newline concat) both surfaced regressions only on the real engine. Never treat Chromium/jsdom as the desktop truth.
2. **Code review reliably finds real bugs each milestone** — keep it as a hard per-task gate, not a formality.
3. **Zero-runtime-dependency is sustainable** — two milestones in, the only runtime dep is `js-md5`; native browser APIs covered formatting entirely.
