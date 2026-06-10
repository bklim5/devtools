---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Licensing
status: executing
last_updated: "2026-06-10T14:40:06.495Z"
last_activity: 2026-06-10 -- Plan 18-02 complete (lazy registry + ToolRoute element-level gate)
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 4
  completed_plans: 2
  percent: 50
---

# Project State

## Current Position

Milestone: **v1.6 "Licensing"** — started 2026-06-09, roadmap created 2026-06-09.
Phase: 18 (entitlements-seam-central-gate) — EXECUTING
Plan: 3 of 4 (18-01 complete — `feb6ec97`..`f3024ced`; 18-02 complete — `2d776d0c`)
Status: Executing Phase 18
Progress: [□□□□] 0/4 phases · v1.6 plans 2/4
Last activity: 2026-06-10 -- Plan 18-02 complete (lazy registry + ToolRoute element-level gate; 14/14 e2e green)

**Goal:** one-time-payment lifetime license — MoR checkout → webhook → Keygen (perpetual, node-locked, maxMachines=1); paste-key one-time activation (fingerprint `HMAC-SHA256(IOPlatformUUID, salt)`); offline Ed25519-verified `machine.lic` (~30-day TTL) thereafter; license key in Keychain (Rust-owned); free tier locks Protobuf hero + theming + ordering/pinning behind a central entitlement gate. Research: `docs/licensing-research.md`.

**v1.6 phase structure (ROADMAP.md):**

- **Phase 18 — Entitlements Seam & Central Gate** (ENT-01..05): pure-frontend gating seam, lock badges + upsell panel, lazy registry loaders; in-Tauri default = everything unlocked until Phase 21 flips it.
- **Phase 19 — License Activation & Offline Verification** (LIC-01/02/03/04/06): Keygen Rust core — activation, fingerprint, Ed25519 offline verify, Keychain, fail-closed. **Riskiest chunk; includes the SPIKE: confirm client-side license-key → license-token exchange against the live Keygen API.**
- **Phase 20 — Purchase Pipeline** (PAY-01..03): MoR checkout → webhook backend → Keygen license creation → key emailed. External infra; **parallel-capable with Phase 19** (depends only on 18).
- **Phase 21 — License Lifecycle & Ship Gate** (LIC-05/07/08/09): TTL refresh + grace, transfer, revocation, status UI; **flips the free-tier default live**; full 8-case ship-gate matrix on a fresh build. Depends on 19 AND 20 (end-to-end purchase→activation).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260608-avk | Release notes via CHANGELOG.md (pure `extractChangelogSection` + wired both release drivers + multi-line updater banner) | 2026-06-08 | dcbf344f | [260608-avk-plumb-release-notes-through-changelog-md](./quick/260608-avk-plumb-release-notes-through-changelog-md/) |
| 260609-ard | `pnpm release:changelog "xxx"` edit-only driver (append to Unreleased) + `release:bump` auto-promotes Unreleased → `## [X.Y.Z] - date` (pure `appendUnreleasedEntry`/`promoteUnreleased`; CHANGELOG.md optional in bump ALLOWED_PATHS) | 2026-06-09 | e1a8e32e | [260609-ard-add-pnpm-release-changelog-command-auto-](./quick/260609-ard-add-pnpm-release-changelog-command-auto-/) |

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-09, v1.6 started) · roadmap: .planning/ROADMAP.md · requirements: .planning/REQUIREMENTS.md · research: docs/licensing-research.md

**Core value:** Paste an unknown blob → usable, explorable interpretation in <2s, entirely offline, no mouse.
**Current focus:** Phase 18 — entitlements-seam-central-gate

## v1.5 — Pinned Tools (SHIPPED & ARCHIVED, 2026-06-07)

