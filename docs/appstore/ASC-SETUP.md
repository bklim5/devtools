# TinkerDev — App Store Connect + Apple Developer Setup Guide

*macOS-only · one non-consumable In-App Purchase (Pro unlock) · solo developer · written June 2026*

This guide takes you from "stuck at the New App dialog because Bundle ID is empty" through a fully configured App Store Connect record with a working paid In-App Purchase, in strict dependency order. The single thing blocking the New App dialog right now is that **the Bundle ID dropdown is populated only from App IDs you have already registered** in Certificates, Identifiers & Profiles — and you haven't registered one yet. So you do that first (Section 0), then come back and finish the dialog. Everything paid (the IAP, banking, the Small Business 15% rate) depends on the **Paid Applications Agreement** being active, which has an hours-long propagation delay — start it early. Where Apple's UI labels are prone to drift, I note "as of 2026 this is labeled X". Verified values for this app: name **TinkerDev**, bundle ID **`com.tinkerdev.app`** (must match `tauri.conf.json` → `identifier` *exactly*), Team / Provider Short Name **FK4HQK83WX**, platform **macOS only**, app version 0.4.1, IAP = one **non-consumable** Pro unlock at the ~US$9 tier, on-device StoreKit 2 verification, privacy = **Data Not Collected**.

---

## Do this first (you're blocked here): register the App ID

The New App dialog's **Bundle ID** field is a *dropdown*, not a free-text box. It lists App IDs you've registered. Register `com.tinkerdev.app` as an explicit App ID and it will appear in that dropdown. This is Section 1 below — do it now, then jump to Section 2 to finish the dialog.

> One-line answer: **Leave the New App dialog (Cancel), go to developer.apple.com → Certificates, Identifiers & Profiles → Identifiers → register an explicit App ID `com.tinkerdev.app`, then reopen New App — the Bundle ID will now be selectable.**

---

## 1. Register the App ID / Bundle ID

This unblocks the New App dialog. You only need an **explicit** App ID (one app, one exact bundle ID).

1. Go to **developer.apple.com → Account → Certificates, Identifiers & Profiles** (the section header reads "Certificates, Identifiers & Profiles"; the left nav item is **Identifiers**).
2. Confirm the top-right team selector shows **TinkerDev's team (FK4HQK83WX)**. If you belong to multiple teams, pick the right one before creating anything.
3. Click **Identifiers** in the sidebar, then the **+** (add) button at the top-left of the list.
4. Select **App IDs** → **Continue**.
5. On "Select a type", choose **App** (as of 2026 the choices are "App" vs "App Clip"; pick **App**) → **Continue**.
6. **Description**: a human label for *your* reference only, not shown to users. Enter something like `TinkerDev macOS`. (No special characters; this is just an internal name.)
7. **Bundle ID**: select **Explicit** (the radio next to "Explicit"; the other option, "Wildcard", cannot be used with In-App Purchase). In the field, enter exactly:

   ```
   com.tinkerdev.app
   ```

   **This must match `tauri.conf.json` → `identifier` character-for-character.** A mismatch means your signed build won't validate against this App ID and uploads will be rejected. Bundle IDs are **case-sensitive and permanent** — you cannot rename an App ID later, only delete-and-recreate. Double-check before continuing.
8. **Capabilities**: for this app you do **not** need to toggle anything special.
   - **In-App Purchase needs no App ID capability** — it is enabled by default for every explicit App ID. There is no checkbox to find; it just works.
   - **App Sandbox is NOT an App ID toggle.** App Sandbox is a *build-time entitlement* (`com.apple.security.app-sandbox`) you set in the app's entitlements file when packaging for the Mac App Store — it does not appear here, and the Mac App Store requires it at submission time regardless. Don't go hunting for a sandbox checkbox on this screen.
   - Leave everything else off. TinkerDev is offline with no iCloud, Push, Sign in with Apple, etc. Enabling unused capabilities only invites extra App Review scrutiny.
