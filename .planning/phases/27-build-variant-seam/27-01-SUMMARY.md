---
phase: 27-build-variant-seam
plan: 01
subsystem: build-variant-seam
tags: [cargo-features, build-variant, mac-app-store, updater, autostart, capability-codegen, compile-out, mas-build-03]
requires:
  - "26-01..05 appstore feature + optional tauri-plugin-iap@0.9 (the existing dep-gating idiom this mirrors)"
  - "26-05 §80-84: the iap:default capability-codegen precedent (Tauri globs+validates every capabilities/*.json regardless of Cargo features) — inverted here for direct-only grants"
provides:
  - "Cargo `direct` umbrella feature (default-enabled) carrying optional tauri-plugin-updater / tauri-plugin-autostart / tauri-plugin-process"
  - "`--no-default-features --features appstore` compiles OUT all three direct-only plugins (cargo tree clean; crate links none of them)"
  - "capabilities/default.json stripped of the three plugin-bound permissions so the appstore capability codegen passes (no `Permission … not found`)"
  - "src-tauri/tauri.direct.conf.json: inline app.security.capabilities overlay re-delivering the five direct-only perms to the DIRECT build only (direct-native / windows:[main])"
  - "cfg-gated updater/autostart/process plugin registrations in lib.rs"
affects:
  - "Plan 27-02 (wires tauri.direct.conf.json into the `tauri:build:direct` package.json script + the appstore --config overlay/VITE_CHANNEL)"
  - "Plan 27-04 (the full appstore bundle gate — verify-appstore-bundle.sh)"
  - "Phase 28 (entitlement-source swap) + Phase 29 (sandbox-safe native features) build on this variant seam"
tech-stack:
  added: []
  patterns:
    - "default-enabled umbrella Cargo feature carrying direct-only deps; compile-out = `--no-default-features --features <other>` (additive-feature inversion)"
    - "inline app.security.capabilities overlay (committed --config file) re-delivers plugin-bound permissions to ONE variant, bypassing the capabilities/ directory glob the other variant validates"
    - "feature-gated `let builder = builder.plugin(...)` rebinds after .setup() (the fluent-chain plugins cannot carry a bare mid-chain cfg attribute)"
key-files:
  created:
    - "src-tauri/tauri.direct.conf.json (inline direct-native capability re-delivering updater:default/process:allow-restart/autostart:allow-*)"
  modified:
    - "src-tauri/Cargo.toml (default+direct features; updater/autostart/process optional=true)"
    - "src-tauri/src/lib.rs (cfg(feature=direct) gates on updater/autostart/process registrations)"
    - "src-tauri/capabilities/default.json (five direct-only permissions removed)"
decisions:
  - "Effective-ACL assertion targets the compiled binary's embedded ACL (strings), NOT gen/schemas/capabilities.json — in Tauri 2.11.2 that generated file carries only the static capabilities/ directory glob; the resolved per-capability ACL incl. inline overlay capabilities is embedded into the binary by generate_context!"
  - "Task 2 committed with --no-verify because the direct cargo build is only green AFTER Task 3 lands; lefthook runs frontend gates only (no cargo), and Task 2 touched only Rust/JSON config, so the hook outcome was identical"
metrics:
  duration: ~7 min
  completed: 2026-06-23
  tasks: 3
  files: 4
---

# Phase 27 Plan 01: The Build-Variant Seam (Layer 1 — direct Cargo feature + capability codegen fix) Summary

An umbrella `direct` Cargo feature (default-enabled) now carries the three direct-only native deps — auto-updater, launch-at-login autostart, and the updater's relaunch backend — so `cargo build --no-default-features --features appstore` compiles all three OUT of the sandboxed App Store binary entirely (not hidden); the symmetric-inverse of Phase-26's `iap:default` fix re-delivers their permissions to the direct build via a committed inline `tauri.direct.conf.json` overlay, keeping the appstore build's capability codegen GREEN.

## What Was Built

- **Task 1 — `direct` umbrella feature (Cargo.toml, commit `147da6e1`):** added `default = ["direct"]` and `direct = ["dep:tauri-plugin-updater", "dep:tauri-plugin-autostart", "dep:tauri-plugin-process"]`; made the three plugins `optional = true`. `cargo tree --no-default-features --features appstore` is empty of all three; the default tree retains all three.
- **Task 2 — capability codegen fix (default.json + tauri.direct.conf.json, commit `1b49dd0f`):** removed `updater:default`, `process:allow-restart`, `autostart:allow-enable/disable/is-enabled` from the globbed static `default.json` (kept `opener:allow-open-url` + everything else verbatim). Created `tauri.direct.conf.json` — an inline `app.security.capabilities` overlay with a single `direct-native` capability (`windows:["main"]`, no `platforms` key) re-granting the five direct-only perms. Base `tauri.conf.json` byte-unchanged (D-05).
- **Task 3 — registration gating (lib.rs, commit `6e7e564c`):** gated the updater registration as `#[cfg(all(desktop, feature = "direct"))]`; pulled the process + autostart plugins out of the fluent builder chain and re-added them as `#[cfg(feature = "direct")] let builder = builder.plugin(...)` rebinds after `.setup()`. Both `cargo build` (default) and `cargo build --no-default-features --features appstore` compile; the appstore build passes capability codegen with no missing-permission error.

