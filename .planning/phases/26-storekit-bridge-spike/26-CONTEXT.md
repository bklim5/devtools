# Phase 26: StoreKit Bridge Spike (CRITICAL PATH) - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the store build can present the **native StoreKit purchase sheet** for the one non-consumable "Pro" product (`com.tinkerdev.app.pro`) and **verify the result on-device** (StoreKit 2 JWS, serverless), behind a `platform.iap` seam that mirrors `platform.license`. This is the highest-risk, longest-pole dependency — prove it before anything downstream is built on it.

**In scope:** the `platform.iap` seam (interface + real `tauri.ts` arm + no-op browser/stub arm), `iap_*` Rust commands, native purchase sheet invocation, on-device JWS verify, and a real sandbox purchase round-trip (human gate).

**Out of scope (later phases — do NOT build here):**
- The real Store License pane / Buy + Restore UI, entitlement-source swap into `resolveEntitlements`, Keygen compile-out → **Phase 28**
- The formal 3-layer build-variant seam (`appstore` cargo feature + `tauri.appstore.conf.json` overlay + `VITE_CHANNEL`), updater compile-out, `verify-appstore-bundle.sh` → **Phase 27**
- Sandbox-safe native features (SMAppService, keyring gate-out, tray/summon audit) → **Phase 29**
- `.pkg` build + ASC submission + metadata/screenshots/privacy → **Phase 30**

Requirements: **MAS-IAP-01, MAS-IAP-04**.
</domain>

<decisions>
## Implementation Decisions

### Bridge strategy
- **D-01:** **Plugin-first.** Spike `tauri-plugin-iap@0.9.0` (Choochmeque) first — it bundles a Swift package that does StoreKit 2 `getProducts`/`purchase`/`restorePurchases`/`getProductStatus`/`onPurchaseUpdated` + native JWS verify, the fastest path behind the `platform.iap` seam. Maturity-flagged (72★, single maintainer) — treated as a spike candidate, not a locked dep.
- **D-02:** **Fallback = hand-rolled Swift via `swift-rs@1.0.7`** (mature linker), **same `platform.iap` seam shape** either way. Rejected: hand-rolling from the start (more code now for a trust-surface benefit that the spike can decide later); vendoring the plugin's Swift (own-the-fork cost, premature).
- **D-03:** **Switch to the swift-rs fallback if ANY of:** (a) the plugin won't compile/link into the **universal (arm64+x86_64) App-Sandboxed** build (incl. an objc2/`keyring` `apple-native` link clash); (b) `getProductStatus`/`onPurchaseUpdated` can't map cleanly onto the seam; (c) the native purchase sheet won't present or can't handle `.success`/`.userCancelled`/`.pending` in the sandboxed build.
- **D-04:** **Serverless on-device JWS verify is a HARD constraint both paths must meet** (not a plugin-only fallback trigger). `VerificationResult.verified` only; `.unverified` → fail closed to free tier. Mirrors the existing offline Ed25519 model. If neither path can verify serverless, that's a milestone-level blocker, not a fallback case.

