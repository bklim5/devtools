# DevTools

## What This Is

DevTools is a fast, offline, keyboard-driven **desktop application** (macOS first; cross-platform-capable via Tauri 2) of engineering utilities for the messy bytes developers actually see at work. **Schema-less Protobuf decoding is the hero feature**, supported by a tight, curated set of high-frequency transforms (six at v1.0; the JSON + XML formatters added in v1.1). It is a sharp wedge, not a catalogue — it wins on speed and confidence, not breadth, and every new tool must clear the product wedge before it ships.

## Core Value

**Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse.** If everything else fails, the Protobuf decoder doing this flawlessly is the product.

## Current State

**Shipped & archived: v1.4 "Reorderable Tools"** (2026-06-05) — Phase 16, on top of v1.3 "More Tools" (Phases 12–15, 2026-06-04), v1.2 "Release Tooling" (Phases 9–11, 2026-06-03), v1.1 "Formatters" (Phases 7–8, 2026-06-02), and v1.0 "Distribution" (Phases 1–6, 2026-06-01).

v1.4 is the first milestone to add a **personalization** capability rather than a tool: a user-reorderable sidebar tool list. The custom order is a persisted `toolOrder: string[]` overlay applied over `ENABLED_TOOLS` at render time — the registry array stays the single control plane (the ⌘K palette and router remain order-agnostic). Reorder by handle-initiated native HTML5 drag (no dnd library) or by an accessible Alt+↑/↓ keyboard path with `aria-live` announcements; the order is reconciled against the live registry on load (new tools append, unknown/removed IDs drop, duplicates collapse — never a crash/drop/duplicate) and a keyboard-reachable "Reset order" restores the default. All 7 REORD requirements validated on the real WKWebView; full suite 668/668, decoder 19/19 untouched, zero new runtime/dev deps, gsd-ui-review WCAG-AA 22/24. Archives: `.planning/milestones/v1.4-ROADMAP.md`, `.planning/milestones/v1.4-REQUIREMENTS.md`.

The app still ships **eleven tools** (v1.4 added no tools): the Protobuf hero (with decimal input), Base64/Hex/Bytes, Unix Time, JWT, Hash, UUID/ULID, the JSON + XML formatters, and URL, Regex, and Cron — now in a user-defined sidebar order.

**No active milestone.** Next: start the next milestone (`/gsd-new-milestone`) or promote a backlog item (`/gsd-review-backlog`). Remaining backlog parked: 999.1 tool wishlist (SQL/Date/JSON↔YAML/Number Base/comparers), 999.2 CI track, 999.3 theme settings, 999.4 DevTools CLI, 999.5 Protobuf schema-file. **Pinning** (locking the hero to top / pinning favourites) and a **dedicated settings surface** are carried forward as future features split out of v1.4.

## Shipped Milestone: v1.4 Reorderable Tools (Phase 16, 2026-06-05)

**Delivered:** the app's first personalization feature — a user-reorderable sidebar tool list (REORD-01..07), zero new runtime/dev deps:

- **Persistence + pure backbone (Phase 16-01, REORD-05/06/07)** — an additive `toolOrder: string[]` Preferences field through the existing prefs seam (`coerceToolOrder` untrusted-merge, `setToolOrder` write-on-change), plus pure fully-tested `reconcileToolOrder` (D-11 render overlay — output always a registry permutation: append-new, drop-unknown, de-dupe) and `moveToolInOrder` (clamped relocate, shared by drag + Alt-arrow).
- **Reorderable Sidebar UI (Phase 16-02, REORD-01..07)** — `Sidebar.tsx` renders the reconciled overlay over `ENABLED_TOOLS` (registry/⌘K/router untouched); a `GripVertical` handle (hover + `focus-visible`) is the only `draggable` element so a plain click still navigates; neutral (`tx-2`, non-accent) insertion line + end-of-list drop zone; Alt+↑/↓ keyboard reorder with focus retention (plain arrows unbound — no roving nav); `aria-live="polite"` "Moved {tool} to position N of M"; keyboard-reachable Shift+F10 "Reset order" → `setToolOrder([])`.

**Proven:** verification 11/11 must-haves; full suite **668/668** (decoder **19/19** untouched); real-WKWebView e2e 14/14; code review 0 critical; security 8/8 STRIDE; **gsd-ui-review WCAG-AA 22/24** (all findings fixed); human-signed-off on a fresh `tauri build`. **Post-ship fix (`1c2c7664`):** set Tauri `dragDropEnabled:false` so the OS file-drop handler stops intercepting the webview's HTML5 drag (the gate's e2e couldn't synthesize native drag, so the pointer path rode the manual walkthrough). Full detail: `.planning/milestones/v1.4-ROADMAP.md`.

