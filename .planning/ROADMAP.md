# Roadmap: DevTools

## Milestones

- ✅ **v1.0 Distribution** — Phases 1–6 (shipped 2026-06-01) — see `milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 Formatters** — Phases 7–8 (shipped 2026-06-02) — see `milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Release Tooling** — Phases 9–11 (shipped 2026-06-03) — see `milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 More Tools** — Phases 12–15 (shipped 2026-06-04) — see `milestones/v1.3-ROADMAP.md`
- ✅ **v1.4 Reorderable Tools** — Phase 16 (shipped 2026-06-05) — see `milestones/v1.4-ROADMAP.md`
- ✅ **v1.5 Pinned Tools** — Phase 17 (shipped 2026-06-07) — see `milestones/v1.5-ROADMAP.md`
- 🚧 **v1.6 Licensing** — Phases 18–21 (in progress, started 2026-06-09)
- 🚧 **v1.7 Settings & Preferences** — Phases 22–25 (started 2026-06-15, non-destructively while v1.6 finishes sign-off)

## Phases

<details>
<summary>✅ v1.0 Distribution (Phases 1–6) — SHIPPED 2026-06-01</summary>

- [x] Phase 1: Scaffold + Harness Proof (4/4 plans) — completed 2026-05-30
- [x] Phase 2: Shell (4/4 plans) — completed 2026-05-30
- [x] Phase 3: Hero (Protobuf) + Encoding + UX Constraints (signed off 2026-05-31)
- [x] Phase 4: Catalogue (Unix Time, JWT, Hash, UUID/ULID) — signed off 2026-06-01
- [x] Phase 5: Native Polish (tray/menu, single-instance, window-geometry) — 2026-06-01
- [x] Phase 6: Distribution (signed DMG + signature-verified auto-updater) — signed off 2026-06-01

Full detail: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Formatters (Phases 7–8) — SHIPPED 2026-06-02</summary>

- [x] Phase 7: Formatters — shared `FormatterView` + JSON formatter + XML formatter (zero-dep, native `JSON`/`DOMParser`) — validate/prettify/minify, plus JSON sort-keys (3/3 plans) — completed 2026-06-02
- [x] Phase 8: StatusBar Size-Readout Cleanup — make `StatusBar` byteCount opt-in; keep it on Base64/Protobuf/Formatters, drop it from Hash/UUID/Unix Time/JWT (1/1 plan) — completed 2026-06-02

Full detail: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Release Tooling (Phases 9–11) — SHIPPED 2026-06-03</summary>

Local release-automation helper scripts over a unit-tested pure core in `src/lib/release/` (zero new runtime deps; hero decoder + its 19 tests byte-untouched). CI parked to backlog 999.2.

- [x] Phase 9: Pure release core + housekeeping — `src/lib/release/version.ts` (bumpSemver + 3 surgical manifest editors) + `manifest.ts` (dual-key `buildLatestJson`); Cargo 0.1.0→0.2.1 reconcile (REL-02), `latest.json` untracked (REL-08) — completed 2026-06-02
- [x] Phase 10: `bump-and-tag` driver — `scripts/bump-and-tag.mjs` + `pnpm release:bump`: lockstep 3-manifest bump + lockfile regen (REL-01/03), `vX.Y.Z` tag + push to origin (REL-04), `--dry-run` (REL-10) + preflights (REL-11); live v0.2.2 cut — completed 2026-06-02
- [x] Phase 11: `build-and-publish` driver + universal binary — `scripts/build-and-publish.mjs` + `pnpm release:publish`: universal `tauri build` (REL-05), fresh-`.sig` dual-key `latest.json` (REL-06), cross-repo `gh` publish (REL-07), `APPLE_*` passthrough (REL-09), post-publish `curl` verify (REL-12); live v0.2.2 published + DST-02 updater round-trip proven on real hardware — completed 2026-06-03

All 12 REL requirements complete. Full detail: `.planning/milestones/v1.2-ROADMAP.md` · audit: `milestones/v1.2-MILESTONE-AUDIT.md`

</details>

<details>
<summary>✅ v1.3 More Tools (Phases 12–15) — SHIPPED 2026-06-04</summary>

Three new high-frequency tools (URL, Regex, Cron) + a Protobuf decimal-byte-array input mode — eight tools → eleven. Four fully-independent features, risk-ordered; zero new runtime deps; hero `decoder.ts` + its 19 tests byte-for-byte untouched throughout.

- [x] Phase 12: Protobuf decimal input — comma/space-separated decimal byte array as a third auto-detected input mode (`decimalToBytes` in `src/lib/bytes.ts`; decoder untouched); PRO-08/09 — completed 2026-06-03
- [x] Phase 13: URL tool (9th) — parse into components + query key→value table, component-vs-full encode/decode both ways over native `URL`/`URLSearchParams`; extracted shared `SegmentedControl`; URL-01..05 — completed 2026-06-03
- [x] Phase 14: Regex tester (10th) — live highlighted matches, capture-group breakdown, g/i/m/s/u flags, `$1`/`$<name>`/`$&` replace preview, 3-pattern library, ReDoS-safe via a Web Worker + timeout watchdog; RGX-01..07 — completed 2026-06-03
- [x] Phase 15: Cron tool (11th) — paste → 24h description + next 5 runs in local time with IANA TZ label; 5/6-field, macros, full syntax, DOM/DOW OR-union, DST-correct bounded next-run, isolated `L`/`nL`/`L-n` slice; CRON-01..11 — completed 2026-06-04

All 25 requirements complete. Full detail: `.planning/milestones/v1.3-ROADMAP.md` · requirements: `milestones/v1.3-REQUIREMENTS.md`

</details>

<details>
<summary>✅ v1.4 Reorderable Tools (Phase 16) — SHIPPED 2026-06-05</summary>

A focused single-feature milestone: a user-reorderable sidebar tool list (the first personalization feature). Drag-to-reorder (handle-initiated native drag, no dnd library) plus an accessible Alt+↑/↓ keyboard path with `aria-live` announcements, the custom order persisted as a `toolOrder` overlay over the registry, with graceful reconciliation for new/removed tools and a reset-to-default action. Promoted from backlog 999.6 (12 locked decisions). Zero new runtime deps; WCAG-AA; registry stays the single control plane; `decoder.ts` + its 19 tests untouched.

- [x] Phase 16: Reorderable sidebar tool list — drag + Alt+↑/↓ keyboard reorder, `aria-live` announcements, persisted `toolOrder` overlay, new-tool-append reconciliation, reset-to-default; REORD-01..07 (2/2 plans) — completed 2026-06-05

All 7 REORD requirements complete. Full detail: `.planning/milestones/v1.4-ROADMAP.md` · requirements: `milestones/v1.4-REQUIREMENTS.md`

</details>

<details>
<summary>✅ v1.5 Pinned Tools (Phase 17) — SHIPPED 2026-06-07</summary>

A focused single-feature milestone extending v1.4's personalization: users **pin favourite tools to a distinct, reorderable "Pinned" section at the top of the sidebar**, independent of the v1.4 custom order. Pinning is a render-time `pinnedToolIds` overlay persisted through the existing prefs seam (beside `toolOrder`/`recentToolIds`) and reconciled against the live registry on load; the registry stays the single control plane (⌘K palette + router pin-agnostic). Reuses v1.4's `reconcileToolOrder`/`moveToolInOrder` helpers, the drag + Alt+↑/↓ keyboard reorder, and the `aria-live` pattern. Zero new runtime/dev deps; WCAG-AA; `decoder.ts` + its 19 tests untouched. Default: no tool pinned (settings surface + auto-pin-hero deferred).

- [x] Phase 17: Pinned sidebar section — pin/unpin via a row pin icon (persistent-filled / hover + focus-visible) + **Alt+P** (`aria-live`-announced), a "Pinned" group with divider shown only when ≥1 tool pinned, independent per-group drag + Alt+↑/↓ reorder (no cross-boundary drag), persisted + reconciled `pinnedToolIds` overlay (drop unknown, de-dupe), and a keyboard-reachable "Unpin all"; PIN-01..09 (2/2 plans) — completed 2026-06-07

All 9 PIN requirements complete; human-signed-off (full suite 694/694, decoder 19/19 untouched, gsd-ui-review WCAG-AA 23/24). Post-walkthrough keyboard-model fixes (D-17): Alt+P physical-`KeyP` (macOS Option+P composes to "π"), Tab-reachable rows + pin fallback, ↑/↓ focus nav, 24×24 targets. Full detail: `.planning/milestones/v1.5-ROADMAP.md` · requirements: `milestones/v1.5-REQUIREMENTS.md`

</details>

### 🚧 v1.6 Licensing (Phases 18–21) — IN PROGRESS

One-time-payment lifetime license: MoR checkout → webhook → Keygen (perpetual, node-locked, `maxMachines=1`); paste-key one-time activation (fingerprint `HMAC-SHA256(IOPlatformUUID, app-salt)`); thereafter fully-offline Ed25519-verified `machine.lic` (~30-day TTL) in Rust; license key in macOS Keychain (Rust-owned); free tier keeps all 11 tools; Pro gates customization (theming + ordering/pinning) behind ONE central entitlement gate (D-18 pivot — tool-gating mechanism ships dormant). Architecture locked in `docs/licensing-research.md`. Webview gating accepted as UX-gating, not DRM. Webview runtime deps stay zero (Rust crates `ed25519-dalek`/`keyring`/HMAC allowed); `decoder.ts` + its 19 tests byte-for-byte untouched.

- [x] **Phase 18: Entitlements Seam & Central Gate** - Pure-frontend entitlement gating (registry + app-level) with lock badges + upsell panel; lazy registry loaders; everything-unlocked in-Tauri default until licensing lands (completed 2026-06-10)
- [x] **Phase 19: License Activation & Offline Verification** - Keygen Rust core: paste-key activation, fingerprint, Ed25519 offline launch verify, Keychain storage, fail-closed; includes the key→token exchange SPIKE (completed 2026-06-12)
- [ ] **Phase 20: Purchase Pipeline** - MoR checkout (Lemon Squeezy default) → webhook backend → Keygen license creation → key emailed; privileged tokens server-side only (parallel-capable with Phase 19)
- [ ] **Phase 21: License Lifecycle & Ship Gate** - TTL refresh + offline grace, self-serve transfer, revocation propagation, license status UI; flip the free-tier default live; full 8-case ship-gate matrix

### 🚧 v1.7 Settings & Preferences (Phases 22–25) — IN PROGRESS

A native macOS Settings/Preferences surface (promotes backlog 999.9; absorbs 999.3 theme settings + the parked NAT-01/G-05-1 summon hotkey). **Architecture (locked):** a full **in-window modal overlay** (Claude-style) mounted shell-level via an `openSettings()` store — the Phase-21 upsell-modal pattern (`src/shell/upsellStore.ts`/`useUpsell.ts` + `src/App.tsx` mount) — **NOT a separate OS window** (lowest risk; shares the single React root + prefs/entitlements/HashRouter; no multi-window, no IPC). Native app-menu (`TinkerDev ▸ Settings…`, ⌘,) + tray `Settings…` entry points live in Rust and reach the webview through the `src/lib/platform/` event seam (tools/components never import `@tauri-apps/*` directly). The License pane **reuses `src/components/LicenseSettings.tsx` unchanged**. WCAG-AA mandatory (focus trap + return-focus, `aria-modal`, `aria-live`, full keyboard path); HashRouter only; layout-agnostic; zero new webview runtime deps **except** the autostart plugin needed by SET-09 launch-at-login (a NEW dep → explicit scoped exception, called out in Phase 24); `src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched; the real-WKWebView e2e gate + a phase-boundary human sign-off + `gsd-ui-review` apply to every phase.

- [x] **Phase 22: Settings Modal Shell, Entry Points & License Pane** — shell-level `openSettings()` store + full in-window modal (Esc-dismiss, focus trap + return-focus, `aria-modal`) + paned layout (left nav / right content, keyboard-navigable); all four entry points (app menu ⌘, + tray via the `platform/` event seam, sidebar "Settings" row above "Unlock Pro", ⌘K); License pane reusing `LicenseSettings` unchanged; SET-01..06 (completed 2026-06-15)
- [x] **Phase 22.1: Settings Follow-ups (INSERTED)** — gap closure from `22-FOLLOWUP.md`: (1) app-menu product-name labels (App submenu title "TinkerDev" + explicit About/Hide/Quit text, not the `devtools-app` bin name); (2) inline upsell/activation in the Settings ▸ License pane via a shared `ActivationSurface` extracted from `UpsellPanel`. Grew to 4 plans + a post-review fix batch: **the standalone `UpsellModal` was REMOVED** (D-22.1-5/D-28/D-29 reversed — every opener routes to Settings ▸ License = ONE upsell surface), the pane was redesigned (warn/ok token triads, $9 in-app pricing reversing D-20, amber/green/red banners), a dev-only license-state e2e seam was added, and the UI-audit/Codex findings were fixed (masked-key detailed refresh, heading order h2→h4, locked-affordance focus-return, dead-Done removal). WCAG-AA + native menu re-verify (completed 2026-06-16)
- [x] **Phase 22.2: Pro-gate ⌘K + focused upsell modal (INSERTED)** — user-approved scope (2026-06-16): gate the ⌘K command palette behind Pro (free users get a focused Unlock-Pro modal instead of the palette) and route the contextual locked customization triggers (pin/drag/Alt+P/Reset order) to that SAME focused modal rather than the full Settings ▸ License redirect. Re-introduces a thin modal wrapper over the existing shared `ActivationSurface` (one activation surface, two presentations — partially un-reverts D-22.1-5) driven by a minimal shared `upsellStore`. Gating via a new `isPro(ents)` predicate (frontend-only; existing licenses keep ⌘K immediately — no Keygen re-issue). Explicit license entry points (sidebar Settings row + Unlock-Pro footer + app-menu/tray + deep link) stay free → Settings ▸ License so a free user can still buy. Revises SET-04 (⌘K no longer opens for everyone)
- [x] **Phase 23: Appearance Pane** (completed 2026-06-17) — theme (light/dark — "system" dropped at user request) + accent, persisted via the prefs seam and applied live whole-app, flash-free launch, Pro gate-on-Save (absorbs backlog 999.3); SET-07. Human-approved on a fresh build after 3 walkthrough rounds (removed system, redesigned theme cards, widened upsell modal, fixed a cross-writer prefs-clobber data-loss bug)
- [ ] **Phase 24: Hotkeys & General Panes (native-touching)** — rebind the global summon hotkey (Rust global-shortcut re-register + conflict handling, promotes NAT-01/G-05-1) and the ⌘K palette chord (in-webview); General toggles (launch-at-login [autostart plugin → scoped dep exception], start-in-tray, default tool, show-license-in-sidebar); SET-08, SET-09
- [ ] **Phase 25: Updates Pane & Milestone Ship** — version + last-checked + Check-for-updates over the existing updater seam (mirrors the tray action); milestone polish + human sign-off; SET-10

## Phase Details (v1.6)

### Phase 18: Entitlements Seam & Central Gate
**Goal**: Feature gating exists as one central, testable seam — tools and app-level features resolve entitlements through a single gate, locked features stay visible-but-locked, and the registry is lazified — while the in-Tauri default keeps everything unlocked until licensing lands (flipped at Phase 21 integration)
**Depends on**: Nothing (pure frontend; first phase of v1.6)
**Requirements**: ENT-01, ENT-02, ENT-03, ENT-04, ENT-05
**Success Criteria** (what must be TRUE):
  1. With a free-tier entitlement set applied via the dev/test toggle, a fixture-locked tool stays visible in the sidebar and ⌘K palette with a neutral lock badge, and opening it shows a WCAG-AA unlock/upsell panel in place of the tool UI (mechanism proven, dormant in production — D-18; never hidden, no opacity-only state)
  2. Theming and tool ordering/pinning gate through the same app-level entitlement map — flipping the resolved set locks/unlocks them with no scattered per-feature checks (one central gate, registry stays the single control plane)
  3. React consumes only a resolved entitlement set (Rust command inside Tauri; deterministic free-tier default in browser/jsdom/vite-preview so tests never touch licensing); the in-Tauri default resolves to everything-unlocked pre-licensing, so shipped behavior is unchanged
  4. All registry tool entries load via lazy `component` loaders and the app behaves identically (paste-instant, full suite green, real-WKWebView e2e green) — a future free-build decoder code-split exclusion is now a real seam, with `decoder.ts` + its 19 tests byte-for-byte untouched
**Plans**: 4 plans (4/4 executed — phase complete, human sign-off 2026-06-10)

Plans:
- [x] 18-01-PLAN.md — Entitlements core seam: vocabulary + isToolLocked/gatePreferences, env-split resolver (Tauri→FULL, browser→FREE, D-31 downgrade-only override), snapshot store + useEntitlements, shared UpsellPanel (D-19..D-22)
- [x] 18-02-PLAN.md — Lazy registry (11 entries → LazyComponent loaders) + ToolRoute element gate (locked→upsell, no chunk fetch) + per-tool chunk/decoder-isolation proof (ENT-05/D-30)
- [x] 18-03-PLAN.md — Lock UX surfaces: sidebar D-26 gating + D-28 locked-affordance upsell + D-29 footer "Unlock Pro" + dormant lock badges (D-23..25); palette badges + DEV-only free-tier toggle (D-32)
- [x] 18-04-PLAN.md — D-18 doc reconciliation, real-WKWebView entitlements e2e + full e2e re-proof, dist-grep dev-strip check, phase-boundary build + human walkthrough

**UI hint**: yes

### Phase 19: License Activation & Offline Verification
**Goal**: A user with a license key can activate this Mac once online and thereafter launch fully licensed, fully offline — all verification and key material Rust-owned, never in the webview
**Depends on**: Phase 18 (entitlement gate to feed the resolved set into)
**Requirements**: LIC-01, LIC-02, LIC-03, LIC-04, LIC-06
**Success Criteria** (what must be TRUE):
  1. User pastes a license key in-app → one online activation validates against Keygen, binds the machine (fingerprint `HMAC-SHA256(IOPlatformUUID, app-salt)` computed in Rust), checks out and caches the Ed25519-signed `machine.lic` (Rust-owned app data), and full entitlements unlock without restart
  2. Activating the same key on a second Mac is rejected with a clear, calm error that names the resolution path (deactivate the other machine)
  3. After activation, launching with networking disabled still resolves licensed entitlements — Rust verifies the `machine.lic` Ed25519 signature with the embedded public key and checks the fingerprint, with zero network calls
  4. A corrupt, tampered, or foreign-machine `machine.lic` fails closed to the free tier — no crash, calm status messaging, re-activation offered
  5. The license key lives only in the macOS Keychain (Rust-owned, `keyring` crate) — never readable from JS, never in the Tauri store or app-data files; the SPIKE outcome on client-side license-key → license-token exchange against the live Keygen API is recorded (store a scoped token instead of the raw key if confirmed)
**Plans**: 4 plans

Plans:
- [x] 19-01-PLAN.md — Local Keygen CE bring-up (Docker compose + bootstrap) + the blocking D-42 SPIKE: lifecycle proven live, key→token denial + seat-limit payloads recorded in 19-SPIKE-OUTCOME.md, real machine.lic + pubkey fixtures committed
- [x] 19-02-PLAN.md — Pure Rust license core: per-env consts (D-40/D-41), HMAC fingerprint, fail-closed Ed25519 machine.lic verify (TDD, 9+ fixture cases incl. real-CE cross-validation), atomic store, trait-mocked Keychain, pure-local status path
- [x] 19-03-PLAN.md — Keygen HTTP client (validate→activate→checkout, D-38 offline/unreachable split, dev-only CA trust) + activation state machine + the 4 Tauri commands + platform-seam exposure with deterministic browser/test stubs
- [x] 19-04-PLAN.md — Activation UX in the shared upsell panel (D-33..D-39, D-44 problem state via Rust-side stored-key reactivation), D-43 footer attention, real-WKWebView e2e, phase-boundary build + human walkthrough vs live CE + gsd-ui-review
**UI hint**: yes

### Phase 20: Purchase Pipeline
**Goal**: A buyer can pay once through a merchant-of-record checkout and automatically receive a working license key by email — no manual fulfillment, no privileged credentials anywhere near the app
**Depends on**: Phase 18 (in-app "Buy license" affordance lives in the upsell panel); parallel-capable with Phase 19 (external infra — MoR + webhook backend)
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. The in-app "Buy license" affordance opens the MoR purchase page in the default browser (Lemon Squeezy default, seller payout-country verified before committing); checkout completes a one-time payment
  2. A completed purchase fires the `order_created` webhook → the small backend creates the Keygen license (perpetual, node-locked, `maxMachines=1`, entitlements embedded in the signed license) without manual steps
  3. The buyer receives the license key by email automatically after purchase, and that key activates successfully through the Phase 19 in-app flow
  4. Privileged Keygen tokens exist only server-side — verifiably absent from the app bundle, the repo, and every client-reachable surface
**Plans**: 3 plans (planned 2026-06-13)

Plans:
- [x] 20-01-PLAN.md — Buy-CTA opener seam (https-scoped) + UpsellPanel wiring + config.rs cfg(debug_assertions) prod/dev constant switch + dist-grep + Buy e2e (PAY-01, D-52/D-67/D-68; autonomous, wave 1) ✓ 2026-06-13 (PAY-01 Validated; e2e wave-merge gate blocked by a pre-existing shared dev-toggle flake — deferred-items.md)
- [x] 20-02-PLAN.md — TypeScript/Node webhook backend: LS order_created signature verify + Keygen idempotent license create (metadata.orderId, pro.theming/pro.ordering) + Resend key email; TDD, joins the vitest/tsc/eslint gate (PAY-02/PAY-03; autonomous, wave 1)
- [ ] 20-03-PLAN.md — Production CE bring-up: committed infra/keygen/ (real-ACME Caddy + webhook container + swap + idempotent setup) + human RUNBOOK (VPS/DNS/LS/Resend/secrets) + real prod constants + live D-63 purchase + grep-clean (PAY-01/02/03; NOT autonomous, wave 2)
**UI hint**: yes

### Phase 21: License Lifecycle & Ship Gate
**Goal**: The license behaves correctly across its whole lifetime — opportunistic refresh, self-serve transfer, revocation propagation, a status UI — the free-tier default flips live, and the full 8-case ship-gate matrix passes end-to-end on a real build
**Depends on**: Phase 19 + Phase 20 (end-to-end purchase→activation integration requires both)
**Requirements**: LIC-05, LIC-07, LIC-08, LIC-09
**Success Criteria** (what must be TRUE):
  1. The cached `machine.lic` (~30-day TTL) refreshes opportunistically in the background when online, with a generous offline grace in between — never a hard per-launch network check, and every tool stays fully functional offline
  2. User can self-serve deactivate this Mac from within the app, freeing the seat, and then activate the same key on a new Mac (transfer proven end-to-end)
  3. A license revoked/suspended in Keygen (refund or chargeback) drops entitlements to the free tier at the next TTL refresh — calm messaging, no crash
  4. A keyboard-reachable, WCAG-AA license status UI shows the current state (free / licensed / offline-grace / refresh-needed), the masked key + licensee email from the signed license data, and working refresh + deactivate actions
  5. The in-Tauri free-tier default flips live (an unlicensed install actually locks theming and ordering/pinning — all tools stay free, D-18) and all 8 ship-gate matrix cases pass on a fresh `tauri build`: valid first-Mac activation · second Mac rejected · offline launch · corrupted `machine.lic` fails closed · copied `machine.lic` fails on foreign fingerprint · TTL-expired grace→refresh · deactivate/transfer end-to-end · revocation propagates on refresh
**Plans**: 5 plans (planned 2026-06-14)

Plans:
- [x] 21-01-PLAN.md — Expiry-aware resolve_status: OfflineGrace + RefreshNeeded states, TTL/grace/poll consts, needs_refresh helper (LIC-05; D-73/74/75; TDD, wave 1) — DONE 2026-06-14 (cargo license:: 66/66)
- [x] 21-02-PLAN.md — Background refresh scheduler (launch + 24h poll, online + needs_refresh gated, silent) + 5-state TS payload mirror (LIC-05; D-76/77; wave 2) — DONE 2026-06-14 (cargo license:: 69/69, vitest 893/893; tokio time-feature dep)
- [x] 21-03-PLAN.md — Transfer/revocation surface: webhook email-embed (D-89) + verify.rs email + maskedKey payload + revocation tests + infra/ seat-release helper (LIC-07/08; D-78..82/89/81; wave 3) — DONE 2026-06-14 (cargo license:: 81/81, vitest 895/895; D-79 + revocation pinned by cargo tests; release-seat.sh committed)
- [ ] 21-04-PLAN.md — D-85 live free-tier flip + #/settings/license status route + confirm-first deactivate + drop notice + footer/palette routing + real-WKWebView e2e (LIC-09/05/07/08; D-83..88; NOT autonomous, wave 4)
- [ ] 21-05-PLAN.md — 8-case ship-gate matrix on a fresh prod build (D-90; gated on Phase 20 completion for the live cases 1/2/7/8; NOT autonomous, wave 5)
**UI hint**: yes

## Phase Details (v1.7)

### Phase 22: Settings Modal Shell, Entry Points & License Pane
**Goal**: Anyone — including unlicensed users — can open a real Settings surface from every conventional entry point, and it renders as an accessible in-window modal with a paned layout whose first pane is the existing License surface unchanged
**Depends on**: Phase 21 (reuses the Phase-21 upsell-modal shell pattern + the `LicenseSettings` component; v1.6 in final sign-off)
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06
**Success Criteria** (what must be TRUE):
  1. User can open Settings from the macOS app menu (`TinkerDev ▸ Settings…`, ⌘,) and from the tray `Settings…` item — both arrive in the webview through the `src/lib/platform/` event seam (no `@tauri-apps/*` import outside the seam), and from a sidebar "Settings" row (above "Unlock Pro") and the ⌘K command palette
  2. Settings renders as a full in-window modal overlay (Claude-style), dismissible with Esc, reachable by everyone including unlicensed users (the License pane shows the no-license + Unlock-Pro state)
  3. The modal is WCAG-AA: focus is trapped inside while open, returns to the invoking control on close, and it carries `aria-modal` + `aria-labelledby`
  4. The modal uses a paned layout (left nav list, right content pane) that is fully keyboard-navigable — the user can move between panes by keyboard and the active pane is announced via `aria`
  5. The License pane reuses the existing `src/components/LicenseSettings.tsx` surface unchanged (all 5 states; activate/upsell for unlicensed) with no behavior regression
**Plans**: 3 plans (planned 2026-06-15) — 3/3 complete (phase complete 2026-06-15; verifier 15/15)

Plans:
- [x] 22-01-PLAN.md — Settings modal foundation: `settingsStore`/`useSettings` (clone upsellStore + sync invoker capture + activePane), `SettingsModal` (paned layout, cloned UpsellModal a11y, `aria-current` button-list pane nav + aria-live), extensible `settingsPanes` (License = `LicenseSettings` unchanged), App.tsx mount (before UpsellModal), `#/settings/license` deep-link migration + e2e (SET-04/05/06; autonomous, wave 1) — **DONE 2026-06-15** (real-WKWebView gate 20/20; vitest 960/960; decoder + LicenseSettings byte-untouched; SET-04/05/06 validated)
- [x] 22-02-PLAN.md — Webview entry points + D-88 re-point: bottom-anchored sidebar "Settings" row (opens for everyone, no lock badge) + ⌘K "Settings" command, re-point the footer License-attention affordance + ⌘K "License" command to `openSettings('license')` (Unlock-Pro/upsell unchanged), open-from-sidebar/⌘K/footer e2e (SET-03; D-S6/D-S8/D-S9/D-S11; autonomous, wave 2) — **DONE 2026-06-15** (real-WKWebView gate 20/20; vitest 966/966; tsc + eslint clean; decoder + LicenseSettings byte-untouched; SET-03 validated)
- [x] 22-03-PLAN.md — Native entry points: app menu `Settings…` (⌘,) via `set_menu()` with reconstructed App/Edit/Window defaults (Pitfall 1 — preserve Copy/Paste/Undo/Select-All/Quit) + tray `Settings…`, both emitting `menu://open-settings` through the platform seam (`onOpenSettings`), App.tsx subscription, manual menu/tray + Edit-menu-regression walkthrough (SET-01/02; D-S7; NOT autonomous, wave 2)

**UI hint**: yes

### Phase 22.1: Settings Follow-ups (INSERTED)
**Goal**: The two non-blocking follow-ups from Phase 22's walkthrough are closed — the macOS app menu reads "TinkerDev" everywhere, and the Settings ▸ License pane shows the upsell/activation inline (no modal-on-modal) while the standalone upsell modal stays for the non-Settings entry points
**Depends on**: Phase 22 (the set_menu app menu + the Settings modal shell + `LicenseSettings`/`UpsellPanel`)
**Requirements**: SET-06 (revised — inline upsell in the License pane); no new requirement ID (app-menu label fix is a bug)
**Source**: `.planning/phases/22-settings-modal-shell/22-FOLLOWUP.md` (Follow-up 1 BUG, Follow-up 2 DESIGN)
**Success Criteria** (what must be TRUE):
  1. The macOS app menu shows the product name **TinkerDev** — the bold app-menu title plus **About TinkerDev / Hide TinkerDev / Quit TinkerDev** — instead of the `devtools-app` Cargo bin name (set via the App `SubmenuBuilder` title + explicit predefined-item text); verified on a rebuilt `.app` (manual menu re-check, since native chrome is not WebDriver-drivable)
  2. The Settings ▸ License pane renders the upsell/activation content **inline** for the not-Pro states (free / notActivated / problem / refreshNeeded) — "Thank you for using TinkerDev ❤️" + Buy CTA + license-key input + Activate — with NO stacked `UpsellModal` opening on top of the Settings modal
  3. The upsell/activation surface is extracted from `UpsellPanel` into a **shared content component** (`ActivationSurface`) consumed inline in the License pane; no logic duplicated. **SCOPE CHANGE (user-approved 2026-06-16, reverses D-22.1-5/D-28/D-29):** the standalone `UpsellModal` was REMOVED rather than kept — every former opener (sidebar "Unlock Pro" / locked pin·reorder·reset / ⌘K free-tier "License") now routes to `openSettings("license", invoker)`, so there is exactly ONE upsell surface (inline). `upsellStore.ts` + `useUpsell.ts` deleted.
  4. WCAG-AA preserved (focus order, labels, live regions; heading order dialog h2 → pane h3 → status h4); full unit suite + real-WKWebView e2e green; `decoder.ts` + its 19 tests and the activation logic byte-for-byte behavior-unchanged
**Plans**: grew 2 → 4 plans + 1 post-review fix batch (planned 2026-06-15, completed 2026-06-16)

Plans:
- [x] 22.1-01-PLAN.md — App-menu product name (Follow-up 1, BUG) ✓ 2026-06-15: explicit PredefinedMenuItem About/Hide/Quit "TinkerDev" text in set_menu(); Edit/Window + ⌘, Settings intact; human menu walkthrough APPROVED (commit d9dba1f1; 22.1-01-SUMMARY.md)
- [x] 22.1-02-PLAN.md — Inline upsell/activation in the License pane (Follow-up 2, revises SET-06) ✓ 2026-06-15: shared `ActivationSurface` extracted from UpsellPanel (no logic dup, activate-chain grep == 1); `InlineActivation` inline for free/notActivated (full pitch) + problem/refreshNeeded (form-only); licensed/offlineGrace unchanged; LIC-04/T-19-21 preserved (SET-06 Validated; 22.1-02-SUMMARY.md)
- [x] 22.1-03 — License-pane redesign ✓ 2026-06-16: warn (amber) + ok (green) token triads (color-mix off accent); pitch redesign (glow+medallion+24px hero+feature list+$9 price+claims footer, REVERSES D-20); amber attention banner + green Licensed banner + neutral detail table + full-width destructive Deactivate confirm; maskedKey/email refresh stickiness; pane title h3 (22.1-03-SUMMARY.md)
- [x] 22.1-04 — Standalone-modal removal + dev e2e seam ✓ 2026-06-16: UpsellModal + upsellStore/useUpsell DELETED, every opener → openSettings("license", invoker); dev-only `dev_set_license_state` (release-stripped) + license-states.e2e.ts; Keychain heads-up in the form (22.1-04-SUMMARY.md)
- [x] 22.1-99 — Post-review fixes ✓ 2026-06-16: masked-key detailed refresh; heading order h2→h4 (variant-specific); locked-affordance focus-return invoker; dead-Done removal. Gate: vitest 966 + real-WKWebView 21/21 + fresh build (22.1-99-SUMMARY.md)
**UI hint**: yes · UI audit `22.1-UI-REVIEW.md` 22/24 (the two deductions closed by 22.1-99)

### Phase 22.2: Pro-gate ⌘K + focused upsell modal (INSERTED)
**Goal**: A free user who triggers a Pro-only action — opening the ⌘K command palette, or pinning/reordering/Alt+P/resetting tools — sees a focused "Unlock Pro" modal (reusing the one shared activation surface) that dismisses back to where they were; a Pro user gets the palette + customization unchanged. Explicit license entry points stay free so a free user can still reach Settings ▸ License to buy.
**Depends on**: Phase 22.1 (the shared `ActivationSurface`/`InlineActivation`; the openSettings routing it revises) + Phase 18 (the entitlement gate)
**Requirements**: SET-04 (revised — ⌘K no longer opens for everyone); no new requirement ID (the rest is a UX/gating refinement of D-22.1-5/D-28/D-29)
**Source**: user walkthrough 2026-06-16 (reconsidering the 22.1 "redirect every locked trigger to Settings" decision for contextual triggers; new "⌘K is Pro" product decision)
**Success Criteria** (what must be TRUE):
  1. A FREE user pressing ⌘K (or clicking the header ⌘K pill) sees the focused Unlock-Pro modal, NOT the palette; Esc returns focus to the invoker. A PRO user gets the palette unchanged (open/rank/run/Esc all as before).
  2. The contextual locked customization triggers (pin click, drag-reorder, Alt+P, "Reset order") open that SAME focused modal — not the full Settings ▸ License redirect.
  3. The focused modal reuses the shared `ActivationSurface` (activate-chain grep stays == 1), with focus trap + return-to-invoker + Esc; it is NOT stacked on top of the Settings modal. Both the ⌘K handler and the Sidebar triggers open it via ONE minimal shared `upsellStore`.
  4. Gating is via a new `isPro(ents)` predicate (has any Pro entitlement) — frontend-only; every existing license keeps ⌘K working immediately with no Keygen re-issue. The DEV free/full override still drives both states for e2e.
  5. Free users retain a buy path: the sidebar "Settings" row + "Unlock Pro" footer + app-menu ⌘,/tray Settings + #/settings/license deep link stay free → Settings ▸ License; the focused modal itself also offers Buy + activate.
  6. The upsell pitch lists the command palette as a Pro feature (copy synced; tinkerdev.io update flagged). WCAG-AA preserved (focus, contrast, no opacity-only state); full unit suite + real-WKWebView e2e green; `decoder.ts` + its 19 tests untouched.
**Plans**: 1 plan (feat + codex-fix), completed 2026-06-16 — isPro gate; restored UpsellModal+upsellStore over the shared ActivationSurface; openProUpsell state-aware routing (notActivated→modal, refreshNeeded/problem→Settings recovery, D-44); Sidebar contextual triggers→openProUpsell; DEV ⌘⇧K escape. Gates: vitest 986, real-WKWebView e2e 22/22 (incl. cmdk-pro.e2e), fresh build. See 22.2-SUMMARY.md / 22.2-VERIFICATION.md.
**UI hint**: yes

### Phase 23: Appearance Pane
**Goal**: A user can change theme and accent from inside Settings and see it apply immediately and survive a restart
**Depends on**: Phase 22 (the modal shell + paned nav host the pane)
**Requirements**: SET-07
**Success Criteria** (what must be TRUE):
  1. The Appearance pane lets the user choose a theme — light or dark ("system" dropped at user request) — and the choice applies live (no restart) across the whole app
  2. The user can choose an accent and it applies live, with accent reserved for selection per the existing visual system
  3. Both selections persist through the existing prefs seam and are restored on the next launch
  4. The pane is keyboard-navigable and WCAG-AA (visible focus, AA contrast in both themes, no opacity-only state)
**Plans**: 4 plans
  - [x] 23-01-PLAN.md — Foundation: widen ThemeName/coerceTheme + fix default accent, accent scale + light-token tables + executable AA contrast assertions, pure apply helpers
  - [x] 23-02-PLAN.md — Light token CSS block ([data-theme="light"]) + light body gradient + theme-aware hover tints (Pitfall 5/6)
  - [x] 23-04-PLAN.md — Appearance pane UI: theme radio cards + 7-swatch accent grid + contained preview strip + gate-on-Save, appended to SETTINGS_PANES
  - [x] 23-03-PLAN.md — App-root gated apply + no-flash pre-paint script + real-WKWebView e2e + phase-boundary walkthrough (system live-flip removed with the system theme; added: cross-writer prefs-clobber fix, durable writes, flash-free Pro launch, theme-card redesign, wider upsell modal, Appearance-first nav)
**UI hint**: yes

### Phase 24: Hotkeys & General Panes (native-touching)
**Goal**: A user can rebind the app's hotkeys and toggle core app-behavior preferences, including the two settings that reach into the OS (global summon + launch-at-login)
**Depends on**: Phase 22 (modal shell + paned nav); independent of Phase 23
**Requirements**: SET-08, SET-09
**Success Criteria** (what must be TRUE):
  1. The Hotkeys pane lets the user view and rebind the global summon hotkey — the Rust global-shortcut is re-registered to the new chord with conflict handling (a taken/invalid chord is rejected with calm messaging, the prior binding preserved); this promotes the parked NAT-01/G-05-1 summon hotkey
  2. The Hotkeys pane lets the user view and rebind the ⌘K command-palette chord (in-webview key handler keyed off the configured chord); both hotkey bindings persist through the prefs seam and survive restart
  3. The General pane exposes app-behavior toggles (final set decided in planning from: launch-at-login, start-in-tray, default tool on open, show-license-status-in-sidebar) — each toggle persists and takes effect
  4. Launch-at-login works via an autostart plugin — a NEW webview/native dependency that is an **explicit, scoped exception** to the zero-new-dep wedge, decided and recorded in this phase's planning (the only dep added in v1.7)
  5. Both panes are fully keyboard-reachable and WCAG-AA (rebind capture has an accessible affordance; no mouse-only path)
**Plans**: 4 plans
- [x] 24-01-PLAN.md — Foundation: 6 prefs fields + coercers, pure chord helpers (keyEventToAccelerator/matchesChord), default-tool seam, platform.autostart capability (the scoped v1.7 dep) — COMPLETE 2026-06-18 (suite 1108/1108, cargo build green, decoder 19/19 untouched)
- [ ] 24-02-PLAN.md — Native/in-webview wiring: prefs-driven registerSummon + rebindSummon, start-in-tray-gated startup reveal, configurable ⌘K palette matcher
- [ ] 24-03-PLAN.md — Hotkeys pane: reusable HotkeyCaptureField + two binding rows + SETTINGS_PANES append + e2e + native walkthrough
- [ ] 24-04-PLAN.md — General pane: SettingToggle + 4 controls (launch-at-login, start-in-tray, default-tool, show-license-in-sidebar) + sidebar gate + e2e + phase ship walkthrough
**UI hint**: yes

### Phase 25: Updates Pane & Milestone Ship
**Goal**: A user can see version + update status and check for updates from inside Settings, and the whole Settings milestone passes its sign-off on a real build
**Depends on**: Phase 22 (modal shell); Phases 23 + 24 (milestone-close sign-off covers the full pane set)
**Requirements**: SET-10
**Success Criteria** (what must be TRUE):
  1. The Updates pane shows the current app version and the last-checked time
  2. The pane offers a Check-for-updates action that reuses the existing updater seam (mirroring the tray action) — the result (up-to-date / update available) surfaces in the pane
  3. The pane is keyboard-reachable and WCAG-AA, consistent with the other panes
  4. The full Settings surface (all five panes, every entry point) passes a `gsd-ui-review` WCAG-AA audit and a human sign-off on a fresh `tauri build`, with `decoder.ts` + its 19 tests byte-for-byte untouched
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order. v1.6 runs 18 → 19 → 21 with Phase 20 parallel-capable beside 19 (external infra); Phase 21 requires both 19 and 20.

v1.7 runs 22 → 23 → 24 → 25 (started non-destructively while v1.6 is in final sign-off; numbering continues from Phase 21). Phase 22 is the modal-shell foundation all panes mount into; Phases 23 and 24 are independent pane work (parallel-capable after 22); Phase 25 adds the Updates pane and carries the milestone-close sign-off. Within Phase 22: wave 1 = the modal foundation (22-01); wave 2 = the webview entry points (22-02) + the native menu/tray (22-03) in parallel (no file overlap).

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
| 20. Purchase Pipeline | v1.6 | 2/3 | In progress | PAY-01/02/03 |
| 21. License Lifecycle & Ship Gate | v1.6 | 3/5 | In Progress|  |
| 22. Settings Modal Shell, Entry Points & License Pane | v1.7 | 3/3 | Complete    | 2026-06-15 |
| 22.1 Settings Follow-ups | v1.7 | 1/2 | In progress | Plan 02 done (inline License upsell, SET-06); Plan 01 paused at native-menu human checkpoint |
| 23. Appearance Pane | v1.7 | 4/4 | Complete    | 2026-06-17 |
| 24. Hotkeys & General Panes | v1.7 | 0/? | Not started | - |
| 25. Updates Pane & Milestone Ship | v1.7 | 0/? | Not started | - |

## Backlog

Unsequenced ideas captured for future planning. Promote with `/gsd-review-backlog` when ready.

### Phase 999.1: More tools for the app (PROMOTED → v1.3 More Tools, in progress)

**Status:** PROMOTED — the Cron, URL, Regex tools + Protobuf decimal-byte-array input are being delivered as milestone v1.3 "More Tools" (Phases 12–15). What remains parked here is the rest of the candidate wishlist below (SQL formatter still needs a lib; Date, JSON↔YAML, Number Base, Escape/Unescape, comparers, etc. unscheduled).

**Goal:** [Captured for future planning] — expand beyond the v1 six tools. NOTE: v1 locked "six tools only" — promoting this means deliberately reopening that constraint. There is no code-level limit (registry is a plain array; router/sidebar/palette auto-derive), so growth is mechanical; the constraint is product focus, not architecture. v1.1 already added the JSON + XML formatters from this list; v1.3 adds Cron + URL + Regex; SQL remains parked.

**Candidate tool wishlist (user-provided, categorized):**

- **Converters** — Cron Parser ✓ (v1.3), Date, JSON Array → Table/CSV, JSON ↔ YAML, Number Base
- **Text** — Escape / Unescape, List Comparer, Markdown Preview, Analyzer & Utilities, Text Comparer
- **Encoders / Decoders** — Base64 Image, Base64 Text, Certificate, GZIP, HTML, JWT, QR Code, URL ✓ (v1.3)
- **Formatters** — JSON ✓ (v1.1), XML ✓ (v1.1), **SQL** (still parked — needs `sql-formatter` lib; reformats only, can't lint)
- **Generators** — Hash / Checksum, Lorem Ipsum, Password, UUID
- **Graphic** — Color Blind Simulator, Image Converter
- **Testers** — JSONPath, Regular Expression ✓ (v1.3), XML / XSD

Each candidate must still pass the product wedge: offline/no-network, paste-instant (<2s), keyboard-driven, registry-driven, WCAG-AA, and the build+verify harness.

**Requirements:** TBD (remaining wishlist; Cron/URL/Regex requirements now in `.planning/REQUIREMENTS.md` for v1.3)
**Plans:** 4/4 plans complete

Plans:
- [ ] TBD (promote remaining wishlist with /gsd-review-backlog when ready)

### Phase 999.2: Release automation + CI integration (BACKLOG)

**Goal:** [Captured for future planning] — **the local-scripts half of this item is being delivered as milestone v1.2 (Phases 9–11); what remains parked here is the CI track.** Wire CI on top of the v1.2 scripts: CI checks (vitest + tsc + eslint) on every push/PR to main/master, and a tag-triggered CI release later (an Actions runner cuts the signed release).

**Pre-discussion decisions (captured 2026-06-02, before formal milestone planning):**

1. **Trigger model:** a git **tag push `vX.Y.Z`** cuts the signed release + updater bump. **CI checks (vitest + tsc + eslint) run on every push/PR to main/master REGARDLESS of publishing.** (Real-WKWebView e2e in CI is a stretch goal — macOS-runner + webview-automation cost.)
2. **Version bump = local helper script first, CI-integratable later.** Something like `pnpm release [patch|minor|major]` that bumps `package.json` + `src-tauri/tauri.conf.json` **in lockstep** (the D-16 lockstep from RELEASE.md; Cargo.toml is currently 0.1.0 and NOT part of it — decide whether to include it), commits, creates the `vX.Y.Z` tag, and pushes (push is what fires the release). **→ delivered in v1.2 Phases 9–10 (Cargo.toml folded into the lockstep).**
3. **App semver (`0.2.x`) stays DECOUPLED from GSD milestone tags (`v1.1`).** Two numbering systems on purpose: GSD `vMAJOR.MINOR` tracks planning milestones; app `vX.Y.Z` is what the updater compares. The release pipeline keys off the **app** version.
4. **Split the automation into two scripts** (both local now, both CI-callable later):
   - **bump-and-tag** (decision #2 above). **→ v1.2 Phase 10.**
   - **build-and-publish** — runs `pnpm tauri build`, then **generates `latest.json` from the FRESH `*.app.tar.gz.sig`** (automating the fragile manual paste RELEASE.md §5 warns about — never reuse a stale `.sig`), creates the GitHub Release on `bklim5/devtools-releases`, and uploads DMG + `.app.tar.gz` + `latest.json`. **→ v1.2 Phase 11.**

**Context the milestone must fold in (from RELEASE.md + repo state, 2026-06-02):**

- **Split-repo publish:** private source `bklim5/devtools` → public `bklim5/devtools-releases` (assets + `latest.json` only). Updater endpoint pinned to `releases/latest/download/latest.json` on the public repo. CI publishing across repos needs a **cross-repo PAT** — the default `GITHUB_TOKEN` cannot write releases to a different repo. **(Local `gh` auth suffices for v1.2; the cross-repo PAT stays parked here for CI.)**
- **Signing secrets:** minisign **private key (`~/.tauri/devtools.key`) + password** must move into **GitHub Actions secrets** for CI release (mandatory; DST-02 verify-before-apply). Only the public key is in the repo (`tauri.conf.json` `plugins.updater.pubkey`). **(v1.2 reads these from the local env; Actions secrets stay parked here.)**
- **arm64-only gap (Pitfall 7):** a local Apple-Silicon build serves only `darwin-aarch64`. Intel/`darwin-x86_64` or `--target universal-apple-darwin` coverage is a CI-phase improvement to consider. **→ closed in v1.2 Phase 11 (universal binary).**
- **Apple notarisation stays DEFERRED** (ad-hoc signing) until Apple Developer enrolment (D-02) — but scripts should be **notarisation-ready** (honor `APPLE_*` env if present, per RELEASE.md "post-enrolment flip"). **→ notarisation-ready honored in v1.2 Phase 11; activation still deferred.**
- **macOS runner required** for `tauri build`; private-repo Actions minutes are billed — a reason CI *release* is deferred while CI *checks* run regardless.
- **Stale committed `latest.json`** at repo root (currently 0.2.1) — decide whether to keep it generated-only / stop committing it. **→ v1.2 Phase 9 (generate-only, untracked).**

**Requirements:** TBD (the remaining CI track — define during a future `/gsd-new-milestone`)
**Plans:** 0 plans

Plans:
- [ ] TBD (promote the remaining CI track with /gsd-review-backlog or seed `/gsd-new-milestone` when ready)

### Phase 999.3: Theme settings (✅ PROMOTED → v1.7 Phase 23 Appearance pane)

**Status:** PROMOTED into milestone v1.7 "Settings & Preferences" as the **Appearance pane (Phase 23, SET-07)** — theme (light/dark/system) + accent, persisted via the prefs seam and applied live. Original capture below.

**Goal:** [Captured for future planning] — user-facing theme/appearance settings (beyond the current theme/accent persistence), e.g. light/dark/system toggle and accent customization in a settings surface.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: DevTools CLI (BACKLOG)

**Goal:** [Captured for future planning] — let users invoke the tools from the command line, e.g. `devtools hash.sha256 xxx` to print a SHA-256 hash, `devtools base64.encode ...`, etc. Implies sharing the pure transform logic (`src/lib/`) between the GUI and a CLI entrypoint so behavior stays identical. Open questions for promotion: distribution of the CLI binary (bundled with the app vs separate), namespacing/command grammar (`tool.action`), stdin/pipe support, and how it coexists with the offline/no-network ethos (a CLI is inherently offline-friendly). The pure-logic-in-`src/lib/` separation already in place is the enabler.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Protobuf decoder schema-file support (BACKLOG)

**Goal:** [Captured for future planning] — let the user supply a `.proto` schema file so the Protobuf decoder can render *named, typed* fields (e.g. `user_id` instead of `#1`, enums by name, nested message types) instead of the schema-less wire-format-only tree. This is an **additive, opt-in mode layered on top of the hero** — the schema-less decoder stays the default and the product wedge ("paste an unknown blob → usable interpretation in <2s, no setup"); a schema, when provided, only enriches the readout. **Key tension to resolve at promotion:** schema-less decoding is the explicit hero feature and "no setup / no accounts" is a binding constraint, so any schema mode must not dilute the paste-instant zero-config path — schema is an enhancement a power user reaches for, never a precondition. **Open questions:** parsing `.proto` without a new runtime dep (the constraint is zero-new-runtime-deps; a `.proto` parser is non-trivial — may need a vendored/pure parser or a deliberate dep exception decided at promotion); how the schema is supplied offline (file picker / paste / drag-drop, no network fetch of imports); handling `import` statements and well-known types; mismatches between schema and actual bytes (fall back to the schema-less view, never crash); and keeping `decoder.ts` + its 19 tests untouched (the schema layer wraps/annotates the existing wire-format output rather than modifying the core decoder).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Drag-and-drop reorder the tool list (✅ PROMOTED → v1.4 Phase 16)

**Status:** PROMOTED into milestone v1.4 "Reorderable Tools" as **Phase 16** (2026-06-04). Requirements REORD-01..07. Its 12 design decisions moved with it to `.planning/phases/16-reorderable-sidebar-tool-list/16-CONTEXT.md`. See the v1.4 milestone section above for the live phase. (The pinning idea it split out remains an unscheduled future feature.)

**Goal:** [Captured for future planning] — let the user drag-and-drop to reorder the tools in the sidebar (and the order should persist), so the most-used tools can sit at the top instead of the fixed registry order. **Architectural fit:** the registry (`src/lib/tools/registry.ts`) is the single control plane — sidebar, ⌘K palette, and router all derive from it — so a user-defined ordering is a presentation-layer overlay (a persisted array of tool IDs applied over the registry), NOT a mutation of the registry array itself; the registry stays the canonical source. **Open questions for promotion:** persistence via the existing `platform.store` seam (a `toolOrder: string[]` pref, same mechanism as theme/last-used — no new dep); keyboard-accessible reordering (WCAG-AA is binding — drag-drop alone is insufficient; needs a keyboard affordance, e.g. move-up/down or an aria-grabbed pattern); how new tools shipped in a later version slot into an existing custom order (append unknown IDs); whether the ⌘K palette and router care about order (they shouldn't — only the sidebar render order changes); and a reset-to-default affordance. Zero-new-runtime-deps still applies (HTML5 drag events or a small pure handler, not a dnd library).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Base64 tool — inline image preview (BACKLOG)

**Goal:** [Captured for future planning] — extend the **existing base64 tool** (not a new tool) with an inline image preview: when decoded bytes sniff as an image (PNG/JPEG/GIF/WebP/SVG via magic bytes), render the image inline below the decoded output. Fits the wedge: paste blob → usable interpretation. **Open questions for promotion:** rendering via data-URI `<img>` (no new deps); SVG safety (sanitize or render rasterized/sandboxed — SVG can carry scripts); size limits for very large payloads; alt-text/a11y treatment (WCAG-AA binding); whether preview shows dimensions/format metadata; copy/save affordance for the rendered image.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.8: Windows port of the license stack (BACKLOG)

**Goal:** [Captured for future planning] — make the Phase-19 license stack run on Windows when the deferred Windows milestone lands. The seams are already OS-portable (PROJECT.md); two swappable arms are macOS-only today:
1. **Key storage:** `keyring` crate is pinned with `features = ["apple-native"]` only — add a cfg-gated `windows-native` feature (Windows Credential Manager). Same `Entry::new(service, user)` API. Behavioral deltas to encode in the threat register: **no per-binary ACL prompts on Windows** (the macOS prompt-flood fix still applies but is moot) and **weaker isolation** — any same-user process can read generic credentials (key alone is still useless without the matching server-side fingerprint binding); ~2.5KB credential blob limit (fine).
2. **Fingerprint:** `fingerprint.rs` shells out to `ioreg`/`IOPlatformUUID` — add a `#[cfg(target_os = "windows")]` source arm reading registry `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` (same stability class; reinstall regenerates it → seat transfer needed, same as a Mac logic-board swap). HMAC wrapper + T-19-11 privacy invariant carry over unchanged.

Everything else already ports: machine.lic via Tauri app-data dir, pure-Rust Ed25519 verify/store/state machine, `hostname` exists on Windows, UX copy already says "device" (2026-06-12 decision). **Open questions for promotion:** keyring 3.6→4.x migration timing; Linux secret-service arm in the same pass; whether the e2e keychain pre-clean needs a Windows `cmdkey` equivalent.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.9: Native Settings / Preferences window (✅ PROMOTED → v1.7 Phases 22–25)

**Status:** PROMOTED into milestone v1.7 "Settings & Preferences" (Phases 22–25, started 2026-06-15). Requirements SET-01..10. **Architecture revised at promotion:** an in-window **modal overlay** (Claude-style, reusing the Phase-21 upsell-modal pattern) — NOT a separate OS window (the seed's open question resolved to the lowest-risk single-React-root approach; no multi-window/IPC). Native app-menu (⌘,) + tray entry points reach it through the `platform/` event seam. The License pane reuses `LicenseSettings.tsx` unchanged. Absorbs 999.3 (Theme settings) as the Appearance pane and the parked NAT-01/G-05-1 summon hotkey as the Hotkeys pane. See the v1.7 section above for the live phases. Original capture below.

**Goal:** [Captured for future planning — seed: `docs/seeds/settings-preferences-window/`] — move License + all settings into a **native macOS Preferences window** (the conventional pattern), reachable by everyone incl. unlicensed users (who see a No-license + Unlock-Pro state). Origin: Phase 21 walkthrough — the in-window `#/settings/license` route keeps the sidebar visible while the main pane shows settings (confusing), and a pure-free user has no clean entry (D-88). **Entry points:** `TinkerDev ▸ Settings…` (⌘,) app-menu item + a tray `Settings…` item + a sidebar `Settings` row above "Unlock Pro". **Window:** separate paned window (General · Appearance/Themes · Hotkeys · Updates · License); the **License pane reuses today's `src/components/LicenseSettings.tsx` unchanged** (Phase 21 built the hard part — flip/lifecycle/state machine). Likely **absorbs 999.3 (Theme settings)** as its Appearance pane. **Open questions for promotion:** Tauri multi-window vs a modal-over-main surface; app-menu + tray wiring in Rust; its own UI-SPEC + WCAG-AA audit; whether the upsell/activation lives in the License pane; HashRouter implications for a second window.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
