# Phase 14: Regex tester — Research

**Researched:** 2026-06-03
**Domain:** Native `RegExp` + Web Worker (off-main-thread untrusted-regex execution) + safe React highlight rendering, under Vite 7 / Tauri 2 WKWebView, offline
**Confidence:** HIGH (native API facts verified vs MDN; Vite/CSP worker model verified; one MEDIUM risk flagged: worker base-path under `tauri build`, mitigable + e2e-gated)

## Summary

This phase adds the 11th tool (Regex tester) following the exact three-layer registry pattern Phase 13 (URL) established: pure logic in a new `src/lib/regex/`, a thin React view in `src/tools/regex/`, one additive `TOOLS` append, the shared `SegmentedControl` reused for flag/mode toggles. **Zero new runtime AND zero new devDependencies** — everything is native `RegExp` / `String.prototype.matchAll` / native Web Worker. The `Regex` lucide glyph is **verified present** in the installed `lucide-react@1.17.0` ([VERIFIED: `node_modules/lucide-react/dist/esm/icons/regex.mjs` exists]).

The structural novelty is the locked **Web Worker + timeout watchdog** (NOT debounce) for ReDoS safety. The non-obvious, load-bearing facts: (1) a synchronous catastrophic-backtracking `RegExp` **cannot be cooperatively interrupted** — `worker.terminate()` + respawn is the *only* real kill [VERIFIED]; (2) Vite 7's `new Worker(new URL('./x.ts', import.meta.url), {type:'module'})` idiom compiles to a **separate same-origin chunk** (not a blob), so it passes the project's existing `script-src 'self'` CSP with **no CSP change needed** [VERIFIED] — but a *blob* fallback would be **blocked** by that CSP; (3) `matchAll` natively handles the zero-length-match infinite-loop trap that hand-rolled `exec()` loops fall into [VERIFIED: MDN]; (4) native `replace` already supports `$1`/`$<name>`/`$&`/`$$`/`` $` ``/`$'` — no token parser to hand-roll [VERIFIED: MDN].

**Primary recommendation:** Pure core in `src/lib/regex/` returns an error-as-value `RegexResult` (mirror `src/lib/url.ts`); a dedicated `src/lib/regex/worker.ts` runs `matchAll` + `replace` and posts results back; the React tool owns a **terminate-on-timeout + respawn watchdog** keyed by a request id, and renders matches as a **read-only highlighted overlay built from escaped React text nodes** (segment the source string into matched/unmatched spans — never `dangerouslySetInnerHTML`). Verify the worker chunk loads in the packaged `tauri build` (real-WKWebView e2e gate), and add `base: './'` to `vite.config.ts` if the worker URL 404s under `tauri.localhost`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RGX-01 | Test regex vs sample text, highlighted matches, paste-instant | `matchAll` in worker → match index/length list → escaped React-node overlay (Architecture: Highlight Overlay; Code Examples §matchAll, §overlay) |
| RGX-02 | Per-match capture-group breakdown, numbered AND named | each `matchAll` item carries `[1..n]` + `.groups` + `.index` [VERIFIED: MDN] (Code Examples §matchAll) |
| RGX-03 | Toggle flags g/i/m/s/u, live update | flags string assembled from `SegmentedControl`-style toggles, passed in the worker message; `g` force-handled (see Pitfalls §g-flag) |
| RGX-04 | Live replace preview `$1`/`$<name>`/`$&` | native `String.prototype.replace` supports all three + `$$`/`` $` ``/`$'` natively [VERIFIED: MDN] — Don't Hand-Roll |
| RGX-05 | Insert from common-pattern library (email, URL, IPv4) | a tiny frozen `PATTERNS` const array of `{label, source, flags}`; insert = set pattern state (Open Decisions §library-shape) |
| RGX-06 | Catastrophic pattern can't freeze window; Web Worker + timeout watchdog; "pattern timed out" | terminate-and-respawn watchdog (Architecture: Worker Lifecycle; Code Examples §watchdog) — `terminate()` is the ONLY kill [VERIFIED] |
| RGX-07 | Invalid regex → clear inline error no throw; highlighting escaped (never `dangerouslySetInnerHTML`) | `new RegExp` in try/catch → `{error}` error-as-value; overlay = React text children (Pitfalls §xss; mirrors URL tool T-13-04) |
</phase_requirements>

## User Constraints (from project docs — no CONTEXT.md yet; Phase 14 not discussed)

> Phase 14 has NOT been through `/gsd-discuss-phase`. These are the binding constraints inherited from PROJECT.md / STATE.md / REQUIREMENTS.md. The gray areas a discuss/plan step must resolve are in **## Open Decisions** below.

