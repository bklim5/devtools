# Feature Research

**Domain:** v1.8 "Mac App Store Distribution" — adding a Mac App Store channel + StoreKit IAP to an existing shipped Tauri 2 + React + TS macOS app (TinkerDev)
**Researched:** 2026-06-22
**Confidence:** HIGH (Apple rules cited from current docs / guidelines page; StoreKit 2 APIs verified against developer.apple.com; sandbox/hotkey behavior cross-checked against multiple sources)

> Scope reminder: the **direct DMG + updater channel already ships** (v0.4.1, notarized) and is OUT of scope. Every feature below is what the **App Store build variant** must add or change. Locked decisions from the 999.10 backlog are treated as given — this file researches the *implications*, not whether.

---

## The governing rule (everything else follows from this)

Apple guideline **3.1.1** (current, In-App Purchase):

> "If you want to unlock features or functionality within your app … you must use in-app purchase. **Apps may not use their own mechanisms to unlock content or functionality, such as license keys**, augmented reality markers, QR codes, cryptocurrencies and cryptocurrency wallets, etc."

And the macOS-specific corollary that reviewers apply: **a Mac App Store app may not present a license screen at launch, require license keys, or implement its own copy protection** ([Apple guideline 3.1.1](https://developer.apple.com/app-store/review/guidelines/)).

This is the hard reason the store variant must compile OUT the entire Keygen key-paste surface (`InlineActivation`, the "I have a license key" reveal, the key input, `license.tinkerdev.io` calls, and the `BUY_LICENSE_URL` external link) and replace it with StoreKit. It is not stylistic — shipping the key field would be a guaranteed rejection.

**US-storefront nuance (verify, don't assume):** post-*Epic v. Apple* (guidelines updated May 2025), apps **on the US storefront** may now include external-purchase links/buttons without an entitlement ([9to5Mac, 2025-05-01](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/)). This is a *real* loophole, but the locked decision is **StoreKit-only, no external links** — which is the simplest, globally-shippable, lowest-rejection-risk path and avoids dual-surfacing. Treat the US loophole as an explicitly-rejected option (see Anti-Features), not a feature.

---

## Feature Landscape

### Table Stakes (Required for an approvable submission)

Missing any of these = either a non-functional purchase or an outright rejection.

| Feature | Why Expected / Required | Complexity | Notes / Dependency |
|---------|--------------------------|------------|--------------------|
| **One non-consumable "Pro" IAP product** configured in App Store Connect | The ONLY sanctioned unlock mechanism (3.1.1). Non-consumable = bought once, perpetual — matches today's node-locked one-time model | MEDIUM | First IAP **must be submitted attached to the app binary** in the same review ([App Store Connect help](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases/)). Needs its own localized display name, description, **review screenshot**, and price tier |
| **Native StoreKit 2 purchase flow** (`Product.purchase()` → system payment sheet) | The user-facing buy action. StoreKit renders the Apple payment sheet (price, Face/Touch ID/password) — app does not draw it | HIGH | New native Swift/ObjC bridge behind `src/lib/platform/` (spike first per locked decision). Replaces the `Buy license` button's `platform.opener.openUrl(BUY_LICENSE_URL)` path in `UpsellPanel.tsx` |
| **Purchase result handling** (`.success(verification)` / `.userCancelled` / `.pending`) | StoreKit returns a `Product.PurchaseResult`; app must branch all three calmly | MEDIUM | `.pending` (Ask-to-Buy / SCA) must show a calm "waiting for approval" state, NOT an error. Mirrors the existing calm-tone error model in `UpsellPanel`/`LicenseSettings` |
| **On-device JWS verification** of the transaction (`VerificationResult`) | The locked "no server" model. StoreKit 2 cryptographically verifies the JWS against Apple's public keys on-device | MEDIUM | Unwrap `.verified(transaction)`; **treat `.unverified(_, error)` as NOT entitled** (fail closed — mirrors today's Ed25519 `machine.lic` fail-closed) ([VerificationResult.unverified](https://developer.apple.com/documentation/storekit/verificationresult/unverified(_:_:))) |
| **`Transaction.finish()` after granting** | Required to mark the transaction consumed; un-finished transactions replay on every launch and can hang/duplicate | LOW | Call after the entitlement is granted/persisted. Standard StoreKit 2 lifecycle |
| **Compute "is Pro" from `Transaction.currentEntitlements`** | The single source of truth for entitlement on the store build. Returns the latest entitling transactions for non-consumables; **refunded/revoked products do NOT appear** ([Transaction.currentEntitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements)) | MEDIUM | Resolves to the SAME `pro.theming`/`pro.ordering` map the central gate already consumes — no webview-gate change (per locked decision) |
| **"Restore Purchases" affordance** in Settings ▸ License | **MANDATORY** for non-consumables under 3.1.1 — "make sure you have a restore mechanism for any restorable in-app purchases." A common rejection cause if absent ([guideline 3.1.1](https://developer.apple.com/app-store/review/guidelines/), [Apphud restore guide](https://apphud.com/blog/restoring-purchases)) | LOW–MEDIUM | A clearly-labeled button; calls `AppStore.sync()` (forces an account refresh) then re-reads `currentEntitlements`. Lives where today's `LicenseSettings` Activate/Deactivate live |
| **`Transaction.updates` listener** at launch | Keeps entitlement in sync for purchases made on another device, **refunds, and revocations**. A refunded txn emits here with `revocationDate`/`revocationReason` set | MEDIUM | App-lifetime task started at boot. On a revocation → drop Pro live (reuses the existing live-flip `refreshEntitlements()` path; reuses the calm "Pro features turned off" drop-notice card already in `LicenseSettings`) |
| **License pane variant for the store build** | The store pane must show entitlement status (Pro / not-Pro) + Buy + Restore, and must NOT show: a key field, "buy on our website", `$9` text, or any price the app invents | MEDIUM | Branch on the build-variant seam. The pane shows the **StoreKit-localized price string** from `Product.displayPrice`, never a hardcoded `$9` |
| **App Sandbox enabled** (`com.apple.security.app-sandbox`) | Mandatory for any Mac App Store app ([App Sandbox info](https://developer.apple.com/help/app-store-connect/reference/app-uploads/app-sandbox-information)) | HIGH | Cross-cutting; gates native-feature behavior below. Direct build stays un-sandboxed |
| **Auto-updater compiled OUT** of the store build | Apple forbids self-updating apps (the store handles updates) | LOW | The Updates pane (SET-10) hides/disables on store builds (already a locked decision) |
| **Privacy "nutrition label" = Data Not Collected** | Required for every submission. App is fully offline/no-tracking → "On-device-only data is not 'collected'" so the label is **Data Not Collected** ([App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)) | LOW | A form in App Store Connect, not code. Honest and trivially true here. Add a Privacy Manifest (`PrivacyInfo.xcprivacy`) declaring no tracking / no collected data types if any required-reason APIs are touched |
| **Complete, accurate submission metadata** | 2.1 (App Completeness) + 2.3 (Accurate Metadata) — the #1 rejection bucket for utilities | MEDIUM | See the submission checklist below. Screenshots must show **real, testable states** of the actual store build |
| **Age rating questionnaire** | Required to submit. A dev utility = **4+** (no objectionable content) | LOW | App Store Connect form |
| **Support URL + (functional) marketing/privacy URLs** | 2.1 requires fully-functional URLs; placeholder/empty sites are rejected | LOW | `tinkerdev.io` exists; ensure a support page + privacy page resolve |

### Differentiators (Nice-to-have, not required to ship)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Global summon hotkey kept WORKING under sandbox** | The biggest "graceful degradation" win: `RegisterEventHotKey` (Carbon) **works in a sandboxed Mac App Store app with zero entitlements** — global hotkey apps remain welcome ([Macworld](https://macworld.com/article/1166857/apps_using_global_hotkeys_will_remain_welcome_in_the_mac_app_store/), [KeyboardShortcuts](https://github.com/sindresorhus/keyboardshortcuts)). So the summon feature need NOT degrade if Tauri's `global-shortcut` plugin uses `RegisterEventHotKey` | MEDIUM | **Verify in the bridge spike** which API Tauri's plugin uses. `CGEventTap` is NOT allowed in the sandbox; `RegisterEventHotKey` and `NSEvent` global monitors are. If the plugin path is sandbox-incompatible, fall back to feature-off (table-stakes graceful path) |
| **Launch-at-login via `SMAppService`** | The autostart plugin writes a `LaunchAgent` plist (NOT sandbox-safe). `SMAppService.mainApp` registers a login item that **works sandboxed + is App-Store compatible** (macOS 13+) ([nilcoalescing](https://nilcoalescing.com/blog/LaunchAtLoginSetting/)) | MEDIUM | Must be an explicit user setting, default OFF (Apple: "may not auto-launch … without user consent"). The General pane already exists to host the toggle |
| **Tray / menu-bar item kept** | Tray is native Rust (NSStatusItem); generally sandbox-safe. Keeping it avoids a visible feature regression vs the direct build | LOW–MEDIUM | Verify in spike; no entitlement expected. If it works, it's free parity |
| **Localized price string everywhere price is shown** | Using `Product.displayPrice` (e.g. "$9.99", "€9,99") instead of a literal makes the pane correct in every storefront and never contradicts App Store pricing | LOW | Falls out of the StoreKit integration; also satisfies the "don't show contradicting pricing" anti-feature |
| **`AppStore.sync()` only on explicit Restore** | Calling sync silently can prompt an Apple ID password sheet; gating it behind the user-pressed Restore button keeps launches prompt-free (entitlement at launch comes from `currentEntitlements`, which needs no auth) | LOW | UX polish; matches the app's "no surprise system prompts" ethos already noted in the Keychain hint copy |

### Anti-Features (Seem reasonable, but wrong for THIS app)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Server-side receipt validation** | "Validate the purchase properly" | The locked model is on-device JWS verify (no server), mirroring the offline Ed25519 model. A validation server reintroduces the network dependency the app explicitly avoids and adds infra/availability risk for zero security gain on a $9 perpetual unlock | StoreKit 2 `VerificationResult` on-device verify; fail closed on `.unverified` |
| **Dual-surfacing Keygen + StoreKit in one build** | "Let store users also paste a key" | Direct violation of 3.1.1 ("may not use … license keys") + "may not present a license screen / require license keys" on macOS → guaranteed rejection. Also confuses entitlement source-of-truth | One build-variant seam: store build = StoreKit ONLY, key-paste UI + `license.tinkerdev.io` compiled out; both variants resolve to the same `pro.*` map |
| **External "buy on tinkerdev.io" link in the store build** | "The US storefront now allows it (post-Epic)" | Technically legal on the US storefront only; but it splits the funnel, can't ship globally, invites scrutiny, and contradicts the locked StoreKit-only decision. `BUY_LICENSE_URL` must be compiled out | StoreKit `Product.purchase()` only |
| **Hardcoded `$9` price in the store pane** | "Reuse the existing pitch copy" | The current `UpsellPanel` literally renders `$9 · once · lifetime license`. In the store build the price is set in App Store Connect and may differ by storefront/tax; showing an invented price risks a 2.3 metadata-accuracy rejection and is simply wrong abroad | Render `Product.displayPrice` from StoreKit; never a literal |
| **A license screen / paywall gate at launch** | "Prompt to buy on first run" | macOS-specific reviewer rule: "may not present a license screen at launch." Also the app's free tier (all 11 tools) is the whole point | Pro stays an optional unlock reached via Settings ▸ License / contextual Unlock-Pro modal; the app is fully usable free on first launch (unchanged) |
| **Keychain-stored fingerprint / node-lock on the store build** | "Keep the one-machine model" | StoreKit entitlements are tied to the Apple ID + Family Sharing, not a machine fingerprint. Re-implementing node-locking fights the platform and breaks Restore | Let `currentEntitlements` be the entitlement truth; the fingerprint/`machine.lic` path is Keygen-only and compiles out |
| **Custom "Restore" that replays `Transaction.all`** | "Restore everything manually" | Over-engineered; `currentEntitlements` already yields the active non-consumable, and a 2026 forum thread notes edge cases where `Transaction.all` returns empty for valid IAPs ([forum](https://developer.apple.com/forums/thread/823454)) | Restore = `AppStore.sync()` then re-read `currentEntitlements` |
| **Self-update / "check for updates" in the store build** | Parity with the direct build | Forbidden by Apple; the store delivers updates | Compile the updater out; Updates pane hidden/disabled (locked) |
| **Hiding/obfuscating the gated features from the reviewer** | "Pro is dormant until purchased" | 2.3.1 bans hidden/dormant/undocumented features; the reviewer must be able to exercise the IAP. The current `dev_set_license_state` seam is release-stripped — reviewers need a real path | IAP must be reviewable; document the Pro unlock in Notes for Review; ensure the purchase flow works in the App Sandbox test environment for the reviewer |

---

## Feature Dependencies

```
App Sandbox enabled (com.apple.security.app-sandbox)
    ├──gates──> Global summon hotkey  (RegisterEventHotKey OK sandboxed → keep;
    │                                   CGEventTap NOT OK → must not be used)
    ├──gates──> Launch-at-login  (LaunchAgent plist NOT OK → migrate to SMAppService)
    └──gates──> Tray / menu-bar  (verify sandbox-safe in spike)

Build-variant seam (direct | app-store)
    ├──switches──> Updater in/out
    ├──switches──> Entitlement source: Keygen+key-paste UI  |  StoreKit-only
    │                   └──store build──> compile OUT InlineActivation,
    │                                     "I have a license key", key input,
    │                                     license.tinkerdev.io, BUY_LICENSE_URL, "$9"
    └──switches──> Sandbox feature-flags

StoreKit IAP (store build only)
    └──requires──> Native StoreKit bridge behind src/lib/platform/  (SPIKE FIRST)
                        ├──requires──> One non-consumable "Pro" product in App Store Connect
                        ├──requires──> VerificationResult on-device verify (fail closed)
                        ├──requires──> Transaction.finish()
                        ├──produces──> currentEntitlements → resolve "isPro" →
                        │                  SAME pro.* map → existing central gate (UNCHANGED)
                        ├──requires──> Restore Purchases  (AppStore.sync + re-read)   [MANDATORY]
                        └──requires──> Transaction.updates listener (refund/revoke → live drop Pro)

Store License pane  ──replaces──>  today's LicenseSettings Activate/Deactivate/Refresh
    └──reuses──>  the calm "Pro turned off" drop-notice card (for revocation)
    └──reuses──>  the central gate + refreshEntitlements() live-flip
```

### Dependency Notes

- **Everything store-side requires the native StoreKit bridge** — it does not exist yet and there is no first-class Tauri plugin, so it must be spiked behind `src/lib/platform/` before any UI work. This is the critical-path long pole.
- **`currentEntitlements` → the existing central gate is the key reuse.** Both variants resolve to the same `pro.theming`/`pro.ordering` map (locked decision), so NO webview-gate or tool-registry change is needed — only the *source* that fills the map changes.
- **Restore Purchases depends on the StoreKit bridge**, not on Keygen; it is independent of the activation form (which is gone in the store build).
- **The `Transaction.updates` listener depends on `App` boot wiring** (like today's `useUpdater` singleton consumed in `App.tsx`) — it must be a single app-lifetime task, not per-component.
- **Sandbox feature decisions are independent of StoreKit** and can be spiked in parallel, but all three (hotkey, launch-at-login, tray) gate on the same sandbox-enable change.

---

## MVP Definition

### Launch With (the approvable v1.8 submission)

- [ ] Native StoreKit 2 bridge behind `src/lib/platform/` (spike → real) — **everything depends on it**
- [ ] One non-consumable "Pro" product in App Store Connect, attached to the binary
- [ ] `Product.purchase()` flow with `.success/.userCancelled/.pending` handling
- [ ] `VerificationResult` on-device verify, fail closed on `.unverified`
- [ ] `Transaction.finish()` + `currentEntitlements` → `isPro` → existing `pro.*` map
- [ ] **Restore Purchases** button in Settings ▸ License (mandatory)
- [ ] `Transaction.updates` listener → live Pro drop on refund/revocation
- [ ] Store License pane variant (status + Buy + Restore; NO key field, NO external link, NO literal price)
- [ ] App Sandbox enabled; updater + Keygen UI + `license.tinkerdev.io` compiled out via the variant seam
- [ ] Launch-at-login migrated to `SMAppService` (explicit toggle, default OFF) OR feature-off if deferred
- [ ] Global summon: keep if Tauri's plugin is `RegisterEventHotKey`-based (sandbox-OK), else feature-off
- [ ] Privacy nutrition label = Data Not Collected (+ Privacy Manifest), 4+ age rating, screenshots of real states, working support/privacy URLs, Notes-for-Review documenting the Pro IAP

### Add After Validation (v1.x)

- [ ] Family Sharing for the non-consumable (App Store Connect toggle) — trigger: user requests, or to match competitor generosity
- [ ] Offer codes / promo for Pro (now supported for non-consumables, 2025) — trigger: marketing need
- [ ] In-app "Manage Purchases" deep link — minimal value for a one-time non-consumable, likely skip

### Future Consideration (v2+)

- [ ] Windows/Linux store channels — explicitly deferred (macOS-only)
- [ ] Schema-aware Protobuf as a second paid tier — already a parked product idea, orthogonal to v1.8

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Native StoreKit bridge (spike) | HIGH (enabler) | HIGH | P1 |
| Non-consumable Pro product + purchase flow | HIGH | HIGH | P1 |
| On-device JWS verify (fail closed) | HIGH | MEDIUM | P1 |
| `currentEntitlements` → existing gate | HIGH | MEDIUM | P1 |
| Restore Purchases | MEDIUM (but MANDATORY) | LOW–MEDIUM | P1 |
| `Transaction.updates` refund/revoke listener | MEDIUM (correctness) | MEDIUM | P1 |
| Store License pane variant (no key/link/price) | HIGH (compliance) | MEDIUM | P1 |
| App Sandbox + updater/Keygen compiled out | HIGH (compliance) | HIGH | P1 |
| Launch-at-login → SMAppService | MEDIUM | MEDIUM | P2 |
| Global hotkey kept under sandbox | MEDIUM | MEDIUM | P2 |
| Tray parity under sandbox | LOW–MEDIUM | LOW–MEDIUM | P2 |
| Privacy label / age rating / screenshots / URLs | HIGH (submission) | LOW–MEDIUM | P1 (non-code) |
| Family Sharing | LOW | LOW | P3 |

**Priority key:** P1 = must have for the submission · P2 = ship for parity, degrade gracefully if blocked · P3 = future.

---

## Competitor / Pattern Analysis (how comparable utility apps handle this)

| Concern | Common pattern in shipped Mac utilities | Our Approach |
|---------|------------------------------------------|--------------|
| Direct + MAS dual channel with different unlock | Many indie Mac utilities (menu-bar/dev tools) ship a Developer-ID build with a license key AND a separate MAS build with StoreKit IAP, gated by a build flag | One build-variant seam; store build is StoreKit-only, direct build keeps Keygen |
| Restore Purchases placement | In a Settings/Preferences "License" or "About" tab, clearly labeled | Settings ▸ License pane, where Activate/Deactivate live today |
| Global hotkey under sandbox | Keep it via `RegisterEventHotKey` (no entitlement); apps remain MAS-eligible | Keep if Tauri plugin uses it; verify in spike, else feature-off |
| Launch-at-login under sandbox | `SMAppService` (modern) with an explicit, default-off toggle | Migrate from the LaunchAgent-plist autostart plugin to `SMAppService` |
| Pricing display | Show the StoreKit-localized price, never a hardcoded number | `Product.displayPrice` |
| Privacy label for offline tools | "Data Not Collected" (e.g. on-device-only utilities) | Data Not Collected + Privacy Manifest |

---

## Submission Checklist (these metadata items ARE features for v1.8)

Treat each as a testable deliverable, not paperwork-as-afterthought (2.1/2.3 metadata is the top utility-rejection bucket):

- [ ] **IAP product** created (non-consumable), reference name + localized display name + description, **review screenshot**, price tier set, **attached to the binary** for first review
- [ ] **Restore Purchases** present and functional (reviewer will look for it on a non-consumable)
- [ ] **Privacy nutrition label** completed → Data Not Collected; **Privacy Manifest** (`PrivacyInfo.xcprivacy`) declaring no tracking
- [ ] **Age rating** questionnaire → 4+
- [ ] **Screenshots** (3–4) of real, accessible states of the submitted build — no mocked/unavailable features, no "title screen only"
- [ ] **App description + keywords + name (≤30 chars)** accurate, no price text, no trademark stuffing
- [ ] **Support URL + Privacy Policy URL** resolve (no placeholder/empty pages)
- [ ] **Notes for Review** documenting the Pro unlock + how to exercise the IAP (the gated features must be reviewable, not dormant/hidden — 2.3.1)
- [ ] **No key field / no external buy link / no invented price** anywhere in the submitted store build
- [ ] App boots fully usable (free tier) on first launch — **no license screen at launch** (macOS 3.1.1 corollary)
- [ ] App Sandbox entitlement present; updater absent; crash-free on a clean machine (2.1)

---

## Sources

- [App Review Guidelines — Apple](https://developer.apple.com/app-store/review/guidelines/) — 3.1.1 (license keys banned, restore mechanism required, US-storefront external-link exception), 2.1, 2.3, 4.2; verified 2026-06-22
- [Guidelines updated for external links post-Epic, May 2025 — 9to5Mac](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/) and [AppleInsider](https://appleinsider.com/articles/25/05/02/apples-app-store-guidelines-updated-to-reflect-court-order-over-external-purchases)
- [Transaction.currentEntitlements — Apple Developer](https://developer.apple.com/documentation/storekit/transaction/currententitlements) (refunded/revoked excluded)
- [VerificationResult.unverified — Apple Developer](https://developer.apple.com/documentation/storekit/verificationresult/unverified(_:_:)) (fail-closed handling)
- [Transaction — Apple Developer](https://developer.apple.com/documentation/storekit/transaction) (revocationDate/revocationReason, updates, finish)
- [Restore mechanism mandatory — Apphud](https://apphud.com/blog/restoring-purchases) (currentEntitlements + Restore button placement)
- [App Privacy Details — Apple](https://developer.apple.com/app-store/app-privacy-details/) (on-device data = not collected)
- [App Sandbox info — App Store Connect](https://developer.apple.com/help/app-store-connect/reference/app-uploads/app-sandbox-information) (sandbox mandatory for MAS)
- [SMAppService launch-at-login (sandbox-safe) — nilcoalescing](https://nilcoalescing.com/blog/LaunchAtLoginSetting/)
- [Global hotkeys remain MAS-eligible (RegisterEventHotKey, no entitlement) — Macworld](https://macworld.com/article/1166857/apps_using_global_hotkeys_will_remain_welcome_in_the_mac_app_store/) and [KeyboardShortcuts (API tradeoffs: Carbon OK, CGEventTap not allowed)](https://github.com/sindresorhus/keyboardshortcuts)
- [Tauri global-shortcut plugin (uses RegisterEventHotKey, app-level) — Tauri v2 docs](https://v2.tauri.app/plugin/global-shortcut/)
- [First IAP must ship attached to the binary — App Store Connect help](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases/)
- [Top utility rejection reasons (metadata/screenshots/minimum functionality), 2025 — nextnative](https://nextnative.dev/blog/app-store-review-guidelines)
- Local: existing `src/components/UpsellPanel.tsx`, `src/components/LicenseSettings.tsx` (the activation/license surfaces the store variant must branch/compile out)

---
*Feature research for: v1.8 "Mac App Store Distribution" (TinkerDev)*
*Researched: 2026-06-22*
