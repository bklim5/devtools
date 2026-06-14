---
phase: quick-260614-nox
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/license/keychain.rs
  - src-tauri/src/license/store.rs
  - scripts/e2e-spike.sh
autonomous: true
requirements:
  - QUICK-260614-nox
must_haves:
  truths:
    - "A debug build (tauri dev / cargo test) stores its license under the .dev Keychain service and machine.dev.lic; a release build keeps com.tinkerdev.app.license and machine.lic byte-identical to today."
    - "Switching between dev and release builds never makes one build's activated license appear as 'License needs attention' to the other — the two stores are fully isolated."
    - "scripts/e2e-spike.sh preflight can never delete the production license Keychain item; it only ever targets the dev service."
  artifacts:
    - path: "src-tauri/src/license/keychain.rs"
      provides: "cfg-split SERVICE const (debug=.dev.license, release=.license)"
      contains: "cfg(debug_assertions)"
    - path: "src-tauri/src/license/store.rs"
      provides: "cfg-split LIC_FILE / LIC_TMP consts (debug=machine.dev.lic, release=machine.lic)"
      contains: "cfg(debug_assertions)"
    - path: "scripts/e2e-spike.sh"
      provides: "preflight retargeted at com.tinkerdev.app.dev.license"
      contains: "com.tinkerdev.app.dev.license"
  key_links:
    - from: "src-tauri/src/license/keychain.rs SERVICE"
      to: "macOS Keychain item (debug arm = com.tinkerdev.app.dev.license)"
      via: "Entry::new(SERVICE, USER)"
      pattern: "Entry::new\\(SERVICE"
    - from: "scripts/e2e-spike.sh preflight"
      to: "the DEV Keychain service only"
      via: "security delete-generic-password -s com.tinkerdev.app.dev.license"
      pattern: "delete-generic-password -s com.tinkerdev.app.dev.license"
---

<objective>
Isolate dev-build vs release-build license storage so switching builds (or running
`scripts/e2e-spike.sh`) never corrupts the other build's license state.

Root cause: dev (debug) and prod (release) share bundle id `com.tinkerdev.app` →
same `app_data_dir` → same `machine.lic`, AND the same hardcoded Keychain service
`com.tinkerdev.app.license`. But D-52 already cfg-splits the embedded Ed25519 key
(dev=local CE, release=prod CE), so a cert/key activated under one build can never
verify under the other → "License needs attention" crossover on every build switch.
Worse: e2e-spike's preflight DELETES that shared Keychain item, which can orphan a
real prod license during testing.

Fix: mirror the EXISTING D-52 `#[cfg(debug_assertions)]` / `#[cfg(not(debug_assertions))]`
split (config.rs precedent) onto the two storage consts, and retarget the e2e-spike
preflight at the dev service. The RELEASE arm values stay byte-identical to today
(`com.tinkerdev.app.license`, `machine.lic`) → zero impact on shipped installs.

Purpose: dev/e2e activity can never touch the production license item or file again.
Output: cfg-split SERVICE + LIC_FILE/LIC_TMP consts; e2e-spike preflight on the dev service.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

<interfaces>
<!-- The EXISTING D-52 precedent to mirror EXACTLY (src-tauri/src/license/config.rs). -->
<!-- Same idiom: a single const becomes two #[cfg(...)]-guarded consts, debug arm first. -->

```rust
// config.rs (DO NOT EDIT — pattern reference only):
#[cfg(debug_assertions)]
pub const KEYGEN_HOST: &str = "localhost";
#[cfg(not(debug_assertions))]
pub const KEYGEN_HOST: &str = "license.tinkerdev.io";
```

```rust
// keychain.rs TODAY (the const to split; bundle id = com.tinkerdev.app):
const SERVICE: &str = "com.tinkerdev.app.license";  // used at Entry::new(SERVICE, USER)
const USER: &str = "license-key";
```

```rust
// store.rs TODAY (the consts to split; same app_data_dir, distinct filenames):
const LIC_FILE: &str = "machine.lic";
const LIC_TMP: &str = "machine.lic.tmp";
// store tests reference LIC_FILE/LIC_TMP SYMBOLICALLY (no literal "machine.lic" asserted)
// → they stay green under either arm automatically; NO test edits needed.
```

<!-- Grep verified (260614): the ONLY readers of these literals are -->
<!--   keychain.rs:19/39, store.rs:9-10, e2e-spike.sh:106-109.        -->
<!-- keychain.rs has NO #[cfg(test)] module; mod.rs uses the trait (never the literal). -->
<!-- check-dev-strip.sh asserts ONLY the host literal (license.tinkerdev.io), -->
<!--   NOT the service/filename → no release/dist tripwire blocks this split. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: cfg-split the Keychain SERVICE and machine.lic filename consts</name>
  <files>src-tauri/src/license/keychain.rs, src-tauri/src/license/store.rs</files>
  <action>
Mirror the D-52 `#[cfg(debug_assertions)]` / `#[cfg(not(debug_assertions))]` idiom from
config.rs (debug arm first) onto BOTH storage consts. Release arms stay byte-identical
to today — only the debug arm gains the `.dev` variant.

