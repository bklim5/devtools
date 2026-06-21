# Project Research Summary

**Project:** TinkerDev (DevTools)
**Domain:** v1.8 "Mac App Store Distribution" — adding a sandboxed Mac App Store channel + StoreKit IAP + App Sandbox to an existing shipped Tauri 2 + Vite + React + TS macOS app
**Researched:** 2026-06-22
**Confidence:** HIGH (Apple rules + Tauri sandbox failure modes verified from official docs + dated GitHub issues; in-repo seams cited file:line). MEDIUM only on the StoreKit-bridge *internals* — spike-gated.

## Executive Summary

v1.8 adds a **second distribution channel** (Mac App Store) to an already-shipped, notarized direct-DMG app. The direct channel is OUT of scope. This is fundamentally a **build-variant + compliance** problem, not a feature problem: the same app must ship as two artifacts that differ in entitlement source (Keygen key-paste → StoreKit IAP), update mechanism (self-updater → store-delivered, compiled OUT), and security model (hardened-runtime Developer-ID → App Sandbox). The locked decisions (999.10) make this tractable — both variants resolve to the **same `pro.theming`/`pro.ordering` map through the one existing central gate**, so the webview gate, registry, and every tool consumer are byte-unchanged. The work concentrates at exactly three new seams.

The recommended approach is **one variant axis with three synchronized layers**, every one of which already has an in-repo precedent: a Rust cargo feature (`appstore`, mirrors the existing `webdriver` feature), a `tauri.appstore.conf.json` `--config` RFC-7396 overlay (sandbox entitlements, `minimumSystemVersion` 13.0, `targets:["app"]`, no updater), and a Vite `VITE_CHANNEL` define that **tree-shakes** (not hides) the Keygen surface. Bind all three in one `package.json` build script so a half-variant can't ship. The StoreKit bridge slots behind `platform/` exactly like `platform.license` (real arm in `tauri.ts` only, deterministic no-op arm for tests); the entitlement-source swap is a **single new branch in one function** (`resolveEntitlements()`). The highest-risk dependency is the StoreKit bridge itself — there is no first-class Tauri plugin; `tauri-plugin-iap@0.9.0` is a 72-star single-maintainer plugin that must be **spiked first**, with a `swift-rs` hand-rolled bridge as the fallback (same seam shape either way).

The dominant risks are **App Store rejections and a sandbox-only white-screen** — most are invisible to the existing unit + WebDriver gates and surface only on the signed sandboxed `.app`. The four ship-gate killers: (1) missing `com.apple.security.network.client` → blank webview on launch (the IPC channel is treated as network — mandatory *despite* the offline ethos); (2) any Keygen key-paste UI / `license.tinkerdev.io` / `$9` / `BUY_LICENSE_URL` surviving in the bundle → guideline 3.1.1 rejection (must be **compile-out + grep-verifiable**, not hidden); (3) updater/autostart plugins merely hidden but still linked → 2.4.5 / sandbox rejection; (4) IAP not testable by the reviewer (Paid-Apps Agreement, "Ready to Submit", **mandatory Restore Purchases**, Notes-for-Review). Plus a structural harness limit: **WebDriver cannot drive StoreKit purchases, the sandbox, refunds, or login items** — a human ship-gate walkthrough with a Sandbox tester account is mandatory at every StoreKit/sandbox phase boundary.

## Key Findings

### Recommended Stack

The App Store variant adds StoreKit 2 (on-device JWS verification — mirrors the existing offline Ed25519 model, **no server**), App Sandbox, and a sandbox-safe login item, all gated behind the `appstore` cargo feature so the direct build never compiles them. The headline trade-off: **`minimumSystemVersion` must bump 10.15 → 13.0 for the store variant ONLY** (both `tauri-plugin-iap` and `SMAppService` pin 13.0); the direct DMG stays at 10.15 via the per-variant `--config` merge — a leak of 13.0 onto the base config silently drops direct-channel Monterey users. Full detail in [STACK.md](./STACK.md).