## Shipped Milestone: v1.3 More Tools (Phases 12–15, 2026-06-04)

**Delivered:** three new high-frequency tools + a Protobuf input mode, eight tools → eleven, each clearing the product wedge with zero new runtime deps:
- **Protobuf decimal input (Phase 12, PRO-08/09)** — `10, 3, 80, 81, 82` accepted as a third auto-detected input mode; pure `decimalToBytes` + comma-first `detectEncoding` in `src/lib/bytes.ts`, decoder untouched.
- **URL tool (Phase 13, URL-01..05)** — thin error-as-value view over native `URL`/`URLSearchParams`/`encodeURI(Component)`: parsed-component readout + decoded query key→value table + component-vs-full encode/decode. Extracted the shared `SegmentedControl` reused by 14/15.
- **Regex tester (Phase 14, RGX-01..07)** — live highlighted matches (escaped React nodes), capture-group breakdown, g/i/m/s/u flags, `$1`/`$<name>`/`$&` replace preview, 3-pattern library. **Structural ReDoS safety:** off-thread Web Worker + watchdog armed before construction.
- **Cron tool (Phase 15, CRON-01..11)** — paste → 24-hour description + next 5 runs in local time with IANA TZ label; full grammar, macros + `@reboot`, DOM/DOW OR-union, DST-correct wall-clock next-run, bounded "never", leap-aware `L`/`nL`/`L-n`. Hand-rolled (no `cron-parser` lib).

**Proven:** every phase verified + UI-signed-off on the real WKWebView (Cron 26/26 must-haves, gsd-ui-review 23/24 WCAG-AA); full suite 650/650 at close. **Immovable bar held across all four:** `decoder.ts` + its 19 tests byte-for-byte untouched; zero new runtime AND zero new devDependencies. Full detail: `.planning/milestones/v1.3-ROADMAP.md`.

**Prior milestone — v1.2 Release Tooling (Phases 9–11, 2026-06-03):** `pnpm release:bump` + `pnpm release:publish` over a unit-tested pure release core (`src/lib/release/`); lockstep multi-manifest bump/tag/push + universal-binary dual-key signature-verified cross-repo publish. Proven live (v0.2.2 + DST-02 updater round-trip). All 12 REL requirements. Full detail: `.planning/milestones/v1.2-ROADMAP.md`.

**Parked / carried forward:** CI track (push/PR checks, tag-triggered CI release, cross-repo PAT + minisign secrets) — backlog 999.2; remaining tool wishlist (SQL/Date/JSON↔YAML/Number Base, comparers) — backlog 999.1. Non-blocking: FormatterView narrow-width vertical stacking (UX-05); NAT-01 configurable global summon hotkey; Gatekeeper-clean notarisation pending Apple enrolment (D-02); Cron MD-01 next-run perf / LO-02 phrasing / LO-03 locale (advisory, deferred in `15-REVIEW-FIX.md`).

## Requirements

### Validated