keychain.rs — replace the single `SERVICE` const (~line 19) with:
```
#[cfg(debug_assertions)]
const SERVICE: &str = "com.tinkerdev.app.dev.license";
#[cfg(not(debug_assertions))]
const SERVICE: &str = "com.tinkerdev.app.license";
```
Update the doc comment above it to explain the split mirrors D-52: a DEBUG build
(tauri dev / cargo test) embeds the local-CE Ed25519 key, so its license can only
verify against a `.dev.license` item — isolating it from the shipped release item
(release arm unchanged → non-breaking for installs). Leave `USER`, the
`KeychainError`/`KeychainAccess` trait, and `MacKeychain` untouched — `Entry::new(SERVICE, USER)`
already reads the const, so the split propagates with no call-site change.

store.rs — replace the two consts (~lines 9-10) with:
```
#[cfg(debug_assertions)]
const LIC_FILE: &str = "machine.dev.lic";
#[cfg(not(debug_assertions))]
const LIC_FILE: &str = "machine.lic";
#[cfg(debug_assertions)]
const LIC_TMP: &str = "machine.dev.lic.tmp";
#[cfg(not(debug_assertions))]
const LIC_TMP: &str = "machine.lic.tmp";
```
Add a doc comment noting the split mirrors keychain.rs/D-52: a DEBUG build writes
`machine.dev.lic` so dev/e2e activity never overwrites the release `machine.lic` in the
shared `app_data_dir`. Keep `.tmp` adjacent to its base name in the SAME directory so
`write_atomic`'s same-volume rename stays atomic. The store tests reference
`LIC_FILE`/`LIC_TMP` symbolically (not the literal), so they need NO change and stay
green under the active (debug) profile.
  </action>
  <verify>
    <automated>cd src-tauri && cargo test --lib license:: 2>&1 | tail -20</automated>
  </verify>
  <done>cargo test (license suite, default debug profile) green; debug build resolves SERVICE=com.tinkerdev.app.dev.license and LIC_FILE=machine.dev.lic; release arms are byte-identical to the pre-change values; no call-site or test edits needed.</done>
</task>

<task type="auto">
  <name>Task 2: Retarget the e2e-spike preflight at the DEV Keychain service</name>
  <files>scripts/e2e-spike.sh</files>
  <action>
The preflight runs `pnpm tauri:dev:e2e` (a DEBUG build), so after Task 1 the dev license
lives under `com.tinkerdev.app.dev.license`. Retarget the section-2.5 block (~lines
106-109) so the preflight can NEVER again delete the production license item.

Change BOTH `security` invocations from `-s com.tinkerdev.app.license` to
`-s com.tinkerdev.app.dev.license` (the `find-generic-password` guard AND the
`delete-generic-password`). Update the adjacent comment (~lines 100-105) to state the
new isolation guarantee: the dev build now uses the `.dev.license` service (post-260614
split), so this preflight is structurally incapable of touching a buyer's release
license item.

Do NOT change preflight ordering, the orphan/port logic, or PREFLIGHT_ONLY handling.
  </action>
  <verify>
    <automated>grep -q "com.tinkerdev.app.dev.license" scripts/e2e-spike.sh && ! grep -q "password -s com.tinkerdev.app.license" scripts/e2e-spike.sh && bash -n scripts/e2e-spike.sh && echo PASS</automated>
  </verify>
  <done>Both `security` calls target `com.tinkerdev.app.dev.license`; no `-s com.tinkerdev.app.license` reference remains in the script; comment updated; `bash -n` clean. (Orchestrator confirms `PREFLIGHT_ONLY=1 bash scripts/e2e-spike.sh` runs clean.)</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build profile → storage namespace | A debug binary and a release binary share one `app_data_dir` + one Keychain; the cfg-split makes the storage namespace a function of the build profile. |
| e2e-spike preflight → macOS Keychain | The gate runs `security delete-generic-password` against a real Keychain item. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-nox-01 | Tampering | e2e-spike preflight deleting a real prod license item | mitigate | Retarget delete at `com.tinkerdev.app.dev.license` (Task 2); the prod service literal is no longer present in the script (verify asserts its absence). |
| T-nox-02 | Tampering | dev cert overwriting `machine.lic` in the shared app_data_dir | mitigate | Debug build writes `machine.dev.lic` via the cfg-split (Task 1); distinct filenames in the same dir. |
| T-nox-03 | Denial of Service | release-binary regression from changing the release arm | accept | Release arms are byte-identical to today (`com.tinkerdev.app.license`, `machine.lic`); only the debug arm changes — no shipped-install impact. |
</threat_model>

<verification>
- `cd src-tauri && cargo test --lib license::` green (default debug profile).
- `grep` proves the dev service literal is present and the prod-service `delete` literal is gone from e2e-spike.sh; `bash -n` clean.
- Orchestrator DoD (after the executor): /simplify → /codex:review → vitest + `tsc --noEmit` + lint green → `PREFLIGHT_ONLY=1 bash scripts/e2e-spike.sh` runs clean.
- Release arms unchanged: `com.tinkerdev.app.license` and `machine.lic` still appear verbatim as the `#[cfg(not(debug_assertions))]` arm in keychain.rs/store.rs.
- decoder.ts and its 19 tests untouched (out of scope).
</verification>

<success_criteria>
- Debug builds isolate license state under `com.tinkerdev.app.dev.license` + `machine.dev.lic`.
- Release builds keep `com.tinkerdev.app.license` + `machine.lic` byte-identical to today.
- e2e-spike preflight can only ever delete the DEV Keychain item.
- License suite (`cargo test`) green; no JS-gate regressions; decoder untouched.
</success_criteria>

<output>
After completion, create `.planning/quick/260614-nox-isolate-dev-vs-prod-license-storage-keyc/260614-nox-SUMMARY.md`
</output>
