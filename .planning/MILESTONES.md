# Milestones

## v1.9 Prettier Formatters (Shipped: 2026-07-06)

**Phases:** 31–34 (4 phases, 15 plans) · **Suite:** 1429/1429 vitest, tsc clean · **Tools:** 11 → 13

Two new wedge-gated formatter tools — a 12th (HTML prettifier) and a 13th (combined JS/TS/JSX/TSX prettifier, no language picker) — that each **Prettify** (Prettier 3.8.3 standalone, output byte-identical to `prettier --write`, HTML incl. embedded `<script>`/`<style>` parity) AND **Minify** (esbuild-wasm 0.28.0 for JS/TS/JSX/TSX + CSS; a pure offline `minifyHtml` for HTML). Both heavy engines are vendored/self-hosted (no CDN), lazy-loaded and code-split out of the entry chunk — the two deliberate, scoped, reviewed heavy-dep exceptions to the zero-dep wedge (user kept Minify, overriding research's drop-minify recommendation → esbuild). `decoder.ts` + its 19 tests stayed byte-for-byte untouched.

**Key accomplishments:**

- Engine + async seam (32): the async **Prettier 3.8.3 standalone** wrapper (byte-identical, golden-parity-locked incl. an embedded-code fixture, RED on version/option drift), the **esbuild-wasm** minify wrapper + offline pure HTML minifier (type-aware `<script>` routing preserves JSON-LD/importmap data blocks), the shared latest-wins **`useAsyncFormat`** hook (180ms debounce + monotonic reqId gate + pending), the generalized `[Prettify|Minify]` **FormatterView** + optional printWidth (JSON/XML retrofitted, pure transforms + decoder untouched), and the **heavy-engine chunk-isolation guard** (`prettierChunkGuard.mjs`, initial-reachability, non-vacuous self-test, verifier sentinel) + no-network engine test — PRT-01/02/03/04/05/06/11.
- HTML prettifier tool (33, the 12th): single Prettier html parser with full embedded `<script>`/`<style>` parity (SC1 golden) + esbuild HTML minify (SC2 golden), registry-only/free/WCAG-AA, indent + printWidth 80/100/120 + in→out byte delta + focusable copy; the shared 2 MB DoS guard landed here — PRT-07/08/12.
- JS/TS prettifier tool (34, the 13th): combined typescript-parser tool with NO language picker — `formatJsTs` (typescript→babel) + `minifyJsTs` (tsx→ts) fallback chains, Prettify-only Semi/Single-quotes toggles, shared `conciseError`, registry-only/free — PRT-09/10/12.
- Golden parity locks (RED-on-drift): an HTML script+style fixture, four JS/TS dialects at named parsers, `formatJsTs` routing goldens + a proven-live babel-fallback fixture; the fallback chains' routing ORDER is locked by injectable-runner tests (byte goldens can't catch mis-routing since the parsers emit identical output on common input).
- Adversarial hardening: packaged CSP `wasm-unsafe-eval` (esbuild WASM was dev-only-masked — a packaged-only class), minify attribute integrity + ReDoS-safe quote-aware tag scan, whitespace-DoS guard, concise `role=alert` line:col errors, and two Codex-caught minify-semantics fixes (jsx:preserve — never lower `<div/>` to `React.createElement`; verbatimModuleSyntax — side-effecting value imports survive elision).
- Docs/wedge correction (31, PRT-13): the stale CLAUDE.md/README/PROJECT "six tools only" + "zero new runtime dependencies" wording corrected to the wedge-gated growing tool set (11 → 13) with Prettier + esbuild recorded as the two scoped heavy-dep exceptions.

Gates held: 13/13 PRT-* requirements (audit PASSED 2026-07-06; integration 11/11, flows 5/5); per-phase VERIFICATION all passed; the binding harness (`/simplify` → `/code-review xhigh` → `/codex:adversarial-review`) run per phase, incl. 5 Codex rounds on P33 + 2 Codex minify-semantics fixes on P34; human sign-offs on both tools (HTML 2026-07-02, JS/TS 2026-07-06 + Option A JSX-factory-import minify semantics ratified); `decoder.ts` + its 19 tests byte-untouched; both channels rebuilt fresh at HEAD. 5 non-blocking tech-debt items (golden-check CI wiring, status-block duplication, no standalone P34 ui-review/SECURITY.md artifact, PRT-08 e2e depth). Full detail: `milestones/v1.9-ROADMAP.md` · `milestones/v1.9-REQUIREMENTS.md`.

## v1.8 Mac App Store Distribution (Shipped: 2026-06-29 — Submitted for Review)

**Phases:** 26–30 (5 phases, 21 plans executed + 1 contingency skipped) · **App version:** 1.0.0 · **Submitted to App Store Review 2026-06-27**

