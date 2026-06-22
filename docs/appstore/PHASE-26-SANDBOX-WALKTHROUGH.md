# Phase 26 — Sandbox-Tester Round-Trip Walkthrough (the human gate)

**Plan:** 26-06 (the mandatory live purchase gate — Success criteria 1 + 4, D-06).
**Date created:** 2026-06-22.
**Who runs this:** YOU. The agent cannot drive the native StoreKit sheet or the sandbox
sign-in (out-of-process system UI, WebDriver-structurally-impossible — D-06). The agent
produced this in-order checklist; you execute it on a **distribution-signed sandboxed
`.app`** and record the outcomes in the results table at the bottom. The agent then folds
criteria 3 + 4(check 2) into `PHASE-26-BRIDGE-VIABILITY.md` and stamps the go/no-go.

**Do NOT fabricate results.** Every row in the results table is something you observed
live. "Couldn't observe" is an honest FAIL, not a pass.

---

## What this gate proves

The longest-pole dependency of the whole v1.8 milestone: that the live native StoreKit
sheet + on-device serverless verify actually work end-to-end on a signed, sandboxed build
under a Sandbox tester. It confirms the two criteria the agent could NOT verify in Plan 05:

- **Criterion 3** — the sheet presents and handles `success` / `userCancelled` / `pending`
  CALMLY, the granted `pro.*` code is observable, and a relaunch fires **no** duplicate
  transaction (proves `Transaction.finish()` actually finished — Codex #4).
- **Criterion 4, check 2 of 2** — a **process-scoped live network capture** during a
  purchase shows ZERO app-originated outbound beyond Apple StoreKit (the static source
  audit was check 1 of 2, already PASS in `PHASE-26-BRIDGE-VIABILITY.md`). BOTH checks must
  pass for the serverless-verify criterion (MAS-IAP-04).

---

## Prerequisites (confirm ALL before you start)

These were satisfied by Plan 04 (`PHASE-26-ASC-CHECKLIST.md`) — re-confirm:

- ☐ Paid Applications Agreement = **Active** (ASC → Business).
- ☐ App ID **`com.tinkerdev.app`** registered (Team **FK4HQK83WX**).
- ☐ Non-consumable **`com.tinkerdev.app.pro`** ("TinkerDev Pro Unlock") = **Ready to Submit**
  (the ~US$9 tier, with a price). *Sandbox propagation: product edits can take up to ~1h to
  appear in the sandbox — if "Fetch products" returns empty at step 3, wait and retry.*
- ☐ ≥1 **Sandbox tester** exists: **`bkbklim+tinkerdev@gmail.com`** (US storefront).

---

## STEP 0 — Build a DISTRIBUTION-SIGNED sandboxed `.app` (you do this; it cannot be ad-hoc)

The Plan-05 spike `.app` at
`src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app` (built
2026-06-22 13:54) is **AD-HOC signed** (`signingIdentity: "-"`). The live StoreKit sheet
**will not present** on an ad-hoc binary — StoreKit requires the app be signed with an
**Apple Distribution** certificate AND carry an embedded **Mac App Store provisioning
profile** whose App ID (`com.tinkerdev.app`) grants the in-app-purchase / sandbox
capability. So you must REBUILD with a distribution identity.

### 0a. Create the distribution cert + profile (ASC-SETUP §7), if not already present

Per **`ASC-SETUP.md` §7** (only the Account Holder/Admin can create these; one of each
distribution cert type per team):

1. **Certificates → +** → **Apple Distribution** → generate a CSR from Keychain Access →
   download + install. (Signs the `.app` for App Store distribution.)
2. **Certificates → +** → **Mac Installer Distribution** → repeat the CSR → download +
   install. (Signs the `.pkg` — not needed to *launch* the app, but create it now; Phase 30
   needs it.)
3. **Profiles → +** → macOS → **Mac App Store** distribution profile → App ID
   **`com.tinkerdev.app`** → your **Apple Distribution** cert → name + download it.

Confirm the cert is installed:

```sh
security find-identity -p codesigning -v | grep "Apple Distribution"
```

You should see `Apple Distribution: Boon Khai Lim (FK4HQK83WX)` (NOT just the existing
`Developer ID Application` — that one is for the direct/notarised channel and CANNOT sign a
Mac App Store build).

### 0b. Rebuild with the distribution identity + embedded profile

Use the **per-invocation appstore build flags** recorded in `PHASE-26-BRIDGE-VIABILITY.md`
(base `tauri.conf.json` stays at 10.15 / no appstore overlay — D-12), but swap the signing
identity from ad-hoc to **Apple Distribution** and embed the Mac App Store provisioning
profile. Place the downloaded profile at e.g. `src-tauri/embedded.provisionprofile`, then:

```sh
MACOSX_DEPLOYMENT_TARGET=13.0 pnpm tauri build --features appstore \
  --target universal-apple-darwin --bundles app \
  --config '{"bundle":{"macOS":{
      "entitlements":"entitlements.appstore.plist",
      "minimumSystemVersion":"13.0",
      "signingIdentity":"Apple Distribution: Boon Khai Lim (FK4HQK83WX)",
      "provisioningProfile":"embedded.provisionprofile"}}}'
```

> **CRITICAL — DO NOT grant the webview `iap:default` (harness security correction,
> T-26-18b).** The Plan-05 spike build originally added an `iap:default` capability overlay;
> that was DROPPED. `iap:default` exposes the plugin's RAW IPC commands
> (`plugin:iap|purchase`, `restore_purchases`, …) to `invoke` from the renderer — a
> compromised webview could then bypass the entire `iap_*` wrapper boundary (the product-id
> pin + the fail-closed grant core + the `{ code }` error shaping). MODE A reaches the
> plugin **Rust-side** via `IapExt::iap()`; that path does NOT go through the webview→plugin
> IPC capability, so the webview needs **no** iap capability at all. The `--config` overlay
> above grants ONLY the entitlements + signing — **NO `app.security.capabilities` iap
> grant, NO `plugin:iap|*` permission.** Confirm the Rust-side path still works without it
> (it should — capabilities gate only webview→plugin IPC, not the Rust extension API). If
> the live round-trip works with NO iap capability, that is the proof the Phase-27 overlay
> must NEVER re-grant it.

The final non-zero exit is ONLY the absent updater-signing key
(`TAURI_SIGNING_PRIVATE_KEY` → the `.app.tar.gz` updater artifact) — per the harness rule,
**confirm via the bundle binary, not the exit code.** The `.app` itself is built + signed.

### 0c. Confirm the rebuild is DISTRIBUTION-signed (not ad-hoc) before launching

```sh
APP=src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app
codesign -dvvv "$APP" 2>&1 | grep -i "Authority\|flags"   # expect "Apple Distribution: …", NOT flags=adhoc
codesign -d --entitlements - "$APP" 2>&1 | grep -i "app-sandbox\|network.client"  # both true
# embedded profile present:
ls "$APP/Contents/embedded.provisionprofile" 2>/dev/null && echo "profile embedded" || echo "NO PROFILE — sheet will not present"
lipo -archs "$APP/Contents/MacOS/devtools-app"   # x86_64 arm64
```

If `codesign -dvvv` still shows `flags=…adhoc` or there's no embedded profile, STOP and fix
0a/0b — an ad-hoc / profile-less build cannot present the live StoreKit sheet.

> **No-stale-build rule:** this rebuild MUST be the LAST build step — verify the bundle
> binary mtime is newer than the last source commit before the walkthrough. Never run the
> round-trip against a stale `.app`.

---

## STEP 1 — Launch + white-screen check (Pitfall 2)

1. Launch the distribution-signed sandboxed `.app` from STEP 0.
2. Confirm it **renders the UI** — it does NOT white-screen. (`network.client` is the
   WKWebView IPC channel; if it's missing the webview can't talk to Rust and you get a blank
   window.) **If blank → STOP.** The entitlement/harness is wrong, not StoreKit — fix the
   build before going further.

---

## STEP 2 — Open the spike block

1. Open **Settings ▸ License** (the gear, or the `#/settings/license` deep link).
2. Locate the temporary **"StoreKit IAP spike (temporary)"** block (subtitle: "Phase 26 dev
   scaffolding — drives the native purchase sheet. Removed in Phase 28.";
   `data-testid="iap-spike"`). It has three buttons: **Fetch products**, **Buy Pro
   (spike)**, **Restore (spike)**, and a status readout line below them.

---

## STEP 3 — Fetch products

1. Click **Fetch products**.
2. **Expect:** the readout shows **`com.tinkerdev.app.pro — TinkerDev Pro ($9.99)`** (id —
   display name — price). This proves `getProducts` reaches StoreKit AND the ASC product
   propagated.
   - If it shows **"No products (direct build / no-op arm)"** or stays empty: the ASC
     product hasn't propagated to the sandbox yet (up to ~1h), OR you're not on a real
     appstore-feature build. Wait + retry; if it persists after ~1h, that's a criterion-3
     concern — record it.

---

## STEP 4 — Buy Pro (success) + Cancel (calm)

### 4a. Success path

1. Click **Buy Pro (spike)**.
2. The **native StoreKit purchase sheet** presents (out-of-process system UI).
3. When prompted to sign in, **enter the SANDBOX TESTER credentials
   (`bkbklim+tinkerdev@gmail.com`)** — **NEVER your real Apple ID** (T-26-11; this keeps your
   real account out of the test path). No money moves on a sandbox purchase.
4. Complete the purchase.
5. **Expect:** the readout shows **`Purchased — entitlements: pro.theming, pro.ordering`**
   (the granted `pro.*` codes from the verified transaction, routed through the Plan-01
   fail-closed grant core). The presence of the `pro.*` codes is the criterion-3 success
   proof.

### 4b. userCancelled path (the harness-fix validation — this MUST be calm)

1. Click **Buy Pro (spike)** again.
2. When the sheet presents, **tap Cancel** (dismiss it without buying).
3. **Expect:** the readout shows the CALM **`Purchase cancelled`** — **NOT** an error, NOT a
   red banner, NOT "IAP unavailable (code: …)", NOT an uncaught throw, and it grants nothing.
   - *Why this matters:* the harness `/code-review` caught that a routine cancel was
     originally mapped to `purchaseFailed` (an error). That fix is what you're validating
     here. A non-calm cancel = the harness fix regressed → record FAIL.

### 4c. pending / Ask-to-Buy (best-effort only)

- Pending (Ask-to-Buy) is hard to force without Family-Sharing config. If you can exercise
  it, **expect** `Pending — waiting for approval` (calm, no grant). If you can't trigger it
  live, that's fine — the pending handler is proven by the Plan-01 unit core + code
  inspection (A3 / OQ-1). Mark it `best-effort` in the table.

---

## STEP 5 — Relaunch / transaction-replay check (Codex #4, Pitfall 4)

This proves `Transaction.finish()` actually finished — an unfinished transaction REPLAYS on
every launch.

1. After the **successful** purchase in 4a, **QUIT** the `.app` completely.
2. **RELAUNCH** the same distribution-signed `.app`.
3. **Expect:** NO duplicate transaction re-fires — no surprise purchase sheet, no
   re-prompt, no spurious "Purchased — entitlements: …" toast on launch. The app reads the
   already-finished, already-owned state CALMLY.
   - *Failure:* a duplicate transaction OR a re-prompt on relaunch means
     `Transaction.finish()` is NOT actually finishing. Record it as a **finish() FAILURE**
     (it rides into Phase 28 if not fixed) — do not let it pass silently.

---

## STEP 6 — Restore re-grant (Codex #5, Pitfall 5)

A `restore()` that resolves `Ok` is NOT proof StoreKit re-granted — the re-grant must be
**observable on a fresh `currentEntitlements()` read**.

1. Click **Restore (spike)**.
2. **Expect:** the readout shows **`Restored — entitlements: pro.theming, pro.ordering`** —
   the `pro.*` codes from the FRESH `currentEntitlements()` read after restore.
   - *Pitfall 5:* a brand-new Sandbox account may read empty (`Restored — no entitlements`)
     UNTIL Restore syncs — if so, the Restore action itself is what populates it. Restore
     must re-grant on a fresh container/account state, not merely return `Ok`. If it stays
     `Restored — no entitlements` after a confirmed purchase, record FAIL.

---

## STEP 7 — Serverless verify: TWO independent checks (MAS-IAP-04, criterion 4; Codex #3)

Because `network.client` is granted, **ALLOWED outbound is NOT reported as a sandbox
denial** — so a `log stream --predicate 'sender == "sandboxd"'`-only check passes FALSELY
(it only reports DENIED traffic; it CANNOT see allowed non-Apple outbound). You need a
process-scoped capture that sees ALL of the app's outbound.

### 7a. Check 1 of 2 — static source audit (already recorded; just confirm)

Confirm the Plan-05 **static D-04 audit** (zero non-Apple network surface in the IAP path)
is recorded as PASS in `PHASE-26-BRIDGE-VIABILITY.md` ("Static D-04 network audit (check 1
of 2)"). Nothing to run — it's the agent-verifiable half. (Result: zero
`reqwest|URLSession|fetch(|https?://` network constructs across the Rust IAP path + the
`tauri.ts` iap arm; the only `tinkerdev` hits are the bundle-id substring in the StoreKit
product identifier, not a host.)