- **Foundation & harness (Phase 1)** — Tauri 2 + Vite + React + TS dark-window app from one repo; `src/lib/` ported unchanged (19 decoder tests green); `src/lib/platform/` seam; the full build+verify harness proven end-to-end on a walking skeleton + macOS real-WKWebView automation (`scripts/e2e-spike.sh`).
- **Shell (Phase 2)** — registry-driven sidebar + ⌘K palette (fuzzy, recents); registry as single control plane; preferences persistence (theme/accent/last-used/recents; window geometry → Phase 5); opens-to-last-used/hero, no picker.
- **Hero + Encoding + UX (Phase 3)** — the schema-less **Protobuf decoder** (paste→instant wire-format tree, LenInterpretation chips + per-node override, VARINT readings, resizable panes, cards/rows toggle, neutral `#N`, copy + copy-all-as-JSON) and **Base64/Hex/Bytes** (three-pane derive, base64/base64url, explicit errors). Binding UX constraints (paste-instant, visible focusable copy, status bar, WCAG-AA, layout-agnostic) validated across both tools — verified on the real WKWebView + a passing gsd-ui-review.
- **Distribution (Phase 6, DST-01/DST-02)** — packaged macOS app + signature-verified auto-updater. `tauri.conf.json` emits the DMG + updater artifacts (`createUpdaterArtifacts`, ad-hoc hardened-runtime signing wired-but-gated for a credentials-only Developer-ID flip per D-02); the updater UX (opt-in, dismissible WCAG-AA banner, tray check) runs entirely over the `platform.updater` seam with mandatory minisign verify. Proven by a real **0.2.0 → 0.2.1 round-trip** (verified signature → relaunch) against a **split-repo** release layout — private source (`bklim5/devtools`), public artifacts (`bklim5/devtools-releases`). gsd-ui-review 23/24, WCAG-AA PASS. **Gatekeeper-clean notarisation deferred to post-Apple-enrolment (D-02).**
- **Formatters (Phase 7, FMT-01..08)** — JSON + XML formatter tools behind a shared two-pane paste-instant `FormatterView`, zero new runtime dependencies (native `JSON` / `DOMParser` / `XMLSerializer`). JSON: validate (line:col), prettify 2/4/tab, minify (wins over prettify), recursive sort-keys (array order preserved). XML: validate well-formedness (parsererror surfaced with line; WebKit boilerplate stripped), prettify preserving comments/CDATA/attributes/PIs + the `<?xml?>` declaration, minify. Pure transforms in `src/lib/format/`; both tools registered registry-only (single control plane); visible focusable copy via the platform seam (no hover-only). Verified on the real WKWebView (10/10 e2e), WCAG-AA PASS (18/24), human-signed-off on the `tauri build`. Decoder + its 19 tests untouched. **Carry-forward (non-blocking polish):** FormatterView narrow-width vertical stacking (UX-05) — not a WCAG-AA blocker.
- **StatusBar size-readout cleanup (Phase 8, UIX-01)** — the shared `StatusBar` `byteCount` prop is now optional and the `aria-label="byte count"` size span renders only when a caller passes a number (`typeof byteCount === "number"` guard; no discriminated type, no other StatusBar behavior changed). Kept on Base64/Hex/Bytes + the Protobuf decoder + both Formatters (single count or `in → out` delta); dropped from Hash / UUID·ULID / Unix Time / JWT (parse-state label + error/timing only). Locked by a present-where-kept / absent-where-dropped test matrix querying the stable `aria-label` span (not text). Code review clean, verification 4/4 must-haves, real-WKWebView + WCAG-AA + `tauri build` human-signed-off. Zero new deps; decoder + its 19 tests untouched. **→ Milestone v1.1 "Formatters" fully delivered (Phases 7 + 8).**
- **Release Tooling (Phases 9–11, REL-01..12)** — the manual `docs/RELEASE.md` dance replaced by `pnpm release:bump` + `pnpm release:publish` over a unit-tested pure core in `src/lib/release/` (`version.ts`, `manifest.ts`, `bumpPlan.ts`, `publishPlan.ts`) with thin `.mjs` I/O shells. Lockstep 3-manifest semver bump + lockfile regen + annotated `vX.Y.Z` tag/push to private origin (REL-01/03/04); universal (Intel + Apple Silicon) `tauri build` + `lipo` both-arch assert (REL-05), fresh-`.sig` dual-key `latest.json` generate-only/untracked (REL-06/08), cross-repo `gh` publish to `bklim5/devtools-releases` assets-first/manifest-last (REL-07), `APPLE_*` honored/ad-hoc default (REL-09), post-publish `curl` served-version verify (REL-12), `--dry-run` (REL-10) + fail-fast preflights (REL-11) on both scripts. **Proven live:** real v0.2.2 published + an older install auto-updated through the mandatory minisign verify against the pinned pubkey (DST-02) on Apple Silicon, Intel by-construction. Milestone audit passed (12/12 req, integration clean); Phase 11 threat-secured (16/16). Two live-run bugs fixed (TDD): `main().catch()` false exit-1, 8000% updater-progress display. Zero new runtime deps; decoder + its 19 tests untouched. **→ Milestone v1.2 "Release Tooling" fully delivered (Phases 9–11).** CI track parked (backlog 999.2).
- **Protobuf decimal input (Phase 12, PRO-08/PRO-09)** — the Protobuf hero accepts a comma/space-separated decimal byte array (e.g. `10, 3, 80, 81, 82`) as a third auto-detected input mode beside hex/base64. Pure parse layer `decimalToBytes` in `src/lib/bytes.ts` (strict surface: commas+spaces only, no bracket-strip, empty/doubled/trailing-comma tokens error, integers 0–255, named-token errors, ReDoS-safe anchored `/^\d+$/`); `detectEncoding` routes comma-anywhere to `decimal` FIRST (space-only does NOT auto-detect, D-03); three-way decode switch in `useDecode.ts`. UI reuses the already-AA-audited active-segment-is-readout toggle (third `decimal` segment, `aria-pressed`, click-active clears override), a `decimal bytes` example chip (EXAMPLES `hex`→`value` refactor), and decimal-aware placeholder; invalid tokens surface a named `role=alert` error, never a base64 fallback or crash. Verified 6/6 must-haves; full suite 522/522 + `tsc` clean; gsd-ui-review 24/24 WCAG-AA PASS; real-WKWebView e2e + `tauri build` human-signed-off. **Immovable bar held: `decoder.ts` + its 19 tests byte-for-byte untouched.** First phase of Milestone v1.3 "More Tools" (Phases 12–15).
- **URL tool (Phase 13, URL-01..05)** — the 9th tool: a thin view over native `URL`/`URLSearchParams`/`encodeURI(Component)`, error-as-value throughout. Pure logic in `src/lib/url.ts` (`parseUrl` → 9 mapped fields + ordered decoded query rows preserving repeated keys/empty values; `encodeComponent`/`decodeComponent`/`encodeFull`/`decodeFull`, each catching `%zz`/lone-surrogate/relative-URL into `{error}`, never throwing). One registered view (`src/tools/url/`) with two modes behind a top-level `SegmentedControl` (Parse default): Parse = up to 9 copyable readout rows + a from-scratch decoded query key→value table; Encode/Decode = live both-directions panes under a `component|full` scope toggle (**defaults to `full` per user sign-off**) with a mode-aware caption. Extracted the shared accent-on-active `SegmentedControl` out of FormatterView's idiom (D-16, reused by Phases 14/15). Verified 5/5 success criteria; full suite 550/550 + `tsc`/eslint clean; code review 0 critical/0 warning; gsd-ui-review 24/24 WCAG-AA PASS; real-WKWebView e2e 11/11 + human sign-off. Zero new runtime deps; `decoder.ts` + its 19 tests byte-for-byte untouched.
- **Regex tester (Phase 14, RGX-01..07)** — the 10th tool: a user pattern run against sample text with live highlighted matches, numbered+named capture-group breakdown, g/i/m/s/u flag toggles, `$1`/`$<name>`/`$&` replace preview, and an Email/URL/IPv4 common-pattern library. Pure logic in `src/lib/regex/regex.ts` (`buildRegex`/`enumerate` via native `matchAll`/`applyReplace`/`runRegex` + `COMMON_PATTERNS`, error-as-value). **ReDoS safety is structural:** matching runs off-thread in a Vite same-origin module Worker (`src/lib/regex/worker.ts`) behind a timeout watchdog *armed before worker construction* — a catastrophic-backtracking pattern can never freeze the window; on timeout the user sees "Pattern timed out" and the UI stays responsive (proven at the unit layer, since WebKit/JSC caps backtracking and defuses textbook ReDoS — user-accepted). Highlighting is escaped React nodes, never `dangerouslySetInnerHTML`. One registered view (`src/tools/regex/`, 11th `TOOLS` entry). **Plan restructure (user Rule-4 merge):** the standalone 14-01 TDD RED wave merged into 02/03 (the lefthook hook rejects failing commits) — tests shipped GREEN with their code. **Notable fix (3 human-review rounds):** the highlight overlay drifted from the textarea because macOS "always show scrollbars" gave the textarea a layout-width scrollbar so the two layers wrapped differently — fixed with a zero-width-scrollbar so widths match on every machine, locked by a non-vacuous `clientWidth`/`scrollHeight` invariant e2e. Verified 6/6 must-haves (7/7 RGX); full suite 581/581 + `tsc`/eslint clean; code review `medium` (0 crit/high, 2 med + 3 low advisory — `/gsd-code-review-fix 14`); real-WKWebView e2e 12/12 + human sign-off. Zero new runtime deps; `decoder.ts` + its 19 tests byte-for-byte untouched.
- **Cron tool (Phase 15, CRON-01..11)** — the 11th tool: paste a cron expression → a plain 24-hour-English description + the next 5 run times in local time with an IANA timezone label. Pure, total, error-as-value core in `src/lib/cron/cron.ts` (`analyzeCron` + `CronResult`/`CronFields`/`CronRun` + a hand-rolled `describe`, no `cron-parser` lib): full field grammar (wildcards/ranges/steps incl. `0-30/10` step-from-base/lists/`MON`/`JAN` names), 5-vs-6-field disambiguation, `@macro`s + the `@reboot` run-at-startup sentinel (no clock computation), and the `W`/`#`/`LW` unsupported-token reject. **Four correctness traps handled:** DOM/DOW OR-union (both restricted ⇒ match either) with 0/7-Sunday; **DST-correct next-run by wall-clock component read-back via `Intl.DateTimeFormat.formatToParts`, never ms-deltas** (spring-forward skipped, fall-back de-duped); a bounded `CANDIDATE_DAY_CAP` (5×366) so impossible expressions (Feb-30) terminate as a calm `kind:"never"` "no upcoming runs", never freezing the window; and full leap-aware `L`/`nL`/`L-n` last-day/last-weekday support (`Date.UTC(y,mo,0)` month-length idiom) shipped as an explicitly isolated final plan with dedicated leap-year fixtures. ReDoS-safe (only fixed `/^\d+$/` literals, no `eval`/`Function`/user-built `RegExp`). One thin paste-instant `useMemo` view (`src/tools/cron/`, registered registry-only) with neutral `@reboot`/never states, `role=alert` errors, visible focusable copy via the platform seam. Verified 26/26 must-haves (11/11 CRON); full suite 648/648 + `tsc`/eslint clean; code review `clean` (0 crit/high, 2 med + 4 low advisory); real-WKWebView e2e 13/13 + human sign-off; gsd-ui-review 23/24 WCAG-AA PASS. Zero new runtime deps; `decoder.ts` + its 19 tests byte-for-byte untouched.
- **Reorderable sidebar tool list (Phase 16, REORD-01..07)** — the app's first *personalization* feature (v1.4 "Reorderable Tools", single phase). The user reorders the sidebar by handle-initiated native HTML5 drag (no dnd library; only the `GripVertical` handle is `draggable`, so a plain `NavLink` click still navigates) or by an accessible Alt+↑/↓ keyboard path (one slot/press, moved item keeps focus, plain arrows stay unbound — no roving nav), every move announced via an `aria-live="polite"` "Moved {tool} to position N of M" region. The order is a persisted `toolOrder: string[]` overlay applied at render time over `ENABLED_TOOLS` (registry array, ⌘K palette, and router never mutated — ordering is presentation, not a registry change), through the existing `usePreferences`/`platform.store` seam beside `recentToolIds`. Pure tested backbone: `reconcileToolOrder` (always a registry permutation — append-new, drop-unknown, de-dupe; untrusted-blob safe) + `moveToolInOrder` (clamped relocate). A neutral (`tx-2`, non-accent) insertion line + end-of-list drop zone show the drop position; a keyboard-reachable Shift+F10 "Reset order" restores the default. Verified 11/11 must-haves; full suite 668/668 (decoder 19/19 untouched); real-WKWebView e2e 14/14; code review 0 critical; security 8/8 STRIDE; gsd-ui-review WCAG-AA 22/24 (findings fixed); human-signed-off on a fresh `tauri build`. Zero new runtime AND dev deps. **Post-ship:** Tauri `dragDropEnabled:false` so the OS file-drop handler stops swallowing the in-page HTML5 drag. **→ Milestone v1.4 "Reorderable Tools" fully delivered (Phase 16).**

