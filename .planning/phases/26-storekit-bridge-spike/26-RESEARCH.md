# Phase 26: StoreKit Bridge Spike (CRITICAL PATH) - Research

**Researched:** 2026-06-22
**Domain:** StoreKit 2 IAP bridge for a sandboxed Tauri 2 macOS app, behind a `platform.iap` seam mirroring `platform.license`
**Confidence:** HIGH on the seam shape, the StoreKit 2 lifecycle, and the in-repo integration points (all cited file:line). MEDIUM on `tauri-plugin-iap@0.9` internals (72-star single-maintainer plugin — spike-gated by design). **HIGH-and-adverse on the `.storekit` inner-loop premise: the evidence says it almost certainly does NOT work for a non-Xcode-launched Tauri binary — see Open Question OQ-1, the most important finding in this document.**

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Plugin-first.** Spike `tauri-plugin-iap@0.9.0` (Choochmeque) first — bundles a Swift package doing StoreKit 2 `getProducts`/`purchase`/`restorePurchases`/`getProductStatus`/`onPurchaseUpdated` + native verify, the fastest path behind `platform.iap`. Maturity-flagged (72★, single maintainer) — spike candidate, not a locked dep.
- **D-02: Fallback = hand-rolled Swift via `swift-rs@1.0.7`** (mature linker), **same `platform.iap` seam shape** either way. Rejected: hand-rolling from the start; vendoring the plugin's Swift.
- **D-03: Switch to the swift-rs fallback if ANY of:** (a) the plugin won't compile/link into the **universal (arm64+x86_64) App-Sandboxed** build (incl. an objc2/`keyring` `apple-native` link clash); (b) `getProductStatus`/`onPurchaseUpdated` can't map cleanly onto the seam; (c) the native purchase sheet won't present or can't handle `.success`/`.userCancelled`/`.pending` in the sandboxed build.
- **D-04: Serverless on-device JWS verify is a HARD constraint both paths must meet** (not a plugin-only fallback trigger). `VerificationResult.verified` only; `.unverified` → fail closed to free tier. Mirrors the offline Ed25519 model. If neither path can verify serverless, that's a milestone-level blocker, not a fallback case.
- **D-05: Two harnesses, both required.** (1) A **committed synthetic `.storekit` StoreKit Configuration file** drives purchase/cancel/unverified/pending in `tauri dev` with no ASC propagation wait and no charges — the **agent-driven inner loop**. (2) The **real Sandbox-tester round-trip** is the **human outer gate**. *[RESEARCH FLAG: see OQ-1 — harness (1) likely needs to be re-shaped; harness (2) is sound.]*
- **D-06: The agent cannot drive the real purchase.** The native StoreKit sheet renders out-of-process as system UI (not in the WKWebView); WebDriver/automation cannot click or type it. The real round-trip is a **manual human walkthrough**.
- **D-07: States the spike must exercise:** `.success` (→ `verified` → `finish()` → `currentEntitlements` reflects Pro), `.userCancelled` (calm, grants nothing), `.unverified` → **fail closed** to free tier, **`.pending`** ("waiting for approval", NOT an error; grants nothing yet) — handler MUST exist and be exercised. *[RESEARCH FLAG: the mechanism that exercises these without a live tester is in question — see OQ-1.]*
- **D-08: Minimum ASC setup NOW** — registered App ID `com.tinkerdev.app`; **Paid Applications Agreement started early** (hours-long propagation); non-consumable `com.tinkerdev.app.pro` "Ready to Submit"; ≥1 **Sandbox tester**. Defer screenshots/privacy/age-rating/Notes to Phase 30.
- **D-09: The user drives the Apple-side setup; the agent guides** step-by-step from `docs/appstore/ASC-SETUP.md` (`com.tinkerdev.app`, `com.tinkerdev.app.pro`, Team `FK4HQK83WX`, ~US$9 tier).
- **D-10: Production-shaped seam that lands on master** — `platform.iap` interface + real `tauri.ts` arm + deterministic no-op `browser.ts`/`stub.ts` arm + `iap_*` Rust commands written **to keep**; Phases 27/28 build on them. Gated behind the `appstore` cargo feature so the direct build never compiles them.
- **D-11: Spike purchase trigger = a temporary VISIBLE button in the existing Settings ▸ License pane** invoking `products()`/`purchase()`/`restore()`. Superseded/removed when Phase 28's `StoreLicenseSettings` lands.
- **D-12 (planner note): minimal sandbox-enabled build harness** — sandbox entitlements incl. mandatory `com.apple.security.network.client` (else white-screen) + `tauri-plugin-iap` registration — just to invoke StoreKit. Phase 27 formalizes the variant seam; do not block on it here.

### Claude's Discretion
- Exact `iap_*` command names + `storekit://updated` event channel naming (mirror `license`/`menu://` conventions).
- The `.storekit` file's product/price fixture values (cosmetic for local dev).
- The dev-button placement/label within the License pane (temporary).

### Deferred Ideas (OUT OF SCOPE)
- Real Store License pane / Buy + Restore UI, entitlement-source swap into `resolveEntitlements`, Keygen compile-out → **Phase 28**.
- Formal 3-layer build-variant seam (`appstore` cargo feature + `tauri.appstore.conf.json` overlay + `VITE_CHANNEL`), updater compile-out, `verify-appstore-bundle.sh` → **Phase 27**.
- Sandbox-safe native features (SMAppService, keyring gate-out, tray/summon audit) → **Phase 29**.
- `.pkg` build + ASC submission + metadata/screenshots/privacy → **Phase 30**.
- Restore Purchases UI, Buy button with `displayPrice`, refund/revoke `Transaction.updates` boot listener → **Phase 28** (the spike may *call* `restore()` from the temporary dev button to prove the seam, but the shipped affordance is not built here).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAS-IAP-01 | A user can buy Pro via the native StoreKit purchase sheet (one non-consumable, perpetual), with `.success`/`.userCancelled`/`.pending` ("waiting for approval", not an error) all handled calmly. | StoreKit 2 `Product.purchase()` → `Product.PurchaseResult` (`.success(VerificationResult)`/`.userCancelled`/`.pending`) — verified below. `tauri-plugin-iap` maps these to `PurchaseState` (0=PURCHASED, 1=CANCELED, 2=PENDING). The `.pending` exercise mechanism is the open question (OQ-1). |
| MAS-IAP-04 | Pro is verified on-device (StoreKit 2 JWS `VerificationResult`); `.unverified` or failed verification falls closed to the free tier. | `VerificationResult.verified`/`.unverified` is on-device JWS against Apple's public keys (serverless). Fail-closed mirrors the existing Ed25519 `machine.lic` discipline. The Rust-side decision core (`verified` → grant, else → free) is the unit-testable part. |
</phase_requirements>

## Summary