A second distribution channel: the Mac App Store edition. A build-variant seam (`appstore` Cargo feature + `--config` overlay + `VITE_CHANNEL`) produces an App-Sandboxed StoreKit build alongside the unchanged direct Developer-ID/DMG channel — Pro is a one-time StoreKit IAP verified on-device (serverless), the Keygen/updater/keyring surfaces are compiled out, and the same central entitlement gate + registry + `decoder.ts` (and its 19 tests) stay byte-unchanged.

**Key accomplishments:**

- StoreKit bridge spike (26): proved `tauri-plugin-iap@0.9` in a universal sandboxed build; the `platform.iap` seam (real `tauri.ts` arm, no-op browser/stub) + `iap_*` Rust commands with on-device JWS verify (fail-closed); a real Sandbox-tester purchase round-trip granted Pro live (go/no-go = keep the plugin; the swift-rs fallback plan 26-07 was SKIPPED) — MAS-IAP-01/04.
- The build-variant seam (27): an umbrella `direct` Cargo feature (default) vs `--no-default-features --features appstore`; a `tauri.appstore.conf.json` `--config` overlay + `VITE_CHANNEL`, bound in one `package.json` script; the sandboxed `.app` launches with `network.client` (no white-screen); the updater compiled out; min-version 13.0 store / 10.15 direct; the committed `verify-appstore-bundle.sh` — MAS-BUILD-01/02/03/05/06.
- Entitlement-source swap + store License pane (28): a `baseFromStoreKit` arm in `resolveEntitlements` (the one gate-flip point; reads on-device `currentEntitlements`, never `license.status`); a transaction-update Channel + boot listener flip Pro live on purchase/refund with no relaunch; separate tree-shakeable StoreLicense/StoreUpdates/StoreUpsell modules (Buy + Restore, no key/$-figure); the entire Keygen surface compiled out + grep-clean on the signed bundle — MAS-IAP-02/03/05/06/07, MAS-BUILD-04/07.
- Sandbox-safe native features (29): `keyring`/Keychain + the license module + tray "Check for Updates…" + the whole updater overlay gated `#[cfg(feature="direct")]`, so the store binary links no Keychain (no `keychain-access-groups`), ships a Show/Settings…/Quit tray, and runs 0 updater calls (runtime-proven); launch-at-login hidden in the store build; a `compile_error!` guard against a hybrid build — MAS-NATIVE-01/02/03/04.
- `.pkg` build + App Store Connect submission (30): `scripts/build-appstore-pkg.sh` (Apple Distribution app-sign → embed profile + PrivacyInfo before the seal → `productbuild` Mac-Installer-signed `.pkg` → full local pre-ITMS gate set); version → 1.0.0; metadata deliverables (runbook, Notes-for-Review, listing copy, 7 screenshots @2880×1800, Data-Not-Collected, `ITSAppUsesNonExemptEncryption=false`); tinkerdev.io `/support` + `/privacy` live; the Pro IAP attached for first-release co-review. Two Transporter bounces fixed permanently in the script (409 missing `LSApplicationCategoryType`; 91109 `com.apple.quarantine` xattr). The human ship-gate PASSED → Submitted for Review — MAS-SHIP-01/02/03/04/05.

In-flight (during the ship-gate, under the binding harness): dark macOS Overlay titlebar + window drag region + light-mode titlebar legibility (new `platform.window.setTheme` seam) + sidebar scroll at the size floor + upsell copy cleanup; a `scripts/build.sh <direct|appstore|appstore-pkg>` wrapper (sources `.env`, never prints it) + `scripts/ui-capture.sh` for native-window screenshot verification of both channels (harness step-5 upgrade). Gates held: 23/23 MAS-* requirements; decoder.ts + its 19 tests byte-for-byte untouched; direct channel un-regressed (signed+notarised universal DMG, no publish); suite 1279/1279. Apple's review outcome is external/pending. Full detail: `milestones/v1.8-ROADMAP.md` · `milestones/v1.8-REQUIREMENTS.md`.

## v1.7 Settings & Preferences (Shipped: 2026-06-21)

**Phases:** 22, 22.1, 22.2, 23, 24, 25 · **Released:** app v0.4.1 (notarized DMG)

A native macOS Settings surface — a five-pane in-window modal (License · Appearance · Hotkeys · General · Updates) reached from app menu (⌘,) / tray / sidebar / ⌘K through the `platform/` event seam.

**Key accomplishments:**

