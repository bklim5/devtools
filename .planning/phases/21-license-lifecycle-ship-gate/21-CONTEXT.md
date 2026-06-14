# Phase 21: License Lifecycle & Ship Gate - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the license behave correctly across its **whole lifetime** and ship it. Covers **LIC-05** (opportunistic TTL refresh + offline grace), **LIC-07** (self-serve transfer / deactivate), **LIC-08** (revocation → free-tier propagation), **LIC-09** (license status UI), the **live D-18 free-tier flip** (unlicensed in-Tauri installs actually lock theming + ordering/pinning — all 11 tools stay free), and the full **8-case ship-gate matrix on a fresh `tauri build`** against real prod infra.

**Carried forward, locked (do not re-litigate):** raw key in Keychain + the `activate`/`refresh`/`deactivate`/`license_status` Rust primitives already exist (Phase 19); `pro.theming` + `pro.ordering` are the only two entitlements, read from the signed cert (D-54); fully-offline local verify (Ed25519 + fingerprint); calm tone — no toasts/spinners/launch-interruptions (D-34/37/43); prod CE live at `license.tinkerdev.io` (D-46); dev/prod license storage already isolated.

**Out of scope / untouched:** `decoder.ts` + its 19 tests; the Phase 19 Rust verification logic (this phase makes `resolve_status` expiry-aware but does not re-litigate signature/fingerprint verify); the purchase pipeline itself (Phase 20) beyond the email-embedding coordination in D-89.

**Dependency flag:** Phase 20 is still in progress (2/3 — PAY-03 live purchase pending). Planning Phase 21 now is fine; the full ship-gate **execution** needs Phase 20 complete, and D-89 (licensee email in the minted license) must land in the Phase 20 webhook.

</domain>

<decisions>
## Implementation Decisions

### Offline grace & refresh cadence (LIC-05)
- **D-73:** `resolve_status` becomes **TTL/expiry-aware**. Beyond Phase 19's `NotActivated` / `Licensed` / `Problem`, add two states: **OfflineGrace** (cert past `expiry`, can't refresh, Pro still active within the grace window) and **RefreshNeeded** (grace lapsed → dropped to free until a successful refresh). Local verify stays fully offline (Ed25519 + fingerprint) and now also compares the embedded `expiry` vs now.
- **D-74:** **30-day TTL with renew-ahead within 7 days of expiry.** When online and the cert is ≤7 days from (or past) `expiry`, attempt a background re-checkout (`refresh()`) to swap in a fresh cert. Normally-connected users renew **before** ever entering grace.
- **D-75:** **Tight 7-day grace** past `expiry`. If past expiry and refresh can't succeed (offline / service down), Pro stays unlocked for 7 days, then drops to free (`RefreshNeeded`) until a successful refresh. Worst-case revocation exposure ≈ 37 days. Safe because renew-ahead means connected users never reach it.
- **D-76:** **Refresh triggers** = at launch (background, after the window paints) + a **periodic 24h poll** while running + on status-UI open — all only when online and the cert is in the renew/grace/expired window. Silent, non-blocking; a failed attempt leaves the current state untouched. No per-launch hard network check (v1.6 amendment honored).
- **D-77:** **Grace is silent outside the status UI** — no footer nag, no launch interruption while in `OfflineGrace`; the state is visible only when the user opens the settings/status route.

### Transfer & deactivate flow (LIC-07)
- **D-78:** **Deactivate = confirm-first.** Button → calm inline confirm ("This frees your seat so you can activate another Mac; Pro turns off here until you reactivate") → confirm → server delete-machine → clear Keychain key + `machine.lic` → drop to free. Reuses the Phase 19 `deactivate()` primitive.
- **D-79:** **Offline deactivate is blocked** with a calm message ("Connect to the internet to free this seat"); local state is **never** cleared until the server delete confirms — a local-only forget would orphan a consumed seat and still block the new Mac.
- **D-80:** **Seat-taken guidance (resolves the D-36 follow-up).** The `SeatLimit` rejection on a new Mac names the self-serve path ("This key is active on another Mac. There: open DevTools → license status → Deactivate, then activate here.") **plus** a contact fallback ("Lost access to that Mac? Reply to your license email") for the can't-reach-old-device case.
- **D-81:** **Committed `infra/` admin seat-release helper** — an idempotent script that frees a seat by **license key / Lemon Squeezy order ID**, run over SSH against the CE admin API on **localhost** (privileged token stays server-side per D-55). Makes the D-80 contact fallback one repeatable command. Matches the Phase 20 infra-in-repo + privileged-token-server-side pattern (D-50/D-53/D-55).

