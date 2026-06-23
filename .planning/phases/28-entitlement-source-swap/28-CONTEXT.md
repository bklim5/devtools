# Phase 28: Entitlement-Source Swap + Store License Pane - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

In the `appstore` build variant ONLY, swap Pro's source-of-truth from Keygen → StoreKit through the one existing `resolveEntitlements` central gate, replace the License / upsell / Updates surfaces with App-Store-managed equivalents (Buy + Restore, no Keygen concepts), wire live unlock + refund-drop, and **compile the entire Keygen surface OUT** so the store bundle is grep-clean (App Store guideline 3.1.1). The direct DMG channel stays byte-unchanged; `decoder.ts` + its 19 tests untouched; the registry stays the single control plane.

**Scope anchor — IN:** `baseFromStoreKit` gate branch (MAS-IAP-02), explicit Restore (MAS-IAP-03), refund/revoke live-drop (MAS-IAP-05), store License pane Buy/Restore/status (MAS-IAP-06), Keygen-concept omission + StoreKit upsell routing (MAS-IAP-07), Keygen compile-out + grep-clean (MAS-BUILD-04), App-Store-managed Updates pane (MAS-BUILD-07).
**OUT (other phases):** sandbox-safe native features / Keychain gate-out / launch-at-login (Phase 29); `.pkg` build + ASC submission + distribution signing (Phase 30).
</domain>

<decisions>
## Implementation Decisions

### Pane swap + compile-out mechanism (Area 1)
- **D-01:** Build **separate store components** (`StoreLicenseSettings`, `StoreUpsell`) selected at a **single static `IS_APPSTORE` switch** in the pane registry (`settingsPanes.tsx`) and the upsell opener. Because `IS_APPSTORE` is a build-time constant (Phase-27 `src/lib/platform/channel.ts`, tree-shakeable like `import.meta.env.DEV`), the dead branch + its whole import subtree (`LicenseSettings`, `UpsellPanel`/`InlineActivation`, `licenseUi`, and every `license.tinkerdev.io` / key-field string) is tree-shaken out of the store bundle. NOT an `if (IS_APPSTORE)` branch inside the existing components — that would leave the Keygen strings in the same module and fail the grep gate.
- **D-02:** Three surfaces get a store variant in this phase, all via the same static switch: (1) **License pane** → `StoreLicenseSettings`; (2) **Upsell modal + every locked trigger** (sidebar "Unlock Pro", locked pin/reorder/Command-Palette) → StoreKit Buy/Restore flow, never the Keygen activation form (MAS-IAP-07); (3) **Updates pane** → App-Store-managed variant (MAS-BUILD-07).
- **D-03:** Extend `scripts/verify-appstore-bundle.sh` (Phase-27, D-10 deferral) with a **hard-gate exhaustive forbidden-string grep** over the SIGNED bundle: `license.tinkerdev.io`, the external buy URL (`BUY_LICENSE_URL`), the literal price (`$9`), and key-field markers — any hit = non-zero exit = blocks the phase gate. Follows the Phase-27 D-09 pattern.

### Entitlement source + live-flip wiring (Area 2)
- **D-04:** Add a **`baseFromStoreKit` arm in `resolveEntitlements` gated by the static `IS_APPSTORE` constant**, so the appstore build NEVER imports or calls `platform.license.status()` — Pro state comes ONLY from StoreKit. This also tree-shakes `baseFromLicense` + the license seam JS out of the store bundle (reinforces D-03). The browser/jsdom `FREE_SET` path is unchanged (tests never touch licensing).
- **D-05:** `baseFromStoreKit(codes: string[])` reuses the **exact over-grant guard** of `baseFromLicense`: intersect the returned `pro.*` codes with `ALL_ENTITLEMENTS`; empty / `.unverified` → `FREE_SET` (falls closed). Same invariant (T-21-12), one mental model.
- **D-06:** Wire the **real plugin transaction-update channel**: Rust subscribes to `tauri-plugin-iap`'s `register_listener`/`ipc::Channel` (`src-tauri/src/iap/`) and re-emits a Tauri event (`storekit://updated`); a **single boot listener in the store build** calls `platform.iap.onPurchaseUpdated(() => refreshEntitlements())` so a purchase unlocks Pro live (no relaunch, MAS-IAP-02) AND a refund/revoke-while-running drops Pro live (MAS-IAP-05) through the same path. This wires the `onPurchaseUpdated` placeholder that Phase 26 deferred (currently `listen("storekit://updated")` never fires).
- **D-07:** On a live entitlement **drop**, reuse the existing **drop-notice** mechanism: set `licenseDropNoticeAck = false` so the current "Your Pro features turned off — your themes and tool order are saved" inline notice renders (success criterion 3, "reuses the existing drop-notice"). Copy is adjusted to App-Store-managed wording (no "reactivate with your key").

