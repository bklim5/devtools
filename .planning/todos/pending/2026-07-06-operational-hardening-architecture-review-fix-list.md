---
created: 2026-07-06T21:46:09.575Z
title: Operational hardening — architecture-review fix list
area: docs
files:
  - docs/architecture-review-2026-07-06.md
  - docs/RELEASE.md:56-58
  - eslint.config.js
  - .planning/milestones/
  - scripts/verify-appstore-bundle.sh
  - CHANGELOG.md
---

## Problem

The 2026-07-06 architecture review (`docs/architecture-review-2026-07-06.md`) found the project's risk concentrated in operations/knowledge, not code. Owner has already completed the manual key backups (minisign key, Apple .p8, three signing certs as .p12, one-off CE pg_dump — all in password manager). The repo-side fixes remain:

1. **Restore deleted v1.6–v1.8 planning artifacts** (KG-1, worst gap): commit `9fcbbd9d` deleted phase 18–30 planning docs without archiving; the D-40..D-81 / T-19/20/30 identifiers cited throughout code are now only in git history. Restore via `git checkout 9fcbbd9d^ -- .planning/phases/...` → move under `.planning/milestones/v1.6-phases/` etc. Also fix whatever milestone-close step deleted instead of archiving.
2. **`docs/KEYS.md`** (F1/KG-2): trust-anchor inventory (minisign keypair, CE Ed25519 keypair, Apple .p8 + certs with expiries 1 Feb 2027 / 22 Jun 2027, LS webhook secret, Resend key), loss consequences, rotation procedures — incl. "minisign rotation strands the fleet; planned migration = transitional release signed with old key carrying new pubkey".
3. **Rewrite `docs/RELEASE.md`** (F3/F8/KG-3): stale, contradicts real `release:bump`/`release:publish` pipeline; line 56-58 gives fleet-stranding regeneration advice. Add rollback, update-host-migration, version/tag-scheme sections; backfill CHANGELOG `[Unreleased]` (empty since 0.4.1 despite v1.6–v1.9 shipping).
4. **ESLint `no-restricted-imports`** (F5): forbid `@tauri-apps/*` outside `src/lib/platform/**`; forbid `BrowserRouter`. Converts prose invariants to pre-commit failures.
5. **`docs/CHANNELS.md`** (F7/KG-4): direct-vs-appstore matrix (capability overlay silent-drop trap, plugin strip, VITE_CHANNEL, upsell/entitlements).
6. **`docs/RELEASE-MACHINE.md`** (F2): rebuild-the-laptop inventory (keys, keychain items, provisioning profiles, gh auth, box SSH, cert expiries).
7. **Invariants header on `scripts/verify-appstore-bundle.sh`** (F6): one line per asserted invariant with D/T identifier.

## Solution

Work the review doc's prioritized fix list top-down (items 1–3 are one sitting each; item 4 is ~30 min). Suitable as an inserted decimal phase (e.g. 34.1) or a sequence of /gsd-quick tasks. Review doc has file:line evidence for every claim — planner should read it first. Defer CI (backlog 999.2) until after items 1–3; decide key custody in KEYS.md before CI needs the signing key as a secret.
