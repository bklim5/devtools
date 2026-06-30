# Architecture Research

**Domain:** v1.8 "Mac App Store Distribution" — integrating a sandboxed Mac App Store build VARIANT (StoreKit IAP + App Sandbox + SMAppService, updater compiled out) into the existing shipped Tauri 2 + Vite + React + TS macOS app (TinkerDev)
**Researched:** 2026-06-22
**Confidence:** HIGH on the in-repo integration points (every seam cited from real code below); HIGH on the Tauri 2 `--config` / cargo-feature idiom (confirmed against current Tauri docs + the repo's own `webdriver` precedent); MEDIUM on the StoreKit-bridge internals (spike-gated, per STACK.md).

> This file is INTEGRATION-first. Every seam, command, and component below is grounded in the actual codebase (file:line). The StoreKit-bridge *internals* are deliberately under-specified — STACK.md flags `tauri-plugin-iap@0.9` as a spike candidate; this file specifies the *seam shape* the bridge must satisfy, which is fixed regardless of which bridge wins the spike.

---

## TL;DR for the roadmapper

1. **The variant seam is a SINGLE axis with THREE synchronized layers**, every one of which already has an in-repo precedent: (a) a Rust **cargo feature `appstore`** gating plugin registration in `lib.rs` (mirrors the existing `webdriver` feature, `Cargo.toml:36,92-94` + `lib.rs:308-309`); (b) a **`tauri.appstore.conf.json` `--config` overlay** (RFC-7396 merge — Tauri's documented "multiple flavours" mechanism; the repo has no overlay file yet, so this is NEW but idiomatic); (c) a **Vite `VITE_CHANNEL` define** for the webview compile-out (mirrors the existing `import.meta.env` channel pattern in `platform/index.ts:256` and `browser.ts:128`).
2. **The entitlement-source swap is a ONE-BRANCH change to ONE function.** `resolveEntitlements()` (`src/lib/entitlements/resolve.ts:51`) is *already* the single environment-split point. The store variant adds a second branch that fills the SAME `pro.*` map from StoreKit `currentEntitlements` instead of `platform.license.status()`. **The central gate, `useEntitlements`, `gatePreferences`, `isPro`, the registry, and every consumer are byte-unchanged.** This is the key reuse and it already exists.
3. **The StoreKit bridge mirrors `platform.license` EXACTLY** — a new `platform.iap` capability (`index.ts` interface + getter), real arm in `tauri.ts` (the only file importing `@tauri-apps/*`), deterministic no-op arm in `browser.ts`/`stub.ts`. New Rust commands (`iap_products`, `iap_purchase`, `iap_restore`, `iap_current_entitlements`) registered in `lib.rs` alongside the license commands, plus a `storekit://updated` event mirroring the `menu://*` event channel.
4. **`platform.autostart` swaps its implementation behind the feature flag** — `tauri.ts:160-164` keeps the LaunchAgent plugin for `direct`; a new `#[cfg(feature="appstore")]` Rust path uses `SMAppService`. The `{enable,disable,isEnabled}` seam interface is **unchanged** (the General-pane toggle never knows).
5. **The updater compiles out via the same flag, no component fork.** The Rust plugin registration becomes `#[cfg(not(feature="appstore"))]`; the Updates pane drops out of `SETTINGS_PANES` (`settingsPanes.tsx:57-64`) by a `VITE_CHANNEL` filter; `App.tsx`'s `useUpdater` consumption is guarded so the launch auto-check + tray listener don't wire up.
6. **Build order is dependency-forced: the bridge spike is the critical-path first phase (Phase 26).** Nothing store-side compiles or renders without it. Then the variant seam (27), then the License-pane branch + entitlement-source swap (28), then SMAppService + sandbox feature audit (29), then the `.pkg`/submission pipeline (30). Decoder.ts + its 19 tests are untouched throughout (no path below reaches `src/lib/decoder.ts`).

---

## Standard Architecture — the integration map

### System Overview (where the variant axis cuts)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WEBVIEW (React/TS) — branches on import.meta.env.VITE_CHANNEL only         │
│  ┌────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ Sidebar /  │ │ ToolRoute    │ │ Appearance / │ │ License pane:      │  │
│  │ ⌘K palette │ │ gate         │ │ Ordering     │ │ direct → Keygen    │  │
│  │            │ │              │ │ (gated prefs)│ │ store  → StoreKit  │  │
│  └─────┬──────┘ └──────┬───────┘ └──────┬───────┘ └─────────┬──────────┘  │
│        └───────────────┴── useEntitlements() ───────────────┘  (UNCHANGED) │
│                              │                                              │
│                  resolveEntitlements()  ◄── THE single source-swap point    │
│              (resolve.ts:51 — adds a StoreKit branch; pro.* map identical)  │
├──────────────────────────────────────────────────────────────────────────┤
│  PLATFORM SEAM (src/lib/platform/) — tauri.ts is the ONLY @tauri-apps door  │
│  license  autostart  updater  opener  app  clipboard  store  ... + iap(NEW) │
│        direct arm ──┐         ┌── store arm (no-op updater/opener;          │
│        (tauri.ts)   │         │     real iap; SMAppService autostart)        │
├─────────────────────┴─────────┴────────────────────────────────────────────┤
│  RUST (src-tauri) — branches on #[cfg(feature="appstore")]                   │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ license      │ │ updater       │ │ autostart     │ │ iap (NEW)         │  │
│  │ commands     │ │ #[cfg(not     │ │ LaunchAgent   │ │ #[cfg(appstore)]  │  │
│  │ (compiled-in │ │  appstore)]   │ │ vs SMAppService│ │ StoreKit bridge   │  │
│  │  both builds)│ │               │ │ (cfg-swapped) │ │ (plugin/swift-rs) │  │
│  └──────────────┘ └───────────────┘ └──────────────┘ └───────────────────┘  │
├──────────────────────────────────────────────────────────────────────────┤
│  CONFIG (tauri.conf.json ⊕ tauri.appstore.conf.json via --config RFC-7396)  │
│  sandbox entitlements · minSysVer 13.0 · targets ["app"] · no updater block │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (NEW / MODIFIED / UNCHANGED)