**Core technologies (additions for the store variant):**
- **StoreKit 2** (`Transaction.currentEntitlements` / `Product.purchase()` / `VerificationResult`): on-device IAP with built-in JWS verify — serverless, mirrors the offline model
- **`tauri-plugin-iap@0.9.0`**: the only Tauri-2 StoreKit-on-macOS bridge — **SPIKE FIRST** (72-star, single maintainer); fallback = hand-rolled Swift via **`swift-rs@1.0.7`** (mature) behind the same seam
- **App Sandbox** (`com.apple.security.app-sandbox` + **mandatory `com.apple.security.network.client`** + app-id/team/`keychain-access-groups` from the provisioning profile): required for MAS; network.client is for the webview IPC, not features
- **`SMAppService`** (macOS 13+, via `smappservice-rs@0.1.3` or `objc2-service-management` direct): sandbox-safe launch-at-login replacing the non-sandbox-safe `tauri-plugin-autostart` LaunchAgent plist
- **Build/sign toolchain**: `tauri build` emits the signed `.app` only → `xcrun productbuild` (Mac Installer Distribution cert) → `.pkg` → `xcrun altool` upload. **Apple Distribution** + **Mac Installer Distribution** certs + embedded provisioning profile (NOT Developer ID / notarytool)

### Expected Features

The governing rule is guideline **3.1.1**: a Mac App Store app may not unlock features via license keys or present a license screen. Everything follows from this — the store variant is StoreKit-only and the entire Keygen surface compiles out. The US-storefront external-link loophole (post-Epic) is an **explicitly-rejected** option (StoreKit-only is the simplest globally-shippable path). The submission metadata items (privacy label, screenshots of real states, Notes-for-Review, IAP-attached-to-binary) are treated as **deliverables**, not afterthoughts — 2.1/2.3 metadata is the top utility-rejection bucket (40%+). Full detail in [FEATURES.md](./FEATURES.md).

**Must have (table stakes — any missing = rejection or non-functional purchase):**
- One **non-consumable "Pro" IAP** in App Store Connect, **attached to the binary** for first review, "Ready to Submit", Paid-Apps Agreement active
- Native **`Product.purchase()`** flow handling `.success` / `.userCancelled` / `.pending` (calm "waiting for approval", not an error)
- **On-device JWS verify** (`VerificationResult.verified` only; `.unverified` → fail closed to free tier — mirrors the Ed25519 model) → `Transaction.finish()` → `currentEntitlements` → SAME `pro.*` map
- **MANDATORY Restore Purchases** in Settings -> License (`AppStore.sync()` then re-read; gated behind the explicit button, never silent at launch)
- **`Transaction.updates` refund/revoke listener** at boot → live-drop Pro (reuses the existing `refreshEntitlements()` + "Pro features turned off" drop-notice)
- Store License pane showing status + Buy(`Product.displayPrice`) + Restore — **NO key field, NO external buy link, NO literal `$9`**
- App Sandbox enabled; updater + Keygen UI + `license.tinkerdev.io` **compiled out**
- Submission checklist: privacy label = **Data Not Collected** (+ `PrivacyInfo.xcprivacy`), 4+ age rating, **screenshots of real testable states**, working support/privacy URLs, **Notes-for-Review** documenting how to exercise the Pro IAP

**Should have (parity, degrade gracefully if blocked):**
- Global summon hotkey kept under sandbox (Tauri uses `RegisterEventHotKey` — sandbox-safe, zero entitlements; keep Cmd/Ctrl in the chord for macOS-15)
- Launch-at-login via `SMAppService` (explicit toggle, default OFF)
- Tray / menu-bar parity (native `NSStatusItem`, expected sandbox-safe — verify in spike)

**Defer (v1.x / v2+):**
- Family Sharing toggle, offer/promo codes, "Manage Purchases" deep link
- Windows/Linux store channels (explicitly deferred)

### Architecture Approach