- Shell-level `openSettings()` store + accessible in-window modal (Esc, focus trap + return-focus, `aria-modal`) + keyboard-navigable paned layout; License pane reuses `LicenseSettings` unchanged; all entry points (app menu ⌘, + tray via the platform seam, sidebar row, ⌘K) — SET-01..06.
- Follow-ups (22.1): app-menu product-name labels ("TinkerDev"); inline upsell/activation in the License pane via a shared `ActivationSurface`; the standalone `UpsellModal` removed → one upsell surface.
- Pro-gate ⌘K (22.2): a free user's ⌘K (and pin/drag/Alt+P/Reset) opens a focused Unlock-Pro modal over the shared `ActivationSurface`; `isPro(ents)` predicate (frontend-only); explicit license entry points stay free — revises SET-04.
- Appearance pane (23): theme (light/dark; "system" dropped) + accent, persisted via the prefs seam, applied live whole-app, flash-free launch, Pro gate-on-Save; fixed a cross-writer prefs-clobber data-loss bug — SET-07.
- Hotkeys + General panes (24): rebind the OS global summon (Rust re-register + conflict handling) + the ⌘K palette chord; launch-at-login (autostart plugin, the one scoped new-dep exception), start-in-tray, default tool — SET-08, SET-09.
- Updates pane (25): version + last-checked + Check-for-updates + Install, all via one shared `useUpdater` singleton (de-duped check + install, load-safe `lastUpdateCheck` stamp); App.tsx consumes it. D-25-5 revised (Install in the pane); a codex adversarial pass fixed a HIGH data-loss path (stamp could persist defaults over the real blob after a failed read) — SET-10.

Gates held: decoder.ts + its 19 tests byte-for-byte untouched; WCAG-AA (gsd-ui-review per phase); real-WKWebView e2e + human sign-off per phase. Full detail: `milestones/v1.7-ROADMAP.md` · `milestones/v1.7-REQUIREMENTS.md`.

## v1.6 Licensing (Shipped: 2026-06-17)

**Phases:** 18–21

A one-time-payment lifetime-license system: MoR checkout → webhook → Keygen → emailed key → in-app paste-activation (HMAC fingerprint, one machine) → offline Ed25519-verified `machine.lic` thereafter, with self-serve transfer + revocation, behind a central frontend entitlement gate (free keeps all 11 tools; Pro unlocks customization).

**Key accomplishments:**

- Entitlements seam + central gate (18): registry + app-level gating, lock badges + upsell panel, lazy registry loaders; everything-unlocked in-Tauri default until Phase 21 flips it — ENT-01..05.
- License activation + offline verification (19): pure Rust core (HMAC fingerprint, fail-closed Ed25519 `machine.lic` verify, atomic store, Keychain), 4 Tauri commands behind the `platform.license` seam, activation UX; the D-42 spike (client-side key→token exchange denied on CE → raw key Keychain-stored) — LIC-01/02/03/04/06.
- Purchase pipeline (20): MoR checkout → webhook backend (LS `order_created` verify + idempotent Keygen create + Resend email) → key emailed; prod CE live on `license.tinkerdev.io`; live purchase proven end-to-end 2026-06-17 (order 8722394) — PAY-01/02/03.
- License lifecycle + ship gate (21): TTL refresh + offline grace, self-serve transfer, revocation propagation, status UI; flipped the free-tier default live; full 8-case ship-gate matrix (live cases 1/2/7/8 run + passed by the user vs prod CE) — LIC-05/07/08/09.

Key decisions: Keygen perpetual + node-locked (`maxMachines=1`); license key in Keychain (Rust-owned, never in JS); webview gating = UX-gating, not DRM; "no network at runtime" gained a narrow licensing-only exception. Gates held: decoder.ts + its 19 tests untouched; zero new webview runtime deps. Full detail: `milestones/v1.6-ROADMAP.md` · `milestones/v1.6-REQUIREMENTS.md`.

## v1.5 Pinned Tools (Shipped: 2026-06-07)

**Phases completed:** 1 phase (17), 2 plans, 4 tasks (+ post-walkthrough gap-closure fixes)
**Delivered:** Users **pin favourite tools to a distinct "Pinned" section** at the top of the sidebar, above the rest — extending v1.4's personalization. Pinning is a render-time `pinnedToolIds: string[]` overlay persisted through the existing prefs seam (beside `toolOrder`), reconciled against the live registry on load (drop unknown, de-dupe — never crash/drop/duplicate); the partition is always a full registry partition. The registry stays the single control plane (⌘K palette + router pin-agnostic). All 9 PIN requirements validated on the real WKWebView; zero new runtime/dev deps; the hero `decoder.ts` + its 19 tests byte-for-byte untouched.

**Key accomplishments:**