| Component | Status | Responsibility | File (integration point) |
|-----------|--------|----------------|---------------------------|
| `appstore` cargo feature | **NEW** | Gates Rust plugin registration + which native modules compile | `src-tauri/Cargo.toml` `[features]` (beside `webdriver`, lines 92-94) |
| `tauri.appstore.conf.json` | **NEW** | RFC-7396 overlay: sandbox entitlements, minSysVer 13.0, `targets:["app"]`, drop updater block + endpoints, drop `createUpdaterArtifacts`, store CSP | `src-tauri/` (no overlay exists yet) |
| `VITE_CHANNEL` build flag | **NEW** | Webview compile-out switch (`"direct"`\|`"appstore"`) | injected via `vite build` env / `define`; read like `import.meta.env` at `platform/index.ts:256` |
| `platform.iap` capability | **NEW** | StoreKit products/purchase/restore/currentEntitlements + updates event, behind the seam | `index.ts` interface + getter (mirror `license`, lines 126-144 / 213-215); real arm `tauri.ts`; no-op arm `browser.ts`/`stub.ts` |
| Rust `iap` commands + module | **NEW** | `iap_products`/`iap_purchase`/`iap_restore`/`iap_current_entitlements`; emit `storekit://updated` | `src-tauri/src/iap/` (new module), registered in `lib.rs:326-343` under `#[cfg(feature="appstore")]` |
| `SMAppService` autostart arm | **NEW** | Sandbox-safe login item for the store build | `lib.rs:75-78` (cfg-swap the plugin); Rust impl via `smappservice-rs` (STACK.md) |
| `resolveEntitlements()` | **MODIFIED** | Add a StoreKit source branch (channel-selected); fills the SAME `EntitlementSet` | `src/lib/entitlements/resolve.ts:51-75` |
| `LicenseSettings` pane | **MODIFIED (branched)** | Store variant renders status + Buy(`displayPrice`) + **Restore**; Keygen activation/`$9`/key-field/`BUY_LICENSE_URL` compiled out | `src/components/LicenseSettings.tsx` (+ a new `StoreLicenseSettings.tsx`) |
| `settingsPanes.tsx` | **MODIFIED** | Filter the Updates pane out when `VITE_CHANNEL==="appstore"`; License pane render() picks the variant | `src/components/settingsPanes.tsx:38-71` |
| `platform.autostart` (seam) | **UNCHANGED interface** | `{enable,disable,isEnabled}` — only the Rust impl behind it swaps | `index.ts:154-158`, `tauri.ts:160-164` |
| `useEntitlements` / `isPro` / `gatePreferences` / central gate | **UNCHANGED** | Same `pro.theming`/`pro.ordering` map, same predicates | `useEntitlements.ts:12`, `entitlements.ts:41,46,52` |
| Rust `license` commands | **UNCHANGED (compiled into both builds)** | Keygen path stays compiled; the store webview simply never CALLS it (3.1.1 compliance is a webview compile-out, not a Rust removal) | `license/commands.rs` (see note below) |
| `decoder.ts` + 19 tests | **UNTOUCHED** | Hero feature spec — no path here reaches it | `src/lib/decoder.ts` |

---

## Q1 — The build-variant seam (the single axis, three synchronized layers)

The locked decision: **ONE seam switches THREE things together** — (1) updater in/out, (2) entitlement source Keygen↔StoreKit, (3) sandbox flags. The repo already proves the pattern with its `webdriver` feature; the variant axis is the same idiom applied to a second concern.

### Layer A — Rust cargo feature `appstore` (precedent: `webdriver`)

`Cargo.toml` already has the exact shape to copy (`Cargo.toml:36,92-94`):

