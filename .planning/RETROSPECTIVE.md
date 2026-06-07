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

## Milestone: v1.3 — More Tools

**Shipped:** 2026-06-04
**Phases:** 4 (12–15) | **Plans:** 11

### What Was Built
Three new tools + a Protobuf input mode, eight tools → eleven: Protobuf decimal input (PRO-08/09), URL tool (URL-01..05), Regex tester (RGX-01..07, ReDoS-safe off-thread Web Worker + watchdog), Cron tool (CRON-01..11, hand-rolled DST-correct bounded next-run + leap-aware `L`/`nL`/`L-n`). All over native browser APIs — zero new runtime AND zero new devDependencies for the whole milestone.

### What Worked
- **Risk-ordered phases** — research established the four features as fully independent, so they were sequenced smallest/safest first (Protobuf decimal de-risks the untouched-decoder promise) and the two deep tools (Regex ReDoS, Cron next-run) last, concentrating verification budget where novelty lived.
- **Pure-core-then-thin-view per tool** — every tool TDD'd a total, error-as-value `src/lib/<tool>/` core to GREEN before a thin registry-appended view, so the hard logic was locked by unit tests and the view stayed layout-agnostic.
- **Isolating the highest-risk slice** — Cron's `L`/`nL`/`L-n` (CRON-10) was planned as an explicitly isolated final plan with dedicated leap-year/month-length fixtures, so the rest of cron could ship even if it proved hard. It didn't block.

### What Was Inefficient
- **The real-WKWebView gate kept surfacing engine truths** — Regex's textbook ReDoS patterns *don't* time out on WebKit/JSC (it caps backtracking), so the catastrophic-pattern e2e wasn't achievable and RGX-06 had to be proven at the unit layer instead; URL/cron e2e row reads went stale under the embedded WebDriver and needed single-`browser.execute` round-trips. All caught only on the real engine.
- **The standalone TDD "RED" wave is structurally impossible here** — lefthook rejects failing-test commits, so the planned RED-only plans (13/14) had to merge into their GREEN impl. Now a known pattern; stop planning standalone RED waves.

### Patterns Established
- **Shared component extraction at first reuse** — `SegmentedControl` was lifted out of FormatterView's idiom in Phase 13 and reused by 14/15, rather than copy-pasted.
- **Auto-build at the human-verify checkpoint** — per user request, the agent now runs `pnpm tauri build` itself when a phase hits the phase-boundary checkpoint (wired into CLAUDE.md + harness docs), so the human only launches/tests/approves.

### Key Lessons
- **The hardest logic deserves an isolated plan with its own fixtures** — the Cron L/nL slice shipped cleanly precisely because it was quarantined with canonical leap-year edge cases instead of smeared across the engine.
- **DST correctness = read wall-clock components back, never step milliseconds** — Cron's odometer uses `Intl.formatToParts` read-back + a bounded day cap, which is both correct and terminating-by-construction.

### Cost Observations
- Model mix: GSD `quality` profile — primarily Opus for planning/execution/review.
- Notable: all four features cleared the wedge with native APIs; the entire automatable surface was green (650/650 vitest at close) before each phase's human sign-off, so manual gates were walkthrough-only.

---

## Milestone: v1.4 — Reorderable Tools

**Shipped:** 2026-06-05
**Phases:** 1 (16) | **Plans:** 2

### What Was Built
The app's first personalization feature: a user-reorderable sidebar tool list (REORD-01..07). A persisted `toolOrder: string[]` overlay applied over `ENABLED_TOOLS` at render time (registry stays the single control plane; ⌘K palette + router order-agnostic), with two pure tested helpers — `reconcileToolOrder` (always a registry permutation: append-new, drop-unknown, de-dupe) and `moveToolInOrder` (clamped relocate). The UI: handle-initiated native HTML5 drag (no dnd library) with a neutral insertion line + end-of-list drop zone, Alt+↑/↓ keyboard reorder with focus retention (no roving nav), `aria-live="polite"` "Moved {tool} to position N of M" announcements, and a keyboard-reachable reset. Zero new runtime AND dev deps; decoder + 19 tests untouched.