### Test harness & states
- **D-05:** **Two harnesses, both required.** (1) A **committed synthetic `.storekit` StoreKit Configuration file** drives purchase/cancel/unverified/pending flows in `tauri dev` with no ASC propagation wait and no charges — the **agent-driven inner loop**. (2) The **real Sandbox-tester round-trip** is the **human outer gate**.
- **D-06:** **The agent cannot drive the real purchase.** The native StoreKit sheet renders out-of-process as system UI (not in the WKWebView) and Sandbox-tester sign-in happens there — WebDriver/automation cannot click or type it (the structural harness limit: WebDriver can't drive StoreKit/sandbox/refunds). The real round-trip is a **manual human walkthrough**; the agent only drives the `.storekit` inner loop + guides the steps.
- **D-07:** **States the spike must exercise:** `.success` (→ `VerificationResult.verified` → `Transaction.finish()` → `currentEntitlements` reflects Pro), `.userCancelled` (calm, grants nothing), `.unverified` → **fail closed** to free tier (via the `.storekit` verification toggle). **`.pending`** ("waiting for approval", NOT an error; grants nothing yet) — handler MUST exist and be **exercised via the `.storekit` Ask-to-Buy toggle** per MAS-IAP-01, even though the live tester round-trip will likely hit only `.success`/`.userCancelled`.

### ASC prerequisite sequencing
- **D-08:** **Minimum ASC setup NOW to unblock the Phase 26 gate** — the real sandbox round-trip needs: registered App ID `com.tinkerdev.app`; **Paid Applications Agreement started early** (hours-long propagation — kick off first); the non-consumable `com.tinkerdev.app.pro` product set "Ready to Submit"; ≥1 **Sandbox tester** account. **Defer** screenshots / privacy label / age rating / Notes-for-Review metadata to **Phase 30**.
- **D-09:** **The user drives the Apple-side setup; the agent guides** step-by-step from `docs/appstore/ASC-SETUP.md`, sequencing when each item is needed and the exact values (`com.tinkerdev.app`, `com.tinkerdev.app.pro`, Team `FK4HQK83WX`, ~US$9 nearest tier).

### Spike artifact scope
- **D-10:** **Production-shaped seam that lands on master** — the `platform.iap` interface + real `tauri.ts` arm + deterministic no-op `browser.ts`/`stub.ts` arm + `iap_*` Rust commands are written **to keep**; Phases 27/28 build directly on them. Gated behind the `appstore` cargo feature so the direct build never compiles them. Rejected: throwaway scratch branch (re-does the seam; success criterion 3 expects the seam to exist).
- **D-11:** **Spike purchase trigger = a temporary VISIBLE button in the existing Settings ▸ License pane** invoking `products()`/`purchase()`/`restore()`, so the human gate can reach an actual sheet. **Superseded/removed when Phase 28's `StoreLicenseSettings` lands** — it is mid-milestone spike scaffolding, not a shipped surface.
- **D-12 (planner note, not a user choice):** Phase 27 *owns* the formal 3-layer variant seam, but Phase 26 unavoidably needs a **minimal sandbox-enabled build harness** — sandbox entitlements incl. mandatory `com.apple.security.network.client` (else white-screen) + `tauri-plugin-iap` registration — just to invoke StoreKit. Expect the spike to touch a slice of entitlements/feature-gate config that Phase 27 later formalizes; do not block on Phase 27 for this minimal harness.

### Claude's Discretion
- Exact `iap_*` command names + `storekit://updated` event channel naming (mirror the `license`/`menu://` conventions in `platform/{index,tauri}.ts`).
- The `.storekit` file's product/price fixture values (cosmetic for local dev; the real price comes from `Product.displayPrice` in Phase 28).
- The dev-button placement/label within the License pane (temporary).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 26: StoreKit Bridge Spike" — goal, 4 success criteria, gate
- `.planning/REQUIREMENTS.md` — MAS-IAP-01 (native purchase sheet, `.success`/`.userCancelled`/`.pending`), MAS-IAP-04 (on-device JWS verify, fail-closed)

### v1.8 research (this milestone)
- `.planning/research/SUMMARY.md` — exec summary, Phase 26 rationale, the four ship-gate killers
- `.planning/research/STACK.md` — `tauri-plugin-iap@0.9` / `swift-rs@1.0.7` versions, the build-variant mechanism, App Sandbox entitlements (`network.client` non-optional), min-13.0 forces, objc2/`keyring` coexistence flag, `.storekit` + sandbox-tester testing
- `.planning/research/ARCHITECTURE.md` — `platform.iap` seam shape (Component 2), how it mirrors `platform.license`
- `.planning/research/PITFALLS.md` — pitfalls 1 (network.client white-screen), 6/7/9 (gated in this phase: bridge viability, JWS fail-closed + `finish()`)
- `.planning/research/FEATURES.md` — StoreKit purchase/verify/restore behavior, `.pending` calm-state expectation

### App Store Connect setup (user drives, agent guides)
- `docs/appstore/ASC-SETUP.md` — App ID `com.tinkerdev.app`, Paid-Apps Agreement, non-consumable `com.tinkerdev.app.pro` (~US$9), Sandbox testers, provisioning profile; verified values incl. Team `FK4HQK83WX`

### In-repo seams to mirror (primary integration evidence)
- `src/lib/platform/index.ts` — the `Platform` interface + `isTauri()` lazy-load pattern; **`platform.license` (lines ~121-144) is the exact mirror for `platform.iap`**; `setPlatformForTest`/no-op-arm discipline
- `src/lib/platform/{tauri,browser,stub}.ts` — real arm / fallback arm / test stub split (real `@tauri-apps/*` import lives ONLY in `tauri.ts`)
- `src-tauri/Cargo.toml` — the existing `webdriver` cargo-feature precedent the `appstore` feature mirrors; `cfg(any(target_os=…))` native-plugin gating
- `src-tauri/src/lib.rs` — `generate_handler!` cfg-arm pattern (adding the `appstore` arm is a known ergonomic wart, ~lines 322-343)
- `src-tauri/src/license/mod.rs` — the serde camelCase command contract style the `iap_*` commands should follow
- `src-tauri/tauri.conf.json` — `identifier: com.tinkerdev.app` (must match the ASC App ID), base `minimumSystemVersion` 10.15 (store overlay bumps to 13.0 — Phase 27, never the base)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`platform.license` capability** (`platform/index.ts`): the template for `platform.iap` — pure-local read + mutation methods, serde-pinned camelCase payloads, deterministic browser/test arms that never hit the network. Copy its shape.
- **Lazy-load seam** (`isTauri()` + dynamic `import("./tauri")`): `platform.iap`'s real arm slots in with zero changes to the seam machinery — the per-capability getter on `platform` auto-forwards.
- **`webdriver` cargo feature** (`Cargo.toml`): the in-repo precedent for the `appstore` feature gating optional plugin registration.
- **Settings ▸ License pane** (`src/components/LicenseSettings.tsx`): host for the temporary spike purchase button (D-11), replaced by `StoreLicenseSettings` in Phase 28.

### Established Patterns
- Real `@tauri-apps/*` (and now `tauri-plugin-iap-api`) imports live **ONLY in `tauri.ts`** — never in components or `index.ts` (ENVIRONMENT-SAFE constraint).
- Rust commands reject with serialized `{ code }` objects; Rust never sends prose — JS maps codes to copy.
- Optional store-only deps go behind a cargo feature with `optional = true` so the direct build never compiles them.

### Integration Points
- New Rust `iap_*` commands registered in `lib.rs` behind `#[cfg(feature = "appstore")]`; a `storekit://updated` event emitted Rust-side, listened ONLY in `tauri.ts`.
- `platform.iap` added to the `Platform` interface → auto-forwarded by the existing getter block in `index.ts`.
- Sandbox entitlements file + `network.client` (minimal harness, D-12) — formalized in Phase 27.

</code_context>

<specifics>
## Specific Ideas

- The agent-driven `.storekit` inner loop is the fast iteration path; the human Sandbox-tester round-trip is the slow, real, gating path — design the spike so almost everything is provable on `.storekit` and only the final round-trip needs the tester.
- The user will personally execute the ASC clicks and the sandbox purchase walkthrough; the agent must produce a tight, in-order checklist (which `ASC-SETUP.md` section, what to enter, what "done" looks like) rather than assume it can automate any of it.
- Keep the `.pending` path real (Ask-to-Buy) — it's a requirement, not optional polish.

</specifics>

<deferred>
## Deferred Ideas

- **Restore Purchases UI** — Apple-mandatory, but its real button + flow is **Phase 28** (MAS-IAP-03). The spike may call `restore()` from the temporary dev button to prove the seam, but the shipped Restore affordance is not built here.
- **Buy button with `Product.displayPrice`** + App-Store-managed wording — **Phase 28** (MAS-IAP-06).
- **Refund/revoke `Transaction.updates` boot listener** → live-drop — **Phase 28** (MAS-IAP-05).
- **ASC submission metadata** (screenshots, privacy label = Data Not Collected, `PrivacyInfo.xcprivacy`, age rating, Notes-for-Review) — **Phase 30**.
- **Family Sharing toggle, promo/offer codes, Manage-Purchases deep link** — v1.x+ (MAS-IAP-08/09, explicitly deferred).

</deferred>

---

*Phase: 26-storekit-bridge-spike*
*Context gathered: 2026-06-22*
</content>
</invoke>