```toml
[features]
webdriver = ["dep:tauri-plugin-webdriver"]
appstore  = ["dep:tauri-plugin-iap", "dep:smappservice-rs"]   # NEW

[dependencies]
tauri-plugin-iap = { version = "0.9", optional = true }       # NEW (spike-gated)
smappservice-rs  = { version = "0.1.3", optional = true }     # NEW
```

Registration in `lib.rs` is cfg-gated exactly like the webdriver plugin (`lib.rs:308-309`):

```rust
// Updater: compiled in only for the direct build (Q5). Was lib.rs:88-90.
#[cfg(all(desktop, not(feature = "appstore")))]
app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

// Autostart: LaunchAgent (direct) vs SMAppService (store) — Q4. Was lib.rs:75-78.
#[cfg(not(feature = "appstore"))]
let builder = builder.plugin(tauri_plugin_autostart::init(/* … */));
#[cfg(feature = "appstore")]
let builder = builder.plugin(/* SMAppService init */);

// IAP: store build only.
#[cfg(feature = "appstore")]
let builder = builder.plugin(tauri_plugin_iap::init());
```

The command handler list (`lib.rs:326-343`) gains the IAP commands under `#[cfg(feature="appstore")]`. **Precedent note:** `lib.rs:325-343` already duplicates `generate_handler!` across two `cfg` arms (debug adds `dev_set_license_state`) — the comment at `lib.rs:322-324` documents that `generate_handler!` is a single fixed list that "can't be conditionally extended mid-chain." The store build adds a THIRD dimension; the cleanest structure is a small helper that conditionally appends, or accept the 2×2 arm duplication the repo already tolerates. **Flag this for the roadmapper as a known ergonomic wart, not a blocker.**

### Layer B — `tauri.appstore.conf.json` (`--config` RFC-7396 overlay)

Confirmed current Tauri 2 mechanism: `tauri build --config src-tauri/tauri.appstore.conf.json` deep-merges via RFC-7396 ("multiple flavours of your application" — Tauri configuration-files docs, fetched 2026-06-22). The overlay states only the DELTAS from `tauri.conf.json` (the direct default, `tauri.conf.json:1-56`):

```jsonc
{
  "bundle": {
    "targets": ["app"],                              // was ["app","dmg"]  (tauri.conf.json:31)
    "createUpdaterArtifacts": false,                 // was true           (line 32)
    "macOS": {
      "entitlements": "entitlements.appstore.plist", // sandbox (was entitlements.plist, line 44)
      "minimumSystemVersion": "13.0",                // was "10.15"        (line 45)
      "hardenedRuntime": false,                       // App Sandbox ≠ hardened-runtime (was true, line 43)
      "files": { "embedded.provisionprofile": "embedded.provisionprofile" }
    }
  },
  "plugins": { "updater": null },                    // remove the whole updater block (lines 48-55)
  "app": { "security": { "csp": "default-src 'self'; img-src 'self' asset: data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost" } }
  // ^ drops the github.com endpoints (line 26) — updater compiled out
}
```

**NEW sibling files:** `entitlements.appstore.plist` (sandbox + network.client + keychain-access-group; exact keys in STACK.md), `embedded.provisionprofile`.

### Layer C — Vite `VITE_CHANNEL` webview compile-out

The repo already reads `import.meta.env` for env branching (`platform/index.ts:253-257` `isTestOrDev()`; `browser.ts:128` `VITE_APP_VERSION`). Add a defined constant so dead branches tree-shake:

```ts
// e.g. a tiny src/lib/channel.ts
export const CHANNEL = import.meta.env.VITE_CHANNEL ?? "direct";   // "direct" | "appstore"
export const IS_APPSTORE = CHANNEL === "appstore";
```

A static `IS_APPSTORE` constant lets Vite tree-shake the Keygen activation surface, the `BUY_LICENSE_URL` open path, the `$9` literal, and the Updates pane out of the store bundle (3.1.1 compliance — the key field must be ABSENT, not merely hidden).

### How the three stay in sync — the developer-facing build commands

The risk with a 3-layer axis is drift (e.g. `--features appstore` without `VITE_CHANNEL=appstore`). **Bind them in `package.json` scripts so a variant is one command** (the repo already binds a feature flag in `tauri:dev:e2e`, `package.json:21`):

```jsonc
{
  "scripts": {
    "tauri:build": "tauri build",                                   // direct (unchanged default)
    "tauri:build:appstore": "VITE_CHANNEL=appstore tauri build --features appstore --config src-tauri/tauri.appstore.conf.json --target universal-apple-darwin --bundles app",
    "tauri:dev:appstore":   "VITE_CHANNEL=appstore tauri dev --features appstore --config src-tauri/tauri.appstore.conf.json"
  }
}
```

`beforeBuildCommand` (`tauri.conf.json:9`) runs `pnpm build` → `vite build`; `VITE_CHANNEL` is inherited by that subprocess, so the single env var on the `tauri build` invocation flows into the webview build. **One env var + one feature flag + one `--config` file, bound in one script = the three layers can't drift.** The `.pkg`/`altool` post-processing (STACK.md Q4) appends to this script or lives in a `release:appstore.mjs` mirroring `build-and-publish.mjs`.