The variant is a **SINGLE axis with THREE synchronized layers**, bound in one build command so it can't drift. The cleanest part is that the entitlement-source swap is a **one-branch change to one function** — `resolveEntitlements()` (`resolve.ts:51`) is already documented in-code as "the single resolution point... flip HERE and nowhere else"; the store variant adds a `baseFromStoreKit(currentEntitlements)` branch that fills the SAME `EntitlementSet`. The StoreKit bridge mirrors `platform.license` exactly (interface in `index.ts`, real arm in `tauri.ts`, no-op arm in `browser.ts`/`stub.ts`); `platform.autostart` swaps its impl behind the flag with the interface unchanged; the updater compiles out with no component fork. `decoder.ts` + its 19 tests are untouched throughout. Full detail in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**
1. **The variant seam (3 layers)** — `appstore` cargo feature (gates plugin registration, mirrors `webdriver`) + `tauri.appstore.conf.json` `--config` overlay (sandbox/13.0/app-only/no-updater) + `VITE_CHANNEL`/`IS_APPSTORE` tree-shake constant — bound in one `package.json` script
2. **`platform.iap` StoreKit bridge** (NEW) — `products`/`purchase`/`restore`/`currentEntitlements` + `onPurchaseUpdated` event behind the seam; new Rust `iap_*` commands + `storekit://updated` event; mirrors `platform.license`
3. **`resolveEntitlements()` source swap** (MODIFIED, one branch) — `baseFromStoreKit` vs `baseFromLicense`, selected by `IS_APPSTORE`; central gate / `useEntitlements` / registry UNCHANGED
4. **`StoreLicenseSettings.tsx`** (NEW sibling, not inline branch) — status + Buy(`displayPrice`) + Restore; keeps Keygen copy out of the store bundle
5. **`SMAppService` autostart arm** + updater compile-out — same `{enable,disable,isEnabled}` interface; updater gated `#[cfg(not(feature="appstore"))]` + Updates pane filtered from `SETTINGS_PANES` + `App.tsx` effects guarded
6. **`.pkg`/submission pipeline** — `productbuild` → `altool`, separate from the direct channel's Developer-ID/notarytool path

### Critical Pitfalls

(Ranked by likelihood x cost; full list of 15 in [PITFALLS.md](./PITFALLS.md). The first four are SHIP-GATE — one occurrence = rejection or a dead binary.)

1. **Missing `network.client` → sandbox white-screen (SHIP-GATE)** — the webview IPC (`http://ipc.localhost`) is treated as a network connection; works in `tauri dev`, dies only on the signed sandboxed `.app`. The offline ethos does NOT exempt it. *Avoid:* set both `app-sandbox` + `network.client` from the first sandbox build; verify via `codesign -d --entitlements` then **launch the signed `.app`**.
2. **Keygen surface survives → 3.1.1 rejection (SHIP-GATE)** — key field / `license.tinkerdev.io` / `$9` / `BUY_LICENSE_URL` merely hidden, not removed. *Avoid:* tree-shake via `VITE_CHANNEL` + Rust-gate the Keygen transport; **grep the store bundle clean** (`license.tinkerdev.io`, `license key`, `$9` → empty).
3. **Updater/autostart hidden but still linked → 2.4.5 / sandbox rejection (SHIP-GATE)** — both plugins are unconditionally in `Cargo.toml` today; a debug-cfg dep does NOT exclude a crate, only a feature flag does. *Avoid:* gate registration `#[cfg(not(feature="appstore"))]`; verify `cargo tree --features appstore | grep -E 'updater|autostart'` empty.
4. **IAP not testable in review → 2.1 rejection (SHIP-GATE)** — Paid-Apps Agreement inactive / product not "Ready to Submit" / first IAP not attached to binary / no Restore / no Notes-for-Review. *Avoid:* a pre-submission checklist phase + Sandbox-tester human walkthrough.
5. **Variant drift + harness blindness (HIGH, structural)** — three decoupled layers with no compiler enforcing their sync, and **WebDriver can't drive StoreKit/sandbox/refunds/login-items**. *Avoid:* one canonical build entry point + a committed `scripts/verify-appstore-bundle.sh` artifact-assertion script; **mandatory human ship-gate walkthrough** (signed `.app`, real purchase, restore on a fresh container, refund->drop, login-item over a real logout/login). Plus: `.unverified` → fail closed + `Transaction.finish()` (no replay); `keyring`/Keychain gated out of the store build (no `MissingEntitlement`, no speculative entitlement); `minimumSystemVersion` 13.0 store-only (direct stays 10.15); correct cert chain for `.pkg` (Apple Distribution + Mac Installer Distribution, no `--deep`, no notarytool).