### Restore vs boot-read semantics (Area 3)
- **D-08:** At launch, boot calls **`iap.currentEntitlements()` (a passive local read of the on-device StoreKit transaction cache — NO `AppStore.sync`, NO Apple-ID auth prompt)** to set the gate via `refreshEntitlements()`. This unlocks Pro for an owner whose machine already has the transaction, WITHOUT triggering Apple's restore/auth dialog — honoring "Restore is never silent at launch" (the explicit button is what syncs).
- **D-09:** The explicit **Restore button → `platform.iap.restore()` (`AppStore.sync`, MAY prompt Apple-ID auth — the Apple-sanctioned explicit moment) → then `refreshEntitlements()`** so a successful restore unlocks Pro live. This is how an owner re-unlocks on a fresh install / new machine whose local cache is empty (MAS-IAP-03).
- **D-10:** **Restore is always reachable** in Settings ▸ License (shown for BOTH Free and Pro states — Apple expects an always-available Restore) AND surfaced on the StoreKit upsell modal next to Buy.

### Store License + Updates pane content/copy (Area 4)
- **D-11:** The store License pane renders **two mutually-exclusive layouts, one at a time** per the gate: **Pro-active** vs **Free**. StoreKit has no offline-grace / refresh-needed / problem concepts, so there are NO attention/amber states, NO Deactivate, NO masked key, NO Licensee email. **Reuse the existing licensed green "Pro" banner UI** (`LicenseSettings` Pro-active styling) for the Pro-active layout — copy adjusted to App-Store-managed wording.
  - Pro-active: green "Pro" banner, "Pro is active — managed through the App Store." + always-visible Restore.
  - Free: calm status + Buy + Restore.
- **D-12:** **Buy CTA shows NO in-app price** — label stays "Buy Pro"; the App Store purchase sheet shows the real price on tap. Safest for 3.1.1 (zero chance of a stale/literal price). **Mention "lifetime / one-time purchase"** in the store copy (e.g. "Buy Pro — Lifetime", reflecting the non-consumable product). ⚠️ This RELAXES written success-criterion 4 / MAS-IAP-06 ("Buy (App Store `displayPrice`)") — deliberate; planner should reconcile the criterion wording to "Buy (price shown on the App Store sheet)". `iap.products()` is still wired (used for product availability / the Buy action), just not for an in-app price string.
- **D-13:** **App-Store-managed Updates pane** (`StoreUpdatesSettings` or static branch via the same D-01 switch): KEEP the running-version readout; replace the action area with "Your app update is managed by the App Store." **REMOVE (not disable):** Check-for-updates button, Install button, the auto-check-on-launch toggle, and the "Last checked" line (all reference the compiled-out updater).
- **D-14:** **Wording rules (all store surfaces):** calm "managed through the App Store / your Apple ID" framing; omit EVERY Keygen concept (no "activate with key", no machine deactivate/seat-transfer, no fingerprint/seat-limit copy, no "lost your key / check your purchase email"); write **"Command Palette"** instead of "⌘K" everywhere; mention "lifetime" for the Pro purchase.

### Removed scaffolding
- **D-15:** The Phase-26 `IapSpikeBlock` (the temporary dev button block in `LicenseSettings.tsx`) is **removed** in this phase — its role is replaced by `StoreLicenseSettings`'s real Buy/Restore flow.

