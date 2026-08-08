---
phase: 19-license-activation-offline-verification
reviewed: 2026-06-12T21:04:23Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - scripts/e2e-spike.sh
  - scripts/keygen-ce/bootstrap.sh
  - scripts/keygen-ce/compose.yaml
  - scripts/keygen-ce/Caddyfile
  - scripts/keygen-ce/spike.sh
  - src-tauri/src/lib.rs
  - src-tauri/src/license/commands.rs
  - src-tauri/src/license/config.rs
  - src-tauri/src/license/fingerprint.rs
  - src-tauri/src/license/keychain.rs
  - src-tauri/src/license/keygen_client.rs
  - src-tauri/src/license/mod.rs
  - src-tauri/src/license/store.rs
  - src-tauri/src/license/verify.rs
  - src/components/Sidebar.tsx
  - src/components/UpsellPanel.tsx
  - src/lib/entitlements/store.ts
  - src/lib/license/licenseUi.ts
  - src/lib/platform/index.ts
  - src/lib/platform/tauri.ts
  - src/lib/platform/browser.ts
  - src/lib/platform/stub.ts
  - src/main.tsx
  - src/shell/useLicenseUi.ts
  - test/e2e/license.e2e.ts
findings:
  critical: 0
  warning: 6
  info: 8
  total: 14
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-06-12T21:04:23Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the Phase 19 licensing surface: Keygen CE bring-up scripts, the Rust license core (fingerprint, Keychain, HTTP client, Ed25519 verify, activation state machine, 4-command surface), the TS seam/snapshot stores/UI, and the license e2e gate.

The core crypto path is solid: fail-closed verify with a typed error taxonomy, signature checked before the dataset is trusted, fingerprint compared constant-time, alg gated exact-match, no key material crossing to JS, and the no-partial-success ordering is verified-before-persist with good test coverage. The Rust↔TS contract (`LicenseStatusPayload`, `{code}` error shape) is pinned by serde tests on the Rust side and mirrored exactly in `src/lib/platform/index.ts` — no drift found there.

The issues that survived per-task review are mostly at the seams the per-task gates couldn't see: a comment/contract drift in the e2e preflight that deletes a *production* Keychain credential, an in-memory-only backup of the user's real `machine.lic` during e2e, an unproven assumption that CE routes machines by fingerprint (the D-44 recovery path), and a few asymmetries in the manager (missing sentinel guard on `deactivate`, a residual partial-success window between cert write and Keychain write, and post-success failures in the panel misreported as activation errors).

## Warnings

### WR-01: e2e preflight deletes the user's real production license key from the Keychain

**File:** `scripts/e2e-spike.sh:106-109` (vs `src-tauri/src/license/keychain.rs:19` and `src-tauri/tauri.conf.json:5`)
**Issue:** The preflight runs `security delete-generic-password -s com.tinkerdev.app.license` before every e2e run, and its comment claims "local-CE keys only — the production app id differs." That claim is false: `keychain.rs` hardcodes `SERVICE = "com.tinkerdev.app.license"` for **all** builds, and `tauri.conf.json` uses identifier `com.tinkerdev.app` for both dev and release. A developer who has activated the shipped TinkerDev app on their Mac loses their stored license key every time the e2e gate runs (recoverable only by re-entering the key manually — the key never round-trips through JS, so the app cannot recover it).
**Fix:** Either namespace the dev/e2e Keychain service (e.g. `com.tinkerdev.app.license.dev` selected via `#[cfg(debug_assertions)]` in `keychain.rs`), or back up + restore the item around the run. Minimal version:
```rust
// keychain.rs
#[cfg(debug_assertions)]
const SERVICE: &str = "com.tinkerdev.app.license.dev";
#[cfg(not(debug_assertions))]
const SERVICE: &str = "com.tinkerdev.app.license";
```
Then point the preflight delete at the `.dev` service and fix the comment. (Note: this changes where dev builds look for the stored key — existing dev activations re-prompt once.)

### WR-02: e2e backs up the user's real machine.lic only in process memory — a killed runner destroys it permanently