### Revocation & downgrade messaging (LIC-08)
- **D-82:** **Revocation propagates only on a successful online refresh** — eventual consistency ≤ ~37 days, by design (signed cert data is immutable; re-checkout is the propagation path). A refresh returning revoked/suspended/expired drops entitlements to free, no crash.
- **D-83:** **One calm "Pro is no longer active" state** regardless of cause (server revocation vs natural expiry-after-grace). Same reactivate/refresh action, non-accusatory wording, no exposure of refund status — the user's next step is identical either way.
- **D-84:** **One-time dismissable notice on next open** when entitlements drop, so a paying user isn't surprised their customization reverted. The footer also reflects the state via the existing license-attention affordance; full details live in the settings route. No mid-use toast/dialog interruption.

### Free-tier flip & status UI (LIC-09 + live D-18)
- **D-85:** **Flip the `resolve.ts` Tauri arm** (`src/lib/entitlements/resolve.ts:19`) — replace the hardcoded `FULL_SET` with entitlements derived from the Rust `license_status` command. THE single flip point (ENT-03); the D-31 override stays **downgrade-only**. Unlicensed in-Tauri installs now actually lock theming + ordering/pinning (all 11 tools stay free).
- **D-86:** **Customizations preserved dormant across the flip.** A user's saved theme/order/pins stay in prefs; while locked the app renders **default** theme + default order/pins; activating/buying **restores their exact setup**. Non-destructive and reversible — no data wiped on lock.
- **D-87:** **Dedicated settings route** (app chrome, **not** a tool — sits outside the six-tools/registry constraint, HashRouter-friendly) hosts the license status UI: current state (free / licensed / offline-grace / refresh-needed / problem), masked key + licensee email, and working **refresh + deactivate** actions. Keyboard-reachable, WCAG-AA.
- **D-88:** **Panel activates, settings manages.** The Unlock Pro panel keeps the sales pitch + the D-33 inline activation form for free/unlicensed users; the new settings route owns post-activation **status + management**. Footer attention + command palette route to whichever surface fits the current state.
- **D-89:** **Licensee email embedded in the license.** Coordinate with the Phase 20 webhook (PAY-03) so each minted license carries the buyer email in Keygen license attributes → it flows into `machine.lic` → the status UI reads it from **verified cert data**. Required by criterion 4 and the D-80 support lookup. Masked key is produced Rust-side (last-N chars); the key never round-trips through JS (LIC-04).

### Ship gate
- **D-90:** **8-case ship-gate matrix on a fresh `tauri build`** (criterion 5), against real prod infra (`license.tinkerdev.io`, D-46): valid first-Mac activation · second Mac rejected · offline launch · corrupted `machine.lic` fails closed · copied `machine.lic` fails on foreign fingerprint · TTL-expired grace→refresh · deactivate/transfer end-to-end · revocation propagates on refresh. Verified via the real-WKWebView e2e harness (`docs/HARNESS.md`); dev/prod storage isolation already in place.