### Claude's Discretion
- Exact component/file names (`StoreLicenseSettings`, `StoreUpsell`, store Updates variant) and how the static switch is expressed in `settingsPanes.tsx` / the upsell opener.
- Final exact copy strings (within the D-14 rules) — finalized at the gsd-ui-phase / human UI walkthrough.
- The Rust-side bridge shape (how `register_listener`/`ipc::Channel` is re-emitted as the Tauri `storekit://updated` event) and where the single boot listener mounts (e.g. `main.tsx`, store-build-only).
- Whether a calm "purchase pending" line is shown for StoreKit Ask-to-Buy/SCA pending transactions (fold into a line, not a full state).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & roadmap
- `.planning/REQUIREMENTS.md` — MAS-IAP-02, -03, -05, -06, -07, MAS-BUILD-04, MAS-BUILD-07 (the seven Phase 28 requirements + their acceptance text).
- `.planning/ROADMAP.md` §"Phase 28: Entitlement-Source Swap + Store License Pane" — goal + 7 success criteria (verbatim acceptance bar). ⚠️ Criterion 4's `displayPrice` is intentionally relaxed per D-12.
- `docs/harness-and-decisions.md` — authoritative locked decisions / build+verify harness.

### Phase 26/27 seam this phase extends
- `.planning/phases/27-build-variant-seam/27-CONTEXT.md` — `IS_APPSTORE` / `channel.ts` (D-07), the overlay, and `verify-appstore-bundle.sh` (D-09/D-10 — Keygen strings deferred to HERE).
- `.planning/phases/26-storekit-bridge-spike/26-CONTEXT.md` — the StoreKit bridge decisions the entitlement swap builds on.
- `docs/appstore/PHASE-26-BRIDGE-VIABILITY.md` — why the iap capability stays Rust-side; explicitly flags wiring the real transaction-update channel (refund/revoke live-drop) as Phase 28 (D-06).
- `docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md` — the human sandbox purchase/round-trip walkthrough this phase's gate reuses (purchase → unlock live; refund → drop live).