v1.5 complete — Phase 17 (2 plans), archived to `.planning/milestones/v1.5-*` (+ `v1.5-phases/`), tag `v1.5` (local-only). A distinct "Pinned" sidebar section over a persisted `pinnedToolIds` overlay (registry stays the single control plane; ⌘K palette + router pin-agnostic): left-of-grip pin toggle + **Alt+P**, two-group `partitionTools` (always a full registry partition; drop unknown / de-dupe), independent per-group drag + Alt+↑/↓ reorder (no cross-boundary), "Unpin all" in the Shift+F10 menu, persisted + reconciled on load. All 9 PIN requirements validated on the real WKWebView; full suite **694/694**; decoder + its 19 tests byte-for-byte untouched; zero new runtime/dev deps; gsd-ui-review WCAG-AA 23/24. Post-walkthrough fixes (**D-17**, see Accumulated Context): Alt+P keys off physical `KeyP` (macOS Option+P → "π"); Tab-reachable rows + pin fallback + ↑/↓ focus nav; 24×24 targets.

## Accumulated Context

**Inherited binding wedge (every phase):** offline/no-network · paste-instant (<2s) · keyboard-driven · registry-driven single control plane · HashRouter only · WCAG-AA (keyboard path + `aria-live` mandatory, not optional) · layout-agnostic · **zero new runtime AND dev dependencies in the webview** · **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched**. UI features add the **real-WKWebView UI gate**.

**v1.6 scoped amendments (locked, recorded in PROJECT.md + REQUIREMENTS.md):** "no network at runtime" gains a narrow licensing-only exception — one-time activation + opportunistic ~30-day TTL refresh, never per-launch checks, all tools fully functional offline. Rust crates for licensing (`ed25519-dalek`, `keyring`, HMAC) are expected and allowed; webview runtime deps stay zero.

**v1.6 architecture (locked — `docs/licensing-research.md`, do not re-litigate):** Keygen perpetual + node-locked (`maxMachines=1`); unencrypted Ed25519-signed `machine.lic` verified in Rust (embedded pubkey + fingerprint `HMAC-SHA256(IOPlatformUUID, app-salt)`); license key in macOS Keychain (Rust-owned, never readable from JS); React sees only `license_status`/`activate_license`/`refresh_license`/`deactivate_machine` returning a resolved entitlement set; MoR checkout (Lemon Squeezy default, payout-country pending) → webhook → small backend → Keygen license creation (privileged tokens server-side ONLY); webview gating = UX-gating, not DRM (accepted); OS-portable seams, macOS-only impl; locked tools stay visible with lock badge + upsell panel (never hidden, no opacity-only state).

**Phase 18 plan 01 decisions (2026-06-10):** entitlement vocabulary = `pro.theming` + `pro.ordering` (ONE arrangement entitlement covers reorder+pin+reset, D-26/D-28); reserved `premium?: boolean` DELETED from ToolDefinition (zero call sites) — `requiredEntitlements?: string[]` replaces it; entitlements store's synchronous default = `isTauriEnv() ? FULL_SET : FREE_SET` so pre/post-resolution agree without an override (no startup lock-flash); UpsellModal gained a Tab focus trap beyond plan spec (aria-modal without a trap fails WCAG-AA — codex review). `resolveEntitlements()` in `src/lib/entitlements/resolve.ts` is THE single Phase-21 flip point.

**Phase 18 plan 02 decisions (2026-06-10):** registry fully lazified (ENT-05) — all 11 entries are `component: () => import(...)`, `ToolDefinition.component` narrowed to `LazyComponent` only; tool routes render through the element-level `<ToolRoute>` gate (locked → UpsellPanel WITHOUT invoking the loader, unlocked → module-cached `React.lazy` keyed by tool.id in `Suspense fallback={null}`); route-level router `lazy` deliberately NOT used (memoized once — would defeat reactive flips AND fetch locked chunks). Build-proven: 11 per-tool Vite chunks, decoder isolated to `ProtobufDecoder-*.js` only (free-build exclusion seam is real). `lazyToolComponent(tool)` is the ONE way to materialize a tool component.

**v1.6 sequencing decisions:** entitlements seam FIRST (pure frontend, free-tier default = everything unlocked until Phase 21 flips it at integration); Keygen Rust integration is the riskiest chunk and carries the key→token-exchange SPIKE; PAY pipeline is external infra, parallel-capable with Phase 19; lifecycle hardening + the 8-case ship-gate matrix close the milestone.

