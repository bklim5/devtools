# Roadmap: DevTools

## Milestones

- â **v1.0 Distribution** — Phases 1â6 (shipped 2026-06-01) — see `milestones/v1.0-ROADMAP.md`
- â **v1.1 Formatters** — Phases 7â8 (shipped 2026-06-02) — see `milestones/v1.1-ROADMAP.md`
- â **v1.2 Release Tooling** — Phases 9â11 (shipped 2026-06-03) — see `milestones/v1.2-ROADMAP.md`
- â **v1.3 More Tools** — Phases 12â15 (shipped 2026-06-04) — see `milestones/v1.3-ROADMAP.md`
- â **v1.4 Reorderable Tools** — Phase 16 (shipped 2026-06-05) — see `milestones/v1.4-ROADMAP.md`
- â **v1.5 Pinned Tools** — Phase 17 (shipped 2026-06-07) — see `milestones/v1.5-ROADMAP.md`
- â **v1.6 Licensing** — Phases 18â21 (shipped 2026-06-17) — see `milestones/v1.6-ROADMAP.md`
- â **v1.7 Settings & Preferences** — Phases 22â25 (shipped 2026-06-21, app v0.4.1) — see `milestones/v1.7-ROADMAP.md`
- â **v1.8 Mac App Store Distribution** — Phases 26â30 (shipped 2026-06-27, app v1.0.0 Submitted for Review) — see `milestones/v1.8-ROADMAP.md`
- ð§ **v1.9 Prettier Formatters** — Phases 31â34 (IN PROGRESS, started 2026-06-30) — HTML + JS/TS prettify (Prettier 3.8.3 standalone) + minify (esbuild), lazy/vendored; detail below

## Phases

<details>
<summary>â v1.0 Distribution (Phases 1â6) — SHIPPED 2026-06-01</summary>

- [x] Phase 1: Scaffold + Harness Proof (4/4 plans) — completed 2026-05-30
- [x] Phase 2: Shell (4/4 plans) — completed 2026-05-30
- [x] Phase 3: Hero (Protobuf) + Encoding + UX Constraints (signed off 2026-05-31)
- [x] Phase 4: Catalogue (Unix Time, JWT, Hash, UUID/ULID) — signed off 2026-06-01
- [x] Phase 5: Native Polish (tray/menu, single-instance, window-geometry) — 2026-06-01
- [x] Phase 6: Distribution (signed DMG + signature-verified auto-updater) — signed off 2026-06-01

Full detail: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>â v1.1 Formatters (Phases 7â8) — SHIPPED 2026-06-02</summary>

- [x] Phase 7: Formatters — shared `FormatterView` + JSON formatter + XML formatter (zero-dep, native `JSON`/`DOMParser`) — validate/prettify/minify, plus JSON sort-keys (3/3 plans) — completed 2026-06-02
- [x] Phase 8: StatusBar Size-Readout Cleanup — make `StatusBar` byteCount opt-in; keep it on Base64/Protobuf/Formatters, drop it from Hash/UUID/Unix Time/JWT (1/1 plan) — completed 2026-06-02

Full detail: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>â v1.2 Release Tooling (Phases 9â11) — SHIPPED 2026-06-03</summary>

Local release-automation helper scripts over a unit-tested pure core in `src/lib/release/` (zero new runtime deps; hero decoder + its 19 tests byte-untouched). CI parked to backlog 999.2.

- [x] Phase 9: Pure release core + housekeeping — `src/lib/release/version.ts` (bumpSemver + 3 surgical manifest editors) + `manifest.ts` (dual-key `buildLatestJson`); Cargo 0.1.0â0.2.1 reconcile (REL-02), `latest.json` untracked (REL-08) — completed 2026-06-02
- [x] Phase 10: `bump-and-tag` driver — `scripts/bump-and-tag.mjs` + `pnpm release:bump`: lockstep 3-manifest bump + lockfile regen (REL-01/03), `vX.Y.Z` tag + push to origin (REL-04), `--dry-run` (REL-10) + preflights (REL-11); live v0.2.2 cut — completed 2026-06-02
- [x] Phase 11: `build-and-publish` driver + universal binary — `scripts/build-and-publish.mjs` + `pnpm release:publish`: universal `tauri build` (REL-05), fresh-`.sig` dual-key `latest.json` (REL-06), cross-repo `gh` publish (REL-07), `APPLE_*` passthrough (REL-09), post-publish `curl` verify (REL-12); live v0.2.2 published + DST-02 updater round-trip proven on real hardware — completed 2026-06-03

All 12 REL requirements complete. Full detail: `.planning/milestones/v1.2-ROADMAP.md` Â· audit: `milestones/v1.2-MILESTONE-AUDIT.md`

</details>

<details>
<summary>â v1.3 More Tools (Phases 12â15) — SHIPPED 2026-06-04</summary>

Three new high-frequency tools (URL, Regex, Cron) + a Protobuf decimal-byte-array input mode — eight tools â eleven. Four fully-independent features, risk-ordered; zero new runtime deps; hero `decoder.ts` + its 19 tests byte-for-byte untouched throughout.

- [x] Phase 12: Protobuf decimal input — comma/space-separated decimal byte array as a third auto-detected input mode (`decimalToBytes` in `src/lib/bytes.ts`; decoder untouched); PRO-08/09 — completed 2026-06-03
- [x] Phase 13: URL tool (9th) — parse into components + query keyâvalue table, component-vs-full encode/decode both ways over native `URL`/`URLSearchParams`; extracted shared `SegmentedControl`; URL-01..05 — completed 2026-06-03
- [x] Phase 14: Regex tester (10th) — live highlighted matches, capture-group breakdown, g/i/m/s/u flags, `$1`/`$<name>`/`$&` replace preview, 3-pattern library, ReDoS-safe via a Web Worker + timeout watchdog; RGX-01..07 — completed 2026-06-03
- [x] Phase 15: Cron tool (11th) — paste â 24h description + next 5 runs in local time with IANA TZ label; 5/6-field, macros, full syntax, DOM/DOW OR-union, DST-correct bounded next-run, isolated `L`/`nL`/`L-n` slice; CRON-01..11 — completed 2026-06-04

All 25 requirements complete. Full detail: `.planning/milestones/v1.3-ROADMAP.md` Â· requirements: `milestones/v1.3-REQUIREMENTS.md`

</details>

<details>
<summary>â v1.4 Reorderable Tools (Phase 16) — SHIPPED 2026-06-05</summary>

