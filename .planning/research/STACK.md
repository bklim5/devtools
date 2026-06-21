# Stack Research

**Domain:** v1.8 "Mac App Store Distribution" — adding a sandboxed Mac App Store target (StoreKit IAP) to an existing Tauri 2 + Vite + React + TS macOS app
**Researched:** 2026-06-22
**Confidence:** HIGH on versions/availability and Apple requirements (Apple docs + Tauri 2 docs + crate registries); MEDIUM on the StoreKit-bridge *integration* path (no first-class Tauri StoreKit plugin — the leading option is a 72-star community plugin, maturity-flagged below).

---

## TL;DR for the roadmapper

1. **There IS a community Tauri 2 IAP plugin** (`tauri-plugin-iap`, v0.9.0, May 2026) that wraps StoreKit 2 on macOS via a bundled Swift package. It is the fastest path but it is a **72-star single-maintainer plugin** — treat it as a *spike candidate*, not a locked dependency. The fallback is a thin hand-rolled Swift bridge via `swift-rs` (1.0.7, mature).
2. **minimumSystemVersion MUST bump 10.15 → 13.0** for the App Store variant. Two independent forces require macOS 13: (a) `tauri-plugin-iap` declares `macOS 13.0+`, and (b) the sandbox-safe login item (`SMAppService`) is macOS 13.0+ only. The *direct* variant can stay 10.15. This is a **per-variant** minimum (the `--config` merge sets it for the store build only).
3. **App Sandbox is mandatory** and forces: `com.apple.security.app-sandbox`, `com.apple.security.network.client` (or the licensing network calls AND the webview die with a white screen), and Keychain works **only** via the provisioning-profile-injected `application-identifier` + `keychain-access-groups`. The autostart LaunchAgent plist is NOT sandbox-safe → replace with `SMAppService` (Rust crate `smappservice-rs` 0.1.3, or a tiny objc2 call).
4. **Build-variant mechanism is idiomatic Tauri 2**: a `tauri.appstore.conf.json` merged via `tauri build --config` (RFC 7396 JSON Merge Patch) for config, plus a Cargo feature (`appstore`) gating plugin registration in `lib.rs`, plus a Vite `define`/`import.meta.env` flag for the webview UI compile-out. One variant axis, three layers.
5. **`tauri build` does NOT produce an App Store `.pkg`** — it produces the signed `.app`; you post-process with `xcrun productbuild` (Mac Installer Distribution cert) then upload via `xcrun altool`/Transporter. The DMG + updater artifacts are compiled OUT.

---

## Recommended Stack

### Core Technologies (additions for the App Store variant)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **StoreKit 2** (Apple framework) | macOS 12.0+ API; **plugin pins 13.0+** | On-device IAP: fetch product, purchase, `Transaction.currentEntitlements`, automatic JWS verification | The async/await `Transaction`/`Product`/`VerificationResult` API (WWDC21) is the modern path; **JWS signature verification is built in** (`VerificationResult.verified`/`.unverified`), which directly mirrors the existing offline Ed25519 Rust-verify model — no server needed. (Apple docs; WWDCNotes) |
| **`tauri-plugin-iap`** (Choochmeque) | **0.9.0** (2026-05-05) | StoreKit 2 bridge for Tauri 2 macOS+iOS: `getProducts`, `purchase`, `restorePurchases`, `getProductStatus`, `onPurchaseUpdated` | The only existing Tauri **v2** StoreKit-2-on-macOS plugin. Bundles a Swift package (37.5% Swift), does native JWS verification, exposes a JS API that drops straight behind the `platform/` seam. **Maturity flag: 72★, single maintainer, 498 commits / 9 releases.** Spike first per the 999.10 decision. (GitHub) |
| **App Sandbox** (`com.apple.security.app-sandbox`) | — | Mandatory container for App Store distribution | Apple requires it for all Mac App Store apps; without it the submission is rejected. (Tauri App Store docs; Apple) |
| **`SMAppService`** (ServiceManagement framework) | **macOS 13.0+** | Sandbox-safe launch-at-login replacing the autostart LaunchAgent plist | The LaunchAgent-plist write done by `tauri-plugin-autostart` is **not** sandbox-safe; `SMAppService.mainApp` is Apple's sanctioned replacement and works inside the sandbox. (Apple ServiceManagement; theevilbit blog) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **`smappservice-rs`** | **0.1.3** | Rust wrapper over `SMAppService` (`MainApp` register/unregister/status, `open_system_settings_login_items`) | If you want launch-at-login in **Rust** without writing Swift/objc2 by hand. Deps: `objc2 ^0.6.1`, `objc2-foundation ^0.3.1`, `objc2-service-management ^0.3.1`. **Maturity flag: 0.1.x, young** — wraps a stable Apple API, but pin exactly and validate on the real build. (docs.rs/crates.io) |
| **`objc2-service-management`** | **^0.3.1** | Raw `SMAppService` bindings (what `smappservice-rs` wraps) | If `smappservice-rs` proves too thin/buggy, call `SMAppService` directly via objc2. Already battle-tested objc2 family. |
| **`swift-rs`** | **1.0.7** | Build-time linker + FFI to call a hand-written Swift StoreKit module from Rust | **Fallback if `tauri-plugin-iap` is rejected in the spike.** `SwiftLinker` in `build.rs` links the Swift runtime + your package; min macOS 10.13; mature stable 1.x. This is the DIY StoreKit-bridge path. (GitHub/crates.io) |
| **`objc2-store-kit`** | objc2 family (~0.3.x) | Pure-Rust StoreKit bindings | Only if you want StoreKit driven entirely from Rust with **no Swift at all**. Viable but StoreKit 2's async/await + `AsyncSequence` (`currentEntitlements`) is awkward from Rust — Swift is the natural language for StoreKit 2. Prefer the plugin or `swift-rs`. |