- **Persistence + pure pinning/partition backbone (Plan 17-01, PIN-07/08)** — an additive `pinnedToolIds: string[]` Preferences field (default `[]`) persisted through the prefs seam, with `coercePinnedToolIds` untrusted-merge (non-array → `[]`, drop non-strings, de-dupe, no cap) wired into `mergePreferences`, plus `setPinnedToolIds`/`togglePinned` setters. The pure, fully-tested `partitionTools(pinnedToolIds, toolOrder, registryIds) → { pinned, unpinned }` always returns a full registry partition (every tool in exactly one group), reusing `reconcileToolOrder` for the unpinned remainder. 10-case immovable-bar matrix + setter/coercer tests.
- **Two-group Pinned Sidebar UI (Plan 17-02, PIN-01..06/09)** — `Sidebar.tsx` renders an SR-named "Pinned tools" group + a bare neutral divider (gated on the post-reconcile `pinned.length`, not the raw pref) above the "Tools" group, both projected from `partitionTools` over `ENABLED_TOOLS` (registry/⌘K/router untouched). A left-of-grip pin toggle (persistent filled on pinned rows, outline on hover/focus-visible for unpinned), **Alt+P** to pin/unpin the focused tool (announced "Pinned/Unpinned {name}" via the existing `aria-live`), independent per-group drag + Alt+↑/↓ reorder (`draggingGroup`-scoped, never across the divider), and a keyboard-reachable "Unpin all" as a second item in the Shift+F10 reset menu.
- **Pinning is an overlay, never a registry mutation** — the registry stays the single control plane; accent stays selected-only (pin/divider chrome uses neutral tokens). Unknown/removed pinned IDs drop, duplicates collapse: the list can never crash, drop, or duplicate a tool.
- **Post-walkthrough keyboard-model fixes (D-17, supersedes the planned D-05 "no roving nav")** — live macOS testing surfaced two issues, fixed before sign-off: **(a)** Alt+P was dead because macOS composes Option+P into the character "π" (`e.key` was never "p") — now matches the physical key `e.code === "KeyP"`, with the e2e upgraded to dispatch the real `key:'π'/code:'KeyP'` shape as a genuine regression test; **(b)** the keyboard model became Tab-friendly — every row is a Tab stop AND the pin button is Tab-reachable (Enter/Space pins, a keyboard fallback), plain ↑/↓ + Home/End move focus tool-to-tool across the divider (pure `resolveRovingTarget` helper, +9 unit tests), Alt+↑/↓ still reorder within-group; pin+grip widened to 24×24 (WCAG 2.5.8). Also fixed a code-review focus-stranding bug (WR-01) and a pre-existing reorder-e2e pin-isolation flake.
- **Discipline held** — zero new runtime AND zero new devDependencies, HashRouter only, WCAG-AA (keyboard path + `aria-live` mandatory), the immovable `decoder.ts` + 19-test bar untouched. Full suite **694/694** at close; real-WKWebView e2e green (`scripts/e2e-spike.sh` 14/14, incl. the macOS Option+P + Tab-model + cross-divider-arrow specs); code review 0 critical; **gsd-ui-review WCAG-AA 23/24 (0 failures)**; human-signed-off on a fresh `tauri build` (`.app`/`.dmg` v0.3.0).

**Carry-forwards (non-blocking):** dedicated settings surface (deferred); auto-pin/lock-hero (deferred); unrelated `base64.e2e` first-worker mount-race flake logged to `deferred-items.md` (Phase 6 hardening candidate).

**Archived:** `.planning/milestones/v1.5-ROADMAP.md`, `.planning/milestones/v1.5-REQUIREMENTS.md`, `.planning/milestones/v1.5-phases/`.

---

## v1.4 Reorderable Tools (Shipped: 2026-06-05)

**Phases completed:** 1 phase (16), 2 plans, 5 tasks
**Delivered:** A user-reorderable sidebar tool list — the first personalization feature. Drag-and-drop (handle-initiated native HTML5 drag, no dnd library) plus an accessible Alt+↑/↓ keyboard path with `aria-live` announcements, persisted as a `toolOrder` overlay over the registry with graceful new/removed-tool reconciliation and a keyboard-reachable reset. All 7 REORD requirements validated on the real WKWebView; zero new runtime/dev deps; the hero `decoder.ts` + its 19 tests byte-for-byte untouched.

**Key accomplishments:**

- **Persistence + pure ordering backbone (Plan 16-01, REORD-05/06/07)** — an additive `toolOrder: string[]` Preferences field persisted through the existing prefs seam (`coerceToolOrder` untrusted-merge — string-only, de-dupe, no length cap, non-array → `[]`; `setToolOrder` write-on-change setter), plus two pure, fully-tested helpers: `reconcileToolOrder` (D-11 render overlay — honors saved order gated by registry-membership, appends missing registry IDs, drops unknown/removed IDs, collapses duplicates; output **always a registry permutation**) and `moveToolInOrder` (clamped relocate shared by drag and the Alt+arrow path). 13 toolOrder + 14 prefsStore + 13 usePreferences cases green.
- **Reorderable Sidebar UI (Plan 16-02, REORD-01..07)** — `Sidebar.tsx` renders the reconciled `toolOrder` overlay over `ENABLED_TOOLS` (registry array, ⌘K palette, and router never mutated). A `GripVertical` handle on row hover + `focus-visible` is the only `draggable` element, so a plain `NavLink` click still navigates; a neutral (`tx-2`, NOT accent) insertion line — plus an end-of-list drop zone — shows the drop position. Alt+↑/↓ moves the focused tool one slot per press and re-focuses it after re-render (plain arrows stay unbound — no roving nav). One visually-hidden `aria-live="polite"` region announces "Moved {tool} to position N of M" using the registry-controlled `tool.name`. A right-click + keyboard-reachable Shift+F10 (focus-on-open, Escape-restore) "Reset order" sets `toolOrder=[]`.
- **Ordering is an overlay, never a registry mutation** — the registry stays the single control plane; accent stays selected-only (reorder chrome — grip, insertion line — uses neutral tokens). New tools append, unknown/removed IDs drop, duplicates collapse: the list can never crash, drop, or duplicate a tool.
- **Discipline held** — zero new runtime AND zero new devDependencies, HashRouter only, WCAG-AA (the keyboard path + `aria-live` are mandatory, not optional), and the immovable `decoder.ts` + 19-test bar untouched. Full suite **668/668** at close; real-WKWebView e2e 14/14; code review 0 critical (2 warnings fixed `da94809c`); security 8/8 STRIDE; **gsd-ui-review WCAG-AA 22/24** (all 3 findings fixed); human-signed-off on a fresh `tauri build`.
- **Post-ship fix (`1c2c7664`)** — mouse drag showed the drag image but never moved rows on the real WKWebView: Tauri v2 window `dragDropEnabled` defaults to `true`, so the OS file-drop handler intercepted the webview's HTML5 `dragover`/`drop` (the keyboard path was unaffected). Set `dragDropEnabled:false` in `tauri.conf.json` (safe — no file-drop feature); verified in a fresh build. Not caught by the gates because WebDriver can't synthesize native OS drag, so the e2e only exercised the keyboard path.