---

## Q2 — The entitlement-source abstraction (the source swaps; the gate does not)

This is the cleanest part of the whole milestone because the seam **already exists**. `resolveEntitlements()` is documented in-code as "THE single resolution point… Flip HERE and nowhere else" (`resolve.ts:35-50`).

### Today's flow (UNCHANGED below the resolver)

```
resolveEntitlements()                         resolve.ts:51
  → platform.license.status()  (Keygen)       resolve.ts:66
  → baseFromLicense() → EntitlementSet         resolve.ts:26-33  (intersect with ALL_ENTITLEMENTS)
  → refreshEntitlements() folds in override    store.ts:64
  → useEntitlements() snapshot                 useEntitlements.ts:12
  → isToolLocked / isPro / gatePreferences     entitlements.ts:41,46,52
  → Sidebar, ⌘K, ToolRoute, useAppearance      (all consume the hook)
```

### The store-variant change — ONE new branch in resolve.ts

```ts
// resolve.ts (MODIFIED) — add, do not replace:
export async function resolveEntitlements(): Promise<EntitlementSet> {
  if (isTauriEnv()) await initPlatform();
  const base = !isTauriEnv()
    ? FREE_SET
    : IS_APPSTORE
      ? baseFromStoreKit(await platform.iap.currentEntitlements())   // NEW
      : baseFromLicense(await platform.license.status());            // resolve.ts:66, unchanged
  // …prefs override logic below is byte-identical (resolve.ts:68-74)
}

// NEW, mirrors baseFromLicense (resolve.ts:26-33): same intersect-with-ALL_ENTITLEMENTS
// over-grant guard (T-21-12) — a forged/unexpected code can never unlock more than the
// two defined entitlements.
function baseFromStoreKit(ents: readonly string[]): EntitlementSet {
  return new Set(ents.filter((e) => ALL_ENTITLEMENTS.includes(e)));
}
```

The store bridge maps a verified non-consumable `Transaction` → the `["pro.theming","pro.ordering"]` array (the full Pro set, granted together — matching the Keygen model where `isPro` = "has any", `entitlements.ts:41-43`). So `baseFromStoreKit` receives the same vocabulary `baseFromLicense` does. **`FULL_SET`, `FREE_SET`, `ALL_ENTITLEMENTS`, `gatePreferences`, `isToolLocked`, `isPro`, `useEntitlements`, the `store.ts` snapshot mechanism, and `refreshEntitlements()` are all unchanged.**

### New platform-seam methods (named) + Rust commands (named)

| Seam method (`platform.iap.*`) | Rust command | Mirrors (existing) |
|--------------------------------|--------------|--------------------|
| `products()` → `IapProduct[]` (id, `displayPrice`, displayName) | `iap_products` | `license.status` payload-contract shape |
| `purchase(productId)` → `IapPurchaseResult` (`success`/`userCancelled`/`pending`) | `iap_purchase` | `license.activate` (mutation that re-resolves), `commands.rs:54-59` |
| `restore()` → re-reads entitlements (`AppStore.sync()`) | `iap_restore` | `license.refresh`, `commands.rs:63-67` |
| `currentEntitlements()` → `string[]` of granted codes | `iap_current_entitlements` | `license.status` (pure read, no auth prompt), `commands.rs:31-35` |
| `onPurchaseUpdated(handler)` → unsubscribe fn | `storekit://updated` event (emit from a Rust `Transaction.updates` task) | `events.onMenuCheckUpdates` (`index.ts:112`, `tauri.ts:128-129`) |

### The refresh/updates flow reuse

`refreshEntitlements()` (`store.ts:64`) is the existing live-flip mechanism. The store variant wires `platform.iap.onPurchaseUpdated(() => refreshEntitlements())` at boot (an `App.tsx` effect mirroring the `onMenuCheckUpdates` effect at `App.tsx:97-117`). A refund/revocation arriving on `Transaction.updates` → `currentEntitlements` drops the code → `resolveEntitlements` returns `FREE_SET` → the existing `setsEqual` diff (`store.ts:71`) notifies → Pro drops live, and the existing "Pro features turned off" drop-notice (`LicenseSettings.tsx:243-265`, driven by `licenseDropNoticeAck`) is reused. **No new live-flip machinery.**

---

## Q3 — StoreKit bridge placement (mirror `platform.license` / `platform.autostart` exactly)

The bridge slots into the established seam with zero structural novelty.

**`index.ts` (MODIFIED — add to the `Platform` interface, beside `license` at lines 126-144):**

```ts
iap: {
  products(): Promise<IapProduct[]>;
  purchase(productId: string): Promise<IapPurchaseResult>;
  restore(): Promise<void>;
  currentEntitlements(): Promise<string[]>;
  onPurchaseUpdated(handler: () => void): Promise<() => void>;
};
```

…plus a getter in the `platform` proxy (beside `get license()` at `index.ts:213-215`):

```ts
get iap() { return active.iap; },
```