### 7b. Check 2 of 2 — PROCESS-SCOPED live network capture (you run this, during a purchase)

Capture the app's OWN outbound (per-PID) WHILE a purchase is in flight, with an Apple-only
allowlist. First get the PID, then capture:

```sh
APP_PID=$(pgrep -f 'TinkerDev.app/Contents/MacOS/devtools-app')   # the running signed app's PID
echo "app PID = $APP_PID"

# Option A — live per-PID socket/host monitor (run this, THEN click Buy Pro and watch):
nettop -p "$APP_PID" -l 0           # shows the app's live connections + remote hosts

# Option B — snapshot the app's open network sockets right after a purchase:
lsof -nPi -a -p "$APP_PID"          # the -a -p scopes to THIS PID only

# Option C — a per-PID packet capture (most thorough), if you prefer pktap:
#   sudo tcpdump -i pktap,en0 -n "proc = devtools-app"   (or filter the captured pcap to APP_PID)
```

**Expect:** the ONLY outbound the app process makes during a purchase is to **Apple
StoreKit / `storekitd` / `*.apple.com` / `*.itunes.apple.com` / `*.apple-cloudkit`-style
StoreKit hosts** — and **ZERO** non-Apple host. Specifically confirm there is **NO**
outbound to `*.tinkerdev.io`, `license.tinkerdev.io`, `*.keygen.sh`, or any other
non-Apple host. (StoreKit's own network calls happen inside `storekitd`, an Apple system
daemon, which is fine — the criterion is that OUR app process originates no non-Apple
outbound.)

