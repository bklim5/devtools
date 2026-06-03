# Pitfalls Research

**Domain:** Adding Cron, URL, Regex tools + a Protobuf decimal-byte-array input mode to a zero-dep, paste-instant, offline Tauri 2 + React + TS desktop app (DevTools v1.3 "More Tools")
**Researched:** 2026-06-03
**Confidence:** HIGH (cron DOM/DOW union semantics + field numbering verified against man7 crontab.5; RegExp `lastIndex`/zero-width loop verified against MDN; URL/`encodeURIComponent` semantics and the decoder-untouched constraint grounded in authoritative docs + PROJECT.md)

> **Framing for the roadmapper/planner:** these are mistakes made when *adding four specific features under hard constraints* — **zero new runtime deps** (so cron next-run is HAND-ROLLED), **paste-instant <2s**, **offline**, **WCAG-AA**, and **`decoder.ts` + its 19 tests stay byte-for-byte untouched**. Two pitfalls are uniquely dangerous in a WKWebView: a non-terminating cron loop and a ReDoS regex both **freeze the entire window** (single JS thread, no separate UI thread to rescue it). Those are ordered first. Every prevention below should land as a **tool-phase acceptance criterion with a named fixture**.
>
> **Suggested phase shape** (referenced in per-pitfall "Phase to address" and the mapping table). Phase numbering continues from v1.2's Phase 11 → starts at Phase 12:
> - **Cron tool phase** — hand-rolled parse + bounded next-run (the only non-trivial bit; highest risk).
> - **URL tool phase** — native `URL`/`URLSearchParams`, error-as-value.
> - **Regex tool phase** — native `RegExp`, off-main-thread match, safe highlight.
> - **Protobuf decimal-input phase** — pre-decode adapter; decoder stays untouched.

---

## Critical Pitfalls

### Pitfall 1: Cron next-run loop hangs on impossible / sparse expressions — freezes the window

**What goes wrong:**
The obvious next-run algorithm — "start at now, add one minute, test the expression, repeat until match" — **never terminates** for impossible expressions (`0 0 30 2 *` = Feb 30, never) and is pathologically slow for sparse-but-valid ones (`0 0 29 2 *` = Feb 29, up to ~4 years × 525,600 minutes). In a WKWebView a non-terminating loop **freezes the whole window** — ⌘K stops responding, nothing paints, and there is no decode button to cancel. This is the single highest-risk item in v1.3 because next-run is hand-rolled (no `cron-parser` lib).

**Why it happens:**
Minute-by-minute increment is the most intuitive formulation and works for every common expression, so the unbounded case is never hit in casual testing. Impossible expressions (Feb 30, day 31 in a 30-day month) are valid *syntax*.

**How to avoid (Cron tool phase):**
1. **Hard iteration bound — required.** Cap the search (e.g. stop after scanning ~4 years forward, or after N candidate evaluations such as 500k). On hitting the bound, return "no upcoming run found" — never loop forever.
2. **Field-jump, not minute-jump.** Compute the next valid value per field (next matching month → day → hour → minute) instead of +1 minute. Feb-30 then exhausts the year search in a handful of iterations; `* * * * *` and `0 0 29 2 *` both stay well under the <2s budget.

**Warning signs:**
The tab spins / window beachballs on a hand-typed expression; computing 5 next-runs for a sparse expression is visibly slow.

**Phase to address:** Cron tool phase. Acceptance criterion: "next-run is bounded — `0 0 30 2 *` returns 'no upcoming run' (no hang); `0 0 29 2 *` returns N runs in <2s." Add impossible-expression + leap-day fixtures.

---

### Pitfall 2: Cron day-of-month vs day-of-week — AND instead of OR (the classic Vixie-cron bug)

**What goes wrong:**
When BOTH day-of-month (DOM) and day-of-week (DOW) are restricted (neither is `*`), the entry must fire when **either** matches — it is a **UNION (OR)**, not an intersection (AND). A naive `domMatches && dowMatches` silently skips valid runs. Canonical example: `30 4 1,15 * 5` runs at 04:30 on the 1st, on the 15th, **AND** every Friday — not only on a 1st/15th that happens to be a Friday. (Verified against man7 crontab.5: "the command will be run when *either* field matches the current time.")

**Why it happens:**
Every other field combines with AND (minute AND hour AND month), so developers extend the same logic to the day pair. The day-pair OR is an old Vixie-cron exception that's easy to miss — and the human-readable *description* will lie too if it renders the pair as AND.

