# Phase 29: Sandbox-Safe Native Features - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the **sandboxed App Store build feature-complete on the native surfaces it keeps**, and **cleanly gate out the surfaces that can't be sandbox-safe this milestone** — with no unjustified entitlements and no runtime `MissingEntitlement`.

**Kept native surfaces (sandbox-safe, verify on the signed build):**
- Global summon hotkey (`tauri-plugin-global-shortcut`, `RegisterEventHotKey` — keep Cmd/Ctrl in the chord) — MAS-NATIVE-01
- Tray / menu-bar icon + menu (Rust-only `TrayIconBuilder` in `setup()`) — MAS-NATIVE-02
- single-instance, window-state geometry, clipboard, store(prefs), opener (already sandbox-safe; carried unchanged)

**Gated OUT of the store build:**
- Keychain / `keyring` + the whole Keygen license Rust surface — MAS-NATIVE-03 (store Pro state comes ONLY from StoreKit)
- Launch-at-login UI (the autostart *backend* was already compiled out in Phase 27; Phase 29 removes the General-pane toggle) — MAS-NATIVE-04

**In scope:** the keyring/license-module compile-out (`direct`-gated), the `IS_APPSTORE` UI hiding of launch-at-login, the autostart-seam no-op, and the signed-build human verification of summon + tray + entitlements.
**NOT in scope:** the autostart/updater *backend* compile-out (done Phase 27), the Keygen *frontend string* compile-out + grep-clean (done Phase 28, MAS-BUILD-04), `SMAppService` launch-at-login (deferred → MAS-NATIVE-05/v2), `.pkg`/ASC submission (Phase 30).
</domain>

<decisions>
## Implementation Decisions

### Keychain / license Rust surface (MAS-NATIVE-03)
- **D-01:** **Full license-module compile-out** of the store build. Gate the ENTIRE `license` Rust module (`MacKeychain` + the `keyring` dep + `keygen_client` + `fingerprint` + the 4 license commands + the `LicenseState`/`refresh_if_needed` setup wiring) behind the default `direct` Cargo feature (i.e. `#[cfg(feature = "direct")]` / absent under `--no-default-features --features appstore`). The store binary links **no `keyring`**, registers **no license commands**, and runs **no keychain access** — smallest sandbox surface, strongest 3.1.1 + grep-clean guarantee. Chosen over a keyring-arm-only no-op stub (which would leave keygen_client/fingerprint/commands in the store binary).
- **D-02:** Make `keyring` an **optional** crate dep moved under the `direct` feature (today it is UNCONDITIONAL at `Cargo.toml:57`, `features=["apple-native"]`). Cargo features are additive (Phase 27 D-03 pattern) — so `keyring` becomes `dep:keyring` listed in the `direct` feature, dropped by the appstore command.
- **D-03 (load-bearing verification):** The store **boot path must invoke no `platform.license.*` IPC**, or it hits an unregistered command. Phase 28's `baseFromStoreKit` should already make the store gate StoreKit-only, but the shared `tauri.ts` license IPC literals ride along in the bundle (per the `keygen-compileout-d04-proof` learning). The planner MUST confirm — via a boot-path trace + a no-license-IPC assertion — that the appstore frontend never calls `resolve_status`/`activate`/`deactivate`/etc. This is the proof that the Rust compile-out is safe, not the string grep.

### Launch-at-login UI (MAS-NATIVE-04)
- **D-04:** **Fully absent** in the store build's General pane. The toggle, its label, its live-region, and the OS-truth reconcile effect all gate behind `IS_APPSTORE` in `GeneralSettings.tsx` and are not rendered. Matches the roadmap wording ("the toggle and any autostart wiring are absent"). No dead/greyed UI, no "why is this off?" confusion (there is no App-Store equivalent for launch-at-login, unlike the retained Updates pane). The "default tool on launch" selector remains, so the pane is not empty.
- **D-05:** The `platform.autostart` seam (`src/lib/platform/tauri.ts`) — which statically imports `@tauri-apps/plugin-autostart` — must **no-op under `IS_APPSTORE`** as belt-and-suspenders, so a stray `enable/disable/isEnabled` call can never reach an unregistered plugin and throw. (With D-04 removing the toggle + reconcile-effect there is no call path, but the seam guard hardens it.)

### Native-feature inventory (MAS-NATIVE-01/02)
- **D-06:** **Kept** in the store build (sandbox-safe; verification-only): global summon, tray/menu, single-instance, window-state geometry, clipboard, store(prefs), opener. **Gated out:** keychain/keyring (D-01) + autostart (backend already out Phase 27; UI out via D-04). Confirmed as the correct split.
- **D-07:** `opener` (https-only, Buy-license CTA origin) **stays** in the store build — harmless and sandbox-safe; likely still used for support/privacy URLs in Phase 30 even though the store Buy CTA now goes through StoreKit. Not gated out.
- **D-08:** Global summon keeps its current user-configurable Cmd-based chord unchanged — `RegisterEventHotKey` is sandbox-safe; no entitlement needed, no chord constraint introduced.