**Archived:** `.planning/milestones/v1.4-ROADMAP.md`, `.planning/milestones/v1.4-REQUIREMENTS.md`.

---

## v1.3 More Tools (Shipped: 2026-06-04)

**Phases completed:** 4 phases (12–15), 11 plans, 14 tasks
**Delivered:** Three new high-frequency tools (URL, Regex, Cron) + a Protobuf decimal-byte-array input mode — eight tools → eleven. Four fully-independent features, risk-ordered (smallest/safest first, the two deep tools last). All 25 requirements validated end-to-end on the real WKWebView; zero new runtime deps; the hero `decoder.ts` + its 19 tests byte-for-byte untouched throughout.

**Key accomplishments:**

- **Protobuf decimal input (Phase 12, PRO-08/09)** — a third auto-detected input mode for the hero: a strict `decimalToBytes` parser + comma-first `detectEncoding` branch in `src/lib/bytes.ts` (decoder NOT touched), surfaced as a `decimal` toggle segment with example chip and named-token inline errors. 24/24 WCAG-AA sign-off.
- **URL tool (Phase 13, the 9th tool, URL-01..05)** — a thin error-as-value view over native `URL`/`URLSearchParams`/`encodeURI(Component)`: parsed-component readout + from-scratch decoded query key→value table (repeated keys + empty values preserved), and component-vs-full encode/decode both directions. Extracted the shared `SegmentedControl` reused by Phases 14/15.
- **Regex tester (Phase 14, the 10th tool, RGX-01..07)** — live highlighted matches (escaped React nodes, never `dangerouslySetInnerHTML`), numbered+named capture-group breakdown, g/i/m/s/u flags, `$1`/`$<name>`/`$&` replace preview, and a 3-pattern library. **ReDoS safety is structural:** matching runs off-thread in a Vite module Worker behind a watchdog armed before construction — a catastrophic pattern can never freeze the window.
- **Cron tool (Phase 15, the 11th tool, CRON-01..11)** — paste → plain 24-hour-English description + the next 5 runs in local time with an IANA TZ label, over a hand-rolled pure core: full field grammar, macros + `@reboot`, 5/6-field disambiguation, DOM/DOW OR-union (0/7-Sunday), **DST-correct next-run by wall-clock component read-back (not ms-deltas)**, a bounded cap so impossible expressions terminate as a calm "never", and leap-aware `L`/`nL`/`L-n` shipped as an isolated final slice.
- **Discipline held across all four** — zero new runtime AND zero new devDependencies, HashRouter only, registry as the single control plane (sidebar/palette/router auto-derived), WCAG-AA on every tool, and the immovable `decoder.ts` + 19-test bar untouched (`git diff --quiet`) through the whole milestone. Full suite 650/650 at close.

---

## v1.2 Release Tooling (Shipped: 2026-06-03)

**Phases completed:** 3 phases (9–11), 8 plans, 24 tasks
**Delivered:** `pnpm release:bump` + `pnpm release:publish` over a unit-tested pure release core — lockstep multi-manifest bump/tag/push and a universal-binary, dual-key, signature-verified cross-repo publish. Proven live (v0.2.2 + DST-02 updater round-trip). All 12 REL requirements; zero new runtime deps; decoder's 19 tests untouched. CI parked (999.2).

**Key accomplishments:**