**v1.6 open items (resolve in spike/planning):** client-side key→token exchange vs raw key in Keychain (spike, Phase 19); Lemon Squeezy seller payout-country verification (before Phase 20 commits); Keygen production tier (paid Std cloud vs self-hosted CE — free Dev tier dev-only, ~100 ALU cap); exact offline-grace behavior when TTL lapses offline (Phase 21 planning).

**v1.5 design (confirmed, do not re-litigate):** pinning is a render-time presentation overlay (`pinnedToolIds`) persisted through the existing `usePreferences`/`platform.store` seam beside `toolOrder`/`recentToolIds`; registry stays the single control plane (⌘K palette + router pin-agnostic). Reuses v1.4's `reconcileToolOrder`/`moveToolInOrder`, grip-handle drag + Alt+↑/↓ reorder, and the `aria-live` pattern. **Defaults:** no tool pinned by default (empty pinned section → no divider; hero NOT auto-pinned); pinning appends to the bottom of the pinned section; membership changes via pin/unpin only (no drag-across-boundary). Settings surface + auto-pin-hero stay deferred.

**Phase 17 context decisions (`17-CONTEXT.md`, 2026-06-05):** **D-13** pin/unpin shortcut = **Alt+P** (focused row; same family as Alt+↑/↓; plain single-key rejected per the sidebar's no-single-key model); announced "Pinned/Unpinned {tool}" via the existing `aria-live`. **D-14** pin icon sits **left of the grip handle**; **pinned rows show a persistent always-visible filled pin** (state + unpin target — no hover-only); unpinned rows show an outline pin on hover/`focus-visible` only; neutral tokens, NavLink right-padding widened for two controls. **D-15** Pinned group separated by a **bare neutral divider, no visible "PINNED" label** (compact density preserved); SR group named via `aria-label`; divider/group shown only when ≥1 pinned. **D-16** **"Unpin all" joins the existing right-click "Reset order" context menu** (reuses Shift+F10 entry; calls `setPinnedToolIds([])`), shown only when ≥1 pinned.

**D-17 (extends D-13, post-sign-off walkthrough 2026-06-07 — supersedes the planned D-05 "no roving nav"):** sidebar keyboard model reworked from live macOS feedback. **(a) Alt+P macOS fix (the real bug):** Option+P composes to the character "π", so the old `e.key === "p"` check was dead on the real WKWebView (the prior e2e gave a false positive by synthesizing `key:'p'`); now matches the PHYSICAL key `e.code === "KeyP"` (commit `cf7c566d`; e2e regression spec dispatches `key:'π'/code:'KeyP'`). **(b) Arrow nav:** plain **↑/↓** + Home/End move focus tool-to-tool across the pinned↔unpinned divider as one continuous list (clamp at ends, no wrap), via a pure `resolveRovingTarget` helper in `toolOrder.ts` (+9 unit tests). **(c) Tab model (FINAL):** every `NavLink` row is a Tab stop AND the pin button is Tab-reachable (`tabIndex={0}`; Enter/Space pins) as a keyboard fallback; the grip is pointer-only (`tabIndex={-1}`, `aria-hidden`). Alt+↑/↓ still reorder within-group (PIN-06 intact); Alt+P / Shift+F10 fire from the row. **(d)** pin+grip widened to 24×24 for WCAG 2.5.8 (`a3b0c087`). NOTE: an interim single-Tab-stop roving model (`b5ef70d3`/`6639da59`) was reverted to this Tab-friendly model (`1c6bfb8c`) per user request ("tab should also go to the pin / next tool"). Commits: `a3b0c087`, `b5ef70d3`, `6639da59`, `cf7c566d`, `1c6bfb8c`. Full suite **694/694**; real-WKWebView e2e green (macOS Option+P regression covered).

**Open carry-forwards (non-blocking):** settings surface (deferred); auto-pin/lock-hero (deferred); CI track (999.2); remaining tool wishlist (999.1); theme settings (999.3); DevTools CLI (999.4); Protobuf schema-file (999.5); FormatterView narrow-width stacking (UX-05); notarisation pending Apple enrolment (D-02); NAT-01 global summon hotkey (G-05-1); Cron advisory follow-ups (`15-REVIEW-FIX.md`); 3 minor updater a11y follow-ups.

## Harness reminder (per-task DoD, in order)

simplify → /codex:review → unit (vitest + tsc + eslint green) → real-WKWebView UI verification. Phase boundary: human sign-off on a fresh `tauri build` + a passing `gsd-ui-review` WCAG-AA audit. Never skip gates; parallelize plans but not past the gates. **Native-OS input (drag/drop, OS key chords, file drops) is manual-walkthrough coverage — the WebDriver can't synthesize it; make it an explicit human-verify item.** See [[tauri-native-dragdrop-blocks-html5-dnd]].

---

## v1.4 — Reorderable Tools (SHIPPED & ARCHIVED, 2026-06-05)

v1.4 complete — Phase 16 (2 plans), archived to `.planning/milestones/v1.4-*`, tag `v1.4` (local-only). The app's first personalization feature: a user-reorderable sidebar — `toolOrder` overlay over the registry (registry stays the single control plane), handle-initiated native HTML5 drag + neutral insertion line, Alt+↑/↓ keyboard reorder with `aria-live`, persisted + reconciled (new-tool-append / unknown-drop / de-dupe) + keyboard-reachable reset-to-default. All 7 REORD requirements validated on the real WKWebView; full suite 668/668; zero new runtime/dev deps; decoder + its 19 tests byte-for-byte untouched. Post-ship fix `1c2c7664`: Tauri `dragDropEnabled:false` so in-page HTML5 drag works.

## v1.3 — More Tools (SHIPPED & ARCHIVED, 2026-06-04)

v1.3 complete — Phases 12–15 (11 plans), archived to `.planning/milestones/v1.3-*`, tag `v1.3` (local-only). Three new tools (URL/Regex/Cron) + Protobuf decimal input; eight tools → eleven. All 25 requirements validated on the real WKWebView; full suite 650/650; zero new runtime/dev deps; decoder + its 19 tests byte-for-byte untouched.

## v1.2 — Release Tooling (SHIPPED & ARCHIVED, 2026-06-03)

v1.2 complete — Phases 9–11 (8 plans), archived to `.planning/milestones/v1.2-*`, tag `v1.2` (local-only). `pnpm release:bump` + `pnpm release:publish` over a unit-tested pure release core (`src/lib/release/`); universal-binary dual-key signature-verified cross-repo publish. All 12 REL requirements; proven live (v0.2.2 + DST-02 updater round-trip). Zero new runtime deps; decoder + its 19 tests untouched. CI track parked (999.2).

## v1.1 — Formatters (SHIPPED & ARCHIVED, 2026-06-02)

v1.1 complete — Phases 7 + 8 (4 plans), archived to `.planning/milestones/v1.1-*`, tagged `v1.1`. JSON + XML formatters behind a shared `FormatterView` (FMT-01..08, zero new runtime deps) + the opt-in `StatusBar` size readout (UIX-01). Decoder + its 19 tests untouched. **Carry-forward (non-blocking):** FormatterView narrow-width vertical stacking (UX-05, polish).

## v1.0 — Distribution (SHIPPED, signed off 2026-06-01)

v1.0 complete — all 6 phases (28/28 plans): foundation/harness (1), shell (2), Protobuf hero + Base64/Hex/Bytes + UX constraints (3), the four catalogue tools (4), native polish (5), distributable self-updating signed-DMG macOS app + verified auto-updater (6). Full archive: `.planning/milestones/v1.0-*` + `.planning/MILESTONES.md`.

**Carry-forwards (NOT v1.6 blockers):** Gatekeeper-clean notarisation deferred post-Apple-enrolment (D-02, credentials-only flip); NAT-01 configurable global summon hotkey parked (G-05-1); 3 minor a11y polish follow-ups from the updater UI review; Cron advisory follow-ups (MD-01 next-run perf, LO-02/LO-03 copy/locale — `15-REVIEW-FIX.md`); backlog 999.1 (remaining tool wishlist), 999.2 (CI track), 999.3 (theme settings), 999.4 (DevTools CLI), 999.5 (Protobuf schema-file).