**How to avoid (Cron tool phase):**
Make a named, unit-tested `dayMatches` with explicit quadrant logic:
- both DOM and DOW restricted → `domMatches || dowMatches`
- exactly one restricted → use that one
- neither restricted (`* * `) → always true

Test one fixture per quadrant; `30 4 1,15 * 5` is the canonical case. The description text must reflect the OR ("on the 1st and 15th, and every Friday").

**Warning signs:**
`* * * * *` and `0 0 1 * *` pass but a mixed DOM+DOW expression skips runs; user reports "it's not firing on Fridays."

**Phase to address:** Cron tool phase. Acceptance criterion: "DOM+DOW union semantics verified with `30 4 1,15 * 5`; four-quadrant unit tests."

---

### Pitfall 3: Cron next-run wrong across DST transitions (JS `Date` local-time arithmetic)

**What goes wrong:**
Next-runs are shown in local time (mirroring the Unix Time tool). Local-time `Date` arithmetic breaks at DST boundaries:
- **Spring-forward (skipped hour):** a 02:30 run on the spring-forward day doesn't exist locally; `new Date(y, m, d, 2, 30)` silently rolls to 03:30 (or back), so the displayed time is wrong or a run is dropped/duplicated.
- **Fall-back (repeated hour):** 01:30 occurs twice; a minute-walk can run it twice or skip the second occurrence depending on how `Date` resolves the ambiguous local time.

**Why it happens:**
`new Date(year, monthIndex, day, hour, minute)` interprets fields in the host zone and resolves invalid/ambiguous local times implicitly. Developers test in summer or a no-DST setup and never see it.

**How to avoid (Cron tool phase):**
- Match on **local-time calendar components** (`getFullYear`/`getMonth`/`getDate`/`getHours`/`getMinutes`), and after constructing the next candidate, **re-read its components to confirm the constructed time actually matches** (defends against the silent spring-forward roll). If the read-back hour ≠ intended hour (skipped hour), advance to the next valid minute rather than displaying the rolled value.
- For fall-back, dedupe on matched wall-clock minute so a repeated local hour doesn't yield two identical displayed runs.
- Make "now" injectable so behavior is testable independent of the host zone; assert at the component level. Document the chosen skipped/repeated-hour behavior (deliberate, Vixie-convention-compatible).

**Warning signs:**
A run shows the wrong hour twice a year; duplicate/missing entry near March/November; tests only ever run in one TZ.

**Phase to address:** Cron tool phase (flag for deeper research during planning). Acceptance criterion: "next-run uses component matching with constructed-time read-back; DST behavior deliberate and fixture-tested."

---

### Pitfall 4: Cron field-count and numbering errors (6-field seconds, month/DOW indexing, macros)

**What goes wrong:**
Several parse-layer mistakes, each producing silently-wrong runs:
- **5-field vs 6-field ambiguity:** standard cron is 5 fields (min hour DOM month DOW); a leading **seconds** field makes it 6. Mis-counting shifts every field by one (treating seconds as minutes, etc.).
- **Off-by-one month indexing:** cron months are **1–12** (1 = January) but JS `Date.getMonth()` is **0–11**. Forgetting the conversion fires a month early/late.
- **DOW numbering:** **0–7**, where **both 0 and 7 = Sunday** (verified against man7 crontab.5). Treating it as 0–6 mis-handles `7`.
- **`@reboot` has no schedulable next run** — fabricating a time for it is wrong; `@daily`/`@hourly`/`@weekly` etc. must expand to their canonical 5-field form.

**Why it happens:**
Cron's numbering predates JS conventions; the 0/7-Sunday and 1-based-month quirks are exactly the kind of detail dropped under "it mostly works." Macros look like an afterthought.

**How to avoid (Cron tool phase):**
- Disambiguate field count by token count: 5 → standard, 6 → leading seconds; reject other counts with an explicit error. Document which the tool supports (spec says 5-field, 6-field seconds, and `@daily`/`@hourly`-style macros).
- Normalize at parse time: cron month 1–12 → store/compare consistently (convert to/from `getMonth` 0–11 in exactly one place); map DOW `7 → 0`.
- Expand macros to 5-field form in a lookup table; detect `@reboot` (and any reboot-class macro) and render "runs at startup — no scheduled next run" instead of a fabricated time.

