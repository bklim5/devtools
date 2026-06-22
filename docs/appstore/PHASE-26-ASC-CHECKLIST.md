# Phase 26 — App Store Connect Setup Checklist (the Phase-26 human gate)

*In-order, value-filled checklist. This does NOT re-explain the steps — it sequences them and gives the exact values. Open the referenced `ASC-SETUP.md` section for the full how-to (each step links its section).*

**Why this exists (D-08/D-09):** the Phase 26 human gate is a **real Sandbox-tester purchase round-trip** of `com.tinkerdev.app.pro`. That needs four Apple-side things in place that **only you can create on Apple's web console** (no CLI/API for App-ID registration, agreement signing, IAP creation, or Sandbox testers). The agent produced this list and pauses; **you do the clicks.**

**Verified values for every step (do not improvise these):**

| Field | Value |
|---|---|
| App name | **TinkerDev** |
| Bundle ID / App ID | **`com.tinkerdev.app`** — must match `src-tauri/tauri.conf.json → identifier` character-for-character (case-sensitive, **permanent**) |
| Team / Provider Short Name | **FK4HQK83WX** |
| Platform | **macOS only** |
| IAP product type | **Non-Consumable** (perpetual, restorable) |
| IAP Product ID | **`com.tinkerdev.app.pro`** — permanent, **never reusable** once created; the exact string StoreKit queries |
| IAP price | nearest tier to **~US$9** (e.g. the US$9.99 point — there is no exact $9.00 tier) |
| IAP Display Name | **TinkerDev Pro** |
| Sandbox tester email | a **plus-alias NOT already an Apple ID** (e.g. `you+tinkerdev-sbx@gmail.com`) |

---

## Do these IN ORDER (sequenced by dependency — the slow item is first)

### ☐ 1. Sign the Paid Applications Agreement FIRST — *start this before anything else*
**→ ASC-SETUP §3** (Agreements, Tax, and Banking).
- **Account Holder** signs the Paid Applications Agreement (Schedule 2).
- Complete the **US tax form** (W-9 if US / W-8 series if outside the US) + any regional forms.
- Add **banking** (requires agreement signed + tax submitted first).
- **Why first:** signing → "Active" **propagates over minutes to several hours** and gates *everything paid* (the IAP can't reach a sellable state, banking, and Small-Business enrollment are greyed out until it's Active). Kick it off, then continue the steps below while it bakes.
- **Done =** the agreement status shows **Active** (and tax + banking complete).

### ☐ 2. Register the explicit App ID `com.tinkerdev.app`
**→ ASC-SETUP §1** (Certificates, Identifiers & Profiles → Identifiers).
- developer.apple.com → confirm team **FK4HQK83WX** is selected → Identifiers → **+** → **App IDs** → **App**.
- Bundle ID = **Explicit**, enter exactly **`com.tinkerdev.app`** (Wildcard cannot be used with In-App Purchase).
- **Capabilities: toggle nothing.** In-App Purchase needs **no App ID capability** (on by default). **App Sandbox is a build-time entitlement, NOT an App ID toggle** — don't hunt for a sandbox checkbox here.
- **Done =** `com.tinkerdev.app` now appears in the New App dialog's Bundle-ID dropdown.

### ☐ 3. Create the app record (if it does not already exist)
**→ ASC-SETUP §2** (App Store Connect → Apps → + → New App).
- Platforms = **macOS only**; Name = **TinkerDev**; Bundle ID = **`com.tinkerdev.app`** (the App ID from step 2); SKU = a stable private string (e.g. `tinkerdev-macos-001`); User Access = Full Access.
- If "TinkerDev" is taken globally, use the §2 fallback (e.g. `TinkerDev — Dev Tools`) for the record name.
- **Done =** an app record exists for `com.tinkerdev.app` (Bundle ID is permanent after creation).

