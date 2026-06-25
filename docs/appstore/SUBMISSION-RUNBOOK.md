# TinkerDev — Mac App Store Submission Runbook (D-05)

*The single master checklist for the Phase-30 terminal ship-gate. macOS only · one non-consumable IAP (`com.tinkerdev.app.pro`) · solo developer · written June 2026.*

This runbook ties together every committed metadata artifact, the App Store Connect (ASC) setup delta, the `.pkg` build, the human ship-gate walkthrough, and the Transporter upload — in strict order. It does **not** re-explain the ASC web-console clicks: those live in `ASC-SETUP.md` (§§1–8) and the Phase-26 prerequisite list in `PHASE-26-ASC-CHECKLIST.md`. This document is what *you* (the human) work top-to-bottom at the ship-gate.

**Cross-references (read alongside this file):**
- `ASC-SETUP.md` — the Apple-cited web-console how-to (App ID, agreement, IAP, certs, sandbox testers).
- `PHASE-26-ASC-CHECKLIST.md` — the four prerequisites already put in place in Phase 26 + its explicit "Deferred to Phase 30" list (lines ~84–93), which this phase closes.
- `Notes-for-Review.md` — what an App Review tester does to exercise the Pro IAP (paste into the ASC "Notes for Review" field).
- `screenshots/README.md` — the MAS screenshot spec; capture the PNGs *during* the walkthrough below.
- `REFUND-TEST-RUNBOOK.md` — the refund → Pro-drop Sandbox Path B reused in the walkthrough.

**Locked submission values (do not improvise):**

| Field | Value |
|---|---|
| App name | **TinkerDev** |
| Bundle ID | **`com.tinkerdev.app`** (matches `src-tauri/tauri.conf.json → identifier`, case-sensitive, permanent) |
| IAP Product ID | **`com.tinkerdev.app.pro`** (non-consumable, permanent) |
| Privacy label | **Data Not Collected** (offline app, no analytics/telemetry; backed by `PrivacyInfo.xcprivacy`) |
| Age rating | **4+** |
| Support URL | **`https://tinkerdev.io/support`** (must return 200 before Submit — see step 6) |
| Privacy URL | **`https://tinkerdev.io/privacy`** (channel-aware copy — see step 6) |
| Team / Provider | **FK4HQK83WX** |

---

## Step 1 — Pre-build gate: confirm all source has landed (Build LAST)

The single hardest-won discipline: **build the `.pkg` only after every Phase 26–29 source change is committed.** In a multi-plan milestone an earlier build can ship a *stale* artifact.

- ☐ Confirm Phases 26 (StoreKit bridge), 27 (build-variant seam), 28 (entitlement swap + store license pane), 29 (sandbox-safe native features) are all green and committed.
- ☐ The Plan-03 build script (`build-appstore-pkg.sh` / `pnpm tauri:build:appstore:pkg`) verifies the signed bundle's binary mtime is **newer than the last source commit** before proceeding — a FATAL freshness check. Do not hand off a `.pkg` whose binary predates the last source change.

## Step 2 — Human prerequisite (BLOCKING): the Mac Installer Distribution certificate

The `.pkg` installer that you upload to the Mac App Store is signed with a **Mac Installer Distribution** certificate (distinct from the Apple Distribution cert that signs the `.app`).

- ☐ Confirm a **Mac Installer Distribution** certificate exists in your login keychain (`security find-identity -v` lists a "3rd Party Mac Developer Installer" / "Mac Installer Distribution" identity).
- ☐ The **Apple Distribution** cert (signs the `.app`) is already present from earlier phases; **only the installer cert may be missing.**
- ☐ If absent, create it per **`ASC-SETUP.md §7`** (Certificates → + → Mac Installer Distribution → CSR → download + install). Only the Account Holder/Admin can create distribution certs; there is one per team.

**This is a hard blocker for Plan 03's build** — `productbuild` cannot sign the `.pkg` without it.

## Step 3 — Build + local-verify the `.pkg`

- ☐ Run the Plan-03 build script (`pnpm tauri:build:appstore:pkg`). It produces a **distribution-signed `.pkg`** and runs all local gates (universal-binary `lipo` check, app-sandbox + network.client entitlements, plugins-absent, 13.0 floor, embedded provisioning profile, deep-signature validity, the D-03/D-04 Keygen/updater-UI purity sentinels, and the bundle-freshness link from Step 1).
- ☐ Confirm the script exits 0 and reports the `.pkg` path.

## Step 4 — Human ship-gate walkthrough (D-04)

WebDriver cannot drive StoreKit purchases / sandbox / refunds — this is the mandatory manual round-trip (mirrors the v1.6 live-purchase gate).