A focused single-feature milestone: a user-reorderable sidebar tool list (the first personalization feature). Drag-to-reorder (handle-initiated native drag, no dnd library) plus an accessible Alt+â/â keyboard path with `aria-live` announcements, the custom order persisted as a `toolOrder` overlay over the registry, with graceful reconciliation for new/removed tools and a reset-to-default action. Promoted from backlog 999.6 (12 locked decisions). Zero new runtime deps; WCAG-AA; registry stays the single control plane; `decoder.ts` + its 19 tests untouched.

- [x] Phase 16: Reorderable sidebar tool list — drag + Alt+â/â keyboard reorder, `aria-live` announcements, persisted `toolOrder` overlay, new-tool-append reconciliation, reset-to-default; REORD-01..07 (2/2 plans) — completed 2026-06-05

All 7 REORD requirements complete. Full detail: `.planning/milestones/v1.4-ROADMAP.md` Â· requirements: `milestones/v1.4-REQUIREMENTS.md`

</details>

<details>
<summary>â v1.5 Pinned Tools (Phase 17) — SHIPPED 2026-06-07</summary>

A focused single-feature milestone extending v1.4's personalization: users **pin favourite tools to a distinct, reorderable "Pinned" section at the top of the sidebar**, independent of the v1.4 custom order. Pinning is a render-time `pinnedToolIds` overlay persisted through the existing prefs seam (beside `toolOrder`/`recentToolIds`) and reconciled against the live registry on load; the registry stays the single control plane (âK palette + router pin-agnostic). Reuses v1.4's `reconcileToolOrder`/`moveToolInOrder` helpers, the drag + Alt+â/â keyboard reorder, and the `aria-live` pattern. Zero new runtime/dev deps; WCAG-AA; `decoder.ts` + its 19 tests untouched. Default: no tool pinned (settings surface + auto-pin-hero deferred).

- [x] Phase 17: Pinned sidebar section — pin/unpin via a row pin icon (persistent-filled / hover + focus-visible) + **Alt+P** (`aria-live`-announced), a "Pinned" group with divider shown only when â¥1 tool pinned, independent per-group drag + Alt+â/â reorder (no cross-boundary drag), persisted + reconciled `pinnedToolIds` overlay (drop unknown, de-dupe), and a keyboard-reachable "Unpin all"; PIN-01..09 (2/2 plans) — completed 2026-06-07

All 9 PIN requirements complete; human-signed-off (full suite 694/694, decoder 19/19 untouched, gsd-ui-review WCAG-AA 23/24). Post-walkthrough keyboard-model fixes (D-17): Alt+P physical-`KeyP` (macOS Option+P composes to "Ï"), Tab-reachable rows + pin fallback, â/â focus nav, 24Ã24 targets. Full detail: `.planning/milestones/v1.5-ROADMAP.md` Â· requirements: `milestones/v1.5-REQUIREMENTS.md`

</details>

<details>
<summary>â v1.6 Licensing (Phases 18â21) — SHIPPED 2026-06-17</summary>

- [x] Phase 18: Entitlements Seam & Central Gate (4/4 plans) — completed 2026-06-10
- [x] Phase 19: License Activation & Offline Verification (4/4 plans) — completed 2026-06-12
- [x] Phase 20: Purchase Pipeline (3/3 plans) — live LS purchase 2026-06-17 (order 8722394)
- [x] Phase 21: License Lifecycle & Ship Gate (5/5 plans) — live walkthrough + ship-gate cases 1/2/7/8 passed 2026-06-17

One-time-payment lifetime license: MoR checkout â webhook â Keygen â emailed key â paste-activation (HMAC fingerprint, one machine) â offline Ed25519-verified machine.lic thereafter, with self-serve transfer + revocation, behind a central frontend entitlement gate (free keeps all 11 tools; Pro unlocks customization). Full detail: `milestones/v1.6-ROADMAP.md` Â· requirements: `milestones/v1.6-REQUIREMENTS.md`

</details>

<details>
<summary>â v1.7 Settings & Preferences (Phases 22â25) — SHIPPED 2026-06-21 (app v0.4.1)</summary>

- [x] Phase 22: Settings Modal Shell, Entry Points & License Pane (3/3 plans) — completed 2026-06-15
- [x] Phase 22.1: Settings Follow-ups (INSERTED) (4 plans + fix batch) — completed 2026-06-16
- [x] Phase 22.2: Pro-gate âK + focused upsell modal (INSERTED) (1 plan) — completed 2026-06-16
- [x] Phase 23: Appearance Pane (4/4 plans) — completed 2026-06-17
- [x] Phase 24: Hotkeys & General Panes (4/4 plans) — completed 2026-06-19
- [x] Phase 25: Updates Pane & Milestone Ship (5/5 plans) — completed 2026-06-21

A five-pane in-window Settings modal (License Â· Appearance Â· Hotkeys Â· General Â· Updates) reachable from app menu â, / tray / sidebar / âK via the platform event seam: live theming, rebindable hotkeys (incl. OS global summon), app-behavior toggles (incl. launch-at-login), in-app update check + install. Full detail: `milestones/v1.7-ROADMAP.md` Â· requirements: `milestones/v1.7-REQUIREMENTS.md`

</details>

<details>
<summary>â v1.8 Mac App Store Distribution (Phases 26â30) — SHIPPED 2026-06-27 (app v1.0.0, Submitted for Review)</summary>

- [x] Phase 26: StoreKit Bridge Spike (CRITICAL PATH) (6/7 plans; 26-07 swift-rs fallback SKIPPED) — completed 2026-06-23
- [x] Phase 27: The Build-Variant Seam (3 layers) (4/4 plans) — completed 2026-06-23
- [x] Phase 28: Entitlement-Source Swap + Store License Pane (5/5 plans) — completed 2026-06-23
- [x] Phase 29: Sandbox-Safe Native Features (3/3 plans) — completed 2026-06-25
- [x] Phase 30: `.pkg` Build + App Store Connect Submission (3/3 plans) — completed 2026-06-27

The Mac App Store edition as a second distribution channel: a build-variant seam (appstore Cargo feature + --config overlay + VITE_CHANNEL), StoreKit IAP resolved on-device through the existing central gate, Keygen/updater/keyring compiled out, an App-Sandboxed signed `.pkg` submitted for review at v1.0.0; the direct DMG channel un-regressed and `decoder.ts` + its 19 tests byte-untouched. Full detail: `milestones/v1.8-ROADMAP.md` Â· requirements: `milestones/v1.8-REQUIREMENTS.md`

</details>

## ð§ v1.9 Prettier Formatters (Phases 31â34) — IN PROGRESS