## Implications for Roadmap

Build order is **dependency-forced**: nothing store-side compiles, resolves, or renders without a working `platform.iap` arm, so the bridge spike is the critical-path first phase. Phases continue from Phase 25 → start at **26**.

### Phase 26: StoreKit bridge spike (CRITICAL PATH)
**Rationale:** The highest-risk, longest-pole dependency — no first-class plugin exists; everything downstream gates on it.
**Delivers:** `tauri-plugin-iap@0.9` proven inside a universal sandboxed build (or `swift-rs` fallback); `platform.iap` seam shape (real `tauri.ts` arm + deterministic no-op `browser.ts`/`stub.ts` arm); `iap_*` Rust commands returning real `currentEntitlements`/`products`; on-device JWS verify confirmed serverless.
**Uses:** StoreKit 2, `tauri-plugin-iap`/`swift-rs`.
**Implements:** Component 2 (StoreKit bridge).
**Avoids:** Pitfalls 6/7/9 are gated here; confirms the spike-first decision.
**Gate:** Real purchase round-trip in the App Store Connect sandbox (needs a `.storekit` file + Sandbox tester) — human.

### Phase 27: The variant seam (3 layers)
**Rationale:** With the IAP plugin existing, stand up the axis that switches everything; produces the first sandboxed `.app`.
**Delivers:** `appstore` cargo feature + cfg-gated registrations; `tauri.appstore.conf.json` overlay + `entitlements.appstore.plist` (sandbox + `network.client`); `VITE_CHANNEL`/`channel.ts`; bound `package.json` scripts; updater compiled out (Rust + pane filter + `App.tsx` guard); **`scripts/verify-appstore-bundle.sh`** delivered.
**Uses:** Tauri `--config` RFC-7396, cargo features, Vite define.
**Implements:** Component 1 (variant seam) + Component 5 (updater compile-out).
**Avoids:** Pitfalls 1 (network.client white-screen — verify the sandboxed `.app` renders), 3 (updater/autostart linked), 8 (variant drift), 11 (min-version leak — store=13.0, direct stays 10.15).

### Phase 28: Entitlement-source swap + Store License pane
**Rationale:** Wire the spiked bridge into the existing gate and replace the Keygen surface; the 3.1.1 compliance phase.
**Delivers:** `baseFromStoreKit` branch in `resolveEntitlements`; `StoreLicenseSettings.tsx` (status + Buy(`displayPrice`) + **Restore**); `onPurchaseUpdated` → `refreshEntitlements` boot wiring; Keygen surface (`$9`/`BUY_LICENSE_URL`/key field/`license.tinkerdev.io`) compiled out + grep-verified.
**Uses:** the existing central gate + drop-notice (reused).
**Implements:** Components 3 + 4.
**Avoids:** Pitfalls 2 (3.1.1 surface — grep clean), 6 (refund listener), 9 (`.unverified` fail-closed + `finish()`).
**Gate:** purchase → Pro unlocks live; refund → Pro drops live — human.