### Locked Decisions (do NOT relitigate)
- **Matching runs in a Web Worker + timeout watchdog, NOT a debounce** (STATE.md, roadmap lock). Research scope is the HOW.
- **`matchAll` over `.exec()` loops; React-node highlighting (escaped text, never `dangerouslySetInnerHTML`)** (STATE.md).
- **Zero new runtime AND zero new devDependencies** over native Web/JS APIs (REQUIREMENTS.md cross-cutting; PROJECT.md Constraints).
- Three-layer pattern: pure logic in new `src/lib/regex/` (TDD); thin React tool in `src/tools/regex/`; one additive `TOOLS` append (STATE.md architecture notes).
- Tools import `src/lib/platform/`, never `@tauri-apps/*` directly (CLAUDE.md).
- HashRouter only; offline/no-network at runtime; paste-instant (<2s); WCAG-AA; registry-driven single control plane; layout-agnostic (responsive Tailwind, no fixed widths).
- `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched (not in scope, never refactor).

### Claude's Discretion
- Highlight technique (overlay-over-textarea vs read-only highlighted view) — **recommended below**, but open for discuss.
- Whether to debounce *before* posting to the worker (a perf nicety, distinct from the locked "no debounce instead of worker").
- Worker timeout duration; common-library pattern set size; message-protocol shape.

### Deferred Ideas (OUT OF SCOPE)
- RGX-F1: multi-line/file-sized streaming + match pagination.
- RGX-F2: save/name custom patterns into the library (persisted).

## Standard Stack

This phase ships **no packages**. The "stack" is native APIs + project primitives.

### Core (native browser/JS APIs)
| API / idiom | Purpose | Why standard |
|---|---|---|
| `new RegExp(source, flags)` in try/catch | Compile user pattern; invalid → `{error}` (RGX-07) | Native; only way to build a regex from a runtime string [VERIFIED: MDN] |
| `String.prototype.matchAll(re)` | All matches + numbered + named groups + `.index` (RGX-01/02) | Native; **handles zero-length-match advance internally**, clones the regex so `lastIndex` is never mutated [VERIFIED: MDN] |
| `String.prototype.replace(re, repl)` | Replace preview with `$1`/`$<name>`/`$&` (RGX-04) | Native; supports `$$ $& $\` $' $n $<name>` with NO custom parser [VERIFIED: MDN] |
| Web Worker (module, `import.meta.url`) | Run untrusted regex off the main thread (RGX-06) | Native; Vite emits it as a same-origin chunk [VERIFIED] |
| `worker.terminate()` | The ONLY way to kill a synchronous catastrophic match (RGX-06) | Native; sync regex cannot be cooperatively interrupted [VERIFIED] |

### Supporting (existing project primitives — reuse, don't rebuild)
| Primitive | Path | Use |
|---|---|---|
| `SegmentedControl` | `src/components/SegmentedControl.tsx` | Flag toggles g/i/m/s/u and/or a Match\|Replace mode switch (D-16 shared control) |
| `platform.clipboard` | `src/lib/platform` | Copy match/replace output (visible focusable button, no hover-only) |
| `useCopyFeedback` | `src/shell/useCopyFeedback` | Copy-button feedback (mirror UrlTool `CopyButton`) |
| error-as-value `Result` shape | mirror `src/lib/url.ts` `StrResult`/`ParseResult` | Discriminated `{matches…}` \| `{error}` \| `{empty}` \| `{timedOut}` so the view needs no try/catch |
| `ToolDefinition` + `TOOLS` append | `src/lib/tools/types`, registry | One additive entry, `icon: Regex` (verified glyph), `#/tools/regex` auto-derives |

### Alternatives Considered
| Instead of | Could use | Tradeoff / verdict |
|---|---|---|
| Web Worker + terminate watchdog | Debounce + run on main thread | **REJECTED (locked):** debounce delays but cannot prevent a single catastrophic pattern freezing the single window. |
| Web Worker chunk via `import.meta.url` | Inline **blob:** worker | **REJECTED as default:** the project CSP `script-src 'self'` (no `worker-src`) would **block** a `blob:` worker [VERIFIED] — see Pitfalls §csp. Blob is the *fallback only if* the chunk approach fails the `tauri build` gate, and then ONLY with a `worker-src 'self' blob:` CSP addition. |
| `matchAll` | manual `while ((m = re.exec(text)))` loop | **REJECTED:** exec loop has the zero-length infinite-loop trap and mutates `lastIndex` [VERIFIED: MDN]. |
| Read-only highlighted view | overlay aligned over the live `<textarea>` | Recommended: read-only view (simpler, no scroll/caret/font-metric sync). Overlay-over-textarea is the harder alternative — see Open Decisions §highlight. |