### Active

<!-- All hypotheses until shipped and validated. Grouped; REQ-IDs assigned in REQUIREMENTS.md. -->

**Foundation & harness** — ✓ validated Phase 1
- [x] Tauri 2 + Vite + React + TS app builds and renders a dark window on macOS from one repo
- [x] Verified `src/lib/` (decoder, bytes, tool types) ported unchanged; **19 decoder vitest cases pass**
- [x] **Walking-skeleton phase that proves the full build+verify harness end-to-end before any product feature** (codex review → unit tests → real-webview UI verification, plus phase-boundary sign-off)
- [x] `src/lib/platform/` capability seam (clipboard/store/shortcuts) so tools never import `@tauri-apps/*` directly

**Shell** — ✓ validated Phase 2
- [x] Sidebar (compact mode) generated from the tool registry
- [x] ⌘K command palette (tool-switcher; fuzzy match over name+keywords+description; recent-tool memory)
- [x] Registry as the single control plane (sidebar, palette, router all derive from it)
- [x] Preferences persistence (theme, last-used tool, tree-style toggle) — window geometry deferred to Phase 5
- [x] Opens to last-used or summoned tool (no "pick a tool" friction)

**Tools (hero first)**
- [x] Protobuf Decoder (hero): schema-less wire-format tree, all viable LEN interpretations surfaced from `LenInterpretation`, resizable panes, packed-repeated UI, status bar, **cards default with rows/cards toggle** — ✓ Phase 3
- [x] Base64 / Hex / Bytes with feature-detect polyfill (`Uint8Array.toBase64`/`fromBase64`/`toHex`/`fromHex`) — ✓ Phase 3
- [x] Unix Time Converter — ✓ Phase 4 (v1.0)
- [x] JWT Debugger — ✓ Phase 4 (v1.0)
- [x] Hash Generator (Web Crypto SHA family + small MD5 lib) — ✓ Phase 4 (v1.0)
- [x] UUID / ULID Generator + Decoder — ✓ Phase 4 (v1.0)
- [x] JSON formatter (validate line:col / prettify 2·4·tab / minify / sort-keys; native `JSON`, zero-dep) — ✓ Phase 7 (v1.1)
- [x] XML formatter (validate well-formedness / prettify preserving comments·CDATA·attrs·PIs / minify; native `DOMParser`, zero-dep) — ✓ Phase 7 (v1.1)