### Human signed-build gate (MANDATORY — WebDriver cannot synth these)
- **D-09:** The Phase 29 gate is a human walkthrough on the SIGNED sandboxed `.app` covering ALL of:
  1. **Summon over a real OS chord** — press the configured global hotkey while hidden/background; window reveals + focuses (MAS-NATIVE-01).
  2. **Tray reveal + menu** — click the tray icon; exercise Show + Settings… + Quit (MAS-NATIVE-02).
  3. **Entitlement + MissingEntitlement audit** — `codesign -d --entitlements` shows `app-sandbox` + `network.client` and **NO** `keychain-access-groups`; launch + exercise Pro and confirm no runtime `MissingEntitlement`/keychain error in Console (MAS-NATIVE-03, runtime-only).
  4. **Launch-at-login absent** — Settings ▸ General shows no launch-at-login toggle (MAS-NATIVE-04); plus `cargo tree --features appstore | grep -E 'autostart|keyring'` empty on the bundle.

### Claude's Discretion
- Exact cfg form for the license-module gate (`#[cfg(feature = "direct")]` vs a `not(feature = "appstore")` helper) — planner picks; must follow the established Phase 27 `direct`-feature idiom and keep the appstore build compiling.
- Whether the `license` mod, its commands, and the `LicenseState` setup block are gated as one `#[cfg]` group or per-item — planner picks the lowest-churn form that compiles clean under both features.
- How the autostart-seam no-op (D-05) is shaped (early-return guard vs `IS_APPSTORE`-branched arm) — keep consistent with how the seam already handles arms.
- Whether `verify-appstore-bundle.sh` gains the `keyring`/`autostart` cargo-tree assertion (extends the Phase 27/28 script) or it lives only in the human gate checklist — planner picks; prefer extending the committed script (FATAL-when-present, green at boundary).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & roadmap
- `.planning/REQUIREMENTS.md` — MAS-NATIVE-01/-02/-03/-04 (the four Phase 29 requirements) + MAS-NATIVE-05 (SMAppService, DEFERRED — do not pull forward).
- `.planning/ROADMAP.md` §"Phase 29: Sandbox-Safe Native Features" — goal + 4 success criteria + gate (verbatim acceptance bar).
- `docs/harness-and-decisions.md` — authoritative locked decisions / build+verify harness.

### Build-variant seam (Phase 27 — the gating machinery to extend)
- `.planning/phases/27-build-variant-seam/27-CONTEXT.md` — the `direct`/`appstore` Cargo-feature seam, the additive-features rule, `IS_APPSTORE`/`VITE_CHANNEL`. Phase 29 D-01/D-02 extend the SAME `direct` umbrella feature.
- `src-tauri/Cargo.toml` §`[features]` (line ~109) — `direct = [...]` umbrella (add `dep:keyring` here); `keyring` currently UNCONDITIONAL at line ~57 (make `optional`).
- `src-tauri/src/lib.rs` — the `#[cfg(feature = "direct")]` updater gate (line ~82) is the idiom to mirror; the UNCONDITIONAL license registration (`MacKeychain` line ~100, `LicenseManager`/`LicenseState` setup, the `mod license` at line 1) is what gets `direct`-gated; the global-shortcut (line ~36) + tray (`setup()` line ~70) chains are the kept surfaces to leave untouched.
- `scripts/verify-appstore-bundle.sh` — the committed bundle-assertion script (Phase 27 D-09 / Phase 28 extension); extend with the `keyring`/`autostart` cargo-tree check if chosen.

### Entitlement-source swap (Phase 28 — why the store build needs no license Rust)
- `.planning/phases/28-entitlement-source-swap/28-CONTEXT.md` — `baseFromStoreKit` makes the store gate StoreKit-only; the basis for D-03 (store boot invokes no license IPC).
- `src/components/settingsPanes.tsx` + `src/lib/platform/channel.ts` — the `IS_APPSTORE` static-switch tree-shaking pattern D-04/D-05 reuse for the General-pane hiding + seam no-op.

### Phase 29 surfaces to change
- `src/components/GeneralSettings.tsx` — renders the launch-at-login toggle + label + live-region + OS-reconcile effect unconditionally today (D-04 gates these behind `IS_APPSTORE`; keep the "default tool on launch" selector).
- `src/lib/platform/tauri.ts` §`autostart` (line ~165) — the `enable/disable/isEnabled` arm importing `@tauri-apps/plugin-autostart` (D-05 no-op under `IS_APPSTORE`).
- `src-tauri/entitlements.appstore.plist` — must stay `app-sandbox` + `network.client` + `application-identifier` only; NO `keychain-access-groups` (D-09 audit).