**`tauri.ts` (MODIFIED — the ONLY file importing `@tauri-apps/*`, lines 1-2):** the real arm calls the IAP plugin's JS API (or `invoke("iap_purchase", …)` if hand-rolled via swift-rs), exactly as `license` does `invoke<LicenseStatusPayload>("activate_license", …)` (`tauri.ts:146`), and subscribes to `storekit://updated` via `listen(...)` exactly as `onMenuCheckUpdates` does (`tauri.ts:128-129`).

**`browser.ts` + `stub.ts` (MODIFIED — deterministic no-op arm):** mirror `createLicenseStub()` (`stub.ts:33-49`) — `products()` resolves `[]`, `purchase()`/`restore()` reject `{ code: "serviceUnreachable" }` or resolve a deterministic stub, `currentEntitlements()` resolves `[]`, `onPurchaseUpdated()` returns a no-op unsubscribe. This keeps **unit tests + `vite dev` + jsdom running with no native call** (the whole reason the seam exists, `index.ts:1-9`), and lets `setPlatformForTest` (`index.ts:264`) inject a stub IAP arm just as it does for license today.

**Critical constraint preserved:** no `@tauri-apps/*` or StoreKit symbol ever appears outside `tauri.ts`; the webview gate code never sees a Tauri type (a `LicenseStatusPayload`-style serde-pinned mirror, `index.ts:46-63`, is the only contract crossing). This is the FND-04 seam discipline the codebase enforces everywhere.

---

## Q4 — SMAppService swap (same `{enable,disable,isEnabled}` interface)

`platform.autostart` today (`index.ts:154-158`, `tauri.ts:160-164`) wraps `@tauri-apps/plugin-autostart` (LaunchAgent plist — NOT sandbox-safe). The swap is **implementation-only**; the seam interface and the General-pane toggle are untouched.

- **Rust side (`lib.rs:75-78`):** cfg-swap the plugin init. `#[cfg(not(feature="appstore"))]` → `tauri_plugin_autostart::init(...)` (unchanged). `#[cfg(feature="appstore")]` → register a small SMAppService-backed plugin/command set using `smappservice-rs` (STACK.md: `SMAppService.mainApp` register/unregister/status, macOS 13+).
- **Seam (`tauri.ts:160-164`):** if the store build keeps the same JS API surface (the autostart plugin exposes `enable/disable/isEnabled`), the seam wrapper is unchanged. If SMAppService is driven via custom Rust commands instead, the store arm calls `invoke("autostart_enable")` etc. — still behind the identical `platform.autostart` interface. **The webview never knows which path ran.**
- **General pane toggle:** unchanged (default OFF per Apple — "may not auto-launch without consent"; the toggle already exists and is OFF by default).

**Compatibility note (STACK.md):** SMAppService forces minSysVer 13.0 (one of the two forces behind the bump). The direct build keeps 10.15 + LaunchAgent because the `--config` overlay sets the minimum per-variant.

---

## Q5 — Updater compile-out (no component fork)

Three touch-points, each excluded/inert by the variant flag:

1. **Rust plugin (`lib.rs:88-90`):** gate the `tauri_plugin_updater` registration `#[cfg(all(desktop, not(feature="appstore")))]`. The `tauri-plugin-process` relaunch dep (`Cargo.toml:42`) can stay compiled (harmless) or also gate out. The `updater` config block + endpoints + `createUpdaterArtifacts` drop via the `--config` overlay (Q1 Layer B). The tray "Check for Updates…" item (`lib.rs:247-248,270-272`) gates out under `#[cfg(not(feature="appstore"))]`.
2. **Updates pane (`settingsPanes.tsx:57-64`):** the pane registry is "extensible… derive 1:1 from this array" (`settingsPanes.tsx:1-5`). Filter it:
   ```ts
   export const SETTINGS_PANES: SettingsPane[] = [
     /* general, hotkeys, appearance */
     ...(IS_APPSTORE ? [] : [{ id: "updates", label: "Updates", icon: RefreshCw, render: () => <UpdatesSettings /> }]),
     /* license */
   ];
   ```
   The SettingsModal derives nav + content from the array, so removing the entry removes the pane with **no SettingsModal change** (the whole point of the registry).
3. **`App.tsx` `useUpdater` consumption (`App.tsx:68-117`):** the launch auto-check (`App.tsx:87-93`) and the tray `menu://check-updates` listener (`App.tsx:97-117`) should be skipped in the store build (guard with `!IS_APPSTORE`). **Safety net already present:** the browser-stub updater no-ops (`browser.ts:82-87`) and `check()`→null, so even an unguarded path makes no network call — but the store build also has no updater plugin and no tray item, so the cleanest move is to not wire the effects at all when `IS_APPSTORE`. `useUpdater` itself (the singleton) need not fork — it just goes unused.

`UpdatesSettings` and `UpdateBanner` are **not deleted or forked** — they simply never mount in the store build (tree-shaken via the registry filter + the `App.tsx` guard).

---

## Note on the Keygen Rust core (3.1.1 is a webview compile-out, not a Rust removal)

