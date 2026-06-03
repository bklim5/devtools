---
phase: 14-regex-tester
plan: 03
subsystem: regex-tool-view
tags: [regex, web-worker, watchdog, redos, xss-safe, overlay-highlight, registry, tdd]
requires:
  - "src/lib/regex/regex.ts (14-02 — COMMON_PATTERNS + RegexRequest/RegexMatch/RegexResult types)"
  - "src/lib/regex/worker.ts (14-02 — the off-thread transport spawned by this view)"
  - "src/components/CopyButton + src/shell/useCopyFeedback + platform.clipboard (copy seam)"
provides:
  - "src/tools/regex/RegexTool.tsx — the Regex tester view: terminate-on-timeout worker watchdog, overlay-on-textarea escaped highlight, per-match capture-group breakdown, live replace preview, 5 flag toggles, 3-chip library"
  - "src/tools/regex/index.ts — ToolDefinition (id regex, icon Regex)"
  - "TOOLS append in src/lib/tools/registry.ts — the 11th tool, #/tools/regex auto-derived"
affects:
  - "The registry-derived sidebar/palette/router now surface #/tools/regex"
tech-stack:
  added: []
  patterns:
    - "Web Worker spawned via new Worker(new URL('../../lib/regex/worker.ts', import.meta.url), {type:'module'}) — same-origin Vite chunk, CSP-clean, RELATIVE literal not the @/ alias"
    - "Terminate-on-timeout watchdog (arm timer BEFORE worker construction) + eager/lazy respawn + request-id gating to drop stale replies"
    - "Overlay-on-textarea: transparent-text textarea over an escaped-React-node backdrop sharing identical font metrics, scroll-synced (XSS-safe; no raw inner HTML)"
    - "Empty state derived from inputs (not setState-in-effect); worker result held in state"
key-files:
  created:
    - "src/tools/regex/RegexTool.tsx"
    - "src/tools/regex/index.ts"
    - "src/tools/regex/RegexTool.test.tsx (originally 14-01; committed GREEN here per the merge decision)"
    - "test/e2e/regex.e2e.ts (originally 14-01; committed GREEN here per the merge decision)"
  modified:
    - "src/lib/tools/registry.ts (one import + one TOOLS append)"
decisions:
  - "RegexTool.test.tsx + regex.e2e.ts (originally Plan 14-01's standalone RED files) were committed GREEN here, alongside the code that satisfies them, per the user's pre-approved Rule-4 merge (the binding lefthook tsc+vitest pre-commit hook rejects RED-only commits)"
  - "JavaScriptCore (WKWebView) DEFUSES textbook ReDoS — the catastrophic-pattern e2e from the plan cannot be driven on this engine; the watchdog timeout is proven at the unit layer instead, and the e2e asserts the deterministic worker round-trip"
  - "dangerouslySetInnerHTML absence-grep implemented via Vite import.meta.glob ?raw (not node:fs readdirSync) because the repo ships no @types/node and src/ is typechecked under the browser tsconfig"
metrics:
  duration: "~24 min (autonomous) + ~1 review-closure round (4 commits, e2e re-proven)"
  completed: "2026-06-03 (autonomous tasks + human-review round-1 gap closure; Task 3 re-verify pending)"
  tasks: "2 of 3 autonomous done; human-review round-1 (4 issues) CLOSED; Task 3 (human-verify) PENDING re-review"
  files: 5
  commits: 8
---

# Phase 14 Plan 03: Regex Tester View + Registry + e2e Summary

The 11th tool shipped end-to-end on the real WKWebView: a Regex tester whose matching runs OFF-THREAD in a Web Worker behind a terminate-on-timeout watchdog (ReDoS-safe by construction), with an overlay-on-textarea live-highlight built from escaped React nodes (XSS-safe by construction), a per-match numbered+named capture-group breakdown, a live `$1`/`$<name>`/`$&` replace preview, five `g/i/m/s/u` flag toggles, and a 3-chip Email/URL/IPv4 library — registered with one additive TOOLS append. **Autonomous tasks complete; the phase-boundary human-verify (Task 3) is the one remaining gate.**

## What Was Built