**Workflow constraints (binding — apply to every tool)** — ✓ validated Phase 3 (both tools)
- [x] Paste-transforms-instantly (no decode button for the common case)
- [x] Copy-result-instantly via visible, focusable affordance (≤1 keystroke; no hover-only copy)
- [x] Status bar: parse state · byte count · current encoding · errors · timing
- [x] WCAG AA accessibility across the board (visible focus, AA contrast, no opacity-only disabled state)

**Ideas / backlog (not yet scheduled)**
- [ ] Protobuf decoder: decimal-byte-array (JS `Uint8Array`) input mode — paste `10, 3, 80, 81, 82` and decode, alongside hex/base64 (user feedback at Phase-3 sign-off, 2026-05-31)

**Native polish & distribution (macOS)**
- [ ] Global shortcut to summon, tray/menu, single-instance
- [ ] Code signing + notarisation (macOS), DMG, auto-updater

### Out of Scope

- **Remaining deferred tools** (SQL formatter, Date converter, JSON↔YAML, Number Base, JSON→CSV, diff/comparers, JSONPath, QR, GZIP, etc.) — commodities that would dilute the product wedge. Deferred, not promised. (JSON/XML formatters shipped v1.1; URL, Regex, Cron shipped v1.3 — each cleared the wedge before shipping.)
- **Cloud sync / accounts / payments** — offline by design; a `premium` registry seam is reserved with **zero v1 UX**.
- **Mobile (iOS/Android) UI** — architecture stays open (layout-agnostic tools, responsive Tailwind) but no v1 mobile UI.
- **Windows + Linux verification/packaging (for now)** — deferred to focus on macOS; Tauri keeps them reachable later.
- **Plugin marketplace / third-party tool loading**, **SSR/server runtime** — not the product.
- **Schema-aware Protobuf (`.proto` imports)** — future paid candidate; v1 is schema-less only.