The `license` Rust commands (`license/commands.rs`, registered `lib.rs:326-343`) and the `LicenseManager`/Keychain/Keygen-client modules can stay **compiled into both builds** — Apple's 3.1.1 prohibition is about the *user-facing* unlock mechanism (the key-paste UI + `license.tinkerdev.io` calls), which lives in the WEBVIEW. The store webview simply never imports/calls them (the `LicenseSettings` store variant renders `StoreLicenseSettings` instead, and `resolveEntitlements` takes the StoreKit branch).

**Recommendation:** for defense-in-depth and a smaller/cleaner store binary, ALSO gate the `reqwest` Keygen client + the activation commands `#[cfg(not(feature="appstore"))]` so the store build carries no `license.tinkerdev.io` transport at all — but this is an optimization, not a correctness requirement, and it complicates the `generate_handler!` arm duplication (`lib.rs:322-343`). **Roadmapper decision point: minimal (webview-only compile-out) vs defense-in-depth (also Rust-gate the Keygen transport).** The minimal path is lower-risk for v1.8. The `keyring` Keychain dep stays regardless (the seam contract); under sandbox it needs the keychain-access-group entitlement (STACK.md) — though if Keygen is webview-compiled-out the store build may not USE the Keychain at all, making that entitlement optional. Verify in the spike.

---

## Recommended Project Structure (NEW vs MODIFIED inventory)

```
src-tauri/
├── Cargo.toml                         # MODIFIED: add `appstore` feature + iap/smappservice deps
├── tauri.conf.json                    # UNCHANGED (the direct default)
├── tauri.appstore.conf.json           # NEW: RFC-7396 overlay (sandbox, 13.0, app-only, no updater)
├── entitlements.appstore.plist        # NEW: app-sandbox + network.client + keychain-access-group
├── embedded.provisionprofile          # NEW: App Store provisioning profile
└── src/
    ├── lib.rs                         # MODIFIED: cfg-gate updater/autostart/tray-item; register iap (appstore)
    ├── iap/                           # NEW: StoreKit bridge module (commands + plugin glue)
    │   ├── mod.rs                     #   IapProduct/IapPurchaseResult serde-pinned mirrors
    │   └── commands.rs                #   iap_products / iap_purchase / iap_restore / iap_current_entitlements
    └── license/                       # UNCHANGED (compiled in; webview just stops calling it)

src/
├── lib/
│   ├── channel.ts                     # NEW: VITE_CHANNEL / IS_APPSTORE constant
│   ├── platform/
│   │   ├── index.ts                   # MODIFIED: add `iap` to Platform + getter
│   │   ├── tauri.ts                   # MODIFIED: real iap arm + storekit://updated listen
│   │   ├── browser.ts                 # MODIFIED: no-op iap arm
│   │   └── stub.ts                    # MODIFIED: createIapStub() (mirror createLicenseStub)
│   ├── entitlements/
│   │   └── resolve.ts                 # MODIFIED: baseFromStoreKit branch (THE source swap)
│   └── decoder.ts                     # UNTOUCHED (+ its 19 tests)
├── components/
│   ├── settingsPanes.tsx              # MODIFIED: filter Updates pane; License render() picks variant
│   ├── LicenseSettings.tsx            # UNCHANGED (direct) — store path routes to the new file below
│   ├── StoreLicenseSettings.tsx       # NEW: status + Buy(displayPrice) + Restore (no key/link/$9)
│   ├── UpdatesSettings.tsx            # UNCHANGED (never mounts in store build)
│   └── UpsellPanel.tsx                # MODIFIED: BUY_LICENSE_URL + $9 + InlineActivation compiled out of store
└── App.tsx                            # MODIFIED: guard updater effects; wire onPurchaseUpdated (store)
```

### Structure Rationale

- **`StoreLicenseSettings.tsx` as a NEW sibling, not an in-place branch:** `LicenseSettings.tsx` is 531 lines dense with Keygen-specific states (offlineGrace/refreshNeeded/deactivate/masked-key). Branching it inline would bloat it and risk shipping Keygen copy in the store bundle. A separate component selected at the `settingsPanes.tsx` render() boundary keeps the store pane minimal (status + Buy + Restore) and lets Vite tree-shake the Keygen surface cleanly. Both read `useEntitlements`/`useLicenseUi`-equivalent snapshots, so no logic duplication beyond the presentational shell.
- **`iap/` mirrors `license/`:** same module shape (commands.rs + serde-pinned mirror types) the team already knows.
- **`channel.ts` as one tiny module:** a single import site for `IS_APPSTORE` so the tree-shake boundary is obvious and greppable.

---

## Architectural Patterns

### Pattern 1: Single-source entitlement resolution, multiple sources