- Hand-rolled `bumpSemver` plus three surgical `setXVersion` string editors in a new `src/lib/release/version.ts` (zero deps, 25 vitest cases incl. the `[package]`-scoped Cargo dependency-pin proof), then dogfooded `setCargoVersion` to reconcile `Cargo.toml` 0.1.0 -> 0.2.1.
- A PURE `buildLatestJson({version,pubDate,url,signature,notes?})` plus a dual-key `platformKey` in a new `src/lib/release/manifest.ts` (zero deps): both `darwin-aarch64` and `darwin-x86_64` are built from ONE `{url,signature}` so they can never diverge, no combined single-key variant is emitted, `notes` defaults to `""`, and `pub_date` is sourced only from the injected arg — covered by 8 vitest cases.
- Committed the Phase-9-deferred `Cargo.lock` `devtools-app` `0.1.0 -> 0.2.1` reconcile as a standalone `chore(release):` housekeeping commit, leaving the source tree clean so the upcoming bump driver's clean-tree preflight starts from a known-good state.
- Side-effect-free `bumpPlan.ts` decision core — D-01/D-02 CLI grammar, a single-computed-version plan threaded into 3 manifests + tag + commit message, a pnpm-lock-no-op-tolerant allowlist diff, and pure dry-run/recovery text — all TDD-covered (47 new cases), giving REL-01/REL-10/REL-11 automated verification.
- `scripts/bump-and-tag.mjs` wires the pure bumpPlan core to real git/pnpm/cargo I/O behind `pnpm release:bump`, and cut the live v0.2.2 release — lockstep 3-manifest bump, regenerated lockfiles, annotated `v0.2.2` tag, and commit+tag pushed to the private origin after a y/N confirm.
- Side-effect-free `publishPlan.ts` — `--dry-run` arg parse, single-fresh-`.sig` assertion (fail on 0/>1), strict both-arch `lipo` parse, public-repo asset URL, served-version match, boolean-only signing/Apple env checks, and dry-run plan/recovery render strings — fully TDD'd (33 cases), mirroring the Phase 10 `bumpPlan.ts` split.
- Thin `scripts/build-and-publish.mjs` over the pure `publishPlan.ts` core + Phase 9 `buildLatestJson` — read-only preflights -> `--dry-run` short-circuit (NO build, zero side effects) -> rustup add -> universal `tauri build` -> `lipo` both-arch assert -> fresh-`.sig` single-match glob -> `latest.json` -> cross-repo `gh` publish (assets first, manifest last) -> `curl` served-version verify -> manual round-trip gate, wired to `pnpm release:publish`.
- v0.2.2 was built as a universal binary, published to `bklim5/devtools-releases`, and an older install auto-updated to it through the mandatory minisign verify — DST-02 proven live on real hardware.

---

## v1.1 Formatters (Shipped: 2026-06-02)

**Phases completed:** 2 phases (7–8), 4 plans, ~11 tasks
**Git:** 49 commits, 54 files changed (+5,153 / −187) — same-day (2026-06-02)
**Final state:** 378 vitest / 44 files green, `tsc`/`eslint` clean, **zero new runtime deps**, decoder + its 19 tests byte-for-byte untouched.

**Key accomplishments:**

- **Shared formatter foundation (Phase 7-01)** — promoted `ResizableSplit` to `src/components/`, added an additive `StatusBar` input→output byte-delta prop, and defined the pure `FormatResult`/`FormatOptions`/`IndentMode` contract — the three shared surfaces both formatters depend on, landed conflict-free in wave 1.
- **JSON formatter (Phase 7-02)** — shipped a pure zero-dep `formatJson` (validate with engine-portable line:col, prettify 2/4/tab, minify-wins, recursive sort-keys preserving array order), the shared JSON/XML-agnostic two-pane paste-instant `FormatterView` (resizable input | read-only copy-bearing output + shared toolbar + StatusBar byte delta), and a thin `JsonFormatterTool` registered registry-only, with a real-WKWebView e2e spec.
- **XML formatter (Phase 7-03)** — shipped a pure zero-dep `formatXml` over native `DOMParser`/`XMLSerializer` (well-formedness validation surfacing `<parsererror>` with line; prettify 2/4/tab preserving comments/CDATA/attributes/PIs + the `<?xml?>` declaration; minify stripping inter-element whitespace; empty→ok-empty; XXE-safe), the thin `XmlFormatterTool` reusing the shared `FormatterView` without sort-keys, registered registry-only alongside JSON.
- **StatusBar size-readout cleanup (Phase 8, UIX-01)** — made `StatusBar.byteCount` optional and gated the `aria-label="byte count"` size span on `typeof byteCount === "number"` (minimal additive API, no other behavior changed); kept the readout on Base64/Hex/Bytes + Protobuf + both Formatters, dropped it from Hash/UUID·ULID/Unix Time/JWT, locked by a present-where-kept / absent-where-dropped test matrix.
- **Discipline held end-to-end** — every phase passed the full binding harness: code review (3 warnings fixed in Phase 7, clean in Phase 8), phase verification (5/5 then 4/4 must-haves), real-WKWebView e2e (10/10 specs on WebKit 605.1.15 — which caught a real `<parsererror>` regression unit tests missed), `gsd-ui-review` WCAG-AA PASS, and human sign-off on a fresh `tauri build` at each phase boundary.