## Context

- **Current state: Milestone v1.4 "Reorderable Tools" SHIPPED & ARCHIVED** (2026-06-05 — Phase 16 delivered and archived to `.planning/milestones/v1.4-*`; tag `v1.4` local-only). First personalization feature: a user-reorderable sidebar (`toolOrder` overlay over the registry, native drag + Alt+↑/↓ keyboard + `aria-live`, persisted/reconciled/reset) — all 7 REORD requirements validated on the real WKWebView, zero new runtime/dev deps, `decoder.ts` + its 19 tests byte-for-byte untouched. Prior: v1.3 "More Tools" (Phases 12–15, 2026-06-04, eight tools → eleven, tag `v1.3`); v1.2 "Release Tooling" (Phases 9–11, 2026-06-03, live-proven v0.2.2 + DST-02); v1.1 "Formatters" (Phases 7–8, 2026-06-02, tagged `v1.1`); v1.0 "Distribution" (Phases 1–6, 2026-06-01). **Next: start the next milestone (`/gsd-new-milestone`) or promote a backlog item (`/gsd-review-backlog`).** **Carry-forwards (not blockers):** Pinning + a dedicated settings surface (split out of v1.4); CI track parked (backlog 999.2); remaining tool wishlist (backlog 999.1 — SQL/Date/JSON↔YAML/Number Base/comparers); theme settings (999.3); DevTools CLI (999.4); Protobuf schema-file (999.5); FormatterView narrow-width vertical stacking (UX-05, polish); Gatekeeper-clean notarisation pending Apple Developer enrolment (D-02); NAT-01 (G-05-1) parked; Cron advisory follow-ups (MD-01 next-run perf, LO-02/LO-03 copy/locale — `15-REVIEW-FIX.md`); 3 minor updater a11y follow-ups.
- **Post-design, pre-implementation handoff.** Full spec in `docs/design-and-plan.md`; harness + locked decisions in `docs/harness-and-decisions.md`; original agent brief preserved in `docs/handoff-instructions.md`.
- **Verified assets exist:** `scaffold/src/lib/` (decoder.ts ~295 lines zero-deps + 19 tests, bytes.ts, tool types/registry) — port unchanged. `design/DevTools Mockup.html` is the canonical visual system (CSS vars, IBM Plex Sans + JetBrains Mono). React components in `scaffold/` are structure-reference only — rebuild the visual layer against `design/`.
- **macOS WKWebView automation gap:** official `tauri-driver` supports only Linux/Windows. Community W3C WebDriver plugins for macOS exist (early 2026, 0.1.x). Phase 0 spikes one; fallback is `screencapture` + `chrome-devtools-mcp` against the identical static bundle.
- **Codex CLI + `/codex:review` are installed** and used as the first per-task gate.