**What:** All entitlement consumers read ONE hook (`useEntitlements`) over ONE snapshot store, fed by ONE resolver (`resolveEntitlements`). The *source* of the resolved set (Keygen `machine.lic` vs StoreKit `currentEntitlements`) is an internal detail of the resolver, selected by `IS_APPSTORE`.
**When to use:** Two distribution channels granting the same capabilities through different licensing backends.
**Trade-offs:** Pro — every gate (sidebar, palette, ToolRoute, gated prefs) is channel-agnostic and untouched; one diff point. Con — the resolver becomes the single highest-stakes function (already true; already heavily commented and tested).
**Example:**
```ts
const base = IS_APPSTORE
  ? baseFromStoreKit(await platform.iap.currentEntitlements())
  : baseFromLicense(await platform.license.status());
// downstream pro.* map + central gate identical
```

### Pattern 2: Capability seam with a deterministic no-op arm (FND-04)

**What:** Every native capability is an interface in `index.ts` with a real arm (`tauri.ts`, the only `@tauri-apps` importer) and a deterministic non-Tauri arm (`browser.ts`/`stub.ts`). New capabilities (IAP) follow the same three-file pattern.
**When to use:** Any new OS/StoreKit surface.
**Trade-offs:** Pro — unit tests + dev run with no native call; one mock point; portability door. Con — every capability is three small edits instead of one.

### Pattern 3: Three-layer variant axis bound by one build command

**What:** A variant that must change Rust (cargo feature), bundle config (`--config` overlay), and webview (`VITE_CHANNEL`) is kept in sync by binding all three in a single `package.json` script, so a developer can never build a half-variant.
**When to use:** Multi-distribution Tauri apps.
**Trade-offs:** Pro — drift-proof; mirrors the existing `tauri:dev:e2e` feature-binding script. Con — the `generate_handler!` cfg-arm duplication grows (known wart, `lib.rs:322-343`).

---

## Anti-Patterns to Avoid

- **Forking the gate or the `pro.*` map per channel.** The whole locked decision is that both variants resolve to the SAME map through the SAME central gate. Do NOT add a `storeEntitlements` parallel store or a second `useEntitlements`. (Cited reuse: `resolve.ts:35` "Flip HERE and nowhere else.")
- **Branching `LicenseSettings.tsx` inline on `IS_APPSTORE` for every state.** Risks shipping Keygen strings (`$9`, "license key", `license.tinkerdev.io`) into the store bundle — a 3.1.1 rejection. Use a separate tree-shakeable component selected at the registry boundary.
- **Hiding the key field with CSS / a runtime flag instead of compiling it out.** 3.1.1 requires the field to be ABSENT. Use the static `IS_APPSTORE` constant so Vite drops the dead branch.
- **Showing a hardcoded `$9` in the store pane.** Apple sets the price; show `Product.displayPrice` (FEATURES.md anti-feature). The `$9` literal lives at `UpsellPanel.tsx:511` — must not reach the store build.
- **Adding speculative sandbox entitlements** (`files.user-selected`, `network.server`) — App Review rejects unjustified entitlements (STACK.md). Only `app-sandbox` + `network.client` + the app-id/team/keychain-access-group set.
- **Re-implementing node-locking on the store build.** StoreKit entitlements are Apple-ID-scoped, not machine-scoped; let `currentEntitlements` be truth (FEATURES.md).
- **Touching `decoder.ts` or its 19 tests.** No integration path here reaches it; keep it that way.

---

## Suggested Build Order (dependency-forced; phases continue at 26)

The bridge spike is the critical path: nothing store-side compiles, resolves, or renders without a working `platform.iap` arm. Order mirrors the team's proven "spike the highest-risk slice first, shared foundation before parallel features, irreversible/integration-bound flows last with a human gate" discipline (engineering-learnings.md).

| Phase | Name | What lands | Depends on | Notes / gate |
|-------|------|-----------|-----------|--------------|
| **26** | **StoreKit bridge spike (CRITICAL PATH)** | `tauri-plugin-iap@0.9` proven (or fall back to swift-rs) inside a universal sandboxed build; `platform.iap` seam shape (Q3) with real `tauri.ts` arm + no-op `browser.ts`/`stub.ts` arm; `iap_*` Rust commands return real `currentEntitlements`/`products`; on-device JWS verify confirmed serverless | — | **Highest-risk dependency (STACK.md/FEATURES.md).** Needs App Store Connect sandbox tester + `.storekit` file. Human-gate: real purchase round-trip in the sandbox. If the plugin fails → swift-rs fallback (same seam). |
| **27** | **The variant seam (3 layers)** | `appstore` cargo feature + cfg-gated registrations; `tauri.appstore.conf.json` overlay + `entitlements.appstore.plist`; `VITE_CHANNEL`/`channel.ts`; bound `package.json` build scripts; updater compiled out (Rust + pane filter + App.tsx guard — Q5) | 26 (so the `appstore` feature has the iap plugin to register) | Build a sandboxed `.app` that launches (white-screen check = `network.client` present). No StoreKit UI yet. |
| **28** | **Entitlement-source swap + Store License pane** | `baseFromStoreKit` branch in `resolveEntitlements` (Q2); `StoreLicenseSettings.tsx` (status + Buy(`displayPrice`) + **Restore**); `onPurchaseUpdated` → `refreshEntitlements` boot wiring; Keygen surface (`$9`/`BUY_LICENSE_URL`/key field) compiled out of the store bundle | 26, 27 | Verify the SAME central gate unlocks theming/ordering from a StoreKit purchase. Reuse the existing drop-notice for revocation. Human-gate: purchase → Pro unlocks live; refund → Pro drops live. |
| **29** | **Sandbox-safe native features** | SMAppService autostart arm (Q4); sandbox audit of global-shortcut (keep — RegisterEventHotKey) + tray (keep) per STACK.md; keychain-access-group entitlement validated on the SIGNED build (or dropped if Keygen is Rust-gated out) | 27 (sandbox build exists) | Can partly parallelize with 28 (independent of StoreKit). `MissingEntitlement` is runtime-only — verify on the signed `.pkg`, not unit tests. |
| **30** | **`.pkg` build + App Store Connect submission** | `productbuild` → `.pkg` → `altool` upload pipeline (STACK.md Q4); Apple Distribution + Mac Installer Distribution certs; IAP product attached to binary; privacy label / age rating / screenshots / Notes-for-Review (FEATURES.md submission checklist) | 26-29 all green | Irreversible/integration-bound → mandatory human gate (mirrors the v1.6 live-purchase ship-gate). Build LAST, after every source change lands (verify bundle mtime > last source commit — engineering-learnings.md). |

