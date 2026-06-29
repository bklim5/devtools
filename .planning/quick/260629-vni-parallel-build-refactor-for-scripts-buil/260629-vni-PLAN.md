---
quick_id: 260629-vni
type: execute
wave: 1
depends_on: []
autonomous: false   # Task 3 is a checkpoint:human-verify (real signed builds + live .app launch)
requirements: [QUICK-260629-vni]
files_modified:
  - scripts/build.sh
  - scripts/build-appstore-bundle.sh
  - scripts/build-appstore-pkg.sh
  - scripts/build-and-publish.mjs
  - src/lib/release/publishPlan.ts

must_haves:
  truths:
    - "`scripts/build.sh --all` emits direct .dmg/.app + appstore .app + appstore-pkg .pkg in ONE run, each in its own target tree, so they coexist (no overwrite)."
    - "`--parallel` is accepted as an alias of `--all` and runs sequentially (honestly documented as not concurrent)."
    - "Each build.sh invocation (single OR --all) exports an ABSOLUTE per-channel CARGO_TARGET_DIR so artifacts never collide regardless of entry point."
    - "Invoking any sub-script STANDALONE (no CARGO_TARGET_DIR in env) builds to the exact same default path as today — zero behavior change."
    - "decoder.ts + its 19 tests are byte-for-byte untouched."
  artifacts:
    - path: "scripts/build.sh"
      provides: "--all/--parallel orchestration + per-channel absolute CARGO_TARGET_DIR + final artifact-path summary"
    - path: "scripts/build-appstore-bundle.sh"
      provides: "APP_OUT derived from ${CARGO_TARGET_DIR:-src-tauri/target}"
    - path: "scripts/build-appstore-pkg.sh"
      provides: "APP_OUT + PKG_OUT derived from ${CARGO_TARGET_DIR:-src-tauri/target}"
    - path: "scripts/build-and-publish.mjs"
      provides: "bundle dirs + pure-core base path honor process.env.CARGO_TARGET_DIR"
    - path: "src/lib/release/publishPlan.ts"
      provides: "universalMachoPath + buildPublishPlanView accept an optional base-dir param (defaults to today's constant)"
  key_links:
    - from: "scripts/build.sh"
      to: "CARGO_TARGET_DIR=$ROOT/src-tauri/target/<channel>"
      via: "export before invoking each channel"
    - from: "build-and-publish.mjs"
      to: "publishPlan.ts universalMachoPath/buildPublishPlanView"
      via: "passes the CARGO_TARGET_DIR-aware macos base dir as an argument"
---

<objective>
Refactor the build harness so ONE command (`scripts/build.sh --all`) produces all three channel artifacts back-to-back, each in an independent per-channel `CARGO_TARGET_DIR`, so the dev-signed appstore `.app`, the distribution-signed appstore-pkg `.app`/`.pkg`, and the direct `.dmg`/`.app` coexist instead of overwriting each other at the shared
`src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app` path.

Purpose: today all three channels bundle to the SAME path, so the distribution-signed appstore-pkg `.app` masquerades as / overwrites the dev-signed appstore `.app` and won't launch (AMFI -413). Per-channel target dirs give each artifact its own tree.

Output: a sequential `--all` (with `--parallel` as a sequential alias) orchestrator + three backward-compatible sub-scripts that derive their bundle root from `${CARGO_TARGET_DIR:-<today's default>}`.

NON-NEGOTIABLE locked decisions (do NOT revisit): SEQUENTIAL not concurrent; NO per-channel `dist/` isolation (sequential = no clobber); per-channel CARGO_TARGET_DIR is the coexistence mechanism; it MUST be absolute (Tauri runs cargo with CWD=src-tauri/); standalone sub-script invocation must behave EXACTLY as today; NO sccache (~3x compiled-artifact disk accepted).
</objective>

<context>
@.planning/STATE.md
@./CLAUDE.md

<interfaces>
<!-- The CARGO_TARGET_DIR contract every file must honor. Default = today's literal. -->

