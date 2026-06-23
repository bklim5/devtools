# Phase 28: Entitlement-Source Swap + Store License Pane - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 28-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 28-entitlement-source-swap
**Areas discussed:** Keygen compile-out + pane swap, Entitlement source + live-flip wiring, Restore vs boot-read semantics, Store License + Updates pane copy/states

---

## Area 1 — Keygen compile-out + pane swap

| Question | Options | Selected |
|---|---|---|
| Pane-swap structure | Separate components, static switch / Branch inside existing components | **Separate components, static IS_APPSTORE switch** |
| Surfaces needing a store variant | License pane / Upsell modal + triggers / Updates pane | **All three** |
| Grep-clean enforcement | Hard gate, exhaustive string list / Warn-only | **Hard gate, exhaustive string list** |

**Notes:** Static `IS_APPSTORE` boundary tree-shakes the Keygen import subtree (LicenseSettings, InlineActivation, license.tinkerdev.io strings) → satisfies MAS-BUILD-04. → D-01, D-02, D-03.

---

## Area 2 — Entitlement source + live-flip wiring

| Question | Options | Selected |
|---|---|---|
| resolveEntitlements branch | Static IS_APPSTORE, StoreKit-only / Runtime branch | **Static IS_APPSTORE branch, StoreKit-only** |
| currentEntitlements() mapping | Same intersection as baseFromLicense / Boolean owns-Pro → FULL_SET | **Same ALL_ENTITLEMENTS intersection** |
| Live unlock + refund-drop wiring | Rust bridges plugin channel → Tauri event → refreshEntitlements / Explicit re-read only | **Rust bridge → storekit://updated → refreshEntitlements** |
| Refund-drop notice | Reuse existing drop-notice / New store-specific notice | **Reuse existing drop-notice (copy adjusted)** |

**Notes:** Wires the Phase-26 `onPurchaseUpdated` placeholder for real. → D-04, D-05, D-06, D-07.

---

## Area 3 — Restore vs boot-read semantics

| Question | Options | Selected |
|---|---|---|
| Launch behavior | Silent currentEntitlements() read, no sync / No read, require Restore | **Silent currentEntitlements() read, no AppStore.sync, no auth prompt** |
| Restore button action | AppStore.sync then re-resolve / Re-read only | **AppStore.sync → refreshEntitlements (auth ok here)** |
| Restore button placement | License pane always + on upsell / Free-state only | **Always in License pane (Free + Pro) + on the upsell** |

**Notes:** Distinguishes a passive on-device cache read (boot) from an explicit sync (button) — honors "Restore never silent at launch". → D-08, D-09, D-10.

---

## Area 4 — Store License + Updates pane copy/states

| Question | Options | Selected |
|---|---|---|
| Store License pane states | Two states (Free/Pro) / More granular | **Two mutually-exclusive layouts (Pro-active reuses licensed green banner) — one at a time** (clarified: either/or, not both) |
| Buy CTA price | displayPrice + fallback / Always 'Buy Pro' no price | **Always 'Buy Pro', no in-app price** (+ mention "lifetime"); relaxes criterion 4 |
| Updates pane | Keep version, drop everything actionable / Keep version + last-checked | **Keep version + "managed by the App Store"; remove Check/Install/toggle/last-checked** |
| Wording/tone | Apple-ID/App Store managed copy / Claude drafts, review at UI gate | **App-Store-managed framing; reuse licensed UI; "Command Palette" not "⌘K"; mention "lifetime"** |

**Notes:**
- User clarified the states are either/or (one rendered per the gate), not shown simultaneously.
- User asked to reuse the existing licensed UI where possible and to write "Command Palette" instead of "⌘K".
- User asked to mention "lifetime" in the Buy copy.
- Buy price: user kept no-in-app-price (safer for 3.1.1); did not select the revert option, confirming the relaxation. → D-11, D-12, D-13, D-14, D-15.

---

## Claude's Discretion

- Exact component/file names and how the static switch is expressed.
- Final copy strings (within the D-14 rules) — finalized at the UI gate.
- Rust-side `register_listener`/`ipc::Channel` → Tauri-event bridge shape and the boot-listener mount point.
- Whether a calm "purchase pending" line is shown for Ask-to-Buy/SCA.

## Deferred Ideas

- Sandbox-safe native features → Phase 29.
- `.pkg` build + Apple Distribution signing + ASC submission → Phase 30.
- In-app `displayPrice` on Buy → dropped this phase (D-12).
- Explicit StoreKit pending-state UI → fold into a line if needed.
