# Phase 21: License Lifecycle & Ship Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 21-license-lifecycle-ship-gate
**Areas discussed:** Offline grace & refresh cadence; Transfer & deactivate flow; Revocation & downgrade messaging; Free-tier flip & status-UI home

---

## Offline grace & refresh cadence (LIC-05)

| Question | Options | Selected |
|----------|---------|----------|
| Grace length past TTL | Indefinite-while-offline / Bounded +30d / **Tight** | Tight (user leaned tight, asked how TTL works) |
| Renew-ahead window | **Within 7 days** / Halfway ~15d / Only at-or-after expiry | Within 7 days of expiry |
| Grace window length | **7 days** / 3 days / Hard-at-expiry | 7 days past expiry |
| Refresh trigger | Launch + status-UI / Launch only / **Launch + periodic poll** | Launch + periodic poll (cadence 24h) |
| Poll cadence | **Every 24h** / 12h / 6h | Every 24 hours |
| Grace surfacing | **Silent (status UI only)** / Gentle footer hint / Hint near end | Silent; only in status UI |

**Notes:** User asked how the TTL mechanism works (periodic vs launch-only). Explained: 30d `expiry` embedded in signed `machine.lic`; local verify ignores it today; refresh = re-checkout a fresh cert. Introduced **renew-ahead** (renew before expiry while online) — this is why tight grace is safe: connected users never hit grace. Final model: 30d TTL → renew-ahead ≤7d → 7d grace → free.

## Transfer & deactivate flow (LIC-07)

| Question | Options | Selected |
|----------|---------|----------|
| Deactivate UX | **Confirm step first** / One-click | Confirm step first |
| Seat-taken guidance (D-36) | **Self-serve steps + contact line** / Steps only / Message + support link | Self-serve steps + contact line |
| Offline deactivate | **Block with calm message** / Local-forget fallback | Block with calm message |
| Manual seat-release | **Committed infra/ helper** / Ad-hoc ops step | Committed infra/ helper |

**Notes:** User asked how to clear a seat server-side when a customer reaches out (lost old Mac). Explained: privileged admin token on the VPS → CE machines API → delete the bound machine. User approved a committed `infra/` helper now and parked an admin dashboard as a later (conversion-first) follow-up.

## Revocation & downgrade messaging (LIC-08)

| Question | Options | Selected |
|----------|---------|----------|
| Drop notice | Calm status state, silent drop / **One-time notice on next open** / Fully silent | One-time notice on next open |
| Distinguish revocation vs expiry-lapse | **Treat both as one calm state** / Distinguish the two | Treat both as one calm state |

**Notes:** Revocation is eventual (≤~37d, on successful refresh) by design. One calm "Pro no longer active" state + a one-time notice so a paying user isn't surprised.

## Free-tier flip & status-UI home (LIC-09 + live D-18)

| Question | Options | Selected |
|----------|---------|----------|
| Status UI home | Reuse Unlock Pro panel / **Dedicated settings route** | Dedicated settings route |
| Flip handling for existing customizations | **Preserve dormant, restore on unlock** / Reset to default / Grandfather | Preserve dormant, restore on unlock |
| Licensee email source | **Keep it; ensure minting embeds email** / Drop email | Keep it; ensure minting embeds email |
| Activation/status split | **Panel activates, settings manages** / Consolidate into settings | Panel activates, settings manages |

**Notes:** User asked why licensee email is needed in the UI. Explained: (1) it's ROADMAP criterion 4; (2) it's the support lookup key for the D-80/D-81 seat-release path; (3) identity confidence. User kept it and approved coordinating with the Phase 20 webhook to embed the email. Status UI lives in a new dedicated settings route (app chrome, outside the six-tools/registry constraint); activation stays in the Unlock Pro panel.

## Claude's Discretion

- Rust expiry/grace math, timer/poll implementation, new payload variant shapes; settings-route placement + visual layout (defer to UI-SPEC); key-masking format; dormant-customization gating layer; one-time-notice mechanism; infra/ helper shape; copy/wording.

## Deferred Ideas

- Admin dashboard for seat/license tracking (parked, conversion-first); self-serve lost-key resend (from Phase 20); offsite nightly pg_dump (from Phase 20); multi-device tier (maxMachines > 1).