**File:** `test/e2e/license.e2e.ts:47-53, 251-256, 282-286`
**Issue:** Flow B seeds garbage into the **real** app-data path (`~/Library/Application Support/com.tinkerdev.app/machine.lic` — same dir the production app uses, per WR-01's shared identifier). The original file is read into `licBackup` (a Node `Buffer`) and restored in `finally`. If the WDIO process is SIGKILLed, the machine sleeps, or `e2e-spike.sh`'s teardown races (a known flake area per the harness notes), the original certificate is gone with no on-disk copy — the user's production app drops into the Problem state until they re-activate.
**Fix:** Write the backup to a sibling file before seeding, and restore from it (also makes recovery possible on the *next* run after a crash):
```ts
const LIC_BAK = LIC_PATH + ".e2e-bak";
// before seeding:
if (existsSync(LIC_PATH)) copyFileSync(LIC_PATH, LIC_BAK);
writeFileSync(LIC_PATH, "not a machine file");
// in finally (and as a preflight self-heal at spec start):
if (existsSync(LIC_BAK)) { copyFileSync(LIC_BAK, LIC_PATH); rmSync(LIC_BAK); }
else if (licSeeded) rmSync(LIC_PATH, { force: true });
```

### WR-03: Fingerprint-as-machine-id on checkout is unproven against CE — the D-44 recovery path may 404

**File:** `src-tauri/src/license/mod.rs:228, 245-256` (consumed by `keygen_client.rs:437-454`)
**Issue:** `activate` on `ValidateOutcome::ActiveOnThisMachine` and `refresh` both call `checkout_machine_file` with the **fingerprint** as the machine identifier (`POST /machines/{fingerprint}/actions/check-out`), with a comment asserting Keygen machine routes accept fingerprints. The live spike (`scripts/keygen-ce/spike.sh:134`) only ever checked out by machine **UUID** — the fingerprint-aliasing assumption was never exercised against CE. If CE does not alias fingerprints on this route, the exact path this exists for (D-44 idempotent re-activation after a lost/corrupt machine.lic, and the Phase-21 refresh) fails with `ActivationFailed`/404, while the happy first-activation path keeps passing every test.
**Fix:** Prove it once: add a spike step (or extend the Plan 04 walkthrough) that performs `POST /machines/$FP_A/actions/check-out` with License auth and asserts 200. If CE rejects it, capture the machine id instead — e.g. have `validate_key` follow up with `GET /machines?fingerprint={fp}` (License auth) to resolve the UUID on the `ActiveOnThisMachine` arm.

### WR-04: `deactivate()` lacks the empty-fingerprint sentinel guard that `activate()` has

**File:** `src-tauri/src/license/mod.rs:260-274`
**Issue:** `activate` refuses to run when `self.fingerprint.is_empty()` (the startup ioreg-failure sentinel), but `deactivate` — a webview-reachable command (`deactivate_machine` is registered in `lib.rs:152`) — sends `DELETE {base}/machines/` with an empty path segment when the sentinel is set. It fails closed (non-204 → `ActivationFailed`), but it performs a malformed network call, and depending on the server's routing an empty id could in principle match an unintended route. `refresh` is incidentally protected (the local verify against an empty fingerprint always fails first), but `deactivate` is not.
**Fix:** Mirror the guard:
```rust
pub async fn deactivate(&mut self) -> Result<LicenseStatusPayload, LicenseError> {
    if self.fingerprint.is_empty() {
        return Err(LicenseError::ActivationFailed);
    }
    let key = self.stored_key()?;
    ...
}
```

### WR-05: Partial-success window in `verify_then_persist` — cert persisted, Keychain write fails, user told activation failed

**File:** `src-tauri/src/license/mod.rs:279-301`
**Issue:** The T-19-18 invariant ("machine.lic and the Keychain are written ONLY after verify") holds, but the two writes are not atomic with respect to each other: if `store.write_atomic` succeeds and `keychain.set_key` then fails (the macOS auth-prompt-denied case is a realistic dev path per Pitfall 5), the command returns `Err(ActivationFailed)` — yet the next `license_status` resolves **Licensed** from the persisted cert. The user sees "Activation didn't complete — try again" while the app is in fact licensed, `hasStoredKey` stays false, and a later `refresh`/`deactivate` fails `NoStoredKey`.
**Fix:** Either store the key first (a stored key with no cert is recoverable via the D-44 stored-key path; the reverse is the confusing state), or roll back the cert on Keychain failure:
```rust
if let Some(key) = store_key {
    if let Err(_) = self.keychain.set_key(key) {
        let _ = self.store.remove(); // keep the no-partial-success invariant
        return Err(LicenseError::ActivationFailed);
    }
    self.stored_key_flag = Some(true);
}
```

### WR-06: Post-activation refresh failures are misreported as activation errors and skip the key-clearing on success (T-19-21)

**File:** `src/components/UpsellPanel.tsx:148-168`
**Issue:** `submit()` wraps four awaits in one `try`: `activate`, `clearEntitlementsOverride`, `refreshLicenseUi`, `refreshEntitlements`. If activation **succeeds** but any of the three follow-ups throws (e.g. a prefs load/save failure in `clearEntitlementsOverride`), the catch renders an activation error ("Activation didn't complete — try again" — it did complete), `setActivated(true)` never runs, and `setValue("")` is skipped — so the pasted key stays in component state, weakening the T-19-21 "cleared on success" guarantee.
**Fix:** Scope the catch to the activate call; treat follow-up refreshes as best-effort:
```ts
try {
  await platform.license.activate(trimmed || null);
} catch (err) {
  setError(toErrorCode(err));
  inputRef.current?.focus();
  return; // (move setPending(false) handling accordingly)
}
setValue("");      // success: key leaves state immediately (T-19-21)
setActivated(true);
try {
  await clearEntitlementsOverride();
  await refreshLicenseUi();
  await refreshEntitlements();
} catch (err) {
  console.error("[license] post-activation refresh failed:", err);
}
```

## Info

### IN-01: `toErrorCode` uses `in`, which walks the prototype chain

**File:** `src/components/UpsellPanel.tsx:74-79`
**Issue:** `code in ERROR_COPY` is true for inherited keys (`"toString" in ERROR_COPY` → true). Rust only emits the eight known codes, but `err` here can be any rejection (including the follow-up calls per WR-06), so a `{ code: "toString" }`-shaped object would index a non-string into `statusLine`.
**Fix:** `Object.hasOwn(ERROR_COPY, code)` (or `Object.prototype.hasOwnProperty.call`).

### IN-02: UpsellModal focus trap selector does not exclude disabled controls

**File:** `src/components/UpsellPanel.tsx:375-377`
**Issue:** The focusables query (`'button, [href], input, ...'`) includes the disabled Activate button while `pending`. `last.focus()` on a disabled element is a no-op, so the Tab wrap can stall on that boundary mid-activation.
**Fix:** Append `:not([disabled])` to the button/input/select/textarea selectors.

### IN-03: Problem state with no stored key: empty submit is a silent no-op

**File:** `src/components/UpsellPanel.tsx:144-146, 265-283`
**Issue:** In the D-44 problem state with `hasStoredKey: false`, the form is pre-revealed and focused, but pressing Activate with an empty field returns silently (`if (!trimmed && !hasStoredKey) return`) — a dead button with no aria-live feedback.
**Fix:** Set a calm inline line for this branch (e.g. reuse the status region: "Enter your license key to activate.").

### IN-04: compose `setup` one-shot runs under a bare `docker compose up`

**File:** `scripts/keygen-ce/compose.yaml:15-32, 43-46`
**Issue:** With profiles deliberately removed, `setup` is a plain service — a bare `docker compose up` (no service args) re-runs `rails keygen:setup` against the live DB. The header comment relies on operator discipline only. Also `redis` is unpinned (`image: redis`) while postgres is pinned to 17.5.
**Fix:** Add `scale: 0` (or `deploy: {replicas: 0}`) to `setup` so `up` never starts it while `run setup` still works; pin `redis` to a major version.

### IN-05: bootstrap lookups read only the first page of /products and /policies

**File:** `scripts/keygen-ce/bootstrap.sh:66-100`
**Issue:** `ensure_product`/`ensure_policy` select by name from an unpaginated `GET` (Keygen default page size 10). On an instance with >10 products/policies the lookup misses and the script creates duplicates, breaking idempotency. Harmless on the fresh local CE, but the script advertises idempotency.
**Fix:** Append `?limit=100` (or follow `links.next`) to the lookup GETs.

### IN-06: macOS ships no `setsid`, so the spike teardown's process-group kill never applies

**File:** `scripts/e2e-spike.sh:160-167, 39-48`
**Issue:** On macOS (the only supported platform) `command -v setsid` fails, so the fallback plain background start is the norm; `kill -- "-$PID"` then fails (pid ≠ pgid) and only the `pnpm` wrapper is killed, orphaning vite + the Rust app — exactly the orphans the preflight exists to reap next run. Works, but every run leaks until the *next* run.
**Fix:** After killing the wrapper, also kill by the same selectors the preflight uses (`pgrep -f devtools-app`, `lsof -ti tcp:1420/4445`) inside `cleanup()` so each run reaps its own tree.

### IN-07: No release-build guard on the dev `KEYGEN_HOST = "localhost"`

**File:** `src-tauri/src/license/config.rs:13-15`
**Issue:** The Phase 21 production swap is documented as a manual constants edit. Nothing fails a release build made before that edit — a shipped binary would silently point activation at `localhost`.
**Fix:** Add a tripwire test or compile-time check, e.g. `#[cfg(not(debug_assertions))] const _: () = assert!(!matches!(KEYGEN_HOST.as_bytes(), b"localhost"), "swap KEYGEN_HOST before release");` or a unit test gated on a `release-config` feature used by the ship-gate build.

### IN-08: Unit tests pin the regeneratable fixture's expiry strings

**File:** `src-tauri/src/license/mod.rs:453, 569-574`; `src-tauri/src/license/verify.rs:338-346`
**Issue:** `ce-machine.lic` is regenerated by every `spike.sh` run (fresh `issued`/`expiry`/fingerprint), but multiple tests assert the current fixture's literal timestamps and fingerprint. Re-running the spike breaks the suite in a non-obvious way (maintenance trap, not a runtime bug).
**Fix:** Note in the spike header that regenerating the fixture requires updating `REAL_FP` + the pinned expiry literals, or derive the expectations from the fixture (decode `enc` in the test) instead of hardcoding.

---

_Reviewed: 2026-06-12T21:04:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