### Phase 29: Sandbox-safe native features
**Rationale:** Independent of StoreKit (can partly parallelize with 28 once 27 lands); makes the sandboxed build feature-complete.
**Delivers:** `SMAppService` autostart arm (same seam interface, default OFF); sandbox audit of global-shortcut (keep — `RegisterEventHotKey`) + tray (keep); `keyring`/Keychain gated out of the store build (or the access-group entitlement justified + validated on the SIGNED build).
**Uses:** `smappservice-rs`/`objc2-service-management`.
**Avoids:** Pitfalls 5 (Keychain `MissingEntitlement` — runtime-only), 12 (SMAppService register / Ventura 13.0.1 codesign bug — min-13.5 caveat), 14 (prefs container path).
**Gate:** login-item over a real logout/login — human (WebDriver can't).

### Phase 30: `.pkg` build + App Store Connect submission
**Rationale:** Irreversible/integration-bound; runs last, after every source change lands (verify bundle mtime > last source commit).
**Delivers:** `productbuild` → `.pkg` → `altool` pipeline (separate from the direct publish script); Apple Distribution + Mac Installer Distribution certs + embedded profile; IAP attached to binary; privacy label / `PrivacyInfo.xcprivacy` / age rating / screenshots / Notes-for-Review.
**Uses:** `productbuild`, `altool`, App Store Connect.
**Avoids:** Pitfalls 4 (IAP testable), 10 (`.pkg` cert chain — no `--deep`, no notarytool, ITMS-90238/90296), 13 (privacy label).
**Gate:** full ship-gate human walkthrough (mirrors the v1.6 live-purchase gate) + the direct channel un-regressed (DMG still notarises, decoder + 19 tests untouched).

### Phase Ordering Rationale
- **Dependency-forced:** the StoreKit bridge is the long pole — nothing store-side compiles/renders without it, so it spikes first (Phase 26), then the seam that registers it (27), then the UI that consumes it (28).
- **Architecture-grouped:** the variant seam (27) is foundation for both the StoreKit UI (28) and the sandbox features (29); 29 shares only the sandbox-enable change with 28, so it can run in parallel once 27 lands.
- **Pitfall-aware:** the white-screen + 3.1.1 + updater-linked + variant-drift ship-gates are designed into the seam phase (27) with a verify script as a deliverable; the irreversible submission runs LAST (30) with a mandatory human gate, matching the project's proven "spike highest-risk first, integration-bound flows last" discipline.

### Research Flags

Phases likely needing deeper research / a `/gsd-research-phase` during planning:
- **Phase 26:** the StoreKit bridge internals are spike-gated and MEDIUM-confidence — `tauri-plugin-iap` is a 72-star single-maintainer plugin; confirm universal-sandboxed compile, seam mapping, serverless JWS verify, and `objc2` coexistence with `keyring`'s `apple-native`. Have the `swift-rs` fallback ready.
- **Phase 30:** the Tauri-specific `productbuild`/provisioning-profile/`.pkg` signing sequence is community-reported (MEDIUM), not officially walked through end-to-end; ITMS bounce modes need validation against the real universal bundle + the new IAP-bridge nested code.

Phases with standard / well-documented patterns (skip research-phase):
- **Phase 27:** the variant seam is the existing in-repo `webdriver`-feature idiom + documented Tauri `--config` merge — HIGH confidence.
- **Phase 28:** the entitlement-source swap is a one-branch change to an already-tested resolver; the seam, gate, and drop-notice all exist and are reused.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (versions/Apple reqs) / MEDIUM (bridge integration) | Apple docs + Tauri docs + crate registries are HIGH; the StoreKit-bridge integration path rests on a 72-star single-maintainer plugin, spike-flagged, with a mature `swift-rs` fallback |
| Features | HIGH | Apple guidelines + StoreKit APIs cited from current developer.apple.com; sandbox/hotkey behavior cross-checked across multiple sources |
| Architecture | HIGH (in-repo seams) / MEDIUM (bridge internals) | Every seam cited file:line from the real codebase; the `--config`/cargo-feature idiom has an in-repo precedent; only the bridge internals are spike-gated |
| Pitfalls | HIGH | Apple rules + Tauri sandbox failures from dated GitHub issues; StoreKit lifecycle from Apple docs + multiple threads; MEDIUM only on the exact Tauri `.pkg` signing sequence |

**Overall confidence:** HIGH — the integration is well-understood and the seams exist; the single concentrated unknown is the StoreKit bridge, isolated behind a first-phase spike with a known fallback.

### Gaps to Address

- **StoreKit bridge viability** (the one real unknown): resolve in the Phase 26 spike — compile into the universal sandboxed build, seam mapping, serverless JWS verify, `objc2`-vs-`keyring` link coexistence. Fallback = `swift-rs` hand-roll, same seam.
- **Keychain decision:** if the store build truly compiles out all Keygen code, NO Keychain access should remain → gate `keyring` out and DON'T add the access-group entitlement (App Review flags unjustified entitlements). Verify in the spike; validate on the SIGNED `.pkg` (runtime-only `MissingEntitlement`).
- **`generate_handler!` cfg-arm growth:** adding the `appstore` dimension to the existing debug/webdriver arms is a known ergonomic wart (`lib.rs:322-343`) — accept the duplication or add a small helper; not a blocker.
- **Keygen Rust-core gating depth:** minimal (webview-only compile-out) vs defense-in-depth (also Rust-gate the `reqwest` Keygen transport). Minimal is lower-risk for v1.8; roadmapper decision point.
- **App Store Connect external setup** (Paid-Apps Agreement, Business page, IAP "Ready to Submit", Sandbox testers): non-code but on the critical path — propagation can take hours; start early enough that products reach "Ready to Submit" before Phase 30.

## Sources

### Primary (HIGH confidence)
- [Tauri 2 — Distribute to the App Store](https://v2.tauri.app/distribute/app-store/) + [macOS Application Bundle](https://v2.tauri.app/distribute/macos-application-bundle/) + [Configuration Files](https://v2.tauri.app/develop/configuration-files/) — sandbox entitlements, `--config` RFC-7396 merge, `productbuild`/`altool` flow, `bundle.macOS` keys
- [Apple — App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — 3.1.1 (license keys banned, Restore mandatory), 2.1, 2.3, 2.4.5
- [Apple — Transaction.currentEntitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements) + [VerificationResult.unverified](https://developer.apple.com/documentation/storekit/verificationresult/unverified(_:_:)) + [Transaction](https://developer.apple.com/documentation/storekit/transaction) — entitlement semantics, fail-closed, refund/revoke
- [tauri-docs #3171](https://github.com/tauri-apps/tauri-docs/issues/3171) + [tauri #13878](https://github.com/tauri-apps/tauri/issues/13878) — mandatory `network.client` / sandbox white-screen
- [Apple — Keychain Access Groups](https://developer.apple.com/documentation/bundleresources/entitlements/keychain-access-groups) + [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) + [App Sandbox info](https://developer.apple.com/help/app-store-connect/reference/app-uploads/app-sandbox-information)
- In-repo (primary integration evidence): `src/lib/entitlements/resolve.ts` (the single resolution point), `src/lib/platform/{index,tauri,browser,stub}.ts` (the seam), `src/components/{LicenseSettings,UpsellPanel,settingsPanes}.tsx`, `src/App.tsx`, `src-tauri/{Cargo.toml,src/lib.rs,tauri.conf.json}` (webdriver-feature precedent, plugin registration, config)

### Secondary (MEDIUM confidence)
- [GitHub — Choochmeque/tauri-plugin-iap](https://github.com/Choochmeque/tauri-plugin-iap) — v0.9.0, Swift bridge, macOS 13.0+, 72-star (spike-flagged)
- [gethopp/smappservice-rs](https://github.com/gethopp/smappservice-rs) + [Brendonovich/swift-rs](https://github.com/Brendonovich/swift-rs) — login-item + Swift-FFI versions/deps
- [The Swift Dev — currentEntitlements vs updates](https://www.theswift.dev/posts/storekit-current-entitlements-vs-updates/) + [WWDC by Sundell — StoreKit 2](https://wwdcbysundell.com/2021/working-with-in-app-purchases-in-storekit2/) — updates listener, finish(), rebuild-not-merge
- [RevenueCat](https://www.revenuecat.com/docs/test-and-launch/app-store-rejections) + [IAPHUB](https://www.iaphub.com/docs/troubleshooting/app-store-rejections/) + [Apphud](https://apphud.com/blog/restoring-purchases) — Paid-Apps Agreement, Ready-to-Submit, Restore-mandatory
- [nextnative](https://nextnative.dev/blog/app-store-review-guidelines) — "40%+ of rejections are 2.1 App Completeness"

### Tertiary (LOW confidence / needs validation)
- [Apple forum 823454](https://developer.apple.com/forums/thread/823454) + [808757](https://developer.apple.com/forums/thread/808757) — `currentEntitlements`/products empty until sync/business-setup propagation (empty-in-review trap)
- [Apple forum 673869 / 740606](https://developer.apple.com/forums/thread/673869) + [Qt forum](https://forum.qt.io/topic/151712/) — ITMS-90238/90296 `.pkg`/signing bounces (Tauri-specific productbuild sequence not officially documented end-to-end — validate in Phase 30)
- [9to5Mac 2025-05-01](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/) — US-storefront external-link loophole (explicitly rejected option)

---
*Research completed: 2026-06-22*
*Ready for roadmap: yes*
