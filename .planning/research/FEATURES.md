# Feature Research

**Domain:** Developer utility tools — Cron explainer, URL parser, Regex tester, + Protobuf decimal-byte-array input (DevTools v1.3 "More Tools")
**Researched:** 2026-06-03
**Confidence:** HIGH

> Scope note for the requirements author: the USER has already chosen the **fullest scope** for each tool (per the milestone brief). So this research does NOT relitigate scope — it makes the table-stakes vs differentiator vs anti-feature split testable, enumerates cron field syntax exhaustively, notes complexity, and flags where "fullest scope" still risks creeping past the wedge (called out inline as ⚠ SCOPE-CREEP). Every tool inherits the binding workflow constraints (paste-instant <2s, visible focusable copy, status bar, WCAG-AA, registry-driven, **zero new runtime deps**) — these are NOT re-listed per tool.

---

## Existing-component dependencies (read first)

Which existing UI scaffolding each new tool can lean on. Confirmed from `PROJECT.md`:

| Component | What it is | How the new tools use it |
|---|---|---|
| **Tool registry** (`src/lib/`, plain array) | Single control plane — sidebar, ⌘K palette, router all derive from it. Adding a tool = one registry entry + one component. | **All three** new tools. Mechanical. The decimal-byte mode is NOT a new registry entry (it's inside the existing Protobuf tool). |
| **`StatusBar`** | Shared status bar; `byteCount` is an **optional** prop (Phase 8 / UIX-01) rendered only when a number is passed; otherwise parse-state label + error + timing. | All three reuse it, but **drop `byteCount`** for Cron/URL/Regex (like Hash/JWT/UnixTime/UUID did — none are byte-oriented). Pass parse-state + error + timing. URL *could* show input length but it's not byte-meaningful — recommend omit. |
| **`FormatterView`** | Shared **two-pane** paste-instant layout (input→output) used by JSON + XML formatters; pure logic in `src/lib/format/`. | ⚠ **Partial fit only.** All three new tools want **richer output than one text pane** (Cron: description + run list; URL: param table; Regex: highlighted matches + group table + replace pane). Treat `FormatterView` as a *pattern to mirror* (paste-instant, pure logic in `src/lib/<tool>/`, copy via the platform seam), not a literal component to force-fit. URL's encode/decode sub-panes are the closest literal reuse. |
| **Platform seam** (`src/lib/platform/`) | Clipboard/store/shortcuts; tools never import `@tauri-apps/*`. | All copy affordances route here. |
| **Unix Time tool** | Existing local-time rendering convention. | **Cron** "next runs" MUST mirror its local-time formatting (milestone-explicit). |
| **Protobuf decoder + 19 tests** | `decoder.ts`, byte-for-byte frozen. | **Decimal-byte input** is a *pre-decode parse layer* producing the `Uint8Array` the decoder already accepts — **do not touch `decoder.ts` or its tests.** |

**Pure-logic placement (mirror the v1.1 ethos):** `src/lib/cron/`, `src/lib/url/`, `src/lib/regex/`, and a decimal parser alongside the existing byte-input detection. GUI thin; logic unit-tested (TDD).

---

## Feature Landscape

### TOOL 1 — CRON (explainer + next runs)

Reference: **crontab.guru** (description + a list of next runs). Note crontab.guru *deliberately omits* seconds and `L`/`W`/`#`; the chosen scope is intentionally **broader** (6-field seconds + macros + `L`).

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Parse **standard 5-field** (min hour dom month dow) | The universal cron format | MEDIUM | Fixed field order; each field has a defined range (table below). |
| **Human-readable description** ("At 02:00, every day") | The signature crontab.guru behavior; the point of the tool | MEDIUM–HIGH | See "what a good description covers" below — hardest correctness surface. |
| **Next N run times in LOCAL time** | Milestone-explicit; mirror Unix Time tool | MEDIUM–HIGH | Hand-rolled iterator (no `cron-parser` — zero-dep). N = **5** default. |
| **`*` (all)** | Foundational | LOW | — |
| **Ranges `a-b`** (`1-5`) | Foundational | LOW | Inclusive both ends. |
| **Lists `a,b,c`** (`1,15,30`) | Foundational | LOW | May mix with ranges/steps (`1-5,10`). |
| **Steps `*/n`, `a-b/n`, `a/n`** (`*/15`, `0-30/10`) | Foundational | LOW–MED | `*/n` = every n from field min; `a/n` = open-ended start (Vixie). |
| **DOW `0-7`, both 0 and 7 = Sunday** | POSIX convention; constant source of user error | LOW | *Verified.* Must accept `7` as Sunday. |
| **Per-field validation + clear errors** | Paste-instant tools must explain bad input | MEDIUM | "Minute field: 60 is out of range (0–59)." Point at the field, not a generic "invalid". |

#### Differentiators (all explicitly in chosen scope)

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **6-field (seconds-first)** `sec min hour dom month dow` | Quartz/Spring/many schedulers; crontab.guru can't | MEDIUM | **Auto-detect by token count** (6 tokens → seconds prepended). No mode picker. |
| **Macros** `@yearly`/`@annually`, `@monthly`, `@weekly`, `@daily`/`@midnight`, `@hourly` | Common shorthand pasted from crontabs | LOW | Alias table → expand to 5-field, then describe + compute. |
| **`@reboot`** | Vixie/cronie shorthand | LOW | **Special-case:** NO next-run time. Describe "At system startup"; show "runs at boot — no scheduled time" instead of a run list. Must not crash the iterator. |
| **Day names `MON-SUN` / month names `JAN-DEC`** (case-insensitive) | Very common in real crontabs (Vixie) | LOW–MED | Map to numbers before evaluating; allow in ranges (`MON-FRI`). |
| **`?` (no-specific-value)** | Quartz dom/dow; appears in pasted Quartz expressions | LOW | Treat as `*` for evaluation; accept silently so Quartz expressions don't error. |
| **`L` (last day) / `nL` (last weekday)** | "Run on the last day / last Friday" is a real need | MED–HIGH | `L` in dom = last day of month (month-length + leap aware); `5L` in dow = last Friday. Hardest iterator math. ⚠ SCOPE-CREEP risk — see note. |

#### Cron field reference (enumerate ALL of this for testable reqs)

| Field | Position (5-field) | Range | Special chars |
|---|---|---|---|
| Second | 6-field only, 1st | 0–59 | `* , - /` |
| Minute | 1 | 0–59 | `* , - /` |
| Hour | 2 | 0–23 | `* , - /` |
| Day-of-month | 3 | 1–31 | `* , - / ? L` (`W` = anti-feature) |
| Month | 4 | 1–12 / `JAN-DEC` | `* , - /` |
| Day-of-week | 5 | 0–7 (0 & 7 = Sun) / `SUN-SAT` | `* , - / ? L nL` (`#` = anti-feature) |

**The DOM/DOW OR-combination quirk (verified — must be specified):** when **both** day-of-month and day-of-week are restricted (neither is `*`/`?`), Vixie cron runs on days matching **either** field (OR/union), not both (AND). Counter-intuitive and a classic bug. Decision: the run iterator **MUST implement OR semantics**, and the description SHOULD make it explicit ("on day-of-month 1, **and on** every Monday" — not "Mondays that fall on the 1st"). This is a correctness requirement, not polish.

#### What a "good description" covers (testable checklist)

- States **time** ("At 02:00") and **cadence** ("every day", "every 15 minutes", "every hour").
- Names **specific days/months** in words ("on Monday and Friday", "in January").
- Verbalizes **ranges** ("Monday through Friday"), **lists** ("on the 1st and 15th"), **steps** ("every 2 hours").
- Correctly phrases the **DOM/DOW OR** case (above).
- Uses 24h or 12h consistently — recommend **24h** to match the developer audience / Unix Time tool (flag as a UX decision).
- **Degrades gracefully:** if a sub-expression is too complex to phrase naturally, fall back to a literal field readout rather than emit a wrong sentence.

#### Cron anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **`W` (nearest weekday)** | Quartz completeness | Rare in real Unix crontabs; weekday-proximity + month-boundary math is a disproportionate test burden | Parse-tolerate, describe as "(W modifier — not interpreted)", don't compute. Recommend EXCLUDE from compute. |
| **`#` (nth weekday, `6#3`)** | Quartz "3rd Friday" | Same niche/complexity as W | Same handling. Recommend EXCLUDE from compute. |
| **Year field / 7-field (Quartz/AWS)** | "Full Quartz" | Adds a 6-vs-7 field-count ambiguity + longer horizon math | Out of scope; crontab.guru omits it too. |
| **Cron *generator* UI** (build via dropdowns) | "Help me write one" | A generator is a different product; dilutes the paste-instant explainer wedge | Explainer only — paste in, read out. |
| **Timezone selector** | "What time in UTC?" | Multi-TZ math + UI; tool already mirrors Unix Time's single local-time convention | Local time only; optionally show the IANA TZ label for clarity. |

> ⚠ **Cron scope honesty:** `L`/`nL` is the single biggest complexity/test item in the whole milestone — month-length + leap-year + weekday math in a hand-rolled iterator. It's in scope, but the requirements author should give it its **own requirement(s)** with explicit test cases (last day of Feb leap vs non-leap; last Friday in a month with 4 vs 5 Fridays) and treat it as the deepest-research / highest-risk slice. `W`/`#` should be **dropped from computation** (parse-tolerant only).

---

### TOOL 2 — URL (full parser + encoder/decoder)

Reference: native `URL` + `URLSearchParams` (zero-dep, standard WebView APIs). The whole tool is a presentation layer over these — **lowest complexity of the three new tools.**

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **Split into components** scheme/host/port/path/query/fragment | The core "parse a URL" job | LOW | `URL`: `protocol, hostname, port, pathname, search, hash` (+ `username/password/origin` available). Surface the milestone-named parts. |
| **Query string → key→value table** | Reading messy query strings is the #1 use | LOW–MED | `URLSearchParams` iterates pairs; **preserves order & duplicates.** |
| **Full-string decode** | Paste an encoded blob → read it | LOW | See component-vs-full below. |
| **Full-string encode** | Build/share a URL | LOW | `encodeURI` — preserves reserved structure. |
| **Component encode/decode** | Encode/decode a single value, not the whole URL | LOW | `encodeURIComponent` / `decodeURIComponent` — escapes `&=?/:#`. The key distinction (below). |
| **Both directions, both modes** | "encode/decode both ways" is milestone-explicit | LOW | 2 transforms × 2 scopes = 4 operations. |
| **Validation / error on unparseable input** | Paste-instant must explain failure | LOW | `new URL()` throws → "Not a valid URL (no scheme?)". Offer to treat schemeless input as a bare query-string / component. |

#### Component vs full encode — the distinction to surface (testable)

| | Encode | Decode |
|---|---|---|
| **Full-string** (whole URL) | `encodeURI` — leaves reserved chars `:/?#[]@!$&'()*+,;=` intact so the URL stays valid | `decodeURIComponent` over the whole string (or per-component) |
| **Component** (one value/segment) | `encodeURIComponent` — escapes reserved chars too, so a value containing `&`/`=` doesn't break the query | `decodeURIComponent` |

Concrete test case: value `a&b=c`. Component-encoded → `a%26b%3Dc`. Full-encoded (as URL) → `a&b=c` (unchanged, because `&`/`=` are structural). Showing both side-by-side is the differentiator.

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Per-row decoded value in the param table** | See `%20`→space inline | LOW | `URLSearchParams` auto-decodes on read; show decoded by default. |
| **Show empty values & valueless keys distinctly** | `?a=&b&c=1` is ambiguous; good tools disambiguate | LOW | `a` (empty) vs `b` (no `=`). Both become `""` via `URLSearchParams`; distinguish in a raw view. Flag the nuance. |
| **Copy individual component / individual param** | Pull one value out fast (no-hover-only-copy rule) | LOW | Per-row + per-component copy via the platform seam. |
| **Live update both panes as you type** | Paste-instant ethos | LOW | Re-parse on input. |

#### URL anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Editable param table that rebuilds the URL** | "Tweak and recompose" | Round-trip rebuild (ordering, re-encoding, `+` vs `%20`) is fiddly; turns a reader into an editor | Read-only table; recompose is a separate later concern. |
| **URL shortening / expanding** | Convenience | Requires **network** — violates the offline constraint | Hard no. |
| **IDN / punycode converter** | Internationalized domains | `URL.hostname` already punycodes; extra UI is niche | Surface what `URL.hostname` gives; don't build a converter. |
| **`+` vs `%20` parsing toggle** | Form-encoding pedantry | `URLSearchParams` decodes `+`→space (form semantics); a toggle confuses | Document behavior in a tooltip, not a toggle. (Minor — flag only.) |

> URL is the fastest tool to build — almost entirely a view over native `URL`/`URLSearchParams`. Good candidate to ship first to bank a win.

---

### TOOL 3 — REGEX (tester)

Reference: **regex101**, scaled down. Native `RegExp` (zero-dep, ECMAScript flavor). regex101 is huge; the chosen scope is a focused subset — keep it that way.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **Pattern + test-string inputs, live matching** | The core tester loop | LOW | Recompile every keystroke; paste-instant. |
| **Highlight all matches in the test string** | The signature regex-tester behavior | MEDIUM | `matchAll` (needs `g`) gives matches + `.index`; render highlights from index+length. See edge cases. |
| **Flag toggles `g i m s u`** | Milestone-explicit; flags change everything | LOW | Toggles → rebuild `RegExp(pattern, flags)`. |
| **Capture-group breakdown per match** | "What did group 1 grab?" | MEDIUM | Each `matchAll` result is `[full, g1, g2, …]`; show per-match, per-group. |
| **Invalid-pattern error** | Paste-instant must explain bad regex | LOW | `new RegExp()` throws `SyntaxError` → surface message. |
| **Match count + positions** | Status-bar-worthy ("3 matches") | LOW | From `matchAll` length + `.index`. |

#### Differentiators (all explicitly in scope)

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Named capture groups** `(?<name>…)` | Modern, far more readable | LOW–MED | *Verified:* `match.groups` holds named captures. Show name alongside number. Cheap once numbered groups work. |
| **Live replace/substitution preview** with `$1` refs | regex101's killer feature | MEDIUM | `str.replace(re, tmpl)`. Supports `$1…$n`, `$<name>`, `$&` (whole match), `` $` ``/`$'` (before/after), `$$` (literal `$`). Needs `g` to replace all. *Verified.* |
| **Common-pattern library to insert** (email, URL, IPv4) | Speeds the 80% case; teaching aid | LOW | Tiny static `{label, pattern, flags}` array inserted into the pattern field. Keep minimal. |

#### Flag interaction notes (testable)

| Flag | Effect | Interaction to test |
|---|---|---|
| `g` | All matches, not just first | **Required** for `matchAll` to find all and `replace` to replace all. Without `g`: highlight/replace only the first. Make this explicit, not surprising. |
| `i` | Case-insensitive | Independent. |
| `m` | `^`/`$` per-line | Combine with multi-line test strings. |
| `s` | `.` matches newline (dotAll) | Independent. |
| `u` | Unicode mode | Enables `\u{…}`; **stricter** escapes — toggling `u` can turn a valid pattern into a `SyntaxError`. Test that surfacing. |

> A newer `v` (unicodeSets) flag exists in modern engines but is **not** in the chosen `g/i/m/s/u` set — exclude to hold scope. Likewise exclude `d` (indices) and `y` (sticky).

#### Minimal pattern library (recommendation)

`email`, `URL`, `IPv4` are milestone-named — **ship exactly those three first.** More (IPv6, UUID, hex color, ISO date) is trivial to add later but each "official" pattern invites bikeshedding/correctness complaints (email regex is famously contentious). Label them as "starting points," not authoritative.

#### Regex match-rendering edge cases (must specify)

- **Zero-width matches** (`a*`, lookaheads): `matchAll` can return empty-string matches; advance by 1 to avoid infinite loops; render as a caret/marker, not a span.
- **Overlapping highlights:** regex matches are non-overlapping (left-to-right scan), so whole-match highlighting is clean segmentation — but groups nest *within* a match. Recommend: highlight the whole match, **list** groups in a table (matches the "breakdown" framing; simpler than nested highlights).
- **`lastIndex` statefulness:** a `g`-flagged regex reused via `.exec()`/`.test()` carries `lastIndex` between calls → wrong results. *Verified.* Use **`matchAll`** (clones internally, no `lastIndex` mutation). Specify `matchAll`, not an `.exec()` loop.

#### Regex anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Regex *explainer*** (tokenize + explain in English) | regex101 has it | A whole sub-product; not the messy-bytes wedge | Out of scope. Match/group/replace is the wedge. |
| **Multiple flavors** (PCRE/Python/.NET) | "My pattern is PCRE" | Needs non-native engines = **new runtime deps** | JS `RegExp` only; state the flavor in UI so users aren't surprised. |
| **Cheat-sheet reference panel** | regex101 has a token ref | Static content bloat; not paste-instant value | Skip or a tiny footnote. Low priority. |
| **Save/share permalinks** | regex101 permalinks | Needs storage/network | No. (Could persist last pattern via the existing prefs store — minor, optional.) |
| **Match-history / step-debugger** | Power feature | Heavy; far past the wedge | No. |

> Regex is **medium complexity**, concentrated in match-highlight rendering + the zero-width/`lastIndex` edge cases. The matching/replace logic is thin (native `RegExp`); the work is presentation (highlight overlay, per-match group table, live replace pane).

---

### FEATURE 4 — PROTOBUF decimal-byte-array input (hero extension, NOT a new tool)

A **pre-decode input-parsing layer** feeding the existing frozen `decoder.ts`, alongside the current hex/base64 auto-detection. The decoder + its 19 tests are **untouched**.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **Parse comma/space-separated decimals** `10, 3, 80, 81, 82` → `Uint8Array` | The whole feature (user-requested at Phase-3 sign-off) | LOW | Split on commas and/or whitespace; tolerate mixed (`10,3 80, 81`). |
| **Tolerate flexible separators & whitespace** | Real paste is messy (newlines, double spaces, trailing comma) | LOW | Split on `/[\s,]+/`, drop empties, trim. |
| **Byte-range validation (0–255)** | A value >255 isn't a byte | LOW | Per-token: integer 0–255. Reject `256`, `-1`, `3.5`, `0x10`. |
| **Clear per-token error** | Which token is bad? | LOW | "Byte 6 (`300`) is out of range (0–255)." Point at the offending value. |
| **Auto-detect alongside hex/base64** | Milestone-explicit: no mode picker | MEDIUM | The detection-disambiguation problem (below) is the only non-trivial part. |

#### The auto-detection problem (the one thing to get right — testable)

Decimal-list input overlaps with other input formats:

- **Comma anywhere ⇒ decimal list** — commas are a near-unique signal (hex/base64 don't use them). Cleanest rule.
- Whitespace-only-separated digits are ambiguous with hex pairs; bias toward existing hex/base64 detection but provide a **manual override** to force decimal (consistent with the decoder's per-node override ethos).
- A multi-digit token >`ff`-as-hex-but-valid-decimal (e.g. `200`) also signals decimal.
- Recommendation: comma present ⇒ decimal; else fall through existing hex/base64 detection; always allow explicit override.

#### Decimal-input anti-features

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Accept `0x10` hex tokens in decimal mode** | "Be helpful" | Reintroduces the ambiguity decimal mode removes | Decimal mode = base-10 only; hex has its existing path. |
| **Accept >255 as multi-byte ints** | "Parse `300` as two bytes" | Endianness ambiguity, silent surprise | Hard error with a clear message. It's a byte array. |
| **Signed bytes (-128..127)** | Some languages print signed | Doubles validation surface, ambiguous with 0–255 | Out of scope; 0–255 only. Flag if requested later. |

---

## Feature Dependencies

```
Tool registry entry ──required by──> [Cron, URL, Regex] (sidebar/palette/router derive from it)
Platform seam (clipboard) ──required by──> copy affordances in all tools

CRON:
  field parser ──required by──> description generator
  field parser ──required by──> next-run iterator
  next-run iterator ──reuses──> Unix Time tool's local-time formatting
  macros + day/month names ──expand-to──> 5-field ──> (field parser)
  L / nL ──deepens──> next-run iterator (highest-risk math; isolate)

URL:
  native URL parse ──required by──> component split + param table
  native URLSearchParams ──required by──> param table (repeated keys, decode)
  encode/decode ──independent of──> parse (pure string transforms)

REGEX:
  RegExp compile ──required by──> matches, groups, replace preview
  matchAll ──required by──> all-matches + group breakdown (avoids lastIndex footgun)
  g flag ──required by──> replace-all + all-match highlight
  pattern library ──enhances──> pattern input (independent, trivial)

PROTOBUF DECIMAL:
  decimal parser ──feeds──> EXISTING frozen decoder.ts (do not modify)
  auto-detect heuristic ──gates──> which parser runs (decimal vs hex vs base64)
```

### Dependency Notes

- **Cron description and next-runs share one field parser** — build it once; both consumers read its normalized output. Don't parse twice.
- **Cron `L`/`nL` only affects the iterator**, not the parser much — isolate it so the rest of cron can ship even if `L` math is hard.
- **Regex `matchAll` is load-bearing** — it sidesteps the `lastIndex` statefulness bug; specify it rather than `.exec()` loops.
- **Decimal parser is strictly upstream of the decoder** — zero coupling into `decoder.ts`; it just produces the `Uint8Array` the decoder already accepts.

## MVP Definition

### Launch With (v1.3)

The milestone scope IS the launch scope (user chose fullest). Ruthless ordering within it:

- [ ] **URL tool** (full) — lowest complexity, pure view over native APIs; ship first.
- [ ] **Protobuf decimal input** — small, high-value hero extension; get the auto-detect heuristic right.
- [ ] **Regex tester** — medium; native `RegExp` + `matchAll`; work is in match-highlight presentation.
- [ ] **Cron core** (5+6-field, macros, names, ranges/steps/lists, `?`, DOM/DOW-OR, next-5, description) — the heavy one.
- [ ] **Cron `L`/`nL`** — own slice; highest-risk, deepest test cases.

### Add After Validation (if demand confirmed)

- [ ] Regex pattern library beyond the 3 named (IPv6, UUID, hex color, ISO date).
- [ ] URL per-row raw-vs-decoded toggle; valueless-key disambiguation polish.
- [ ] Cron: persist last expression; show resolved IANA TZ label.

### Future / Out of Scope (hold the wedge)

- [ ] Regex explainer, multi-flavor engines, permalinks.
- [ ] Cron `W`/`#`/year-field, cron generator UI, timezone selector.
- [ ] URL editable-recompose, shortener, IDN converter.
- [ ] Decimal: hex tokens, >255 multi-byte, signed bytes.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| URL component split + param table | HIGH | LOW | P1 |
| URL component-vs-full encode/decode | HIGH | LOW | P1 |
| Protobuf decimal parse + auto-detect | HIGH | LOW–MED | P1 |
| Regex matches + groups + flags | HIGH | MED | P1 |
| Regex live replace preview | HIGH | MED | P1 |
| Regex named groups | MED | LOW | P1 |
| Regex pattern library (3 patterns) | MED | LOW | P1 |
| Cron 5-field parse + description | HIGH | MED–HIGH | P1 |
| Cron next-5 runs (local time) | HIGH | MED–HIGH | P1 |
| Cron 6-field + macros + day/month names | HIGH | LOW–MED | P1 |
| Cron DOM/DOW OR semantics | HIGH (correctness) | MED | P1 |
| Cron `L`/`nL` last-day/last-weekday | MED | HIGH | P2 (own slice) |
| Cron `W` / `#` (parse-tolerant, no compute) | LOW | LOW | P3 |

**Priority key:** P1 = must have this milestone · P2 = in scope, isolate as a risky slice · P3 = tolerate-don't-interpret.

## Competitor Feature Analysis

| Feature | crontab.guru | regex101 | Our Approach |
|---|---|---|---|
| Cron seconds (6-field) | ✗ omits | — | ✓ auto-detect by field count |
| Cron macros / `@reboot` | partial | — | ✓ full alias table; `@reboot` = no run list |
| Cron `L`/`W`/`#` | ✗ | — | `L`/`nL` ✓ compute; `W`/`#` tolerate-only |
| Cron next-runs list | ✓ a few | — | ✓ next **5**, local time (Unix Time convention) |
| Regex named groups | — | ✓ | ✓ via `match.groups` |
| Regex replace preview | — | ✓ | ✓ `$1`/`$<name>`/`$&` |
| Regex explainer | — | ✓ | ✗ anti-feature (scope) |
| Regex multi-flavor | — | ✓ | ✗ ECMAScript only (zero-dep) |
| URL param table w/ repeated keys | various | — | ✓ `URLSearchParams`, duplicates preserved |
| Offline / no network | ✗ web | ✗ web | ✓ **the differentiator** — all four 100% offline native-API |

## Sources

- crontab.guru — examples, tips, crontab.5 manpage (field syntax, macros, what it deliberately omits): https://crontab.guru/ , https://crontab.guru/tips.html , https://crontab.guru/crontab.5.html — HIGH
- Healthchecks.io cron cheatsheet (field ranges, special chars, macro-support matrix): https://healthchecks.io/docs/cron/ — HIGH
- Cron DOM/DOW OR-combination + 0/7 Sunday (Debian bug thread, inngest issue): https://groups.google.com/g/linux.debian.bugs.dist/c/LM4Rqrf9oQM , https://github.com/inngest/inngest/issues/2631 — HIGH (multiple independent sources agree)
- MDN — `RegExp`, `String.prototype.matchAll`, `String.prototype.replace`, Groups/backreferences (named groups, `$1`/`$<name>`/`$&`, `lastIndex` statefulness, flag effects): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp , https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/matchAll , https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace — HIGH
- MDN — `URL` / `URLSearchParams` (component access, repeated-key iteration, decode-on-read) [standard WebView APIs, training-verified] — HIGH
- DevTools `.planning/PROJECT.md` (registry, StatusBar opt-in byteCount, FormatterView, platform seam, Unix Time local-time convention, zero-dep constraint, frozen decoder) — HIGH

---
*Feature research for: DevTools v1.3 "More Tools" — Cron, URL, Regex tools + Protobuf decimal-byte input*
*Researched: 2026-06-03*
