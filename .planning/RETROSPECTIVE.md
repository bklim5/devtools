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

## Milestone: v1.2 — Release Tooling

**Shipped:** 2026-06-03
**Phases:** 3 (9–11) | **Plans:** 8 | **Commits:** 56

### What Was Built
- A unit-tested **pure release core** in `src/lib/release/`: `version.ts` (`bumpSemver` + three surgical `setXVersion` manifest editors), `manifest.ts` (dual-key `buildLatestJson`), `bumpPlan.ts` and `publishPlan.ts` (every decision/assertion/URL/string for the two drivers).
- **`pnpm release:bump`** (`scripts/bump-and-tag.mjs`) — lockstep 3-manifest semver bump + lockfile regen + annotated `vX.Y.Z` tag + push to private origin, `--dry-run` + fail-fast preflights.
- **`pnpm release:publish`** (`scripts/build-and-publish.mjs`) — universal (Intel + Apple Silicon) `tauri build` → `lipo` both-arch assert → fresh-`.sig` single-match glob → dual-key `latest.json` → cross-repo `gh` publish (assets-first/manifest-last) → post-publish `curl` served-version verify.
- A live, signature-verified release: **v0.2.2** published to `bklim5/devtools-releases` and an older install auto-updated through the mandatory minisign verify (DST-02) on real hardware.

### What Worked
- **The pure-core / thin-`.mjs`-shell split paid off precisely as designed** — all decision logic was TDD'd (33 + 47 cases), and *both* bugs found in the live run were in the deliberately-untested I/O shell, never in the covered core. The split told us exactly where to trust the tests and where not to.
- **Dry-run-with-zero-side-effects, short-circuited BEFORE the slow/irreversible `tauri build`**, let the full preflight chain be proven against the real live `gh`/repo state without risk.
- **The live human-gate (real publish + updater round-trip) is irreplaceable** — it caught both shell bugs and proved minisign-verify-then-relaunch end-to-end, which unit tests structurally cannot.
- **Mirroring Phase 10's `bumpPlan` ↔ `bump-and-tag.mjs` structure into Phase 11** made the second driver fast and low-risk to author.

### What Was Inefficient
- **Both live-run bugs lived in the thin `.mjs` shell** (the part with no unit coverage by design): `main()` was made sync but the call site still `.catch()`'d it (false exit-1 after a *successful* publish), and the updater seam forwarded raw per-chunk `chunkLength` bytes as a percent (the "8000%" display). The fix in both cases was to push the logic into the pure tested core (or a `try/catch`) — i.e. the shell should have been even thinner from the start.
- **The 8000% progress bug was pre-existing (Phase 6 updater UI)** and only surfaced under a *real* download — yet another "only the real run reveals it" case that a smoke-level integration test of the driver could have caught earlier.

### Patterns Established
- **Pure decision core + thin `.mjs` I/O shell**, applied to both release scripts — decisions/strings/asserts are zero-I/O and unit-tested; the driver only does fs/subprocess/network.
- **Dry-run short-circuit before the irreversible step; all preflights before any write** — cheap insurance against a broken release auto-installing onto every user.
- **Standing release-security pattern:** secrets inherited via `{ env: process.env }` only, boolean-only env presence checks, `execFileSync` argv arrays (no shell strings), single public-repo constant — verified threat-secure 16/16.
- **Extract even small UI math into a pure tested reducer** (`downloadProgress.ts`) rather than computing inline in the `@tauri-apps` seam.

### Key Lessons
1. **The thin I/O shell is exactly where bugs hide** — its logic is uncovered by design. Either keep it truly logic-free (push every computation into the pure core) or give it a smoke test. Both v1.2 live bugs lived there.
2. **A live human-gate is mandatory for irreversible / integration-bound flows** (publish + auto-update). No amount of unit coverage substitutes for the real minisign-verify-then-relaunch round-trip.
3. **Dry-run-zero-side-effects + assets-before-manifest ordering** are the two cheapest guards against the milestone's worst case — keep them as non-negotiable structure in any publish pipeline.

### Cost Observations
- Model mix: GSD `quality` profile — primarily Opus for planning/execution/review.
- Notable: the entire automatable surface was green (vitest 503/503) *before* the live run; the only real work in the live session was catching and TDD-fixing the two shell bugs, then the audit/security/archive close-out.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 Distribution | 6 (1–6) | 28 | Established the full build+verify harness (review → unit → ui + phase sign-off) on a walking skeleton before any feature |
| v1.1 Formatters | 2 (7–8) | 4 | Shared-foundation-first wave; cleanup phase deliberately sequenced after its real callers landed |
| v1.2 Release Tooling | 3 (9–11) | 8 | Pure decision core + thin `.mjs` shell per script; dry-run-first; a live human-gate (real publish + updater round-trip) as the load-bearing acceptance |

### Cumulative Quality

| Milestone | Tests (end) | Zero-Dep Additions | New Runtime Deps |
|-----------|-------------|--------------------|------------------|
| v1.0 Distribution | 269 vitest | — | `js-md5` (only one), `lucide-react`, `@tauri-apps/plugin-store` |
| v1.1 Formatters | 378 vitest / 44 files | JSON + XML formatters (native APIs) | **0** |
| v1.2 Release Tooling | 503 vitest / 49 files | release core + drivers (Node builtins + `tsx`/Tauri CLI/`gh`/`rustup` — all devDeps) | **0** |

Constant across all three: the hero decoder (`src/lib/protobuf/decoder.ts`) + its **19 tests** stayed byte-for-byte untouched.

### Top Lessons (Verified Across Milestones)

1. **The real run catches what unit tests can't** — v1.0 (production-only startup bugs, secure-context crypto), v1.1 (`<parsererror>` newline concat), and v1.2 (false exit-1 + 8000% progress, both in the untested `.mjs` shell, surfaced only by the live publish/download) all surfaced regressions only on the real engine/real execution. Never treat Chromium/jsdom — or a green unit suite over a thin I/O shell — as the desktop truth.
2. **Code review reliably finds real bugs each milestone** — keep it as a hard per-task gate, not a formality. (v1.2: 0 critical, but the live human-gate found the two that mattered.)
3. **Zero-runtime-dependency is sustainable** — three milestones in, the only runtime dep is still `js-md5`; native browser APIs + Node builtins + dev-only CLIs covered formatting *and* the entire release pipeline.
4. **Push logic out of I/O shells into pure tested cores** — v1.2's two live bugs both lived in the deliberately-uncovered driver shell; the thinner the shell, the fewer places a bug can hide where tests don't look.
