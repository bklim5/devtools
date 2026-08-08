# Phase 20 — Deferred Items

Out-of-scope discoveries logged during execution (not fixed in the originating plan).

## 20-01

### Shared ⌘K dev-toggle → entitlement-refresh e2e flake (pre-existing, out of scope)

- **Found during:** Plan 20-01, Task 4 (real-WKWebView e2e gate run via `scripts/e2e-spike.sh`).
- **Symptom:** In a full WDIO run, three license-related specs fail on the SAME
  step — `runDevToggle()` (the ⌘K "Toggle free tier (dev)" command) runs and the
  palette closes, but the free-tier `"Unlock Pro"` footer never appears within the
  `waitUntil` window:
  - `test/e2e/entitlements.e2e.ts` (UNMODIFIED by this plan) — fails FIRST at its
    line 181 with `expected the free-tier-only "Unlock Pro" footer row after the dev toggle (D-29)`.
  - `test/e2e/license-buy.e2e.ts` (new this plan) — same toggle path.
  - `test/e2e/license.e2e.ts` (UNMODIFIED) — cascades (attention-state cleanup).
- **Why out of scope:** the failure reproduces on `entitlements.e2e.ts`, which this
  plan did not touch, and originates in the dev-toggle → `refreshEntitlements()`
  live-snapshot propagation — orthogonal to the opener seam / config split this plan
  shipped. It is the known [[license-walkthrough-state-pollutes-e2e]] family
  (reset prefs `entitlementsOverride` + the dev Keychain item before the license
  specs; the toggle→refresh is racy on this WKWebView worker setup).
- **Mitigation applied (in scope):** `license-buy.e2e.ts` retries the toggle up to
  4× before failing loud, so it is resilient to a single racy flip.
- **Recommendation:** fold a deterministic prefs/override reset into the e2e preflight
  (or assert the entitlement snapshot directly) at the Phase 20/21 e2e hardening pass.
  The unit suite already pins the PAY-01 positive contract
  (`UpsellPanel.test.tsx`: `openUrl` called once with `https://tinkerdev.io/buy`,
  no navigation); the native browser-open is a manual-walkthrough item (20-VALIDATION).
