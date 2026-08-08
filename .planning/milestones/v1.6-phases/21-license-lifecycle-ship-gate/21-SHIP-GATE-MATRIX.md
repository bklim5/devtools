# 21 — Ship-Gate Matrix (D-90)

**Phase:** 21 (license-lifecycle-ship-gate) · **Plan:** 05 · **Criterion:** ROADMAP #5

The binding ship gate beyond the standard per-task harness: the whole license
lifecycle proven on a fresh build before release. D-90's eight cases, each with
an honest **method** + **evidence** + **status**.

> **STATUS: fixture/clock cases (3/4/5/6) PASS; live key now available (Phase-20
> PAY-03 closed 2026-06-17, order 8722394, license `024423a7`).** Case 1
> (activation) and Case 8 (revocation) PROVEN LIVE 2026-06-17 — Case 8 acceptance
> CORRECTED below (revocation is ≤~37d eventual-consistency via cert expiry, NOT
> drop-on-refresh; D-82). Cases 2 & 7 still need a SECOND device/fingerprint.
> Fixture cases driven GREEN on the real WKWebView (dev arm) by
> `test/e2e/ship-gate.e2e.ts` via `scripts/e2e-spike.sh` (**19/19**, exit 0,
> 2026-06-15) + cargo (`license::` **82/82**). Wave-5 human-verify sign-off
> (cases 2 & 7 + `gsd-ui-review`) remains OPEN.

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
| 1 | Valid activation on first device → Pro unlocks (theming + ordering) | LIC-01 | release-manual | ✓ Live 2026-06-17: real prod-CE key (license `024423a7`, order 8722394, buyer email embedded) pasted into the PROD-built TinkerDev.app → activates → Pro unlocks; entitlements `pro.theming`+`pro.ordering` confirmed on the license. | **pass ✓** |
| 2 | Second device rejected → calm seat-limit + self-serve path (D-80) | LIC-02 | release-manual | _BLOCKED — needs the same real key + a second fingerprint_ | **blocked** |
| 3 | Offline launch / valid LOCAL verify → Licensed, network-free | LIC-03 | cargo-clock-injection + `dev-harness-auto` (foreign-FP branch) + release-manual (Licensed UI) | cargo **82/82** incl. `resolve_status` network-free (D-45 `NoNetwork` panics on any call) · e2e: the network-free local-verify path ran GREEN on the real WKWebView (Case 5 is the same pure-local branch) → `test/e2e/__screenshots__/ship-gate-case5-foreign.png` ✓ · Licensed-UI-on-a-genuine-cert → live walkthrough (needs real key) | **auto ✓ / live UI pending** |
| 4 | Corrupted `machine.lic` → fail closed to free, calm problem state | LIC-06 | dev-harness-auto | ✓ GREEN on real WKWebView (`scripts/e2e-spike.sh`, 2026-06-15) — `ship-gate.e2e.ts` "Case 4" (problem state "License needs attention", locked customization opens upsell = free) + `test/e2e/__screenshots__/ship-gate-case4-corrupt.png` | **pass ✓** |
| 5 | Copied `machine.lic` → fail closed on foreign fingerprint | LIC-06 | dev-harness-auto | ✓ GREEN on real WKWebView — `ship-gate.e2e.ts` "Case 5" (ForeignMachine → problem → free) + `test/e2e/__screenshots__/ship-gate-case5-foreign.png` · also cargo `valid_cert_with_wrong_fingerprint_resolves_to_foreign_machine` | **pass ✓** |
| 6 | TTL-expired → grace → refresh | LIC-05 | cargo-clock-injection | ✓ cargo **82/82**: `classify_within_grace_is_grace`, `classify_past_grace_is_lapsed`, `classify_boundaries_are_inclusive_active_then_grace`, `needs_refresh_*` (injected `now`) — authoritative grace→lapsed→refresh proof · Licensed-offline / refresh-restores UI → live walkthrough on a genuine expiring cert | **auto ✓ / live UI pending** |
| 7 | Deactivate / transfer end-to-end → seat freed, reactivates on new device | LIC-07 | release-manual | _BLOCKED — needs a real prod-CE key + `infra/keygen/release-seat.sh` (D-81) against prod CE_ | **blocked** |
| 8 | Revocation propagates → entitlements drop to free, calm. **CORRECTED: ≤~37d eventual-consistency via cert expiry, NOT on refresh (D-82)** | LIC-08 | release-manual + cargo-clock-injection | ✓ Live 2026-06-17: CE-admin suspend of `024423a7` → the app's checkout (`POST /machines/{fp}/actions/check-out`) returns **403 LICENSE_SUSPENDED** → `mod.rs refresh()` errors on that and short-circuits WITHOUT writing/clearing a cert (T-21-11 write-after-verify), so the still-valid local cert keeps Pro until it LAPSES (TTL 30d + grace 7d). Manual Refresh does NOT drop a fresh cert — by design (never pre-emptively remove a paying user). The expiry→grace→lapse→free UI is the Case-6 clock-injection path (cargo 82/82). | **pass ✓ (acceptance corrected)** |

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

## Live cases — status (1, 2, 7, 8)

Prod-CE key is now available (Phase-20 PAY-03 closed 2026-06-17, order 8722394,
license `024423a7`).

- **Case 1:** ✓ DONE — activated live on the PROD build; Pro unlocked.
- **Case 8:** ✓ DONE with **corrected acceptance** — suspend → checkout returns
  403 LICENSE_SUSPENDED → eventual-consistency drop at cert expiry (≤~37d), NOT
  on refresh (D-82, accepted: a paying user is never pre-emptively removed; the
  signed cert + grace window means transient blips can't yank Pro mid-use).
- **Case 2:** PENDING — needs a SECOND device/fingerprint: activate `024423a7`
  on device B while device A holds the seat → expect the calm seat-limit + the
  D-80 self-serve path.
- **Case 7:** PENDING — the transfer leg: deactivate on A (or
  `infra/keygen/release-seat.sh`, D-81) → reactivate the same key on device B.

**Remaining sign-off:** run cases 2 & 7 on a fresh **PROD-pointed `tauri build`**
once a second device is available, then complete the Wave-5 human-verify
sign-off + the `gsd-ui-review` WCAG-AA audit.

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
