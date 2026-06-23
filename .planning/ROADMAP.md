# Roadmap: DevTools

## Milestones

- ✅ **v1.0 Distribution** — Phases 1–6 (shipped 2026-06-01) — see `milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 Formatters** — Phases 7–8 (shipped 2026-06-02) — see `milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Release Tooling** — Phases 9–11 (shipped 2026-06-03) — see `milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 More Tools** — Phases 12–15 (shipped 2026-06-04) — see `milestones/v1.3-ROADMAP.md`
- ✅ **v1.4 Reorderable Tools** — Phase 16 (shipped 2026-06-05) — see `milestones/v1.4-ROADMAP.md`
- ✅ **v1.5 Pinned Tools** — Phase 17 (shipped 2026-06-07) — see `milestones/v1.5-ROADMAP.md`
- ✅ **v1.6 Licensing** — Phases 18–21 (shipped 2026-06-17) — see `milestones/v1.6-ROADMAP.md`
- ✅ **v1.7 Settings & Preferences** — Phases 22–25 (shipped 2026-06-21, app v0.4.1) — see `milestones/v1.7-ROADMAP.md`
- 🔄 **v1.8 Mac App Store Distribution** — Phases 26–30 (in progress) — App Store channel: StoreKit IAP + App Sandbox + `.pkg` submission

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

<details>
<summary>✅ v1.6 Licensing (Phases 18–21) — SHIPPED 2026-06-17</summary>

- [x] Phase 18: Entitlements Seam & Central Gate (4/4 plans) — completed 2026-06-10
- [x] Phase 19: License Activation & Offline Verification (4/4 plans) — completed 2026-06-12
- [x] Phase 20: Purchase Pipeline (3/3 plans) — live LS purchase 2026-06-17 (order 8722394)
- [x] Phase 21: License Lifecycle & Ship Gate (5/5 plans) — live walkthrough + ship-gate cases 1/2/7/8 passed 2026-06-17

One-time-payment lifetime license: MoR checkout → webhook → Keygen → emailed key → paste-activation (HMAC fingerprint, one machine) → offline Ed25519-verified machine.lic thereafter, with self-serve transfer + revocation, behind a central frontend entitlement gate (free keeps all 11 tools; Pro unlocks customization). Full detail: `milestones/v1.6-ROADMAP.md` · requirements: `milestones/v1.6-REQUIREMENTS.md`

</details>

<details>
<summary>✅ v1.7 Settings & Preferences (Phases 22–25) — SHIPPED 2026-06-21 (app v0.4.1)</summary>

- [x] Phase 22: Settings Modal Shell, Entry Points & License Pane (3/3 plans) — completed 2026-06-15
- [x] Phase 22.1: Settings Follow-ups (INSERTED) (4 plans + fix batch) — completed 2026-06-16
- [x] Phase 22.2: Pro-gate ⌘K + focused upsell modal (INSERTED) (1 plan) — completed 2026-06-16
- [x] Phase 23: Appearance Pane (4/4 plans) — completed 2026-06-17
- [x] Phase 24: Hotkeys & General Panes (4/4 plans) — completed 2026-06-19
- [x] Phase 25: Updates Pane & Milestone Ship (5/5 plans) — completed 2026-06-21

A five-pane in-window Settings modal (License · Appearance · Hotkeys · General · Updates) reachable from app menu ⌘, / tray / sidebar / ⌘K via the platform event seam: live theming, rebindable hotkeys (incl. OS global summon), app-behavior toggles (incl. launch-at-login), in-app update check + install. Full detail: `milestones/v1.7-ROADMAP.md` · requirements: `milestones/v1.7-REQUIREMENTS.md`

</details>

## v1.8 Mac App Store Distribution (Phases 26–30) — IN PROGRESS

**Goal:** Ship TinkerDev on the Mac App Store as a SECOND distribution channel beside the existing direct DMG + updater. Scope = the App Store target ONLY (StoreKit IAP + App Sandbox + the build-variant seam + `.pkg` submission); direct-channel Developer-ID notarisation is already shipped (v0.4.1) and out of scope. Both channels resolve to the SAME `pro.*` entitlement map through the one existing central gate; the webview gate, registry, `decoder.ts` + its 19 tests stay byte-unchanged. Promotes backlog 999.10. Continues phase numbering from Phase 25 → starts at **Phase 26**.

**Build order is dependency-forced:** nothing store-side compiles, resolves, or renders without a working `platform.iap` arm, so the StoreKit bridge spike is the critical-path FIRST phase. The variant seam (27) is the foundation for both the StoreKit UI (28) and the sandbox features (29); 29 can partly parallelize with 28 once 27 lands. The irreversible/integration-bound submission (30) runs LAST, after every source change lands (verify bundle mtime > last source commit).

**The four ship-gate killers** are each designed into a phase with a verifiable check on the SIGNED bundle: (1) missing `network.client` → sandbox white-screen → Phase 27; (2) Keygen surface surviving (`license.tinkerdev.io`/`$9`/`BUY_LICENSE_URL`/key field) → 3.1.1 grep-clean → Phase 28; (3) updater/autostart hidden-but-linked → `cargo tree` empty → Phase 27 (updater) + 29 (autostart); (4) IAP not testable in review → checklist + Sandbox-tester walkthrough → Phase 30.

**Mandatory human ship-gate walkthroughs** (WebDriver CANNOT drive StoreKit purchases / the sandbox / refunds / login-items — mirrors the v1.6 live-purchase gate): real sandbox purchase round-trip at the Phase 26 + 28 boundaries; login-item over a real logout/login at Phase 29; the full ship-gate (signed `.app`, real purchase, restore on a fresh container, refund→drop) at Phase 30.

**Research-phase flags (during planning):**
- **Phase 26** — `/gsd-research-phase` LIKELY (MEDIUM confidence): the StoreKit bridge internals are spike-gated — `tauri-plugin-iap@0.9.0` is a 72-star single-maintainer plugin; confirm universal-sandboxed compile, seam mapping, serverless JWS verify, and `objc2`/`keyring` link coexistence. Have the `swift-rs` hand-rolled fallback ready (same seam shape).
- **Phase 30** — `/gsd-research-phase` LIKELY (MEDIUM confidence): the Tauri-specific `productbuild`/provisioning-profile/`.pkg` signing sequence is community-reported, not officially walked through end-to-end; ITMS bounce modes (ITMS-90238/90296) need validation against the real universal bundle + the nested IAP-bridge code.
- **Phases 27 + 28** — HIGH confidence, skip research-phase: the variant seam is the existing in-repo `webdriver`-feature + Tauri `--config` idiom; the entitlement-source swap is a one-branch change to the already-tested `resolveEntitlements()` (the seam, gate, and drop-notice all exist and are reused).

<details>
<summary>🔄 v1.8 Mac App Store Distribution (Phases 26–30) — IN PROGRESS</summary>

- [x] Phase 26: StoreKit Bridge Spike (CRITICAL PATH) — prove `tauri-plugin-iap@0.9` (or swift-rs fallback) in a universal sandboxed build; `platform.iap` seam + `iap_*` Rust commands; native purchase sheet + on-device JWS verify; MAS-IAP-01, MAS-IAP-04 — **COMPLETE 2026-06-23 (GO: tauri-plugin-iap; live Sandbox round-trip passed)**
- [x] Phase 27: The Build-Variant Seam (3 layers) — `appstore` cargo feature + `tauri.appstore.conf.json` overlay + `VITE_CHANNEL`; sandboxed `.app` launches (network.client, no white-screen); updater compiled OUT; committed verify script; MAS-BUILD-01/02/03/05/06 (4/4 plans complete; signed sandboxed `.app` human-verified launch+render 2026-06-23; binding-harness gates run — code-review + adversarial review caught & fixed a CRITICAL direct-channel capability-drop + half-variant holes, re-verified GREEN end-to-end)
- [ ] Phase 28: Entitlement-Source Swap + Store License Pane — `baseFromStoreKit` branch through the existing gate; `StoreLicenseSettings` (Buy `displayPrice` + Restore, App-Store-managed wording); App-Store-managed Updates pane; refund/revoke live-drop; Keygen surface compiled out + grep-clean; MAS-IAP-02/03/05/06/07, MAS-BUILD-04/07
- [ ] Phase 29: Sandbox-Safe Native Features — global summon + tray kept under sandbox; Keychain gated OUT; launch-at-login hidden in the store build; MAS-NATIVE-01/02/03/04
- [ ] Phase 30: `.pkg` Build + App Store Connect Submission — `productbuild` → `altool` pipeline (Apple Distribution + Mac Installer Distribution + profile); ASC guidance + metadata; direct channel un-regressed; MAS-SHIP-01/02/03/04/05

23 v1 requirements (MAS-IAP ×7, MAS-BUILD ×7, MAS-NATIVE ×4, MAS-SHIP ×5) mapped 100% across 5 phases. Research: `.planning/research/`. Requirements: `.planning/REQUIREMENTS.md`.

</details>

## Phase Details — v1.8 Mac App Store Distribution

### Phase 26: StoreKit Bridge Spike (CRITICAL PATH)
**Goal**: The store build can present the native StoreKit purchase sheet for the one non-consumable "Pro" product and verify the result on-device, behind a `platform.iap` seam that mirrors `platform.license` — proving the highest-risk, longest-pole dependency before anything downstream is built on it.
**Depends on**: Nothing new (builds on the shipped v1.6/v1.7 platform seam + entitlements gate)
**Requirements**: MAS-IAP-01, MAS-IAP-04
**Success Criteria** (what must be TRUE):
  1. In a sandboxed build, a user can invoke the native StoreKit purchase sheet for the "Pro" non-consumable and see `.success` / `.userCancelled` / `.pending` ("waiting for approval", not an error) each handled calmly.
  2. A completed purchase is verified on-device via StoreKit 2 JWS (`VerificationResult.verified` only); an `.unverified` result is treated as failed and grants nothing — confirmed serverless (no network call beyond Apple's StoreKit).
  3. The `platform.iap` seam exists with a real `tauri.ts` arm (calling `iap_*` Rust commands) and a deterministic no-op `browser.ts`/`stub.ts` arm, so unit tests + `vite dev` run with no native call.
  4. A real purchase round-trip completes in the App Store Connect sandbox with a Sandbox tester account (human-verified — WebDriver cannot drive StoreKit).
**Plans**: 7 plans (Plan 07 conditional — runs only on a swift-rs NO-GO)
- [x] 26-01-PLAN.md — Rust IAP verify/grant decision core + appstore cargo feature + iap_* commands (Wave 1, auto)
- [x] 26-02-PLAN.md — plugin-API preflight (Rust-callable vs JS-companion) + platform.iap seam (interface + real tauri.ts arm + no-op browser/stub arms + tests) (Wave 1, auto) — MODE A PROVEN (compile-checked); seam green 1211/1211
- [x] 26-03-PLAN.md — temporary D-11 spike button in Settings ▸ License (Restore re-reads + renders currentEntitlements) + no-op-arm e2e (Wave 2, auto)
- [x] 26-04-PLAN.md — ASC setup checklist (App ID, Paid-Apps Agreement, com.tinkerdev.app.pro, Sandbox tester) — user-driven (Wave 1, human)
- [x] 26-05-PLAN.md — minimal sandbox harness + tauri-plugin-iap spike (finish() cited + static no-network audit) + bridge-viability go/no-go (Wave 2, human-decision)
- [x] 26-06-PLAN.md — human Sandbox-tester round-trip gate (relaunch/replay + Restore re-grant) + two-check serverless verify (static audit + process-scoped capture); routes the disposition (Wave 3, human-verify)
- [ ] 26-07-PLAN.md — **SKIPPED** (go-plugin; conditional swift-rs fallback not needed) — would have rebuilt the same platform.iap seam + iap_* contract + four criteria via swift-rs (Wave 4, human-verify)
**Research**: COMPLETE — see 26-RESEARCH.md (OQ-1: .storekit inner loop dropped, replaced by Rust verify-core unit tests + human Sandbox-tester gate). swift-rs fallback gated by the single go/no-go in Plan 05.
**Gate**: Human — real sandbox purchase round-trip (Sandbox tester; `.storekit` not load-bearing per Phase 26 RESEARCH OQ-1 — agent inner loop is the Rust verify/grant unit core).

### Phase 27: The Build-Variant Seam (3 layers)
**Goal**: The repo builds two variants from one codebase — direct (today's DMG/updater) and appstore (sandboxed StoreKit) — from single canonical build commands, and the appstore variant produces a signed sandboxed `.app` that launches without a white-screen, with the auto-updater compiled OUT and a committed script that asserts bundle compliance.
**Depends on**: Phase 26 (so the `appstore` cargo feature has the IAP plugin to register)
**Requirements**: MAS-BUILD-01, MAS-BUILD-02, MAS-BUILD-03, MAS-BUILD-05, MAS-BUILD-06
**Success Criteria** (what must be TRUE):
  1. Each variant builds from a single canonical command (`appstore` cargo feature + `tauri.appstore.conf.json --config` overlay + `VITE_CHANNEL` bound in one `package.json` script) so a half-variant cannot ship.
  2. The signed App Store `.app` launches and renders the webview (not blank) under App Sandbox — `com.apple.security.app-sandbox` + `com.apple.security.network.client` both present (verified via `codesign -d --entitlements` then launching the signed `.app`).
  3. The auto-updater (Rust plugin + endpoints) is ABSENT from the store build — verifiable on the bundle (`cargo tree --features appstore | grep -E 'updater|autostart'` empty). (The Updates pane is RETAINED with an App-Store-managed message — Phase 28 / MAS-BUILD-07.)
  4. The store variant builds at `minimumSystemVersion` 13.0 while the direct channel stays 10.15 — the 13.0 bump lives only in the overlay, never leaking onto the base config.
  5. A committed `scripts/verify-appstore-bundle.sh` asserts required entitlements present + forbidden plugins/strings absent at the gate.
**Plans**: 4 plans
- [x] 27-01-PLAN.md — umbrella `direct` Cargo feature: updater + autostart compiled OUT of the appstore build (Wave 1, auto) ✓ 2026-06-23
- [x] 27-02-PLAN.md — `tauri.appstore.conf.json` overlay (13.0 only here) + `IS_APPSTORE` channel constant + two canonical package.json variant scripts (Wave 2, auto) ✓ 2026-06-23
- [x] 27-03-PLAN.md — committed `scripts/verify-appstore-bundle.sh` (entitlements present + plugins absent + 13.0-artifact via PlistBuddy; FATAL-when-present, GREEN at boundary) (Wave 2, auto) ✓ 2026-06-23
- [x] 27-04-PLAN.md — promote spike → canonical `build-appstore-bundle.sh` + human launch/render gate on the signed sandboxed `.app` (Wave 3, human-verify)
**Research**: Skip — HIGH confidence (existing `webdriver`-feature + `--config` in-repo idiom).
**Gate**: Verify the sandboxed `.app` renders (network.client white-screen check) on the signed build.

### Phase 28: Entitlement-Source Swap + Store License Pane
**Goal**: A StoreKit Pro purchase unlocks the same theming / ordering / ⌘K capabilities through the one existing central gate (no relaunch), the store-build License pane shows only Buy + Restore + status (no Keygen concepts), a refund drops Pro live, and the entire Keygen surface is compiled out of the store bundle — the 3.1.1 compliance phase.
**Depends on**: Phase 26 (the `platform.iap` arm), Phase 27 (the variant seam + `IS_APPSTORE`)
**Requirements**: MAS-IAP-02, MAS-IAP-03, MAS-IAP-05, MAS-IAP-06, MAS-IAP-07, MAS-BUILD-04, MAS-BUILD-07
**Success Criteria** (what must be TRUE):
  1. After a successful purchase, Pro unlocks live (theming, tool ordering/pinning, ⌘K palette) through the same `resolveEntitlements` central gate via a new `baseFromStoreKit` branch — no relaunch.
  2. A user can Restore Purchases from Settings ▸ License behind an explicit button (Apple-mandatory; never silent at launch) to re-unlock Pro on a fresh install or new machine.
  3. A refund/revocation drops Pro live — a `Transaction.updates` listener at boot reuses the existing "Pro features turned off" drop-notice.
  4. The store-build License pane shows status + Buy (label "Buy Pro — Lifetime"; price shown on the App Store sheet, NOT in-app — D-12 relaxes the original `displayPrice` wording) + Restore and shows NO key field, NO external buy link, and NO literal price; the contextual Unlock-Pro modal + every upsell trigger (sidebar "Unlock Pro", locked pin/reorder/Command Palette) present the StoreKit Buy/Restore flow, never the Keygen activation form.
  5. The store-build UI omits every Keygen-only concept (no "activate with key", no machine deactivate/seat-transfer, no fingerprint/seat-limit copy, no "lost your key / check your purchase email") and uses App-Store-managed wording where a status explanation is needed.
  6. The Keygen surface (key field, `license.tinkerdev.io` calls, external buy link, literal `$9`) is compiled OUT of the store build and grep-verifiable clean on the bundle.
  7. In the store build the Settings ▸ Updates pane is RETAINED but shows "Your app update is managed by the App Store" with the Check-for-updates + Install affordances REMOVED (not just disabled); the running-version readout may remain.
**Plans**: 5 plans
- [x] 28-01-PLAN.md — `baseFromStoreKit` arm in `resolveEntitlements` (IS_APPSTORE-gated; intersection + fall-closed) — MAS-IAP-02 (Wave 1, auto)
- [ ] 28-02-PLAN.md — real plugin transaction-update bridge (iap:allow-register-listener capability + Channel) + store boot listener + Pro→free drop-diff/drop-notice — MAS-IAP-02/05 (Wave 1, auto)
- [ ] 28-03-PLAN.md — `StoreLicenseSettings` (Buy/Restore/status, two layouts) + `StoreUpdatesSettings` (version + managed line) — MAS-IAP-03/06/07, MAS-BUILD-07 (Wave 2, auto)
- [ ] 28-04-PLAN.md — `StoreUpsell` modal (pitch + Buy + Restore) + `storeProUpsell` router — MAS-IAP-07 (Wave 2, auto)
- [ ] 28-05-PLAN.md — static IS_APPSTORE switches + IapSpikeBlock removal + verify-script forbidden-string grep + human sandbox gate — MAS-BUILD-04, MAS-IAP-02/05 (Wave 3, human-verify)
**Research**: Skip — HIGH confidence (one-branch change to the already-tested resolver; seam + gate + drop-notice reused).
**Gate**: Human — purchase → Pro unlocks live; refund → Pro drops live (sandbox tester).
**UI hint**: yes

### Phase 29: Sandbox-Safe Native Features
**Goal**: The sandboxed store build is feature-complete on the native surfaces it keeps — the global summon hotkey and tray work under App Sandbox — while the features that cannot be sandbox-safe this milestone (Keychain, launch-at-login) are cleanly gated out without leaving unjustified entitlements or runtime errors.
**Depends on**: Phase 27 (the sandbox build exists); can partly parallelize with Phase 28 (independent of StoreKit)
**Requirements**: MAS-NATIVE-01, MAS-NATIVE-02, MAS-NATIVE-03, MAS-NATIVE-04
**Success Criteria** (what must be TRUE):
  1. The global summon hotkey works in the sandboxed store build (Tauri's `RegisterEventHotKey` is sandbox-safe; keep Cmd/Ctrl in the chord).
  2. The tray / menu-bar icon + menu work in the sandboxed store build.
  3. Keychain (`keyring`) is gated OUT of the store build — no runtime `MissingEntitlement`, no unjustified `keychain-access-groups` entitlement; store Pro state comes only from StoreKit (validated on the SIGNED build, runtime-only).
  4. Launch-at-login is hidden/disabled in the store build's General pane — the toggle and any autostart wiring are absent from the store variant (SMAppService deferred to v2).
**Plans**: TBD
**Research**: Skip — sandbox audit + SMAppService-omission are well-scoped; `MissingEntitlement` is runtime-only (verify on the signed build).
**Gate**: Human — global summon over a real OS chord; tray reveal; SIGNED-build entitlement audit (WebDriver can't synth these).
**UI hint**: yes

### Phase 30: `.pkg` Build + App Store Connect Submission
**Goal**: A signed `.pkg` (Apple Distribution + Mac Installer Distribution + embedded provisioning profile) uploads to App Store Connect with the IAP attached to the binary and complete submission metadata, the milestone delivers the step-by-step ASC setup guidance at the point each item is needed, and the direct DMG channel is proven un-regressed.
**Depends on**: Phases 26–29 all green (irreversible/integration-bound → runs LAST, after every source change lands)
**Requirements**: MAS-SHIP-01, MAS-SHIP-02, MAS-SHIP-03, MAS-SHIP-04, MAS-SHIP-05
**Success Criteria** (what must be TRUE):
  1. A build pipeline produces a signed `.pkg` (Apple Distribution + Mac Installer Distribution certs + embedded provisioning profile), separate from the direct Developer-ID/notarytool path, and uploads it to App Store Connect (`productbuild` → `altool`).
  2. The milestone delivers step-by-step App Store Connect setup guidance at the point each item is needed (Paid-Apps Agreement; the non-consumable "Pro" product attached to the binary + "Ready to Submit"; Sandbox tester accounts).
  3. Submission metadata is prepared as deliverables: privacy label = Data Not Collected (+ `PrivacyInfo.xcprivacy`), 4+ age rating, screenshots of real testable states, working support/privacy URLs, and Notes-for-Review documenting how to exercise the Pro IAP.
  4. The direct channel is un-regressed — the DMG still builds, signs, and notarises; `decoder.ts` + its 19 tests are byte-for-byte untouched.
**Plans**: TBD
**Research**: `/gsd-research-phase` LIKELY — `.pkg`/provisioning/signing sequence MEDIUM-confidence; validate ITMS bounce modes against the real universal bundle.
**Gate**: Human — full ship-gate walkthrough (signed `.app`, real purchase, restore on a fresh container, refund→drop) + direct-channel un-regressed; mirrors the v1.6 live-purchase gate. Build LAST (verify bundle mtime > last source commit).


## Progress

**Execution Order:**
Phases execute in numeric order. v1.6 runs 18 → 19 → 21 with Phase 20 parallel-capable beside 19 (external infra); Phase 21 requires both 19 and 20.

v1.7 runs 22 → 23 → 24 → 25 (started non-destructively while v1.6 is in final sign-off; numbering continues from Phase 21). Phase 22 is the modal-shell foundation all panes mount into; Phases 23 and 24 are independent pane work (parallel-capable after 22); Phase 25 adds the Updates pane and carries the milestone-close sign-off. Within Phase 22: wave 1 = the modal foundation (22-01); wave 2 = the webview entry points (22-02) + the native menu/tray (22-03) in parallel (no file overlap).

v1.8 runs 26 → 27 → 28 → 30 with Phase 29 parallel-capable beside 28 once 27 lands (29 shares only the sandbox-enable change). The bridge spike (26) is the critical path — nothing store-side compiles/renders without `platform.iap` — so it is strictly first; the variant seam (27) is the foundation for both 28 and 29; the irreversible `.pkg` submission (30) runs LAST, after every source change lands (verify bundle mtime > last source commit). Phases 26 + 28 + 29 + 30 each carry a MANDATORY human ship-gate walkthrough (WebDriver cannot drive StoreKit purchases / the sandbox / refunds / login-items).

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
| 28. Entitlement-Source Swap + Store License Pane | v1.8 | 1/5 | In Progress|  |
| 29. Sandbox-Safe Native Features | v1.8 | 0/0 | Not started | - |
| 30. .pkg Build + App Store Connect Submission | v1.8 | 0/0 | Not started | - |

## Backlog

Unsequenced ideas captured for future planning. Promote with `/gsd-review-backlog` when ready.

### Phase 999.1: More tools for the app (PROMOTED → v1.3 More Tools, in progress)

**Status:** PROMOTED — the Cron, URL, Regex tools + Protobuf decimal-byte-array input are being delivered as milestone v1.3 "More Tools" (Phases 12–15). What remains parked here is the rest of the candidate wishlist below (SQL + JavaScript/TS formatters still need a lib; Date, JSON↔YAML, Number Base, Escape/Unescape, comparers, etc. unscheduled).

**Goal:** [Captured for future planning] — expand beyond the v1 six tools. NOTE: v1 locked "six tools only" — promoting this means deliberately reopening that constraint. There is no code-level limit (registry is a plain array; router/sidebar/palette auto-derive), so growth is mechanical; the constraint is product focus, not architecture. v1.1 already added the JSON + XML formatters from this list; v1.3 adds Cron + URL + Regex; SQL remains parked.

**Candidate tool wishlist (user-provided, categorized):**

- **Converters** — Cron Parser ✓ (v1.3), Date, JSON Array → Table/CSV, JSON ↔ YAML, Number Base
- **Text** — Escape / Unescape, List Comparer, Markdown Preview, Analyzer & Utilities, Text Comparer
- **Encoders / Decoders** — Base64 Image, Base64 Text, Certificate, GZIP, HTML, JWT, QR Code, URL ✓ (v1.3)
- **Formatters** — JSON ✓ (v1.1), XML ✓ (v1.1), **JavaScript/TypeScript** (NEW — prettify/format a pasted JS/TS blob; reformats only, not a linter; needs a formatter lib — Prettier standalone (heavy, pulls plugins) or a lighter engine — so it must be weighed against the zero-dep wedge + the lazy-loaded `src/lib/` pattern), **SQL** (still parked — needs `sql-formatter` lib; reformats only, can't lint)
- **Generators** — Hash / Checksum, Lorem Ipsum, Password, UUID
- **Graphic** — Color Blind Simulator, Image Converter
- **Testers** — JSONPath, Regular Expression ✓ (v1.3), XML / XSD

Each candidate must still pass the product wedge: offline/no-network, paste-instant (<2s), keyboard-driven, registry-driven, WCAG-AA, and the build+verify harness.

**Requirements:** TBD (remaining wishlist; Cron/URL/Regex requirements now in `.planning/REQUIREMENTS.md` for v1.3)
**Plans:** 1/5 plans executed

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

### Phase 999.10: Mac App Store distribution (BACKLOG — Apple Developer enrolment now done)

**Status:** PROMOTING → v1.8 (selected via `/gsd-review-backlog` 2026-06-21). Open the milestone with `/gsd-new-milestone` to scope APP-STORE-01.. — this entry is the seed. **Unblocked 2026-06-20: the Apple Developer Account is signed up** (the prerequisite that kept notarisation/App-Store deferred, see 999.2 + D-02). Direct distribution (signed DMG + Tauri auto-updater) stays the primary channel; this ADDS a second App Store channel. **Licensing decision RESOLVED 2026-06-20 (StoreKit IAP).**

**Goal:** [Captured for future planning] — ship TinkerDev on the **Mac App Store** as a second distribution channel alongside the existing direct DMG + updater. The hard prerequisite (paid Apple Developer enrolment) is cleared; the rest is signing/sandbox/policy work.

**Two related deliverables this unblocks:**
1. **Proper Developer ID notarisation for the DIRECT channel** (smaller, do first) — flip the currently ad-hoc-signed DMG/updater (Phase 6/11) to a Developer-ID-signed + `notarytool`-notarised + stapled build. The release scripts are already "notarisation-ready" (honor `APPLE_*` env, per 999.2 + RELEASE.md "post-enrolment flip"); this is mostly wiring the cert + `APPLE_ID/APPLE_TEAM_ID/APPLE_API_KEY` secrets and re-cutting a notarised release. Removes the Gatekeeper "unidentified developer" friction for direct downloads.
2. **Mac App Store build + submission** (larger, the real item) — a separate App-Store-target build uploaded to App Store Connect.

**Key open questions / risks for promotion (App Store target):**
- **✅ Licensing vs IAP — RESOLVED 2026-06-20: Option (a) StoreKit In-App Purchase.** The App-Store variant unlocks Pro via **StoreKit IAP** (Apple's required path; guideline 3.1.1 forbids reusing the external Keygen key-paste flow in-store). Commission is **15% via the Small Business Program** (TinkerDev qualifies, <$1M/yr). Rejected: (b) free-in-store / direct-only — leaves in-store conversions on the table; (c) external-link entitlement — 0% in US post-Apr-2025 injunction but region-fragmented (CTF/commission elsewhere) and highest review-rejection risk. (Today's Pro unlock on the DIRECT channel stays: Lemon Squeezy MoR → Keygen key → activation.)
  **Technical shape (recommended at promotion, not yet locked):**
  - **StoreKit 2 on-device verification** (signed JWS, Apple public keys, no server) — mirrors the existing offline Ed25519 Rust-verify model.
  - One **non-consumable** "Pro" product (perpetual — matches today's perpetual node-locked Keygen model).
  - **Per-variant entitlement source:** App-Store build = **StoreKit-only** (Keygen key-paste UI + `license.tinkerdev.io` calls compiled OUT for 3.1.1 compliance); direct build = **Keygen-only**. The build-variant seam already needed to strip the updater **also switches the entitlement source**. Both resolve to the **same** `pro.theming`/`pro.ordering` map consumed by the one central Rust gate — no change to the webview gate.
  - Native **StoreKit bridge** (Swift/ObjC via Tauri; no first-class plugin) lives behind the `src/lib/platform/` seam — **spike the bridge first**.
- **App Sandbox is mandatory on the App Store** (`com.apple.security.app-sandbox`) and conflicts with current native features: **global summon** (global-shortcut may be restricted/need entitlements), **launch-at-login** (the current autostart plugin writes a `LaunchAgent` plist — NOT sandbox-compatible; must move to the sandbox-safe `SMAppService` login-item API), and possibly the **tray**. Each needs a sandbox-compatible path or a graceful feature-flag-off on the App Store build.
- **Auto-updater MUST be removed from the App Store build** — Apple forbids self-updating apps (the store handles updates). The Tauri `updater` plugin + `latest.json` flow (DST-02) must be **conditionally compiled out** for the App-Store target → two build variants (direct = with updater; App Store = without). The Updates pane (SET-10 / Phase 25) should hide/disable its check on App Store builds.
- **One build-variant seam carries everything (convergence note).** Direct vs App-Store is a *single* variant axis that switches three things together — (1) **updater**: in (direct) / compiled out (store); (2) **entitlement source**: Keygen (direct) / StoreKit-only (store); (3) **sandbox feature-flags**: full native (direct) / sandbox-safe-or-degraded summon·launch-at-login·tray (store). Design it as one seam, not three independent toggles.
- **Build + upload mechanics:** App-Store-target `tauri build` (universal) → `.pkg` signed with the Apple Distribution cert + provisioning profile → upload via Transporter / `xcrun altool`/`notarytool` to App Store Connect; metadata, screenshots, privacy nutrition labels, age rating, review (1–3 days).
- **Constraints that still hold:** offline/no-network at runtime (the licensing exception aside), HashRouter, the six-tools wedge, decoder + its 19 tests untouched, WCAG-AA, the full build+verify harness.

**Requirements:** TBD (APP-STORE-01.. on promotion)
**Plans:** 0 plans

Plans:
- [ ] Ready to promote (decision resolved) — run /gsd-review-backlog or /gsd-new-milestone to open v1.8 (APP-STORE-01..).
