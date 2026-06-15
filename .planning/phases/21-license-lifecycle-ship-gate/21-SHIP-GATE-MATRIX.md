# 21 — Ship-Gate Matrix (D-90)

**Phase:** 21 (license-lifecycle-ship-gate) · **Plan:** 05 · **Criterion:** ROADMAP #5

The binding ship gate beyond the standard per-task harness: the whole license
lifecycle proven on a fresh build before release. D-90's eight cases, each with
an honest **method** + **evidence** + **status**.

> **STATUS: PARTIAL — fixture/clock-driven cases (3/4/5/6) PASS; live prod-CE
> cases (1/2/7/8) BLOCKED on a real prod-CE key.** The fixture cases were driven
> GREEN on the real WKWebView (dev arm) by `test/e2e/ship-gate.e2e.ts` via
> `scripts/e2e-spike.sh` (full suite **19/19**, exit 0, 2026-06-15) + the pure-Rust
> cargo suite (`license::` **82/82**); screenshots captured. The 21-05 SUMMARY
> + the Wave-5 human-verify sign-off (live cases + `gsd-ui-review`) remain OPEN.

## Prod build verification (2026-06-15)

- Fresh PROD-pointed `pnpm tauri build` → `src-tauri/target/release/bundle/macos/TinkerDev.app` + `dmg/TinkerDev_0.3.1_aarch64.dmg` (final non-zero exit is only the absent updater-signing key — bundles confirmed present).
- `check-dev-strip.sh` (`CHECK_PROD_BINARY`): dev toggle ABSENT ✓ · DEV-only `"full"` override ABSENT ✓ · release binary embeds prod constant `license.tinkerdev.io` ✓ (real prod constants, not placeholders — the live cases CAN run against prod CE once a real key exists). **WARN:** a `localhost` string is present in the release binary — almost certainly a dependency string (the Keygen host constant is confirmed prod); verify it is NOT the Keygen host before release.

## Storage isolation (why the dev arm is safe for fixture cases)

The DEBUG build (`pnpm tauri:dev:e2e`, the e2e harness arm) reads
`machine.dev.lic` + the dev Keychain service `com.tinkerdev.app.dev.license`
(store.rs / keychain.rs `cfg(debug_assertions)` split, quick 260614-nox). A
RELEASE / PROD-pointed build reads `machine.lic` + the prod service
`com.tinkerdev.app.license` and is the only arm that hits
`license.tinkerdev.io` (D-46). So the **fixture cases (3/4/5/6) run on the dev
arm without ever touching a shipped buyer's release `machine.lic`**, and the
**live prod cases (1/2/7/8) require the PROD-pointed release build**.

## Method legend

| Method | Meaning |
|--------|---------|
| `dev-harness-auto` | Driven on the real WKWebView by `test/e2e/ship-gate.e2e.ts` via `scripts/e2e-spike.sh` (dev arm; fixture-seeded). |
| `cargo-clock-injection` | Proven by pure-Rust `cargo test license::` with an injected `now` / `NoNetwork` client (no wall-clock flake, no sockets). |
| `release-manual` | Live walkthrough against prod CE (`license.tinkerdev.io`) on a fresh PROD-pointed `tauri build`; needs a real key + CE admin. |

## The 8-case matrix (D-90)