**Parallelization:** 29 (sandbox native features) can start once 27 lands, in parallel with 28 (StoreKit UI) — they share only the sandbox-enable change. Everything else is strictly sequential on the bridge.

---

## Scalability / Risk Considerations

| Concern | At spike (Phase 26) | At submission (Phase 30) | Post-ship |
|---------|---------------------|--------------------------|-----------|
| Bridge maturity (`tauri-plugin-iap` 72★, single maintainer) | Validate in universal sandboxed build; swift-rs fallback ready | Pin exact version; vendor if needed | Watch upstream; the seam isolates a swap |
| `objc2` version coexistence (`smappservice-rs` 0.6 vs `keyring` apple-native) | Confirm at link time in 26/29 | — | — |
| Keychain under sandbox (`MissingEntitlement`) | Decide if store build uses Keychain at all (Keygen-gated-out?) | Validate on the SIGNED `.pkg` | — |
| Variant drift (half-built variant) | Bind 3 layers in one `package.json` script (Pattern 3) | release script asserts all three flags set | — |
| `generate_handler!` cfg-arm growth | Accept 2×N duplication or add a helper | — | Refactor if it gets unwieldy |

---

## Sources

- In-repo (HIGH — primary integration evidence): `src/lib/platform/index.ts` (seam interface + `isTauri`/`isTestOrDev` + getters), `src/lib/platform/tauri.ts` (the sole `@tauri-apps` importer; license/autostart/updater/events arms), `src/lib/platform/browser.ts` + `stub.ts` (no-op arms; `createLicenseStub`), `src/lib/entitlements/resolve.ts` (THE single resolution point, line 51), `src/lib/entitlements/entitlements.ts` (`isPro`/`gatePreferences`/`ALL_ENTITLEMENTS`), `src/lib/entitlements/store.ts` + `src/shell/useEntitlements.ts` (snapshot + hook), `src/components/LicenseSettings.tsx` (Keygen pane to branch; drop-notice 243-265), `src/components/UpsellPanel.tsx` (`BUY_LICENSE_URL:73`, `$9:511`, `InlineActivation:707`), `src/components/settingsPanes.tsx` (pane registry to filter), `src/App.tsx` (updater wiring to guard, lines 68-148), `src/shell/useUpdater.ts`, `src-tauri/Cargo.toml` (`webdriver` feature precedent, lines 36/92-94), `src-tauri/src/lib.rs` (plugin registration + cfg-gating + `generate_handler!` arms, lines 75-90/308-343), `src-tauri/src/license/commands.rs` (the command surface), `src-tauri/tauri.conf.json` (bundle/updater/entitlements/minSysVer config), `package.json` (`tauri:dev:e2e` feature-binding script precedent, line 21).
- [Tauri 2 — Configuration Files](https://v2.tauri.app/develop/configuration-files/) — `--config` RFC-7396 JSON Merge Patch "multiple flavours" mechanism (HIGH, confirmed via fetch 2026-06-22).
- Sibling research (treated as inputs): `.planning/research/STACK.md` (plugin/swift-rs/SMAppService versions, sandbox entitlements, minSysVer 13.0 forcing, `.pkg`/altool pipeline), `.planning/research/FEATURES.md` (3.1.1 compile-out, Restore mandatory, `displayPrice`, Transaction.updates → drop-notice reuse, submission checklist).
- `~/.claude/engineering-learnings.md` (build-LAST, human-gate for irreversible flows, spike-highest-risk-first, capability-seam discipline).

---
*Architecture research for: v1.8 "Mac App Store Distribution" (TinkerDev)*
*Researched: 2026-06-22*
