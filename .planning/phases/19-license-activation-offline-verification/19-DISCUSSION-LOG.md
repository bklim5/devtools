# Phase 19: License Activation & Offline Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 19-license-activation-offline-verification
**Areas discussed:** Activation UX, Error handling UX, Keygen account & SPIKE setup, Fail-closed surfacing

---

## Activation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in upsell panel | D-22 slot reveals form in place; one WCAG-AA surface | ✓ |
| Dedicated modal | Separate focused activation modal | |
| Dedicated route/page | Licensing page in router | |

| Option | Description | Selected |
|--------|-------------|----------|
| Inline status line | Disabled submit + calm aria-live text | ✓ |
| Stepper detail | 3-step progress display | |

| Option | Description | Selected |
|--------|-------------|----------|
| Success state, user dismisses | Calm "Licensed" confirmation; sidebar unlocks behind | ✓ |
| Auto-close after ~2s | Brief confirmation then self-dismiss | |
| Close immediately | Unlocked UI is the confirmation | |

---

## Error handling UX

| Option | Description | Selected |
|--------|-------------|----------|
| Message + support mailto | Escape hatch until Phase 21 transfer | |
| Message only | Names deactivate-other-machine path | ✓ (user: "we will figure this out in phase 21, please remember to follow-up later") |

| Option | Description | Selected |
|--------|-------------|----------|
| Inline below field | Calm, aria-live, value kept | ✓ |
| Toast | Transient notification | |
| Error dialog | Modal | |

| Option | Description | Selected |
|--------|-------------|----------|
| One generic message | Same line for offline + service-down | |
| Distinguish offline vs service-down | Two messages | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| Trim/normalize only | Server validates | ✓ |
| Format-validate locally | Reject malformed before network | |

---

## Keygen account & SPIKE setup

Free-text answers (interrupted the AskUserQuestion to reply directly):

- **Tier:** self-host Keygen CE — asked for exploration of requirements + whether the agent can do it. Research run live (keygen.sh/docs/self-hosting + CE/EE comparison): CE includes offline licensing/machine files/Ed25519; needs Docker + Postgres 13+ + Redis 6.2+; CE releases lag Cloud ~6 months. Verdict: viable.
- **Account:** none exists — answer: self-hosted CE needs no keygen.sh signup; first-party account is created on your own instance during setup.
- **Constants:** fine committing pubkey + salt "as long as committing them is secure" — verified: forgery requires server-side private key; salt only de-correlates fingerprints; safe under a public repo.
- **SPIKE first:** confirmed.

Follow-up confirmations:

| Option | Description | Selected |
|--------|-------------|----------|
| Local Docker CE now, defer prod | Agent brings up CE locally; VPS-vs-cloud at Phase 20/21 | ✓ |
| VPS from day one | Provision public instance now | |

| Option | Description | Selected |
|--------|-------------|----------|
| Docker installed: Yes | Verify daemon and proceed | ✓ |
| No / not sure | Install step in SPIKE plan | |

---

## Fail-closed surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Silent + footer hint | Free-tier launch; D-29 row → "needs attention" | ✓ |
| One-time non-modal notice | Dismissible banner + footer state | |
| Status-bar only | Discover on locked feature | |

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct re-activation state | "Couldn't verify" + pre-filled key field | ✓ |
| Generic panel | Free-tier pitch with key slot | |

| Option | Description | Selected |
|--------|-------------|----------|
| Manual re-activation only | One user-initiated call = whole network surface | ✓ |
| Silent auto-repair when online | Background re-checkout on fail-closed launch | |

---

## Claude's Discretion

Rust module/error design, machine.lic location + atomic writes, exact copy, form keyboard semantics, Docker compose layout, deactivate_machine wiring depth.

## Deferred Ideas

- Seat-limit support/transfer escape hatch → Phase 21 (explicit user follow-up request)
- Auto-heal corrupt lic via Keychain key → Phase 21
- Production CE hosting decision → Phase 20
- Offline-grace on TTL lapse → Phase 21
