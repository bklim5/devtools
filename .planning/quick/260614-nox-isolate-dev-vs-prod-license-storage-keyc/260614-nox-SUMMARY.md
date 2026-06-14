---
phase: quick-260614-nox
plan: 01
subsystem: licensing
tags: [licensing, keychain, storage, cfg-split, e2e-harness, isolation]
requires:
  - config.rs D-52 cfg(debug_assertions) split (precedent mirrored)
provides:
  - dev/prod-isolated Keychain service (debug=com.tinkerdev.app.dev.license)
  - dev/prod-isolated machine.lic filename (debug=machine.dev.lic)
  - e2e-spike preflight targeting the DEV Keychain service only
affects:
  - src-tauri/src/license/keychain.rs
  - src-tauri/src/license/store.rs
  - scripts/e2e-spike.sh
tech-stack:
  added: []
  patterns:
    - "#[cfg(debug_assertions)] / #[cfg(not(debug_assertions))] storage-namespace split (mirrors config.rs D-52)"
key-files:
  created: []
  modified:
    - src-tauri/src/license/keychain.rs
    - src-tauri/src/license/store.rs
    - scripts/e2e-spike.sh
decisions:
  - "Debug arm only gains the .dev variant; release arms stay byte-identical to pre-260614 — zero shipped-install impact (T-nox-03 accept)."
  - "LIC_TMP kept adjacent to LIC_FILE in the SAME dir so write_atomic's same-volume rename stays atomic."
metrics:
  duration: ~10 min
  completed: 2026-06-14
  tasks: 2
  files: 3
---

# Phase quick-260614-nox: Isolate Dev vs Prod License Storage Summary

cfg-split the license Keychain service and `machine.lic` filename by build profile (debug gets a `.dev` variant, release stays byte-identical) and retargeted the e2e-spike preflight at the dev-only Keychain service, so dev/e2e activity can never overwrite or delete a buyer's release license.

## What changed

### Task 1 — cfg-split the storage consts (commit d644c60c)
Mirrored the D-52 `#[cfg(debug_assertions)]` idiom from `config.rs` onto both storage consts, debug arm first.

**Exact values chosen:**

| Const | Debug arm (`cfg(debug_assertions)`) | Release arm (`cfg(not(debug_assertions))`) |
|-------|--------------------------------------|---------------------------------------------|
| `keychain.rs` `SERVICE` | `com.tinkerdev.app.dev.license` | `com.tinkerdev.app.license` |
| `store.rs` `LIC_FILE` | `machine.dev.lic` | `machine.lic` |
| `store.rs` `LIC_TMP` | `machine.dev.lic.tmp` | `machine.lic.tmp` |

The release arms are **byte-identical** to the pre-260614 values — shipped installs read/write exactly the same item and file as before.

**tmp-file handling:** `LIC_TMP` is split in lockstep with `LIC_FILE` so the `.tmp` stays adjacent to its base name in the SAME `app_data_dir` (`machine.dev.lic.tmp` next to `machine.dev.lic`). `write_atomic` writes the tmp then `rename`s it over the base file; keeping both in one directory preserves the same-volume APFS atomic rename. No call-site change: `Entry::new(SERVICE, USER)` and the `self.dir.join(...)` calls read the consts, so the split propagates automatically.

Doc comments on both consts explain the split mirrors config.rs D-52: a debug build embeds the local-CE Ed25519 key, so its cert can only verify against the `.dev` storage namespace, isolating it from the release item/file in the shared bundle-id `app_data_dir` + Keychain.