**Installation:** none. (`pnpm` install unchanged; verify nothing was added: `git diff package.json` empty.)

**Version verification:** [VERIFIED: package.json] vite `^7.0.4`, react `^19.1.0`, typescript `~5.8.3`, lucide-react `1.17.0`, vitest `4.1.7`. No registry lookups needed — phase adds nothing.

## Architecture Patterns

### Recommended Structure (mirrors Phase 13)
```
src/lib/regex/
├── regex.ts          # pure core: buildRegex(source,flags)->Result, run(text,re)->matches,
│                     # applyReplace(text,re,repl)->string; the COMMON_PATTERNS const; types.
│                     # Synchronous + pure → fully TDD'd (no worker, no DOM).
├── regex.test.ts     # TDD: invalid pattern, named+numbered groups, zero-length, flags, replace tokens
└── worker.ts         # thin Web Worker: onmessage -> call regex.ts -> postMessage({id, result}).
                      # No app logic; just the off-thread shell. (The ONE place workers live.)
src/tools/regex/
├── RegexTool.tsx     # thin view: owns worker lifecycle + watchdog, renders overlay/groups/replace
├── RegexTool.test.tsx
└── index.ts          # ToolDefinition { id:"regex", icon: Regex, ... } — one TOOLS append
```
**Key split:** ALL regex logic is pure and lives in `regex.ts` (unit-tested with zero worker/DOM). `worker.ts` is a dumb transport that imports `regex.ts` and runs it off-thread. The watchdog (terminate/respawn) lives in the React view because only it knows wall-clock time and owns the `Worker` instance. This keeps the testable surface in `regex.ts` and isolates the untestable (in vitest/node) worker plumbing to a thin shell + the real-WKWebView e2e gate.

### Pattern 1: Worker lifecycle + terminate-on-timeout watchdog (RGX-06)
**What:** One long-lived module worker. Each keystroke posts `{id, source, flags, text, replace}`. A `setTimeout(TIMEOUT)` watchdog races the worker's reply. If the reply wins, clear the timer, render. If the timer wins, **`worker.terminate()`** the (now-wedged) worker, immediately spawn a fresh one for the next request, and render a "pattern timed out" state.
**When to use:** every match run (RGX-01/06).
**Why terminate (not a flag/abort):** a synchronous `matchAll`/`replace` inside the worker holds the worker's event loop — it will **never read** an abort message or check a flag mid-match. `terminate()` is the only thing that stops it [VERIFIED]. `AbortController` does NOT help here.
**Respawn:** `terminate()` is one-way; you must `new Worker(...)` again. Keep a `workerRef`; on timeout, terminate + null it + lazily recreate on the next run (or eagerly recreate so the next keystroke is warm).
**Request id:** stamp each post with an incrementing id; ignore replies whose id ≠ the latest (stale results from a worker that finished after a newer keystroke). This also makes the watchdog correct under rapid typing.

### Pattern 2: Message protocol
```
main → worker:  { id: number, source: string, flags: string, text: string, replace?: string }
worker → main:  { id: number,
                  matches: { index, length, groups: (string|undefined)[], named: Record<string,string> }[],
                  replaced?: string,
                  error?: string }     // invalid-regex error surfaced as a value, NOT a throw
```
Compile the `RegExp` **inside the worker** (in `regex.ts`) so a catastrophic *compile* is also off-thread, and so the invalid-pattern error (RGX-07) is computed where the regex is used. The view only ever sees data.

### Pattern 3: Safe highlight overlay = escaped React text nodes (RGX-01/07)
**What:** Never build an HTML string. Take the source text + the match index/length list, slice the string into alternating `unmatched`/`matched` segments, and render each as a React child (`<span>{segment}</span>`). React escapes text children by default → XSS-safe by construction; this is the URL tool's T-13-04 discipline applied to highlighting.
**Recommended container:** a **read-only highlighted `<div>`** (the matches view) rendered beside/under the input `<textarea>`, NOT an overlay positioned on top of the textarea. Rationale: an overlay must pixel-match the textarea's font metrics, padding, line-height, wrapping, and scroll position — fragile and a WCAG/focus hazard. A separate read-only view sidesteps all of it and fits the existing two-pane idiom. (Overlay-over-textarea remains a discuss option — see Open Decisions.)