### Code to modify / reference
- `src/lib/entitlements/resolve.ts` — `resolveEntitlements`; add the static `IS_APPSTORE` → `baseFromStoreKit` branch (D-04/D-05).
- `src/lib/entitlements/store.ts` — `refreshEntitlements()` (the live-flip + drop-diff propagation); the boot listener calls this (D-06/D-07).
- `src/lib/entitlements/entitlements.ts` — `ALL_ENTITLEMENTS` / `FREE_SET` / `FULL_SET` (the intersection guard, D-05).
- `src/lib/platform/channel.ts` — `IS_APPSTORE` (the single static gating import).
- `src/lib/platform/index.ts` + `src/lib/platform/tauri.ts` — the `iap` seam (`products`/`purchase`/`restore`/`currentEntitlements`/`onPurchaseUpdated`); `onPurchaseUpdated` is the non-firing `storekit://updated` placeholder to wire (D-06).
- `src/components/LicenseSettings.tsx` — the Keygen pane (REFERENCE for the Pro-active green-banner UI to reuse, D-11) + the `IapSpikeBlock` to REMOVE (D-15). New `StoreLicenseSettings` lives beside it.
- `src/components/UpsellPanel.tsx` — `InlineActivation` / `UpsellModal` (REFERENCE; new `StoreUpsell` Buy/Restore surface).
- `src/components/UpdatesSettings.tsx` — the Updates pane (App-Store-managed store variant, D-13).
- `src/components/settingsPanes.tsx` — the pane registry (the single static `IS_APPSTORE` switch, D-01).
- `src/shell/proUpsell.ts` — the upsell router (store variant routes notActivated → StoreKit Buy/Restore; the refreshNeeded/problem branches don't exist in the store build).
- `scripts/verify-appstore-bundle.sh` — extend with the forbidden-string greps (D-03).
- `src-tauri/src/iap/` (`mod.rs` / listeners) — the Rust plugin listener → `emit("storekit://updated")` bridge (D-06).

### Standing constraints
- `CLAUDE.md` / `.planning/PROJECT.md` — HashRouter only, six-tools-only invariant (these are the 11 shipped tools — registry stays the single control plane), no runtime network, `decoder.ts` + 19 tests untouched, tools import `src/lib/platform/` only.
- Memory `prefs-blob-single-writer` — route the `licenseDropNoticeAck` write (D-07) through the shared `usePreferences` singleton, never a second snapshot.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveEntitlements` + `baseFromLicense` (`resolve.ts`) — the exact pattern (`isTauriEnv` → base, intersect with `ALL_ENTITLEMENTS`, downgrade-only override) `baseFromStoreKit` mirrors.
- `refreshEntitlements()` + `subscribeEntitlements` (`store.ts`) — the live-flip engine; the boot StoreKit listener and Restore/purchase handlers all funnel through it (notifies only on actual set change).
- The licensed green "Pro" banner + neutral details styling in `LicenseSettings.tsx` (`CARD_CLASS`/`HEADING_CLASS`/`SECONDARY_BTN_CLASS`, the ok-soft banner) — reuse verbatim for the store Pro-active layout (D-11; 21-UI-SPEC reuse mandate).
- The existing drop-notice (`licenseDropNoticeAck` flag → inline "Pro features turned off" card) — reused for the refund-drop (D-07).
- The `IapSpikeBlock` calm `aria-live` readout pattern (`LicenseSettings.tsx`) — the model for `StoreLicenseSettings`' Buy/Restore in-flight + result feedback (then the spike block itself is removed, D-15).
- `IS_APPSTORE` (`channel.ts`) — the build-time constant that makes D-01/D-04 statically tree-shakeable.

### Established Patterns
- Static `import.meta.env.DEV`-style gating → dead-branch tree-shaking is the proven idiom for compile-out (D-01/D-04); a runtime branch would leave Keygen strings in the bundle.
- The platform seam (`src/lib/platform/`) is the ONLY Tauri boundary; the iap arm rejects `{ code }` (mirrors license) and falls closed.
- `verify-appstore-bundle.sh` grep-on-signed-bundle assertions (Phase 27) — extend, don't rewrite.

### Integration Points
- `settingsPanes.tsx` + the upsell opener — the single static switch point (D-01/D-02).
- `resolve.ts` — the one gate flip point (D-04).
- `main.tsx` (or store-build boot path) — mounts the single `onPurchaseUpdated → refreshEntitlements` listener (D-06).
- `src-tauri/src/iap/` — Rust re-emits the plugin transaction channel as `storekit://updated` (D-06).

### Caveats for planner
- **Drop-detection location:** the Keygen path currently sets `licenseDropNoticeAck = false` somewhere in the license refresh/diff flow. For the store build there is no license refresh — the diff-detection (Pro→not-Pro) must live in the shared `refreshEntitlements` path (or the store boot listener) so a refund-while-running fires the notice (D-07). Locate the existing setter before deciding where the store diff lands.
- **`onPurchaseUpdated` is a placeholder** — `tauri.ts` listens on `storekit://updated` but nothing emits it yet (Phase-26 note). The Rust bridge (D-06) is the load-bearing new work; WebDriver CANNOT drive StoreKit refund/purchase, so the live-flip is verified at the HUMAN sandbox gate, not unit/e2e.
- **Grep-clean depends on tree-shaking** — verify on the SIGNED bundle that the dead Keygen branch actually dropped; a stray non-static import (e.g. a shared util that re-imports `licenseUi`) can keep strings in. D-03's hard gate catches this.
- Build last / verify on the SIGNED bundle (harness rule); judge success by the bundle + signature, not the `tauri build` exit code.
</code_context>

<specifics>
## Specific Ideas

- Reuse the existing licensed (green "Pro" banner) UI for the store Pro-active state — don't design a new one (D-11).
- Write "Command Palette" instead of "⌘K" in all store copy — a user who doesn't know the shortcut still understands (D-14).
- Mention "lifetime" / one-time purchase somewhere in the store Buy copy (D-12).
- No in-app price on the Buy button — the App Store sheet carries it (D-12).
- Restore must always be visible (Apple expectation), including when Pro is active (D-10).
</specifics>

<deferred>
## Deferred Ideas

- **Sandbox-safe native features** (global summon + tray under sandbox, Keychain gated OUT, launch-at-login hidden) — Phase 29 (MAS-NATIVE-01..04).
- **`.pkg` build + Apple Distribution signing + ASC submission + metadata** — Phase 30 (MAS-SHIP-01..05). The Phase-26/27 dev-signing is local-launch only.
- **In-app `displayPrice` on the Buy button** — explicitly dropped this phase (D-12); could be revisited if Apple review prefers an in-app price.
- **Explicit StoreKit pending-state UI** (Ask-to-Buy/SCA) — fold into a calm line if needed (Claude's discretion); not a full state this phase.

None of these were scope creep — all are downstream phases already on the roadmap, or deliberate de-scopes.
</deferred>

---

*Phase: 28-entitlement-source-swap*
*Context gathered: 2026-06-23*