## Constraints

- **Tech stack**: Tauri 2 + Vite + React + TypeScript + Tailwind; `react-router` **HashRouter only** (`BrowserRouter` forbidden — static files 404 on reload). Tool logic is pure frontend TS; Rust core is thin (clipboard, hotkey, tray, single-instance, auto-update).
- **No network at runtime** — self-host fonts (IBM Plex Sans + JetBrains Mono, SIL OFL, vendored), no CDN, no accounts, no setup.
- **Curated tool set, wedge-gated** — v1.0 locked "six tools only"; v1.1 deliberately reopened that to add the JSON + XML formatters (now eight tools). Growth is mechanical (registry is a plain array) but each new tool must clear the product wedge (offline, paste-instant, keyboard-driven, registry-driven, WCAG-AA, zero new runtime deps). No grab-bag additions.
- **Zero new runtime dependencies** — every tool so far is built on native browser/Web APIs (`JSON`, `DOMParser`, Web Crypto, `Uint8Array` base64/hex); the only runtime dep is `js-md5`. Hold this line.
- **Do not refactor `decoder.ts` or its 19 tests** without explicit approval — the test bar is the hero feature's spec.
- **Performance**: paste-to-interpretation < 2s; the app should feel instant (OS webview, small binary).
- **Verification (binding harness)**: every task's Definition of Done = **`/codex:review` → unit tests green (`vitest` + `tsc`) → real-webview UI verification**, in that order. Every phase ends with a **human sign-off** on a `tauri build` + `gsd-ui-review` audit. **Parallelize plans, but never let a plan advance past these gates — no skipping ahead.**
- **Platform (current)**: macOS only for build/verify; Windows + Linux deferred.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Verify against the **built Tauri app**, not a Chrome proxy | Desktop is the product's core positioning | ✓ Good — real-WKWebView e2e caught regressions unit tests missed (v1.1: `<parsererror>` newline concat) |
| Per-task gate order **review → unit → ui**; human sign-off per phase | User's explicit verification discipline for a desktop app | ✓ Good — held through 8 phases; code review caught real bugs each milestone |
| Dedicated **walking-skeleton phase** proves the harness before any feature | De-risk the whole pipeline first; macOS webview automation is unproven | ✓ Good — every later phase built on a de-risked pipeline |
| Protobuf tree **`cards` default + rows/cards toggle** (overrides handoff `tree: rows`) | User preference; build switchable format from the start | ✓ Good |
| WCAG **AA across the board** | Fits keyboard-driven positioning; audited each phase | ✓ Good — every phase passed `gsd-ui-review` WCAG-AA |
| **macOS only** for now (Windows/Linux deferred) | No Windows machine; focus the v1 path | ✓ Good (still macOS-only at v1.1) |
| Add `src/lib/platform/` capability seam | Single mock point for tests + cheap mobile/web door | ✓ Good — formatters' copy + every tool route through it; no `@tauri-apps` in shell |
| Self-host IBM Plex Sans + JetBrains Mono (SIL OFL) | "No network" constraint; licenses allow desktop redistribution | ✓ Good |
| Hand-rolled decoder over `protobufjs` | The product *is* the schema-less heuristics + ambiguity UI | ✓ Good (19 tests pass; untouched through v1.1) |
| **Zero new runtime deps for formatters** — native `JSON`/`DOMParser`/`XMLSerializer` (v1.1) | The zero-dep ethos is part of the wedge; avoids supply-chain + bundle bloat | ✓ Good — both formatters shipped with no new deps |
| **Shared two-pane `FormatterView`** reused by JSON + XML; pure logic in `src/lib/format/` (v1.1) | One layout, no duplication; pure logic keeps GUI thin + a future CLI reachable | ✓ Good |
| **`StatusBar.byteCount` opt-in** via optional prop + type guard, no discriminated type (v1.1) | Minimal additive API; keep/drop decided against real callers (Phase 8 after 7) | ✓ Good |
| **Reopen "six tools only"** to add JSON + XML formatters (v1.1) | Highest-value adjacent tools; wedge still gates additions | ✓ Good — eight tools, wedge intact |
| **Pure decision core + thin `.mjs` I/O shell** for release scripts (v1.2) | Every decision/assertion/string unit-testable with zero I/O; drivers only do fs/subprocess/network | ✓ Good — `publishPlan.ts`/`bumpPlan.ts` fully TDD'd; live bugs were isolated to the untested shell |
| **Universal `tauri build` (Intel + Apple Silicon)** served via dual-key `latest.json` (v1.2) | Close the local arm64-only gap; one artifact, byte-identical signature under both keys | ✓ Good — live round-trip on arm64, Intel by-construction |
| **`latest.json` generate-only, never committed** (v1.2) | A stale tracked manifest is the classic broken-update footgun | ✓ Good — REL-08; `git ls-files latest.json` empty, gitignored |
| **Secrets inherited-env only**, boolean-only presence checks, `execFileSync` argv arrays (v1.2) | A signing key in an argv/log is a disclosure; string commands are an injection surface | ✓ Good — threat-secured 16/16, 0 secret-leak paths |
| **Split-repo publish** to public `bklim5/devtools-releases` (never private `origin`) (v1.2) | The updater polls the public repo; unauthenticated clients must fetch | ✓ Good — REL-07, confirmed live |
| **CI deliberately parked** to backlog 999.2; ship local helper scripts first (v1.2) | Local reproducible release is the immediate need; CI adds cross-repo PAT + secrets complexity | — Pending — revisit as a follow-on milestone |
| **Notarisation stays deferred** (ad-hoc default; `APPLE_*` honored if present) (v1.2, carries D-02) | No Apple Developer enrolment yet; keep it a credentials-only flip | — Pending — credentials-only activation when enrolled |
| **Release-only remote: GSD milestone tags (`v1.x`) stay LOCAL; only app-release tags (`v0.2.x`) push to origin** (v1.2) | Two tag series on one remote read as confusing; the app-release series is the only one that maps to a shipped binary the updater serves | ✓ Good — 2026-06-03 deleted `v1.0`/`v1.1` from origin (kept local); origin now shows only `v0.2.x` |
| **Tool ordering is a render-time presentation overlay, never a registry mutation** (v1.4) | The registry is the single control plane (sidebar/palette/router derive from it); personalization must not fork that source of truth | ✓ Good — `reconcileToolOrder` overlay; ⌘K palette + router untouched; the list can't crash/drop/duplicate a tool |
| **Reorder keyboard path = Alt+↑/↓ only, no roving arrow-nav** (v1.4) | WCAG-AA needs a keyboard reorder, but introducing roving navigation would change the existing Tab-focus-only sidebar model | ✓ Good — plain arrows stay unbound; moved item keeps focus; each move `aria-live`-announced |
| **Persist `toolOrder` via the existing prefs seam with a dedicated coercer** (v1.4) | Reuse the `recentToolIds` mechanism, but `toolOrder` has no length cap, so a shared `normalize` would obscure the difference | ✓ Good — `coerceToolOrder` (no cap) beside `normalizeRecents` (caps at 5) |
| **Tauri `dragDropEnabled:false`** to let in-page HTML5 drag work (v1.4) | Tauri v2's native window file-drop handler defaults on and swallows the webview's `dragover`/`drop`; the app has no file-drop feature | ✓ Good — post-ship fix `1c2c7664`; pointer drag now moves rows on the real WKWebView |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-05 after v1.4 milestone — **Milestone v1.4 "Reorderable Tools" COMPLETE, SIGNED OFF & ARCHIVED** (sole phase 16; tag `v1.4` local-only). The app's first personalization feature: user-reorderable sidebar — `toolOrder` overlay over the registry (registry stays the single control plane; ⌘K palette + router order-agnostic), handle-initiated native HTML5 drag + neutral insertion line, Alt+↑/↓ keyboard reorder with `aria-live`, persisted + reconciled (new-tool-append / unknown-drop / de-dupe) + keyboard-reachable reset-to-default; all 7 REORD requirements verified (11/11 must-haves), human-signed-off on the real WKWebView; full suite 668/668, decoder 19/19 untouched, zero new runtime/dev deps, gsd-ui-review WCAG-AA 22/24 (findings fixed), code review 0 critical, security 8/8. Post-ship: Tauri `dragDropEnabled:false` so in-page HTML5 drag works. Archived to `.planning/milestones/v1.4-*`. Prior milestones: v1.3 "More Tools" (Phases 12–15, tag `v1.3`), v1.2 "Release Tooling" (Phases 9–11), v1.1 "Formatters" (Phases 7–8), v1.0 "Distribution" (Phases 1–6). **Next: `/gsd-new-milestone` (or `/gsd-review-backlog`) — no active milestone.***