### What Worked
- **Pure-backbone-then-thin-view split (again)** — Plan 16-01 landed the entire persistence + reconciliation contract as pure, fully-unit-tested helpers (40/40) with NO UI, so Plan 16-02's Sidebar was thin wiring over a locked, permutation-invariant core. The hard correctness (untrusted-blob safety, new/removed-tool reconciliation) was proven before any pixels.
- **Treating ordering as a presentation overlay, not a registry mutation** kept the blast radius tiny — the ⌘K palette, router, and registry array were literally never touched, so nothing downstream of the registry could regress.
- **The keyboard path + `aria-live` were designed in from the start, not bolted on** — WCAG-AA was treated as a build requirement (Alt+arrow, focus retention, announcements, keyboard-reachable reset), so the gsd-ui-review findings were refinements (boundary announce, end-of-list drop zone) rather than missing capabilities.

### What Was Inefficient
- **The real-WKWebView gate missed the pointer-drag bug entirely** — WebDriver can't synthesize a native OS drag, so the e2e only ever exercised the keyboard reorder path. The mouse drag (drag image shown but rows never moved) shipped and was caught only in post-ship manual use: Tauri v2's `dragDropEnabled` defaults to `true`, so the OS file-drop handler was swallowing the webview's HTML5 `dragover`/`drop`. Fixed by `dragDropEnabled:false` (`1c2c7664`). The gate gave false confidence on the one interaction it structurally can't drive.
- **The WebKit-driver Alt-modifier key-chord gap** forced the keyboard e2e to dispatch a bubbling `KeyboardEvent` rather than use the driver's native key path — a second instance of "the embedded WebDriver can't fully drive real input," consistent with v1.3's stale-row-read workarounds.
- **A WCAG 1.4.11 contrast miss on the neutral drop indicator** (`bd-2` → `tx-2`) — "neutral" was specced without pinning the 3:1 non-text contrast target, so the first insertion-line token failed the audit.

