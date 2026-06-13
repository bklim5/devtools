---
created: 2026-06-13T20:10:00+0100
title: Phase 20 webhook — Medium code-review findings (6–10)
area: backend/security
files:
  - src-tauri/capabilities/default.json
  - tsconfig.json
  - scripts/check-dev-strip.sh
  - test/e2e/license-buy.e2e.ts
  - server/webhook/src/keygen.ts
---

## Problem

`/code-review high` on Phase 20 Wave 1 (`98fc5e91..HEAD`, 2026-06-13) found 5 Critical bugs (fixed separately) and these 5 Medium items, deferred here by user choice.

## Items

**6. `server/webhook/src/keygen.ts:57` — `searchByOrderId` returns `data[0]` without confirming `metadata.orderId === orderId`.**
If the CE `metadata[orderId]=` filter is loose/ignored (returns all licenses), an unrelated license is read as the idempotency hit → real buyer treated as already-fulfilled, gets nothing. `KeygenLicense.attributes.metadata.orderId` is available — add a `=== orderId` guard. (NOTE: may already be partially addressed by the Critical-1/4 idempotency rewrite — re-check before acting.)

**7. `src-tauri/capabilities/default.json:19` — opener scoped `https://*` (any host).**
The seam forwards any string to `openUrl`, so the runtime guardrail is "open any https URL" — the open-redirect surface the T-20-01 threat model flags. Scope to `"url": "https://tinkerdev.io/*"` (or the exact buy URL). Coordinate with the `mailto:` feedback todo — widen scope deliberately/narrowly, never to `*`.

**8. `tsconfig.json` — no `"types": []` allowlist; `@types/node` (hoisted via the new `server/webhook` workspace member) leaks Node globals into the webview app's `tsc --noEmit` gate.**
Node globals (`process`, `Buffer`, `NodeJS.Timeout`) become visible across `src/**`, masking browser-only type errors (e.g. `setTimeout` typed as `NodeJS.Timeout`, not `number`). Add `"types": []` to root tsconfig; keep Node types scoped to `server/webhook/tsconfig.json`. Verify the existing app still typechecks after.

**9. `scripts/check-dev-strip.sh` — prod-constant check passes on a placeholder binary.**
Greps that the prod *host* is present but never asserts the `PROD_ACCOUNT_ID_PLACEHOLDER`/`PROD_PUBKEY_PLACEHOLDER` sentinels are *absent*. A release built before 20-03 fills them passes (only the un-run `cargo test --release` tripwire catches it). The `localhost`-absent check is also WARN-only + noisy (deps embed "localhost"). Add a placeholder-absent assertion that FAILS the script; use `grep -F` for the host string.

**10. `test/e2e/license-buy.e2e.ts` — Buy e2e can pass vacuously.**
Asserts only hash-unchanged + modal-still-mounted, which a silently broken/disconnected onClick also satisfies. Stub a window-level `platform.opener.openUrl` in the page and assert it was called with the exact URL (observable in-webview; native browser-open stays a manual-walkthrough item).

## Notes

- Items 7–9 are good to fold into Phase 20-03 (it already touches `check-dev-strip.sh`, `config.rs`, capability scope at the ship gate).
- Item 6 overlaps the Critical idempotency fix — confirm current state of `searchByOrderId` first.
- Lower-severity (not even Medium): `PORT: Number(env.PORT ?? 8787)` empty-string → 0 → random port; prod-host string triplicated (config.rs const + tripwire + check-dev-strip); cleanup — `KeygenConfig` duplicates `Config` keygen fields, `FulfillDeps` re-wraps concrete verify/parse, `testStore` hand-rolls no-ops `browserPlatform` already has.