### Development / Toolchain Tools (no new runtime deps — these are CLI/build)

| Tool | Purpose | Notes |
|------|---------|-------|
| `xcrun productbuild` | Wrap the signed `.app` into a distributable `.pkg` | `--sign "3rd Party Mac Developer Installer: …"` (Mac Installer Distribution cert). Tauri does NOT do this step. |
| `xcrun altool --upload-app --type macos` | Upload the `.pkg` to App Store Connect | Auth via App Store Connect API key (`--apiKey`/`--apiIssuer`). Alternative: **Transporter.app** (GUI). |
| `codesign` (via `APPLE_SIGNING_IDENTITY`) | Sign the `.app` with **Apple Distribution** (NOT Developer ID) | The store build uses an **Apple Distribution** cert; the direct build uses **Developer ID Application**. Two different certs/identities per variant. |
| Apple **Distribution** cert + **Mac Installer Distribution** cert + **provisioning profile** | App Store identity chain | Provisioning profile embedded at `bundle.macOS.files` → `embedded.provisionprofile`; it authorizes `application-identifier` + `keychain-access-groups` so the existing `keyring` Keychain access keeps working under the sandbox. |

---

## Installation

```bash
# Rust side (src-tauri/Cargo.toml) — App-Store-variant deps, behind a cargo feature
# tauri-plugin-iap: the StoreKit 2 bridge (SPIKE FIRST — maturity-flagged)
cargo add tauri-plugin-iap@0.9            # gate registration behind `appstore` feature in lib.rs

# Sandbox-safe launch-at-login (replaces tauri-plugin-autostart on the store build)
cargo add smappservice-rs@0.1.3           # or objc2-service-management directly

# FALLBACK only if the IAP plugin spike fails — hand-rolled Swift StoreKit bridge:
cargo add swift-rs@1.0.7                   # + SwiftLinker in build.rs (build feature)

# JS side — the IAP plugin's companion (if used):
pnpm add tauri-plugin-iap-api             # behind src/lib/platform/, only tauri.ts imports it
```

```toml
# Cargo.toml — gate the store-only deps so the direct build never compiles them
[features]
appstore = ["dep:tauri-plugin-iap", "dep:smappservice-rs"]

[dependencies]
tauri-plugin-iap = { version = "0.9", optional = true }
smappservice-rs = { version = "0.1.3", optional = true }
```

---

## Build-Variant Mechanism (idiomatic Tauri 2 — answers Q5)

One variant axis ("direct" vs "appstore") switches three layers together. All three are first-class Tauri 2 idioms:

**1. Tauri config — `--config` merge (RFC 7396 JSON Merge Patch).**
Keep base `tauri.conf.json` as the *direct* default (current behaviour). Add `tauri.appstore.conf.json` and build with:
```bash
tauri build --bundles app --target universal-apple-darwin \
  --config src-tauri/tauri.appstore.conf.json
```
The store-only override file sets: `bundle.targets: ["app"]` (drop `dmg`), removes/empties `createUpdaterArtifacts` + the `updater` plugin block, points `bundle.macOS.entitlements` at the sandbox entitlements file, sets `bundle.macOS.minimumSystemVersion: "13.0"`, `bundle.macOS.files.embedded.provisionprofile`, and `bundle.category`. (Tauri docs: "JSON Merge Patch (RFC 7396) … define multiple flavours of your application.")
*Note:* `tauri.macos.conf.json` auto-merges on macOS but is platform-, not variant-scoped — use an explicit `--config` file for the variant axis so the direct macOS build is unaffected.

**2. Rust — a `cargo feature` (`appstore`) + `cfg`.**
Gate plugin registration in `lib.rs`: register `tauri-plugin-updater`/`tauri-plugin-autostart` only when **not** `appstore`; register `tauri-plugin-iap` + the `SMAppService` login-item path only when `appstore`. This is the **proven idiom already in this repo** (the `webdriver` feature gates `tauri-plugin-webdriver`; `cfg(any(target_os=…))` gates the native-polish plugins). Pass `--features appstore` to the store build. (Repo precedent: `Cargo.toml` lines 92-118.)

**3. Vite/webview — `import.meta.env` / `define` compile-out.**
Define a build-time flag (e.g. `VITE_CHANNEL=appstore`) so the Keygen key-paste UI + `license.tinkerdev.io` reqwest calls + the Updates pane are tree-shaken out of the store bundle (guideline 3.1.1 compliance). The store build resolves entitlements from StoreKit instead. Both variants resolve to the **same `pro.theming`/`pro.ordering` map** consumed by the one central gate — the webview gate code does not fork. (Matches the existing `isTestOrDev()`/`import.meta.env.MODE` pattern in `platform/index.ts`.)

**Integration with the existing seam:** add a `platform.iap` capability (mirrors `platform.license`) whose real arm lives ONLY in `tauri.ts` and calls the IAP plugin; the browser/test arm is deterministic (no native call). The central entitlement resolver gains a second source (StoreKit `currentEntitlements` → `pro.*` map) selected by the channel flag. **The webview gate is untouched.**

---

## minimumSystemVersion Impact (quantified — the headline trade-off)

| API / dep | Min macOS | Source |
|-----------|-----------|--------|
| StoreKit 2 async API (`Transaction`, `Product.products`, `VerificationResult`) | **12.0** (Monterey, WWDC21) | Apple docs / WWDCNotes |
| `tauri-plugin-iap` (its Swift package / `MACOSX_DEPLOYMENT_TARGET`) | **13.0** | plugin README |
| `SMAppService` login item | **13.0** (Ventura) | Apple ServiceManagement; n8felton |
| `smappservice-rs` crate | **13.0** | crate README |
| Current app | 10.15 (Catalina) | `tauri.conf.json` |

**Verdict: the App Store variant must set `minimumSystemVersion: "13.0"`.** StoreKit 2 *itself* only needs 12.0, but the plugin's Swift back-deployment AND `SMAppService` both pin 13.0, so 13.0 is the effective floor. **This bump applies to the App Store build ONLY** — the direct DMG variant keeps 10.15 because the per-variant `--config` merge sets the minimum independently. Trade-off: Mac App Store users on 10.15–12.x are excluded from the store channel but can still use the direct DMG. Given Ventura shipped Oct 2022, the addressable-user cost in 2026 is small and the cleaner 13.0 floor removes back-deployment `@available` complexity.

**If you wanted to avoid the bump:** you'd have to (a) hand-roll the StoreKit bridge via `swift-rs` with `MACOSX_DEPLOYMENT_TARGET=12.0` AND (b) keep the old LaunchAgent autostart — but autostart's plist write is NOT sandbox-safe, so launch-at-login would have to be **dropped** on a 12.0 store build. Not worth it; **bump to 13.0**.

---

## App Sandbox — exact entitlements (answers Q2)

Create a store-only `entitlements.appstore.plist` (the direct build keeps its Developer-ID hardened-runtime `entitlements.plist`):