9. Click **Continue**, review, then **Register**.

The App ID now exists and `com.tinkerdev.app` will appear in the New App dialog's Bundle ID dropdown.

> Apple ref: [Register an App ID](https://developer.apple.com/help/account/identifiers/register-an-app-id/) · [Enable app capabilities](https://developer.apple.com/help/account/identifiers/enable-app-capabilities/)

---

## 2. Complete the New App dialog

Back in **App Store Connect → Apps → + (top-left) → New App**. Fill in:

1. **Platforms**: check **macOS** only. Do **not** check iOS / tvOS / visionOS — TinkerDev is macOS-only, and adding platforms here commits you to shipping on them.
2. **Name**: `TinkerDev`
   - The App Store display name has a **30-character limit** (`TinkerDev` is 9 — fine).
   - The name must be **globally unique across the entire App Store**, not just your account. If "TinkerDev" is already taken, ASC rejects it with a name-unavailable error.
   - **Fallback plan if taken:** set the *record* name to a unique variant you can live with, e.g. `TinkerDev — Dev Tools`, `TinkerDev App`, or `TinkerDev Devkit`, and keep "TinkerDev" as the marketing word in the subtitle. You can also reserve a name early to hold it. The record name can be edited later in App Information until your first version goes live.
3. **Primary Language**: choose the app's main language (e.g. **English (U.S.)**). This sets the default localization for store metadata.
4. **Bundle ID**: select **`com.tinkerdev.app`** from the dropdown (the App ID you registered in Section 1). If it's missing, the registration didn't complete or you're on the wrong team — go back to Section 1.
5. **SKU**: a private internal string, **never shown to users**, used in your sales reports. It must start with a letter or number; letters/numbers/hyphens/periods/underscores allowed. Suggested: `tinkerdev-macos-001`. Once set it's effectively permanent for the record, so keep it boring and stable.
6. **User Access**: as a solo developer, choose **Full Access** (the alternative, **Limited Access**, is for restricting which team members can see the app — irrelevant for one person).
7. Click **Create**.

You now have an app record. (Bundle ID **cannot be changed** after creation — if it's wrong, you must delete the record and start over.)

> Apple ref: [Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/) · [Add platforms](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms/)

---

## 3. Agreements, Tax, and Banking (the common blocker)

**No paid app or IAP works until the Paid Applications Agreement is active.** This is the #1 thing that silently blocks first-time IAP setup. Start it early because it propagates over hours.

1. In **App Store Connect**, go to **Business** in the top nav (as of 2026 the section is **Business**; older docs/UI call it **"Agreements, Tax, and Banking"** — same place).
2. **Sign the Paid Applications Agreement** (a.k.a. Paid Apps Agreement / Schedule 2 to the Apple Developer Program License Agreement). Only the **Account Holder** can sign it. Review and accept.
3. **Tax forms**: you cannot enter banking until tax is done, and you can't submit tax until the agreement is signed. Every developer completes a **US tax form** (W-9 if US, or a W-8 series form if outside the US). Complete any additional regional forms ASC prompts for. Provide them under the same Business section.
4. **Banking**: add a bank account to receive proceeds (requires the agreement signed + tax submitted first).
5. **Verify status**: the agreement should show **Active**. Until it's Active and tax/banking are complete, your IAP cannot reach a sellable state and you won't be paid.

**Propagation warning:** signing → "Active" status and the agreement actually unlocking paid features can take **anywhere from minutes to several hours**. If your IAP or Small Business enrollment options look greyed out, this is almost always why. Do this step first and let it bake while you continue.

> Apple ref: [Sign and update agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/) · [View agreements status](https://developer.apple.com/help/app-store-connect/manage-agreements/view-agreements-status/) · [Provide tax information](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/) · [Enter banking information](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/)

---

## 4. Apple Small Business Program (15% commission)

Cuts Apple's commission from 30% to **15%** on the first US$1M of annual proceeds. A solo dev shipping a $9 IAP almost certainly qualifies — enroll.

**Eligibility:** you and any Associated Developer Accounts must have earned **≤ US$1M in total proceeds in the prior calendar year**, and **≤ US$1M in the current year**. Brand-new developers (no prior sales) qualify immediately.

**Prerequisites:** you must be the **Account Holder**, and the **latest Paid Applications Agreement must be signed** (Section 3). The enrollment option is greyed out otherwise.

**How to enroll:**
1. App Store Connect → **Business** section (same place as Agreements, Tax, and Banking).
2. Scroll to **App Store Small Business Program** and start the application (it's short — about a minute).
3. Confirm your proceeds were under the US$1M threshold.
4. **Declare Associated Developer Accounts** — list any other Apple Developer accounts you control, or confirm there are none. (For a solo dev with one account: "none".)
5. Submit.

**When it takes effect:** your rate is adjusted **15 days after the end of the fiscal calendar month in which your enrollment is approved**. Example: approved Feb 10 → 15% rate starts ~March 14. It's not retroactive, so enroll *before* you start selling.

> Apple ref: [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/) · [Enroll in the App Store Small Business Program (news)](https://developer.apple.com/news/?id=6lyxewwp)

---

## 5. Create the non-consumable IAP product (the Pro unlock)

You can create this **now**, but it can't go to review until it's attached to your first app binary (see the flag at the end).

1. App Store Connect → **Apps → TinkerDev**.
2. In the left sidebar, under **Monetization**, click **In-App Purchases**. (As of 2026 IAPs live under the **Monetization** group; older docs say "Features → In-App Purchases" — same thing.)
3. Click the **+** (add) button.
4. **Type**: select **Non-Consumable** (perpetual, bought once, never expires, restorable on the user's other Macs — correct for a Pro unlock). Do **not** pick Consumable or any subscription type.
5. **Reference Name**: internal label, shown in ASC and Sales/Trends reports, **never on the store**. Max 64 chars. e.g. `TinkerDev Pro Unlock`.
6. **Product ID**: a **permanent**, globally-unique identifier that **your StoreKit 2 code queries by string**. Once used it can **never be reused**, even if deleted. Use a stable reverse-DNS value:

   ```
   com.tinkerdev.app.pro
   ```

   This exact string must match what `Product.products(for:)` (or your StoreKit lookup) requests in the app. Decide it once and don't change it.
7. Click **Create**. You land on the product detail page. Now fill in:
   - **Availability**: choose the countries/regions where the IAP is sold (default: all).
   - **Price Schedule / Price**: pick the price point closest to **US$9** (Apple's price tiers; e.g. the US$9.99 point — there is no exact "$9.00" tier, choose the nearest you want). All other currencies auto-map.
   - **App Store Localization** (at least your Primary Language): **Display Name** and **Description** — these *are* shown to users at the purchase sheet. e.g. Display Name `TinkerDev Pro`, Description a one-line value statement.
   - **Review Information**:
     - **Screenshot** (required): a screenshot showing the purchase in context (the paywall/unlock UI). Needs a built app to capture — see flag below.
     - **Review Notes** (optional but recommended): tell the reviewer how to reach/trigger the purchase, and that unlock is verified **on-device via StoreKit 2 with no server**.
8. Drive the product to the **"Ready to Submit"** status (all required fields + screenshot complete). It must be **Ready to Submit** before it can be included in a submission.

> **CRITICAL — first IAP rule:** Your **first** In-App Purchase **must be submitted together with a new app version (your first binary)** in the same App Review submission. It will *not* be reviewed on its own. Only after Apple approves that first IAP can future IAPs be submitted without a new build. So: create + configure the IAP now, get it to "Ready to Submit", but it stays pending until you submit it alongside the app's first build (a later packaging phase).

> Apple ref: [Create consumable or non-consumable In-App Purchases](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases/) · [Submit an In-App Purchase](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/) · [In-App Purchase statuses](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-statuses/)

---

## 6. Sandbox testers (real-purchase testing before submission)

Two distinct test mechanisms — understand the difference, especially because **macOS matters here**:

- **Local `.storekit` StoreKit configuration file (Xcode):** a fully local, offline test env that fakes products defined in the file — no ASC connection, no Apple ID, no real money. Great for early dev/unit-style flows. **Caveat for macOS:** Apple's StoreKit *configuration-file* testing has historically been flaky/unsupported on macOS targets (it's iOS-first). For a Tauri/macOS app, **don't rely on the `.storekit` file** — use real **Sandbox** testing.
- **Sandbox tester (App Store Connect):** a fake Apple Account that buys your *real* ASC-configured products against Apple's sandbox servers, with **no charge**. This is the pre-submission "does a real purchase actually work end-to-end" test, and it's the right path for macOS.

**Create a sandbox tester:**
1. App Store Connect → **Users and Access** → **Sandbox** (tab) → **Testers** → **+**.
2. Fill in name + an **email that is NOT already an Apple ID / Apple Account**. Use a plus-alias (e.g. `you+tinkerdev-sbx@gmail.com`) so it's guaranteed unused. Set a region (controls the sandbox storefront/currency) and password.
3. Save. (You never need to verify this email for sandbox use.)

**Use it on your Mac:**
1. Build and run a **development-signed** copy of TinkerDev (your local signed build, not the App Store binary).
2. Trigger the purchase in-app. When the sandbox purchase sheet asks you to sign in, **enter the sandbox tester credentials** — *not* your real Apple Account. (On modern macOS, sign in to the sandbox account when prompted by the purchase flow; do **not** sign your real Apple ID into the sandbox.)
3. Complete the purchase — no money moves. Verify your StoreKit 2 on-device entitlement check flips the app to Pro, and that "Restore Purchases" re-grants it.
4. Note: product metadata can take **up to ~1 hour** to appear in sandbox after you edit it in ASC.

> Apple ref: [Overview of testing in sandbox](https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox/) · [Testing In-App Purchases with the sandbox](https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox) · [Setting up StoreKit Testing in Xcode](https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode/)

---

## 7. Signing prerequisites (brief — full packaging is a later phase)

Full Mac App Store packaging/signing is its own phase; this is just what to create *now* if you want to get ahead. Mac App Store distribution needs:

- **Apple Distribution certificate** — signs the `.app` for App Store distribution. (The legacy name was "Mac App Distribution"; the modern unified cert is **Apple Distribution**, covering all platforms.)
- **Mac Installer Distribution certificate** — signs the `.pkg` installer that you upload to the Mac App Store.
- **Mac App Store provisioning profile** tied to the App ID **`com.tinkerdev.app`** and your Apple Distribution cert.

**To create them now (optional):** Certificates, Identifiers & Profiles →
1. **Certificates → +** → choose **Apple Distribution** → follow the CSR upload steps (generate a Certificate Signing Request from Keychain Access on your Mac) → download + install.
2. **Certificates → +** → choose **Mac Installer Distribution** → repeat CSR → download + install.
3. **Profiles → +** → under macOS choose the **Mac App Store** distribution profile type → select App ID **`com.tinkerdev.app`** → select your **Apple Distribution** cert → name it → download.

Notes: only the **Account Holder/Admin** can create distribution certs; **one of each distribution cert type per team**. If you later edit the App ID's capabilities, you must **regenerate** any profile using it. App Sandbox entitlement is applied at build/signing time, not here.

> Apple ref: [Certificates overview](https://developer.apple.com/help/account/certificates/certificates-overview/) · [Create an App Store provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/) · [Certificates (support)](https://developer.apple.com/support/certificates/)

---

## 8. What you can do NOW vs what must wait for the first build

**Do now (no binary needed):**
- Register the App ID (Section 1) — **unblocks everything**.
- Create the app record (Section 2).
- Sign Paid Applications Agreement + tax + banking (Section 3) — **start ASAP for propagation**.
- Enroll in Small Business Program (Section 4).
- Create + configure the IAP and bring it to **"Ready to Submit"** (Section 5) — *minus* the review screenshot if you don't have a built UI yet.
- Create a sandbox tester (Section 6).
- Optionally create the distribution certs + provisioning profile (Section 7).

**Must wait for the first build:**
- **Capturing the IAP review screenshot** of the real paywall/unlock UI (needs a running build).
- **Real sandbox purchase testing** (needs a development-signed build).
- **Submitting the IAP** — the first IAP can only be reviewed **attached to the first app binary** in the same submission.
- **App Store screenshots / app metadata finalization** and the actual App Review submission.

**Propagation / timing callouts (items with delays):**
- **Paid Applications Agreement → Active:** minutes to **several hours**. Blocks IAP sellability, banking, and Small Business enrollment until done.
- **Small Business Program 15% rate:** effective **~15 days after the end of the month** your enrollment is approved — not immediate, not retroactive.
- **IAP metadata → sandbox:** up to **~1 hour** to appear/refresh.
- **App Review (the build + first IAP):** typically a day or two, variable — out of your control.

---

## Timing & gotchas summary

- The New App dialog's **Bundle ID is a dropdown fed by registered App IDs** — register `com.tinkerdev.app` first or you stay blocked.
- **Bundle ID must exactly match `tauri.conf.json` → `identifier`** (`com.tinkerdev.app`), is case-sensitive, and is **permanent** on both the App ID and the app record.
- **In-App Purchase = no App ID capability** (on by default); **App Sandbox = build-time entitlement**, not an App ID toggle, but **required** for Mac App Store.
- **Paid Applications Agreement gates everything paid** and **propagates over hours** — sign it first.
- **Product ID (`com.tinkerdev.app.pro`) is permanent and is the string your StoreKit code queries** — never reusable once created.
- **First IAP must ship with the first app binary** in the same review; get it to **"Ready to Submit"** and hold.
- **macOS: use Sandbox testers, not the `.storekit` file** for real purchase testing; sandbox tester email must not already be an Apple Account.
- **Small Business 15% is not retroactive** — enroll before selling.
- Privacy: declare **Data Not Collected** in the App Privacy section (TinkerDev is offline/no-tracking) when you fill store metadata.

---

## Sources (Apple, accessed June 2026)

- Register an App ID — https://developer.apple.com/help/account/identifiers/register-an-app-id/
- Enable app capabilities — https://developer.apple.com/help/account/identifiers/enable-app-capabilities/
- Add a new app — https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/
- Add platforms — https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms/
- Sign and update agreements — https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements/
- View agreements status — https://developer.apple.com/help/app-store-connect/manage-agreements/view-agreements-status/
- Provide tax information — https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/
- Enter banking information — https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/
- App Store Small Business Program — https://developer.apple.com/app-store/small-business-program/
- Enroll in the App Store Small Business Program (news) — https://developer.apple.com/news/?id=6lyxewwp
- Create consumable or non-consumable In-App Purchases — https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases/
- Submit an In-App Purchase — https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase/
- In-App Purchase statuses — https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-statuses/
- Overview of testing in sandbox — https://developer.apple.com/help/app-store-connect/test-in-app-purchases/overview-of-testing-in-sandbox/
- Testing In-App Purchases with the sandbox — https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox
- Setting up StoreKit Testing in Xcode — https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode/
- Certificates overview — https://developer.apple.com/help/account/certificates/certificates-overview/
- Create an App Store provisioning profile — https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/
- Certificates (support) — https://developer.apple.com/support/certificates/