Phase 26 proves the single highest-risk dependency of milestone v1.8: that a sandboxed Tauri macOS build can present the native StoreKit purchase sheet for `com.tinkerdev.app.pro` and verify the result on-device, behind a `platform.iap` seam that is structurally identical to the existing `platform.license` seam. The seam shape, the StoreKit 2 lifecycle, and every in-repo integration point are well-understood and HIGH-confidence — the codebase already proves the exact pattern (capability interface in `index.ts`, real arm in `tauri.ts`, deterministic no-op arm in `stub.ts`, `invoke`-style Rust commands, `listen`-based event channel, cargo-feature gating via the `webdriver` precedent). Mapping `tauri-plugin-iap`'s `getProducts`/`purchase`/`restorePurchases`/`getProductStatus`/`onPurchaseUpdated` onto `platform.iap.{products,purchase,restore,currentEntitlements,onPurchaseUpdated}` is mechanical.

The one genuinely adverse finding contradicts a locked assumption: **the committed-`.storekit`-file inner loop (D-05/D-07) almost certainly does not work for a Tauri/Cargo-built macOS binary.** StoreKit Configuration File testing is injected into `storekitd` by Xcode's internal `IDELaunchSession` XPC channel; a binary launched any other way (including `tauri dev`, which runs a Cargo-built `.app` directly) does not receive the configured products, and manually copying the `.storekit` file into the container does not work because `storekitd` only loads it via that XPC channel. Apple's own docs and TinkerDev's own `docs/appstore/ASC-SETUP.md` (Section 6) both state StoreKit *configuration-file* testing is "incompatible with macOS / iOS-first." This does not change the seam, the Rust verify core, or the success criteria — it changes **how the four purchase states get exercised**: the agent-driven inner loop must shift from "a `.storekit` file drives the live sheet in `tauri dev`" to "unit tests over the Rust verify/grant decision core (states injected as data, error-as-value)", with **all live-sheet states proven by the human Sandbox-tester gate**. The planner must resolve OQ-1 before writing tasks that depend on a `.storekit` inner loop.

