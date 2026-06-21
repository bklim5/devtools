# Pitfalls Research

**Domain:** v1.8 "Mac App Store Distribution" — adding a sandboxed Mac App Store channel + StoreKit IAP + App Sandbox to the existing shipped Tauri 2 + Vite + React + TS macOS app (TinkerDev). Direct DMG + updater channel stays and is OUT of scope.
**Researched:** 2026-06-22
**Confidence:** HIGH on Apple rules + Tauri sandbox failure modes (Apple guidelines/docs + multiple Tauri GitHub issues, dated); HIGH on StoreKit lifecycle mistakes (Apple docs + multiple StoreKit threads); MEDIUM on the exact `.pkg`/provisioning-profile signing sequence for a *Tauri* universal bundle (ITMS errors are documented generically; the Tauri-specific productbuild step is community-reported, not officially walked through end-to-end).

> Every pitfall below is grounded in a dated source AND tied to a concrete surface in THIS app — the actual files are `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src/lib/platform/tauri.ts`, `src/components/UpsellPanel.tsx`, `src/components/LicenseSettings.tsx`. Prioritised by **likelihood × cost**: SHIP-GATE items (a single occurrence = guaranteed rejection or a white-screened binary) come first.

---

## Likelihood × Cost ranking (read this first)

| # | Pitfall | Likelihood | Cost | Class |
|---|---------|------------|------|-------|
| 1 | network.client missing → sandbox white-screen | HIGH (it's the #1 reported Tauri sandbox failure) | App is dead on launch / review-blocking | **SHIP-GATE** |
| 2 | Keygen key-paste UI / `license.tinkerdev.io` / `BUY_LICENSE_URL` survives in store build → 3.1.1 rejection | HIGH (these surfaces exist TODAY and are wired into the shared panel) | Guaranteed rejection | **SHIP-GATE** |
| 3 | Updater / autostart plugin merely hidden, not compiled out → 2.4.5 / sandbox rejection | HIGH (both plugins are unconditionally in `Cargo.toml` + `tauri.ts` today) | Guaranteed rejection | **SHIP-GATE** |
| 4 | IAP not testable in review (product not "Ready to Submit", Paid-Apps Agreement, missing Restore, no Notes-for-Review) → 2.1 rejection | HIGH (40%+ of all rejections are 2.1) | Rejection loop (each round-trip ~24-48h) | **SHIP-GATE** |
| 5 | Keychain `errSecMissingEntitlement` under sandbox (if ANY Keychain use survives) | MEDIUM | Runtime crash/feature-dead, invisible to unit+WebDriver gates | HIGH |
| 6 | Missing `Transaction.updates` listener → refunded user keeps Pro forever | MEDIUM | Revenue/correctness leak, silent | HIGH |
| 7 | `currentEntitlements` empty in App Review sandbox ("works on my machine") | MEDIUM | 2.1 rejection that's hard to reproduce | HIGH |
| 8 | Build-variant drift (flag hides UI but still links the forbidden plugin; entitlements in one config not the other) | MEDIUM | Latent rejection or sandbox break shipped silently | HIGH |
| 9 | `.unverified` / un-`finish()`ed transactions mishandled | MEDIUM | Replay loop / fail-open Pro | MEDIUM |
| 10 | `.pkg` signing with the wrong cert / un-signed nested code → ITMS-90238/90296 | MEDIUM | Upload bounce (not a review rejection, but blocks submission) | MEDIUM |
| 11 | minimumSystemVersion 13.0 bump leaks onto the DIRECT channel | LOW-MEDIUM | Silently drops 10.15-12.x direct users | MEDIUM |
| 12 | SMAppService register fails under sandbox / Ventura codesign bug | MEDIUM | launch-at-login silently dead | MEDIUM |
| 13 | Privacy nutrition label / Privacy Manifest wrong for an offline app | LOW-MEDIUM | 2.3 / 5.1.x rejection | MEDIUM |
| 14 | tauri-plugin-store container path moves under sandbox | LOW | Confusing "lost my prefs" support tickets (acceptable per channel split) | LOW |
| 15 | WebDriver/harness can't drive StoreKit/sandbox → false green | HIGH (structural) | A shipped binary that passed CI but fails in the wild | Process |

---

## Critical Pitfalls

### Pitfall 1: App Sandbox without `com.apple.security.network.client` → WKWebView white-screens (SHIP-GATE)

**What goes wrong:**
The moment `com.apple.security.app-sandbox` is added, the packaged store build launches to a **blank white window** — no tools, no error. It works perfectly in `tauri dev` (dev is un-sandboxed), so it passes every existing gate and only dies on the signed sandboxed `.app`.

**Why it happens:**
Tauri 2's webview talks to the Rust core over an IPC channel that the sandbox treats as a **network connection** (`http://ipc.localhost`). With the sandbox on but `network.client` absent, securityd blocks that channel and the webview never loads its own bundle. This is THE single most-reported Tauri macOS sandbox failure ([tauri-docs #3171](https://github.com/tauri-apps/tauri-docs/issues/3171); [tauri #13878, 2025-07-23](https://github.com/tauri-apps/tauri/issues/13878) — production network fully blocked, dev fine). Note from #13878: developers tried `network.outgoing`/other keys and they were ineffective — the correct one is specifically `com.apple.security.network.client`.

**This app's twist:** TinkerDev advertises *no network at runtime*. A developer reasoning "we're offline, we don't need network entitlements" will omit `network.client` and brick the store build. The entitlement is **not** about the app's features — it's about the webview IPC itself. It is mandatory regardless of the offline ethos.

**How to avoid:**
Store-only `entitlements.appstore.plist` with BOTH `com.apple.security.app-sandbox` and `com.apple.security.network.client` set true from the very first sandbox build. Keep the CSP `connect-src` minimal for the store variant (`'self' ipc: http://ipc.localhost`) — drop `https://github.com`/`objects.githubusercontent.com` (those exist today in `tauri.conf.json` line 26 only for the updater, which is compiled out).

**Warning signs:**
Blank/white window on the *signed* `.app` while `tauri dev` is fine. `log stream --predicate 'sender == "sandboxd"'` shows a denied network connection to `ipc.localhost`.

**Verification on the built .app:**
`codesign -d --entitlements - --xml /path/TinkerDev.app | plutil -p -` and confirm both keys present. Then **launch the signed sandboxed `.app` (not dev)** and confirm the webview renders — this is a mandatory human-walkthrough step; no unit/WebDriver gate can catch it.

**Phase to address:** The sandbox-enablement phase (earliest sandbox spike), BEFORE any StoreKit work — a white screen blocks everything downstream.

---

### Pitfall 2: The Keygen license surface survives into the store build → 3.1.1 guaranteed rejection (SHIP-GATE)

**What goes wrong:**
The store build ships with the existing "I have a license key" reveal, the key input field, `license.tinkerdev.io` activation calls, the hardcoded `$9 · once · lifetime license` text, and/or the `BUY_LICENSE_URL` external "Buy license" button. Any ONE of these = an automatic 3.1.1 rejection.

**Why it happens:**
These surfaces exist and are *wired into the same shared `ActivationSurface`/License pane the store build reuses* (Phase 22.1: the standalone modal was removed and everything routes through one inline surface). A feature flag that *hides* the form is not enough — guideline 3.1.1 (current text, verified 2026-06-22) bans "their own mechanisms to unlock content or functionality, such as **license keys**…", and the macOS corollary reviewers apply bans presenting a license screen / requiring keys ([App Review Guidelines 3.1.1](https://developer.apple.com/app-store/review/guidelines/); reviewers reject on the *presence* of a key field, not just its use — [nextnative 2025 rejection guide](https://nextnative.dev/blog/app-store-review-guidelines)).

**This app's twist:** the central gate is shared between channels by design (both resolve to the same `pro.*` map). The danger is that only the *gate* forks while the *activation UI* and the `license.tinkerdev.io` reqwest calls and the `tauri-plugin-opener` `BUY_LICENSE_URL` are merely conditionally rendered — still present in the bundle, still discoverable. The US-storefront external-link loophole (post-*Epic*, [9to5Mac 2025-05-01](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/)) does NOT save you: it's US-only, splits the funnel, and contradicts the locked StoreKit-only decision.

**How to avoid:**
Compile the entire Keygen surface OUT via the Vite `VITE_CHANNEL=appstore` define so it is **tree-shaken**, not conditionally rendered. The store License pane is a distinct variant showing only: Pro/not-Pro status, a Buy button (StoreKit `Product.purchase()`), Restore, and the **StoreKit-localized `Product.displayPrice`** — never `$9`. On the Rust side, gate the `reqwest`/Keygen license commands behind `#[cfg(not(feature="appstore"))]` so `license.tinkerdev.io` calls don't even compile in.

**Warning signs:**
`grep -r "license.tinkerdev.io\|BUY_LICENSE_URL\|I have a license key\|\$9" dist/` returns hits after a store build. Any string of the key form in the store bundle.

**Verification on the built .app:**
`grep -rl "tinkerdev.io/buy\|license.tinkerdev.io\|license key" TinkerDev.app/Contents/Resources/` must be EMPTY for the store build. `strings TinkerDev.app/Contents/MacOS/TinkerDev | grep -i keygen` empty.

**Phase to address:** The build-variant + license-pane-variant phase (ship-gate item; must be auditable in CI before submission).

---

### Pitfall 3: Updater + autostart plugins hidden but still linked → 2.4.5 / sandbox rejection (SHIP-GATE)

**What goes wrong:**
The store build still contains `tauri-plugin-updater` (a self-updater — Apple forbids it, the store delivers updates) and/or `tauri-plugin-autostart` (which writes a per-user **LaunchAgent plist** — not sandbox-safe and auto-launch without consent violates guidelines). The Updates pane's Check/Install is merely greyed out, not removed.

**Why it happens:**
Today BOTH plugins are unconditionally declared in `Cargo.toml` (lines 111 `tauri-plugin-updater`, 118 `tauri-plugin-autostart`) and unconditionally registered, and `tauri.ts` unconditionally imports `check`, `relaunch`, `enable/disable/isEnabled`, plus the `updater` plugin block sits in `tauri.conf.json` (lines 48-55) with live GitHub endpoints. A common mistake is hiding the *UI* (the Updates pane, the autostart toggle) while the *plugin code + entitlements/endpoints* still ship — Apple inspects the binary, not just the screens. Self-updating is rejected (guideline 2.4.5 / 2.5.x; [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)).

**This app's twist:** the relaunch backend (`tauri-plugin-process`) is *also* part of the updater apply flow; in the store build the updater is gone, but `process` may still be needed elsewhere — audit which capability survives. `tauri.conf.json`'s `createUpdaterArtifacts: true` + `bundle.targets: ["app","dmg"]` must both flip in the store config (`["app"]`, no updater artifacts).

**How to avoid:**
Gate plugin *registration* in `lib.rs` behind the `appstore` cargo feature — register updater/autostart only `#[cfg(not(feature="appstore"))]`. This is the **proven idiom already in this repo**: the `webdriver` feature gates `tauri-plugin-webdriver` so a release build excludes the crate entirely (`cargo tree --release | grep webdriver` = 0). Mirror it. Note the explicit warning already documented in `Cargo.toml` (lines 26-35): `[target.'cfg(debug_assertions)'.dependencies]` does NOT exclude a dep — only a **feature flag** does. The store config (`tauri.appstore.conf.json`) removes the `updater` plugin block and sets `createUpdaterArtifacts:false`, `targets:["app"]`.

**Warning signs:**
`cargo tree --features appstore | grep -E 'updater|autostart'` returns rows. The Updates pane renders (even disabled). `otool`/`strings` finds updater endpoints in the store `.app`.

**Verification on the built .app:**
`cargo tree --no-default-features --features appstore | grep -E 'tauri-plugin-(updater|autostart)'` MUST be empty. `strings TinkerDev.app/Contents/MacOS/TinkerDev | grep -E 'github.com/bklim5/devtools-releases|latest.json|LaunchAgents'` empty. `codesign -d --entitlements -` shows no updater-related keys. Confirm no `~/Library/LaunchAgents/com.tinkerdev.*.plist` is created after launching the store build.

**Phase to address:** Build-variant phase (the same feature seam that handles Pitfall 2).

---

### Pitfall 4: IAP not actually testable by the reviewer → 2.1 App Completeness rejection (SHIP-GATE)

**What goes wrong:**
The reviewer opens the app, tries to buy Pro, and the purchase sheet never appears / shows no products / fails — or there's no Restore button — so the IAP is "non-functional" and rejected under 2.1. This is the single largest rejection bucket: **40%+ of all rejections are guideline 2.1 (App Completeness)** ([nextnative 2025](https://nextnative.dev/blog/app-store-review-guidelines)).

**Why it happens (the full checklist of independent causes — any one fails review):**
1. **Paid Applications Agreement not active.** Without the Account Holder accepting it in App Store Connect, IAPs *don't work in Apple's sandbox at all* — the reviewer cannot complete the purchase ([RevenueCat App Store rejections](https://www.revenuecat.com/docs/test-and-launch/app-store-rejections)).
2. **Product not in "Ready to Submit" status** → products are **not returned** to the reviewer's StoreKit query, so the buy button shows nothing ([IAPHUB rejection troubleshooting](https://www.iaphub.com/docs/troubleshooting/app-store-rejections/)).
3. **First IAP not attached to the binary** in the same submission (the first IAP MUST be submitted with the app build).
4. **Incomplete App Store Connect business setup** (bank/tax/agreements) → `Product.products(for:)` returns an empty array even though the product looks configured; one dev found it started working ~2h after completing the Business page ([Apple forum thread 808757](https://developer.apple.com/forums/thread/808757)).
5. **No Restore Purchases affordance** — mandatory for non-consumables; a frequent rejection cause ([guideline 3.1.1](https://developer.apple.com/app-store/review/guidelines/); [Apphud restore guide](https://apphud.com/blog/restoring-purchases)).
6. **No Notes-for-Review** telling the reviewer how to reach/test Pro → reviewer can't exercise gated features (2.3.1 + Apple "describe with specificity" rule).

**This app's twist:** Pro gates only theming + ordering/pinning + ⌘K — *subtle* features a reviewer may not notice are gated. The existing `dev_set_license_state` e2e seam is **release-stripped**, so the reviewer has no backdoor; they must complete a real sandbox purchase. The Notes-for-Review must spell out exactly: "Pro unlocks the Appearance pane (custom accent), tool reorder/pin, and the ⌘K palette. To test: Settings ▸ License ▸ Buy (sandbox), then change the accent in Settings ▸ Appearance."

**How to avoid:**
A pre-submission checklist phase that verifies all 6 causes. Restore Purchases lives in Settings ▸ License (where Activate/Deactivate live today). Notes-for-Review template written and committed.

**Warning signs:**
The IAP shows "Missing Metadata" / "Developer Action Needed" (not "Ready to Submit") in App Store Connect. Buy button shows no price. No Restore button in the store pane.

**Verification:**
Human walkthrough with a **Sandbox tester account** (App Store Connect ▸ Users and Access ▸ Sandbox) on the signed `.app`: buy → Pro unlocks → quit/relaunch → still Pro → Restore on a fresh container → Pro returns. **WebDriver cannot do this** (see Pitfall 15).

**Phase to address:** Submission-readiness phase (final ship-gate), with the IAP-in-ASC work done early enough that products reach "Ready to Submit".

---

### Pitfall 5: Keychain `errSecMissingEntitlement` under sandbox — but does ANY Keychain use even remain? (HIGH)

**What goes wrong:**
A sandboxed app calls the Keychain (via the `keyring` crate, `apple-native`) and gets **-34018 errSecMissingEntitlement** at runtime — invisible to unit tests and WebDriver, surfacing only on the signed sandboxed build. The Keychain query fails because securityd checks `keychain-access-groups` + `application-identifier`, which only exist when the provisioning profile injects them ([errSecMissingEntitlement docs](https://developer.apple.com/documentation/security/errsecmissingentitlement); [Apple forum 114456](https://developer.apple.com/forums/thread/114456) — "-34018 = trying to use a keychain access group for which it does not have entitlements"; [keychain-access-groups entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/keychain-access-groups)).

**The key question for THIS app — flag it explicitly:** the store build compiles OUT the Keygen license stack, and the Keygen license **key in the Keychain is the only documented Keychain consumer** (`keyring` crate, `apple-native`, holding the raw license key per the v1.6 decision). **If the store build truly compiles out all Keygen/license code, NO Keychain access should remain** — StoreKit entitlements live in Apple's own store, not the app Keychain. So the correct outcome is: **`keyring` is gated OUT of the `appstore` cargo build entirely**, and the `keychain-access-groups`/`application-identifier` entitlements + a provisioning-profile Keychain-Sharing capability are then **NOT needed**.

The pitfall is the *mismatch*: shipping the `keyring` dependency (and its runtime call) but forgetting the entitlements → MissingEntitlement crash; OR adding the keychain entitlements speculatively when no Keychain code remains → App Review flags an unjustified entitlement.

**Why it happens:**
`keyring` is declared unconditionally in `Cargo.toml` (line 53, `features=["apple-native"]`). Unless it's moved behind `#[cfg(not(feature="appstore"))]`, the store build links it and any surviving call path hits securityd without the access group.

**How to avoid:**
Gate `keyring` (and the whole license-core Rust module) behind the non-appstore feature. Audit for ANY residual Keychain call in the store build. If — and ONLY if — a Keychain use genuinely remains, then add `keychain-access-groups` + `application-identifier` to the store entitlements AND ensure the provisioning profile carries Keychain Sharing with the hardcoded `$TEAM_ID.com.tinkerdev.app` group (not a wildcard, to avoid signing-time expansion — [Apple forum 655285](https://developer.apple.com/forums/thread/655285)).

**Warning signs:**
`cargo tree --features appstore | grep keyring` returns a row. Runtime `-34018` in `log stream` from the signed build. Or App Review flags "entitlements not used by the app".

**Verification on the built .app:**
`cargo tree --no-default-features --features appstore | grep keyring` empty (preferred outcome). `codesign -d --entitlements -` shows NO `keychain-access-groups` if no Keychain code remains. If Keychain *is* used, run the signed sandboxed `.app` and confirm the write/read succeeds (human walkthrough — invisible to unit + WebDriver).

**Phase to address:** Build-variant phase + sandbox-enablement phase (the audit of "what native deps does the store build still link").

---

### Pitfall 6: No `Transaction.updates` listener → a refunded/revoked user keeps Pro forever (HIGH)

**What goes wrong:**
The app reads `Transaction.currentEntitlements` once at launch and never listens for changes. A user buys Pro, gets a refund, but keeps all Pro features because the app never learns the entitlement was revoked while running (and even on next launch, if the revocation is only delivered via the updates stream).

**Why it happens:**
`currentEntitlements` answers "what does the user have right now?" and **excludes refunded/revoked products** — but only the long-lived `Transaction.updates` listener catches a refund/revoke that arrives **while the app is alive** or via background sync. The classic bug is "apps add product IDs locally and never remove them after a refund/revoke/upgrade" ([The Swift Dev: currentEntitlements vs updates](https://www.theswift.dev/posts/storekit-current-entitlements-vs-updates/); [WWDC by Sundell, StoreKit 2](https://wwdcbysundell.com/2021/working-with-in-app-purchases-in-storekit2/)). The fix-pattern: the updates listener calls `finish()` then **rebuilds the entitlement set from `currentEntitlements`'s current answer** rather than merging into the old value — so a refund actually drops Pro.

**This app's twist:** the live-drop machinery already exists — Phase 21's `refreshEntitlements()` live-flip and the calm "Pro features turned off" drop-notice card in `LicenseSettings`. The store build must wire `Transaction.updates` → `refreshEntitlements()` (re-read `currentEntitlements` → recompute `isPro` → same `pro.*` map → central gate). It must be a **single app-lifetime task started at boot**, like the existing `useUpdater` singleton consumed in `App.tsx` — NOT a per-component listener.

**How to avoid:**
Start the `Transaction.updates` listener once at app boot (in the native StoreKit bridge / a single platform-seam subscription). On each emission: verify, `finish()`, then **re-derive** `isPro` from `currentEntitlements` (rebuild, never merge). On revocation, route through the existing drop-notice path (D-44 calm tone).

**Warning signs:**
Pro stays on after an App Store Connect-issued refund in sandbox. The entitlement set only ever grows.

**Verification:**
Human walkthrough: sandbox-buy → refund via App Store Connect / sandbox tooling → confirm Pro drops (live if running, or on next launch). **WebDriver cannot drive this.**

**Phase to address:** StoreKit integration phase (the entitlement-sync wiring).

---

### Pitfall 7: `currentEntitlements` empty in the App Review sandbox — "works on my machine" (HIGH)

**What goes wrong:**
On the developer's machine Pro buys and restores fine, but in App Review the reviewer's first-launch `currentEntitlements` (or `Product.products(for:)`) comes back **empty**, so either no products show or a restored purchase doesn't appear → 2.1 rejection that's hard to reproduce.

**Why it happens:**
`Transaction.all`/`currentEntitlements` read a **local cache StoreKit builds by syncing with Apple's servers**; if that sync has never completed for the reviewer's sandbox Apple ID on their device, both streams come back empty even when the entitlement exists server-side ([Apple forum 823454, 2026](https://developer.apple.com/forums/thread/823454); [Apple forum 808757](https://developer.apple.com/forums/thread/808757)). Products can also be empty if the App Store Connect business/agreement setup isn't fully propagated (overlaps Pitfall 4).

**This app's twist:** the offline ethos must NOT extend to "skip `AppStore.sync()`". The fix is to gate `AppStore.sync()` behind the explicit **Restore Purchases** button (calling it silently at launch prompts an Apple-ID password sheet, violating the app's no-surprise-prompts ethos). Launch-time Pro reads from `currentEntitlements` (no auth); Restore forces the sync.

**How to avoid:**
Restore = `AppStore.sync()` then re-read `currentEntitlements` (never replay `Transaction.all` manually — over-engineered and itself can return empty). Fail closed and calm when entitlements are empty (free tier), never a crash. Notes-for-Review tells the reviewer to press Restore if Pro doesn't appear.

**Warning signs:**
First-launch entitlement read empty on a fresh sandbox account; product list empty until business setup propagates (~hours).

**Verification:**
Human walkthrough on a **fresh** sandbox tester (clean container) — not the dev's already-synced account. Restore brings Pro back.

**Phase to address:** StoreKit integration + submission-readiness phases.

---

### Pitfall 8: Build-variant drift — a flag hides UI but the forbidden plugin/entitlement still ships (HIGH)

**What goes wrong:**
The two build configs silently diverge: a Vite flag hides the updater pane while `Cargo.toml`/`lib.rs` still link the updater plugin; or the store entitlements file has `app-sandbox` but a later edit to the *direct* entitlements file isn't mirrored; or `minimumSystemVersion`/`createUpdaterArtifacts` is set in one config and not the other. The webview "looks compliant" but the binary isn't.

**Why it happens:**
Three independent layers must switch together (Tauri config via `--config tauri.appstore.conf.json`, Rust via `--features appstore`, webview via `VITE_CHANNEL`). A change to one layer that isn't reflected in the others is invisible until a binary inspection or a rejection. There is no compiler that enforces "if `VITE_CHANNEL=appstore` then the updater crate is absent" — they're decoupled.

**How to avoid:**
A **single canonical variant entry point** (one build script / Makefile target per channel) that sets all three flags together — never invoke `tauri build` with a partial combination. Add a CI/gate assertion script run on the built `.app` that asserts the invariants per channel (see the verification commands across Pitfalls 1-3, 5). Make the variant difference *verifiable on the artifact*, not just on the source.

**Warning signs:**
A store build that passes the Vite-level grep but fails `cargo tree --features appstore | grep updater`. Two entitlements files edited at different times.

**Verification on the built .app:**
A committed `scripts/verify-appstore-bundle.sh` that runs: the `codesign -d --entitlements` checks (sandbox + network.client present; no keychain/updater keys unless justified), `cargo tree` plugin-absence checks, `strings`/`grep` for forbidden URLs/keys, and `bundle minimumSystemVersion == 13.0`. Run it at the gate before every submission.

**Phase to address:** Build-variant phase — the variant seam must come with its artifact-verification script as a deliverable, not an afterthought.

---

### Pitfall 9: `.unverified` transactions and un-`finish()`ed transactions mishandled (MEDIUM)

**What goes wrong:**
(a) The app grants Pro on a `.unverified` `VerificationResult` (fail-open) — a jailbroken/tampered device fakes Pro. (b) The app never calls `Transaction.finish()` — unfinished transactions **replay on every launch** and can hang or duplicate the purchase flow.

**Why it happens:**
StoreKit 2 returns `VerificationResult.verified(_)` / `.unverified(_, error)`; treating `.unverified` as entitled is a fail-open bug ([VerificationResult.unverified](https://developer.apple.com/documentation/storekit/verificationresult/unverified(_:_:))). And `finish()` is required to mark a transaction consumed; skipping it makes it reappear in `Transaction.updates`/`currentEntitlements` indefinitely ([WWDC by Sundell, StoreKit 2](https://wwdcbysundell.com/2021/working-with-in-app-purchases-in-storekit2/)).

**This app's twist:** fail-closed-on-`.unverified` mirrors the existing offline model exactly — the v1.6 Ed25519 `machine.lic` path already fails closed on a bad signature. Same discipline: `.unverified` → NOT entitled → free tier.

**How to avoid:**
Unwrap `.verified(transaction)` only; treat `.unverified` as not-entitled. Call `finish()` after the entitlement is granted/persisted. Handle `.pending` (Ask-to-Buy / SCA) as a calm "waiting for approval" state, not an error.

**Warning signs:**
Pro unlocks on a tampered build; the purchase sheet re-appears every launch.

**Verification:** Unit-test the bridge's verify/grant branch logic (the *decision* core, error-as-value). The real purchase round-trip + finish is a human walkthrough.

**Phase to address:** StoreKit integration phase.

---

### Pitfall 10: `.pkg` signed with the wrong cert / un-signed nested code → ITMS-90238 / ITMS-90296 upload bounce (MEDIUM)

**What goes wrong:**
The App Store Connect upload bounces (before review even starts) with **ITMS-90238 "Invalid Signature"** (some nested code not re-signed) or **ITMS-90296 "App sandbox not enabled"** for the main executable or an embedded helper.

**Why it happens:**
`tauri build` produces the signed `.app` but NOT an App-Store `.pkg`; you post-process with `xcrun productbuild` + a **Mac Installer Distribution** cert, and the `.app` itself must be signed with **Apple Distribution** (NOT the direct channel's Developer ID Application). Two different cert chains. ITMS-90238 happens when nested code (the webview helper, any embedded framework/Swift package from the IAP bridge) isn't individually signed inside-out; the `--deep` flag is a known foot-gun ([Apple forum 673869 ITMS-90238](https://developer.apple.com/forums/thread/673869); [Apple forum 740606](https://developer.apple.com/forums/thread/740606)). ITMS-90296 means an executable in the bundle lacks the sandbox entitlement — **every** executable including helpers must have it ([Qt forum signing/sandbox errors](https://forum.qt.io/topic/151712/)).

**This app's twist:** the IAP bridge (whether `tauri-plugin-iap`'s bundled Swift package or a `swift-rs` module) adds nested signable code that didn't exist in the direct build. The universal binary (`lipo` Intel+arm64) must be signed correctly for both slices. The direct channel's proven `build-and-publish.mjs` uses Developer ID + notarytool — the store path needs a *separate* productbuild+altool path; don't reuse the notarisation step.

**How to avoid:**
Store flow: build universal sandboxed `.app` with `APPLE_SIGNING_IDENTITY="Apple Distribution: …"` → `xcrun productbuild --sign "3rd Party Mac Developer Installer: …"` → `xcrun altool --upload-app --type macos`. Sign nested code inside-out; avoid `--deep`. Ensure the embedded provisioning profile is present at `bundle.macOS.files.embedded.provisionprofile`. NOT notarytool.

**Warning signs:**
ITMS-90238/90296/90165 (invalid provisioning profile signature) on upload. `codesign --verify --deep --strict` fails on a nested binary.

**Verification on the built .pkg/.app:**
`codesign -dv --verbose=4 TinkerDev.app` shows `Authority=Apple Distribution`. `codesign --verify --strict --verbose=2 TinkerDev.app` passes. Embedded profile present: `ls TinkerDev.app/Contents/embedded.provisionprofile`. The definitive check is a successful `altool` upload (MAS apps validate differently than Gatekeeper/spctl).

**Phase to address:** Packaging/signing phase (the productbuild+altool pipeline, analogous to but separate from the existing direct-channel publish script).

---

### Pitfall 11: minimumSystemVersion 13.0 bump leaks onto the DIRECT channel (MEDIUM)

**What goes wrong:**
Bumping `minimumSystemVersion` to 13.0 (required by `tauri-plugin-iap` and `SMAppService`) accidentally applies to the **direct** DMG build too, silently dropping every direct-channel user on macOS 10.15-12.x.

**Why it happens:**
`tauri.conf.json` (line 45) currently sets `minimumSystemVersion: "10.15"` as the single shared value. If the bump is made in the base config instead of the store-only `--config` override, both channels move. The store variant needs 13.0 (StoreKit 2 plugin + `SMAppService` both pin 13.0), but the direct channel can and should stay 10.15.

**How to avoid:**
Set `minimumSystemVersion: "13.0"` ONLY in `tauri.appstore.conf.json` (the RFC-7396 merge override), never in the base `tauri.conf.json`. The base keeps 10.15.

**Warning signs:**
Direct DMG's `Info.plist` `LSMinimumSystemVersion` reads 13.0. Direct-channel users on Monterey report the app won't launch.

**Verification on the built .app:**
For BOTH channels: `plutil -extract LSMinimumSystemVersion raw TinkerDev.app/Contents/Info.plist` → direct must read `10.15`, store must read `13.0`.

**Phase to address:** Build-variant phase (the per-variant config merge).

---

### Pitfall 12: SMAppService login-item register fails under sandbox / Ventura codesign bug (MEDIUM)

**What goes wrong:**
Launch-at-login silently does nothing: `SMAppService.mainApp.register()` throws `SMAppServiceErrorDomain Code=1 "Operation not permitted"`, or fails on early Ventura due to a codesigning bug.

**Why it happens:**
`SMAppService` replaces the LaunchAgent plist for sandboxed apps (macOS 13+) but registration can fail if a stale plist is already loaded by launchd, or due to binary-placement/permission conflicts ([Apple forum 707482](https://developer.apple.com/forums/thread/707482)). There's also a known Ventura **13.0.1/13.1 `registerAndReturnError` codesign bug fixed by 13.5** (STACK.md flag). And in Tauri, a silently-failing native call is "almost always a missing capability/permission" ([dev.to: Tauri sandbox permissions silently do nothing](https://dev.to/hiyoyok/tauri-sandbox-permissions-why-your-command-silently-does-nothing-hcn)).

**This app's twist:** the existing `platform.autostart` seam (`enable`/`disable`/`isEnabled`, `tauri.ts` lines 160-164) is shaped for `tauri-plugin-autostart`. Swap the *implementation* behind the `appstore` feature to `SMAppService` (Rust crate `smappservice-rs` 0.1.3, itself young — pin exactly) while keeping the seam shape and the Settings toggle unchanged. The toggle must default OFF (Apple: no auto-launch without consent).

**How to avoid:**
Use `SMAppService.mainApp` behind the feature flag; surface a calm failure (toggle reflects real `status()`, not an assumed success). Consider documenting a min-13.5 caveat if the Ventura bug surfaces. Default OFF.

**Warning signs:**
Toggle flips on in the UI but the app doesn't launch at login; `Code=1` in `log stream --predicate 'sender == "ServiceManagement"'`.

**Verification:**
Human walkthrough on the signed sandboxed `.app`: enable toggle → log out/in → app launches → `status()` reads `.enabled`. **WebDriver cannot test login items.**

**Phase to address:** Sandbox native-feature phase.

---

### Pitfall 13: Privacy nutrition label / Privacy Manifest wrong for an offline app (MEDIUM)

**What goes wrong:**
The submission's App Privacy section over-declares (claiming data collection the app doesn't do) or under-declares (omitting a required-reason API), or a missing `PrivacyInfo.xcprivacy` triggers a 5.1.x / metadata flag.

**Why it happens:**
TinkerDev is fully offline / no accounts / no telemetry, so the honest answer is **Data Not Collected** — "on-device-only data is not 'collected'" ([App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)). The mistake is either copying a generic privacy label that claims analytics, or forgetting the Privacy Manifest entirely if any required-reason API is touched (file timestamps, etc.).

**This app's twist:** StoreKit purchases are handled by Apple, not "collected" by the app — the offline ethos genuinely maps to Data Not Collected. But the IAP bridge / any Swift package may touch a required-reason API; declare it in `PrivacyInfo.xcprivacy` if so.

**How to avoid:**
App Privacy = Data Not Collected. Add `PrivacyInfo.xcprivacy` declaring no tracking and no collected data types (and any required-reason API used by the bridge). Declare `ITSAppUsesNonExemptEncryption=false` in Info.plist to skip the export-compliance prompt.

**Warning signs:**
Privacy section claims data types the app never touches; missing manifest warning at upload.

**Verification:** App Store Connect privacy form review; `PrivacyInfo.xcprivacy` present in the bundle.

**Phase to address:** Submission-readiness phase (non-code, but a deliverable).

---

### Pitfall 14: tauri-plugin-store prefs path moves under the sandbox container (LOW)

**What goes wrong:**
Under the sandbox, `tauri-plugin-store` writes `prefs.json` into `~/Library/Containers/com.tinkerdev.app/Data/…` instead of the un-sandboxed location. A direct-channel user who also installs the store build sees "empty" prefs (theme/pins/order/recents not carried over).

**Why it happens:**
The sandbox relocates the app's data container automatically; no entitlement is needed, but the path differs from the direct build. The existing store-async-init race (documented in project memory + `tauri.ts` lines 35-67) is unrelated but compounds confusion if reads happen before `initPlatform()` resolves.

**This app's twist:** licensing is StoreKit-only in-store, so there's **no `machine.lic`/license-key migration** to worry about (that path is compiled out). Only cosmetic prefs differ, and since the store is a *separate distribution channel*, non-migration is acceptable — but flag it so it isn't mistaken for a data-loss bug.

**How to avoid:**
Accept non-migration (separate channel). Keep the single-writer prefs discipline (already enforced). Confirm `prefs.json` persists correctly *inside the container* on the signed sandboxed build (the async-init race is webview-only-visible).

**Warning signs:**
"My settings vanished after switching to the App Store version" support reports.

**Verification:**
On the signed sandboxed `.app`: set theme/pins, quit, relaunch → persisted. Confirm file at `~/Library/Containers/com.tinkerdev.app/Data/Library/Application Support/…/prefs.json`.

**Phase to address:** Sandbox-enablement phase (persistence smoke-test on the real container).

---

### Pitfall 15: The harness cannot drive StoreKit purchases or the OS sandbox → false-green CI (Process, HIGH likelihood)

**What goes wrong:**
The existing real-WKWebView WebDriver e2e gate goes green, but it has tested *nothing* about the actual purchase, restore, refund-revoke, sandbox entitlements, Keychain, login items, or the `.pkg` upload — all of which only exist on the signed sandboxed build with a Sandbox tester account.

**Why it happens (structural, confirmed by this project's own learnings):**
WebDriver/automated e2e **cannot drive native-OS flows** — the StoreKit payment sheet is OS-rendered, the sandbox is a signed-build-only construct, login items require a real logout/login, and the App Store Connect business setup is external. This is the project's #1 recurring theme ("the real run catches what unit tests can't"; "automated e2e CANNOT drive native-OS input"; "a live human-gate is mandatory for irreversible/integration-bound flows" — `engineering-learnings.md`). The `dev_set_license_state` seam that made licensing e2e-testable is release-stripped, so it CANNOT substitute for a real store purchase.

**How to avoid — what MUST move to human/manual verification (ship-gate walkthrough):**
1. Launch the **signed sandboxed `.app`** (not dev) — webview renders (Pitfall 1).
2. Real sandbox-tester purchase → Pro unlocks → `finish()` (no replay on relaunch).
3. Quit/relaunch → still Pro via `currentEntitlements`.
4. **Fresh container / different sandbox account → Restore Purchases → Pro returns** (Pitfall 7).
5. App Store Connect refund/revoke → Pro drops live or next launch (Pitfall 6).
6. Launch-at-login toggle → real logout/login (Pitfall 12).
7. Global summon hotkey + tray still work under sandbox (verify the plugin uses `RegisterEventHotKey`, sandbox-safe; not `CGEventTap`).
8. Bundle-inspection script (Pitfall 8) passes for the store artifact.
9. `.pkg` uploads cleanly via `altool` (Pitfall 10).

**What stays automated:** the *decision cores* — entitlement-resolution logic, `.verified`/`.unverified` branch, the `pro.*` map mapping, the variant-flag resolver — as pure error-as-value functions unit-tested in isolation (mirroring the existing license-core TDD). The native bridge is a thin shell; keep it logic-free.

**Immovable bars that must hold:** `decoder.ts` + its **19 tests untouched** (no licensing/IAP change touches the hero); the direct channel must not regress (build + smoke-test BOTH channels at the gate; verify the direct DMG still notarises and `minimumSystemVersion` stays 10.15 — Pitfall 11).

**Warning signs:**
A PR that adds StoreKit but only adds WebDriver e2e "coverage" with no human-walkthrough checklist item. A green gate with no Sandbox-tester sign-off.

**Phase to address:** EVERY StoreKit/sandbox phase boundary — add the relevant human-walkthrough items to the phase's Definition of Done; the final ship-gate runs the full list above.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Conditionally *render* the Keygen/updater UI instead of tree-shaking/feature-gating it | Less plumbing; one codebase | The forbidden code/strings/endpoints still ship in the binary → 3.1.1/2.4.5 rejection (Pitfalls 2,3) | **Never** for store-forbidden surfaces — they must be compiled out and grep-verified |
| Set `minimumSystemVersion: 13.0` in the base config "to keep it simple" | One config | Silently drops 10.15-12.x DIRECT users (Pitfall 11) | **Never** — use the per-variant `--config` override |
| Skip `Transaction.updates`, read `currentEntitlements` only at launch | Simpler; works in happy-path testing | Refunded users keep Pro; revocations never propagate (Pitfall 6) | **Never** for a paid non-consumable |
| Add `keychain-access-groups` entitlements "to be safe" | Avoids a possible MissingEntitlement | App Review flags unjustified entitlements if no Keychain code remains (Pitfall 5) | Only if a Keychain consumer genuinely survives in the store build |
| Reuse the direct channel's Developer-ID + notarytool publish script for the store | One pipeline | Wrong cert chain → ITMS upload bounce (Pitfall 10) | **Never** — store needs Apple Distribution + Mac Installer Distribution + altool |
| Rely on WebDriver e2e to "cover" the IAP flow | Fits the existing gate | False-green; nothing about the real purchase/sandbox is tested (Pitfall 15) | **Never** — IAP/sandbox/login-items are human-walkthrough only |
| Hardcode `$9` in the store pane (copy the existing UpsellPanel text) | Reuse pitch copy | Wrong abroad, contradicts ASC pricing → 2.3 metadata rejection (Pitfall 2) | **Never** — render `Product.displayPrice` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| App Sandbox ↔ Tauri WKWebView | Omitting `network.client` because "the app is offline" | Always include `network.client` — it's for the IPC channel, not features (Pitfall 1) |
| App Sandbox ↔ `keyring`/Keychain | Shipping `keyring` without (or with mis-scoped) keychain-access-groups | Gate `keyring` OUT of the store build entirely; only add the entitlement if a Keychain consumer survives (Pitfall 5) |
| StoreKit ↔ App Review sandbox | Testing only on a dev account already synced | Test on a FRESH Sandbox tester; gate `AppStore.sync()` behind Restore (Pitfall 7) |
| StoreKit ↔ App Store Connect | First IAP not attached to the binary / not "Ready to Submit" / Paid-Apps Agreement inactive | Attach the IAP to the build; verify "Ready to Submit"; accept the agreement before submitting (Pitfall 4) |
| autostart ↔ Sandbox | Keeping `tauri-plugin-autostart` (LaunchAgent plist) | Migrate to `SMAppService.mainApp` behind the feature flag; default OFF (Pitfall 12) |
| productbuild ↔ universal binary | `--deep` signing; reusing notarytool | Sign nested code inside-out; Apple Distribution + Mac Installer Distribution + altool, no notarytool (Pitfall 10) |
| global-shortcut ↔ Sandbox | Assuming the summon hotkey breaks under sandbox | `RegisterEventHotKey` (what the plugin uses) is sandbox-safe, zero entitlements — verify in spike; keep ⌘/⌃ in the chord (macOS-15 anti-keylogger drops Shift/Option-only) |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Granting Pro on `.unverified` `VerificationResult` | Tampered/jailbroken device fakes Pro | Unwrap `.verified` only; `.unverified` → free tier (fail closed, mirrors Ed25519 model) (Pitfall 9) |
| Speculative entitlements (`files.user-selected`, `network.server`, `device.*`, `print`) | App Review rejects unjustified entitlements; widens attack surface | Only `app-sandbox` + `network.client` (+ app-id/team, and keychain group ONLY if used) |
| Server-side receipt-validation infra "for security" | Reintroduces the network dependency the app avoids; new availability/attack surface for a $9 perpetual unlock | On-device JWS verify via `VerificationResult` (serverless, per locked decision) |
| Forbidden URLs/keys left in the store bundle | 3.1.1 rejection AND information leak (internal endpoints in a public binary) | Tree-shake + grep-verify the store `.app` has no `license.tinkerdev.io`/key strings (Pitfall 2) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| A license/paywall screen at launch | Violates the macOS 3.1.1 corollary; free tier is the whole point | App boots fully usable (free); Pro is an optional unlock in Settings ▸ License (unchanged) |
| Silent `AppStore.sync()` at launch | Surprise Apple-ID password sheet on every launch | Gate sync behind the explicit Restore button (Pitfall 7) |
| `.pending` (Ask-to-Buy/SCA) shown as an error | Confuses a user whose purchase needs approval | Calm "waiting for approval" state (reuse the existing calm-tone error model) |
| Hardcoded `$9` in a non-US storefront | Wrong/contradictory price | `Product.displayPrice` everywhere (Pitfall 2) |
| Revocation drops Pro with a harsh error | Refunded user feels punished | Reuse the existing calm "Pro features turned off" drop-notice card (D-44) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Sandbox build:** renders the webview on the SIGNED `.app` (not just `tauri dev`) — verify `network.client` present + launch (Pitfall 1)
- [ ] **Store license pane:** NO key field, NO external buy link, NO literal `$9` — `grep` the store bundle clean (Pitfall 2)
- [ ] **Updater/autostart:** absent from the binary, not just hidden — `cargo tree --features appstore` shows neither plugin (Pitfall 3)
- [ ] **IAP:** product "Ready to Submit", attached to binary, Paid-Apps Agreement active, Restore present, Notes-for-Review written (Pitfall 4)
- [ ] **Keychain:** `keyring` gated out of the store build (or entitlement justified) — `cargo tree --features appstore | grep keyring` (Pitfall 5)
- [ ] **Refund handling:** `Transaction.updates` listener wired to the live-drop path (Pitfall 6)
- [ ] **Restore:** brings Pro back on a FRESH sandbox account (Pitfall 7)
- [ ] **Variant invariants:** `scripts/verify-appstore-bundle.sh` passes on the artifact (Pitfall 8)
- [ ] **Verify/finish:** `.unverified` → free; `Transaction.finish()` called (no replay) (Pitfall 9)
- [ ] **Signing:** `.app` = Apple Distribution, `.pkg` = Mac Installer Distribution, embedded profile present, `.pkg` uploads via altool (Pitfall 10)
- [ ] **Min-version:** direct=10.15, store=13.0 in each `Info.plist` (Pitfall 11)
- [ ] **Login item:** SMAppService register succeeds + survives logout/login (Pitfall 12)
- [ ] **Privacy:** Data Not Collected + `PrivacyInfo.xcprivacy` + `ITSAppUsesNonExemptEncryption` (Pitfall 13)
- [ ] **Direct channel un-regressed:** DMG still notarises, decoder + 19 tests untouched (Pitfall 15)

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| White-screen (no network.client) (1) | LOW | Add the entitlement, rebuild, re-verify on the signed `.app` |
| 3.1.1 rejection (license surface) (2) | MEDIUM | Tree-shake the surface, grep-verify, resubmit (each round-trip ~24-48h review) |
| 2.1 IAP-not-testable (4) | MEDIUM-HIGH | Fix ASC setup (agreement/Ready-to-Submit), add Restore + Notes, resubmit; ASC propagation can take hours |
| Refunded user kept Pro (6) | MEDIUM | Ship the `Transaction.updates` listener in a patch; existing users self-correct on next sync |
| ITMS upload bounce (10) | LOW-MEDIUM | Re-sign nested code inside-out with the right certs; re-run productbuild/altool (no review wait — pre-review) |
| Direct channel regressed (11/15) | HIGH | Revert the leaked config change; re-notarise; the direct channel is the proven revenue path — protect it |

---

## Pitfall-to-Phase Mapping

(Phase numbering continues from Phase 25; v1.8 starts at Phase 26. Names are indicative for the roadmapper.)

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 network.client white-screen | Sandbox-enablement spike (earliest) | `codesign -d --entitlements` + launch signed `.app` (human) |
| 2 license surface → 3.1.1 | Build-variant + store license pane | `grep` store bundle clean; CI gate |
| 3 updater/autostart linked | Build-variant | `cargo tree --features appstore`; `strings` bundle |
| 4 IAP not testable → 2.1 | Submission-readiness (ship-gate) | Sandbox-tester walkthrough (human) |
| 5 Keychain MissingEntitlement | Build-variant + sandbox | `cargo tree --features appstore` grep keyring; signed-build run |
| 6 missing updates listener | StoreKit integration | refund→drop walkthrough (human) |
| 7 currentEntitlements empty | StoreKit integration + submission | fresh-sandbox Restore walkthrough (human) |
| 8 variant drift | Build-variant (deliver the verify script) | `scripts/verify-appstore-bundle.sh` on artifact |
| 9 .unverified/finish | StoreKit integration | unit-test decision core; purchase walkthrough |
| 10 .pkg signing | Packaging/signing | `codesign --verify --strict`; altool upload |
| 11 min-version leak | Build-variant | `plutil` Info.plist both channels |
| 12 SMAppService | Sandbox native-feature | logout/login walkthrough (human) |
| 13 privacy label | Submission-readiness | ASC form + manifest in bundle |
| 14 prefs container path | Sandbox-enablement | persistence smoke-test in container |
| 15 harness can't drive IAP | EVERY StoreKit/sandbox phase boundary | human-walkthrough checklist in each DoD |

**Spike-first flag (highest-risk dependency):** the native StoreKit bridge (`tauri-plugin-iap` 0.9.0, a 72★ single-maintainer plugin, or a `swift-rs` hand-roll) must be spiked behind `src/lib/platform/` BEFORE any UI work — confirm it (a) compiles into the universal sandboxed build, (b) does on-device `currentEntitlements` JWS verify with no server, (c) maps to a `platform.iap` seam. If it fails, fall back to `swift-rs`. This is the critical-path long pole and gates Pitfalls 6/7/9.

---

## Sources

- [App Review Guidelines — Apple](https://developer.apple.com/app-store/review/guidelines/) — 3.1.1 (license keys banned, Restore mandatory, US external-link exception), 2.1, 2.3, 2.3.1, 2.4.5; verified 2026-06-22 (HIGH)
- [App Store Review Guidelines (2025): Checklist + Top Rejection Reasons — nextnative](https://nextnative.dev/blog/app-store-review-guidelines) — "40%+ of rejections are 2.1 App Completeness"; key-field presence rejection (MEDIUM, corroborates Apple)
- [tauri-docs #3171 — mandatory network.client entitlement](https://github.com/tauri-apps/tauri-docs/issues/3171) and [tauri #13878, 2025-07-23 — production network blocked, dev fine](https://github.com/tauri-apps/tauri/issues/13878) — sandbox white-screen / network block (HIGH)
- [The Swift Dev — currentEntitlements vs updates](https://www.theswift.dev/posts/storekit-current-entitlements-vs-updates/) and [WWDC by Sundell — StoreKit 2 (2021)](https://wwdcbysundell.com/2021/working-with-in-app-purchases-in-storekit2/) — updates listener, finish(), rebuild-not-merge (HIGH)
- [Transaction.currentEntitlements — Apple](https://developer.apple.com/documentation/storekit/transaction/currententitlements) and [VerificationResult.unverified — Apple](https://developer.apple.com/documentation/storekit/verificationresult/unverified(_:_:)) — refunded/revoked excluded; fail-closed (HIGH)
- [Apple forum 823454 (2026) — Transaction.all/currentEntitlements empty until sync](https://developer.apple.com/forums/thread/823454) and [Apple forum 808757 — 0 products until Business setup](https://developer.apple.com/forums/thread/808757) — empty-in-review traps (MEDIUM)
- [RevenueCat — App Store rejections](https://www.revenuecat.com/docs/test-and-launch/app-store-rejections) and [IAPHUB — App Store rejection troubleshooting](https://www.iaphub.com/docs/troubleshooting/app-store-rejections/) — Paid-Apps Agreement, Ready-to-Submit, Restore, IAP-not-returned (HIGH)
- [Apphud — Restoring purchases](https://apphud.com/blog/restoring-purchases) — Restore mandatory + placement (MEDIUM)
- [errSecMissingEntitlement — Apple](https://developer.apple.com/documentation/security/errsecmissingentitlement), [Apple forum 114456 — -34018](https://developer.apple.com/forums/thread/114456), [keychain-access-groups entitlement — Apple](https://developer.apple.com/documentation/bundleresources/entitlements/keychain-access-groups), [Apple forum 655285 — hardcode Team ID](https://developer.apple.com/forums/thread/655285) — Keychain under sandbox (HIGH)
- [Apple forum 673869 — ITMS-90238 Invalid Signature](https://developer.apple.com/forums/thread/673869), [Apple forum 740606 — signing/sandbox upload errors](https://developer.apple.com/forums/thread/740606), [Qt forum — signing/sandbox errors (ITMS-90296 sandbox-not-enabled)](https://forum.qt.io/topic/151712/) — .pkg/upload bounces (MEDIUM)
- [Apple forum 707482 — SMAppService recover from Operation not permitted](https://developer.apple.com/forums/thread/707482) and [dev.to — Tauri sandbox permissions silently do nothing](https://dev.to/hiyoyok/tauri-sandbox-permissions-why-your-command-silently-does-nothing-hcn) — SMAppService / silent native failures (MEDIUM)
- [App Privacy Details — Apple](https://developer.apple.com/app-store/app-privacy-details/) — Data Not Collected for offline apps (HIGH)
- [9to5Mac 2025-05-01 — external-link guideline update post-Epic](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/) — US-storefront loophole (explicitly rejected option) (MEDIUM)
- Sibling research: `.planning/research/STACK.md`, `.planning/research/FEATURES.md` (2026-06-22) — minimumSystemVersion 13.0, build-variant mechanism, native-feature sandbox compatibility, StoreKit bridge maturity flag
- In-repo (HIGH, primary): `src-tauri/tauri.conf.json` (updater block, targets, min-version 10.15, CSP line 26), `src-tauri/Cargo.toml` (keyring 53, updater 111, autostart 118, webdriver feature-gate idiom 26-94), `src/lib/platform/tauri.ts` (license/updater/autostart/opener seams that must branch), `~/.claude/engineering-learnings.md` (harness-can't-drive-native, build-last, single-writer prefs)

---
*Pitfalls research for: v1.8 "Mac App Store Distribution" (TinkerDev)*
*Researched: 2026-06-22*
