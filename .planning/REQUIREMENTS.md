# Requirements: TinkerDev — Milestone v1.8 "Mac App Store Distribution"

**Defined:** 2026-06-22
**Core Value:** Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse.

**Milestone goal:** Ship TinkerDev on the Mac App Store as a SECOND distribution channel beside the existing direct DMG + updater. Scope = the App Store target ONLY (direct-channel Developer-ID notarisation is already shipped). Both channels resolve to the same `pro.*` entitlement map through the one existing central gate; the webview gate, registry, and every tool stay byte-unchanged.

**Locked decisions (from 999.10 + this milestone's questioning):**
- In-store Pro = StoreKit IAP, ONE non-consumable, perpetual; on-device JWS verify (serverless, mirrors the Ed25519 model); 15% Small Business Program.
- ONE build-variant axis switches three layers together: updater in/out, entitlement source (Keygen vs StoreKit-only), sandbox feature-flags.
- Keep the global summon hotkey + tray in the sandboxed store build (sandbox-safe).
- **Launch-at-login is NOT shipped in the store build this milestone** — the LaunchAgent autostart plugin is sandbox-incompatible; SMAppService is deferred (see v2).
- ASC setup (agreements, IAP product, Sandbox testers, metadata) is delivered as guided step-by-step walkthroughs in-milestone.

## v1 Requirements

### StoreKit In-App Purchase (MAS-IAP)

- [x] **MAS-IAP-01**: In the store build, a user can buy Pro via the native StoreKit purchase sheet (one non-consumable, perpetual), with `.success` / `.userCancelled` / `.pending` ("waiting for approval", not an error) all handled calmly.
- [x] **MAS-IAP-02**: After a successful purchase, Pro unlocks live (theming, tool ordering/pinning, ⌘K palette) through the same central gate — no relaunch.
- [ ] **MAS-IAP-03**: A user can **Restore Purchases** from Settings ▸ License (Apple-mandatory) to re-unlock Pro on a fresh install or new machine, behind an explicit button (never silent at launch).
- [x] **MAS-IAP-04**: Pro is verified on-device (StoreKit 2 JWS `VerificationResult`); `.unverified` or failed verification falls closed to the free tier.
- [x] **MAS-IAP-05**: A refund/revocation drops Pro live (a `Transaction.updates` listener at boot reuses the existing "Pro features turned off" drop-notice).
- [ ] **MAS-IAP-06**: The store-build License pane shows status + Buy (App Store `displayPrice`) + Restore — and shows NO key field, NO external buy link, and NO literal price (guideline 3.1.1).
- [ ] **MAS-IAP-07**: Because Apple manages the license, the store-build UI omits every Keygen-only concept — no "activate with key", no machine **deactivate / seat-transfer**, no machine-fingerprint/seat-limit copy, no "lost your key / check your purchase email" — and uses App-Store-managed wording where a status explanation is needed (e.g. "managed through the App Store / your Apple ID"). The contextual Unlock-Pro modal (the focused upsell over `ActivationSurface`) and every Pro-upsell trigger (sidebar "Unlock Pro", locked pin/reorder/⌘K) present the StoreKit Buy/Restore flow in the store build, never the Keygen activation form.

### Build Variant & Sandbox (MAS-BUILD)

- [x] **MAS-BUILD-01**: The repo builds two variants from one codebase, each from a single canonical build command (direct = today's DMG/updater; appstore = sandboxed StoreKit), so a half-variant can't ship.
- [x] **MAS-BUILD-02**: The App Store build runs under App Sandbox (`com.apple.security.app-sandbox` + `com.apple.security.network.client`) and launches without a white-screen on the signed `.app`.
- [x] **MAS-BUILD-03**: The auto-updater (Rust plugin + endpoints) is compiled OUT of the store build — absent, not merely hidden — and verifiable on the built bundle (Apple forbids self-updating apps; the store handles updates).
- [ ] **MAS-BUILD-04**: The Keygen surface (key field, `license.tinkerdev.io` calls, external buy link, literal `$9`) is compiled OUT of the store build and grep-verifiable clean on the bundle.
- [x] **MAS-BUILD-05**: The store variant builds at `minimumSystemVersion` 13.0 while the direct channel stays 10.15 (the 13.0 bump never leaks onto the base config).
- [x] **MAS-BUILD-06**: A committed verify script asserts store-bundle compliance at the gate (required entitlements present; forbidden plugins via `cargo tree`/`otool` and forbidden strings via `grep` absent).
- [ ] **MAS-BUILD-07**: In the store build the Settings ▸ Updates pane is RETAINED but App-Store-managed: it shows "Your app update is managed by the App Store" and the Check-for-updates + Install affordances are removed (not just disabled); the running-version readout may remain. (The underlying updater is compiled out per MAS-BUILD-03 — this is the user-facing counterpart.)

### Sandbox-Safe Native Features (MAS-NATIVE)

- [ ] **MAS-NATIVE-01**: The global summon hotkey works in the sandboxed store build.
- [ ] **MAS-NATIVE-02**: The tray / menu-bar icon + menu work in the sandboxed store build.
- [ ] **MAS-NATIVE-03**: Keychain (`keyring`) is gated OUT of the store build (no runtime `MissingEntitlement`, no unjustified `keychain-access-groups` entitlement) — store Pro state comes only from StoreKit.
- [ ] **MAS-NATIVE-04**: Launch-at-login is hidden/disabled in the store build's General pane (not shipped this milestone; the toggle and any autostart wiring are absent from the store variant).

### .pkg Build & App Store Submission (MAS-SHIP)

- [ ] **MAS-SHIP-01**: A build pipeline produces a signed `.pkg` (Apple Distribution + Mac Installer Distribution certs + embedded provisioning profile), separate from the direct Developer-ID/notarytool path.
- [ ] **MAS-SHIP-02**: The signed `.pkg` uploads to App Store Connect (`productbuild` → `altool`).
- [ ] **MAS-SHIP-03**: The milestone delivers step-by-step App Store Connect setup guidance at the point each item is needed (Paid-Apps Agreement; the non-consumable "Pro" product attached to the binary + "Ready to Submit"; Sandbox tester accounts).
- [ ] **MAS-SHIP-04**: Submission metadata is prepared as deliverables: privacy label = Data Not Collected (+ `PrivacyInfo.xcprivacy`), 4+ age rating, screenshots of real testable states, working support/privacy URLs, and Notes-for-Review documenting how to exercise the Pro IAP.
- [ ] **MAS-SHIP-05**: The direct channel is un-regressed by the variant work — the DMG still builds, signs, and notarises; decoder.ts + its 19 tests are byte-for-byte untouched.

## v2 Requirements

### Deferred App Store / IAP enhancements

- **MAS-NATIVE-05**: Launch-at-login in the store build via `SMAppService` (sandbox-safe login item) — deferred this milestone.
- **MAS-IAP-08**: Family Sharing toggle for the Pro non-consumable.
- **MAS-IAP-09**: Promo / offer codes and a "Manage Purchases" deep link.
- **MAS-SHIP-06**: Windows / Linux store channels (Microsoft Store, etc.).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Direct-channel Developer-ID notarisation | Already shipped (v0.4.1 notarized+stapled+spctl-clean DMG); not part of this milestone |
| Server-side StoreKit receipt validation | StoreKit 2 on-device JWS verify is serverless and mirrors the existing offline model; a server contradicts the no-network ethos |
| External-purchase-link entitlement (US-storefront loophole) | Region-fragmented + highest review-rejection risk; StoreKit-only is the simplest globally-shippable path |
| Dual-surfacing Keygen + StoreKit in one build | Guideline 3.1.1 forbids the Keygen key-paste flow in-store; each variant has exactly one entitlement source |
| Subscriptions / consumables | Pro is a one-time perpetual unlock; a non-consumable matches today's node-locked model |
| Changing the webview entitlement gate or registry | Both variants resolve to the same `pro.*` map; the gate stays byte-unchanged |

## Traceability

Phase structure (dependency-forced, continues from Phase 25): **26** StoreKit bridge spike → **27** build-variant seam → **28** entitlement-source swap + store License pane → **29** sandbox-safe native features → **30** `.pkg` build + submission. Every v1 requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MAS-IAP-01 | Phase 26 | Complete |
| MAS-IAP-04 | Phase 26 | Complete |
| MAS-IAP-02 | Phase 28 | Complete |
| MAS-IAP-03 | Phase 28 | Pending |
| MAS-IAP-05 | Phase 28 | Complete |
| MAS-IAP-06 | Phase 28 | Pending |
| MAS-IAP-07 | Phase 28 | Pending |
| MAS-BUILD-01 | Phase 27 | Complete (2026-06-23) |
| MAS-BUILD-02 | Phase 27 | Complete (2026-06-23, human-verified) |
| MAS-BUILD-03 | Phase 27 | Complete (2026-06-23) |
| MAS-BUILD-05 | Phase 27 | Complete (2026-06-23) |
| MAS-BUILD-06 | Phase 27 | Complete (2026-06-23) |
| MAS-BUILD-04 | Phase 28 | Pending |
| MAS-BUILD-07 | Phase 28 | Pending |
| MAS-NATIVE-01 | Phase 29 | Pending |
| MAS-NATIVE-02 | Phase 29 | Pending |
| MAS-NATIVE-03 | Phase 29 | Pending |
| MAS-NATIVE-04 | Phase 29 | Pending |
| MAS-SHIP-01 | Phase 30 | Pending |
| MAS-SHIP-02 | Phase 30 | Pending |
| MAS-SHIP-03 | Phase 30 | Pending |
| MAS-SHIP-04 | Phase 30 | Pending |
| MAS-SHIP-05 | Phase 30 | Pending |

**Per-phase scope:**
- **Phase 26** (2): MAS-IAP-01, MAS-IAP-04 — the bridge spike proves the native purchase sheet + on-device JWS verify.
- **Phase 27** (5): MAS-BUILD-01, -02, -03, -05, -06 — the 3-layer variant seam, sandbox launch, updater compile-out, min-version split, verify script.
- **Phase 28** (7): MAS-IAP-02, -03, -05, -06, -07, MAS-BUILD-04, MAS-BUILD-07 — entitlement-source swap, store License pane (Buy/Restore, App-Store-managed wording), App-Store-managed Updates pane, refund-drop, Keygen compile-out + grep-clean.
- **Phase 29** (4): MAS-NATIVE-01, -02, -03, -04 — summon + tray under sandbox, Keychain gated out, launch-at-login hidden.
- **Phase 30** (5): MAS-SHIP-01, -02, -03, -04, -05 — `.pkg` build + ASC upload, ASC setup guidance, submission metadata, direct-channel un-regressed.

**Coverage:**
- v1 requirements: 23 total (MAS-IAP ×7, MAS-BUILD ×7, MAS-NATIVE ×4, MAS-SHIP ×5)
- Mapped to phases: 23 / 23 ✓ (every requirement → exactly one phase, no orphans, no duplicates)
- Unmapped: 0

---
*Requirements defined: 2026-06-22*
*Last updated: 2026-06-22 — roadmapped: all 22 v1 requirements mapped across Phases 26–30 (100% coverage). See `.planning/ROADMAP.md`.*
