# Phase 14: Regex tester - Context

**Gathered:** 2026-06-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A new **Regex tester** (the 11th tool; registry-driven like the rest) built on the exact
three-layer pattern Phase 13 (URL) established — pure logic in a new `src/lib/regex/` (TDD),
a thin React view in `src/tools/regex/`, one additive `TOOLS` append, the shared
`SegmentedControl` reused for flag toggles — with **zero new runtime AND zero new
devDependencies** (native `RegExp` / `matchAll` / `replace` / Web Worker only).

It does exactly seven things (RGX-01..07), no more:

1. **Match** — run a user pattern against sample text and show all matches highlighted
   live (RGX-01), with a per-match capture-group breakdown (numbered + named) (RGX-02).
2. **Flags** — toggle `g` / `i` / `m` / `s` / `u`, matching updates live (RGX-03).
3. **Replace preview** — live substitution preview supporting `$1` / `$<name>` / `$&`
   (RGX-04), via native `String.prototype.replace` (no token parser).
4. **Library** — insert from a small common-pattern library: email, URL, IPv4 (RGX-05).
5. **ReDoS-safe** — matching runs in a **Web Worker** with a **terminate-on-timeout
   watchdog**; a catastrophic pattern shows "pattern timed out" and never freezes the
   window (RGX-06).
6. **Safe rendering** — invalid regex → inline error-as-value, no throw; highlighting is
   built from **escaped React text nodes, never `dangerouslySetInnerHTML`** (RGX-07).

OUT OF SCOPE (deferred, do NOT build): multi-line/file-sized streaming + match pagination
(RGX-F1); saving/naming custom patterns into the library (RGX-F2).

</domain>

<decisions>
## Implementation Decisions