### Claude's Discretion
- Exact Rust expiry/grace math, the timer/poll implementation, and the new `LicenseStatusPayload` variant shapes (within D-73's state set).
- Settings-route placement in nav and exact visual layout — defer the visual contract to `gsd-ui-phase` / UI-SPEC.
- Key-masking format (last-N chars).
- Whether preserved-dormant customizations are gated at the render layer or at the prefs-read layer — within D-86's non-destructive rule.
- The mechanism for the one-time drop notice (D-84) within the calm-tone constraint.
- `infra/` admin helper language/shape (D-81), consistent with the Phase 20 infra patterns.
- Copy/wording throughout, within the locked calm tone.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture (locked — do not re-litigate)
- `docs/licensing-research.md` — full locked architecture; §"Revocation" (~30-day TTL + opportunistic re-checkout), §"Open items" (this phase resolves the offline-grace open item: tight 7d grace, renew-ahead 7d, 24h poll), TTL = eventual-consistency model.
- `.planning/phases/19-license-activation-offline-verification/19-CONTEXT.md` — D-33 (activation in upsell panel), D-34/37/43 (calm tone, footer attention state), D-42 (raw key in Keychain; token exchange denied), D-45 (no per-launch network; auto-heal rides this phase's refresh), the existing 4-command Rust surface + `refresh`/`deactivate` primitives.
- `.planning/phases/20-purchase-pipeline/20-CONTEXT.md` — D-54 (entitlement vocabulary `pro.theming`/`pro.ordering` embedded in licenses), D-52 (per-env config switch), D-53/D-55 (infra-in-repo + privileged token server-side — the D-81 helper pattern), the webhook that mints licenses (D-89 email coordination).
- `.planning/phases/18-entitlements-seam-central-gate/18-CONTEXT.md` — D-18 (free-tier pivot: Pro = customization only), D-31 (downgrade-only override), ENT-04 (lock badge + upsell panel ship dormant — this phase activates them live).
- `.planning/REQUIREMENTS.md` — LIC-05/07/08/09 + ENT-04 text.
- `.planning/ROADMAP.md` — Phase 21 detail + 5 success criteria (incl. the 8-case ship-gate matrix).

### Code seams this phase touches
- `src/lib/entitlements/resolve.ts:19` — THE flip point (D-85); swap the Tauri arm to read `license_status`.
- `src/lib/entitlements/entitlements.ts:12-16` — `ENT_THEMING`/`ENT_ORDERING`/`FREE_SET`/`FULL_SET`; the status payload maps to these.
- `src-tauri/src/license/mod.rs` — `resolve_status` (D-73 expiry-awareness + new states), `refresh()`/`deactivate()` primitives, `LicenseStatusPayload`/`ProblemKind` enums.
- `src-tauri/src/license/commands.rs` — the `license_status`/`activate_license`/`refresh_license`/`deactivate_machine` command surface (wire refresh/deactivate to UI; add status fields for masked key + email).
- `src-tauri/src/license/store.rs` — `machine.lic` read/atomic-write (dev/prod filename split already in place).
- `src-tauri/src/license/config.rs` — per-env constants (D-52); TTL/grace/poll constants live near here.
- `src/components/UpsellPanel.tsx` — keeps activation (D-33/D-88); footer attention + palette routing.
- `docs/HARNESS.md` — real-WKWebView e2e gate runbook (ports, preflight, WebKit quirks) for the status UI + ship-gate matrix.

### External (Keygen)
- https://keygen.sh/docs/choosing-a-licensing-model/offline-licenses/ — TTL/re-checkout (refresh) + revocation propagation model.
- https://keygen.sh/docs/api/ — machines API (delete-machine for deactivate/seat-release D-81); license attributes/metadata (email embedding D-89).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Rust license primitives (Phase 19)** — `refresh()` (LIC-05) and `deactivate()` (LIC-07) already exist callable-but-unwired; `license_status` command live. This phase makes them expiry-aware and wires them to UI/background, rather than building from scratch.
- **`refreshEntitlements()` live-flip path** — the entitlement store re-resolves without restart (proven by the D-32 dev toggle + Phase 19 activation). Refresh/deactivate/drop-to-free all reuse it.
- **D-29 footer license-attention affordance + Unlock Pro panel** — the existing surfaces for problem/attention states; revocation/refresh-needed reflect through them (D-77/D-84).
- **Phase 20 `infra/` pattern + privileged admin token on the VPS** — the D-81 seat-release helper rides this (SSH + CE admin API on localhost).
- **Real-WKWebView e2e harness** — the ship-gate matrix (D-90) runs through it; dev/prod storage isolation already lets e2e/dev activity not clobber a release `machine.lic`.

### Established Patterns
- Rust core thin; per-env + tunable constants are compile-time consts (TTL/grace/poll near `config.rs`); `cargo test` covers the license module.
- Tools/components import `src/lib/platform/`, never `@tauri-apps/*` directly; entitlement decisions go through `resolveEntitlements()` only (single flip point).
- lefthook unit gate (tsc + vitest + eslint) per commit; real-WKWebView e2e for UI surfaces; TDD lands tests GREEN with their impl (no standalone RED commits).
- Calm, quiet UX — no toasts, no spinners, no launch interruptions (D-34/37/43); locked features stay visible, not hidden (ENT-04, no opacity-only locked state).

### Integration Points
- `resolve.ts` Tauri arm → `license_status` (D-85, the live flip).
- New settings route (app chrome) ← footer attention + command palette routing (D-87/D-88).
- Background refresh scheduler (launch + 24h poll) → `refresh_license` command → `refreshEntitlements()` live flip.
- Phase 20 webhook → embed buyer email in license (D-89) → `machine.lic` → status UI.
- `infra/` seat-release helper → CE admin API (localhost on the VPS).

</code_context>

<specifics>
## Specific Ideas

- **Renew-ahead is the design centerpiece:** because the app renews within 7 days of expiry while online, a normally-connected user **never sees** the OfflineGrace/RefreshNeeded states — grace exists only for the genuinely-long-offline case.
- **Conversion first.** The user's priority is getting real users to sign up and purchase; polish like an admin dashboard is explicitly parked (see Deferred).
- Calm tone throughout, consistent with the prior license phases — the lifecycle states must never feel alarming.
- The licensee email shown in the UI doubles as the **support lookup key** for the D-80/D-81 manual seat-release path.

</specifics>

<deferred>
## Deferred Ideas

- **Admin dashboard for seat/license tracking** — so manual seat-release (D-81) is mistake-proof. Parked; conversion-first. Revisit after first real purchases.
- **Self-serve lost-key resend endpoint** (lost-key recovery) — carried from Phase 20; manual reply-to-email lookup for now.
- **Offsite nightly pg_dump** of the license DB — Phase 20 deferred follow-up (provider snapshots are the floor).
- **Multi-device tier** (raise `maxMachines` > 1) — future milestone; licenses are `maxMachines=1`.

</deferred>

---

*Phase: 21-license-lifecycle-ship-gate*
*Context gathered: 2026-06-14*