### Standing project constraints
- `CLAUDE.md` / `.planning/PROJECT.md` — HashRouter only, six tools only, no network at runtime, `decoder.ts` + 19 tests untouched, tools import `src/lib/platform/`.
- Memory `mas-signing-dev-vs-distribution` — signed local-sandbox launch needs DEVELOPMENT signing + embedded Mac Development profile (distribution → AMFI-413); the gate runs on the dev-signed sandboxed `.app`.
- Memory `keygen-compileout-d04-proof` — copy-string grep is INSUFFICIENT proof; the load-bearing proof is source no-static-import + a boot-path test (shared `tauri.ts` license IPC literals ride along). Directly informs D-03.
- Memory `window-mutation-needs-capability` — JS window show/focus/unminimize needs a capability grant; the summon reveal path depends on it. Verify it holds under the appstore capability set.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The `#[cfg(all(desktop, feature = "direct"))]` updater gate in `lib.rs:82` — the exact idiom to mirror for the license-module gate (D-01).
- The `IS_APPSTORE` static switch already gating panes in `settingsPanes.tsx` (`src/lib/platform/channel.ts`) — reused for D-04 (toggle hiding) + D-05 (seam no-op), tree-shaken at build time.
- `scripts/verify-appstore-bundle.sh` — committed bundle-assertion harness (entitlements present + plugins/strings absent); extend for keyring/autostart.
- The `direct` umbrella feature (Phase 27) already drops updater + autostart + process — D-02 adds `keyring` to the same list, no new seam.

### Established Patterns
- Cargo features are **additive** — compile-OUT = a `default`-enabled feature dropped via `--no-default-features --features appstore` (never an `appstore` feature that "removes" a dep). `keyring` must become `optional` to be droppable.
- Tray + global-shortcut are Rust-native with no JS-side capability for the tray (global-shortcut is gated by `global-shortcut:allow-*` capabilities) — both sandbox-safe, verification-only.
- `src/lib/platform/` is the only allowed Tauri boundary — the autostart-seam guard (D-05) lives there, not in components.

### Integration Points
- `src-tauri/Cargo.toml` — move `keyring` under `direct`; `src-tauri/src/lib.rs` — `#[cfg(feature = "direct")]` over `mod license` + its registration + the `LicenseState`/refresh setup.
- `src/components/GeneralSettings.tsx` — `IS_APPSTORE` gate around the launch-at-login block.
- `src/lib/platform/tauri.ts` — autostart arm no-op under `IS_APPSTORE`.
- `scripts/verify-appstore-bundle.sh` — optional keyring/autostart cargo-tree assertion.

### Caveats for planner
- The store build must still COMPILE with `mod license` gated out — anything outside the module that references license types/commands (e.g. command-handler registration, frontend IPC literals in shared `tauri.ts`) must be `direct`-gated or proven dead in the store boot path (D-03). This is the real risk, not the keyring crate itself.
- The gate runs on the SIGNED dev-signed sandboxed `.app` (WebDriver can't synth global chord / tray / sandbox entitlements). `MissingEntitlement` is RUNTIME-only — judge it by launching the signed bundle + Console, not by unit tests.
- Build last / verify on the SIGNED bundle (harness rule); the absent updater key makes `tauri build` exit non-zero — judge by the bundle + signature, not the exit code.
</code_context>

<specifics>
## Specific Ideas

- Reuse, don't invent: D-01/D-02 extend Phase 27's existing `direct` umbrella feature; D-04/D-05 reuse Phase 28's `IS_APPSTORE` static switch. No new seam, no new dep.
- The proof that the keyring compile-out is safe is a **boot-path / no-license-IPC test**, not a string grep (per `keygen-compileout-d04-proof`).
- Keep the human gate (D-09) covering all four checks — none is WebDriver-drivable.
</specifics>

<deferred>
## Deferred Ideas

- **`SMAppService` sandbox-safe launch-at-login** — MAS-NATIVE-05, explicitly deferred to v2. Phase 29 only HIDES the toggle; it does not re-implement launch-at-login under sandbox.
- **Windows/Linux keyring arms** (`windows-native` / secret-service) — backlog 999.8; out of scope (macOS-only milestone).
- **`.pkg` / Apple Distribution signing / ASC upload + support/privacy URLs via opener** — Phase 30.

None were scope creep — all are downstream phases / explicitly-deferred items already on the roadmap.
</deferred>

---

*Phase: 29-sandbox-safe-native-features*
*Context gathered: 2026-06-24*