```xml
<key>com.apple.security.app-sandbox</key>             <true/>   <!-- MANDATORY for App Store -->
<key>com.apple.security.network.client</key>          <true/>   <!-- REQUIRED: without it the WKWebview white-screens AND StoreKit/any net call is blocked -->
<key>com.apple.application-identifier</key>            <string>$TEAM_ID.$IDENTIFIER</string>
<key>com.apple.developer.team-identifier</key>         <string>$TEAM_ID</string>
<!-- Keychain (keyring crate) under sandbox needs the access group, authorized by the provisioning profile: -->
<key>keychain-access-groups</key>
<array><string>$TEAM_ID.com.tinkerdev.app</string></array>
<!-- Only if you ever read user-chosen files (none of the six tools do today — DO NOT add speculatively): -->
<!-- <key>com.apple.security.files.user-selected.read-only</key> <true/> -->
```

**Tauri-2-specific sandbox gotchas (HIGH — all verified):**
- **`com.apple.security.network.client` is non-optional.** A sandboxed Tauri build with it missing produces a **white screen** (the WKWebview IPC over `http://ipc.localhost` is treated as network). This is the single most-reported Tauri sandbox failure. (tauri-docs #3171; tauri #13878)
- **Keychain under sandbox**: the `keyring` crate's `apple-native` store keeps working ONLY because the provisioning profile injects `application-identifier` + `keychain-access-groups`. Without the access group entitlement, securityd returns `MissingEntitlement` at runtime — invisible to unit tests, surfaces only on the signed sandboxed build. (Apple Keychain Access Groups docs)
- **Prefs/store paths**: `tauri-plugin-store` writes under the app's container (`~/Library/Containers/com.tinkerdev.app/Data/…`) automatically inside the sandbox — no entitlement needed, but the path moves vs the un-sandboxed build (existing direct-channel prefs do NOT migrate into the store container; acceptable since it's a separate distribution channel).
- **CSP `connect-src`**: the current CSP allows `https://github.com` (updater). The store build's CSP should drop those (updater compiled out) and keep only `'self' ipc: http://ipc.localhost`.

