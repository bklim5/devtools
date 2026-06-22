# Phase 26 Bridge Viability — the StoreKit bridge go/no-go (D-03 / D-04)

**Plan:** 26-05 (the single explicit bridge-viability gate the research prescribes).
**Date:** 2026-06-22.
**Integration mode:** MODE A (Rust-callable `tauri-plugin-iap@0.9.1` — proven in `PHASE-26-PLUGIN-API-PREFLIGHT.md`).

This doc records the four-criterion go/no-go evidence. **Criteria 1 + 2 + the OQ-2
verification-surface finding + the cited `finish()` source + the static (no-non-Apple-network)
D-04 check are AGENT-VERIFIABLE and recorded NOW (Plan 05).** **Criteria 3 (live sheet
presents/handles success-cancel-pending in the sandboxed build) and the SECOND D-04 check
(process-scoped live network capture with an Apple-only allowlist) are confirmed at the
Plan 06 HUMAN gate**, then folded back into this doc before the go/no-go is finalized.

---

## Provisional verdict (agent evidence): GO — keep `tauri-plugin-iap@0.9` — PENDING the Plan 06 human gate

Every agent-verifiable criterion HOLDS: the plugin compiles + links into a universal,
App-Sandboxed, signed `.app` (criterion 1); the public Rust API maps cleanly onto the seam
and the fail-closed grant core, with `Transaction.finish()` proven by a cited Swift source
(criterion 2); and the static D-04 audit shows zero non-Apple network surface in the IAP path.
Nothing in the agent-verifiable surface trips a NO-GO. **The final selection is the user's at
the checkpoint** — it cannot be made until criterion 3 (a real purchase sheet) and the second
D-04 check (a live capture) pass at the Plan 06 Sandbox-tester walkthrough.

---

## Build artifact (criterion 1 evidence)

```
MACOSX_DEPLOYMENT_TARGET=13.0 pnpm tauri build --features appstore \
  --target universal-apple-darwin --bundles app \
  --config '{"app":{"security":{"capabilities":[{"identifier":"appstore-iap",
    "windows":["main"],"permissions":["iap:default"]}]}},
    "bundle":{"macOS":{"entitlements":"entitlements.appstore.plist",
    "minimumSystemVersion":"13.0"}}}'
```

Produced:
`src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app` (built 2026-06-22 13:54).

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
| `iap_purchase` | `app.iap().purchase(PurchaseRequest{…,"inapp"})` | RESOLVE → `grant_from_outcome(Purchased(Verified))`; REJECT → `IapError::PurchaseFailed` (no grant) |
| `iap_restore` | `app.iap().restore_purchases("inapp")` | `Ok(())`; the seam re-reads entitlements (Codex #5) |
| `iap_current_entitlements` | `app.iap().get_product_status(PRO_PRODUCT_ID, "inapp")` | `isOwned` → `intersect_pro(PRO_ENTITLEMENTS)`; else `[]` |

`onPurchaseUpdated` maps onto `listen("storekit://updated")` (the `tauri.ts` arm, 26-02); the
plugin's `purchaseUpdated` Swift trigger fires the channel and the seam re-reads the verified
Rust path. `@choochmeque` is never imported (`grep -c '@choochmeque' src/lib/platform/tauri.ts` = 0).

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
| 2 | `getProductStatus`/`onPurchaseUpdated` map onto the seam; verification enforced; `finish()` cited | **PASS (agent)** | MODE A bodies + the seam table above; OQ-2 verify-in-Swift; `finish()` cited at IapPlugin.swift:142/:295 |
| 3 | Sheet presents + handles success/userCancelled/pending in the sandboxed build | **PENDING — Plan 06 human gate** | needs a distribution-signed launch + Sandbox tester |
| 4 | Serverless JWS verify, no network beyond Apple StoreKit (TWO checks) | **CHECK 1 PASS (agent); CHECK 2 PENDING** | static audit zero non-Apple hits (this plan); live process-scoped capture = Plan 06 |

---

## Go/No-Go decision

**RECORDED AT THE CHECKPOINT (user's selection).** The agent-verifiable evidence supports a
provisional **GO — keep `tauri-plugin-iap@0.9`**; nothing trips a NO-GO. The final selection is
deferred to the user because criteria 3 + 4(check 2) are confirmed only at the Plan 06 human gate.
On a confirmed NO-GO (criteria 1/2/3 fail), routing is BLOCKING and IN-PHASE → Plan 07 (the
swift-rs fallback rebuilding the same seam + the same `iap_*` contract + the same four criteria).
On a criterion-4 failure on BOTH the plugin AND swift-rs → milestone-level blocker, escalate.

<!-- Plan 06 folds the live criteria 3 + 4(check 2) results in here, then the final go/no-go is stamped. -->