Two new formatter tools — an **HTML prettifier** and a combined **JavaScript/TypeScript prettifier** — that each **prettify** (Prettier 3.8.3 standalone, output byte-identical to `prettier --write`, HTML incl. embedded `<script>`/`<style>`) AND **minify** (esbuild / `esbuild-wasm` for JS/TS/JSX/TSX + CSS; an offline HTML minifier for HTML). Both heavy engines are vendored/self-hosted (no CDN), lazy-loaded and code-split out of the entry chunk. Async transform with a latest-wins guard; errors as calm `role=alert` values; mirrors the JSON/XML `FormatterView` + `src/lib/format/` shape; registry-only registration; free tier; WCAG-AA. **Two deliberate, scoped HEAVY-dep exceptions** to the zero-dep wedge (Prettier for prettify + esbuild for minify). `decoder.ts` + its 19 tests stay byte-untouched. (User kept Minify on both tools, overriding the research's drop-minify recommendation â esbuild.)

Coverage: all 13 v1.9 requirements (PRT-01..13) mapped to exactly one phase, no orphans.

- [x] **Phase 31: Doc/Process Correction** — fix the stale CLAUDE.md "six tools only" + "zero new runtime dependencies" wording to record Prettier + esbuild as two scoped exceptions (PRT-13) (completed 2026-07-01)
- [x] **Phase 32: Prettier/esbuild Engine & Async Seam** — async Prettier wrapper, esbuild minify wrapper, shared latest-wins hook, FormatterView generalization, dep moves, chunk-split guard + self-test, golden parity test vs CLI, offline e2e (PRT-01,02,03,04,05,06,11) (completed 2026-07-01)
- [x] **Phase 33: HTML Prettifier Tool** — single Prettier parser; embedded script/style parity + HTML minify; registry-only/free-tier/WCAG-AA (PRT-07,08,12) (completed 2026-07-02)
- [ ] **Phase 34: JS/TS Prettifier Tool** — combined typescript-parser tool; semicolons + single-quote toggles; esbuild minify (PRT-09,10)

### Phase 31: Doc/Process Correction
**Goal**: The project docs honestly record the two scoped heavy-dep exceptions; the hero stays untouched.
**Depends on**: Nothing (independent, cheap — runs first to unblock the stale "six tools" constraint)
**Requirements**: PRT-13
**Success Criteria** (what must be TRUE):
  1. CLAUDE.md no longer asserts "six tools only" — it records the wedge-gated, growing tool set (11 â 13 tools).
  2. The "zero new runtime dependencies" wording is corrected to record Prettier (prettify) + esbuild (minify) as two deliberate, scoped, reviewed runtime-dependency exceptions — explicitly NOT a precedent for grab-bag deps.
  3. `decoder.ts` + its 19 tests remain byte-for-byte untouched (`git diff --quiet`).
**Plans**: 1 plan
- [x] 31-01-PLAN.md — retire the stale "six tools only" + "zero new runtime deps" wording in CLAUDE.md, README.md, and PROJECT.md; record Prettier + esbuild as two scoped exceptions

### Phase 32: Prettier/esbuild Engine & Async Seam
**Goal**: The async Prettier + esbuild engine seam, the shared formatting hook, the generalized FormatterView, and the parity/isolation guards exist and are proven — the foundation both tools depend on.
**Depends on**: Nothing (foundation; build the guards WITH the wrapper, not after)
**Requirements**: PRT-01, PRT-02, PRT-03, PRT-04, PRT-05, PRT-06, PRT-11
**Success Criteria** (what must be TRUE):
  1. A reusable async wrapper formats a code string via Prettier 3.8.3 standalone and returns output byte-identical to dev-time `prettier --write`, locked per language by a golden parity test (incl. an embedded-code fixture) that goes RED on any version/option drift. [PRT-01, PRT-05]
  2. A minify wrapper returns valid, semantically-equivalent compact output via esbuild for JS/TS/JSX/TSX + CSS (and HTML via the offline HTML minifier), with no ASI/regex-literal breakage. [PRT-06]
  3. Both heavy engines (Prettier + esbuild) and their plugins load only via lazy dynamic `import()` and never appear in the app's entry/initial chunk — proven by an automated build-artifact guard (cloned from the existing chunk-inventory guard) with a non-vacuous self-test. [PRT-02]
  4. Formatting runs asynchronously with a latest-wins guard (a slow stale result never clobbers newer output), shows a pending/loading state, and surfaces parse/format/minify errors as a calm `role=alert` line:col value — never a crash or silent fallback; a no-network offline check confirms zero CDN/outbound use. [PRT-03, PRT-04]
  5. `FormatterView` is generalized additively (a `printWidth` control added; the existing `minify` action reused for the Prettier tools, wired to esbuild) with NO change to existing JSON/XML formatter behaviour. [PRT-11]
**Plans**: 5 plans (3 waves)
- [x] 32-01-PLAN.md — async Prettier standalone wrapper (devDepâdep, byte-identical) + golden parity test vs CLI (embedded-code fixture, RED on drift) [PRT-01, PRT-05] â 2026-07-01
- [x] 32-02-PLAN.md — shared `useAsyncFormat` hook (debounce ~180ms + reqId latest-wins gate + pending) [PRT-03] â 2026-07-01
- [x] 32-03-PLAN.md — FormatterView generalized to `[ Prettify | Minify ]` mode selector + optional printWidth (D-04 hide-in-minify) + StatusBar role=alert; JSON/XML retrofit; PRT-11 amended [PRT-11, PRT-04] â 2026-07-01
- [x] 32-04-PLAN.md — esbuild-wasm minify wrapper (JS/TS/JSX/TSX + CSS, offline lazy wasm) + offline pure HTML minifier [PRT-06] â 2026-07-01
- [x] 32-05-PLAN.md — heavy-engine chunk-isolation guard (cloned, ungated) + non-vacuous self-test + verifier sentinel + no-network integration test [PRT-02, PRT-04]
**UI hint**: yes

### Phase 33: HTML Prettifier Tool
**Goal**: User can prettify or minify pasted HTML — embedded script/style formatted to full Prettier parity — through the new seam.
**Depends on**: Phase 32
**Requirements**: PRT-07, PRT-08, PRT-12
**Success Criteria** (what must be TRUE):
  1. User pastes HTML and Prettify produces canonical output that ALSO formats embedded `<script>` (JS) and `<style>` (CSS), matching `prettier --write` — locked by a script+style golden fixture.
  2. User can Minify HTML to compact valid HTML with minified embedded code.
  3. The HTML toolbar exposes indent (2/4/tab), printWidth (80/100/120, default 80), and a Minify action; output is paste-instant with a visible focusable copy via the platform seam and an inâout byte-delta status bar.
  4. The HTML tool appears in the sidebar, âK palette, and HashRouter automatically from a registry-only entry, ships free (no entitlement gate), and passes WCAG-AA (visible focus, AA contrast, no opacity-only disabled state). [PRT-12]
  5. As the first mounted prettier/esbuild consumer, the HTML tool inherits the P32 offline-e2e obligation: a real-WKWebView offline paste proof (Wi-Fi off, DevTools Network tab clean while prettifying/minifying) MUST pass before this tool can close. [PRT-04, carried from Phase 32]
  6. **Large-paste guard (carried from Phase 32, Codex adversarial review):** the P32 engines run Prettier/esbuild synchronously on the webview main thread with no size cap (a deliberate altitude choice — off-threading buys nothing for the common case). The HTML tool, as the first mounted consumer, MUST decide + implement the pathological-paste UX: a hard input-size guard returning a clear "input too large" status (or an interruptible/worker path) so a multi-MB paste cannot freeze the UI, contradicting the <2s paste-instant promise. Cover with a test that oversized input never enters the engine path.
**Plans**: 4 plans (3 waves)
- [x] 33-01-PLAN.md — shared large-paste size guard in `useAsyncFormat` (2 MB cap, `maxInputBytes` param) + SC6 test proving 0 runner calls for over-cap input [PRT-04] (wave 1) — DONE 2026-07-01 (`915990c3` feat, `b8fd9bfe` test; bounded `utf8LenBounded` counter, pair-guarded surrogates, `inputBytes` returned; 16/16 hook tests, tsc clean, decoder + types.ts byte-untouched)
- [x] 33-02-PLAN.md — HTML engine golden locks: SC1 script+style prettify parity (CLI golden, RED on drift) + SC2 frozen minifyHtml golden [PRT-07] (wave 1) — DONE 2026-07-01 (`abf3a85a` SC1, `52922221` SC2; html-tool.html + CLI golden via gen-prettier-golden.mjs, frozen minify-input.html golden; 4/4 new tests, suite 1355/1355, engine files + decoder byte-untouched)
- [x] 33-03-PLAN.md — HtmlFormatterTool (first async-hook consumer) + registry-only free entry (CodeXml icon) + unit tests (async prettify/minify, printWidth, oversize role=alert, error, copy) [PRT-07, PRT-08, PRT-12] (wave 2, depends 33-01) — DONE 2026-07-01 (`585ca9fa` feat, `b2f60ba4` test; mode-dispatch runner + memo'd opts, byteCount straight from hook inputBytes—no byteLen re-encode, json-style line:col D-11, FormatterStatus.byteCount widened optional; 9/9 tool tests incl. SC6 0-encode over ASCII+multibyte+malformed-surrogate, suite 1364/1364, engines+decoder byte-untouched)
- [x] 33-04-PLAN.md — BLOCKING real-WKWebView e2e (async prettify/minify + role=alert D-11) + human offline paste proof (Wi-Fi off, Network clean) both channels + WCAG-AA audit [PRT-04, PRT-12] (wave 3, depends 33-03) — DONE 2026-07-02 (`986cb338` e2e; human APPROVED 2026-07-02; 5-round Codex remediation + 3 human-gate fixes: whitespace-DoS guard, minify attribute integrity + quote-aware tag scan, CSP `wasm-unsafe-eval` for packaged esbuild minify, StatusBar no-overlap, concise errors; both channels rebuilt fresh `70e26914`, e2e GREEN on webkit, suite 1372/1372)
**UI hint**: yes

### Phase 34: JS/TS Prettifier Tool
**Goal**: User can prettify or minify pasted JavaScript/TypeScript/JSX/TSX in one combined tool — no language picker — on the proven Phase-32 foundation.
**Depends on**: Phase 32 (parallel-capable with Phase 33; each plan still passes every harness gate)
**Requirements**: PRT-09, PRT-10
**Success Criteria** (what must be TRUE):
  1. User pastes JavaScript, TypeScript, JSX, or TSX into ONE combined tool and Prettify produces canonical output via the typescript parser (no language picker in the common case) — verified by both a JS and a TS golden fixture.
  2. User can Minify to compact valid output via esbuild.
  3. The JS/TS toolbar exposes indent (2/4/tab), printWidth, a semicolons toggle, a single-quote toggle, and a Minify action; output is paste-instant with a visible focusable copy via the platform seam and an inâout byte-delta status bar.
  4. The tool registers registry-only (sidebar/âK/router auto-derive) and ships free + WCAG-AA, reusing the Phase-33 registry/free-tier pattern (shares PRT-12).
  5. **Large-paste guard (carried from Phase 32, Codex adversarial review):** same obligation as Phase 33 criterion 6 — the JS/TS tool mounts the same uncapped main-thread P32 engines, so if Phase 33 has not already landed a shared large-input guard, this tool MUST ensure a multi-MB paste returns a clear "too large" status rather than freezing the UI, with a test proving oversized input never reaches the engine.
**Plans**: 5 plans (3 waves)
- [ ] 34-01-PLAN.md — engine: semi/singleQuote plumb-through + formatJsTs (typescript→babel) + minifyJsTs (tsx→ts) fallback chains [PRT-09, PRT-10] (wave 1)
- [ ] 34-02-PLAN.md — four-dialect golden locks: add messy.jsx + messy.tsx fixtures/goldens + parity cases (RED-on-drift) [PRT-09] (wave 1)
- [ ] 34-03-PLAN.md — FormatterView Semi + Single-quotes toggles (Prettify-gated) + extract shared conciseError [PRT-10] (wave 1)
- [ ] 34-04-PLAN.md — JsFormatterTool (clone HTML pattern) + registry-only free entry (Braces icon) + jsdom suite (4 dialects, toggles, 2 MB guard, errors) [PRT-09, PRT-10, PRT-12] (wave 2, depends 34-01/34-03)
- [ ] 34-05-PLAN.md — BLOCKING real-WKWebView e2e + full harness gates + both-channel build + human offline proof + WCAG-AA audit [PRT-09, PRT-10, PRT-12] (wave 3, depends 34-04)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order. v1.6 runs 18 â 19 â 21 with Phase 20 parallel-capable beside 19 (external infra); Phase 21 requires both 19 and 20.

v1.7 runs 22 â 23 â 24 â 25 (started non-destructively while v1.6 is in final sign-off; numbering continues from Phase 21). Phase 22 is the modal-shell foundation all panes mount into; Phases 23 and 24 are independent pane work (parallel-capable after 22); Phase 25 adds the Updates pane and carries the milestone-close sign-off. Within Phase 22: wave 1 = the modal foundation (22-01); wave 2 = the webview entry points (22-02) + the native menu/tray (22-03) in parallel (no file overlap).

v1.8 runs 26 â 27 â 28 â 30 with Phase 29 parallel-capable beside 28 once 27 lands (29 shares only the sandbox-enable change). The bridge spike (26) is the critical path — nothing store-side compiles/renders without `platform.iap` — so it is strictly first; the variant seam (27) is the foundation for both 28 and 29; the irreversible `.pkg` submission (30) runs LAST, after every source change lands (verify bundle mtime > last source commit). Phases 26 + 28 + 29 + 30 each carry a MANDATORY human ship-gate walkthrough (WebDriver cannot drive StoreKit purchases / the sandbox / refunds / login-items).

v1.9 runs 31 â 32 â {33, 34}: Phase 31 (doc correction) is independent and cheap, so it runs first to unblock the stale "six tools" constraint; Phase 32 (engine/seam infra) is the hard prerequisite both tools depend on (async wrapper + shared latest-wins hook + FormatterView generalization + the parity/isolation guards, where all the async/lazy/parity risk concentrates); Phases 33 (HTML) and 34 (JS/TS) are independent tool chunks, parallel-capable after 32 — HTML first to exercise the seam end-to-end via its embedded-code golden fixture. Continues numbering from v1.8's Phase 30. Each plan still passes every binding-harness gate (no skipping ahead).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold + Harness Proof | v1.0 | 4/4 | Complete | 2026-05-30 |
| 2. Shell | v1.0 | 4/4 | Complete | 2026-05-30 |
| 3. Hero + Encoding + UX | v1.0 | — | Complete | 2026-05-31 |
| 4. Catalogue | v1.0 | — | Complete | 2026-06-01 |
| 5. Native Polish | v1.0 | — | Complete | 2026-06-01 |
| 6. Distribution | v1.0 | — | Complete | 2026-06-01 |
| 7. Formatters | v1.1 | 3/3 | Complete | 2026-06-02 |
| 8. StatusBar Size-Readout Cleanup | v1.1 | 1/1 | Complete | 2026-06-02 |
| 9. Pure release core + housekeeping | v1.2 | 2/2 | Complete   | 2026-06-02 |
| 10. bump-and-tag driver | v1.2 | 3/3 | Complete    | 2026-06-02 |
| 11. build-and-publish driver + universal binary + safety rails | v1.2 | 3/3 | Complete    | 2026-06-03 |
| 12. Protobuf decimal input | v1.3 | 2/2 | Complete    | 2026-06-03 |
| 13. URL tool | v1.3 | 2/2 | Complete    | 2026-06-03 |
| 14. Regex tester | v1.3 | 3/3 | Complete    | 2026-06-03 |
| 15. Cron tool | v1.3 | 4/4 | Complete    | 2026-06-04 |
| 16. Reorderable sidebar tool list | v1.4 | 2/2 | Complete    | 2026-06-05 |
| 17. Pinned sidebar section | v1.5 | 2/2 | Complete    | 2026-06-07 |
| 18. Entitlements Seam & Central Gate | v1.6 | 4/4 | Complete    | 2026-06-10 |
| 19. License Activation & Offline Verification | v1.6 | 4/4 | Complete    | 2026-06-12 |
| 20. Purchase Pipeline | v1.6 | 3/3 | Complete | PAY-01/02/03 Done; live purchase 2026-06-17 |
| 21. License Lifecycle & Ship Gate | v1.6 | 5/5 | Complete | 2026-06-17 (live walkthrough + ship-gate cases 1/2/7/8 passed; LIC-05/07/08/09 closed) |
| 22. Settings Modal Shell, Entry Points & License Pane | v1.7 | 3/3 | Complete    | 2026-06-15 |
| 22.1 Settings Follow-ups | v1.7 | 2/2 | Complete | 2026-06-16 (verification passed 6/6; app-menu name + inline License upsell) |
| 23. Appearance Pane | v1.7 | 4/4 | Complete    | 2026-06-17 |
| 24. Hotkeys & General Panes | v1.7 | 4/4 | Complete | SET-08 + SET-09 validated 2026-06-19 |
| 25. Updates Pane & Milestone Ship | v1.7 | 5/5 | Complete    | 2026-06-21 |
| 26. StoreKit Bridge Spike (CRITICAL PATH) | v1.8 | 6/7 | Complete    | 2026-06-23 |
| 27. The Build-Variant Seam (3 layers) | v1.8 | 4/4 | Complete    | 2026-06-23 |
| 28. Entitlement-Source Swap + Store License Pane | v1.8 | 5/5 | Complete    | 2026-06-23 |
| 29. Sandbox-Safe Native Features | v1.8 | 3/3 | Complete    | 2026-06-25 |
| 30. .pkg Build + App Store Connect Submission | v1.8 | 3/3 | Complete    | 2026-06-27 |
| 31. Doc/Process Correction | v1.9 | 1/1 | Complete    | 2026-07-01 |
| 32. Prettier/esbuild Engine & Async Seam | v1.9 | 5/5 | Complete    | 2026-07-01 |
| 33. HTML Prettifier Tool | v1.9 | 4/4 | Complete    | 2026-07-02 |
| 34. JS/TS Prettifier Tool | v1.9 | 0/? | Not started | - |

## Backlog

Unsequenced ideas captured for future planning. Promote with `/gsd-review-backlog` when ready.

### Phase 999.1: More tools for the app (PROMOTED â v1.3 More Tools, in progress)

**Status:** PROMOTED — the Cron, URL, Regex tools + Protobuf decimal-byte-array input are being delivered as milestone v1.3 "More Tools" (Phases 12â15). What remains parked here is the rest of the candidate wishlist below (SQL + JavaScript/TS formatters still need a lib; Date, JSONâYAML, Number Base, Escape/Unescape, comparers, etc. unscheduled).

**SELECTING â v1.9 "Formatters" (via `/gsd-review-backlog` 2026-06-30):** the **HTML + JavaScript/TypeScript prettifier** slice of this wishlist is promoting to the next milestone (open with `/gsd-new-milestone`). **Locked decision:** use **Prettier standalone** (`prettier/standalone` + the babel/typescript/html plugins) as the runtime formatter engine — **lazy-loaded** via the existing registry code-split + **vendored/self-hosted** (no-CDN constraint). This is the project's **first deliberate HEAVY runtime dependency** (vs the single tiny `js-md5` to date) — an intentional, scoped exception to the zero-dep wedge, accepted by the user for canonical output matching the dev-time Prettier. New tools mirror the JSON/XML formatter shape (FormatResult, prettify/minify-style options, `src/lib/format/`), but unlike JSON/XML (pure) these wrap Prettier. NOTE: the literal "six tools only" line in `CLAUDE.md` is stale (already retired by v1.1 JSON/XML + v1.3 Cron/URL/Regex) — update it as part of v1.9 scoping. The HTML *prettifier* is distinct from the parked "HTML" entity encode/decode under Encoders/Decoders. Rest of the wishlist stays parked.

**Goal:** [Captured for future planning] — expand beyond the v1 six tools. NOTE: v1 locked "six tools only" — promoting this means deliberately reopening that constraint. There is no code-level limit (registry is a plain array; router/sidebar/palette auto-derive), so growth is mechanical; the constraint is product focus, not architecture. v1.1 already added the JSON + XML formatters from this list; v1.3 adds Cron + URL + Regex; SQL remains parked.

**Candidate tool wishlist (user-provided, categorized):**

- **Converters** — Cron Parser â (v1.3), Date, JSON Array â Table/CSV, JSON â YAML, Number Base
- **Text** — Escape / Unescape, List Comparer, Markdown Preview, Analyzer & Utilities, Text Comparer
- **Encoders / Decoders** — Base64 Image, Base64 Text, Certificate, GZIP, HTML, JWT, QR Code, URL â (v1.3)
- **Formatters** — JSON â (v1.1), XML â (v1.1), **JavaScript/TypeScript** (NEW — prettify/format a pasted JS/TS blob; reformats only, not a linter; needs a formatter lib — Prettier standalone (heavy, pulls plugins) or a lighter engine — so it must be weighed against the zero-dep wedge + the lazy-loaded `src/lib/` pattern), **SQL** (still parked — needs `sql-formatter` lib; reformats only, can't lint)
- **Generators** — Hash / Checksum, Lorem Ipsum, Password, UUID
- **Graphic** — Color Blind Simulator, Image Converter
- **Testers** — JSONPath, Regular Expression â (v1.3), XML / XSD

Each candidate must still pass the product wedge: offline/no-network, paste-instant (<2s), keyboard-driven, registry-driven, WCAG-AA, and the build+verify harness.

**Requirements:** TBD (remaining wishlist; Cron/URL/Regex requirements now in `.planning/REQUIREMENTS.md` for v1.3)
**Plans:** 4/4 plans complete

Plans:
- [ ] TBD (promote remaining wishlist with /gsd-review-backlog when ready)

### Phase 999.2: Release automation + CI integration (BACKLOG)

**Goal:** [Captured for future planning] — **the local-scripts half of this item is being delivered as milestone v1.2 (Phases 9â11); what remains parked here is the CI track.** Wire CI on top of the v1.2 scripts: CI checks (vitest + tsc + eslint) on every push/PR to main/master, and a tag-triggered CI release later (an Actions runner cuts the signed release).

**Pre-discussion decisions (captured 2026-06-02, before formal milestone planning):**

1. **Trigger model:** a git **tag push `vX.Y.Z`** cuts the signed release + updater bump. **CI checks (vitest + tsc + eslint) run on every push/PR to main/master REGARDLESS of publishing.** (Real-WKWebView e2e in CI is a stretch goal — macOS-runner + webview-automation cost.)
2. **Version bump = local helper script first, CI-integratable later.** Something like `pnpm release [patch|minor|major]` that bumps `package.json` + `src-tauri/tauri.conf.json` **in lockstep** (the D-16 lockstep from RELEASE.md; Cargo.toml is currently 0.1.0 and NOT part of it — decide whether to include it), commits, creates the `vX.Y.Z` tag, and pushes (push is what fires the release). **â delivered in v1.2 Phases 9â10 (Cargo.toml folded into the lockstep).**
3. **App semver (`0.2.x`) stays DECOUPLED from GSD milestone tags (`v1.1`).** Two numbering systems on purpose: GSD `vMAJOR.MINOR` tracks planning milestones; app `vX.Y.Z` is what the updater compares. The release pipeline keys off the **app** version.
4. **Split the automation into two scripts** (both local now, both CI-callable later):
   - **bump-and-tag** (decision #2 above). **â v1.2 Phase 10.**
   - **build-and-publish** — runs `pnpm tauri build`, then **generates `latest.json` from the FRESH `*.app.tar.gz.sig`** (automating the fragile manual paste RELEASE.md Â§5 warns about — never reuse a stale `.sig`), creates the GitHub Release on `bklim5/devtools-releases`, and uploads DMG + `.app.tar.gz` + `latest.json`. **â v1.2 Phase 11.**

**Context the milestone must fold in (from RELEASE.md + repo state, 2026-06-02):**

- **Split-repo publish:** private source `bklim5/devtools` â public `bklim5/devtools-releases` (assets + `latest.json` only). Updater endpoint pinned to `releases/latest/download/latest.json` on the public repo. CI publishing across repos needs a **cross-repo PAT** — the default `GITHUB_TOKEN` cannot write releases to a different repo. **(Local `gh` auth suffices for v1.2; the cross-repo PAT stays parked here for CI.)**
- **Signing secrets:** minisign **private key (`~/.tauri/devtools.key`) + password** must move into **GitHub Actions secrets** for CI release (mandatory; DST-02 verify-before-apply). Only the public key is in the repo (`tauri.conf.json` `plugins.updater.pubkey`). **(v1.2 reads these from the local env; Actions secrets stay parked here.)**
- **arm64-only gap (Pitfall 7):** a local Apple-Silicon build serves only `darwin-aarch64`. Intel/`darwin-x86_64` or `--target universal-apple-darwin` coverage is a CI-phase improvement to consider. **â closed in v1.2 Phase 11 (universal binary).**
- **Apple notarisation stays DEFERRED** (ad-hoc signing) until Apple Developer enrolment (D-02) — but scripts should be **notarisation-ready** (honor `APPLE_*` env if present, per RELEASE.md "post-enrolment flip"). **â notarisation-ready honored in v1.2 Phase 11; activation still deferred.**
- **macOS runner required** for `tauri build`; private-repo Actions minutes are billed — a reason CI *release* is deferred while CI *checks* run regardless.
- **Stale committed `latest.json`** at repo root (currently 0.2.1) — decide whether to keep it generated-only / stop committing it. **â v1.2 Phase 9 (generate-only, untracked).**

**Requirements:** TBD (the remaining CI track — define during a future `/gsd-new-milestone`)
**Plans:** 0 plans

Plans:
- [ ] TBD (promote the remaining CI track with /gsd-review-backlog or seed `/gsd-new-milestone` when ready)

### Phase 999.4: DevTools CLI (BACKLOG)

**Goal:** [Captured for future planning] — let users invoke the tools from the command line, e.g. `devtools hash.sha256 xxx` to print a SHA-256 hash, `devtools base64.encode ...`, etc. Implies sharing the pure transform logic (`src/lib/`) between the GUI and a CLI entrypoint so behavior stays identical. Open questions for promotion: distribution of the CLI binary (bundled with the app vs separate), namespacing/command grammar (`tool.action`), stdin/pipe support, and how it coexists with the offline/no-network ethos (a CLI is inherently offline-friendly). The pure-logic-in-`src/lib/` separation already in place is the enabler.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Protobuf decoder schema-file support (BACKLOG)

**Goal:** [Captured for future planning] — let the user supply a `.proto` schema file so the Protobuf decoder can render *named, typed* fields (e.g. `user_id` instead of `#1`, enums by name, nested message types) instead of the schema-less wire-format-only tree. This is an **additive, opt-in mode layered on top of the hero** — the schema-less decoder stays the default and the product wedge ("paste an unknown blob â usable interpretation in <2s, no setup"); a schema, when provided, only enriches the readout. **Key tension to resolve at promotion:** schema-less decoding is the explicit hero feature and "no setup / no accounts" is a binding constraint, so any schema mode must not dilute the paste-instant zero-config path — schema is an enhancement a power user reaches for, never a precondition. **Open questions:** parsing `.proto` without a new runtime dep (the constraint is zero-new-runtime-deps; a `.proto` parser is non-trivial — may need a vendored/pure parser or a deliberate dep exception decided at promotion); how the schema is supplied offline (file picker / paste / drag-drop, no network fetch of imports); handling `import` statements and well-known types; mismatches between schema and actual bytes (fall back to the schema-less view, never crash); and keeping `decoder.ts` + its 19 tests untouched (the schema layer wraps/annotates the existing wire-format output rather than modifying the core decoder).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Drag-and-drop reorder the tool list (â PROMOTED â v1.4 Phase 16)

**Status:** PROMOTED into milestone v1.4 "Reorderable Tools" as **Phase 16** (2026-06-04). Requirements REORD-01..07. Its 12 design decisions moved with it to `.planning/phases/16-reorderable-sidebar-tool-list/16-CONTEXT.md`. See the v1.4 milestone section above for the live phase. (The pinning idea it split out remains an unscheduled future feature.)

**Goal:** [Captured for future planning] — let the user drag-and-drop to reorder the tools in the sidebar (and the order should persist), so the most-used tools can sit at the top instead of the fixed registry order. **Architectural fit:** the registry (`src/lib/tools/registry.ts`) is the single control plane — sidebar, âK palette, and router all derive from it — so a user-defined ordering is a presentation-layer overlay (a persisted array of tool IDs applied over the registry), NOT a mutation of the registry array itself; the registry stays the canonical source. **Open questions for promotion:** persistence via the existing `platform.store` seam (a `toolOrder: string[]` pref, same mechanism as theme/last-used — no new dep); keyboard-accessible reordering (WCAG-AA is binding — drag-drop alone is insufficient; needs a keyboard affordance, e.g. move-up/down or an aria-grabbed pattern); how new tools shipped in a later version slot into an existing custom order (append unknown IDs); whether the âK palette and router care about order (they shouldn't — only the sidebar render order changes); and a reset-to-default affordance. Zero-new-runtime-deps still applies (HTML5 drag events or a small pure handler, not a dnd library).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Base64 tool — inline image preview (BACKLOG)

**Goal:** [Captured for future planning] — extend the **existing base64 tool** (not a new tool) with an inline image preview: when decoded bytes sniff as an image (PNG/JPEG/GIF/WebP/SVG via magic bytes), render the image inline below the decoded output. Fits the wedge: paste blob â usable interpretation. **Open questions for promotion:** rendering via data-URI `<img>` (no new deps); SVG safety (sanitize or render rasterized/sandboxed — SVG can carry scripts); size limits for very large payloads; alt-text/a11y treatment (WCAG-AA binding); whether preview shows dimensions/format metadata; copy/save affordance for the rendered image.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.8: Windows port of the license stack (BACKLOG)

**Goal:** [Captured for future planning] — make the Phase-19 license stack run on Windows when the deferred Windows milestone lands. The seams are already OS-portable (PROJECT.md); two swappable arms are macOS-only today:
1. **Key storage:** `keyring` crate is pinned with `features = ["apple-native"]` only — add a cfg-gated `windows-native` feature (Windows Credential Manager). Same `Entry::new(service, user)` API. Behavioral deltas to encode in the threat register: **no per-binary ACL prompts on Windows** (the macOS prompt-flood fix still applies but is moot) and **weaker isolation** — any same-user process can read generic credentials (key alone is still useless without the matching server-side fingerprint binding); ~2.5KB credential blob limit (fine).
2. **Fingerprint:** `fingerprint.rs` shells out to `ioreg`/`IOPlatformUUID` — add a `#[cfg(target_os = "windows")]` source arm reading registry `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` (same stability class; reinstall regenerates it â seat transfer needed, same as a Mac logic-board swap). HMAC wrapper + T-19-11 privacy invariant carry over unchanged.

Everything else already ports: machine.lic via Tauri app-data dir, pure-Rust Ed25519 verify/store/state machine, `hostname` exists on Windows, UX copy already says "device" (2026-06-12 decision). **Open questions for promotion:** keyring 3.6â4.x migration timing; Linux secret-service arm in the same pass; whether the e2e keychain pre-clean needs a Windows `cmdkey` equivalent.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.9: Native Settings / Preferences window (â PROMOTED â v1.7 Phases 22â25)

**Status:** PROMOTED into milestone v1.7 "Settings & Preferences" (Phases 22â25, started 2026-06-15). Requirements SET-01..10. **Architecture revised at promotion:** an in-window **modal overlay** (Claude-style, reusing the Phase-21 upsell-modal pattern) — NOT a separate OS window (the seed's open question resolved to the lowest-risk single-React-root approach; no multi-window/IPC). Native app-menu (â,) + tray entry points reach it through the `platform/` event seam. The License pane reuses `LicenseSettings.tsx` unchanged. Absorbs 999.3 (Theme settings) as the Appearance pane and the parked NAT-01/G-05-1 summon hotkey as the Hotkeys pane. See the v1.7 section above for the live phases. Original capture below.

**Goal:** [Captured for future planning — seed: `docs/seeds/settings-preferences-window/`] — move License + all settings into a **native macOS Preferences window** (the conventional pattern), reachable by everyone incl. unlicensed users (who see a No-license + Unlock-Pro state). Origin: Phase 21 walkthrough — the in-window `#/settings/license` route keeps the sidebar visible while the main pane shows settings (confusing), and a pure-free user has no clean entry (D-88). **Entry points:** `TinkerDev â¸ Settingsâ¦` (â,) app-menu item + a tray `Settingsâ¦` item + a sidebar `Settings` row above "Unlock Pro". **Window:** separate paned window (General Â· Appearance/Themes Â· Hotkeys Â· Updates Â· License); the **License pane reuses today's `src/components/LicenseSettings.tsx` unchanged** (Phase 21 built the hard part — flip/lifecycle/state machine). Likely **absorbs 999.3 (Theme settings)** as its Appearance pane. **Open questions for promotion:** Tauri multi-window vs a modal-over-main surface; app-menu + tray wiring in Rust; its own UI-SPEC + WCAG-AA audit; whether the upsell/activation lives in the License pane; HashRouter implications for a second window.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.10: Mac App Store distribution (BACKLOG — Apple Developer enrolment now done)

**Status:** PROMOTING â v1.8 (selected via `/gsd-review-backlog` 2026-06-21). Open the milestone with `/gsd-new-milestone` to scope APP-STORE-01.. — this entry is the seed. **Unblocked 2026-06-20: the Apple Developer Account is signed up** (the prerequisite that kept notarisation/App-Store deferred, see 999.2 + D-02). Direct distribution (signed DMG + Tauri auto-updater) stays the primary channel; this ADDS a second App Store channel. **Licensing decision RESOLVED 2026-06-20 (StoreKit IAP).**

**Goal:** [Captured for future planning] — ship TinkerDev on the **Mac App Store** as a second distribution channel alongside the existing direct DMG + updater. The hard prerequisite (paid Apple Developer enrolment) is cleared; the rest is signing/sandbox/policy work.

**Two related deliverables this unblocks:**
1. **Proper Developer ID notarisation for the DIRECT channel** (smaller, do first) — flip the currently ad-hoc-signed DMG/updater (Phase 6/11) to a Developer-ID-signed + `notarytool`-notarised + stapled build. The release scripts are already "notarisation-ready" (honor `APPLE_*` env, per 999.2 + RELEASE.md "post-enrolment flip"); this is mostly wiring the cert + `APPLE_ID/APPLE_TEAM_ID/APPLE_API_KEY` secrets and re-cutting a notarised release. Removes the Gatekeeper "unidentified developer" friction for direct downloads.
2. **Mac App Store build + submission** (larger, the real item) — a separate App-Store-target build uploaded to App Store Connect.

**Key open questions / risks for promotion (App Store target):**
- **â Licensing vs IAP — RESOLVED 2026-06-20: Option (a) StoreKit In-App Purchase.** The App-Store variant unlocks Pro via **StoreKit IAP** (Apple's required path; guideline 3.1.1 forbids reusing the external Keygen key-paste flow in-store). Commission is **15% via the Small Business Program** (TinkerDev qualifies, <$1M/yr). Rejected: (b) free-in-store / direct-only — leaves in-store conversions on the table; (c) external-link entitlement — 0% in US post-Apr-2025 injunction but region-fragmented (CTF/commission elsewhere) and highest review-rejection risk. (Today's Pro unlock on the DIRECT channel stays: Lemon Squeezy MoR â Keygen key â activation.)
  **Technical shape (recommended at promotion, not yet locked):**
  - **StoreKit 2 on-device verification** (signed JWS, Apple public keys, no server) — mirrors the existing offline Ed25519 Rust-verify model.
  - One **non-consumable** "Pro" product (perpetual — matches today's perpetual node-locked Keygen model).
  - **Per-variant entitlement source:** App-Store build = **StoreKit-only** (Keygen key-paste UI + `license.tinkerdev.io` calls compiled OUT for 3.1.1 compliance); direct build = **Keygen-only**. The build-variant seam already needed to strip the updater **also switches the entitlement source**. Both resolve to the **same** `pro.theming`/`pro.ordering` map consumed by the one central Rust gate — no change to the webview gate.
  - Native **StoreKit bridge** (Swift/ObjC via Tauri; no first-class plugin) lives behind the `src/lib/platform/` seam — **spike the bridge first**.
- **App Sandbox is mandatory on the App Store** (`com.apple.security.app-sandbox`) and conflicts with current native features: **global summon** (global-shortcut may be restricted/need entitlements), **launch-at-login** (the current autostart plugin writes a `LaunchAgent` plist — NOT sandbox-compatible; must move to the sandbox-safe `SMAppService` login-item API), and possibly the **tray**. Each needs a sandbox-compatible path or a graceful feature-flag-off on the App Store build.
- **Auto-updater MUST be removed from the App Store build** — Apple forbids self-updating apps (the store handles updates). The Tauri `updater` plugin + `latest.json` flow (DST-02) must be **conditionally compiled out** for the App-Store target â two build variants (direct = with updater; App Store = without). The Updates pane (SET-10 / Phase 25) should hide/disable its check on App Store builds.
- **One build-variant seam carries everything (convergence note).** Direct vs App-Store is a *single* variant axis that switches three things together — (1) **updater**: in (direct) / compiled out (store); (2) **entitlement source**: Keygen (direct) / StoreKit-only (store); (3) **sandbox feature-flags**: full native (direct) / sandbox-safe-or-degraded summonÂ·launch-at-loginÂ·tray (store). Design it as one seam, not three independent toggles.
- **Build + upload mechanics:** App-Store-target `tauri build` (universal) â `.pkg` signed with the Apple Distribution cert + provisioning profile â upload via Transporter / `xcrun altool`/`notarytool` to App Store Connect; metadata, screenshots, privacy nutrition labels, age rating, review (1â3 days).
- **Constraints that still hold:** offline/no-network at runtime (the licensing exception aside), HashRouter, the six-tools wedge, decoder + its 19 tests untouched, WCAG-AA, the full build+verify harness.

**Requirements:** TBD (APP-STORE-01.. on promotion)
**Plans:** 0 plans

Plans:
- [ ] Ready to promote (decision resolved) — run /gsd-review-backlog or /gsd-new-milestone to open v1.8 (APP-STORE-01..).