**Native-feature sandbox compatibility (the 999.10 worry list):**
- **Global summon hotkey** — `tauri-plugin-global-shortcut` uses Carbon `RegisterEventHotKey`, which **requires zero entitlements and is sandbox-compatible**. ⚠️ One macOS-15+ caveat: a hotkey using *only* Shift/Option modifiers no longer fires (anti-keylogger change); ensure the summon chord includes ⌘/⌃ (it already would). **No change needed.** (feedback-assistant #552)
- **Tray icon/menu** — native `NSStatusItem`, sandbox-safe, no entitlement. **No change needed.**
- **Single-instance** — sandbox-safe. No change.
- **Launch-at-login** — the ONLY conflict: must move from `tauri-plugin-autostart` (LaunchAgent plist) to `SMAppService` (see Q3).

---

## Sandbox-safe login item — SMAppService (answers Q3)

- **Rust crate exists**: `smappservice-rs` **0.1.3** wraps `SMAppService` (`MainApp`/`Agent`/`Daemon`/`LoginItem`, `register()`/`status()`/`open_system_settings_login_items()`), built on `objc2-service-management ^0.3.1`. You do **not** have to write Swift for this. ⚠️ It's 0.1.x — pin exactly and validate on the signed build. (crates.io/docs.rs)
- **Or call objc2 directly**: `objc2-service-management` gives raw `SMAppService.mainApp.register()` if you'd rather not depend on a 0.1.x wrapper.
- **Min macOS: 13.0 (Ventura)** for `SMAppService.mainApp` login items. (Apple docs — SMAppService introduced in Ventura to replace `SMLoginItemSetEnabled`.) This is one of the two forces behind the 13.0 floor.
- **Integration**: keep the existing `platform.autostart` seam shape (`enable`/`disable`/`isEnabled`); swap the implementation behind the `appstore` cargo feature — direct build → `tauri-plugin-autostart`; store build → `SMAppService.mainApp` register/unregister/status. The webview UI (Settings ▸ launch-at-login toggle) is unchanged. ⚠️ Known Ventura 13.0.1/13.1 codesigning bug in `registerAndReturnError` (fixed by 13.5) — document as a min-13.5 caveat if it surfaces.

---

## Build + signing toolchain for the App Store (answers Q4)

`tauri build` produces a **signed `.app`** but **NOT** an App-Store-ready `.pkg`; post-processing is required. The flow:

```bash
# 1. Build the universal sandboxed .app with the App Store config + Apple Distribution identity
APPLE_SIGNING_IDENTITY="Apple Distribution: TinkerDev (FK4HQK83WX)" \
tauri build --bundles app --target universal-apple-darwin \
  --config src-tauri/tauri.appstore.conf.json --features appstore

# 2. Wrap into a signed installer .pkg (Mac Installer Distribution cert) — Tauri does NOT do this
xcrun productbuild --sign "3rd Party Mac Developer Installer: TinkerDev (FK4HQK83WX)" \
  --component "src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app" \
  /Applications "TinkerDev.pkg"

# 3. Upload to App Store Connect (API key auth) — or use Transporter.app
xcrun altool --upload-app --type macos --file "TinkerDev.pkg" \
  --apiKey "$APPLE_API_KEY_ID" --apiIssuer "$APPLE_API_ISSUER"
```

Key points:
- **Two cert identities** vs the direct channel: store build signs the `.app` with **Apple Distribution** and the `.pkg` with **Mac Installer Distribution** (≠ the direct channel's **Developer ID Application** + notarytool). No notarization for App Store — App Review handles it.
- **Provisioning profile** must be embedded: `bundle.macOS.files` → `embedded.provisionprofile` in the store config. It authorizes the app-id + keychain-access-group entitlements.
- **`bundle.category`** must be set in the store config (App Review requires a category).
- **`Info.plist`** should declare encryption-export compliance (`ITSAppUsesNonExemptEncryption`) to skip the per-upload prompt.
- **Upload path**: `xcrun altool` (scriptable, fits the existing `build-and-publish.mjs` style) is preferred over GUI Transporter for a reproducible pipeline. `notarytool` is NOT used for the store path. (Tauri App Store docs)
- **`hardenedRuntime`**: the store build does NOT use the hardened-runtime + Developer-ID path; App Sandbox is the security model. Set sandbox entitlements in the store entitlements file, not via the direct `entitlements.plist`.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `tauri-plugin-iap` 0.9.0 (StoreKit bridge) | Hand-rolled Swift module via **`swift-rs` 1.0.7** | If the plugin spike reveals blockers (sandbox, universal-binary linking, JS-API mismatch) or you want zero third-party-plugin trust surface. More code, full control, mature linker. |
| `tauri-plugin-iap` | **`objc2-store-kit`** (pure Rust StoreKit) | If you refuse to ship any Swift. But StoreKit 2's async/`AsyncSequence` (`currentEntitlements`) is painful from Rust — not recommended. |
| `smappservice-rs` 0.1.3 | **`objc2-service-management`** direct | If you distrust a 0.1.x wrapper; call `SMAppService.mainApp.register()` yourself via objc2. |
| StoreKit on-device JWS verify (no server) | App Store Server API (server-side verify) | Only if you needed cross-device entitlement sync or subscription server notifications — you don't (one non-consumable, perpetual, on-device, mirrors the offline model). **Stay serverless per 999.10.** |
| `xcrun altool` upload | **Transporter.app** (GUI) | One-off manual submissions / when API-key CI auth isn't set up yet. |
| `--config` merge variant files | **Cargo features alone** for everything | Config (targets, entitlements, min-version) can't be expressed as Rust cfg — you need the config-file merge for the bundle layer regardless. Use both. |

---

## What NOT to Use / Add (answers Q6)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`tauri-plugin-updater` in the store build** | Apple **forbids self-updating apps** in the Mac App Store (guideline 2.4.5 / 2.5.x) — instant rejection; the store handles updates | Compile it out via the `appstore` cargo feature + drop the `updater` config block + tree-shake the Updates pane |
| **`tauri-plugin-autostart` (LaunchAgent plist) in the store build** | LaunchAgent plist write is **not sandbox-safe**; also auto-launch without consent violates guidelines | `SMAppService.mainApp` via `smappservice-rs`/`objc2-service-management`, behind the same `platform.autostart` seam |
| **Keygen key-paste UI + `license.tinkerdev.io` calls in the store build** | Guideline **3.1.1** forbids unlocking content via an external purchase/key bypassing IAP — rejection | Tree-shake them out (Vite channel flag); store build unlocks Pro via StoreKit `currentEntitlements` only |
| **DMG target / `createUpdaterArtifacts`** | App Store ships a `.pkg`, not a DMG; updater artifacts are dead weight + a 2.4.5 smell | `bundle.targets: ["app"]`; productbuild → `.pkg` |
| **Developer ID Application cert + notarytool** for the store | Wrong identity chain — App Store uses Apple Distribution + Mac Installer Distribution + App Review, not notarization | Apple Distribution + Mac Installer Distribution certs; `altool` upload |
| **Speculative sandbox entitlements** (`files.user-selected`, `network.server`, `device.*`, `print`, `bluetooth`, etc.) | App Review rejects unjustified entitlements; the six tools are pure in-webview transforms needing none | Only `app-sandbox` + `network.client` + the app-id/team/keychain-access-group set |
| **Server-side StoreKit receipt validation infra** | Unnecessary for one on-device-verified non-consumable; adds a network dependency that breaks the offline ethos | On-device `Transaction.currentEntitlements` + built-in JWS verify (serverless, per 999.10) |
| **A `RegisterEventHotKey` summon chord using only Shift/Option** | macOS 15+ silently drops Shift/Option-only global hotkeys (anti-keylogger) | Keep ⌘/⌃ in the summon chord (it already does) |
| **`minimumSystemVersion: "10.15"` on the store variant** | StoreKit-2 plugin + SMAppService both need 13.0; a 10.15 store build won't link/run | `"13.0"` on the store variant ONLY (direct stays 10.15) |

---

## Stack Patterns by Variant

**If channel = `direct` (existing, out of scope but the baseline):**
- `minimumSystemVersion: "10.15"`, Developer ID Application signing + hardened runtime + notarytool
- `tauri-plugin-updater` + `tauri-plugin-autostart` (LaunchAgent) IN
- Keygen activation UI + `license.tinkerdev.io` IN; entitlement source = Keygen `machine.lic`
- Targets: `["app", "dmg"]`, `createUpdaterArtifacts: true`

**If channel = `appstore` (this milestone):**
- `minimumSystemVersion: "13.0"`, App Sandbox, Apple Distribution + Mac Installer Distribution, provisioning profile embedded
- Updater + autostart-LaunchAgent **OUT**; `SMAppService` login item + `tauri-plugin-iap` IN
- Keygen UI + license.tinkerdev.io **compiled out**; entitlement source = StoreKit `currentEntitlements` → same `pro.*` map
- Targets: `["app"]` → `productbuild` `.pkg` → `altool` upload
- Selected by: `--config tauri.appstore.conf.json --features appstore` + `VITE_CHANNEL=appstore`

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `tauri-plugin-iap@0.9` | Tauri 2.x, macOS 13.0+ | Set `MACOSX_DEPLOYMENT_TARGET="13.0"` or the Swift package fails to load (`dyld`/library-load error documented in README) |
| `smappservice-rs@0.1.3` | `objc2 ^0.6.1`, `objc2-foundation ^0.3.1`, `objc2-service-management ^0.3.1`, macOS 13.0+ | objc2 0.6 family — check it doesn't clash with any objc2 already pulled transitively by `keyring`'s `apple-native` (likely fine; both modern objc2) |
| `swift-rs@1.0.7` (fallback) | macOS 10.13+, build.rs `SwiftLinker` | Relies on the ObjC runtime for FFI; macOS/iOS only (not Linux) — fine, store target is macOS |
| StoreKit 2 async API | macOS **12.0**+ | But the plugin's floor (13.0) governs |
| App Sandbox + `keyring@3.6 apple-native` | Works under sandbox **iff** `keychain-access-groups` + `application-identifier` granted by provisioning profile | Verify on the SIGNED sandboxed build — `MissingEntitlement` is runtime-only, invisible to unit/WebDriver gates |
| `tauri-plugin-global-shortcut@2.3.2` | App Sandbox (zero entitlements) | Sandbox-safe; mind the macOS-15 Shift/Option-only restriction |

---

## Open Questions / Spike Flags for the roadmapper

- **SPIKE `tauri-plugin-iap` 0.9.0 FIRST** (per 999.10): verify it (a) compiles into the universal sandboxed build, (b) its `getProductStatus`/`onPurchaseUpdated` surface maps cleanly to a `platform.iap` seam, (c) does on-device `currentEntitlements` JWS verify with no server. If any fails → fall back to `swift-rs` hand-rolled bridge. **This is the milestone's highest-risk dependency.**
- **`smappservice-rs` 0.1.x maturity** — validate register/unregister/status on the signed build; have the `objc2-service-management`-direct fallback ready. Watch the Ventura 13.0.1/13.1 codesign bug (min-13.5 caveat).
- **objc2 version coexistence** — confirm `smappservice-rs`'s objc2 0.6 tree doesn't conflict with `keyring@3.6 apple-native`'s objc dependencies at link time.
- **Provisioning-profile + keychain-access-group** must be validated on the real signed `.pkg` (not unit tests) — `MissingEntitlement` for `keyring` is the classic sandbox surprise.
- **StoreKit sandbox testing** — needs App Store Connect sandbox tester accounts + a `.storekit` config file for local `tauri dev` (no real charges); the human-gate walkthrough must cover the real purchase round-trip (mirrors the existing live-purchase ship-gate discipline).

---

## Sources

- [Tauri — Distribute to the App Store](https://v2.tauri.app/distribute/app-store/) — App Sandbox entitlements, `productbuild`/`altool` flow, build command (HIGH)
- [Tauri — macOS Application Bundle](https://v2.tauri.app/distribute/macos-application-bundle/) — `bundle.macOS` config keys: entitlements, files.embedded.provisionprofile, minimumSystemVersion, category (HIGH)
- [Tauri — Configuration Files](https://v2.tauri.app/develop/configuration-files/) — `--config` RFC 7396 JSON Merge Patch, platform-specific config files (HIGH)
- [GitHub — Choochmeque/tauri-plugin-iap](https://github.com/Choochmeque/tauri-plugin-iap) — v0.9.0 (2026-05-05), Swift bridge, macOS 13.0+, JWS verify, APIs, 72★ maturity (MEDIUM — community plugin)
- [Apple — Transaction.currentEntitlements](https://developer.apple.com/documentation/storekit/transaction/currententitlements) — currentEntitlements semantics (HIGH for API; page badges not machine-readable via fetch)
- [Apple — Transaction (StoreKit 2)](https://developer.apple.com/documentation/storekit/transaction) — StoreKit 2 base API (macOS 12.0 per WWDC21) (HIGH)
- [WWDCNotes — Meet StoreKit 2 (WWDC21)](https://wwdcnotes.com/documentation/wwdcnotes/wwdc21-10114-meet-storekit-2/) — async API, built-in JWS verify, iOS15/macOS12 introduction (MEDIUM, corroborates Apple)
- [GitHub — gethopp/smappservice-rs](https://github.com/gethopp/smappservice-rs) + [crates.io](https://crates.io/crates/smappservice-rs) + [docs.rs](https://docs.rs/smappservice-rs/latest/smappservice_rs/) — v0.1.3, objc2 deps, MainApp/register/status APIs (HIGH for version/deps)
- [theevilbit — SMAppService quick notes](https://theevilbit.github.io/posts/smappservice/) — SMAppService introduced Ventura 13, replaces SMLoginItemSetEnabled (MEDIUM)
- [GitHub — Brendonovich/swift-rs](https://github.com/Brendonovich/swift-rs) + [crates.io](https://crates.io/crates/swift-rs) — v1.0.7, SwiftLinker, macOS 10.13+, mature (HIGH)
- [tauri-docs #3171 — mandatory network.client entitlement](https://github.com/tauri-apps/tauri-docs/issues/3171) + [tauri #13878](https://github.com/tauri-apps/tauri/issues/13878) — sandbox white-screen without network.client (HIGH, multiple corroborating reports)
- [Apple — Keychain Access Groups entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/keychain-access-groups) + [Sharing keychain items](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps) — keychain under sandbox needs access-group authorized by profile (HIGH)
- [Apple — App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — 2.4.5 (no self-updating), 3.1.1 (IAP only) (HIGH)
- [feedback-assistant #552](https://github.com/feedback-assistant/reports/issues/552) — macOS 15 Shift/Option-only global hotkey restriction (MEDIUM)
- Repo precedent: `src-tauri/Cargo.toml` (existing `webdriver` feature gate + `cfg(any(target_os=…))` native-plugin gating) and `src/lib/platform/index.ts` (`import.meta.env.MODE` channel pattern) (HIGH — in-repo)

---
*Stack research for: v1.8 "Mac App Store Distribution"*
*Researched: 2026-06-22*