**Archived:** `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`.

---

## v1.0 Distribution (Shipped: 2026-06-02)

**Phases completed:** 10 phases, 28 plans, 63 tasks

**Key accomplishments:**

- Tauri 2 + Vite 7 + React 19 + TS app scaffolded in place with the `@/` alias resolving across vite/tsconfig/vitest, the verified `src/lib/` ported byte-for-byte (19/19 decoder tests green), Tailwind v4 design tokens, vendored fonts (zero CDN), and a clipboard-enabled Rust core rendering a dark window.
- Environment-safe `src/lib/platform` clipboard seam (runtime Tauri detection + lazy import + navigator.clipboard fallback + injectable test seam), the verbatim HashRouter booted via an enabled:true skeleton registration, a jsdom RUNTIME proof that RouterProvider mounts and unknown routes redirect to `/tools/_skeleton`, and a throwaway byte-inspector skeleton (instant paste, visible+focusable copy through the seam, status bar) — all TDD-covered with the 19 decoder tests still green.
- Installed the mechanical pre-commit unit gate (lefthook running `tsc --noEmit` + `vitest run`, parallel) and PROVED non-destructively that it blocks a deliberate type error then passes clean — via `pnpm lefthook run pre-commit` on a staged temp probe, no real bad commit — then ran the first `pnpm tauri build` to produce a runnable unsigned (adhoc) macOS `devtools-app.app` (9.7M) + `.dmg` (4.1M), launch-confirmed, with all findings + the gate-boundary + Plan-04 hand-off in `docs/phase-0-notes.md`. `package.json`/lockfile/`src` untouched (HIGH-2).
- Proved the macOS real-WKWebView automation path end-to-end (tauri-plugin-webdriver drives our app: find -> sendKeys -> screenshot, 1 passing) via a reproducible UI-gate script, ran the WCAG-AA audit, and shipped an authoritative final build with the WebDriver server verified absent from release — after fixing a gating bug that was leaking the server into release builds.
- Real on-disk preference persistence behind the unchanged `Store` seam (Tauri plugin-store + localStorage fallback), the `store:default` capability wired, shell `@theme` CSS tokens, and the three tools enabled as a shared `makePlaceholder` — unblocking the registry-driven sidebar/palette/router for the rest of Phase 2.
- An in-house, zero-dependency subsequence fuzzy ranker (`rankTools`) that scores a query against each tool's name+keywords+description with name>keywords>description weighting and contiguous-run/word-boundary bonuses — the matching engine the ⌘K palette will use, built without cmdk/fuse.js per D-06.
- A typed `usePreferences` hook and `useRecentTools` tracker over the real `Store` seam (theme/accent + last-used + recents, all untrusted-merged over defaults), plus a single `resolveStartupTool` seam (explicit > last-used > hero) wired into the router's index/catch-all so the app boots straight to the right tool — with the async-store timing handled (Pitfall 3) so last-used actually restores.
- The visible registry-driven shell: a compact sidebar (one NavLink per ENABLED_TOOL with mockup-accurate accent-reserved active styling), a ⌘K fuzzy command palette (recents-first empty state, no-mouse ↑/↓+Enter switch, quiet no-match, never auto-opens), and an `App.tsx` that wraps the routed `<Outlet/>` with both — proving the single control plane end-to-end. Build/code tasks complete and fully gated; the Phase-2 real-webview human-verify checkpoint was approved by the user (2026-05-30) after two production-only startup bugs were found and fixed (commit `d4e44f5`).
- 1. [Rule 3 - Blocking] useRecentTools cold-start fallback missed the new required field
- Four pure, node-unit-tested modules (detectEncoding, chipsForField, decodeInput, fieldsToJson) that map the UI 1:1 onto the real decoder's FieldValue/LenInterpretation shape — hex/base64 detection (D-02), presence-gated chips with smart default (D-04), error-as-string decode orchestration (PRO-01/02), and copy-as-JSON (D-11) — all green before any rendering.
- The schema-less Protobuf hero shipped into the shell Outlet: paste hex/base64 → instant recursive wire-format tree, LenInterpretation chips with a smart default + per-node override, VARINT zigzag/signed readings, auto-expanded sub-messages, an in-house resizable split, a persisted cards/rows toggle, neutral #N with accent reserved for selection, visible focusable per-node copy + copy-all-as-JSON, and a status bar — all thin React over 03-02's pure logic, proven on the real macOS WKWebView.
- Relocated the shared StatusBar to a tool-agnostic home + extracted CopyButton, hand-rolled pure ULID/UUIDv7/timeFormat libs (TDD against fixed vectors), installed js-md5@0.8.3 offline, and registered all four catalogue tools as placeholders — concentrating every registry.ts edit in Wave 1 so the four Wave-2 tool plans run conflict-free.
- Shipped the real two-way Unix Time converter (TIME-01) into the registry-driven shell — paste an s/ms timestamp for instant LOCAL + UTC + ISO with magnitude auto-detect + s/ms override, an editable ISO field that derives the timestamp back (D-06), and a live "now" with ≤1-keystroke copy — all over Plan 01's shared `timeFormat` lib (zero date-math duplication), TDD'd in 8 cases and gated on the real macOS WKWebView.
- Shipped the display-only JWT tool (JWT-01) into the registry-driven shell: a pure `decodeJwt` that splits→base64url-decodes (via `bytes.ts`, no hand-rolled base64)→JSON-parses the header+payload with a token/header/payload field-scoped error taxonomy that never throws, plus a thin `JwtTool` UI rendering pretty-printed Header/Payload + the raw Signature + `alg`, with `exp`/`iat`/`nbf` humanized through the shared `timeFormat` lib and expired/not-yet-valid tokens visibly flagged — no signature verification, no key input (D-09).
- Shipped the Hash tool into the registry: an input-encoding toggle (UTF-8/hex/base64) parses one internal `Uint8Array` via `bytes.ts`, then MD5 (sync, js-md5) + SHA-1/256/384/512 (async, Web Crypto `crypto.subtle.digest`) render all five stacked at once with a lowercase-default/uppercase casing toggle and a visible focusable per-row copy — the async SHA tagged to their source bytes so fast typing never shows a stale digest, and the secure-context Web-Crypto path proven on the real macOS WKWebView.
- Shipped the UUID/ULID tool (UID-01) into the registry — a pure `decodeId` that auto-detects a pasted UUID vs ULID and returns a full breakdown (or an explicit no-throw error), plus a `UuidUlidTool` UI that generates UUID v4 / v7 / ULID (one on open, single-keystroke regen, optional batch + copy-all) from a CSPRNG and decodes ids live — consuming the Plan-01 `ulid.ts`/`uuidv7.ts` libs verbatim with zero duplication.
- Verified the complete six-tool v1 catalogue to the binding harness — full unit suite (269/269, decoder 19 untouched), `tsc` clean, `eslint` 0, all four new tools' real-WKWebView e2e specs green (6/6 on webkit, including the load-bearing hash SHA-256 and uuid-ulid crypto secure-context checks), a fresh `tauri build` producing a runnable `.app` + `.dmg` (exit 0, webdriver absent from the release binary), and a PASSING WCAG-AA audit (24/24, no blockers) recorded in `04-UI-REVIEW.md` — then paused at the human sign-off checkpoint on the packaged bundle.
- Closed the five Phase-4 human-UAT defects: text-only flicker-free Hash tool, an editable UUID count hard-capped at 100, and cursor-pointer on every Phase-4 button — all green on the full unit suite, tsc, eslint, and the 7-spec real-WKWebView gate.
- 1. [Rule 2 - Missing critical functionality] Tray left-click summons via `show_menu_on_left_click(false)`
- Extended `src/lib/platform/` with `window` (summon/focus) and `nativeShortcut` (OS global hotkey) capabilities — real impls in tauri.ts via @tauri-apps/api/window + plugin-global-shortcut, harmless browser no-ops, 8/8 seam unit tests — so Plan 03's shell can summon/register without ever importing @tauri-apps.
- A single seam-only `summon.ts` owns the named `CommandOrControl+Shift+D` chord and a `registerSummon()` that registers the global hotkey via `platform.nativeShortcut` and — on fire — summons the window `unminimize→show→setFocus` (macOS-safe order); wired once into startup, with a real-WKWebView e2e proving the app launches non-blank and the HashRouter deep-link path works.
- Status: PAUSED at the Task-2 human-verify checkpoint.
- Registered the updater + process Rust plugins, added a Check for Updates… tray item with least-privilege capabilities, and configured tauri.conf.json with the updater block (committed minisign pubkey + bklim5/devtools endpoint), createUpdaterArtifacts, a wired-but-gated bundle.macOS (ad-hoc + hardened runtime + offline entitlements), and a GitHub-scoped CSP — turning the app into a buildable, updater-emitting, ad-hoc-signed bundle whose Developer-ID activation is a credentials-only flip.
- Shipped DST-02's user-facing flow — first-run opt-in (persisted), silent launch check ONLY when opted in, always-available manual tray-check via `menu://check-updates`, and a re-appearing dismissible WCAG-AA `UpdateBanner` whose Install verifies-then-relaunches — all routed through `src/lib/platform` (no `@tauri-apps` in the shell). Orchestration (`update.ts`) is error-as-value (never crashes the shell); install is the one path that propagates so a forged update surfaces an error instead of silently installing.
- RELEASE.md runbook + a real signature-verified updater round-trip (0.2.0 → 0.2.1) over a split-repo distribution (private source / public release host), closing DST-01 ("release-ready, pending cert") and DST-02 (verify-before-apply) — Phase 6 signed off.

---