- **`src/tools/regex/RegexTool.tsx`** — the combined single-scroll view (D-04): chips → pattern + flags → sample-text overlay editor → matches + groups → replace + preview.
  - **Worker watchdog (the bespoke piece, RGX-06):** spawns `new Worker(new URL("../../lib/regex/worker.ts", import.meta.url), {type:"module"})` (the relative literal Vite needs to bundle the same-origin chunk — NOT the `@/` alias). On each run it **arms the 1000ms watchdog timer BEFORE constructing/posting to the worker** (so even a worker-construction failure — e.g. the chunk 404ing under `tauri.localhost`, A1 — still surfaces the timeout state), id-gates replies (drops stale), and on timeout `terminate()`s the wedged worker (the ONLY kill for a sync catastrophic regex) + respawns. An ~80ms debounce precedes posting (id-gating keeps correctness).
  - **Overlay-on-textarea highlight (RGX-01/07, D-01/02/03):** a transparent-text `<textarea id="regex-text">` over an `aria-hidden` backdrop `<div>` that renders the text sliced into matched/unmatched segments as React children (`<span>`/`<mark>`) — never an HTML string, never the raw-inner-HTML escape hatch. Both layers pin identical `font-mono text-[13px] leading-[1.5] p-3 whitespace-pre-wrap break-words`; the backdrop mirrors the textarea's scroll on `onScroll`.
  - **Capture-group breakdown (RGX-02, D-08):** per match, full text + start index, with numbered `$N` (NEUTRAL, not accent) and named groups indented beneath, each value copyable; unmatched optional group → muted `—`.
  - **Replace preview (RGX-04, D-05):** hidden when the replace field is empty; otherwise a read-only mono output of `result.replaced` with a copy button.
  - **Flags (RGX-03, D-06/07):** 5 independent `aria-pressed` toggles in a `role=group aria-label="Regex flags"`; active = accent (the only accent on toggles).
  - **Library (RGX-05, D-09/10/11):** 3 neutral chips Email/URL/IPv4 in `role=group aria-label="Insert a common pattern"`; click overwrites pattern + flags, no confirm.
  - Empty/invalid/timeout states per D-13/14/15; copy via `platform.clipboard` only.
- **`src/tools/regex/index.ts`** — `ToolDefinition { id: "regex", name: "Regex", category: "inspectors", icon: Regex }`. StatusBar/byteCount omitted (not a byte transform).
- **`src/lib/tools/registry.ts`** — one import + one TOOLS append; the registry derives `#/tools/regex` for sidebar/palette/router.
- **`src/tools/regex/RegexTool.test.tsx`** (5 cases) — chip-overwrite, escaped render, the raw-inner-HTML absence-grep (via `import.meta.glob` `?raw`), and a fake-timer **watchdog-timeout** unit test (never-replying stub worker → "Pattern timed out" renders + `terminate()` called).
- **`test/e2e/regex.e2e.ts`** — real-WKWebView gate: `\w+`→`Matches (2)` worker round-trip (the A1 chunk-loaded backstop), named-group copy button, responsiveness across rapid pattern swaps; screenshots `regex-wkwebview.png`.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | RegexTool view + RegexTool.test.tsx (GREEN) | `653c5d98` | src/tools/regex/RegexTool.tsx, src/tools/regex/RegexTool.test.tsx |
| 2 | Registry wiring (index.ts + TOOLS append) | `55b4b5b6` | src/tools/regex/index.ts, src/lib/tools/registry.ts |
| 1b | e2e spec | `30cc0781` | test/e2e/regex.e2e.ts |
| 1c | watchdog hardening + deterministic e2e + watchdog unit test | `63f4c7cd` | src/tools/regex/RegexTool.tsx, src/tools/regex/RegexTool.test.tsx, test/e2e/regex.e2e.ts |

All four commits passed the binding lefthook pre-commit hook (tsc --noEmit + full vitest + eslint). **NO `--no-verify` used.**

## Verification

