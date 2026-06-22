# Phase 26 Bridge Viability — the StoreKit bridge go/no-go (D-03 / D-04)

**Plan:** 26-05 (the single explicit bridge-viability gate the research prescribes).
**Date:** 2026-06-22.
**Integration mode:** MODE A (Rust-callable `tauri-plugin-iap@0.9.1` — proven in `PHASE-26-PLUGIN-API-PREFLIGHT.md`).

This doc records the four-criterion go/no-go evidence. **Criteria 1 + 2 + the OQ-2
verification-surface finding + the cited `finish()` source + the static (no-non-Apple-network)
D-04 check are AGENT-VERIFIABLE and were recorded at Plan 05.** **Criteria 3 (live sheet
presents/handles success-cancel-pending in the sandboxed build) and the SECOND D-04 check
(process-scoped live network capture with an Apple-only allowlist) were confirmed at the
Plan 06 HUMAN gate (2026-06-23)** and are folded in below. **The go/no-go is FINAL.**

---

## FINAL verdict (2026-06-23): GO — keep `tauri-plugin-iap@0.9`

**All four criteria PASS.** Confirmed by a real Sandbox-tester round-trip on a **dev-signed**
(Apple Development + Mac Development profile incl. this Mac) App-Sandboxed `.app`, sandbox tester
`bkbklim+tinkerdev@gmail.com`, 2026-06-23:

- **Criterion 1 (agent, Plan 05):** the plugin compiles + links into a universal, App-Sandboxed,
  signed `.app`.
- **Criterion 2 (agent, Plan 05):** the public Rust API maps cleanly onto the seam + the
  fail-closed grant core; `Transaction.finish()` cited at `IapPlugin.swift:142`.
- **Criterion 3 (LIVE, Plan 06):** the native sandbox sheet PRESENTS
  (`com.tinkerdev.app.pro` "TinkerDev Pro" $8.99 "For testing purposes only"); PURCHASE → granted
  `pro.theming, pro.ordering` through the fail-closed core; CANCEL → calm `Purchase cancelled`
  (validates the harness calm-cancel fix); relaunch fired NO duplicate transaction (live
  confirmation of the cited `finish()`); Restore re-granted `pro.theming, pro.ordering` from the
  on-device verified-transaction cache.
- **Criterion 4 (BOTH checks PASS):** check 1 = the Plan-05 static audit (zero non-Apple network
  surface); check 2 (LIVE, Plan 06) = `nettop -p <app PID>` during the spike calls showed ZERO
  sockets in the app process — StoreKit traffic is brokered by Apple's system daemons, our process
  opens no outbound.

`tauri-plugin-iap@0.9` is the FINAL bridge. **Phase 26 completes.** The conditional swift-rs
fallback (Plan 07) is therefore NOT needed and is SKIPPED.

The two documented plugin limitations stand (they did not trip a NO-GO): the fragile cancel/pending
message string-match (`calm_reject_outcome`, unit-tested + live-validated via the calm CANCEL), and
the not-yet-wired `onPurchaseUpdated` global event (a Phase-28 placeholder).

---

## Build artifact (criterion 1 evidence)

```
MACOSX_DEPLOYMENT_TARGET=13.0 pnpm tauri build --features appstore \
  --target universal-apple-darwin --bundles app \
  --config '{"bundle":{"macOS":{"entitlements":"entitlements.appstore.plist",
    "minimumSystemVersion":"13.0"}}}'
```

Produced:
`src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app` (built 2026-06-22 13:54).

> **SECURITY CORRECTION (harness Codex adversarial review, T-26-18b).** The
> original spike build granted the webview `iap:default`. That is WRONG and is
> dropped above. `iap:default` enables the plugin's RAW IPC commands
> (`plugin:iap|purchase`, `restore_purchases`, `acknowledge_purchase`,
> `consume_purchase`, …) for `invoke` from the renderer — which would let a
> compromised webview bypass the entire `iap_*` wrapper boundary (the
> product-id pin + the fail-closed grant core + the `{ code }` error shaping).
> MODE A reaches the plugin **Rust-side** via `IapExt::iap()`; the plugin is
> registered in `lib.rs` (Rust), and our `iap_*` are app commands — NONE of that
> path goes through the plugin's IPC capability, so the webview needs **no** iap
> capability at all. **Phase 27's `tauri.appstore.conf.json` overlay MUST NOT
> grant `iap:default` (or any `plugin:iap|*` permission); the next signed
> appstore rebuild must confirm the Rust-side path still works without it** (it
> should — capabilities gate only webview→plugin IPC, not the Rust extension API).