Coexistence locations (nested under src-tauri/target so the existing
`src-tauri/.gitignore:/target/` already ignores them — VERIFIED via git check-ignore):
  direct        -> $ROOT/src-tauri/target/direct
  appstore      -> $ROOT/src-tauri/target/appstore
  appstore-pkg  -> $ROOT/src-tauri/target/appstore-pkg

Contract: bundle root = "$CARGO_TARGET_DIR" when set (absolute), else "src-tauri/target".

scripts/build-appstore-bundle.sh:49 (today):
  APP_OUT="src-tauri/target/${TARGET}/release/bundle/macos/TinkerDev.app"

scripts/build-appstore-pkg.sh:68-69 (today):
  APP_OUT="src-tauri/target/${TARGET}/release/bundle/macos/TinkerDev.app"
  PKG_OUT="src-tauri/target/${TARGET}/release/bundle/macos/TinkerDev.pkg"

scripts/build-and-publish.mjs:77-80 (today):
  const UNIVERSAL_MACOS_DIR = "src-tauri/target/universal-apple-darwin/release/bundle/macos";
  const UNIVERSAL_DMG_DIR   = "src-tauri/target/universal-apple-darwin/release/bundle/dmg";

src/lib/release/publishPlan.ts:296 (PURE CORE — must stay env-free):
  const UNIVERSAL_BUNDLE_MACOS_DIR = "src-tauri/target/universal-apple-darwin/release/bundle/macos";
  - universalMachoPath(productName, mainBinaryName)  -> `${DIR}/${productName}.app/Contents/MacOS/${mainBinaryName}`  (used by mjs:364 for lipo)
  - buildPublishPlanView(...) -> { universalBundleDir: DIR, sigGlob: `${DIR}/${productName}.app.tar.gz.sig`, ... }  (sigGlob used by mjs:376)

scripts/verify-appstore-bundle.sh — NO CHANGE: the sub-scripts already pass it an explicit
"$APP_OUT" (bundle.sh:214, pkg.sh:372), so it inherits the relocated path automatically. Its
hardcoded default (line 726) is only hit when run standalone with no arg — leave it as-is to
preserve standalone behavior.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make the three channel sub-scripts + the pure core honor CARGO_TARGET_DIR (backward-compatible)</name>
  <files>scripts/build-appstore-bundle.sh, scripts/build-appstore-pkg.sh, scripts/build-and-publish.mjs, src/lib/release/publishPlan.ts</files>
  <action>
Make every channel consumer derive its bundle root from `${CARGO_TARGET_DIR:-src-tauri/target}`. The INVARIANT: with CARGO_TARGET_DIR UNSET (standalone invocation), the resolved path string must be byte-identical to today's literal, so existing gates/tests/standalone usage are unchanged. When CARGO_TARGET_DIR is set, it is ABSOLUTE and IS the bundle root directly (do NOT append `src-tauri/target`).

1. `scripts/build-appstore-bundle.sh` (line 49): introduce `BUNDLE_ROOT="${CARGO_TARGET_DIR:-src-tauri/target}"` near the other path vars and rewrite `APP_OUT="${BUNDLE_ROOT}/${TARGET}/release/bundle/macos/TinkerDev.app"`. Nothing else changes — the `cd "$ROOT_DIR"` + the explicit `verify-appstore-bundle.sh "$APP_OUT"` pass-through (line 214) keep working. (CARGO_TARGET_DIR being absolute is unaffected by the cd; the `src-tauri/target` default resolves relative to ROOT_DIR exactly as today.)

2. `scripts/build-appstore-pkg.sh` (lines 68-69): same `BUNDLE_ROOT="${CARGO_TARGET_DIR:-src-tauri/target}"`, then `APP_OUT="${BUNDLE_ROOT}/${TARGET}/release/bundle/macos/TinkerDev.app"` and `PKG_OUT="${BUNDLE_ROOT}/${TARGET}/release/bundle/macos/TinkerDev.pkg"`.