- `pnpm vitest run src/tools/regex` → **5/5 GREEN** (chips, chip-overwrite, escaped render, absence-grep, watchdog timeout).
- Full suite: **578/578 vitest**, `pnpm tsc --noEmit` clean, `pnpm eslint` clean.
- **Real-WKWebView gate `bash scripts/e2e-spike.sh` → exit 0, 12/12 spec files pass** (the new regex spec + all 11 existing, no regression).
- `pnpm tauri build` → produced a runnable `devtools-app.app` + `devtools-app_0.2.2_aarch64.dmg`. (The build's FINAL step exits non-zero only because `TAURI_SIGNING_PRIVATE_KEY` is absent — that is the release-publish updater-signing step, not an app-build failure; the runnable `.app` exists for the walkthrough.)
- `git diff --quiet src/lib/protobuf/decoder.ts` → **decoder + its 19 tests byte-for-byte untouched**.
- RegexTool.tsx invariants: worker-URL relative literal present, `terminate()` + id-gate present, `dangerouslySetInnerHTML` absent (count 0), `@tauri-apps` not imported, StatusBar/byteCount absent.

## Deviations from Plan

### 1. [Merge decision — pre-approved Rule 4] RegexTool.test.tsx + regex.e2e.ts committed GREEN here
- **Context:** The standalone 14-01 RED wave was merged into 02/03 because the lefthook hook rejects failing-test commits. Plan 14-02 shipped the lib spec; this plan authored **both** remaining 14-01 specs fresh (component + e2e) and committed them GREEN with the code that satisfies them.

### 2. [Rule 3 — blocking typecheck] Absence-grep via import.meta.glob, not node:fs
- **Found during:** Task 1 (tsc gate).
- **Issue:** The 14-01-prescribed `readdirSync`/`readFileSync`/`__dirname` absence-grep does not compile — the repo ships no `@types/node` and `src/` is typechecked under the browser tsconfig (no node lib). Adding `@types/node` would violate zero-new-devDeps.
- **Fix:** Implemented the identical XSS invariant via Vite `import.meta.glob("./*.{ts,tsx}", { query:"?raw", eager:true })` over the tool directory — a real runtime assertion, zero new deps. Reworded two RegexTool.tsx comments + the test header so the literal `dangerouslySetInnerHTML` / `@tauri-apps` tokens don't trip the literal greps (the known repo comment-flake gotcha).

### 3. [Rule 1 — bug, surfaced by the e2e gate] JavaScriptCore defuses textbook ReDoS; watchdog ordering hardened
- **Found during:** Task 3 (real-WKWebView e2e).
- **Issue:** The plan's catastrophic-pattern e2e (`(a+)+$` → "timed out") **never timed out on WebKit/JSC**. Measured live on this WKWebView: `(a+)+$`/40 returns instantly; `(a*)*$` caps at ~0.88s; `([a-zA-Z]+)*$` is flat ~0.46s for n=40/60/100; `((a*)*)*$` flat ~0.83s — **JSC's regex engine caps backtracking at a fixed budget and bails**, so NO textbook ReDoS pattern exceeds the 1s watchdog (they blow up only on V8/node, where `(a+)+$`/28 took 15s). The catastrophic-timeout e2e is therefore **not achievable on this engine.**
- **Fix (two parts):**
  - **Production:** arm the watchdog `setTimeout` BEFORE constructing/posting to the worker, and wrap worker create/post in try/catch — so a worker-construction failure (A1 chunk-404) still surfaces the timeout instead of hanging. (A real robustness bug the gate exposed.)
  - **Verification:** prove RGX-06/D-15 at the **unit layer** (fake-timer test: never-replying worker → "Pattern timed out" renders + `terminate()` called), and rewrite the e2e to assert what IS deterministic on JSC — the off-thread worker round-trip (`\w+`→`Matches (2)`, the A1 chunk-loaded backstop), capture-group copy, and responsiveness across rapid pattern swaps.
- **Files:** src/tools/regex/RegexTool.tsx, src/tools/regex/RegexTool.test.tsx, test/e2e/regex.e2e.ts. **Commit:** `63f4c7cd`.
- **Surfaced to the human at the Task-3 checkpoint** as a decision point (accept the unit-tested watchdog + worker-round-trip e2e, vs. a test-only timeout-injection hook).

## Authentication Gates

None.

## Known Stubs

None. All data is wired (matches/groups/replace/timeout all render from real worker results or the watchdog).

## Gap closure (human review round 1)

The human reviewed the built app at `#/tools/regex` and REJECTED it with 4 concrete UI/UX
issues. All four are now fixed, each committed GREEN through the binding lefthook hook
(tsc + full vitest + eslint; NO `--no-verify`), and re-proven on the real WKWebView
(`bash scripts/e2e-spike.sh` → **exit 0, 12/12 spec files pass**). A fresh phase-boundary
human-verify is requested below.

| # | Issue (as reported) | Fix | Commit(s) |
|---|---------------------|-----|-----------|
| 1 | **CRITICAL** — highlight overlay desyncs from the textarea when scrolling (the load-bearing D-02 caret/scroll alignment, broken under scroll) | Backdrop + textarea now share a single `EDITOR_BOX` constant (identical font, size, line-height, **letter-spacing** (`tracking-normal`), padding, border, box-sizing, `whitespace-pre-wrap break-words` wrapping) and are both `absolute inset-0` in a `min-h-[220px]` relative container → identical geometry. Scroll-sync now **translates** the backdrop's inner content by the negative `scrollTop`/`scrollLeft` on the textarea's `scroll` event (an `overflow-hidden` box clamps a non-zero `scrollTop` to 0 — that was the actual desync bug the e2e gate exposed) and re-applies after every backdrop re-render. `resize` is OFF so a user-resized textarea can't desync the inset-0 backdrop. **New unit test** (both-axes translate on `scroll`) + **new e2e assertion** (60-line input, scroll, backdrop content tracks the textarea scrollTop on the real WKWebView). | `67e2f278`, `831d6de6`, `b0f307fe`, `6ec44dc0` |
| 2 | Email/URL/IPv4 chips were at the top of the tool; unclear what they are | Moved the chips to **directly under the Pattern input** with a muted **"Common patterns"** caption + per-chip `title` tooltip. Group keeps its stable accessible name "Insert a common pattern". | `67e2f278` |
| 3 | Sample Text textarea too small (it's the primary input) | Editor container min-height **140px → 220px**. | `67e2f278` |
| 4 | Replace field confusing; replaced output unlabeled | Replace input now has an `aria-describedby` helper caption — **"Replacement applied to each match. Use $1, $&lt;name&gt; and $&"** — and the output is a clearly **LABELED, visible "Result" pane** (renamed from "Preview", with a "The sample text with every match replaced." sub-caption), making the **Pattern → Matches → Replace → Result** flow obvious. | `67e2f278` |

**Round-1 verification:**
- `pnpm vitest run src/tools/regex` → **8/8 GREEN** (the original 5 + scroll-sync handler, chip placement, labeled Result).
- Full suite **581/581**, `pnpm tsc --noEmit` clean, `pnpm eslint` clean.
- **Real-WKWebView gate `bash scripts/e2e-spike.sh` → exit 0, 12/12 spec files pass** (the regex spec now includes the scroll-alignment assertion).
- `git diff --quiet src/lib/protobuf/decoder.ts` → **decoder + its 19 tests still byte-for-byte untouched**; `dangerouslySetInnerHTML` count 0, `@tauri-apps` not imported, worker-URL relative literal + `terminate()` + id-gate all preserved (no regression to the watchdog hardening).
- **Two e2e iterations were needed** and are recorded honestly in history: (a) the overflow-hidden `scrollTop`-clamp bug the gate caught (→ translate technique, `831d6de6`), and (b) a bare `[aria-hidden]` e2e selector matching a non-regex shell node (→ scoped off `#regex-text`, `6ec44dc0`).

## Open Checkpoint (Task 3 — blocking, autonomous: false)

The autonomous gates are GREEN (vitest 578/578, tsc, eslint, real-WKWebView e2e 12/12 exit 0, `tauri build` runnable). The remaining gate is the **phase-boundary human-verify**: the built-app walkthrough (steps 1–8 of the plan) + a `gsd-ui-review` WCAG-AA PASS on the Regex tool. This was NOT performed by the executor. See the checkpoint message for the walkthrough steps and the JSC-ReDoS decision point. On "approved": check off 14-01/02/03 + the Phase-14 box in ROADMAP.md, flip RGX-01..07 to validated in REQUIREMENTS.md, and transition.

## Self-Check

- FOUND: src/tools/regex/RegexTool.tsx
- FOUND: src/tools/regex/index.ts
- FOUND: src/tools/regex/RegexTool.test.tsx
- FOUND: test/e2e/regex.e2e.ts
- FOUND: src/lib/tools/registry.ts (regexTool appended)
- FOUND commit: 653c5d98
- FOUND commit: 55b4b5b6
- FOUND commit: 30cc0781
- FOUND commit: 63f4c7cd

## Self-Check: PASSED