> **"Cannot reliably observe the app's outbound traffic" = FAIL, not pass.** If `nettop` /
> `lsof` / the per-PID capture can't be scoped to the app's PID, treat criterion 4 check 2
> as UNPROVEN (FAIL) and record it as such — do not wave it through.

---

## Results — fill this in (the phase-gate record)

Record exactly what you observed. The agent folds these into
`PHASE-26-BRIDGE-VIABILITY.md` criteria 3 + 4(check 2), then routes the go/no-go.

| # | Check | Observed | Pass/Fail |
|---|-------|----------|-----------|
| 0 | Build is **distribution-signed** (Apple Distribution + embedded MAS profile), NOT ad-hoc | | |
| 1 | App launches + renders (no white-screen — `network.client` present) | | |
| 3 | **Fetch products** → `com.tinkerdev.app.pro` with a price | | |
| 4a | **Buy Pro** → native sheet presents (criterion 3) | | |
| 4a | Sandbox tester sign-in (NOT real Apple ID — T-26-11) | | |
| 4a | Granted `pro.*` code(s) observed on success | | |
| 4b | **Cancel** → CALM `Purchase cancelled`, no error, grants nothing (harness-fix validation) | | |
| 4c | Pending / Ask-to-Buy (best-effort) | | best-effort / n/a |
| 5 | **Relaunch** → NO duplicate transaction re-fires (`finish()` proven — Codex #4) | | |
| 6 | **Restore** → re-granted `pro.*` codes on a fresh read (Codex #5) | | |
| 7a | Serverless check 1/2 — static source audit recorded PASS | | |
| 7b | Serverless check 2/2 — process-scoped per-PID capture: ONLY Apple StoreKit, ZERO non-Apple host | | |

**Free-text notes (sheet behavior, granted codes, any anomalies):**

> _(record here)_

---

## Go/No-Go routing (Codex #1 — a NO-GO is a BLOCKING transition, not a dangling note)

Once the table is filled, the disposition routes as follows:

- **ALL FOUR criteria hold on the plugin** (criteria 1 + 2 already PASS in Plan 05; criteria
  3 + 4 PASS here) → **GO**: `tauri-plugin-iap@0.9` is the final bridge → **Phase 26
  completes**.
- **Criterion 3 fails** — the sheet does not present, OR `success`/`userCancelled` mishandle
  (e.g. a cancel surfaces as an error), OR the relaunch replays a transaction (`finish()`
  failure) → **NO-GO**: this trips the Plan-05 go/no-go criterion 3 → the **in-phase swift-rs
  Plan 07 is TRIGGERED** and must rebuild the same `iap_*` seam + contract and pass the same
  four criteria. **Phase 26 does NOT complete on a NO-GO** until a working bridge passes.
- **Criterion 4 (serverless verify) fails** — a non-Apple host is observed, OR the traffic
  cannot be observed — **on BOTH the plugin AND a swift-rs check** → **milestone-level
  blocker, escalate** (terminal; do NOT silently complete).

### Resume signal

Type **"round-trip approved"** once: the live purchase grants `pro.*`, the cancel is calm,
the relaunch fires no duplicate, Restore re-grants on a fresh read, AND both serverless
checks confirm no non-Apple network. Otherwise, describe what failed:

- "sheet did not present" / "cancel showed an error" → criterion 3 → Plan 07 swift-rs.
- "duplicate transaction on relaunch" → `finish()` failure → record + route.
- "saw outbound to a non-Apple host" / "could not observe traffic" → criterion 4 escalation.
- "ASC not ready" (e.g. product still propagating) → the gate holds; retry later.

---

*Phase: 26-storekit-bridge-spike · Plan 06 · the human Sandbox-tester gate (D-06) ·
references `ASC-SETUP.md` §§6–7, `PHASE-26-BRIDGE-VIABILITY.md`, `PHASE-26-ASC-CHECKLIST.md`*
