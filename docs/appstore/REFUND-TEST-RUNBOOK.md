# Refund / Pro‑drop test runbook (MAS‑IAP‑05)

How to test the **live Pro→Free drop** path (a refund/revoke makes Pro turn off
while the app runs, fires the "Your Pro features turned off" notice) — and how to
get back to the **Free** License‑pane state once you've already bought Pro.

## Why "Manage StoreKit Transactions" was empty

There are **two completely separate StoreKit test systems** — don't mix them up:

| | Where purchases live | Refund control |
|---|---|---|
| **Local StoreKit testing** (`.storekit` config) | Xcode‑launched session only | **Xcode ▸ Debug ▸ StoreKit ▸ Manage Transactions** (Refund / Revoke buttons) |
| **Sandbox** (Sandbox tester Apple Account) | Apple's sandbox servers | App Store Connect / device account — **not** the Transaction Manager |

Your earlier purchases were **Sandbox** purchases (you signed into a Sandbox
tester). Those **never** show in *Manage StoreKit Transactions* — that window only
shows transactions from an app Xcode launched under a **local** `.storekit`
session. Hence "No Transactions." Pick one of the two paths below.

---

## Fastest: just see the Free state again (Sandbox)

You're currently Pro (you bought in sandbox), so the License pane shows the
Pro‑active layout. To see the new **Free pitch** (thank‑you + icons + live price),
return that account to "never purchased":

- **Option 1 — fresh tester (easiest):** App Store Connect ▸ **Users and Access ▸
  Sandbox ▸ Testers ▸ +**. Make a new tester, sign into it on the Mac
  (System Settings ▸ … ▸ Sandbox Account, or you'll be prompted at next Buy),
  relaunch TinkerDev → **Free** pane with the new pitch.
- **Option 2 — clear history + re‑sync:** App Store Connect ▸ Sandbox ▸ Testers ▸
  *your tester* ▸ **Clear Purchase History**. ⚠️ Clearing alone is **not enough** —
  it's a server‑side change, but the app reads StoreKit's *on‑device cached*
  `currentEntitlements`, so a plain relaunch still shows Pro. **Force a re‑sync:**
  System Settings ▸ **App Store** ▸ **Sandbox Account** ▸ **Sign Out** (or sign into
  a different tester), then relaunch → `currentEntitlements` empties → **Free**.

Both show the Free pane but do **not** fire the live drop **notice** (the notice
needs a revoke event mid‑session — see Path A).

> Why: the appstore build derives Pro entirely from StoreKit's cached
> `Transaction.currentEntitlements` (`get_product_status.is_owned`) — it persists
> no "is Pro" flag. Clearing history server‑side doesn't invalidate the device
> cache; only a re‑sync (account sign‑out/in) or a `Transaction.updates` revocation
> (a real refund / Path A) drops it.

---

## Path A — Local StoreKit testing (full Refund + live drop notice)

This is the only way to press a **Refund** button and watch Pro drop **live** with
the notice, with no real Apple servers. The config is committed at
`src-tauri/TinkerDev.storekit` (the Pro non‑consumable, id `com.tinkerdev.app.pro`).

Our app is a Tauri binary, not an Xcode target, so we point an Xcode **scheme** at
the already‑built `.app` and attach the StoreKit config:

1. Build the appstore bundle: `pnpm tauri:build:appstore`
   (→ `src-tauri/target/appstore/universal-apple-darwin/release/bundle/macos/TinkerDev.app`).
2. Open Xcode → **File ▸ New ▸ Project ▸ macOS ▸ App** (any throwaway target — you
   only need its scheme). Drag `src-tauri/TinkerDev.storekit` into the project.
3. **Product ▸ Scheme ▸ Edit Scheme… ▸ Run**:
   - **Info** tab → **Executable** → **Other…** → pick the built `TinkerDev.app`.
   - **Options** tab → **StoreKit Configuration** → `TinkerDev.storekit`.
4. **Run** (▶). Xcode launches TinkerDev under the local StoreKit session.
5. In the app: License ▸ **Buy Pro** → the local purchase completes (no real money,
   no Apple ID prompt). It now appears in **Debug ▸ StoreKit ▸ Manage Transactions**.
6. In *Manage Transactions*, select the transaction → **Refund Purchase** (or
   **Revoke**). The plugin's `purchaseUpdated` listener fires → `refreshEntitlements()`
   → **Pro drops live** and the **"Your Pro features turned off"** notice appears on
   the next License‑pane open.

> If your Xcode version refuses to inject StoreKit testing into an *external*
> executable (the "StoreKit Configuration" option is ignored for non‑target apps),
> fall back to the Sandbox path below for the round‑trip and use the Sandbox reset
> above to re‑see the Free state. The drop **notice** specifically needs a revoke
> event, which only Path A or a real sandbox refund produces.

---

## Path B — Sandbox refund (what your signed build talks to)

Sandbox refund testing for non‑consumables is limited and asynchronous. The
practical lever is **Clear Purchase History** (above), which revokes the entitlement
for that tester; on the next `refreshEntitlements()` (a relaunch, or a
`purchaseUpdated` event) `currentEntitlements()` returns empty and Pro drops. Note a
**relaunch** drop shows the Free pane but not the one‑time notice (the notice needs a
*live* wasPro→notPro transition inside a running session — Path A is the reliable way
to see the notice itself).

---

## What "passing" looks like (MAS‑IAP‑05)

- Pro is live (Buy round‑trip), then a Refund/Revoke is issued.
- The gate flips to Free **without a relaunch** (the listener path), and
- the calm **"Your Pro features turned off"** notice shows on the License pane,
  dismissable with **Got it**.