### Highlight technique (RGX-01, RGX-07)
- **D-01:** **Overlay-on-textarea** (chosen over the research's read-only-view default).
  An editable `<textarea>` is rendered with a transparent foreground (transparent/near-
  transparent text + caret visible) layered over a highlight backdrop `<div>` that renders
  the same text with matches wrapped in `<mark>`. You type directly and matches glow in
  place. This is the richer "type and see it" UX the user explicitly wants.
- **D-02:** **Alignment is the load-bearing risk** the planner must handle for D-01: the
  backdrop and the textarea MUST share identical font-family, font-size, line-height,
  letter-spacing, padding, border-width, and `white-space`/wrapping; the backdrop's scroll
  position is mirrored from the textarea's `scrollTop`/`scrollLeft` on every scroll/input.
  This is the standard "highlight-within-textarea" technique — implement it deliberately,
  test caret/scroll alignment on the real WKWebView, not just Chromium.
- **D-03:** **XSS safety is non-negotiable regardless of D-01.** The highlight backdrop is
  built by slicing the source string into alternating unmatched/matched segments and
  rendering each as a **React text child** (`<span>{seg}</span>` / `<mark>{seg}</mark>`).
  No HTML string is ever constructed; no `dangerouslySetInnerHTML` anywhere in
  `src/tools/regex/` (add the same absence-grep the URL tool used). RGX-07 holds.

### Match / Replace layout (RGX-01..04)
- **D-04:** **One combined scrolling view, no mode switch.** Top: pattern field + flag
  toggles + the sample-text overlay editor. Below: the live match summary + per-match
  capture-group breakdown AND the live replace preview, all visible at once. (A
  `[Match][Replace]` mode switch was rejected — unlike Phase 13's URL tool, regex match and
  replace operate on the *same* inputs, so splitting them hides related state and costs a
  click. Fits paste-instant.)
- **D-05:** **Replace is just one more field**, not a mode: a `Replace:` input plus a
  read-only `Preview:` output (with a copy button). Empty replace field = no preview shown
  (neutral), consistent with the empty-state discipline below.

### Flags & capture-group display (RGX-02, RGX-03)
- **D-06:** **Five independent toggle buttons** `g i m s u` in a row, `aria-pressed`,
  keyboard operable, reusing the `SegmentedControl` styling (D-16 shared control from Phase
  13). Not a single multi-select.
- **D-07:** **`g` is visible and user-toggleable**, but it ONLY controls the **replace
  preview's all-vs-first** behavior. **Match enumeration is always `g`-forced internally**
  (`matchAll` throws without `g`), so the highlight/match list always shows ALL matches
  regardless of the `g` toggle. The view passes the user's true flags to the replace step
  and a `g`-forced flag string to the enumeration step (compile fresh `RegExp` per run in
  the worker — never cache across messages; see RESEARCH Pitfall 3).
- **D-08:** **Capture groups: per-match list, groups indented.** Each match shows its full
  matched text + start index; indented beneath it the numbered groups (`$1`, `$2`, …) and
  any named groups (`name → value`), each value with its own copy button (no hover-only
  copy). An unmatched optional group renders a muted `—`. (Table-grid layout rejected —
  ragged across matches with differing group counts, awkward for named groups.)

### Common-pattern library (RGX-05)
- **D-09:** **Exactly three patterns — Email, URL, IPv4** — as a **frozen const** array of
  `{ label, source, flags }`. No more, no fewer (RGX-F2 persistence stays deferred).
- **D-10:** **Inline clickable chips** above the pattern field (a row of chips), not a
  dropdown. Clicking a chip is the insert affordance.
- **D-11:** **Insert overwrites the pattern (and flags) directly, no confirm**, even when
  the pattern field is non-empty — the tool is instant and disposable; the field stays
  editable afterward. (Confirm-on-non-empty rejected as friction.)
- **D-12:** **Library patterns MUST be simple/linear** (no nested quantifiers) so the
  library itself can never trip the watchdog. Use the RESEARCH §COMMON_PATTERNS shapes as
  the starting point.

### Empty / error states (RGX-06, RGX-07)
- **D-13:** **Empty pattern or empty sample text = neutral empty state, not an error**,
  consistent with Base64/Protobuf/URL. No matches, no preview, no error chrome.
- **D-14:** **Invalid regex = inline error-as-value** (`role="alert"`), the rest of the
  view intact, never a throw. Compile inside the worker (`new RegExp` in try/catch →
  `{error}`); a catastrophic *compile* is then also off-thread.
- **D-15:** **Timeout = clear "pattern timed out" state**, UI stays responsive (RGX-06).
  On timeout the watchdog **hard-terminates** the wedged worker and respawns; stale replies
  are dropped by request-id gating.

### Claude's Discretion (locked to RESEARCH recommendations — planner may tune, no re-ask)
- **Worker timeout: start 1000ms**, tune against the real WKWebView so paste-instant (<2s)
  stays honest without false-tripping legit large inputs (RESEARCH Open Decision 3).
- **Small debounce (~50–100ms) before posting to the worker is allowed** and encouraged
  for large text — this is distinct from the locked "no debounce *instead of* a worker";
  request-id gating already guarantees correctness (RESEARCH Open Decision 2).
- **Eager respawn** on timeout (warm next run) (RESEARCH Open Decision 7).
- **Message protocol** per RESEARCH Pattern 2 (`{id, source, flags, text, replace?}` →
  `{id, matches[], replaced?, error?}`).
- **Vite worker bundling** via `new Worker(new URL('./worker.ts', import.meta.url),
  {type:'module'})` — same-origin chunk, passes `script-src 'self'`, NO CSP change. Add
  `base: './'` to `vite.config.ts` ONLY if the worker chunk 404s in the packaged build
  (RESEARCH A1 — e2e-gated, not blocking; plan a verification step, not a guess).
- **Copy affordances** via `useCopyFeedback` + `platform.clipboard` (mirror UrlTool
  `CopyButton`). **StatusBar/byteCount: omit** (regex isn't a byte transform; Phase 8 opt-in).
- **Registry metadata:** `id: "regex"`, `icon: Regex` (lucide glyph VERIFIED present),
  `category` + `name` + `keywords` mechanical per the Base64/URL entry shape.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope, research & requirements
- `.planning/phases/14-regex-tester/14-RESEARCH.md` — **PRIMARY ref.** HIGH-confidence
  research: native API facts (matchAll/replace/RegExp/groups), the Web-Worker + terminate
  watchdog design, Vite worker bundling + CSP model, the safe-highlight pattern, all
  pitfalls (g-flag/lastIndex, zero-length loop, blob-CSP, packaged-build base path), code
  examples, and the validation/security architecture. Read this first.
- `.planning/ROADMAP.md` § "Phase 14: Regex tester" — goal + the six success criteria +
  risk-order rationale (highest UI novelty + structural ReDoS risk → concentrated
  UI-verification budget).
- `.planning/REQUIREMENTS.md` — **RGX-01** (highlighted matches, paste-instant),
  **RGX-02** (numbered + named capture groups), **RGX-03** (toggle g/i/m/s/u live),
  **RGX-04** (replace preview `$1`/`$<name>`/`$&`), **RGX-05** (email/URL/IPv4 library),
  **RGX-06** (Web Worker + timeout watchdog, "pattern timed out", responsive),
  **RGX-07** (invalid regex inline error, escaped highlighting, never
  `dangerouslySetInnerHTML`). Deferred: RGX-F1, RGX-F2.

### Sibling pattern to mirror (Phase 13 — the just-shipped analog)
- `.planning/phases/13-url-tool/13-CONTEXT.md` — the three-layer registry pattern,
  error-as-value discipline, `useMemo` paste-instant, no-hover-only-copy, the extracted
  shared `Toggle`/`SegmentedControl` (D-16), and the `dangerouslySetInnerHTML` absence-grep
  precedent (URL T-13-04) this phase reuses.
- `src/lib/url.ts` + `src/tools/url/UrlTool.tsx` + `src/components/SegmentedControl.tsx` —
  the concrete sibling code: pure-logic-in-`src/lib` + thin view + shared segmented control.

### Binding project constraints
- `CLAUDE.md` — Critical constraints: **zero new runtime deps** (and this phase adds zero
  devDeps too), no network at runtime, registry-as-single-control-plane, HashRouter only,
  tools import `src/lib/platform/` not `@tauri-apps/*`, layout-agnostic components, **no
  hover-only copy**, and the build+verify harness (simplify → /codex:review → vitest+tsc →
  real-WKWebView UI verification; phase boundary = human sign-off on `tauri build` +
  `gsd-ui-review` WCAG-AA).
- `.planning/PROJECT.md` § Current Milestone (v1.3) — wedge gates: paste-instant (<2s),
  keyboard-driven, WCAG-AA; `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte
  untouched (this phase doesn't touch the decoder).
- `src-tauri/tauri.conf.json` — CSP `script-src 'self'` (no `worker-src`); **do NOT weaken**
  to allow blob workers (the Vite same-origin chunk needs no change). `vite.config.ts` —
  currently no `base` (the A1 packaged-build risk; add `base:'./'` only if the e2e gate
  shows the worker 404s).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (the exact seams to touch / reuse)
- **`src/components/SegmentedControl.tsx`** — reuse for the five flag toggle buttons
  (D-06); accented active + `aria-pressed` + keyboard operable, already WCAG-AA.
- **`src/tools/url/UrlTool.tsx` + `src/lib/url.ts`** — closest just-shipped analog for the
  three-layer split (pure error-as-value core + thin view), the `CopyButton`/`useCopyFeedback`
  copy idiom (D-08 per-group copies), and `useMemo` paste-instant derivation.
- **`src/components/CopyButton.tsx` + `src/shell/useCopyFeedback` + `platform.clipboard`** —
  per-group and replace-preview copy affordances (no hover-only).
- **`src/lib/tools/` registry + `ToolDefinition` type** — one additive `TOOLS` append
  (`icon: Regex`); sidebar/search/router auto-derive.
- **Error-as-value `Result` shape** — mirror `src/lib/url.ts` discriminated unions; here a
  `{ matches… } | { error } | { empty } | { timedOut }` so the view needs no try/catch.

### Established Patterns (follow, don't reinvent)
- Pure logic in `src/lib/regex/` (TDD, no worker/DOM), a dumb `worker.ts` transport that
  imports it, and the watchdog (terminate/respawn/id-gating) in the React view (only it
  knows wall-clock time + owns the `Worker`). See RESEARCH §Recommended Structure.
- `dangerouslySetInnerHTML` absence-grep invariant (from URL T-13-04) — add for
  `src/tools/regex/`.
- Real-WKWebView e2e gate (`scripts/e2e-spike.sh`) MUST include a catastrophic-pattern spec
  (e.g. `(a+)+$` vs `"aaaa…!"`) asserting "timed out" + responsive — this simultaneously
  proves the worker chunk loaded in the packaged app (the A1 backstop).

### Greenfield (no existing primitive)
- **No highlight-overlay primitive exists** — the transparent-textarea-over-backdrop
  (D-01/D-02) is built from scratch; this is the phase's main UI novelty and where the
  verification budget concentrates.
- **No Web Worker exists yet in the codebase** — `src/lib/regex/worker.ts` is the first;
  Vite `import.meta.url` bundling is new ground (A1 packaged-build risk, e2e-gated).

</code_context>

<specifics>
## Specific Ideas

- The teaching moment of this tool is **safety under hostile input**: the regex itself is
  the threat (ReDoS), and the match text is an XSS vector. Both are handled structurally —
  worker `terminate()` for ReDoS (the ONLY real kill for a synchronous catastrophic match),
  escaped React nodes for XSS — not by validation heuristics.
- Good verification anchors: (1) `(\w+)\s(\w+)` on "hello world foo bar" → 2 matches, each
  with `$1`/`$2` groups; a replace `$2 $1` previews "world hello bar foo". (2) A named-group
  pattern `(?<year>\d{4})-(?<month>\d{2})` shows `year`/`month` in the breakdown and
  `$<year>` works in replace. (3) The catastrophic `(a+)+$` against a long `"aaaa…!"` shows
  "pattern timed out" and the window stays responsive. (4) An invalid pattern like `(` shows
  an inline error, no crash.

</specifics>

<deferred>
## Deferred Ideas

- **RGX-F1** — multi-line/file-sized input streaming + match pagination. Out of scope.
- **RGX-F2** — save/name custom patterns into the library (persisted). Out of scope; the
  library stays a frozen 3-entry const (D-09).
- **Read-only-highlighted-view technique** (the research's recommended default for D-01) —
  considered and **decided against** in favor of the overlay-on-textarea UX. If overlay
  alignment proves too costly on the WKWebView during execution, this is the documented
  fallback (same XSS-safe segment rendering, simpler layout).
- **Blob-worker fallback** — only if the Vite chunk 404s AND can't be fixed by `base:'./'`;
  requires a `worker-src 'self' blob:` CSP change + sign-off. Avoid.

Otherwise: None — discussion stayed within phase scope.

</deferred>

---

*Phase: 14-regex-tester*
*Context gathered: 2026-06-03*