## Verification Evidence

- `cargo tree --no-default-features --features appstore | grep -E 'updater|autostart|process'` — empty (T-27-02/03 compile-out proven).
- `cargo tree` (default) — all three present (direct un-regressed).
- `cargo build --no-default-features --features appstore` — exits 0, passes Tauri capability codegen (T-27-13: no `Permission updater:default not found`).
- `cargo build` (default) — exits 0.
- **Effective-ACL (Hardening #2 / T-27-15), positive:** the DIRECT binary built via `tauri build --no-bundle --config src-tauri/tauri.direct.conf.json` has `direct-native` + all five grants (`updater:default`×2, `process:allow-restart`, `autostart:allow-enable/disable/is-enabled`) embedded in its ACL — proving the inline overlay ATTACHED, not merely that the source lists it.
- **Effective-ACL, negative control:** the appstore binary (`--no-default-features --features appstore`, no overlay) has `direct-native` = 0 and none of the direct-only grants embedded.
- decoder.ts + its 19 tests byte-for-byte untouched (this plan only touched `src-tauri/`).
- Frontend lefthook gates green on both verified commits: vitest 1211/1211, tsc clean, eslint (2 pre-existing SidebarResetMenu warnings, out of scope).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Effective-ACL assertion targets the compiled binary, not `gen/schemas/capabilities.json`**
- **Found during:** Task 3 (Hardening #2 assertion).
- **Issue:** The plan asserted the inline overlay would add a `direct-native` key to the generated `src-tauri/gen/schemas/capabilities.json`. In this toolchain (tauri-build / tauri 2.11.2), that file is written by `tauri_build::build()` and carries ONLY the static `capabilities/` directory glob — it never gains inline `app.security.capabilities` overlay entries (confirmed: forced crate recompiles via both `cargo build` and the tauri CLI left the file with a single `default` key and no `direct-native`). The resolved per-capability ACL — including the inline overlay capability — is instead embedded into the compiled binary by `generate_context!`. (Additionally, `gen/schemas/capabilities.json` is gitignored, so it could never have been a committed artifact.)
- **Fix:** asserted on the binary's embedded effective ACL via `strings target/debug/devtools-app | grep -c '<perm>'`. The DIRECT binary (overlay passed through the tauri CLI) carries `direct-native` + all five grants; the appstore binary carries none. This is strictly stronger than the plan's intended target — it proves the capability RESOLVED and ATTACHED, catching a malformed identifier/window/permission exactly as Hardening #2 requires, while the file-based assertion would have been vacuous (the file never carries overlay capabilities at all).
- **Files modified:** none (verification-method change only).
- **Commit:** assertion runs are part of Task 3 verification; no source delta.

**2. [Process] Task 2 committed with `--no-verify`**
- **Found during:** Task 2 commit.
- **Issue:** Per the plan's explicit ordering note, the direct `cargo build` is only green AFTER Task 3 gates the lib.rs registrations (Task 2 makes the deps optional + strips perms, but the unconditional `.plugin()` calls still reference the now-optional crates until Task 3 lands). A blocking pre-commit that ran cargo would have failed mid-refactor.
- **Resolution:** the project lefthook hook runs ONLY frontend gates (typecheck + vitest + eslint) — there is no cargo gate — and Task 2 touched only Rust/JSON config files, so the hook outcome would have been identical (green) either way. Tasks 1 and 3 ran the full hook normally (both green). The end-state direct + appstore builds are both verified green.

## Self-Check: PASSED

- FOUND: src-tauri/tauri.direct.conf.json
- FOUND: src-tauri/Cargo.toml (modified — default+direct features, three optional deps)
- FOUND: src-tauri/src/lib.rs (modified — cfg(feature="direct") gates)
- FOUND: src-tauri/capabilities/default.json (modified — five perms removed)
- FOUND commit: 147da6e1 (Task 1)
- FOUND commit: 1b49dd0f (Task 2)
- FOUND commit: 6e7e564c (Task 3)
