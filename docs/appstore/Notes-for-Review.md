# TinkerDev — Notes for App Review (D-05)

*Paste this into App Store Connect → your version → **App Review Information** → the **Notes** field. Leave **"Sign-in required" UNCHECKED** — TinkerDev has no account/login, and App Review tests the IAP with their own internal sandbox accounts (do NOT put a Sandbox Apple ID in the sign-in fields).*

---

## What TinkerDev is

TinkerDev is an offline, keyboard-driven developer-utility app for macOS (Protobuf decoding, JWT, Base64/Hex, hashing, JSON/XML formatting, and more). **Every tool works fully offline and requires no purchase, no account, and no login.** The app collects **no data** — nothing you paste leaves your machine, and there is no analytics or telemetry. (App Privacy is declared **Data Not Collected**.)

## The In-App Purchase

There is **one** non-consumable In-App Purchase:

- **Product ID:** `com.tinkerdev.app.pro`
- **Type:** Non-consumable (perpetual, restorable)
- **What it unlocks:** cosmetic/quality-of-life Pro features — custom theming/appearance and tool ordering. The core tools are free regardless.

**Entitlement verification is entirely on-device.** The Pro unlock is verified using **StoreKit 2 JWS** (Apple's signed transaction, checked against Apple's public keys) — **serverless: no account, no login, and no network call beyond Apple's own StoreKit**. There is no TinkerDev licensing server involved in this build; the App Store edition has our external licensing service compiled out.

## How to exercise the purchase (step-by-step)

1. Launch TinkerDev. All tools are usable immediately, offline, with no purchase.
2. Open **Settings ▸ License** (or trigger any "Unlock Pro" affordance).
3. Tap **"Buy Pro"**. The native StoreKit purchase sheet appears.
4. Complete the purchase with the provided Sandbox tester account.
5. **Pro unlocks live, with no relaunch** — custom theming/appearance, tool ordering, and the ⌘K command palette enhancements become available immediately.
6. To verify restore: on a fresh install (or after removing local state), tap **"Restore Purchases"** in Settings ▸ License — Pro re-unlocks for the same Apple ID.

## Notes

- The app is **macOS only** and runs fully **offline** outside of the StoreKit purchase/restore flow.
- No data is collected; no analytics or telemetry; no third-party SDKs that phone home.
- Support: https://tinkerdev.io/support · Privacy: https://tinkerdev.io/privacy