### Patterns Established
- **Personalization = a persisted overlay over the canonical model, never a mutation of it** — `toolOrder` sits beside `recentToolIds` in the same prefs blob and is reconciled to a registry permutation on every read. A reusable shape for any future user-ordering/pinning feature.
- **Dedicated untrusted-merge coercer per field when semantics differ** — `coerceToolOrder` is separate from `normalizeRecents` precisely because `toolOrder` has no length cap; sharing would have obscured the difference.
- **Native-input interactions need a manual gate line item** — drag/drop (and other native-OS input the WebDriver can't synthesize) must be explicitly walked by a human, since a green e2e says nothing about them.

### Key Lessons
1. **A green real-WKWebView e2e is not coverage of native-OS input** — drag-and-drop, OS key chords, and file drops ride on the manual walkthrough. Make those an explicit checklist item at the human-verify checkpoint; don't let a passing keyboard-path e2e imply the pointer path works.
2. **Tauri webview defaults can silently intercept in-page behavior** — `dragDropEnabled:true` swallowing HTML5 DnD is a config footgun; when an in-page interaction works in a browser but not the packaged app, suspect the native window layer before the React code.
3. **Pin measurable targets for "subtle/neutral" UI** — "neutral, non-accent" still has to clear 3:1 (WCAG 1.4.11); specify the contrast number, not just the intent.

### Cost Observations
- Model mix: GSD `quality` profile — primarily Opus for planning/execution/review.
- Notable: a tightly-scoped single-phase milestone; the automatable surface was green (668/668 vitest) before sign-off, so the only material post-gate work was the one native-drag config fix surfaced by real-world use.

---

## Milestone: v1.5 — Pinned Tools

**Shipped:** 2026-06-07
**Phases:** 1 (17) | **Plans:** 2

### What Was Built
A distinct "Pinned" sidebar section (PIN-01..09) extending v1.4's personalization. A persisted `pinnedToolIds: string[]` overlay through the existing prefs seam, with a pure `partitionTools` that always returns a full registry partition (pinned group + unpinned remainder; drop unknown, de-dupe, reuse `reconcileToolOrder`). The UI: a left-of-grip pin toggle (persistent filled on pinned, outline on hover/focus for unpinned), **Alt+P** to pin/unpin the focused row (`aria-live`-announced), independent per-group drag + Alt+↑/↓ reorder (never across the divider), and a keyboard-reachable "Unpin all" in the Shift+F10 reset menu. Zero new runtime AND dev deps; decoder + 19 tests untouched.

### What Worked
- **The pure-backbone-then-thin-view split, a third time** — Plan 17-01 landed the entire persistence + partition contract as pure, fully-unit-tested helpers (immovable-bar matrix) with no UI, so Plan 17-02's two-group Sidebar was thin wiring over a locked, partition-invariant core. Directly reused v1.4's `reconcileToolOrder`/`moveToolInOrder` per group.
- **Overlay-not-mutation kept the blast radius tiny again** — `partitionTools` over `ENABLED_TOOLS`; the registry array, ⌘K palette, and router were never touched, so nothing downstream could regress.
- **The human walkthrough earned its keep** — every substantive bug this milestone (Alt+P dead on macOS, the keyboard-nav friction) was found by a person using the real app, not by any automated gate.

### What Was Inefficient
- **The e2e gave a *false positive* on Alt+P** — it synthesized `KeyboardEvent({key:'p', altKey:true})`, which the handler matched, so the test was green while the real app was broken: on macOS, Option+P composes to the character "π", so `e.key` is never "p". This is sharper than v1.4's "the WebDriver can't drive native input" — here the test *looked* like it covered the interaction but encoded the wrong key value. Fixed by matching the physical `e.code === "KeyP"` and rewriting the spec to dispatch the real `key:'π'/code:'KeyP'` shape.
- **The keyboard model was built twice** — the planned decision (D-05, "no roving nav") was first implemented as a single-Tab-stop roving model, then reversed to a Tab-friendly model (every row + the pin Tab-reachable) one round later when the user clarified they wanted Tab *and* arrows. Confirming the interaction model with the user *before* building — especially when reversing a locked decision — would have saved a full implement+verify+rebuild cycle.
- **Three post-sign-off rebuild cycles** — target-size polish, then Alt+P, then the Tab model each triggered a fresh `tauri build` + e2e gate. Cheap individually, but a tighter up-front interaction spec would have collapsed them.

### Patterns Established
- **Synthetic key events must mirror the real platform** — assert on `e.code` (physical key) for letter chords, and dispatch e2e key events with the platform-composed `key` (macOS Option+letter → a composed glyph) so the test reproduces reality instead of an idealized keycode.
- **Two-group partition reuses the single-group reconciler per group** — `partitionTools` runs the v1.4 `reconcileToolOrder` over the unpinned remainder; pinned order *is* `pinnedToolIds`. Membership and order stay independent overlays, no second order array.
- **When a walkthrough reopens a locked interaction decision, re-confirm scope before coding** — `AskUserQuestion` on the model fork (roving vs Tab) is far cheaper than building, gating, and reverting.

### Key Lessons
1. **A green e2e can still be a false positive if it encodes the wrong real-world input** — macOS Option+letter composes (Option+P → "π"), so `e.key`-based shortcut handling silently dies on the real app while a `key:'p'` test passes. Key off the physical `e.code`, and make platform key composition explicit in the e2e.
2. **Confirm interaction-model changes with the user before implementing** — reversing a locked a11y decision (no-roving-nav) mid-walkthrough cost an extra build because the desired model wasn't pinned down first.
3. **The human walkthrough is the real acceptance test for interaction feel** — automatable gates were 694/694 green and still missed both real bugs; budget for a hands-on pass and fast rebuild loop at the phase boundary.

### Cost Observations
- Model mix: GSD `quality` profile — primarily Opus for planning/execution/review.
- Notable: another tightly-scoped single-phase milestone; the automatable surface was green before sign-off, but the human walkthrough drove three small gap-closure rounds (target size, Alt+P, Tab model) — the material work was post-gate, surfaced only by real use.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 Distribution | 6 (1–6) | 28 | Established the full build+verify harness (review → unit → ui + phase sign-off) on a walking skeleton before any feature |
| v1.1 Formatters | 2 (7–8) | 4 | Shared-foundation-first wave; cleanup phase deliberately sequenced after its real callers landed |
| v1.2 Release Tooling | 3 (9–11) | 8 | Pure decision core + thin `.mjs` shell per script; dry-run-first; a live human-gate (real publish + updater round-trip) as the load-bearing acceptance |
| v1.3 More Tools | 4 (12–15) | 11 | Risk-ordered independent features; pure-core-then-thin-view per tool; highest-risk slice (Cron L/nL) isolated with its own fixtures; auto-build at the human-verify checkpoint |
| v1.4 Reorderable Tools | 1 (16) | 2 | First personalization feature; persisted overlay over the canonical registry (never a mutation); pure reconciliation backbone landed UI-free before the thin Sidebar wiring |
| v1.5 Pinned Tools | 1 (17) | 2 | Two-group partition overlay reusing v1.4's reconciler per group; all real bugs (macOS Alt+P dead-key, Tab/arrow nav) surfaced by the human walkthrough, driving three post-gate gap-closure rounds |

### Cumulative Quality

| Milestone | Tests (end) | Zero-Dep Additions | New Runtime Deps |
|-----------|-------------|--------------------|------------------|
| v1.0 Distribution | 269 vitest | — | `js-md5` (only one), `lucide-react`, `@tauri-apps/plugin-store` |
| v1.1 Formatters | 378 vitest / 44 files | JSON + XML formatters (native APIs) | **0** |
| v1.2 Release Tooling | 503 vitest / 49 files | release core + drivers (Node builtins + `tsx`/Tauri CLI/`gh`/`rustup` — all devDeps) | **0** |
| v1.3 More Tools | 650 vitest | URL + Regex + Cron tools + Protobuf decimal (native `URL`/`RegExp`/`Intl` + a Web Worker) | **0** |
| v1.4 Reorderable Tools | 668 vitest | reorderable sidebar — `toolOrder` overlay + pure reconciliation helpers (native HTML5 drag + Alt+arrow, no dnd library) | **0** |
| v1.5 Pinned Tools | 694 vitest | pinned sidebar section — `pinnedToolIds` overlay + pure `partitionTools`/`resolveRovingTarget` helpers (Alt+P, arrow focus-nav, per-group reorder) | **0** |

Constant across all six: the hero decoder (`src/lib/protobuf/decoder.ts`) + its **19 tests** stayed byte-for-byte untouched.

### Top Lessons (Verified Across Milestones)

1. **The real run catches what unit tests can't** — v1.0 (production-only startup bugs, secure-context crypto), v1.1 (`<parsererror>` newline concat), and v1.2 (false exit-1 + 8000% progress, both in the untested `.mjs` shell, surfaced only by the live publish/download) all surfaced regressions only on the real engine/real execution. Never treat Chromium/jsdom — or a green unit suite over a thin I/O shell — as the desktop truth.
2. **Code review reliably finds real bugs each milestone** — keep it as a hard per-task gate, not a formality. (v1.2: 0 critical, but the live human-gate found the two that mattered.)
3. **Zero-runtime-dependency is sustainable** — three milestones in, the only runtime dep is still `js-md5`; native browser APIs + Node builtins + dev-only CLIs covered formatting *and* the entire release pipeline.
4. **Push logic out of I/O shells into pure tested cores** — v1.2's two live bugs both lived in the deliberately-uncovered driver shell; the thinner the shell, the fewer places a bug can hide where tests don't look.
5. **The real-WKWebView e2e cannot drive native-OS input** — v1.4's pointer drag-and-drop (and the Alt key-chord) couldn't be synthesized by the WebDriver, so the drag shipped broken (Tauri `dragDropEnabled` interception) and surfaced only in manual use. Native drag/drop, OS key chords, and file drops are *manual-walkthrough* coverage — make them an explicit human-verify checklist item; a green e2e on the keyboard path says nothing about them.
6. **A synthetic key event can be a false positive** — v1.5's Alt+P shortcut tested green while dead on the real app: the e2e sent `key:'p'`, but macOS composes Option+P into "π", so production never saw `e.key==='p'`. Key letter chords off the physical `e.code`, and dispatch e2e key events with the platform-composed `key` so the test reproduces the real OS, not an idealized keycode. (Corollary: when a walkthrough reopens a locked interaction decision, re-confirm the model with the user before rebuilding.)