The final non-zero exit was ONLY the absent updater-signing private key
(`TAURI_SIGNING_PRIVATE_KEY` — the `.app.tar.gz` updater artifact), per the harness rule:
confirm via the bundle binary, not the exit code. The `.app` itself was built, signed, and bundled.

### Verified on the bundle

| Check | Command | Result |
|-------|---------|--------|
| Universal binary | `lipo -archs …/MacOS/devtools-app` | **`x86_64 arm64`** |
| Sandbox entitlement embedded | `codesign -d --entitlements -` | `com.apple.security.app-sandbox = true` |
| Network-client entitlement embedded | (same) | `com.apple.security.network.client = true` — and NOTHING else |
| Per-invocation 13.0 floor | `PlistBuddy -c "Print :LSMinimumSystemVersion"` | **`13.0`** |
| Base config untouched (D-12) | `grep -c '"minimumSystemVersion": "10.15"' tauri.conf.json` | `1` (still 10.15; `git diff` empty) |
| Code signature | `codesign -dv` | `flags=0x10002(adhoc,runtime)` — valid, hardened runtime |
| No objc2/keyring link clash | build log | reached `Finished release` + `Built application` + bundled; objc2-*, arboard, reqwest, the plugin all linked cleanly |

### Signing caveat (Plan 06 / human-gate prerequisite — NOT a criterion-1 failure)

The bundle is signed **ad-hoc** (`signingIdentity: "-"`, the base config default). The only
codesigning identity available in this environment is **Developer ID Application: Boon Khai Lim
(FK4HQK83WX)** — there is **no Apple Distribution / Mac App Store identity and no embedded MAS
provisioning profile** (ASC-SETUP §7). Criterion 1 (compile + link + universal + sandbox
entitlement) is fully proven by the ad-hoc-signed sandboxed `.app`. A **distribution-signed**
bundle (Apple Distribution + Mac Installer Distribution + embedded profile) is required ONLY to
launch the sandboxed StoreKit app for the LIVE criterion-3 purchase sheet — that re-sign + launch
is part of the Plan 06 human Sandbox-tester walkthrough, not this agent-verifiable plan.

---

## Criterion 1 — Compiles + links universal sandboxed — **PASS (agent-verifiable)**

- `cargo build --features appstore` exits 0; `cargo build` (direct) exits 0; `cargo tree | grep -c tauri-plugin-iap` = 0 without the feature (the optional-dep gating mirrors webdriver).
- `cargo test --features appstore` = **97 passed / 0 failed** (the Plan-01 decision core + the new command-mapping tests, routed through the real bodies).
- The universal sandboxed `.app` lipo's to `x86_64 arm64` (above). No objc2/keyring apple-native link clash.
- **Blocking issue auto-fixed (Rule 3):** linking the plugin's Swift package (swift-bridge) makes the binary reference `@rpath/libswift_Concurrency.dylib`; cargo's default rpath omits the OS Swift runtime, so `cargo test --features appstore` aborted at load (`Library not loaded`). Fixed in `build.rs` by adding `/usr/lib/swift` to the rpath under the `appstore` feature on macOS (direct build byte-unaffected). Tests then pass with no manual `DYLD_FALLBACK_LIBRARY_PATH`.

---

## Criterion 2 — `getProductStatus`/`onPurchaseUpdated` map onto the seam — **PASS (agent-verifiable)**

The MODE A `iap_*` bodies (`src-tauri/src/iap/commands.rs`) call the plugin's public Rust API:

| Seam command | Plugin Rust call | Grant routing |
|--------------|------------------|---------------|
| `iap_products` | `app.iap().get_products([PRO_PRODUCT_ID], "inapp")` | maps `formattedPrice`/`title` → `IapProduct` |
| `iap_purchase` | `app.iap().purchase(PurchaseRequest{…,"inapp"})` | RESOLVE (product==Pro) → `grant_from_outcome(Purchased(Verified))`; REJECT → calm `UserCancelled`/`Pending` by message, else `IapError::PurchaseFailed` (no grant) |
| `iap_restore` | `app.iap().restore_purchases("inapp")` | `Ok(())`; the seam re-reads entitlements (Codex #5) |
| `iap_current_entitlements` | `app.iap().get_product_status(PRO_PRODUCT_ID, "inapp")` | `isOwned` → `intersect_pro(PRO_ENTITLEMENTS)`; else `[]` |

`getProductStatus` maps cleanly onto the seam. `@choochmeque` is never imported
(`grep -c '@choochmeque' src/lib/platform/tauri.ts` = 0).

### Known plugin limitations (criterion-2/3 caveats — surfaced by the harness code-review, material to the go/no-go)

Two real `tauri-plugin-iap@0.9.1` API constraints were found while wiring the seam. Neither trips
a NO-GO on its own, but both are honest marks against the plugin and are mitigated/deferred:

1. **No structured reject discriminant for cancel/pending.** The plugin's macOS `purchase()`
   THROWS one undifferentiated error for user-cancel (`IapPlugin.swift:152`), pending/Ask-to-Buy
   (`:155`) AND verification-failure (`:148`) — the only signal is the (English) thrown message.
   To honour MAS-IAP-01 ("pending is a CALM non-error state"), `iap_purchase` classifies the
   message (`calm_reject_outcome`, unit-tested) → `UserCancelled`/`Pending` calm states, failing
   closed to `PurchaseFailed` on verification-failure / anything unrecognized. **This message
   string-match is FRAGILE** (depends on the plugin's prose); a swift-rs fallback (Plan 07) would
   own the StoreKit `PurchaseResult` enum directly and avoid it. Weigh this in the go/no-go.
2. **`onPurchaseUpdated` has no global event to subscribe to.** The plugin delivers background
   transaction updates (renewal, refund, family-share, Ask-to-Buy approval) through its OWN
   `register_listener` / `ipc::Channel` mechanism (`src/listeners.rs`), NOT a global Tauri event.
   The seam's `listen("storekit://updated")` therefore never fires — it is a **NOT-YET-WIRED
   placeholder** (the doc/comments in `tauri.ts`/`index.ts` now say so). The Phase-26 spike does
   not need it (it re-reads entitlements explicitly after purchase/restore); wiring the plugin's
   real update channel is **Phase 28** (refund/revoke live-drop). A swift-rs fallback would expose
   `Transaction.updates` directly.

---

## OQ-2 — the verification surface — **MAS-IAP-04 holds by construction**

The plugin verifies the StoreKit JWS **inside its Swift** and only `.verified` transactions cross
the FFI; there is NO in-band `verified: bool`:

- `purchase()` on an `.unverified` transaction **THROWS** `"Transaction verification failed"` (`macos/Sources/IapPlugin.swift:147-148`).
- `restorePurchases` / `getProductStatus` **SKIP** `.unverified` entitlements (`IapPlugin.swift:195-197`, `:272-273`).

So a `purchase()` that RESOLVES is, by construction, verified → the body maps it to
`PurchaseOutcome::Purchased(Verification::Verified)`; a REJECT grants nothing. The Plan-01
fail-closed core (`grant_from_outcome` + `intersect_pro` over-grant guard against
`PRO_ENTITLEMENTS`) is the defense-in-depth layer on top of the native verify (T-26-13/14).
MAS-IAP-04 (serverless on-device JWS verify) is satisfied inside the plugin's Swift, guarded
Rust-side — there is no fail-open path.

---

## `Transaction.finish()` — PROVEN with a CITED source (Codex #4)

The plugin finishes the transaction internally — **option (b)**, with the exact Swift source cited:

| Path | File + line | Code |
|------|-------------|------|
| After a verified purchase | `macos/Sources/IapPlugin.swift:140-142` | `case .verified(let transaction): // Finish the transaction` → `await transaction.finish()` |
| On every background update | `macos/Sources/IapPlugin.swift:294-295` | `// Always finish transactions` → `await transaction.finish()` (in `handleTransactionUpdate`) |

(Crate source: `~/.cargo/registry/src/index.crates.io-…/tauri-plugin-iap-0.9.1/macos/Sources/IapPlugin.swift`.)
`finish()` is called in the SAME `.verified` arm whose result is returned to us — so by the time
`purchase()` resolves Rust-side, the transaction is already finished. We do NOT call a separate
finish path; the macOS `acknowledge_purchase`/`consume_purchase` Rust methods are documented no-ops
(`src/macos.rs:162-178`: "macOS finishes transactions inside `purchase()` itself"). This is a
recorded, source-cited fact, not an assumption. (The LIVE relaunch/replay confirmation — purchase,
relaunch, confirm no duplicate transaction re-fires — is the Plan 06 walkthrough.)

---

## Static D-04 network audit (check 1 of 2) — **PASS: zero non-Apple network surface**

Because `network.client` is granted, ALLOWED outbound is NOT reported as a sandbox denial, so a
`log stream sandboxd`-only check can pass falsely (Codex #3). This static audit greps the entire
IAP path for ANY outbound construct/host.

### Literal token audit (the plan's exact regex)

```
$ grep -rEnc "fetch|reqwest|URLSession|https://|tinkerdev|keygen" src-tauri/src/iap/
src-tauri/src/iap/commands.rs:1
src-tauri/src/iap/mod.rs:2
```

The 3 hits are NOT network surface — they are all the StoreKit product **identifier**
`com.tinkerdev.app.pro` (a reverse-DNS bundle id, never a URL/host):

```
src-tauri/src/iap/mod.rs:272:            id: "com.tinkerdev.app.pro".to_string(),
src-tauri/src/iap/mod.rs:278: …"id":"com.tinkerdev.app.pro"…   (serde JSON-shape test)
src-tauri/src/iap/commands.rs:37: const PRO_PRODUCT_ID: &str = "com.tinkerdev.app.pro";
```

The `keygen`/`fetch`/`reqwest`/`URLSession`/`https://` tokens have ZERO hits. The literal grep's
only non-zero matches are the bundle-id substring `tinkerdev` — which is, correctly, the StoreKit
product the purchase targets, not an outbound host.

### Network-construct audit (the accurate D-04 check)

```
$ grep -rEnc "reqwest|URLSession|ureq|hyper|TcpStream|https?://" src-tauri/src/iap/
src-tauri/src/iap/commands.rs:0
src-tauri/src/iap/mod.rs:0

$ # the tauri.ts iap arm (fetch/XHR/URLs):
$ sed -n '/iap:/,/^  }/p' src/lib/platform/tauri.ts | grep -Ec "fetch\(|https?://|reqwest|XMLHttpRequest"
0
```

**Zero** network constructs and **zero** non-Apple hosts across the Rust IAP path AND the
`tauri.ts` iap arm. The IAP path's only outbound is StoreKit (Apple), reached entirely inside the
plugin's Swift via swift-bridge — there is no `fetch`/`reqwest`/`URLSession`/Keygen/`tinkerdev.io`
call anywhere in our IAP code. **(The SECOND check — a process-scoped live capture with an
Apple-only allowlist — runs at the Plan 06 walkthrough; BOTH must pass for D-04 criterion 4.)**

---

## The four criteria — status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Compiles + links universal sandboxed | **PASS (agent)** | lipo `x86_64 arm64`; sandbox+network.client entitlements embedded; no link clash; `cargo test --features appstore` 97/0 |
| 2 | `getProductStatus`/`onPurchaseUpdated` map onto the seam; verification enforced; `finish()` cited | **PASS (agent), 2 caveats** | MODE A bodies + the seam table above; OQ-2 verify-in-Swift; `finish()` cited at IapPlugin.swift:142/:295. Caveats (see "Known plugin limitations"): cancel/pending mapped by fragile message string-match; `onPurchaseUpdated` is a Phase-28 placeholder (plugin has no global event) |
| 3 | Sheet presents + handles success/userCancelled/pending in the sandboxed build | **PASS (LIVE, Plan 06)** | 2026-06-23 dev-signed sandboxed `.app`, sandbox tester `bkbklim+tinkerdev@gmail.com`: native sheet presented `com.tinkerdev.app.pro` "TinkerDev Pro" $8.99; PURCHASE → granted `pro.theming, pro.ordering`; CANCEL → calm `Purchase cancelled` (no error); relaunch → NO duplicate transaction (`finish()` confirmed live); Restore → re-granted `pro.theming, pro.ordering`. PENDING (Ask-to-Buy) not live-reproduced — source-verified ("Purchase is pending") + unit-tested |
| 4 | Serverless JWS verify, no network beyond Apple StoreKit (TWO checks) | **PASS (BOTH checks)** | CHECK 1 (agent, Plan 05): static audit zero non-Apple hits. CHECK 2 (LIVE, Plan 06): `nettop -p <app PID>` during the spike calls = ZERO sockets in the app process (StoreKit brokered by Apple system daemons; our process opens no outbound) |

---

## Go/No-Go decision — `go-plugin` (FINAL, user-confirmed 2026-06-23)

**Disposition: `go-plugin`.** All four criteria PASS (1 + 2 agent-verifiable at Plan 05; 3 + 4-check-2
confirmed LIVE at the Plan 06 human gate). The proven bridge is **`tauri-plugin-iap@0.9`** — it is the
single bridge validated against all four criteria. **Phase 26 completes.**

**Routing resolved:** the NO-GO branches did NOT fire. Criteria 1/2/3 all hold → the in-phase swift-rs
**Plan 07 is SKIPPED** (it was conditional on `nogo-swiftrs`; the fallback is not needed). Criterion 4
held on the plugin → no milestone-blocker escalation.

**Live evidence (2026-06-23, dev-signed `.app`, sandbox tester `bkbklim+tinkerdev@gmail.com`):**
- Sheet PRESENTS: `com.tinkerdev.app.pro` "TinkerDev Pro" $8.99 "For testing purposes only".
- PURCHASE → granted `pro.theming, pro.ordering` (through the fail-closed core).
- CANCEL → calm `Purchase cancelled` (NOT an error — validates the harness calm-cancel fix; the plugin
  throws "Purchase cancelled by user" → `calm_reject_outcome` → `UserCancelled`).
- PENDING (Ask-to-Buy) not live-reproduced — source-verified ("Purchase is pending") + unit-tested.
- `finish()` — live relaunch after purchase fired NO duplicate transaction (the cited
  `IapPlugin.swift:142` confirmed in practice).
- Restore → re-granted `pro.theming, pro.ordering` from the on-device verified-transaction cache
  (serverless; persists across sandbox sign-out — expected for a perpetual non-consumable).
- Serverless verify: `nettop -p <app PID>` during the spike calls = ZERO sockets in the app process
  (StoreKit brokered by Apple's system daemons; our process opens no outbound) → criterion 4 check 2 PASS.

The full live results table is recorded in `PHASE-26-SANDBOX-WALKTHROUGH.md`.

---

## Signing reality discovered at the gate (2026-06-23)

The LOCAL sandbox StoreKit test required **DEVELOPMENT** signing, NOT distribution:

- **Local launch needs Apple Development:** an Apple Development cert + a Mac Development provisioning
  profile that includes THIS Mac. A Mac App Store **distribution** profile fails local launch with
  **AMFI -413 "No matching profile found"** (the `app-sandbox` + `application-identifier` entitlements
  are profile-restricted; a distribution profile only authorizes an App-Store-installed app).
- **`entitlements.appstore.plist` gained `com.apple.application-identifier`** — required for StoreKit to
  bind the product to the app.
- **The Apple Distribution + Mac Installer Distribution certs + the Mac App Store profile already
  created are for the Phase-30 `.pkg` submission**, NOT this local gate.

The full three-flow signing matrix (Dev test / Direct DMG / App Store `.pkg`) is documented in
`PHASE-26-SANDBOX-WALKTHROUGH.md` ("Signing matrix").
