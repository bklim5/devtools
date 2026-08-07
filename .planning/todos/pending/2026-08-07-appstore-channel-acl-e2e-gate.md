---
created: 2026-08-07T14:20:00.000Z
title: Appstore-channel ACL gate — assert IAP listener grants (Codex finding, 2026-08-07)
area: testing
files:
  - src-tauri/tauri.appstore.conf.json
  - scripts/verify-appstore-bundle.sh
  - scripts/e2e-spike.sh
---

## Problem

The e2e harness now runs all specs under the DIRECT-channel capability overlay (`tauri.direct.conf.json`, commit `da54123b`) — correct for the direct build, but no gate anywhere exercises the appstore runtime ACL. The appstore-only `iap:allow-register-listener` / `iap:allow-remove-listener` grants in `tauri.appstore.conf.json` are unasserted: `verify-appstore-bundle.sh` checks artifacts/plugins/entitlements but NOT the runtime ACL allowlist. A dropped listener grant would build clean yet break StoreKit refund/revoke live updates at runtime (invisible to unit + direct e2e; cf. `window-mutation-needs-capability` + `tauri-config-capabilities-replace-dir-glob` memories — this exact silent-ACL failure class has bitten twice).

Raised by Codex adversarial review 2026-08-07 (medium) during the e2e-rot remediation. Pre-existing gap (the old base-config harness exercised NEITHER channel's overlay), not a regression of that change.

## Solution sketch

Minimum: fatal static assertion in `verify-appstore-bundle.sh` that the effective appstore config contains exactly the two listener grants (and no broad `iap:default`), mirroring its existing sentinel style. Better: an appstore-channel e2e smoke that launches the dev-signed appstore build and asserts `platform.iap.onPurchaseUpdated` can register (no purchase needed — registration success alone proves the ACL).