**Warning signs:**
A `@monthly`/`@weekly` expression computes wrong; a 6-field expression is parsed as 5; runs land one month off; `0` and `7` for Sunday behave differently.

**Phase to address:** Cron tool phase. Acceptance criterion: "field-count disambiguation + month(1–12)/DOW(0–7, 0=7=Sun) numbering + macro expansion fixtures; `@reboot` shows no next run."

---

### Pitfall 5: Cron step/range/list parsing (`*/15`, `1-5`, `1,3,5`) — silent mis-expansion

**What goes wrong:**
Each field can be a list of ranges/steps: `1,3,5`, `1-5`, `*/15`, `0-30/10`, `MON-FRI`. Hand-rolled parsing easily mishandles: `*/15` on minutes = 0,15,30,45 (not "every 15th from 1"); step base for `5/15` starts at 5; ranges are inclusive on both ends; mixed lists (`1-5,15,30-40/2`) must compose; out-of-range values (`*/61` minutes, `8` for DOW beyond 7) must error, not wrap.

**Why it happens:**
The grammar is small but composes in ways a quick split-on-comma misses; step semantics (`base/step` over the field's full range vs a sub-range) are subtle.

**How to avoid (Cron tool phase):**
- Parse each field into an explicit **set of allowed integers** via a single tokenizer: split on `,` → for each token resolve `*`, `a`, `a-b`, `*/s`, `a-b/s` to a sorted integer set, validated against that field's min/max. Reject anything out of range with a clear message.
- Unit-test the set expansions directly (`*/15` on minutes → {0,15,30,45}; `1-5` → {1,2,3,4,5}; `5/15` → {5,20,35,50}) — pure, fast, and the bedrock the matcher and next-run rely on.
- Support name aliases (JAN–DEC, SUN–SAT) only if the spec wants them; otherwise reject names with a clear error rather than mis-parsing.

**Warning signs:**
`*/15` produces the wrong set; an inclusive range drops an endpoint; an out-of-range value silently wraps; mixed lists lose tokens.

**Phase to address:** Cron tool phase. Acceptance criterion: "field-set expansion unit-tested for `*/15`, `1-5`, `1,3,5`, `a-b/s`; out-of-range tokens error."

---

### Pitfall 6: Regex catastrophic backtracking (ReDoS) freezes the window

**What goes wrong:**
The user supplies BOTH the pattern and the test text. A pattern like `(a+)+$` against `"aaaaaaaaaaaaaaaaaaaa!"` triggers exponential backtracking in JSC/V8. Because regex runs synchronously on the WKWebView's single JS thread, a slow match **hangs the whole app** — the window stops painting, ⌘K dies, and there's no cancel. A regex tester is uniquely exposed: *the user owns both inputs*, so there's no trusted pattern to sanitize.

**Why it happens:**
ReDoS only manifests on adversarial pattern+input combinations the developer never types. Nested quantifiers (`(a+)+`, `(a*)*`, `(.*)*`) plus a non-matching suffix are exactly what a tester's users will paste.

**How to avoid (Regex tool phase):**
- **Run the match in a Web Worker** so a hung match freezes only the worker, not the UI. Wrap each attempt in a **timeout watchdog** (terminate/restart the worker if no result within ~250–500ms) and surface "pattern too slow on this input" instead of freezing. Workers are native → no new runtime dep (holds the zero-dep line).
- If a worker is judged too heavy for v1.3, the *minimum* bar is **debounced match + input-size cap + documented limitation** — but the worker+timeout is the only real ReDoS protection and is the recommended path for a webview app where a hang is a frozen window.
- Do **not** try to "detect ReDoS patterns" heuristically — unreliable; bound execution instead.

**Warning signs:**
Typing a nested-quantifier pattern against a long string beachballs the window; one keystroke blows the <2s budget.

**Phase to address:** Regex tool phase (flag for deeper research). Acceptance criterion: "regex matching cannot freeze the UI — `(a+)+$` on a long non-matching string yields a timeout message, window stays responsive." Highest-risk regex item.

---

### Pitfall 7: Regex `/g` `lastIndex` statefulness + zero-width-match infinite loop

**What goes wrong:**
Two related bugs from the global flag (verified against MDN):
1. **Shared stateful RegExp:** a `RegExp` with `g` (or `y`) carries `lastIndex` between calls; reusing one instance across renders/inputs makes `.test()`/`.exec()` resume mid-string and return alternating/wrong results (after a failed match `lastIndex` resets to 0, compounding confusion).
2. **Zero-width infinite loop:** in `while ((m = re.exec(str)) !== null)`, a zero-width match (`/^/gm`, `/(?=x)/g`, `/a*/g`) consumes nothing, `lastIndex` doesn't advance, and the loop spins forever — another window freeze.

**Why it happens:**
`while(exec)` is the textbook way to enumerate matches, and zero-width patterns (anchors, lookaheads, `*`-quantified groups) are exactly what a regex tester's users type.

**How to avoid (Regex tool phase):**
- **Prefer `String.prototype.matchAll(re)`** to enumerate matches — it copies the regex internally, requires `g`, and is immune to both the shared-`lastIndex` bug and the zero-width loop (MDN's explicit recommendation). Native, zero-dep.
- If `exec` must be used: **bump `lastIndex` by 1 on a zero-length match** (`if (m.index === re.lastIndex) re.lastIndex++`) and construct a **fresh RegExp per evaluation** (or reset `lastIndex = 0`) so state never leaks between inputs/renders.
- For substitution preview (`$1` refs), use native `String.prototype.replace`/`replaceAll` rather than hand-rolling capture-ref expansion.

**Warning signs:**
Match count changes when you re-run the same pattern; an anchor-only or `*` pattern hangs; highlighted matches drift.

**Phase to address:** Regex tool phase. Acceptance criterion: "enumeration uses `matchAll` (or zero-width-guarded `exec`); `/^/gm`, `(?=…)`, `a*` with `/g` enumerate finitely; regex instances not shared across inputs."

---

### Pitfall 8: Regex match highlighting — XSS via `dangerouslySetInnerHTML`

**What goes wrong:**
Highlighting matches by building an HTML string (`<mark>…</mark>` around match spans) and injecting it with `dangerouslySetInnerHTML` lets user-supplied test text inject markup/script. The test text is untrusted user input rendered back into the DOM.

**Why it happens:**
String-splice-then-inject-HTML is the quickest way to wrap matches in `<mark>`, and React's `dangerouslySetInnerHTML` is right there.

**How to avoid (Regex tool phase):**
Render highlights as **React elements** — split the text by match index into non-match / match segments and emit `<span>{segment}</span>` / `<mark>{segment}</mark>` nodes. React escapes text children automatically, so no markup executes. Never assemble an HTML string for match output.

**Warning signs:**
Any `dangerouslySetInnerHTML` in the regex tool; test text `<img onerror=alert(1)>` renders an element instead of literal text.

**Phase to address:** Regex tool phase. Acceptance criterion: "highlighting renders React text nodes (no `dangerouslySetInnerHTML`); `<script>`/`<img onerror>` in test text renders as literal text."

---

### Pitfall 9: Regex invalid-pattern handling — `new RegExp` throws; "no match" ≠ "invalid"

**What goes wrong:**
`new RegExp(userPattern, flags)` **throws `SyntaxError`** on an invalid/incomplete pattern (unbalanced `(`, bad `\`, invalid flag). An unguarded constructor crashes the render while the user is mid-typing a pattern. Separately, conflating "valid pattern, zero matches" with "invalid pattern" confuses users.

**Why it happens:**
Live evaluation runs `new RegExp` on every keystroke, including transient invalid states (`(foo` before the `)`); the throw escapes if not caught.

**How to avoid (Regex tool phase):**
- Wrap `new RegExp` in try/catch returning **error-as-value** (mirrors the decoder/formatter tolerant style); surface the `SyntaxError` message via the existing explicit-error UX, never let it throw to the UI.
- Distinguish three states explicitly: **invalid pattern** (catch), **valid + no matches**, **valid + matches** — each with distinct UI copy.

**Warning signs:**
A red error overlay appears while typing an incomplete pattern; "no match" and "invalid regex" look the same.

**Phase to address:** Regex tool phase. Acceptance criterion: "invalid patterns are error-as-value (no throw to UI); invalid vs zero-match states distinguished."

---

### Pitfall 10: URL parsing — `new URL()` / `decodeURIComponent` throw, and encode/decode-mode confusion

**What goes wrong:**
- `new URL(input)` **throws `TypeError`** on relative/malformed input (`/path`, bare `example.com`, `"not a url"`). An unguarded constructor crashes the render or shows a stack trace.
- `decodeURIComponent` **throws `URIError`** on malformed percent-sequences (`%`, `%ZZ`, `%E0%A4`).
- `encodeURI` vs `encodeURIComponent`: `encodeURI` leaves `&`, `=`, `?`, `/`, `#` unescaped (whole-URL use); `encodeURIComponent` escapes them (single-component). Wrong choice corrupts query values or double-encodes.
- `+` vs `%20`: `URLSearchParams` decodes `+` as space (form semantics); `decodeURIComponent` does **not**. Mixing them mis-decodes query strings.
- Repeated query keys (`?a=1&a=2`) collapse if you build a plain object.

**Why it happens:**
Native `URL`/`URLSearchParams`/encode-decode each have their own throw behavior and encoding rules; they're easy to conflate, and happy-path inputs hide all of it.

**How to avoid (URL tool phase):**
- Wrap `new URL()` and every `encode/decodeURIComponent` in **try/catch returning error-as-value**, surfaced via the explicit-error UX — never throw to the UI (mirrors the decoder).
- Offer **both** `encodeURI`/`decodeURI` (full string) and `encodeURIComponent`/`decodeURIComponent` (component), clearly labeled, so the user picks the right semantics (spec: "component + full-string encode/decode both ways").
- Build the query → key/value table from **`URLSearchParams`** and enumerate with `getAll`/iteration so **repeated keys are preserved** (rows, not an object). Document that `URLSearchParams` treats `+` as space.
- Split scheme/host/port/path/query/fragment from the parsed `URL` object's properties (only after a successful, guarded parse).

**Warning signs:**
Pasting a bare host or `%`-truncated string shows a red overlay/blank pane; `?a=1&a=2` shows one row; `+` renders inconsistently as `+` vs space across modes.

**Phase to address:** URL tool phase. Acceptance criterion: "all URL/encode/decode ops are error-as-value (no throw to UI); repeated query keys preserved; component vs full-string offered + labeled; malformed-percent and relative-input fixtures covered."

---

### Pitfall 11: Protobuf decimal input — modifying `decoder.ts` or its 19 tests (the hardest constraint)

**What goes wrong:**
The decimal-byte-array mode (`10, 3, 80, 81, 82` → bytes) is implemented by editing `decoder.ts` or relaxing/adding to its 19 tests. This violates the project's hardest constraint: **`decoder.ts` + its 19 tests stay byte-for-byte untouched** (the test bar IS the hero feature's spec).

**Why it happens:**
The new input is "about decoding," so the decoder file feels like the natural home. It isn't — decimal parsing is a *pre-decode input adapter*, not a decoder concern.

**How to avoid (Protobuf decimal-input phase):**
Implement decimal parsing as a **separate pre-decode parse layer** (new module, e.g. `src/lib/protobuf/parseInput.ts` or alongside the existing input auto-detect) that converts the decimal string → `Uint8Array`, then feeds the **unchanged** decoder exactly as hex/base64 do. New behavior gets its **own** tests; the 19 stay green and unedited. Verify with `git diff -- src/lib/decoder.ts` (and its test file) showing zero changes at the phase boundary — exactly as every prior milestone proved.

**Warning signs:**
`git diff` touches `decoder.ts` or its test file; the 19-count changes; a "small tweak" to the decoder to accept a new input shape.

**Phase to address:** Protobuf decimal-input phase. Acceptance criterion: "decoder.ts + its 19 tests byte-for-byte untouched; decimal parsing in a new pre-decode module with its own tests."

---

### Pitfall 12: Protobuf input auto-detect — decimal vs hex/base64 ambiguity & range validation

**What goes wrong:**
Decimal byte-arrays are auto-detected *alongside* hex and base64. Ambiguous inputs get misrouted:
- `10, 20` reads as decimal [10,20] — but `10 20` (no commas) could look like spaced hex (`0x10 0x20`), and `1020` is valid hex/base64-ish.
- Out-of-range decimal tokens (`256`, `-1`, `3.5`, non-integer) must be **rejected**, not silently truncated/wrapped to a byte.
- Auto-detect ordering matters: overlapping character sets ([0-9], space, comma) make several formats plausible for one string.

**Why it happens:**
Detection order and overlapping alphabets make the same string look like multiple formats; "10, 20" is genuinely ambiguous without a precedence rule.

**How to avoid (Protobuf decimal-input phase):**
- Require an **unambiguous decimal signal**: presence of a delimiter (comma, or comma+space) AND all tokens integers in **0–255**. Treat the comma-separated form as the canonical decimal trigger so `10, 20` is decimal but `1020`/`10 20` fall through to existing hex/base64 detection. Document and test the precedence order explicitly.
- **Validate range per token** (`Number.isInteger(n) && 0 <= n <= 255`); on any out-of-range/non-integer token, surface an explicit error (consistent with the existing "explicit errors" UX) — never wrap/truncate.
- Leave existing hex/base64 detection **behavior unchanged** — add decimal as a new branch with a clear, tested priority, and re-run the existing detection tests to prove no regression.

**Warning signs:**
A hex string starts decoding as decimal (or vice versa) after the feature lands; `256, 0` decodes to `[0,0]` instead of erroring; existing base64/hex detection tests change behavior.

**Phase to address:** Protobuf decimal-input phase. Acceptance criterion: "decimal detection requires delimiter + all tokens 0–255; out-of-range/non-integer tokens error explicitly; existing hex/base64 detection unchanged (regression tests green)."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Cron next-run by minute-increment loop | Trivial; passes common expressions | Hangs on impossible/sparse → frozen window | **Never** — bound from day one (Pitfall 1) |
| Regex match on the main thread (no worker/timeout) | Simpler wiring | One ReDoS pattern freezes the app | Interim only with input-size cap + documented limit; worker+timeout is the real fix (Pitfall 6) |
| `while(exec())` for match enumeration | Familiar idiom | Zero-width infinite loop + shared `lastIndex` bugs | Only with explicit zero-width `lastIndex++` guard; prefer `matchAll` (Pitfall 7) |
| Plain object for query params | Easy table | Drops repeated keys (`?a=1&a=2`) | **Never** — use `URLSearchParams.getAll` (Pitfall 10) |
| Decimal parsing inside `decoder.ts` | Feels co-located | Violates byte-for-byte-untouched; breaks the hero spec | **Never** (Pitfall 11) |
| `dangerouslySetInnerHTML` for highlighting | One-liner | XSS on untrusted test text | **Never** — render React nodes (Pitfall 8) |
| Adding a cron/regex lib instead of hand-rolling | Less code | Violates zero-new-runtime-deps wedge constraint | **Never** this milestone (zero-dep line) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Native `URL` constructor | Calling it bare; throws on relative/invalid | try/catch → error-as-value via explicit-error UX |
| `URLSearchParams` | Assuming `+` is literal; collapsing repeated keys into an object | Know `+`→space; enumerate with `getAll`, preserve all rows |
| `decodeURIComponent` | Assuming it tolerates malformed `%` | Wrap in try/catch — throws `URIError` on `%`, `%ZZ` |
| Native `RegExp` `/g` | Sharing one stateful instance across inputs/renders | Fresh instance per eval (or `lastIndex=0`); prefer `matchAll` |
| `new RegExp(userPattern)` | Letting `SyntaxError` escape on incomplete pattern | try/catch → error-as-value |
| JS `Date` (cron local-time) | `new Date(y,m,d,h,min)` silently resolves DST-invalid times | Read-back constructed components; deliberate skipped/repeated-hour handling |
| `platform/` seam | Importing `@tauri-apps/*` directly in new tools | Route clipboard/store through `src/lib/platform/` like every existing tool |
| Tool registry | Hand-wiring sidebar/palette/router for the 3 new tools | Register in the registry array only — single control plane (sidebar/palette/router derive from it) |
| Web Worker (regex) | Assuming it needs a network/bundler dep | Native browser API; bundle a worker via Vite — zero new runtime dep |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded cron next-run search | Window beachballs on a hand-typed expression | Iteration bound + field-jump algorithm | Impossible (`0 0 30 2 *`) / sparse (`0 0 29 2 *`) |
| ReDoS regex on main thread | One keystroke freezes the window | Web Worker + timeout watchdog | Nested-quantifier pattern on long input |
| Zero-width `/g` exec loop | Tab hangs on anchor/lookahead/`*` patterns | `matchAll` or `lastIndex++` guard | Any zero-width-capable pattern with `/g` |
| Live regex/replace on every keystroke over large text | Lag while typing | Debounce + (ideally) worker; respect <2s | Large test text + frequent re-eval |
| Cron next-run recomputed every render | Sluggish UI | Memoize on expression + base time | Only matters once bounded; bound first |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Highlighting via `dangerouslySetInnerHTML` | XSS from untrusted test text | Render React text/`<mark>` nodes only |
| `new URL()` / `decodeURIComponent` throwing to UI | Crash / stack-trace leak; bad UX | Error-as-value try/catch via existing error UX |
| No execution bound on user-supplied regex | DoS-by-self (frozen window); foot-gun if patterns shared | Worker + timeout; never trust pattern+input combos |
| Silently wrapping out-of-range decimal bytes to 0–255 | Wrong decode shown as authoritative | Reject out-of-range/non-integer tokens with explicit error |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Cron next-runs without a timezone/local-time note | User misreads runs around DST | Show local time (consistent w/ Unix Time tool); make DST behavior deliberate + documented |
| `@reboot` shown with a fake "next run" | Misleading — it has no schedulable next run | "Runs at startup — no scheduled next run" |
| Cron description that lies about DOM+DOW | "Every Friday AND the 1st" rendered as AND | Description must reflect the OR semantics (Pitfall 2) |
| Hover-only copy on the new tools | Violates the binding no-hover-only-copy constraint | Visible, focusable copy via the platform seam (every existing tool does this) |
| Regex "no match" shown as an error | Confuses no-match with invalid-pattern | Distinguish invalid (catch) vs valid-zero-match (Pitfall 9) |
| URL component vs full-string encode not labeled | Wrong encoding chosen, output corrupted | Clearly label component vs full-string for both encode + decode |

## "Looks Done But Isn't" Checklist

- [ ] **Cron next-run bound:** verify `0 0 30 2 *` returns "no upcoming run" (no hang); `0 0 29 2 *` returns N runs <2s.
- [ ] **Cron DOM/DOW OR:** verify `30 4 1,15 * 5` fires on the 1st, the 15th, AND every Friday.
- [ ] **Cron DST:** verify spring-forward (skipped hour) and fall-back (repeated hour) behavior is deliberate + tested.
- [ ] **Cron numbering:** verify months 1–12 (1=Jan), DOW 0–7 (0=7=Sun), 5- vs 6-field disambiguation.
- [ ] **Cron macros:** verify `@reboot` → "no scheduled next run"; `@daily`/`@hourly` expand correctly.
- [ ] **Cron field-set:** verify `*/15` → {0,15,30,45}, `1-5` inclusive, `1,3,5` list, out-of-range errors.
- [ ] **Regex ReDoS:** verify `(a+)+$` on a long non-matching string times out gracefully (window responsive).
- [ ] **Regex zero-width:** verify `/^/gm`, `/(?=x)/g`, `/a*/g` enumerate finitely (no hang).
- [ ] **Regex state:** verify re-running the same pattern gives the same match count (no leaked `lastIndex`).
- [ ] **Regex invalid:** verify an incomplete pattern (`(foo`) shows a message, doesn't throw; invalid ≠ no-match.
- [ ] **Regex XSS:** verify `<img onerror=alert(1)>` as test text renders as literal text.
- [ ] **URL throws:** verify bare host, relative path, `%`-truncated input show messages, not crashes.
- [ ] **URL repeated keys:** verify `?a=1&a=2` shows two rows; `+` vs `%20` handled consistently.
- [ ] **Protobuf decoder untouched:** verify `git diff -- src/lib/decoder.ts` and its test file are empty; 19 tests still 19 and green.
- [ ] **Protobuf decimal range:** verify `256, 0` / `-1` / `3.5` error explicitly; `10, 20` decodes; `1020`/`10 20` route to hex/base64 unchanged.
- [ ] **All four features:** verify registry-only wiring (no hand-wired router/sidebar), platform-seam copy (no `@tauri-apps/*` import), paste-instant (no decode button), WCAG-AA (visible focus, AA contrast, no opacity-only disabled), zero new runtime deps.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cron unbounded loop shipped | MEDIUM | Add iteration bound + switch to field-jump; user already saw a hang (trust hit) |
| Cron AND-instead-of-OR shipped | LOW | Fix `dayMatches`, add four-quadrant + `30 4 1,15 * 5` fixtures; logic-only |
| Cron DST wrong | LOW–MEDIUM | Add component read-back + dedupe; pin DST fixtures with injectable "now" |
| Regex UI freeze (ReDoS) shipped | MEDIUM–HIGH | Retrofit Web Worker + timeout — structural; hard to bolt on late |
| Regex zero-width loop shipped | LOW | Swap `exec` loop for `matchAll`, or add `lastIndex++` guard |
| Regex XSS via innerHTML shipped | MEDIUM | Replace HTML-string injection with React node rendering across the highlight path |
| URL throw reaches UI | LOW | Wrap calls in try/catch error-as-value; add malformed/relative fixtures |
| Decoder.ts edited for decimal input | MEDIUM | Revert decoder + tests byte-for-byte; move parsing to a pre-decode module; re-verify 19 green |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Cron unbounded next-run loop | Cron tool phase | `0 0 30 2 *` → "no run" (no hang); `0 0 29 2 *` → N runs <2s |
| 2. Cron DOM/DOW OR-semantics | Cron tool phase | `30 4 1,15 * 5` fires 1st + 15th + every Friday; four-quadrant tests |
| 3. Cron DST transitions | Cron tool phase (deeper research) | Spring-forward/fall-back fixtures; constructed-time read-back asserted |
| 4. Cron field-count / numbering / macros | Cron tool phase | 5/6-field disambiguation; month 1–12, DOW 0/7=Sun; `@reboot` no next run |
| 5. Cron step/range/list expansion | Cron tool phase | `*/15`→{0,15,30,45}, `1-5` inclusive, out-of-range errors |
| 6. Regex ReDoS / UI freeze | Regex tool phase (deeper research) | `(a+)+$` on long input → timeout message, window responsive |
| 7. Regex `lastIndex` / zero-width loop | Regex tool phase | `matchAll` used; zero-width enumerate finitely; re-run count stable |
| 8. Regex highlight XSS | Regex tool phase | No `dangerouslySetInnerHTML`; `<img onerror>` renders literal |
| 9. Regex invalid-pattern handling | Regex tool phase | Incomplete pattern → message, no throw; invalid ≠ no-match |
| 10. URL throws / encoding confusion | URL tool phase | Error-as-value on bad input; repeated keys preserved; component vs full labeled; malformed-% fixtures |
| 11. Decoder.ts untouched | Protobuf decimal-input phase | `git diff` on decoder + tests empty; 19/19 green |
| 12. Decimal vs hex/base64 ambiguity | Protobuf decimal-input phase | Delimiter+0–255 detection; out-of-range errors; hex/base64 detection regression-tested |
| Workflow constraints (registry, seam, paste-instant, copy, WCAG-AA, zero-dep) | All four phases | Registry-only wiring; platform-seam copy; no decode button; gsd-ui-review WCAG-AA PASS; no new deps |

## Sources

- man7.org — crontab(5) man page (HIGH): DOM+DOW **"run when *either* field matches"** union semantics + `30 4 1,15 * 5` example; field ranges (minute 0–59, hour 0–23, DOM 1–31, month 1–12, DOW 0–7 with 0/7=Sunday); `@reboot` = "run once after reboot" (no scheduled next run). https://man7.org/linux/man-pages/man5/crontab.5.html
- MDN — RegExp.prototype.exec (HIGH): `g`/`y` flag makes regex stateful via `lastIndex`; resets to 0 on failed match; zero-width matches cause infinite loops in `while(exec)`; **recommends `matchAll`**; manual `lastIndex++` guard for zero-width. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
- MDN — encodeURI/encodeURIComponent, URL, URLSearchParams, decodeURIComponent (MEDIUM, docs + established knowledge): component vs whole-URL escaping; `URL`/`decodeURIComponent` throw on invalid input; `URLSearchParams` `+`→space and repeated-key (`getAll`) behavior.
- DevTools `.planning/PROJECT.md` (HIGH): zero-new-runtime-deps line; `decoder.ts` + 19 tests byte-for-byte untouched; paste-instant <2s; WCAG-AA; offline; registry as single control plane; `src/lib/platform/` seam; no hover-only copy; explicit-error UX precedent; v1.3 target features (5-field/6-field/macros, both encode/decode modes, flag toggles g/i/m/s/u, decimal delimiter input).
- Established domain knowledge: Vixie-cron field/macro behavior, JSC/V8 regex catastrophic backtracking (ReDoS), React `dangerouslySetInnerHTML` XSS (MEDIUM, well-corroborated).

---
*Pitfalls research for: adding Cron + URL + Regex tools and a Protobuf decimal-byte-array input mode to a zero-dep, paste-instant Tauri desktop app*
*Researched: 2026-06-03*