### Task 2 — retarget e2e-spike preflight (commit 50efac4f)
Section-2.5 of `scripts/e2e-spike.sh` ran `pnpm tauri:dev:e2e` (a DEBUG build), which post-Task-1 stores under `com.tinkerdev.app.dev.license`. Changed BOTH `security` invocations — the `find-generic-password` guard and the `delete-generic-password` call — from `-s com.tinkerdev.app.license` to `-s com.tinkerdev.app.dev.license`, and updated the adjacent comment to state the new isolation guarantee (the preflight is now structurally incapable of touching a buyer's release item, T-nox-01). Preflight ordering, orphan/port logic, and `PREFLIGHT_ONLY` handling untouched.

### Task 3 — fix the D-44 e2e seed path (commit 37917aaa, codex review P1)

`/codex:review` (orchestrator-run) caught a real **P1** the Rust-scoped grep missed: `test/e2e/license.e2e.ts:53` hardcoded `const LIC_PATH = join(LIC_DIR, "machine.lic")` to SEED a corrupt cert for the D-44 problem-state test. The e2e runs against `tauri dev` (a DEBUG build), which post-Task-1 reads `machine.dev.lic` — so the seed would land in a file the app no longer reads, silently breaking (or masking) the "couldn't be verified" assertion. Repointed `LIC_PATH` to `machine.dev.lic` and documented why. (The e2e-spike preflight itself touches only the Keychain item, not the file, so no further harness change was needed.)

## Grep-completeness check

Grepped `src-tauri` + `scripts` for every reader of the old literals before and after:

- **`com.tinkerdev.app.license`** — source readers were ONLY `keychain.rs:19` (now the release arm of the cfg-split) and `e2e-spike.sh:106/108` (now retargeted). The sole remaining occurrence in the script is inside the new explanatory comment naming the item the preflight can NOT touch; both `security` calls target the dev service.
- **`machine.lic`** — Rust const defs at `store.rs:9-10` (now split). **GAP (caught by codex, fixed in Task 3):** the original grep scoped `src-tauri` + `scripts` and so missed `test/e2e/license.e2e.ts:53`, a TypeScript seed path that hardcoded `machine.lic`. Lesson: a storage-filename rename must also grep `test/` for harness-level path literals, not just the Rust source. All other hits are doc comments, the static `ce-machine.lic` test fixture, and gitignored `target/` artifacts.
- **`SERVICE` / `LIC_FILE` / `LIC_TMP` symbols** — confined to `keychain.rs` (SERVICE) and `store.rs` (LIC_FILE/LIC_TMP); `mod.rs` uses the `KeychainAccess`/`LicFileStore` traits, never the literals. The store tests reference `LIC_FILE`/`LIC_TMP` symbolically (no literal asserted), so they stay green under the active debug profile with no edit.

The split is complete; nothing else in source hardcodes the prod value.

## Verification

- `cd src-tauri && cargo test --lib license::` → **50 passed; 0 failed** (default debug profile; SERVICE resolves to `com.tinkerdev.app.dev.license`, LIC_FILE to `machine.dev.lic`).
- Repo gate: `pnpm test` **889/889**, `pnpm tsc --noEmit` clean, `pnpm lint` 0 errors (2 pre-existing SidebarResetMenu.tsx warnings, out of scope).
- `grep` proves the dev service literal present and the prod-service `password -s com.tinkerdev.app.license` literal absent from the script; `bash -n scripts/e2e-spike.sh` clean.
- Release arms verified byte-identical to today via the cfg-split source.
- `decoder.ts` + its 19 tests untouched.

### Orchestrator-run binding DoD (post-executor)
- **`/simplify`** — self-assessed as disproportionate for a ~20-line mechanical cfg-split that mirrors the established config.rs D-52 pattern (no duplication beyond the necessary cfg pairs, right altitude, nothing to reuse). Skipped the 4-agent fan-out deliberately.
- **`/codex:review`** (`codex review --base`) — DONE. One real **P1** found + fixed (commit `37917aaa`, Task 3 above): the D-44 e2e seeded the old `machine.lic` path the debug build no longer reads.
- **`PREFLIGHT_ONLY=1 bash scripts/e2e-spike.sh`** — runs clean (orphan/port preflight OK, exits at the dry-run gate). Confirms the retargeted `security` calls are syntactically sound.
- Full real-WKWebView e2e NOT re-run: the D-44 `license.e2e.ts` spec lives in the known-flaky license cluster (dev-toggle/state-pollution, deferred-items.md) that fails before its assertions regardless; the Task-3 fix is logically verified (seed now targets the file the debug build reads) and its full exercise is gated behind that separate tracked flakiness. Not worth a full spike run (which also reaps the user's `tauri dev`).

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in order; no Rule 1-4 deviations.

## Self-Check: PASSED

- FOUND: src-tauri/src/license/keychain.rs (SERVICE cfg-split)
- FOUND: src-tauri/src/license/store.rs (LIC_FILE/LIC_TMP cfg-split)
- FOUND: scripts/e2e-spike.sh (dev-service retarget)
- FOUND commit: d644c60c (Task 1)
- FOUND commit: 50efac4f (Task 2)
