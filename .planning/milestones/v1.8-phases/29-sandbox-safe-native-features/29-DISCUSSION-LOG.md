# Phase 29: Sandbox-Safe Native Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 29-sandbox-safe-native-features
**Areas discussed:** Keychain compile-out scope, Launch-at-login UI treatment, Store native-feature inventory, Human signed-build gate scope

---

## Area selection

| Option | Selected |
|--------|----------|
| Keychain compile-out scope | ✓ |
| Launch-at-login UI treatment | ✓ |
| Store native-feature inventory | ✓ |
| Human signed-build gate scope | ✓ |

**User's choice:** All four (all selected).

---

## Keychain / license Rust compile-out scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full module compile-out | Gate the ENTIRE `license` Rust module (MacKeychain + keyring + keygen_client + fingerprint + 4 commands) behind `direct`. Smallest sandbox surface; strongest 3.1.1 + grep-clean. | ✓ |
| Keyring-arm-only stub | Keep license module; make keyring optional + swap MacKeychain → inert no-op. Leaves keygen_client/fingerprint/commands in store binary. | |
| Verify-only (no compile-out) | Leave keyring linked; rely on absent keychain-access-groups so it never runs. Contradicts MAS-NATIVE-03. | |

**User's choice:** Full module compile-out.
**Notes:** Load-bearing follow-up captured (D-03): store boot path must invoke no `platform.license.*` IPC; proof is a boot-path test, not a string grep (`keygen-compileout-d04-proof` learning — shared `tauri.ts` license IPC literals ride along).

---

## Launch-at-login UI treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Fully absent | Toggle + label + live-region + reconcile-effect not rendered in store build (IS_APPSTORE gate). Matches roadmap wording. "Default tool on launch" selector remains. | ✓ |
| Visible but disabled + note | Greyed toggle + "managed by App Store" note (Updates-pane pattern). Leaves inert UI; no App Store equivalent → confusing. | |

**User's choice:** Fully absent.
**Notes:** Belt-and-suspenders follow-up (D-05): `platform.autostart` seam no-ops under IS_APPSTORE so a stray call can't reach the unregistered plugin.

---

## Store native-feature inventory

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm as listed | Keep summon + tray + single-instance + window-state + clipboard + store + opener; gate keychain + autostart. | ✓ |
| Re-examine opener under sandbox | Consider gating the https-only opener out (store Buy now StoreKit). | |
| Something else to gate | Flag another surface for different treatment. | |

**User's choice:** Confirm as listed.
**Notes:** opener stays (D-07) — harmless, sandbox-safe, likely reused for support/privacy URLs in Phase 30. Global summon keeps its current Cmd-based chord unchanged (D-08).

---

## Human signed-build gate scope

| Option | Description | Selected |
|--------|-------------|----------|
| Summon over real OS chord | Press global hotkey while hidden → window reveals + focuses (MAS-NATIVE-01). | ✓ |
| Tray reveal + menu | Click tray icon; exercise Show + Settings… + Quit (MAS-NATIVE-02). | ✓ |
| Entitlement + MissingEntitlement audit | codesign shows app-sandbox + network.client, NO keychain-access-groups; no runtime MissingEntitlement (MAS-NATIVE-03). | ✓ |
| Launch-at-login absent | Settings ▸ General toggle gone (MAS-NATIVE-04); cargo-tree autostart+keyring empty on bundle. | ✓ |

**User's choice:** All four required.

---

## Claude's Discretion

- Exact cfg form for the license-module gate (`#[cfg(feature = "direct")]` vs `not(feature = "appstore")` helper).
- Whether the license mod/commands/LicenseState are gated as one group or per-item.
- Shape of the autostart-seam no-op.
- Whether `verify-appstore-bundle.sh` gains the keyring/autostart cargo-tree assertion (preferred) vs human-gate-only.

## Deferred Ideas

- `SMAppService` sandbox-safe launch-at-login (MAS-NATIVE-05, v2).
- Windows/Linux keyring arms (backlog 999.8).
- `.pkg`/ASC submission + support/privacy URLs via opener (Phase 30).