3. `src/lib/release/publishPlan.ts` — keep the pure core ENV-FREE (it deliberately refuses fs/env). Add an OPTIONAL trailing parameter `baseMacosDir: string = UNIVERSAL_BUNDLE_MACOS_DIR` to BOTH `universalMachoPath(...)` and `buildPublishPlanView(...)`, and use that param instead of the bare constant inside their bodies (line 311 macho path; lines 343-344 `universalBundleDir` + `sigGlob`). The default equals today's constant so every existing `publishPlan.test.ts` call (no extra arg) stays green and standalone `release:publish`/`release:build-only` (no CARGO_TARGET_DIR) is unchanged.

4. `scripts/build-and-publish.mjs` (the I/O layer that IS allowed to read env): compute the base once near lines 77-80 — `const TARGET_DIR = process.env.CARGO_TARGET_DIR || "src-tauri/target";` then `const UNIVERSAL_MACOS_DIR = \`${TARGET_DIR}/universal-apple-darwin/release/bundle/macos\`;` and `const UNIVERSAL_DMG_DIR = \`${TARGET_DIR}/universal-apple-darwin/release/bundle/dmg\`;`. Then PASS `UNIVERSAL_MACOS_DIR` into the pure-core calls so the macho/sig paths line up with where the build wrote: `universalMachoPath(readProductName(), readMainBinaryName(), UNIVERSAL_MACOS_DIR)` (line 364) and `buildPublishPlanView(..., UNIVERSAL_MACOS_DIR)` (wherever it's built — confirm the call site so `view.sigGlob` at line 376 + `view.universalBundleDir` track CARGO_TARGET_DIR). The stale-`.sig` clear (330-331) and the tarball/dmg globs (382/384) already reference the local `UNIVERSAL_MACOS_DIR`/`UNIVERSAL_DMG_DIR`, so they follow automatically.

Do NOT touch decoder.ts or its 19 tests. Do NOT touch verify-appstore-bundle.sh. Do NOT add per-channel dist dirs / vite outDir overrides (locked decision 1).
  </action>
  <verify>
    <automated>bash -n scripts/build-appstore-bundle.sh && bash -n scripts/build-appstore-pkg.sh && node --check scripts/build-and-publish.mjs && pnpm exec tsc --noEmit && pnpm test && git diff --quiet HEAD -- src/lib/protobuf/decoder.ts && echo OK-NO-DECODER-CHANGE</automated>
  </verify>
  <done>
    - `tsc --noEmit` clean; full `vitest` suite green (publishPlan default-param keeps the existing hardcoded-path assertions passing).
    - With CARGO_TARGET_DIR unset, the resolved APP_OUT/PKG_OUT/UNIVERSAL_* strings are byte-identical to today's literals (confirm by reading the diff — only the var indirection changed, not the default value).
    - With CARGO_TARGET_DIR=/abs/x set, APP_OUT resolves to `/abs/x/universal-apple-darwin/release/bundle/macos/TinkerDev.app` (no `src-tauri/target` appended).
    - decoder.ts + 19 tests byte-untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Refactor build.sh — add --all/--parallel + per-channel absolute CARGO_TARGET_DIR for every invocation + final summary</name>
  <files>scripts/build.sh</files>
  <action>
Extend `scripts/build.sh` (keep `set -euo pipefail`, the `.env` sourcing block, and `ROOT`/`cd "$ROOT"`). Update the usage/header comment to document `--all` and `--parallel` (state plainly: `--parallel` is a SEQUENTIAL alias of `--all`, NOT concurrent — builds run back-to-back).

1. Add a helper that sets the per-channel ABSOLUTE CARGO_TARGET_DIR then runs the channel:
   ```
   run_channel() {
     local ch="$1"
     export CARGO_TARGET_DIR="$ROOT/src-tauri/target/$ch"
     echo "[build] CARGO_TARGET_DIR=$CARGO_TARGET_DIR"
     case "$ch" in
       direct)        pnpm release:build-only ;;
       appstore)      pnpm tauri:build:appstore ;;
       appstore-pkg)  pnpm tauri:build:appstore:pkg ;;
       *) echo "[build] unknown channel: $ch" >&2; return 2 ;;
     esac
   }
   ```
   (Drop the old `exec pnpm …` — single-target now goes through run_channel so it ALSO gets a per-channel dir; locked decision 4: build.sh sets the per-channel dir for EVERY invocation so collisions are impossible regardless of entry point.)

2. Dispatch on `$1`:
   - `--all` | `--parallel`: print a one-line honesty note for `--parallel` ("sequential alias — builds run back-to-back, not concurrently"), then run `direct`, `appstore`, `appstore-pkg` IN ORDER (locked decision 5). FAIL-FAST but still print a final summary: track each channel's outcome and on the FIRST failure print the summary (which succeeded, which failed) and `exit 1`. Because `set -e` is on, guard each run in an `if run_channel "$ch"; then ... else <summary>; exit 1; fi` (a command in an `if` condition does not trip `set -e`). On full success, print the final artifact-path summary and exit 0.
   - `direct` | `appstore` | `appstore-pkg`: `run_channel "$TARGET"` (single-target still works).
   - unknown / missing: keep the `exit 2` + usage error.

3. Final summary must print the three resolved artifact paths (absolute), e.g.:
   - direct        `$ROOT/src-tauri/target/direct/universal-apple-darwin/release/bundle/dmg/*.dmg` (+ `.../macos/TinkerDev.app`)
   - appstore      `$ROOT/src-tauri/target/appstore/universal-apple-darwin/release/bundle/macos/TinkerDev.app`
   - appstore-pkg  `$ROOT/src-tauri/target/appstore-pkg/universal-apple-darwin/release/bundle/macos/TinkerDev.pkg`
   For `--all`, also annotate each line with ✓ built / ✗ failed / – skipped.

Note for the executor: `direct` needs the Apple signing/notary vars in `.env` (build.sh sources it); `appstore` + `appstore-pkg` need no secrets (keychain certs + embedded profile). If `.env` lacks the direct secrets, `release:build-only`'s by-design preflight will abort the direct leg — that is expected, not a script bug.
  </action>
  <verify>
    <automated>bash -n scripts/build.sh && CARGO_TARGET_DIR= scripts/build.sh 2>&1 | grep -qiE 'usage' ; scripts/build.sh bogus 2>&1; test $? -eq 2 && echo OK-UNKNOWN-EXIT2 && grep -qE '\-\-all|\-\-parallel' scripts/build.sh && grep -qE 'CARGO_TARGET_DIR="\$ROOT/src-tauri/target/' scripts/build.sh && echo OK-PERCHANNEL</automated>
  </verify>
  <done>
    - `bash -n scripts/build.sh` clean.
    - `scripts/build.sh --all` and `scripts/build.sh --parallel` both reach the sequential 3-channel path; `--parallel` prints the "sequential alias" note.
    - Each channel exports `CARGO_TARGET_DIR="$ROOT/src-tauri/target/<channel>"` (absolute).
    - `scripts/build.sh <direct|appstore|appstore-pkg>` single-target still works; unknown target exits 2.
    - Final summary prints the three absolute artifact paths; `--all` annotates per-channel success/failure.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
The full refactor: `scripts/build.sh --all` (sequential, per-channel absolute CARGO_TARGET_DIR) + the three sub-scripts + the pure core all honoring CARGO_TARGET_DIR.

Before this checkpoint the executor MUST run the BINDING harness over the working tree and address every finding:
  1. `/simplify` over the diff (quality cleanups only).
  2. `/code-review xhigh` over the diff (recall-mode bug hunt) — address confirmed findings.
  3. `/codex:adversarial-review --wait --scope working-tree` — address findings.
  4. Unit gate: `pnpm exec tsc --noEmit` clean + `pnpm test` green; `git diff --quiet HEAD -- src/lib/protobuf/decoder.ts`.
  5. shellcheck: `command -v shellcheck || brew install shellcheck`, then `shellcheck scripts/build.sh scripts/build-appstore-bundle.sh scripts/build-appstore-pkg.sh` — address findings (or justify ignores inline).

Then the REAL-BUILD coexistence + signature proof (slow — universal builds take minutes each ×3; expected, NOT a reason to skip):
  - Agent runs the legs it can WITHOUT secrets: `scripts/build.sh appstore` and `scripts/build.sh appstore-pkg` (each sets its own target dir). If `.env` carries the direct signing/notary vars, agent also runs `scripts/build.sh direct` (or the full `scripts/build.sh --all`); otherwise the direct leg is run by the human with `.env` present. Either entry point yields per-channel target dirs, so the three coexist regardless.
  - Agent PROVES, with the artifacts on disk:
      * COEXISTENCE: the three trees exist side-by-side and do not overwrite —
        `src-tauri/target/appstore/.../macos/TinkerDev.app`,
        `src-tauri/target/appstore-pkg/.../macos/TinkerDev.pkg` (+ its inner `.app`),
        `src-tauri/target/direct/.../dmg/*.dmg` (+ `.../macos/TinkerDev.app`) — all present simultaneously.
      * appstore `.app` is DEV-signed: `codesign -dvvv .../appstore/.../TinkerDev.app 2>&1 | grep "Authority=Apple Development"`.
      * appstore-pkg is DISTRIBUTION-signed: the inner `.app` `codesign` Authority=Apple Distribution AND `pkgutil --check-signature .../appstore-pkg/.../TinkerDev.pkg` shows a `3rd Party Mac Developer Installer / Mac Installer Distribution` chain.
      * direct `.dmg` built (and, if notary env present, `xcrun stapler validate` + `spctl` accept).
      * `git diff --quiet HEAD -- src/lib/protobuf/decoder.ts` (decoder untouched).
  </what-built>
  <how-to-verify>
1. Confirm the three artifact trees coexist (the bug being fixed): list all three target subdirs and confirm the dev-signed appstore `.app` and the distribution-signed appstore-pkg `.app`/`.pkg` are in SEPARATE trees (neither overwrote the other).
2. Launch the DEV-signed appstore `.app` (`src-tauri/target/appstore/.../TinkerDev.app`) — it must open without AMFI -413 (the distribution-signed one will NOT launch locally; that's expected — do not launch it).
3. Confirm the build.sh `--all` final summary printed the three correct absolute artifact paths.
4. Spot-check that running a sub-script STANDALONE (e.g. `pnpm tauri:build:appstore`, no build.sh) still targets the default `src-tauri/target/universal-apple-darwin/...` path (invariant preserved).
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues (e.g. a channel overwrote another, a signature is wrong, or standalone path regressed).</resume-signal>
</task>

</tasks>

<verification>
- `bash -n` clean on all three shell scripts; `node --check` clean on the mjs; `shellcheck` clean (or justified) on the shell scripts.
- `pnpm exec tsc --noEmit` clean + full `pnpm test` green.
- With CARGO_TARGET_DIR unset, every resolved bundle path string equals today's literal (standalone behavior unchanged — the binding invariant).
- `scripts/build.sh --all` produces three coexisting, correctly-signed artifacts in separate target trees.
- decoder.ts + its 19 tests byte-for-byte untouched.
- Binding harness (`/simplify` → `/code-review xhigh` → `/codex:adversarial-review`) run over the working tree with findings addressed.
</verification>

<success_criteria>
- One command (`scripts/build.sh --all`, `--parallel` as a sequential alias) emits direct `.dmg`/`.app` + appstore `.app` + appstore-pkg `.pkg`, each in its own `src-tauri/target/<channel>` tree, coexisting without overwrite.
- Per-channel CARGO_TARGET_DIR is absolute and set for EVERY build.sh invocation (single + all).
- Standalone sub-script invocation (no CARGO_TARGET_DIR) is byte-for-byte unchanged from today.
- No sccache, no per-channel dist isolation, no decoder changes.
- Human approved the real-build coexistence + signature walkthrough.
</success_criteria>

<output>
After completion, create `.planning/quick/260629-vni-parallel-build-refactor-for-scripts-buil/260629-vni-SUMMARY.md`.
</output>