### Anti-Patterns to Avoid
- **`dangerouslySetInnerHTML` for highlights** — forbidden by RGX-07; an injection surface. Use React text children.
- **Running the regex on the main thread "just for the simple case"** — defeats RGX-06; even one catastrophic pattern freezes the window. ALL matching goes through the worker.
- **Cooperative cancellation (abort flag / `AbortController`) for the running match** — cannot interrupt a sync regex [VERIFIED]; only `terminate()` works.
- **Manual `exec()` loop** — zero-length-match infinite loop + `lastIndex` mutation [VERIFIED: MDN]. Use `matchAll`.
- **Hand-rolling `$1`/`$<name>` expansion** — native `replace` already does it [VERIFIED: MDN].

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Replace-token expansion (`$1`,`$<name>`,`$&`,`$$`,`` $` ``,`$'`) | a `$`-token parser | native `String.prototype.replace(re, repl)` | All six supported natively when the pattern is a `RegExp` [VERIFIED: MDN]. Non-existent group → literal; matched-but-empty group → `""` [VERIFIED: MDN]. |
| Enumerate all matches + groups | `while(re.exec())` loop with manual `lastIndex` bumping | `String.prototype.matchAll(re)` | Clones the regex (no `lastIndex` mutation), advances past zero-length matches internally, yields `.index`/`.groups`/numbered groups [VERIFIED: MDN]. |
| Named-group extraction | parse `(?<name>...)` yourself | `match.groups` on each `matchAll` item | Native; `undefined` for unmatched optional named groups [VERIFIED: MDN]. |
| Escaping matched text into the DOM | sanitizer / `dangerouslySetInnerHTML` + escaping | React text children (`{segment}`) | React escapes by default; zero injection surface (RGX-07; mirrors URL T-13-04). |
| Killing a runaway regex | abort flag / cooperative checks / `AbortController` | `worker.terminate()` + respawn | A synchronous regex cannot be interrupted any other way [VERIFIED]. |
| Bundling the worker offline | a custom build step / inline blob string | `new Worker(new URL('./worker.ts', import.meta.url), {type:'module'})` | Vite 7 emits a hashed same-origin chunk in the prod build; loads offline, passes `script-src 'self'` [VERIFIED]. |

**Key insight:** In this phase almost nothing is hand-rolled — the native `RegExp`/`matchAll`/`replace` surface already covers RGX-02/04, and Vite owns worker bundling. The ONLY genuinely bespoke pieces are: (1) the watchdog state machine (terminate/respawn/id-gating) in the view, and (2) the string→segments slicing for the safe overlay. Everything else is "call the platform correctly."

## Common Pitfalls

### Pitfall 1: Blob-worker fallback is silently blocked by the project CSP
**What goes wrong:** If the `import.meta.url` chunk approach is abandoned for an inline `new Worker(URL.createObjectURL(new Blob([...])))`, the worker is **refused** in the packaged app.
**Why:** `src-tauri/tauri.conf.json` CSP is `... script-src 'self'; ...` with **no `worker-src`** [VERIFIED: tauri.conf.json]. Per spec, `worker-src` falls back to `script-src`, and `script-src 'self'` does **not** allow `blob:` [VERIFIED: MDN/CSP]. Safari/WKWebView behavior on `worker-src` is also incomplete.
**How to avoid:** Use the Vite `import.meta.url` chunk (same-origin `'self'`) — **no CSP change needed**. Only if forced to blobs, add `worker-src 'self' blob:` to the CSP (a security-surface change requiring sign-off).
**Warning sign:** console "Refused to create a worker from 'blob:…' because it violates the Content Security Policy."

### Pitfall 2: Worker chunk 404s under `tauri build` (`tauri.localhost`) though it works in `tauri dev`
**What goes wrong:** The worker loads in `vite dev`/Chromium but the packaged WKWebView app can't fetch the worker chunk. [MEDIUM confidence — this is the one real risk; Tauri v2 has documented prod base-path asset-rewrite quirks.]
**Why:** `vite.config.ts` sets **no `base`** (defaults to `/`) [VERIFIED: vite.config.ts]. Tauri serves the static bundle from `tauri.localhost`; absolute `/`-rooted worker URLs can mis-resolve in some prod setups (documented Tauri v2 issue class).
**How to avoid:** Verify on the REAL packaged build, not just dev (the phase DoD already mandates the `scripts/e2e-spike.sh` WKWebView gate + a `tauri build` human walkthrough). If the worker 404s, set `base: './'` in `vite.config.ts` (the standard Tauri+Vite relative-path fix). Add an e2e assertion that a catastrophic pattern surfaces "timed out" (proves the worker actually ran AND was killable in the packaged app).
**Warning sign:** worker silently never replies in the built app while dev works.

### Pitfall 3: `g`-flag / `lastIndex` statefulness
**What goes wrong:** Reusing one `RegExp` object across `matchAll` and `replace`, or across runs, leaks `lastIndex` state and skips matches.
**Why:** stateful `g`-flag regexes carry `lastIndex`.
**How to avoid:** `matchAll` clones internally (safe), but **`matchAll` THROWS `TypeError` if the regex lacks the `g` flag** [VERIFIED: MDN]. So for the match list, compile a *g-forced* regex (add `g` if the user didn't set it) for enumeration, and use the user's actual flags for the replace preview. Compile fresh `RegExp` objects per run inside the worker — never cache a regex across messages.
**Warning sign:** `matchAll` throws, or second run returns fewer/no matches.

### Pitfall 4: Zero-length-match infinite loop
**What goes wrong:** A pattern like `/^/gm` or `/(?=x)/g` matches empty strings; a naive loop never advances → hang (ironically a self-inflicted freeze the worker would then have to be terminated for).
**Why:** empty match doesn't move the cursor.
**How to avoid:** Use `matchAll`, which advances `lastIndex` by one code point past a zero-length match internally [VERIFIED: MDN]. Do NOT write an `exec()` loop. (The watchdog is the backstop, but correctness should not rely on it for this known case.)
**Warning sign:** the worker times out on trivially-fast patterns.

### Pitfall 5: `dangerouslySetInnerHTML` temptation for highlighting
**What goes wrong:** Wrapping matches in `<mark>` via an HTML string injects user text into the DOM → XSS (RGX-07 violation).
**How to avoid:** Slice into segments, render React text children. The phase has an explicit grep-able invariant (the URL tool added a "`dangerouslySetInnerHTML` absence-grep"); add the same here.
**Warning sign:** any `dangerouslySetInnerHTML` in `src/tools/regex/`.

### Pitfall 6: lucide glyph name drift
**What goes wrong:** `import { Regex } from 'lucide-react'` fails at build if the glyph were renamed.
**Status:** [VERIFIED] `regex.mjs` exists in `lucide-react@1.17.0` — `Regex` is a valid named export. (`Search`, `Asterisk`, `Hash`, `Braces`, `Code` also present if an alternative is wanted.) No risk; documented because STATE.md flagged it MEDIUM.

### Pitfall 7: Worker not actually killable (false sense of safety)
**What goes wrong:** A timeout fires but the watchdog only sets state / posts an abort message — the wedged worker keeps burning a core; a later result may arrive and overwrite the UI.
**How to avoid:** On timeout, call `worker.terminate()` (hard kill) AND drop any later message via id-gating. Respawn for the next request. Add an e2e test with a known catastrophic pattern (e.g. `(a+)+$` against `"aaaa…!"`) asserting the UI shows "timed out" and stays responsive.

## Code Examples

### Worker shell (`src/lib/regex/worker.ts`)
```typescript
// Thin off-main-thread transport. All real logic is in regex.ts (pure, TDD'd).
// Vite bundles this as a same-origin module chunk (passes script-src 'self').
import { runRegex, type RegexRequest } from "./regex";

self.onmessage = (e: MessageEvent<RegexRequest>) => {
  // runRegex is pure + total: compiles in try/catch, returns {matches|error},
  // uses matchAll (g-forced) for enumeration and replace() for the preview.
  const result = runRegex(e.data); // never throws
  (self as unknown as Worker).postMessage({ id: e.data.id, ...result });
};
```

### Pure core enumeration with named + numbered groups (`src/lib/regex/regex.ts`)
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll  [VERIFIED]
export function buildRegex(source: string, flags: string):
  | { re: RegExp } | { error: string } {
  try {
    // matchAll REQUIRES g (throws TypeError otherwise). Force it for enumeration.
    const enumFlags = flags.includes("g") ? flags : flags + "g";
    return { re: new RegExp(source, enumFlags) };
  } catch (err) {
    return { error: (err as Error).message }; // RGX-07: error-as-value, no throw
  }
}

export function enumerate(text: string, re: RegExp) {
  return [...text.matchAll(re)].map((m) => ({
    index: m.index ?? 0,
    length: m[0].length,
    full: m[0],
    groups: m.slice(1),                 // numbered groups (RGX-02)
    named: m.groups ? { ...m.groups } : {}, // named groups (RGX-02)
  }));
  // matchAll clones the regex (lastIndex untouched) and advances past
  // zero-length matches internally — no manual loop, no infinite-loop trap.
}
```

### Native replace preview ($1 / $<name> / $&) — nothing hand-rolled
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace  [VERIFIED]
// repl may contain $$  $&  $`  $'  $n  $<name> — all expanded natively by replace()
// when the pattern is a RegExp. Use the USER's flags here (g => all, no g => first).
export function applyReplace(text: string, re: RegExp, repl: string): string {
  return text.replace(re, repl);
}
```

### Watchdog (terminate-on-timeout + respawn + id-gating) in the view
```typescript
// In RegexTool.tsx. The ONLY way to stop a synchronous catastrophic regex is
// worker.terminate(); terminate() is one-way, so respawn for the next run. [VERIFIED]
const TIMEOUT_MS = 1000; // Open Decision §timeout — start 1s, tune on the WKWebView gate

function makeWorker() {
  return new Worker(new URL("@/lib/regex/worker.ts", import.meta.url), { type: "module" });
}

// inside the tool: keep workerRef, latest request id, and a timer ref.
function runMatch(req: RegexRequest) {
  const id = ++reqIdRef.current;
  let worker = workerRef.current ?? (workerRef.current = makeWorker());

  const timer = setTimeout(() => {
    worker.terminate();                 // hard kill the wedged worker
    workerRef.current = makeWorker();    // respawn for the next keystroke
    if (id === reqIdRef.current) setState({ timedOut: true }); // RGX-06 message
  }, TIMEOUT_MS);

  worker.onmessage = (e) => {
    if (e.data.id !== reqIdRef.current) return; // id-gate: drop stale replies
    clearTimeout(timer);
    setState(e.data); // {matches,...} | {error}
  };
  worker.postMessage({ ...req, id });
}
```

### Safe highlight overlay — escaped React text nodes (NEVER dangerouslySetInnerHTML)
```tsx
// RGX-07: slice source text into matched/unmatched segments; render each as a
// React text child (escaped by default). No HTML string is ever constructed.
function Highlighted({ text, matches }: { text: string; matches: Match[] }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.index > cursor) parts.push(<span key={`u${i}`}>{text.slice(cursor, m.index)}</span>);
    parts.push(
      <mark key={`m${i}`} className="rounded-[2px] bg-accent-soft text-accent">
        {text.slice(m.index, m.index + m.length)}
      </mark>,
    );
    cursor = m.index + m.length;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <div className="whitespace-pre-wrap break-words font-mono text-[13px]">{parts}</div>;
}
```

### Common-pattern library (RGX-05)
```typescript
export const COMMON_PATTERNS = [
  { label: "Email", source: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", flags: "g" },
  { label: "URL",   source: "https?://[^\\s]+",            flags: "g" },
  { label: "IPv4",  source: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", flags: "g" },
] as const;
// Insert = set the pattern/flags state. Keep these SIMPLE/linear (no nested
// quantifiers) so the library itself never trips the watchdog.
```

## State of the Art

| Old approach | Current approach | Why |
|---|---|---|
| `while ((m = re.exec(s)))` loop | `String.prototype.matchAll` | Avoids `lastIndex` mutation + zero-length infinite loop [VERIFIED: MDN] |
| Hand-rolled `$1` token expansion | native `replace` `$n`/`$<name>` | Native since ES2018 named groups [VERIFIED: MDN] |
| Debounce + main-thread regex | Web Worker + `terminate()` watchdog | Debounce can't prevent a single catastrophic freeze (project lock) |
| `new Worker('worker.js')` static path / blob | `new Worker(new URL('./w.ts', import.meta.url), {type:'module'})` | Vite-native bundling; same-origin chunk, offline, CSP-clean [VERIFIED] |

**Deprecated/outdated for THIS project:** inline blob workers (CSP-blocked here); any sanitizer lib for highlight (React escaping suffices); `cron-parser`-style "just add a lib" instinct (violates the wedge).

## Open Decisions

> These are the gray areas `/gsd-discuss-phase 14` (or the planner) should resolve. None block research; all have a recommended default.

1. **Highlight technique — read-only view vs overlay-over-textarea.**
   - Recommended: **read-only highlighted view** beside the editable input (simpler, no font-metric/scroll sync, WCAG-clean).
   - Alternative: a transparent textarea over an aligned highlight layer (a "true" overlay) — richer UX, much fiddlier. Decide which.
2. **Debounce before posting to the worker?** The "no debounce" lock means *don't use debounce INSTEAD of a worker*. A short (~50–100ms) debounce *before* posting is still allowed and avoids spawning a run per keystroke on huge text. Confirm whether to add it. Recommend: yes, small debounce + worker (id-gating already covers correctness).
3. **Worker timeout duration.** Recommend **1000ms** start; must keep paste-instant (<2s) honest while not false-tripping on legit large inputs. Tune against the real WKWebView.
4. **Common-pattern library size/content.** REQUIREMENTS names email/URL/IPv4 (3). Confirm exactly those three (RGX-F2 persistence is deferred). Recommend: ship exactly those three, frozen const.
5. **Flag toggle UI shape.** Five independent on/off toggles (g/i/m/s/u) — a row of `aria-pressed` buttons (reuse `SegmentedControl`-style classes) vs a single multi-select. Also: is `g` user-toggleable for *display* given it's force-added for enumeration? Recommend: 5 independent toggles; `g` toggles only the replace-preview's all-vs-first behavior (enumeration always g-forced internally).
6. **Match/Replace layout.** One combined view (pattern + flags + text + live matches + live replace preview) vs a mode switch. Recommend: single scrolling view (matches + replace preview both live), no mode switch — fits paste-instant.
7. **Worker respawn timing.** Eager respawn on timeout (warm next run) vs lazy (recreate on next post). Recommend: eager.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Web Worker (module type) | RGX-06 worker | ✓ (WKWebView/WebKit) | — | none needed; module workers supported in the WKWebView baseline |
| `String.prototype.matchAll` | RGX-01/02 | ✓ | ES2020 | none |
| named groups + `$<name>` replace | RGX-02/04 | ✓ | ES2018 | none |
| Vite `import.meta.url` worker bundling | offline worker chunk | ✓ (Vite 7) | `^7.0.4` | inline blob worker ONLY with a `worker-src 'self' blob:` CSP addition |
| `lucide-react` `Regex` glyph | registry icon | ✓ | 1.17.0 | `Search`/`Asterisk`/`Hash` also present |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** blob-worker path is gated behind a CSP change — avoid; use the Vite chunk.

## Validation Architecture

> nyquist_validation not disabled in config → section included.

### Test Framework
| Property | Value |
|---|---|
| Framework | vitest `4.1.7` (unit) + `@testing-library/react` 16.3.2 (component, jsdom per-file) + WebdriverIO `@wdio` 9.27 real-WKWebView e2e |
| Config file | `vite.config.ts` (`test` block; node env, jsdom opt-in via `// @vitest-environment jsdom`) |
| Quick run command | `pnpm vitest run src/lib/regex` (pure core) |
| Full suite command | `pnpm vitest run && pnpm tsc --noEmit` then `scripts/e2e-spike.sh` (real WKWebView) |

### Phase Requirements → Test Map
| Req | Behavior | Test type | Command | Exists? |
|---|---|---|---|---|
| RGX-01 | matches enumerated, indices correct | unit | `pnpm vitest run src/lib/regex` | ❌ Wave 0 |
| RGX-02 | numbered + named groups present | unit | same | ❌ Wave 0 |
| RGX-03 | flags g/i/m/s/u alter results | unit | same | ❌ Wave 0 |
| RGX-04 | replace `$1`/`$<name>`/`$&` expand | unit | same | ❌ Wave 0 |
| RGX-05 | inserting a library pattern sets state | component | `pnpm vitest run src/tools/regex` | ❌ Wave 0 |
| RGX-06 | catastrophic pattern → "timed out", UI responsive | e2e (real WKWebView) | `scripts/e2e-spike.sh` | ❌ Wave 0 |
| RGX-07 | invalid pattern → inline error no throw; no `dangerouslySetInnerHTML` | unit + grep | `pnpm vitest run src/lib/regex` + absence-grep | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run src/lib/regex` (+ `src/tools/regex` once the view exists).
- **Per wave merge:** full `pnpm vitest run && pnpm tsc --noEmit && pnpm eslint`.
- **Phase gate:** full suite green + `scripts/e2e-spike.sh` exit 0 (incl. the catastrophic-pattern spec) + `gsd-ui-review` WCAG-AA PASS + `tauri build` human walkthrough.

### Wave 0 Gaps
- [ ] `src/lib/regex/regex.test.ts` — RGX-01/02/03/04/07 pure-core cases incl. a known catastrophic pattern run *through the watchdog harness* and the zero-length pattern `/^/gm`.
- [ ] `src/tools/regex/RegexTool.test.tsx` — RGX-05 insert; RGX-07 escaped rendering + `dangerouslySetInnerHTML` absence-grep.
- [ ] `test/e2e/regex.e2e.ts` — RGX-06 catastrophic-pattern "timed out" + responsive UI on the real WKWebView (proves the worker chunk loaded in the packaged app — the Pitfall 2 backstop).
- Framework install: none (vitest/wdio already present).

## Security Domain

> security_enforcement not disabled → included. This tool runs untrusted user input (the regex itself is the threat).

### Applicable ASVS Categories
| ASVS | Applies | Standard control |
|---|---|---|
| V5 Input Validation | yes | `new RegExp` in try/catch → error-as-value; never `eval`-style construction |
| V6 Cryptography | no | — |
| V2/V3/V4 Auth/Session/Access | no | offline single-user desktop tool, no auth surface |
| V14 Config (CSP) | yes | keep `script-src 'self'`; do NOT weaken to allow blob workers unless forced + signed off |

### Known Threat Patterns
| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| ReDoS / catastrophic backtracking (user pattern hangs the window) | Denial of Service | Web Worker + `terminate()` watchdog [VERIFIED]; the locked design |
| XSS via highlighted match text | Tampering | React text children, never `dangerouslySetInnerHTML` (RGX-07) |
| CSP weakening to ship a blob worker | Tampering / EoP | Use the same-origin Vite chunk; no CSP change needed [VERIFIED] |
| Stale worker result overwrites newer UI | (correctness) | request-id gating + hard terminate |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The Vite `import.meta.url` worker chunk loads correctly in the packaged `tauri build` WKWebView without a `base` change | Pitfall 2 / Env | MEDIUM — if it 404s, set `base: './'`. Caught by the mandatory real-WKWebView e2e gate before sign-off, so low residual risk. |
| A2 | Module-type Web Workers are supported in the project's WKWebView baseline (mid-2026 macOS) | Env | LOW — module workers are broadly supported in current WebKit; verified live at the e2e gate. |
| A3 | 1000ms is a reasonable default timeout | Open Decisions §3 | LOW — tunable, no correctness impact; the watchdog works at any value. |

**Note:** A1 is the only claim that could change the plan's task shape (it may add a one-line `vite.config.ts` `base` task). It is explicitly de-risked by the existing phase DoD (real WKWebView + `tauri build` sign-off), so the planner should include a verification step rather than treat it as blocking.

## Sources

### Primary (HIGH)
- MDN `String.prototype.matchAll` — g-flag requirement, `.index`/`.groups`/numbered groups, regex-clone (no `lastIndex` mutation), zero-length advance: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll
- MDN `String.prototype.replace` — `$$ $& $\` $' $n $<name>` support, non-existent/empty group behavior, first-match-without-g: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace
- MDN CSP `worker-src` — fallback to `script-src`, `'self'` excludes `blob:`: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/worker-src
- Vite worker docs / `workerImportMetaUrl` plugin — `import.meta.url` worker emitted as a separate prod chunk: https://vite.dev/guide/features (Web Workers) + https://github.com/vitejs/vite/commit/4a472418c02a0821900678778752c2d361bae3bd
- Codebase: `package.json` (versions), `src-tauri/tauri.conf.json` (CSP, no base/worker-src), `vite.config.ts` (no `base`), `node_modules/lucide-react/.../icons/regex.mjs` (glyph exists), `src/tools/url/UrlTool.tsx` + `src/lib/url.ts` + `src/components/SegmentedControl.tsx` (sibling patterns).

### Secondary (MEDIUM)
- Tauri v2 prod base-path/asset-rewrite issue class (`tauri.localhost`): https://github.com/tauri-apps/tauri/issues/13262 and base-path guidance https://v2.tauri.app/start/frontend/vite/
- ReDoS / `worker.terminate()` as the only sync-regex kill: https://www.sonarsource.com/blog/vulnerable-regular-expressions-javascript , https://snyk.io/blog/redos-and-catastrophic-backtracking/

## Metadata

**Confidence breakdown:**
- Native API facts (matchAll/replace/RegExp/groups): HIGH — verified vs MDN.
- Worker bundling + CSP model: HIGH — Vite emits same-origin chunk; CSP `worker-src`→`script-src` fallback verified; only the packaged-build base-path resolution is MEDIUM (A1, e2e-gated).
- ReDoS / terminate-only-kill: HIGH — multiple authoritative sources + spec reasoning.
- Architecture/pattern fit: HIGH — directly mirrors the just-shipped Phase 13 three-layer pattern.
- lucide glyph: HIGH — verified in the installed package.

**Research date:** 2026-06-03
**Valid until:** ~2026-07-03 (30 days; stable native APIs + pinned versions. Re-verify A1 only if Vite/Tauri majors bump.)