| # | Case | Requirement | Method | Evidence | Status |
|---|------|-------------|--------|----------|--------|
| 1 | Valid activation on first device → Pro unlocks (theming + ordering) | LIC-01 | release-manual | _BLOCKED — needs a real prod-CE key (see below)_ | **blocked** |
| 2 | Second device rejected → calm seat-limit + self-serve path (D-80) | LIC-02 | release-manual | _BLOCKED — needs the same real key + a second fingerprint_ | **blocked** |
| 3 | Offline launch / valid LOCAL verify → Licensed, network-free | LIC-03 | cargo-clock-injection + `dev-harness-auto` (foreign-FP branch) + release-manual (Licensed UI) | cargo **82/82** incl. `resolve_status` network-free (D-45 `NoNetwork` panics on any call) · e2e: the network-free local-verify path ran GREEN on the real WKWebView (Case 5 is the same pure-local branch) → `test/e2e/__screenshots__/ship-gate-case5-foreign.png` ✓ · Licensed-UI-on-a-genuine-cert → live walkthrough (needs real key) | **auto ✓ / live UI pending** |
| 4 | Corrupted `machine.lic` → fail closed to free, calm problem state | LIC-06 | dev-harness-auto | ✓ GREEN on real WKWebView (`scripts/e2e-spike.sh`, 2026-06-15) — `ship-gate.e2e.ts` "Case 4" (problem state "License needs attention", locked customization opens upsell = free) + `test/e2e/__screenshots__/ship-gate-case4-corrupt.png` | **pass ✓** |
| 5 | Copied `machine.lic` → fail closed on foreign fingerprint | LIC-06 | dev-harness-auto | ✓ GREEN on real WKWebView — `ship-gate.e2e.ts` "Case 5" (ForeignMachine → problem → free) + `test/e2e/__screenshots__/ship-gate-case5-foreign.png` · also cargo `valid_cert_with_wrong_fingerprint_resolves_to_foreign_machine` | **pass ✓** |
| 6 | TTL-expired → grace → refresh | LIC-05 | cargo-clock-injection | ✓ cargo **82/82**: `classify_within_grace_is_grace`, `classify_past_grace_is_lapsed`, `classify_boundaries_are_inclusive_active_then_grace`, `needs_refresh_*` (injected `now`) — authoritative grace→lapsed→refresh proof · Licensed-offline / refresh-restores UI → live walkthrough on a genuine expiring cert | **auto ✓ / live UI pending** |
| 7 | Deactivate / transfer end-to-end → seat freed, reactivates on new device | LIC-07 | release-manual | _BLOCKED — needs a real prod-CE key + `infra/keygen/release-seat.sh` (D-81) against prod CE_ | **blocked** |
| 8 | Revocation propagates on refresh → entitlements drop to free, calm | LIC-08 | release-manual | _BLOCKED — needs a real prod-CE key + CE admin revoke/suspend_ | **blocked** |

## Case-3 and case-6 mechanism (explicit — D-90 honesty)

Both **Licensed (case 3)** and the **OfflineGrace / RefreshNeeded transitions
(case 6)** require a *signed* cert that **cannot be produced from committed
material headlessly**:

- A **matched-fingerprint** cert (case 3 → Licensed) needs a live CE checkout
  bound to *this dev machine's real fingerprint*. The committed
  `src-tauri/fixtures/ce-machine.lic` carries the Plan-01 **synthetic**
  fingerprint `b70ebcaf…`, so on any live machine it resolves to
  **ForeignMachine** — which is exactly Case 5, the same pure-local verify path.
- An **arbitrary-expiry** cert (case 6 → grace/lapsed) needs the CE Ed25519
  **signing key**, which is server-side and never committed; the one committed
  fixture has a fixed `2026-07-12` expiry.

Re-signing arbitrary fixtures is therefore **NOT feasible with committed
material**. Per the plan's Task-1 guidance, the authoritative proof for the
*network-free local verify* (case 3) and the *grace→refresh* lifecycle (case 6)
is the pure-Rust suite — `resolve_status_at` / `needs_refresh_at` /
`classify_expiry` clock-injection tests + the D-45 `NoNetwork`-panics test — with
the live-build walkthrough covering the genuine Licensed / offline-grace UI on a
real activated cert. The e2e spec drives the fixture-reachable fail-closed
branch (Case 5) on the real WKWebView, which IS the case-3 pure-local code path.

## BLOCKED cases — resume condition (1, 2, 7, 8)

Cases 1/2/7/8 are **BLOCKED — needs a real prod-CE key minted via the live
Phase-20 purchase (PAY-03) + CE admin actions**:

- **Case 1/2:** a real prod-CE key (with the D-89 buyer email embedded) minted
  through the live LS → webhook → Keygen pipeline; case 2 also needs a second
  device / fingerprint.
- **Case 7:** the same key + `infra/keygen/release-seat.sh` (D-81) run against
  prod CE to free the seat for the transfer leg.
- **Case 8:** the same key + a CE-admin **revoke/suspend**, then drive Refresh in
  the app.

**Resume when a real prod-CE key is available** (Phase 20 PAY-03 closed): run
the four live cases on a fresh **PROD-pointed `tauri build`** against
`license.tinkerdev.io`, fill the evidence cells, and complete the Wave-5
human-verify sign-off + the `gsd-ui-review` WCAG-AA audit.

## Secrets policy (T-21-18)

This document records **masked keys only** (`••••••••{last4}`, produced
Rust-side — LIC-04) and the buyer's own email. **Never** paste a raw license key
or a CE admin token here — redact to the masked form. The seat-release / revoke
command *output* is recorded with the key/token masked.

---

_Evidence cells marked "(orchestrator: confirm …)" are placeholders for the
`scripts/e2e-spike.sh` run that executes `ship-gate.e2e.ts` + captures the
screenshots. The matrix is finalized — and the BLOCKED cases resumed — at the
Wave-5 human-verify gate._