### ☐ 4. Enroll in the Small Business Program (15%) — optional-but-recommended
**→ ASC-SETUP §4** (Business section).
- Requires the agreement from step 1 **signed** (option is greyed out otherwise). Confirm <US$1M proceeds, declare Associated Accounts ("none" for a solo dev), submit.
- **Note:** the 15% rate is effective ~15 days after the end of the enrollment-approval month — **not retroactive**, so enroll before selling. Not a Phase-26 gate blocker; do it now so it's bedded in.
- **Done =** Small Business Program shows enrolled/applied.

### ☐ 5. Create the non-consumable product `com.tinkerdev.app.pro` → drive to Ready to Submit
**→ ASC-SETUP §5** (Apps → TinkerDev → Monetization → In-App Purchases).
- **+** → Type = **Non-Consumable**.
- Reference Name (internal) = e.g. `TinkerDev Pro Unlock`.
- **Product ID = `com.tinkerdev.app.pro`** (permanent, never reusable, the exact string StoreKit queries).
- Price = nearest tier to **~US$9**; Display Name (shown at the purchase sheet) = **TinkerDev Pro**; one-line Description.
- Drive it to **Ready to Submit** — *the IAP review screenshot may be deferred* (it needs a built paywall UI, which is Phase 28/30; the product can reach Ready-to-Submit minus only the screenshot for now).
- **First-IAP rule (do NOT act on it now):** the first IAP can only be **reviewed attached to the first app binary** in the same submission — that submission is **Phase 30**. Get it Ready-to-Submit and hold.
- **Done =** product status **Ready to Submit** (minus the screenshot if no shippable UI yet).

### ☐ 6. Create ≥1 Sandbox tester
**→ ASC-SETUP §6** (Users and Access → Sandbox → Testers).
- **+** → name + a **plus-alias email NOT already an Apple ID** (e.g. `you+tinkerdev-sbx@gmail.com`) + region + password. You never verify this email for sandbox use.
- **Security (T-26-11):** sign the *sandbox tester* into the purchase sheet during the test — **NEVER sign your real Apple ID into the sandbox**. This keeps your real account out of the test path.
- **macOS note (OQ-1):** macOS uses **Sandbox testers**, NOT the local `.storekit` configuration file (config-file testing is iOS-first / unsupported on macOS). The `.storekit` file is **NOT load-bearing** for this gate — the live test runs against Apple's sandbox servers via the tester. (A `.storekit` file may exist as a best-effort dev nicety only.)
- **Done =** ≥1 tester listed under Users and Access → Sandbox → Testers.

---

## After the four prerequisites are in place

Confirm all four are true, then return to the agent and type the resume signal (`ASC ready`) — or describe what's still pending (e.g. "agreement still propagating to Active"):

- ☐ Paid Applications Agreement = **Active**
- ☐ App ID **`com.tinkerdev.app`** registered (Team **FK4HQK83WX**)
- ☐ Product **`com.tinkerdev.app.pro`** = **Ready to Submit** (screenshot deferrable)
- ☐ ≥1 **Sandbox tester** exists

The real sandbox purchase round-trip itself is driven later (Plan 06 human gate) on a development-signed build — this checklist only puts the four prerequisites in place so that gate is unblocked.

---

## Deferred to Phase 30 — do NOT do these now

These are **App Review / store-metadata** items, explicitly out of scope for Phase 26 (they need a finished shippable UI and the first-binary submission):

- App Store **screenshot**s (and the IAP review **screenshot** of the real paywall — capture needs a built UI).
- App **privacy label** / privacy nutrition label = **Data Not Collected** + `PrivacyInfo.xcprivacy`.
- **Age rating** (4+).
- **Notes-for-Review** for the IAP / app.
- The actual **App Review submission** (the first IAP ships *attached to* the first app binary in the same submission — Phase 30).
- Distribution **certs + `.pkg`** signing / Mac App Store provisioning profile (**ASC-SETUP §7** — optional now, **required in Phase 30**).

---

*Phase: 26-storekit-bridge-spike · Plan 04 · references `docs/appstore/ASC-SETUP.md` §§1–8 · D-08/D-09*
