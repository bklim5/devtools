---
created: 2026-08-08T00:30:00.000Z
title: Backup hardening — deferred Codex items (external digest escrow, atomic script deploy)
area: infra
files:
  - infra/keygen/deploy.sh
  - infra/keygen/backup-lib.sh
  - infra/keygen/RUNBOOK.md
---

## Problem

Two Codex adversarial findings from the 260807-ohd backup pipeline review were deliberately deferred (cheap partial mitigations shipped instead — see 260807-ohd-SUMMARY.md):

1. **Manifest digests share the artifact's trust boundary.** The encrypted manifest lives in the same R2 bucket under the same credentials + GPG passphrase as the artifact. An actor with password-manager access (R2 token + passphrase) could replace both with a self-consistent older pair. Shipped mitigation: monotonic freshness gate vs the previous manifest (licenses count / max created_at can never regress) + dump-source identity (compose project + container id) in the manifest. NOT shipped: an append-only digest escrow outside the R2/GPG boundary (e.g. healthchecks.io ping body carrying the manifest sha256, or a second bucket under different credentials).

2. **deploy.sh rsyncs scripts non-atomically.** A partial rsync can leave mixed script versions on the box. Shipped mitigation: `BACKUP_PIPELINE_VERSION` pin asserted by both scripts at startup (mismatch = fatal "PARTIAL DEPLOY"). NOT shipped: versioned release dirs + atomic symlink flip for all of infra/keygen/ (pre-existing deploy.sh design, affects every infra file, not just backup scripts).

## Solution sketch

(1) is ~1 hour: append the manifest sha256 + object name to the healthchecks success ping body (hc-ping stores last 10 KB of ping bodies per check — free, off-R2, append-only enough for forensics); document in RUNBOOK how to cross-check during DR. (2) is a deploy.sh redesign — do only if deploy cadence increases; the version pin covers the realistic accident case.