- ☐ **Launch the DEV-signed `.app`** (the development-signed sandboxed bundle), **NOT the distribution `.pkg`'s app** — a distribution-signed app will not launch locally (AMFI -413; the distribution profile is for App Store delivery, not local execution). See `MEMORY` / `mas-signing-dev-vs-distribution`.
- ☐ **Sandbox purchase round-trip:** sign the *Sandbox tester* (never your real Apple ID) into the purchase sheet → tap "Buy Pro" → complete → Pro unlocks live (theming / ordering / ⌘K) with no relaunch (MAS-IAP-02).
- ☐ **Restore on a fresh container:** reset the app state, "Restore Purchases" re-unlocks Pro (MAS-IAP-03).
- ☐ **Refund → Pro-drop:** follow the Sandbox Path B in `REFUND-TEST-RUNBOOK.md` → Pro drops live + the "Pro features turned off" notice fires (MAS-IAP-05).
- ☐ **Capture the screenshots here** (the live UI states) per `screenshots/README.md` and drop the PNGs into `screenshots/`.

## Step 5 — Transporter upload (D-01, human)

ASC build delivery for a Tauri `.pkg` is done with **Transporter.app** (no ASC API key is used this milestone — D-02).

- ☐ Install **Transporter** from the Mac App Store (if not already).
- ☐ Open Transporter, sign in with your Apple Account, and **upload the distribution-signed `.pkg`** from Step 3.
- ☐ If the upload bounces, read the **ITMS** reason. The two documented Tauri-MAS bounce modes are **ITMS-90238** and **ITMS-90296** — each already has a local pre-check run by the Plan-03 `.pkg` script, so a clean local build should not hit them; if it does, re-check the entitlements / bundle-structure output of Step 3.
- ☐ Wait for the build to finish **processing** in ASC (minutes to ~an hour).

## Step 6 — ASC finalize + Submit for Review (D-04, human)

In App Store Connect → Apps → TinkerDev:

- ☐ Confirm the uploaded build has finished processing and is selectable for the version.
- ☐ **Attach the IAP** `com.tinkerdev.app.pro` to this version (first-IAP rule: the first IAP is reviewed *attached to* the first binary, in the same submission — see `ASC-SETUP.md §5`). Confirm the IAP is **Ready to Submit** (including its review screenshot from Step 4).
- ☐ **App Privacy** → declare **Data Not Collected** (offline, no analytics/telemetry; consistent with the bundled `PrivacyInfo.xcprivacy`).
- ☐ **Age rating** → **4+**.
- ☐ **Screenshots** → upload the captures from Step 4 (see `screenshots/README.md` for resolution + which states).
- ☐ **App Information** → set **Support URL** = `https://tinkerdev.io/support` and **Privacy Policy URL** = `https://tinkerdev.io/privacy`. **Before clicking Submit, open both URLs in a browser and confirm they return 200** (the `/support` page is new this phase; `/privacy` was edited to be channel-aware — see the cross-repo deliverables below).
- ☐ Paste the contents of `Notes-for-Review.md` into the **App Review → Notes** field (and attach the sandbox tester credentials so the reviewer can exercise the purchase).
- ☐ Click **Submit for Review.**

> **Terminal state for this milestone (D-04):** the goal is *uploaded + everything Ready to Submit + Submitted for Review*. Apple's review outcome is out of our control and out of scope.

---

## Step 7 — Deferred-item delta (closes `PHASE-26-ASC-CHECKLIST.md` lines ~84–93)

The Phase-26 checklist explicitly deferred these App-Review / store-metadata items to Phase 30. Status here:

| Deferred item (from Phase 26) | Closed by |
|---|---|
| App Store **screenshots** + the IAP review screenshot of the real paywall | **Human** — captured in Step 4 (spec in `screenshots/README.md`) |
| App **privacy label** = Data Not Collected + `PrivacyInfo.xcprivacy` | `PrivacyInfo.xcprivacy` landed in Plan 30-01; label set by **human** in Step 6 |
| **Age rating** (4+) | **Human** — set in Step 6 |
| **Notes-for-Review** for the IAP / app | **This phase** — `Notes-for-Review.md` (pasted by human in Step 6) |
| The actual **App Review submission** | **Human** — Step 6 (Submit for Review) |
| Distribution **certs + `.pkg`** signing / Mac App Store provisioning profile | Installer cert = **human** Step 2; `.pkg` build = Plan 03 (Step 3) |

## Cross-repo URL deliverables (D-07) — referenced from Step 6

Two pages in the **`tinkerdev-io`** repo back the ASC Support + Privacy URLs:

- **`/support`** (new) — ASC's Support URL field requires an http(s) URL, not a `mailto:`. The page reuses the `LegalShell` + `SUPPORT_EMAIL` pattern.
- **`/privacy`** (edited, channel-aware) — the store build has the licensing service (Keygen) and the update checker **compiled out** (Phases 28/29); its only network actor is Apple's StoreKit. The copy now clarifies an "App Store edition" while keeping the direct-channel disclosures (Keygen / Lemon Squeezy / Resend / updater) true. A false claim on either channel is a compliance + trust risk (threat T-30-05).

**The human deploys both pages live and verifies the two URLs return 200 (Step 6) before clicking Submit.**