**Primary recommendation:** Spike `tauri-plugin-iap@0.9.0` into a minimal sandboxed build behind the `appstore` cargo feature and the `platform.iap` seam; prove the universal+sandboxed compile/link and the native sheet round-trip via a **human Sandbox-tester walkthrough** (the gate that actually works on macOS); unit-test the Rust `verified`/`.unverified`/grant decision core as the agent-driven inner loop; treat the `.storekit` file as a best-effort dev nicety only after empirically confirming it injects (it likely won't — do not make the plan depend on it). Carry `swift-rs` only as a contingency triggered by the explicit D-03 gate, never as a parallel build.

---

## The fallback decision — a single explicit checkpoint (answers Critical Question 1)

Per D-01/D-02/D-03 the answer to "if the plugin works, do we still build the swift-rs fallback?" is **NO**. `swift-rs` is a contingency, not a parallel track. The plan must encode a single **go/no-go checkpoint** after the plugin spike, evaluated in this order, on the **universal arm64+x86_64 App-Sandboxed** build (not on `tauri dev`, not arm64-only):

**GO with `tauri-plugin-iap` (default) — ALL must hold:**
1. **Compiles + links** into the universal sandboxed `.app`. The plugin bundles a Swift package; confirm `MACOSX_DEPLOYMENT_TARGET="13.0"` is set (the plugin's Swift package fails to load otherwise — its README documents a `dyld`/library-load error) and that its Swift link does not clash with `keyring`'s `apple-native` Security.framework link. `[VERIFIED: cargo tree — the existing tree is a single objc2 v0.6.4; keyring 3.6.3 present; no version split today]`
2. **Seam mapping** — `getProductStatus`/`onPurchaseUpdated` map cleanly onto `platform.iap.currentEntitlements`/`onPurchaseUpdated` (see the mapping table under "Seam shape"). `[VERIFIED: plugin README API surface]`
3. **Sheet presents + handles all three states** — `.success`/`.userCancelled`/`.pending` in the sandboxed build, proven by the human Sandbox-tester walkthrough. `[CITED: ASC-SETUP.md §6 — macOS uses Sandbox testers, not .storekit]`
4. **Serverless JWS verify (D-04, HARD)** — `VerificationResult.verified` is checked on-device with no network call beyond Apple's own StoreKit endpoints. `[CITED: developer.apple.com/documentation/storekit/verificationresult]`

**NO-GO → switch to `swift-rs@1.0.7` (D-03)** if ANY of 1–3 fails. If criterion 4 (serverless verify) fails on **both** paths → **milestone-level blocker** (escalate, not a fallback — D-04).

This checkpoint is a single task/wave the planner can encode (e.g. a "bridge viability gate" between the plugin-spike wave and the seam-wiring wave). The contingency arm (`swift-rs`) should be a **documented, unbuilt branch** until the checkpoint trips — never carried as dead weight. `[ASSUMED: that criterion 1 will pass — the only objc2 in the current tree is 0.6.4 and the plugin targets modern objc2/Swift; confirm empirically in the spike. This is exactly what the spike exists to verify.]`

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri-plugin-iap` (Choochmeque) | **0.9** (2026-05-05) | StoreKit 2 bridge: `getProducts`/`purchase`/`restorePurchases`/`getProductStatus`/`onPurchaseUpdated` + native verify | The only Tauri-v2 StoreKit-on-macOS plugin; bundles a Swift package; macOS 13.0+. `[VERIFIED: crates.io / GitHub releases]` Maturity-flagged. |
| `@choochmeque/tauri-plugin-iap-api` | matches 0.9 | The plugin's JS companion — imported **ONLY** in `tauri.ts` | Mirrors how `@tauri-apps/plugin-*` are imported solely in `tauri.ts`. `[VERIFIED: plugin README install block]` |
| StoreKit 2 (Apple framework) | API 12.0+; **plugin floor 13.0** | `Product.purchase()` → `PurchaseResult`; `VerificationResult`; `Transaction.currentEntitlements`/`finish()` | Async/await + built-in JWS verify = serverless, mirrors Ed25519 model. `[CITED: developer.apple.com/documentation/storekit]` |

### Supporting (contingency only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `swift-rs` | **1.0.7** | Build-time `SwiftLinker` in `build.rs` + FFI to a hand-written Swift StoreKit module | **ONLY if the D-03 go/no-go checkpoint trips.** Same `platform.iap` seam shape. macOS 10.13+, mature. `[VERIFIED: crates.io]` |

### Out of scope for Phase 26 (named here so the planner does not pull them in)
- `smappservice-rs` / `objc2-service-management` → **Phase 29** (launch-at-login). Not a Phase 26 dep.
- `tauri.appstore.conf.json` overlay, `VITE_CHANNEL`, `verify-appstore-bundle.sh`, updater compile-out → **Phase 27**.

**Installation (Phase 26 only):**
```bash
# Rust — gate behind the appstore cargo feature so the direct build never compiles it
cargo add tauri-plugin-iap@0.9            # optional = true; appstore = ["dep:tauri-plugin-iap"]
# JS — imported ONLY in src/lib/platform/tauri.ts
pnpm add @choochmeque/tauri-plugin-iap-api
```
```toml
# Cargo.toml — mirror the existing `webdriver` optional-dep + feature idiom (Cargo.toml:36,94)
[features]
appstore = ["dep:tauri-plugin-iap"]       # NEW (Phase 27 adds smappservice-rs to this list, not Phase 26)

[dependencies]
tauri-plugin-iap = { version = "0.9", optional = true }
```

**Version verification:** `tauri-plugin-iap@0.9` published 2026-05-05 `[VERIFIED: GitHub releases page]`. `swift-rs@1.0.7` and `keyring@3.6.3` confirmed in the current tree. Re-run `npm view @choochmeque/tauri-plugin-iap-api version` and `cargo add tauri-plugin-iap@0.9 --dry-run` at plan time to confirm the JS package name and that 0.9 is still the latest.

---

## Architecture Patterns

### Recommended structure (Phase 26 — minimal, production-shaped, all gated by `appstore`)
```
src-tauri/
├── Cargo.toml                     # MODIFIED: appstore feature + optional tauri-plugin-iap (mirror webdriver, :36/:94)
├── entitlements.appstore.plist    # NEW (minimal harness, D-12): app-sandbox + network.client ONLY
└── src/
    ├── lib.rs                     # MODIFIED: register iap plugin + iap_* handler arm, both #[cfg(feature="appstore")]
    └── iap/                       # NEW: mirrors src/license/ module shape
        ├── mod.rs                 # serde camelCase mirror types (IapProduct, IapPurchaseResult) — mirror license/mod.rs
        └── commands.rs            # iap_products / iap_purchase / iap_restore / iap_current_entitlements
src/
└── lib/platform/
    ├── index.ts                   # MODIFIED: add `iap` to Platform interface + a `get iap()` getter (mirror license :126/:213)
    ├── tauri.ts                   # MODIFIED: real iap arm + storekit://updated listen — ONLY @tauri-apps/plugin-iap importer
    ├── browser.ts                 # MODIFIED: no-op iap arm
    └── stub.ts                    # MODIFIED: createIapStub() — mirror createLicenseStub() (:33-49)
src/components/
└── LicenseSettings.tsx            # MODIFIED (temporary, D-11): a visible spike button calling products()/purchase()/restore()
```

### Pattern 1: Capability seam with a deterministic no-op arm (FND-04)
**What:** A new capability is an interface in `index.ts`, a real arm in `tauri.ts` (the ONLY file importing native plugins), and a deterministic non-Tauri arm in `browser.ts`/`stub.ts`.
**When:** Any new OS/StoreKit surface — `platform.iap` follows it exactly.
**Example (mirror `license`, `index.ts:126-144` / `tauri.ts:141-149` / `stub.ts:33-49`):**
```ts
// index.ts — add to Platform (beside `license`), then a getter beside get license() (:213)
iap: {
  products(): Promise<IapProduct[]>;
  purchase(productId: string): Promise<IapPurchaseResult>;   // success | userCancelled | pending
  restore(): Promise<void>;
  currentEntitlements(): Promise<string[]>;                  // granted pro.* codes
  onPurchaseUpdated(handler: () => void): Promise<() => void>;
};
// tauri.ts — real arm, ONLY @choochmeque/tauri-plugin-iap-api importer; mirror license invoke + menu:// listen
// stub.ts — createIapStub(): products → [], purchase/restore → reject({ code: "serviceUnreachable" }) or deterministic stub,
//           currentEntitlements → [], onPurchaseUpdated → no-op unsubscribe. Keeps vitest/jsdom native-free.
```
Source: `src/lib/platform/{index,tauri,stub}.ts` (in-repo, HIGH).

### Pattern 2: Cargo-feature gating of an optional native dep (the `webdriver` precedent)
**What:** Store-only deps are `optional = true` behind a cargo feature; registration is `#[cfg(feature = "appstore")]`. A plain build excludes the crate entirely (`cargo tree | grep` = 0).
**Example (mirror `Cargo.toml:36/94` + `lib.rs:308-309`):**
```rust
#[cfg(feature = "appstore")]
let builder = builder.plugin(tauri_plugin_iap::init());
```
Source: `src-tauri/Cargo.toml:23-36,92-94`, `src-tauri/src/lib.rs:300-343` (in-repo, HIGH).

### Pattern 3: `generate_handler!` cfg-arm duplication (known wart — plan for it)
`lib.rs:322-343` documents that `generate_handler!` is a single fixed list that "can't be conditionally extended mid-chain," so it already duplicates the license surface across a `#[cfg(debug_assertions)]` arm and a `#[cfg(not)]` arm. Adding the `appstore` IAP commands introduces a THIRD dimension. **The cleanest Phase-26 move:** register the `iap_*` commands in a **separate `.invoke_handler` call guarded by `#[cfg(feature="appstore")]`**, OR accept arm duplication. Tauri supports multiple `invoke_handler` registrations? **No** — `invoke_handler` can be called once per builder; a second call replaces the first. So the IAP commands must be folded into the existing arms (a 2×2 = up to four arms: debug×appstore). `[VERIFIED: Tauri builder API — single invoke_handler]` Flag this to the planner as the known ergonomic cost; it is not a blocker (the repo already tolerates 2 arms). Consider a small helper macro if the matrix feels unwieldy, but duplication is the lower-risk path the repo already uses.

### Anti-Patterns to Avoid
- **Making the plan depend on a `.storekit` inner loop driving the live sheet in `tauri dev`.** The evidence says this does not work for a Cargo-launched binary (OQ-1). Plan the inner loop as unit tests over the Rust verify/grant core; plan the live states as the human gate.
- **Importing `@choochmeque/tauri-plugin-iap-api` anywhere but `tauri.ts`.** Breaks the FND-04 ENVIRONMENT-SAFE seam (would pull native code into vitest/vite-preview).
- **Carrying `swift-rs` as a parallel build.** It is a D-03-triggered contingency only.
- **Granting Pro on `.unverified`.** Fail-open security bug; `.unverified` → free tier (mirrors Ed25519 fail-closed).
- **Skipping `Transaction.finish()`.** Unfinished transactions replay on every launch via `currentEntitlements`/`Transaction.updates`. `[CITED: WWDC by Sundell, StoreKit 2]`
- **Adding `smappservice-rs`, `tauri.appstore.conf.json`, `VITE_CHANNEL`, or updater compile-out in Phase 26.** Those are Phase 27/29.
- **Adding speculative entitlements** (`keychain-access-groups`, `files.user-selected`) to the minimal harness. Phase 26 needs ONLY `app-sandbox` + `network.client` (D-12).

---

## The minimal sandbox build harness (answers Critical Question 2 — the Phase-26 ↔ Phase-27 line)

Phase 26 needs *just enough* sandbox to invoke StoreKit; Phase 27 owns the formal seam. Draw the line precisely:

**Phase 26 minimal harness (build it here):**
| Item | Phase 26 scope | Why |
|------|----------------|-----|
| `entitlements.appstore.plist` | `com.apple.security.app-sandbox` + `com.apple.security.network.client` ONLY | network.client is mandatory or the WKWebView white-screens (the #1 Tauri sandbox failure — it's the IPC channel, not a feature). `[CITED: tauri #13878, tauri-docs #3171]` |
| `appstore` cargo feature | declares it + gates `tauri-plugin-iap` registration | Mirror `webdriver`. So the direct build never compiles StoreKit. |
| `tauri-plugin-iap` registration | `#[cfg(feature="appstore")]` in `lib.rs` | The plugin to spike. |
| `iap:default` capability | add to `capabilities/default.json` | The plugin's JS↔Rust bridge needs its permission (mirrors `updater:default`, `store:default`). `[CITED: plugin README capabilities block]` |
| `minimumSystemVersion` 13.0 + `MACOSX_DEPLOYMENT_TARGET=13.0` | pass on the spike build invocation ONLY | Plugin Swift package floor. **Must NOT touch base `tauri.conf.json` (stays 10.15)** — a per-invocation flag, not a committed base change (Phase 27 formalizes via the overlay). |
| Signing | dev/Apple-Distribution signed `.app` for the human walkthrough | Sandbox + StoreKit require a code-signed app. `[CITED: plugin README — "requires code-signed app"]` |

**Explicitly NOT in Phase 26 (defer to Phase 27):** `tauri.appstore.conf.json` RFC-7396 overlay, `VITE_CHANNEL`/`channel.ts`, `targets:["app"]`/`createUpdaterArtifacts:false`, updater compile-out, `embedded.provisionprofile`, `verify-appstore-bundle.sh`, the CSP narrowing. Phase 26 may invoke the sandboxed build with **ad-hoc flags** (`--features appstore`, `--config` inline or a throwaway entitlements pointer) without committing the overlay — the goal is "can StoreKit be invoked at all," not "is the variant production-clean."

**The seam between phases:** Phase 26 proves *the plugin works inside a sandbox*; Phase 27 makes *the sandbox build reproducible and clean from one canonical command*. Phase 26's `entitlements.appstore.plist` and `appstore` feature are kept and **inherited/extended** by Phase 27 (Phase 27 adds the overlay that points at them) — they are not throwaway.

---

## The `.storekit` inner loop vs. human gate (answers Critical Question 3 — see OQ-1 for the verdict)

**How a `.storekit` Configuration File is *supposed* to work:** it declares synthetic products (id, price, localizations) and a verification toggle and an Ask-to-Buy toggle; Xcode injects it into the on-device `storekitd` so `Product.products(for:)` returns the synthetic products and `purchase()` drives a fake sheet you can force into `.success`, `.userCancelled`, `.unverified` (the "Fail Transactions"/verification toggle), and `.pending` (the "Ask to Buy" toggle) — all offline, no charges, no ASC propagation. `[CITED: developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode]`

**Why it almost certainly does NOT work for TinkerDev (the decisive finding):** injection happens over Xcode's internal `IDELaunchSession` XPC channel. A binary launched **not through the Xcode IDE** — which is exactly how `tauri dev` runs (a Cargo-built `.app` launched directly) — does not receive the configured products. Even `xcodebuild test` from the CLI fails to push the config to `storekitd`; and manually copying the `.storekit` file into the app's AppGroup container does not work because `storekitd` only loads it via that XPC channel. Apple's docs and TinkerDev's own `ASC-SETUP.md §6` state StoreKit *configuration-file* testing is **iOS-first / incompatible with macOS**. `[VERIFIED: multiple WebSearch sources — XcodeGen #944, Apple forum 650977, Gaige's Pages; CITED: ASC-SETUP.md §6]`

**The structural automation limit (D-06, confirmed):** the native StoreKit sheet renders **out-of-process as system UI**, not in the WKWebView. WebDriver/WKWebView automation cannot see, click, or type into it (no DOM, different process). The Sandbox-tester sign-in happens in that system UI too. Therefore the real round-trip **MUST** be a human walkthrough — this is a hard structural limit, not a tooling gap. `[VERIFIED: matches the project's own e2e learnings — automated e2e cannot drive native-OS input]`

**What this means for the plan (the re-shape OQ-1 forces):**
- **Agent-driven inner loop** = unit tests over the **Rust verify/grant decision core** (`verified(tx)` → grant `pro.*`; `.unverified` → free; `.userCancelled` → grant nothing; `.pending` → grant nothing, calm "waiting" state) — each state injected as **data / error-as-value**, exactly like the existing license-core TDD. This is fast, deterministic, and CI-green. No `.storekit` needed.
- **`.storekit` file** = best-effort only. Two viable fallbacks if local-sheet iteration is wanted: (a) **the `SKTestSession` `StoreKitTest` API** initialized with a `.storekit` URL — but `StoreKitTest` is a test-framework dependency historically macOS-incompatible/iOS-first; verify empirically, do not assume `[CITED: developer.apple.com/documentation/storekittest/sktestsession]`; (b) accept that the live sheet is only reachable via the Sandbox tester and skip `.storekit` entirely. **Recommendation: do NOT commit a `.storekit` file as a load-bearing harness; if the team wants one as a product-fixture nicety, commit it but gate the plan's "states exercised" criterion on the unit core + the human gate, never on the file.**
- **Human outer gate** = the Sandbox-tester round-trip drives `.success` and `.userCancelled` for real; `.pending` (Ask-to-Buy) is hard to force with a sandbox tester (it needs a Family-Sharing/Ask-to-Buy setup), so the **`.pending` handler is proven by the unit core + code inspection**, with the live `.pending` exercise documented as best-effort. `[ASSUMED: that a sandbox tester cannot easily force .pending without Family Sharing config — confirm during the walkthrough; the handler existing + unit-tested satisfies MAS-IAP-01's "handled calmly" requirement regardless.]`

---

## On-device JWS verify (answers Critical Question 4 — MAS-IAP-04 / D-04)

**How `VerificationResult.verified` is checked serverless:** StoreKit 2 returns every transaction wrapped in `VerificationResult<T>` — `.verified(T)` if the JWS signature passed StoreKit's **on-device** cryptographic check against Apple's public keys, or `.unverified(T, error)` otherwise. The app unwraps `.verified` only; treats `.unverified` as not-entitled. No server, no receipt-validation endpoint. `[CITED: developer.apple.com/documentation/storekit/verificationresult]`

**How to PROVE no network call beyond Apple's StoreKit:** (1) the verify path calls no `reqwest`/`fetch`/`tinkerdev.io` — code inspection + grep on the spike branch; (2) run the signed sandboxed `.app` and observe `log stream --predicate 'sender == "sandboxd"'` shows only Apple StoreKit/`storekitd` traffic on a purchase, no app-originated outbound; (3) the only network entitlement present is `network.client` (mandatory for IPC), and no Keygen transport compiles in (Keygen is Phase-28's gate-out, but the spike branch should already avoid wiring `license.tinkerdev.io` into the IAP path). `[VERIFIED method; the proof itself is a walkthrough step]`

**`.unverified` → fail closed:** the Rust decision core returns the free entitlement set on `.unverified` — byte-for-byte the discipline the v1.6 Ed25519 `machine.lic` path already uses (bad signature → not Pro). This is unit-testable as the agent inner loop.

**How it maps onto the existing Ed25519 model WITHOUT swapping `resolveEntitlements` (the swap is Phase 28):** Phase 26 does **not** touch `resolve.ts`. The spike's `iap_current_entitlements` command returns the granted `pro.*` codes (or `[]`) as a standalone seam method; the temporary D-11 button reads it directly to prove the round-trip. The wiring of `baseFromStoreKit(...)` into `resolveEntitlements` — so the central gate actually unlocks theming/ordering — is explicitly **Phase 28**. Phase 26 proves the *bridge produces a verified entitlement code*; Phase 28 proves *the gate consumes it*. Keep them separate so Phase 26 stays a pure bridge spike. `[VERIFIED: resolve.ts:51 is the single swap point; CONTEXT scopes the swap to Phase 28]`

---

## Seam shape (answers Critical Question 5 — success criterion 3 / D-10)

### `platform.iap` interface methods (mirror `platform.license`)
| Seam method | StoreKit 2 concept | `tauri-plugin-iap` call | Rust command | Mirrors (in-repo) |
|-------------|--------------------|--------------------------|--------------|-------------------|
| `products(): Promise<IapProduct[]>` | `Product.products(for:)` | `getProducts([id], 'inapp')` | `iap_products` | `license.status` payload shape (`tauri.ts:142`) |
| `purchase(id): Promise<IapPurchaseResult>` | `Product.purchase()` → `PurchaseResult` | `purchase(id, 'inapp')` → `PurchaseState` 0/1/2 | `iap_purchase` | `license.activate` (mutation, re-resolves) (`tauri.ts:146`) |
| `restore(): Promise<void>` | `AppStore.sync()` + re-read | `restorePurchases('inapp')` | `iap_restore` | `license.refresh` (`tauri.ts:147`) |
| `currentEntitlements(): Promise<string[]>` | `Transaction.currentEntitlements` (verified, non-refunded) | `getProductStatus(id, 'inapp')` → `isOwned` | `iap_current_entitlements` | `license.status` (pure read) (`tauri.ts:142`) |
| `onPurchaseUpdated(h): Promise<()=>void>` | `Transaction.updates` | `onPurchaseUpdated(cb)` → `PluginListener.unregister()` | `storekit://updated` event | `events.onMenuCheckUpdates` (`tauri.ts:128`) |

**`IapPurchaseResult` (serde camelCase mirror, in `iap/mod.rs` — mirror `license/mod.rs` style):**
```rust
// PurchaseState: 0=PURCHASED → "success", 1=CANCELED → "userCancelled", 2=PENDING → "pending"
// On "success": include the granted entitlement codes (derived from the VERIFIED transaction only)
#[serde(rename_all = "camelCase")]
enum IapPurchaseResult { Success { entitlements: Vec<String> }, UserCancelled, Pending }
```
TS mirror in `index.ts` (do not invent fields beyond the contract; rejections carry `{ code }` like license):
```ts
type IapProduct = { id: string; displayPrice: string; displayName: string };
type IapPurchaseResult = { state: "success"; entitlements: string[] } | { state: "userCancelled" } | { state: "pending" };
```

### Command + event naming (Claude's Discretion — recommended, mirroring conventions)
- Rust commands: `iap_products`, `iap_purchase`, `iap_restore`, `iap_current_entitlements` (snake_case, mirrors `license_status`/`activate_license`).
- Event channel: **`storekit://updated`** (mirrors `menu://check-updates`/`menu://open-settings` — a no-payload `listen` channel; the `listen` import lives ONLY in `tauri.ts`).

### No-op arms keep tests + vite dev native-free
`browser.ts`/`stub.ts` `createIapStub()`: `products → []`, `purchase/restore → reject({ code: "serviceUnreachable" })` (or a deterministic stub for the dev button), `currentEntitlements → []`, `onPurchaseUpdated → () => {}`. `setPlatformForTest` injects it exactly as it does the license stub today. **Result: vitest/jsdom/vite-preview never load `@choochmeque/tauri-plugin-iap-api`** — the whole reason the seam exists. `[VERIFIED: stub.ts:33-49 + index.ts:264 pattern]`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWS signature verification of a transaction | A custom JWS/JWT verifier against Apple's public keys | StoreKit 2 `VerificationResult` | Apple does it on-device, key-rotation-aware; rolling your own is the exact fail-open trap D-04 forbids |
| Purchase sheet UI | Any in-webview "buy" modal | `Product.purchase()` system sheet | Apple renders it out-of-process; an in-app price sheet is a 3.1.1 rejection AND can't take payment |
| Entitlement source of truth | A local "owned products" list you append to | `Transaction.currentEntitlements` (re-read, never merge) | Refunds/revocations are reflected only by re-reading; an append-only list keeps refunded users Pro forever |
| StoreKit↔Rust bridge | A from-scratch objc2 StoreKit binding | `tauri-plugin-iap` (or `swift-rs` if D-03 trips) | StoreKit 2's async/`AsyncSequence` (`currentEntitlements`, `Transaction.updates`) is painful from raw Rust; Swift is the natural language |
| Restore | A manual `Transaction.all` replay | `restorePurchases` / `AppStore.sync()` + re-read `currentEntitlements` | `Transaction.all` has documented empty-result edge cases; sync+re-read is the sanctioned path |

**Key insight:** the entire StoreKit decision surface that's worth owning is a *pure function* — `(PurchaseResult, VerificationResult) → granted entitlement set | free` — and that's the part to unit-test. Everything around it (the sheet, the JWS check, the product fetch) belongs to Apple/the plugin and must not be reimplemented.

---

## Common Pitfalls

### Pitfall 1: `.storekit` inner loop assumed to work in `tauri dev` (the planning trap)
**What goes wrong:** the plan budgets an agent-driven `.storekit` loop to exercise the four states; it never injects because the binary isn't Xcode-launched, and the spike stalls.
**Why:** `storekitd` only ingests the config via Xcode's internal XPC channel (OQ-1).
**Avoid:** make the unit-tested Rust verify/grant core the inner loop; make the live states the human gate. Treat any `.storekit` file as best-effort, never load-bearing.
**Warning sign:** `Product.products(for:)` returns `[]` in `tauri dev` even with the `.storekit` file committed.

### Pitfall 2: App Sandbox without `network.client` → white-screen (SHIP-GATE, but it bites in Phase 26)
**What goes wrong:** the moment `app-sandbox` is added, the signed `.app` launches blank; `tauri dev` (un-sandboxed) looks fine.
**Why:** the WKWebView↔Rust IPC over `http://ipc.localhost` is treated as a network connection.
**Avoid:** set BOTH `app-sandbox` and `network.client` in `entitlements.appstore.plist` from the first sandboxed build.
**Warning sign:** blank window on the signed `.app`; `sandboxd` denies a connection to `ipc.localhost`. `[CITED: tauri #13878, tauri-docs #3171]`

### Pitfall 3: Plugin Swift package fails to load without `MACOSX_DEPLOYMENT_TARGET=13.0`
**What goes wrong:** `dyld`/library-load error at launch.
**Avoid:** set `MACOSX_DEPLOYMENT_TARGET="13.0"` on the spike build (and `minimumSystemVersion` 13.0 for that build only — never on base `tauri.conf.json`). `[CITED: plugin README]`

### Pitfall 4: Granting Pro on `.unverified` / skipping `finish()`
**What goes wrong:** tampered device fakes Pro (fail-open); or unfinished transactions replay every launch.
**Avoid:** unwrap `.verified` only; `.unverified` → free; call `finish()` after granting. Unit-test the branch. `[CITED: VerificationResult docs + WWDC by Sundell]`

### Pitfall 5: `currentEntitlements` empty on a fresh Sandbox account (review/test surprise)
**What goes wrong:** first-launch entitlement read is empty until StoreKit's local cache syncs with Apple.
**Avoid:** launch-time Pro reads `currentEntitlements` (no auth prompt); `AppStore.sync()` is gated behind the explicit Restore call only. For the walkthrough, press Restore if Pro doesn't appear. `[CITED: Apple forum 823454/808757]`

### Pitfall 6: Importing the plugin JS API outside `tauri.ts`
**What goes wrong:** vitest/vite-preview pull in native code → test breakage / non-deterministic arms.
**Avoid:** the `@choochmeque/tauri-plugin-iap-api` import lives ONLY in `tauri.ts`; everything else goes through the seam.

---

## Code Examples

### StoreKit 2 purchase + verify decision core (the unit-testable shape — Swift-side, behind the plugin/swift-rs)
```swift
// Source: developer.apple.com/documentation/storekit (PurchaseResult + VerificationResult)
switch try await product.purchase() {
case .success(let verification):
    switch verification {
    case .verified(let transaction):
        // grant pro.* ; persist nothing secret ; then:
        await transaction.finish()
    case .unverified:
        // FAIL CLOSED → free tier (mirrors Ed25519 bad-signature path)
    }
case .userCancelled: break            // grant nothing, calm
case .pending:        break           // "waiting for approval", NOT an error
@unknown default:     break
}
```

### Seam mirror (TS — the production-shaped arm, mirrors `tauri.ts:141-149`)
```ts
// Source: in-repo src/lib/platform/tauri.ts (license arm) — iap arm follows it 1:1
iap: {
  products: () => invoke<IapProduct[]>("iap_products"),
  purchase: (productId) => invoke<IapPurchaseResult>("iap_purchase", { productId }),
  restore: () => invoke<void>("iap_restore"),
  currentEntitlements: () => invoke<string[]>("iap_current_entitlements"),
  onPurchaseUpdated: (handler) => listen("storekit://updated", () => handler()),
},
```

---

## Runtime State Inventory

Phase 26 lands new code + a minimal entitlements file gated behind an unbuilt-by-default cargo feature; it stores no renamed/migrated state. External (ASC-side) state is user-driven per D-08/D-09.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the spike persists no StoreKit state locally; `currentEntitlements` is read live from StoreKit. (Keychain is NOT used by the IAP path — StoreKit entitlements live in Apple's store, not the app Keychain.) | None |
| Live service config | **App Store Connect (user-driven, D-08/D-09):** App ID `com.tinkerdev.app` registered; Paid Applications Agreement signed + Active (hours-long propagation — start FIRST); non-consumable `com.tinkerdev.app.pro` at "Ready to Submit"; ≥1 Sandbox tester. None of this is in git. | Agent guides the user step-by-step from `docs/appstore/ASC-SETUP.md` §1/§3/§5/§6; user executes the clicks. |
| OS-registered state | None in Phase 26 (SMAppService login-item is Phase 29). | None |
| Secrets/env vars | `MACOSX_DEPLOYMENT_TARGET=13.0` on the spike build invocation (not a secret; build-time only). Apple Distribution signing identity for the human-walkthrough build. | Confirm the signing identity exists (ASC-SETUP §7); no new secret store. |
| Build artifacts | The `appstore` cargo feature adds an optional dep — the default `cargo tree`/`pnpm tauri build` must still exclude `tauri-plugin-iap` (verify `cargo tree \| grep iap` = 0 without `--features appstore`). | Verify the direct build is unaffected (mirror the `webdriver` exclusion check). |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Apple Developer enrolment + Team `FK4HQK83WX` | Sandbox tester, signing | ✓ | — | — (unblocked 2026-06-20) |
| App Store Connect: App ID + Paid-Apps Agreement + product + Sandbox tester | The human round-trip gate | ✗ (user must set up per D-08) | — | None — blocks the human gate only; the seam/compile spike proceeds without it |
| Xcode + command-line tools (Swift toolchain, `codesign`, `xcrun`) | Plugin's Swift package compile + signing | Likely ✓ (direct channel already notarises) | confirm `xcode-select -p` | None — required to compile the Swift bridge |
| `tauri-plugin-iap@0.9` / `@choochmeque/tauri-plugin-iap-api` | The bridge | ✗ (to be added) | 0.9 | `swift-rs@1.0.7` if D-03 trips |
| macOS 13.0+ build target | StoreKit 2 plugin floor | ✓ (dev machine) | — | — |
| `.storekit` local-sheet injection | The (re-shaped) inner loop | ✗ (structurally unavailable for a Cargo-launched binary — OQ-1) | — | **Unit tests over the Rust verify core** (the recommended inner loop) |

**Missing with no fallback (blocking the HUMAN GATE only, not the compile/seam spike):** ASC setup (D-08) — agent-guided, user-executed; propagation is hours, so start the Paid-Apps Agreement first.
**Missing with fallback:** the `.storekit` live-sheet loop → replaced by the Rust-core unit loop + human gate.

## Validation Architecture

> nyquist_validation enabled (config key absent = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (unit) + `tsc --noEmit` + the real-WKWebView e2e harness (`scripts/e2e-spike.sh`, WebDriver via the `webdriver` cargo feature) |
| Config file | `vitest.config.*` / `package.json` scripts (existing) |
| Quick run command | `pnpm vitest run` (+ `pnpm tsc --noEmit`) |
| Full suite command | `pnpm vitest run` then `bash scripts/e2e-spike.sh` (real WKWebView); decoder's 19 tests are the immovable bar |

### Phase Requirements → Test Map
| Req / Criterion | Behavior | Test Type | Automated Command | Verifiable how |
|-----------------|----------|-----------|-------------------|----------------|
| MAS-IAP-04 verify core | `.verified` → grant `pro.*`; `.unverified` → free; `finish()` called | unit (Rust + TS contract) | `pnpm vitest run` / `cargo test -p devtools-app-lib --features appstore` | **AGENT** — error-as-value decision core, states injected as data |
| MAS-IAP-01 result mapping | `PurchaseState` 0/1/2 → `IapPurchaseResult` success/userCancelled/pending; `.pending` calm | unit | `pnpm vitest run` | **AGENT** — pure mapper, no native call |
| Success criterion 3 (seam) | `platform.iap` no-op arm keeps vitest/jsdom native-free; `setPlatformForTest` injects an iap stub | unit | `pnpm vitest run` | **AGENT** — mirrors license-stub tests |
| Seam wiring smoke | the temporary D-11 button renders + calls the seam (browser arm, no native) | e2e (real WKWebView, direct build) | `bash scripts/e2e-spike.sh` | **AGENT** — but only the no-op arm (the sandboxed StoreKit build is NOT WebDriver-drivable) |
| Success criterion 1 (live sheet) | native sheet presents; `.success`/`.userCancelled` round-trip in the sandboxed signed `.app` | manual | — | **HUMAN GATE** — out-of-process system UI, WebDriver-impossible (D-06) |
| MAS-IAP-04 serverless proof | no network beyond Apple StoreKit on a purchase | manual | `log stream --predicate 'sender == "sandboxd"'` during purchase | **HUMAN GATE** — observe on the signed `.app` |
| Success criterion 4 (round-trip) | real Sandbox-tester purchase completes; Restore re-grants | manual | — | **HUMAN GATE** — `.storekit` cannot substitute on macOS |
| `.pending` live exercise | Ask-to-Buy state observed live | manual (best-effort) | — | **HUMAN GATE (best-effort)** — handler proven by the unit core regardless |

### Sampling Rate
- **Per task commit:** `pnpm vitest run` + `pnpm tsc --noEmit` (+ `cargo test --features appstore` for the Rust core).
- **Per wave merge:** full vitest + the real-WKWebView e2e on the **direct** build (the no-op iap arm); decoder 19/19 green.
- **Phase gate:** the **human Sandbox-tester walkthrough** on the signed sandboxed `.app` — the only path that proves the live sheet (criteria 1+4). Mirrors the v1.6 live-purchase gate.

### Wave 0 Gaps
- [ ] `src-tauri/src/iap/` unit tests (Rust) — covers MAS-IAP-04 verify/grant core + `.unverified` fail-closed + `finish()` call
- [ ] `src/lib/platform/__tests__/iap.*` (TS) — covers the no-op arm + `setPlatformForTest` injection + the `PurchaseState`→`IapPurchaseResult` mapper (success criterion 3 / MAS-IAP-01)
- [ ] A committed **human-walkthrough checklist** (Sandbox-tester sign-in, buy `com.tinkerdev.app.pro`, observe Pro code via the D-11 button, Restore, `log stream` no-network check) — this IS the phase gate artifact
- [ ] (Conditional) if a `.storekit` file is committed as a fixture: a note that it is NOT load-bearing and does not gate any criterion

## Security Domain

> security_enforcement enabled (absent = enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Purchase auth is Apple's (sandbox tester / Apple ID), handled in system UI |
| V3 Session Management | no | No sessions; entitlement read live from StoreKit |
| V4 Access Control | yes | Entitlement gate: `.verified` transaction → `pro.*`; `.unverified` → free (fail closed) |
| V5 Input Validation | yes | The product id is a fixed compile-time constant (`com.tinkerdev.app.pro`); the `currentEntitlements` codes are intersected with `ALL_ENTITLEMENTS` (over-grant guard, mirrors `baseFromLicense`) |
| V6 Cryptography | yes | JWS verification is StoreKit's on-device check — **never hand-rolled** (D-04) |

### Known Threat Patterns for StoreKit-on-Tauri
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Granting Pro on `.unverified` (tampered/jailbroken device) | Spoofing / Elevation | Unwrap `.verified` only; `.unverified` → free tier |
| Over-grant from an unexpected entitlement code | Elevation | Intersect granted codes with `ALL_ENTITLEMENTS` (mirror `baseFromLicense` T-21-12) |
| Transaction replay (unfinished tx reappears) | Tampering | Call `Transaction.finish()` after granting |
| Exfiltration via a rogue network call in the verify path | Information Disclosure | Only `network.client` (for IPC); no Keygen transport in the IAP path; `log stream` proves no app-originated outbound |
| Forbidden plugin/secret leaking into the **direct** build | Tampering | `appstore`-feature-gated optional dep; `cargo tree` (no `--features appstore`) excludes the plugin |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `.storekit` file does NOT inject products into a Cargo-launched `tauri dev` binary (Xcode-XPC-only). | OQ-1 / Critical Q3 | If WRONG (it does inject somehow), the team gets a faster local loop — a pleasant surprise, not a blocker. The plan is still correct (unit core + human gate). LOW downside. |
| A2 | `tauri-plugin-iap@0.9` compiles + links into the universal sandboxed build with no objc2/keyring clash (single objc2 0.6.4 tree today). | Fallback checkpoint criterion 1 | If WRONG → D-03 trips → swift-rs fallback. This is exactly what the spike verifies; the plan must contain the go/no-go gate. MEDIUM — but contained. |
| A3 | A sandbox tester cannot easily force `.pending` (Ask-to-Buy) without Family-Sharing config. | Critical Q3 | If WRONG, the live `.pending` exercise becomes easy (bonus). The handler+unit test satisfies MAS-IAP-01 regardless. LOW. |
| A4 | `MACOSX_DEPLOYMENT_TARGET=13.0` + `minimumSystemVersion` 13.0 on the spike build invocation only (not base config) is sufficient and does not leak to the direct channel. | Minimal harness | If the base config is accidentally edited, direct 10.15–12.x users are silently dropped (Pitfall 11, milestone). Plan must use a per-invocation flag, not a committed base change. MEDIUM if mishandled. |
| A5 | `getProductStatus(id).isOwned` is a sufficient proxy for "Pro is currently entitled" for a non-consumable (no need for the full `Transaction.currentEntitlements` stream in Phase 26). | Seam mapping | If `isOwned` doesn't reflect refunds in Phase 26's read, that's fine — refund/revoke live-drop is explicitly Phase 28. LOW for this phase. |
| A6 | `@choochmeque/tauri-plugin-iap-api` is the correct JS package name for 0.9. | Stack | If the package name differs, install fails fast and is trivially corrected at plan time (`npm view`). LOW. |

## Open Questions

1. **OQ-1 (CRITICAL — resolve before writing tasks): Can the committed `.storekit` inner loop (D-05/D-07) actually drive the live sheet in `tauri dev`?**
   - **What we know:** StoreKit Config File injection is delivered by Xcode's internal `IDELaunchSession` XPC into `storekitd`; a non-Xcode-launched binary (which `tauri dev` is) does not receive the config; manual container-copy doesn't work; Apple docs + `ASC-SETUP.md §6` call macOS config-file testing iOS-first/incompatible. `[VERIFIED]`
   - **What's unclear:** whether `SKTestSession` (`StoreKitTest` framework) can be invoked from the app/plugin at runtime to inject a `.storekit` URL on macOS 13+ — historically iOS-first, possibly viable now, unverified for a Tauri build.
   - **Recommendation:** **Re-shape the inner loop** — agent loop = unit tests over the Rust verify/grant core; live states = the human Sandbox-tester gate; `.storekit` file = best-effort, never load-bearing. The planner should encode the "states exercised" criterion against the unit core + human gate, and (optionally) add a SHORT spike task to empirically test `.storekit`/`SKTestSession` injection — but the plan must not block on it. This honors D-05/D-07's *intent* (exercise all four states cheaply) while routing around the broken mechanism.

2. **OQ-2: Does `tauri-plugin-iap` expose the raw `VerificationResult` distinction (verified vs unverified) to JS, or only a boolean `isOwned`/`PurchaseState`?**
   - **What we know:** the plugin advertises "automatic transaction verification (iOS)"; the macOS verify surface to JS is under-documented.
   - **What's unclear:** whether the **fail-closed-on-`.unverified`** decision (MAS-IAP-04) happens inside the plugin's Swift (good — but then the JS only sees verified results) or must be enforced in our Rust/Swift code.
   - **Recommendation:** during the spike, confirm where verification is enforced. If the plugin verifies internally and only surfaces verified transactions, MAS-IAP-04 is satisfied by construction (document it); if it surfaces unverified ones, our `iap_purchase` Rust command must drop them. Either way the unit test asserts "unverified → free." This may itself be a D-03 criterion-(b) seam-mapping concern.

3. **OQ-3: Does `restorePurchases`/`AppStore.sync()` prompt an Apple-ID password sheet, and is that acceptable behind the temporary D-11 button?**
   - **What we know:** silent `AppStore.sync()` at launch prompts a password sheet (bad UX); gating it behind an explicit Restore is the sanctioned pattern.
   - **Recommendation:** the D-11 button's Restore is explicit (user-pressed), so the prompt is acceptable for the spike. No launch-time sync in Phase 26.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| StoreKit 1 (receipt validation, often server-side) | StoreKit 2 (`Product`/`Transaction`/`VerificationResult`, on-device JWS) | WWDC21 (macOS 12+) | Serverless verify mirrors the Ed25519 model — the whole reason this is feasible offline |
| `.storekit` config-file testing as the macOS dev loop | Sandbox testers for macOS; config-file is iOS-first | ongoing (Apple has not closed the macOS gap) | The reason OQ-1 forces a re-shaped inner loop |

**Deprecated/outdated:** server-side receipt validation (unnecessary for one on-device-verified non-consumable); `Transaction.all` manual replay for Restore (use `sync()` + re-read).

## Sources

### Primary (HIGH confidence)
- In-repo (primary integration evidence): `src/lib/platform/{index,tauri,stub,browser}.ts` (the seam + license/events arms to mirror), `src-tauri/Cargo.toml` (the `webdriver` optional-dep + feature precedent, :23-36/:92-94), `src-tauri/src/lib.rs` (cfg-gated registration + `generate_handler!` arms, :300-348), `src-tauri/src/license/mod.rs` (serde camelCase contract style), `docs/appstore/ASC-SETUP.md` (ASC setup + the §6 macOS-`.storekit` warning)
- `developer.apple.com/documentation/storekit` — `Product.purchase()`/`PurchaseResult`/`VerificationResult`/`Transaction.currentEntitlements`/`finish()` (StoreKit 2 lifecycle)
- `developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode` — `.storekit` config-file testing mechanism
- `.planning/research/{SUMMARY,STACK,ARCHITECTURE,PITFALLS,FEATURES}.md` — milestone-level v1.8 research (treated as verified inputs)

### Secondary (MEDIUM confidence)
- `github.com/Choochmeque/tauri-plugin-iap` — v0.9 API surface (`getProducts`/`purchase`/`restorePurchases`/`getProductStatus`/`onPurchaseUpdated`), `PurchaseState` 0/1/2, macOS 13.0+, capabilities `iap:default`, JS pkg `@choochmeque/tauri-plugin-iap-api`
- WWDC by Sundell — StoreKit 2 `finish()` + rebuild-not-merge discipline
- `crates.io` — `tauri-plugin-iap@0.9` (2026-05-05), `swift-rs@1.0.7`

### Tertiary (LOW confidence — needs validation in the spike)
- XcodeGen #944 / Apple forum 650977 / Gaige's Pages — `.storekit` injection is Xcode-XPC-only; `xcodebuild`/non-IDE launch does not receive it; manual container-copy fails (the OQ-1 evidence)
- `developer.apple.com/documentation/storekittest/sktestsession` — `SKTestSession(contentsOf:)` exists but `StoreKitTest` is historically iOS-first/macOS-incompatible (the OQ-1 possible-but-unverified workaround)

## Metadata

**Confidence breakdown:**
- Seam shape + Rust/TS integration: HIGH — the codebase proves the exact pattern; mapping is mechanical.
- StoreKit 2 lifecycle + fail-closed verify: HIGH — Apple docs + the existing Ed25519 discipline.
- Plugin viability (compile/link/verify): MEDIUM — spike-gated by design (the go/no-go checkpoint exists precisely for this).
- `.storekit` inner loop: HIGH-and-adverse — the evidence strongly indicates it does not work for a Tauri binary (OQ-1); plan around it.

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable, except `tauri-plugin-iap` is fast-moving / single-maintainer — re-confirm the 0.9 version + JS pkg name at plan time; ~7 days for that one dep)
