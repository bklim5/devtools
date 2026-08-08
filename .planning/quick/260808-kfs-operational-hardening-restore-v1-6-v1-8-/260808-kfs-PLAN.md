---
phase: quick/260808-kfs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/milestones/v1.6-phases/**   # restored from 9fcbbd9d^ (66 files)
  - .planning/milestones/v1.7-phases/**   # restored from 9fcbbd9d^ (74 files)
  - .planning/milestones/v1.8-phases/**   # restored from 9fcbbd9d^ (65 files)
  - scripts/check-planning-archive.sh     # NEW — pre-commit archive-not-delete guard
  - lefthook.yml
  - CLAUDE.md
  - eslint.config.js
  - scripts/verify-appstore-bundle.sh     # COMMENT-ONLY (invariants index header)
  - docs/KEYS.md                          # NEW
  - docs/RELEASE-MACHINE.md               # NEW
  - docs/CHANNELS.md                      # NEW
  - docs/RELEASE.md                       # REWRITE
  - CHANGELOG.md
autonomous: true
requirements: [QUICK-OPS-HARDENING]

must_haves:
  truths:
    - "A future agent asking 'what is D-52 / T-20-01 / D-04?' finds the answer in the working tree (.planning/milestones/v1.6-phases/ .. v1.8-phases/), not only in git history"
    - "A commit that DELETES a .planning/phases/<dir> without a matching archive add under .planning/milestones/ FAILS pre-commit — the v1.9-close deletion cannot silently repeat"
    - "A static `import ... from \"@tauri-apps/*\"` outside src/lib/platform/** FAILS `pnpm lint` (and therefore the lefthook pre-commit gate); importing BrowserRouter from react-router-dom fails everywhere. Both rules PASS on the current tree unmodified"
    - "docs/KEYS.md inventories every trust anchor with its location, expiry, loss consequence, and rotation procedure — and contains ZERO secret values"
    - "docs/KEYS.md states plainly that regenerating the minisign keypair STRANDS every installed direct-channel app forever, and gives the only safe migration (a transitional release signed with the OLD key carrying the NEW pubkey)"
    - "docs/RELEASE.md describes the REAL pipeline (`pnpm release:bump` -> `pnpm release:publish` over scripts/bump-and-tag.mjs + scripts/build-and-publish.mjs), not the superseded hand-authored-latest.json flow; the old fleet-stranding regeneration advice at old lines 56-58 is gone"
    - "docs/RELEASE.md documents rollback (revert-by-republish), update-host migration (transitional-release constraint), and the two colliding tag schemes (release vX.Y.Z pushed vs milestone vX.Y local-only)"
    - "docs/CHANNELS.md is a single dimension x channel x enforcing-artifact matrix covering the capability-overlay silent-drop trap and the --no-default-features gotcha"
    - "docs/RELEASE-MACHINE.md is a rebuild-the-laptop checklist: every file, keychain identity, auth session, profile and toolchain the release pipeline needs"
    - "CHANGELOG.md's [1.0.1] / [1.0.2] sections carry real notes instead of '_Nothing yet._', and the next `release:bump` therefore cannot ship an empty-notes release again"
    - "scripts/verify-appstore-bundle.sh carries a one-line-per-invariant index with D/T identifiers, and its BEHAVIOR is byte-unchanged (comment-only diff)"
    - "Every factual claim in the four docs is verified against the live tree (path/flag/script-name/expiry), not asserted from the architecture review's snapshot"
  artifacts:
    - path: ".planning/milestones/v1.6-phases"
      provides: "Phases 18,19,20,21 planning artifacts (D-40..D-52, T-19/T-20 series)"
      contains: "20-purchase-pipeline"
    - path: ".planning/milestones/v1.7-phases"
      provides: "Phases 22,22.1,22.2,23,24,25 planning artifacts (Settings milestone)"
      contains: "25-updates-pane-milestone-ship"
    - path: ".planning/milestones/v1.8-phases"
      provides: "Phases 26..30 planning artifacts (MAS milestone; D-03/D-04/D-09, T-28/T-29 series)"
      contains: "30-pkg-build-asc-submission"
    - path: "scripts/check-planning-archive.sh"
      provides: "Pre-commit guard: phase-dir deletion requires a matching milestones/ archive add"
      contains: "ALLOW_PHASE_DELETE"
    - path: "eslint.config.js"
      provides: "Mechanical seam + HashRouter invariants"
      contains: "no-restricted-imports"
    - path: "docs/KEYS.md"
      provides: "Trust-anchor inventory, loss consequences, rotation procedures, expiry calendar"
      contains: "strand"
    - path: "docs/RELEASE-MACHINE.md"
      provides: "Rebuild-the-release-laptop inventory"
      contains: "embedded.provisionprofile"
    - path: "docs/CHANNELS.md"
      provides: "direct vs appstore matrix + enforcing artifact per dimension"
      contains: "--no-default-features"
    - path: "docs/RELEASE.md"
      provides: "The real two-command pipeline + rollback + host migration + tag schemes"
      contains: "release:publish"
    - path: "CHANGELOG.md"
      provides: "Backfilled 1.0.1 / 1.0.2 notes"
      contains: "1.0.1"
  key_links:
    - from: "lefthook.yml pre-commit"
      to: "scripts/check-planning-archive.sh"
      via: "an `archive-guard` command alongside typecheck/test/lint"
      pattern: "check-planning-archive"
    - from: "lefthook.yml pre-commit lint"
      to: "eslint.config.js no-restricted-imports"
      via: "`pnpm lint` already wired — the new rule inherits the existing gate"
      pattern: "pnpm lint"
    - from: "docs/KEYS.md"
      to: "infra/keygen/RUNBOOK.md recovery-secret fingerprint table"
      via: "explicit cross-link (the two .env sha256 + key-name table is the authoritative fingerprint record)"
      pattern: "RUNBOOK.md"
    - from: "docs/RELEASE.md"
      to: "docs/KEYS.md"
      via: "key-regeneration section replaced by a pointer (RELEASE.md must never restate rotation advice)"
      pattern: "KEYS.md"
    - from: "docs/RELEASE.md"
      to: "docs/CHANNELS.md"
      via: "channel-split pointer (RELEASE.md covers the direct channel only)"
      pattern: "CHANNELS.md"
    - from: "docs/CHANNELS.md"
      to: "scripts/verify-appstore-bundle.sh invariants index"
      via: "the matrix's 'enforced by' column cites the assert_* function names"
      pattern: "verify-appstore-bundle"
---

<objective>
Work the 2026-07-06 architecture review's prioritized fix list (all 7 remaining repo-side
items). The review found the project's risk is NOT in the code — it is in operations and
knowledge: single-copy trust anchors with no runbook, a stale release doc whose advice would
permanently strand the installed base, three milestones of decision ledger deleted from the
tree, and load-bearing architecture invariants enforced only by prose.

The owner has ALREADY completed the manual key backups (minisign key, Apple .p8, three signing
certs as .p12, one-off CE pg_dump — all in the password manager) and the offsite nightly R2
backup + automated restore validation landed in quick/260807-ohd. Those are DONE — do not
re-plan or re-do them.

Purpose: convert the three remaining risk classes into artifacts on disk — (a) restore the
deleted decision ledger and make the deletion mechanically impossible to repeat, (b) write the
four missing reference docs and fix the actively-dangerous one, (c) turn the two most
load-bearing prose invariants into pre-commit failures.

Output: 205 restored planning files under `.planning/milestones/v1.{6,7,8}-phases/`, a
pre-commit archive guard, an ESLint `no-restricted-imports` rule, three NEW docs
(`KEYS.md`, `RELEASE-MACHINE.md`, `CHANNELS.md`), a rewritten `RELEASE.md`, a backfilled
`CHANGELOG.md`, and an invariants index on `verify-appstore-bundle.sh`.

**SCOPE FENCE (binding):** this plan touches NO application source. The only non-doc,
non-planning, non-script file modified is `eslint.config.js`. Nothing under `src/`,
`src-tauri/src/`, `server/`, `test/`, or `infra/` changes. `scripts/verify-appstore-bundle.sh`
changes by COMMENT LINES ONLY. If the executor finds itself editing a `.ts`/`.tsx`/`.rs` file,
STOP — that is out of scope (the ESLint rules are designed to pass on the current tree
unmodified; if one fires on real source, report it, do not "fix" the source).

**Task grouping note:** the orchestrator suggested T1=item1, T2=items 2/3/5/6/7, T3=item4.
That T2 is ~4 hours of doc writing in one task (well past the 50%-context quality cliff), so
this plan rebalances into three evenly-weighted tasks while covering the SAME 7 items:
T1 = items 1 + 4 (mechanical, automated proofs), T2 = items 2 + 6 + 5 + 7 (three new reference
docs sharing ONE evidence sweep, plus the script header that sweep already reads), T3 = item 3
(RELEASE.md rewrite + CHANGELOG backfill), which cross-links the docs T2 creates.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md

# THE source — file:line evidence for every claim in this plan
@docs/architecture-review-2026-07-06.md
@.planning/todos/pending/2026-07-06-operational-hardening-architecture-review-fix-list.md

# The doc being rewritten (read fully before Task 3)
@docs/RELEASE.md

<verified_facts>
<!-- Pre-verified by the planner against the working tree on 2026-08-08. These are FACTS,
     not guesses — do NOT re-derive them, but DO re-verify anything not listed here. -->

## Item 1 — what was deleted, and where it belongs

Commit `9fcbbd9d` ("docs: start milestone v1.9", 2026-06-30) deleted 15 phase directories
(205 files) from `.planning/phases/` without archiving them. `.planning/phases/` today holds
ONLY the seven `999.*` backlog dirs.

Milestone membership (derived from each archived ROADMAP's `## Phases` list — already verified):

| Archive dir | Phase dirs (exact names at `9fcbbd9d^`) | files |
|---|---|---|
| `.planning/milestones/v1.6-phases/` | `18-entitlements-seam-central-gate` (18), `19-license-activation-offline-verification` (18), `20-purchase-pipeline` (12), `21-license-lifecycle-ship-gate` (18) | 66 |
| `.planning/milestones/v1.7-phases/` | `22-settings-modal-shell` (15), `22.1-settings-followups` (11), `22.2-cmdk-pro-upsell-modal` (4), `23-appearance-pane` (15), `24-hotkeys-general-panes` (15), `25-updates-pane-milestone-ship` (14) | 74 |
| `.planning/milestones/v1.8-phases/` | `26-storekit-bridge-spike` (18), `27-build-variant-seam` (12), `28-entitlement-source-swap` (14), `29-sandbox-safe-native-features` (10), `30-pkg-build-asc-submission` (11) | 65 |

`v1.0-phases` .. `v1.5-phases` and `v1.9-phases` already exist and are correct — do not touch
them. `.planning/milestones/v1.8-research/` also already exists — leave it.

D-52 is defined in `20-purchase-pipeline/20-01-{PLAN,SUMMARY}.md` (verified via
`git grep -l "D-52" 9fcbbd9d^`) — that is the post-restore spot-check.

## Item 1 — what deleted instead of archiving

The GSD milestone-close path is CORRECT if used: `gsd-tools milestone complete --archive-phases`
(`~/.claude/get-shit-done/bin/lib/milestone.cjs:210-224` renames each phase dir into
`milestones/<version>-phases/`), and `/gsd-cleanup` archives retroactively. The destructive
sibling is `gsd-tools phases clear --confirm` (`milestone.cjs:250-271`, `fs.rmSync` recursive),
and the `complete-milestone` workflow's "Archive Phases?" prompt has a "Skip" branch. The
v1.9-start commit took a delete path instead of the archive path.

That tooling is USER-GLOBAL (`~/.claude/`, outside this repo) — it cannot be fixed from here.
The in-repo fix is a mechanical pre-commit guard (Task 1b) + one line in CLAUDE.md.

## Item 4 — ESLint audit (the rule must pass on the CURRENT tree)

- `from "@tauri-apps/..."` static imports exist in EXACTLY ONE file:
  `src/lib/platform/tauri.ts` (12 imports, lines 13-27). Every other `@tauri-apps` occurrence
  repo-wide is a COMMENT saying "never @tauri-apps", or a `vi.doMock("@tauri-apps/...")`
  STRING argument in `src/lib/platform/tauri.test.ts` (not an import — `no-restricted-imports`
  does not see it). No `.mjs`/`.js`/`test/e2e/*.ts` file imports `@tauri-apps`.
- `BrowserRouter` is imported NOWHERE. `react-router-dom` is imported in 20+ files, but only
  for `createHashRouter`, `Outlet`, `RouterProvider`, `NavLink`, `Navigate`, `useNavigate`,
  `useLocation`, `useMatch`, and `MemoryRouter`/`Routes`/`Route` in tests. The rule must
  restrict `importNames: ["BrowserRouter"]` ONLY — restricting the module would break 20 files.
- `eslint.config.js` already `ignores: ["dist","node_modules","src-tauri/target","scaffold",
  "test/fixtures"]`. `scaffold/` (which DOES import react-router-dom) is already ignored.
- `pnpm lint` = `eslint .`; lefthook `pre-commit` already runs it (`lefthook.yml:26-27`).

## Item 2 — trust anchors (locations verified; values NEVER to be written down)

| Anchor | Where the private/secret half lives | Public/pinned half |
|---|---|---|
| Updater minisign keypair | `~/.tauri/devtools.key` + password in gitignored `.env` (`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) + password manager | `src-tauri/tauri.conf.json:52` `plugins.updater.pubkey` — compiled into EVERY shipped direct build |
| Keygen CE account Ed25519 keypair | prod Postgres on `tinkerdev-box` (R2 nightly encrypted dump + automated restore test) | `src-tauri/src/license/config.rs` `KEYGEN_ED25519_PUBKEY_B64` — compiled into every shipped direct build |
| Keygen admin creds / API token | `infra/keygen/.env` (`KEYGEN_ADMIN_EMAIL/PASSWORD`), `server/webhook/.env` (`KEYGEN_ADMIN_TOKEN`) — both in password manager | — |
| Keygen encryption roots | `infra/keygen/.env`: `SECRET_KEY_BASE`, `ENCRYPTION_PRIMARY_KEY`, `ENCRYPTION_DETERMINISTIC_KEY`, `ENCRYPTION_KEY_DERIVATION_SALT` | — |
| LS webhook secret / Resend key | `server/webhook/.env`: `LS_WEBHOOK_SECRET`, `RESEND_API_KEY` | — |
| Backup GPG passphrase + R2 creds | `~/.config/devtools-backup/{gpg.pass,backup.env}` on the box + password manager | — |
| Apple ASC API key | `~/.appstoreconnect/AuthKey_5SC6V2WGQ5.p8` (+ `.env`: `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH`) | — |
| Signing identities (login keychain) | see expiry table below | — |
| MAS provisioning profile | `src-tauri/embedded.provisionprofile` (gitignored, present in tree, in NO backup) | — |

Keychain identities + expiries — VERIFIED 2026-08-08 via
`security find-identity -v` and `security find-certificate -c "<CN>" -p | openssl x509 -noout -enddate`:

| Identity | Expires |
|---|---|
| `Developer ID Application: Boon Khai Lim (FK4HQK83WX)` | **2027-02-01** |
| `Apple Distribution: Boon Khai Lim (FK4HQK83WX)` | **2027-06-22** |
| `3rd Party Mac Developer Installer: Boon Khai Lim (FK4HQK83WX)` | (executor: read it — same command) |
| `Apple Development: Boon Khai Lim (9HGDC8C599)` | (executor: read it — same command) |

`infra/keygen/RUNBOOK.md` § "0. FIRST: the recovery-critical secrets that are NOT in the dump"
(~line 664) already holds the authoritative sha256 + key-name table for `infra/keygen/.env`
(17 keys) and `server/webhook/.env` (9 keys). KEYS.md must CROSS-LINK it, never duplicate it.

## Items 3/5 — the real pipeline

- `pnpm release:bump` -> `tsx scripts/bump-and-tag.mjs`; `pnpm release:publish` ->
  `tsx scripts/build-and-publish.mjs`; `pnpm release:changelog` -> `tsx scripts/changelog.mjs`;
  `pnpm release:build-only` -> `build-and-publish.mjs --build-only`.
- Both drivers are THIN shells over unit-tested pure cores in `src/lib/release/`
  (`bumpPlan.ts`, `publishPlan.ts`, `manifest.ts`, `changelog.ts`) — the ordered pipelines and
  safety invariants are documented in each script's header comment (read them; they are the
  authoritative source for the rewrite).
- `scripts/build.sh <direct|appstore|appstore-pkg|--all>` is the one entry point for signed
  builds; it `set -a; . ./.env; set +a` itself (secrets never printed). It deliberately does
  NOT expose publishing. `.env.example` lists the 6 keys.
- Per-channel `CARGO_TARGET_DIR` trees: `src-tauri/target/{direct,appstore,appstore-pkg}`.
  A set `CARGO_TARGET_DIR` MUST be absolute (build-and-publish.mjs throws otherwise).
- `lefthook.yml`: `pre-commit` = tsc (root + server/webhook) + vitest + eslint (parallel);
  `pre-push` = `cargo test --manifest-path src-tauri/Cargo.toml`. A `release:bump` push
  therefore pays the cargo gate.
- Releases go to the PUBLIC `bklim5/devtools-releases` via `gh --repo` (it is NOT a git remote;
  `git remote -v` shows only `origin` = the private source repo).
- `changelog.ts` behaviour: `promoteUnreleased` renames `## [Unreleased]` to
  `## [<version>] - <date>` at bump time and inserts a fresh empty Unreleased above it; the
  tag message + GitHub release body come from `resolveReleaseNotes` (falls back to the BARE TAG
  when the section is empty). => the maintainer MUST fill `[Unreleased]` BEFORE `release:bump`.

## Item 3 — the tag/version reality (F8, now partly REALIZED)

- Release tags (three-part, from `release:bump`): `v0.2.2 v0.3.0 v0.3.1 v0.3.2 v0.3.3 v0.4.0
  v0.4.1 v1.0.1 v1.0.2`. Milestone tags (two-part, hand-made, local-only per project memory):
  `v1.0 v1.1 v1.2 v1.3 v1.4 v1.5 v1.6 v1.7 v1.8 v1.9`.
- There is NO `v1.0.0` release tag. `package.json` + `tauri.conf.json` are at `1.0.2`.
- **The failure the review predicted ALREADY HAPPENED:** `v1.0.1` and `v1.0.2` (both 2026-08-07)
  have the annotated-tag subject `- _Nothing yet._`, and their CHANGELOG sections say the same.
  284 commits separate `v0.4.1` from `v1.0.1` (all of milestones v1.6-v1.9). Direct-channel
  users jumped 0.4.1 -> 1.0.1 with empty notes.
- Those tags + their published GitHub release bodies are HISTORY — the backfill fixes the
  CHANGELOG (the doc of record) and prevents recurrence. Do NOT rewrite or re-push tags.

## Item 5 — channel split facts

- Build: direct = default `direct` cargo feature + `--config src-tauri/tauri.direct.conf.json`
  + `VITE_CHANNEL=direct`; appstore = **`--no-default-features --features appstore`** (bare
  `--features appstore` silently produces a HYBRID binary; a `compile_error!` guard in
  `src-tauri/src/lib.rs` now rejects it) + `tauri.appstore.conf.json` + `VITE_CHANNEL=appstore`.
- **Capability trap:** a non-empty `app.security.capabilities` array REPLACES the
  `capabilities/` directory glob (tauri-utils `get_capabilities`). BOTH overlays therefore
  carry the bare string `"default"` as the first entry — without it the 12 baseline
  `capabilities/default.json` grants silently drop and the app launches but denies core IPC.
  Direct overlay grants `updater:default`, `process:allow-restart`, `autostart:allow-{enable,
  disable,is-enabled}`; appstore overlay grants `iap:allow-{register,remove}-listener` only.
- appstore conf also sets `bundle.targets:["app"]`, `createUpdaterArtifacts:false`,
  `macOS.entitlements:"entitlements.appstore.plist"`, `hardenedRuntime:false`,
  `minimumSystemVersion:"13.0"`, and `plugins.updater:null`. Base conf (direct):
  `targets:["app","dmg"]`, `category:"DeveloperTools"`, `createUpdaterArtifacts:true`,
  `entitlements:"entitlements.plist"`, `minimumSystemVersion:"10.15"`.
- e2e runs on the DIRECT overlay: `pnpm tauri:dev:e2e` =
  `VITE_CHANNEL=direct tauri dev --features webdriver --config src-tauri/tauri.direct.conf.json`.

## Item 7 — verify-appstore-bundle.sh assert inventory (849 lines)

`assert_plugins_absent` (98), `assert_entitlements_present` (136), `assert_min_system_version`
(167), `assert_no_keygen_strings` (183), `assert_no_license_ui_module` (228),
`assert_no_heavy_engine_in_entry` (303), `assert_dist_freshness` (347),
`assert_binary_integrity` (435); selftests: `selftest_forbidden_gate` (481),
`selftest_dist_freshness` (590), `selftest_foldin_realbuild` (683). The existing header already
explains each in prose organised BY PHASE (a-j) — the missing piece is a scannable
one-line-per-invariant index keyed to the assert function + its D/T identifier.
</verified_facts>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restore the v1.6-v1.8 decision ledger, guard the archive step, and make the seam + HashRouter invariants mechanical</name>
  <files>
    .planning/milestones/v1.6-phases/ (new, 66 files),
    .planning/milestones/v1.7-phases/ (new, 74 files),
    .planning/milestones/v1.8-phases/ (new, 65 files),
    scripts/check-planning-archive.sh (new),
    lefthook.yml,
    CLAUDE.md,
    eslint.config.js
  </files>
  <action>
Three independent sub-items. Do them in order; each has its own automated proof.

**(1a) Restore the deleted planning artifacts (review KG-1, fix-list #2).**

Restore ONLY the 15 named directories — NEVER `git checkout 9fcbbd9d^ -- .planning/phases/`
wholesale, which would clobber the seven current `999.*` backlog dirs:

```bash
git checkout 9fcbbd9d^ -- \
  .planning/phases/18-entitlements-seam-central-gate \
  .planning/phases/19-license-activation-offline-verification \
  .planning/phases/20-purchase-pipeline \
  .planning/phases/21-license-lifecycle-ship-gate \
  .planning/phases/22-settings-modal-shell \
  .planning/phases/22.1-settings-followups \
  .planning/phases/22.2-cmdk-pro-upsell-modal \
  .planning/phases/23-appearance-pane \
  .planning/phases/24-hotkeys-general-panes \
  .planning/phases/25-updates-pane-milestone-ship \
  .planning/phases/26-storekit-bridge-spike \
  .planning/phases/27-build-variant-seam \
  .planning/phases/28-entitlement-source-swap \
  .planning/phases/29-sandbox-safe-native-features \
  .planning/phases/30-pkg-build-asc-submission
```

Then `mkdir -p .planning/milestones/v1.{6,7,8}-phases` and `git mv` each restored dir into its
milestone archive per the membership table in `<verified_facts>` (v1.6: 18,19,20,21 — v1.7: 22,
22.1, 22.2, 23, 24, 25 — v1.8: 26,27,28,29,30). Use `git mv` so the index tracks the move.

Do NOT edit the restored files' contents — they are the historical record. Do NOT touch
`v1.0-phases` .. `v1.5-phases`, `v1.9-phases`, or `v1.8-research`.

Then add a short "Archived phase directories" note to `.planning/STATE.md` (manual edit — per
project memory `gsd-tools-custom-state-format`, the gsd state/roadmap helpers no-op on this
repo's narrative format, so DO NOT try `gsd-tools state ...`): one paragraph recording that the
v1.6-v1.8 phase artifacts were restored from `9fcbbd9d^` on this date and now live under
`.planning/milestones/v1.{6,7,8}-phases/`, so a future agent grepping for D-xx/T-xx finds them.

**(1b) Make the deletion mechanically impossible to repeat.**

The destructive step lives in user-global tooling (`gsd-tools phases clear --confirm` /
the `complete-milestone` "Skip" branch) and cannot be patched from this repo — so add an
in-repo gate instead.

Create `scripts/check-planning-archive.sh` (bash, `set -euo pipefail`, executable). Behaviour:

1. If `ALLOW_PHASE_DELETE` is set to a non-empty value, print a one-line notice and exit 0.
2. Collect the set of top-level phase directories that the STAGED diff deletes:
   `git diff --cached --name-only --diff-filter=D -- .planning/phases/` -> map each path to its
   first path segment under `.planning/phases/` -> unique.
3. If that set is empty, exit 0 (the common case — near-zero cost on every commit).
4. Otherwise collect the staged ADDS under `.planning/milestones/`:
   `git diff --cached --name-only --diff-filter=A -- .planning/milestones/`.
5. For each deleted phase dir `<d>`, PASS only if some added path matches
   `.planning/milestones/*-phases/<d>/`. If any `<d>` has no matching archive add, FAIL
   (exit 1) listing the offending dirs and printing the correct remedy:
   `gsd-tools milestone complete --archive-phases` / `/gsd-cleanup`, or
   `ALLOW_PHASE_DELETE=1 git commit ...` for a deliberate backlog-dir removal.

Header comment must state WHY it exists (commit `9fcbbd9d` deleted 205 files of decision ledger
at v1.9 start; the D-xx/T-xx identifiers the code cites everywhere lived only in git history for
five weeks) and name the escape hatch.

Wire it into `lefthook.yml` `pre-commit` as a fourth parallel command:
```yaml
    archive-guard:
      run: bash scripts/check-planning-archive.sh
```
with a brief comment in the file's existing D-08 scope block noting this guard is repo-hygiene,
not part of the three-gate harness.

Add ONE line to `CLAUDE.md` (in the "Build + verify harness" section, after the phase-boundary
paragraph): milestone close ARCHIVES phase dirs to `.planning/milestones/vX.Y-phases/` and never
deletes them; a pre-commit guard enforces it; override with `ALLOW_PHASE_DELETE=1`.

**(1c) ESLint `no-restricted-imports` (review F5, fix-list #4).**

Append two config blocks to `eslint.config.js` AFTER the existing `server/**` block (flat-config
order matters — later blocks win):

```js
  {
    // F5 (architecture-review 2026-07-06): the two most load-bearing prose invariants,
    // made mechanical. lefthook already runs `pnpm lint` pre-commit, so a violation now
    // FAILS the commit instead of relying on agent discipline + review.
    files: ["**/*.{ts,tsx,mts,cts,js,mjs,cjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tauri-apps/*", "@tauri-apps/*/**"],
              message:
                "Reach Tauri through the platform seam (src/lib/platform/), never @tauri-apps/* directly — CLAUDE.md. src/lib/platform/tauri.ts is the ONLY legal importer; add the capability to the seam interface instead.",
            },
          ],
          paths: [
            {
              name: "react-router-dom",
              importNames: ["BrowserRouter"],
              message:
                "HashRouter only — CLAUDE.md. BrowserRouter 404s on reload from static files. Use createHashRouter (src/router.tsx), or MemoryRouter in tests.",
            },
          ],
        },
      ],
    },
  },
  {
    // The seam IS the legal @tauri-apps importer — and the only one. Re-declared (not
    // switched off) so the BrowserRouter restriction still applies inside the seam.
    files: ["src/lib/platform/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [ /* the SAME BrowserRouter entry as above */ ] },
      ],
    },
  },
```

Notes: both `@tauri-apps/*` (matches `@tauri-apps/api`) and `@tauri-apps/*/**` (matches
`@tauri-apps/api/window`) are needed. Use the BASE `no-restricted-imports`, not the
typescript-eslint variant — the base rule flags `import type` declarations too, which is the
stricter and desired behaviour. `scaffold/` is already in `ignores` so its `react-router-dom`
imports are irrelevant. Factor the shared BrowserRouter entry into a `const` above the export
to avoid a copy-paste drift between the two blocks.

**Prove the rule FIRES** with a throwaway probe file (do NOT edit real source):

```bash
cat > src/__lint-probe.ts <<'EOF'
import { getVersion } from "@tauri-apps/api/app";
import { BrowserRouter } from "react-router-dom";
export const probe = [getVersion, BrowserRouter];
EOF
pnpm lint 2>&1 | tee /tmp/lint-probe.txt; grep -c "no-restricted-imports" /tmp/lint-probe.txt   # MUST be >= 2
rm src/__lint-probe.ts
```

If the probe produces fewer than 2 `no-restricted-imports` errors, the rule is mis-scoped — fix
the config, not the probe. Delete the probe file before committing (`git status` must be clean
of it).

Finally run the full gate on the UNMODIFIED tree: `pnpm lint` (exit 0), `pnpm tsc --noEmit`,
`pnpm tsc --noEmit -p server/webhook/tsconfig.json`, `pnpm vitest run`. If `pnpm lint` reports a
`no-restricted-imports` error on any REAL file, do NOT edit that file — report it; the audit in
`<verified_facts>` says the tree is clean, so a hit means the rule is too broad.
  </action>
  <verify>
    <automated>test $(find .planning/milestones/v1.6-phases -type f | wc -l) -eq 66 && test $(find .planning/milestones/v1.7-phases -type f | wc -l) -eq 74 && test $(find .planning/milestones/v1.8-phases -type f | wc -l) -eq 65 && test $(ls -1 .planning/phases/ | grep -vc '^999\.') -eq 0 && test -n "$(grep -rl 'D-52' .planning/milestones/v1.6-phases/)" && bash -n scripts/check-planning-archive.sh && bash scripts/check-planning-archive.sh && pnpm lint && pnpm tsc --noEmit && pnpm tsc --noEmit -p server/webhook/tsconfig.json && pnpm vitest run</automated>
  </verify>
  <done>
    - `.planning/milestones/v1.{6,7,8}-phases/` hold 66/74/65 files respectively; `.planning/phases/` holds only the seven `999.*` dirs; `grep -rl "D-52" .planning/milestones/v1.6-phases/` is non-empty.
    - `scripts/check-planning-archive.sh` exits 0 on the current staged state; a synthetic staged phase-dir deletion WITHOUT a milestones/ add makes it exit 1 (demonstrate once, then reset the index); `ALLOW_PHASE_DELETE=1` bypasses it.
    - `lefthook.yml` runs the guard pre-commit; CLAUDE.md states the archive-not-delete rule and the override.
    - The throwaway lint probe produced >= 2 `no-restricted-imports` errors and has been deleted; `pnpm lint` on the real tree exits 0.
    - tsc (root + server) and `pnpm vitest run` are green; ZERO files under `src/`, `src-tauri/src/`, `server/`, `test/`, `infra/` were modified.
  </done>
</task>

<task type="auto">
  <name>Task 2: Write docs/KEYS.md, docs/RELEASE-MACHINE.md and docs/CHANNELS.md, and add the invariants index to verify-appstore-bundle.sh</name>
  <files>
    docs/KEYS.md (new),
    docs/RELEASE-MACHINE.md (new),
    docs/CHANNELS.md (new),
    scripts/verify-appstore-bundle.sh (COMMENT-ONLY)
  </files>
  <action>
Three new reference docs plus one comment-only script header. They share ONE evidence sweep — do
the sweep first, once, and write from it.

**Evidence sweep (do this before writing a word).** Read/grep, and keep a note of the
file:line for every claim you will make:
`src-tauri/tauri.conf.json`, `src-tauri/tauri.direct.conf.json`, `src-tauri/tauri.appstore.conf.json`,
`src-tauri/capabilities/default.json`, `src-tauri/entitlements.plist`,
`src-tauri/entitlements.appstore.plist`, `src-tauri/src/lib.rs` (the `compile_error!` hybrid
guard + the `#[cfg(feature=...)]` gates), `src-tauri/src/license/config.rs` (host, account id,
pubkey, TTL/grace constants), `src-tauri/Cargo.toml` (`[features]`), `vite.config.ts` (the two
guard plugins + `VITE_CHANNEL`), `package.json` scripts, `scripts/build.sh`,
`scripts/build-appstore-bundle.sh`, `scripts/build-appstore-pkg.sh`,
`scripts/verify-appstore-bundle.sh` (header + the eight `assert_*` functions), `.env.example`,
`lefthook.yml`, `infra/keygen/RUNBOOK.md`, and `security find-identity -v` +
`security find-certificate -c "<CN>" -p | openssl x509 -noout -enddate` for all four identities.

**RULE: every factual claim in these docs must trace to something you read in this sweep.**
Where the architecture review and the live tree disagree, the TREE wins (the review is a
2026-07-06 snapshot; the R2 offsite backup + restore-the-box runbook have landed since, and
release tags v1.0.1/v1.0.2 have shipped). Do not copy the review's claims forward unchecked.

---

**(2a) `docs/KEYS.md` — trust-anchor runbook (review F1/KG-2/R7, fix-list #3 part).**

**HARD CONSTRAINT: ZERO secret VALUES.** Inventory, locations, fingerprints, expiry dates,
consequences and procedures only. Never a key, password, token, issuer id, or `.p8` body. The
committed minisign PUBLIC key and the compiled Ed25519 PUBLIC key are already in the repo and
may be referenced BY FILE:LINE (do not paste them either — a pointer is enough).

Sections:
1. **Purpose + the one rule** — this file names anchors and procedures; values live only in the
   password manager and gitignored `.env` files.
2. **Anchor inventory** — a table built from the `<verified_facts>` anchor table, each row
   verified against the tree: anchor, where the secret half lives, where the public/pinned half
   is compiled in (file:line), backup status (the owner's password-manager copies + the R2
   nightly encrypted dump with automated restore validation — both DONE, per
   `infra/keygen/RUNBOOK.md` Step 10 and quick/260807-ohd).
3. **Loss consequences, per anchor** — concrete, not generic. Minisign private key lost =>
   the direct channel can never ship another update to any EXISTING install (the pubkey is
   compiled in); users must manually re-download a DMG. CE Postgres lost => activation,
   refresh, deactivation and seat-release die for every buyer, and cached certs decay to Free
   within <= TTL+grace (read the real numbers out of `config.rs`, do not assume 30+7).
   `.p8`/certs lost => releases blocked until the renewal dance.
4. **Rotation procedures, per anchor** — the load-bearing section.
   - **Minisign: there is NO rotation without stranding the fleet.** State it in those words.
     The ONLY safe migration is a *transitional release*: ship a version signed with the OLD
     key whose `tauri.conf.json` carries the NEW pubkey, wait for the installed base to adopt
     it, and only THEN start signing with the new key — anyone who skips that version is
     stranded forever. Note this is a multi-week operation, not a recovery path, and that the
     old `docs/RELEASE.md` advice ("re-paste the new pubkey and commit") was WRONG.
   - **CE Ed25519:** the public half is compiled into every shipped binary — rotating requires
     shipping a new binary AND the same wait; a rotation done server-side alone invalidates
     every cert in the field.
   - Admin token, LS webhook secret, Resend key, GPG passphrase, R2 creds: normal rotate-in-place
     procedures (which file, which service to restart, what to re-verify) — and for the two
     `.env` files, the requirement to re-run the RUNBOOK's fingerprint command and update the
     table.
   - Apple certs / `.p8`: renewal is re-issue-and-reinstall, not rotation; note what breaks
     in-flight.
5. **Expiry calendar** — the four keychain identities with real `notAfter` dates (Developer ID
   Application 2027-02-01, Apple Distribution 2027-06-22, plus the two you read), the ASC API
   key, and the MAS provisioning profile. Add a "check this table every January" line.
6. **Backup + restore-test status** — cross-link `infra/keygen/RUNBOOK.md` § "0. FIRST: the
   recovery-critical secrets that are NOT in the dump" as the authoritative fingerprint table
   (`infra/keygen/.env` 17 keys / `server/webhook/.env` 9 keys, with sha256s). Do NOT duplicate
   the hashes here — a stale second copy is worse than none.
7. **Custody model for future CI (backlog 999.2)** — one short paragraph: CI would need the
   minisign key + password as repository secrets; given that a leaked-and-stranded key is
   unrecoverable, state the decision to make (self-hosted runner vs. hosted with secrets) and
   that it must be made HERE before 999.2 starts.

**(2b) `docs/RELEASE-MACHINE.md` — rebuild-the-laptop inventory (review F2, fix-list #6).**

A checklist, not prose. Everything `pnpm release:bump` / `release:publish` /
`scripts/build.sh --all` needs on a fresh machine, each with WHERE the canonical copy lives:
- toolchain: node + `pnpm@11.5.0` (from `packageManager`), `pnpm install`, `pnpm lefthook install`
  (the `prepare` script), rustup + BOTH targets (`aarch64-apple-darwin`, `x86_64-apple-darwin` —
  `build-and-publish.mjs` preflights them), Xcode Command Line Tools;
- files: `~/.tauri/devtools.key` (+ password), `~/.appstoreconnect/AuthKey_5SC6V2WGQ5.p8`,
  root `.env` (copy `.env.example`, 6 keys), `src-tauri/embedded.provisionprofile` (gitignored,
  in NO backup — call that out as a gap the owner must close);
- keychain: the four identities from `security find-identity -v`, imported as `.p12` from the
  password manager;
- auth sessions: `gh auth` with write/admin on the PUBLIC `bklim5/devtools-releases`
  (`build-and-publish.mjs` preflights this), `ssh tinkerdev-box` key for support ops
  (`infra/keygen/RUNBOOK.md`), R2 + healthchecks.io credentials for the backup pipeline;
- a "smoke test the rebuilt machine" section: `pnpm release:publish --dry-run` (zero side
  effects — it short-circuits BEFORE the build), then `scripts/build.sh appstore` (needs no
  `.env` secrets), then `scripts/build.sh direct`.
- Point at `docs/KEYS.md` for expiries; do not restate them.

**(2c) `docs/CHANNELS.md` — the channel matrix (review F7/KG-4, fix-list #5).**

One page, one primary table: **dimension x direct x appstore x enforcing artifact**. Rows (all
verified in the sweep): cargo features & the `--no-default-features` gotcha; the `compile_error!`
hybrid guard; config overlay file; capability grants; `VITE_CHANNEL` / `IS_APPSTORE`; entitlements
file; hardened runtime; `minimumSystemVersion` (10.15 vs 13.0); bundle targets &
`createUpdaterArtifacts`; Pro entitlement source (Keygen `baseFromLicense` vs StoreKit
`baseFromStoreKit`); updater + launch-at-login presence; keyring/Keychain; upsell UI; signing
identity + provisioning profile; `CARGO_TARGET_DIR` tree; build command; verification command.

Then three prose call-outs:
- **The capability silent-drop trap (F7)** — promote the excellent JSON comment in
  `tauri.direct.conf.json` into prose so it survives a config refactor: a non-empty
  `app.security.capabilities` REPLACES the `capabilities/` directory glob, so the literal
  `"default"` string entry is load-bearing in BOTH overlays; a malformed identifier/window/
  permission silently DROPS the grant (a direct-channel false-GREEN whose only current backstop
  is the manual round-trip gate `build-and-publish.mjs` prints at publish time).
- **`--no-default-features` (project memory `appstore-build-needs-no-default-features`)** — a
  bare `--features appstore` keeps the default `direct` umbrella and silently produces a HYBRID
  binary; the `compile_error!` guard now rejects it; on the shipped path the flag goes AFTER
  `--` (the tauri CLI has no such flag of its own).
- **Where e2e runs** — the WKWebView e2e path uses the DIRECT overlay
  (`pnpm tauri:dev:e2e`), so appstore-only regressions are NOT covered by it;
  `scripts/verify-appstore-bundle.sh` is the appstore gate.

Link to `docs/RELEASE.md` (direct-channel release), `docs/appstore/` (MAS specifics), and the
verify script's invariants index from (2d).

**(2d) `scripts/verify-appstore-bundle.sh` invariants index (review F6, fix-list #7).**

COMMENT-ONLY change. Insert, immediately after the shebang and BEFORE the existing phase-organised
header, a compact index block titled e.g. `# ===== INVARIANT INDEX (one line per asserted
invariant) =====`. One line per invariant in the form:

`#  I-01  <what is asserted, imperative>  -- assert_plugins_absent  [MAS-BUILD-06, D-09]`

Cover every assertion the eight `assert_*` functions make (plugins/keyring absent; entitlements
present + `keychain-access-groups` absent; 13.0 floor at the artifact; the four Keygen COPY
markers; licenseUi fold-in; updater subtree; heavy-engine initial reachability; dist<->binary
freshness/linkage; universal archs + embedded profile + valid deep signature), each keyed to its
enforcing function and its real D/T/requirement identifier taken FROM the existing header prose
(do not invent identifiers — if the existing header does not name one for a check, write `[-]`).
Add a final line pointing at `docs/CHANNELS.md` for the channel matrix.

Leave the existing (a)-(j) prose header in place below the index — it carries the WHY. Change no
code, no strings, no flags, no whitespace inside any function.
  </action>
  <verify>
    <automated>test -f docs/KEYS.md && test -f docs/RELEASE-MACHINE.md && test -f docs/CHANNELS.md && grep -qi "strand" docs/KEYS.md && grep -q "2027-02-01" docs/KEYS.md && grep -q "RUNBOOK.md" docs/KEYS.md && grep -q "embedded.provisionprofile" docs/RELEASE-MACHINE.md && grep -q -- "--no-default-features" docs/CHANNELS.md && grep -q "INVARIANT INDEX" scripts/verify-appstore-bundle.sh && bash -n scripts/verify-appstore-bundle.sh && test -z "$(git diff -U0 -- scripts/verify-appstore-bundle.sh | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-][[:space:]]*#')" && pnpm lint && pnpm vitest run</automated>
  </verify>
  <done>
    - `docs/KEYS.md` exists with all seven sections, names every anchor from the inventory table, states the minisign no-rotation-without-stranding rule explicitly, carries the real cert expiries, cross-links the RUNBOOK fingerprint table, and contains ZERO secret values (prove: `git diff` reviewed line-by-line for anything key/token/password-shaped; no base64 blob > 40 chars that is not an already-committed public key reference).
    - `docs/RELEASE-MACHINE.md` lists toolchain, files, keychain identities, auth sessions, and a dry-run smoke test; flags `src-tauri/embedded.provisionprofile` as unbacked.
    - `docs/CHANNELS.md` has the dimension x channel x enforcing-artifact table plus the three call-outs (capability silent-drop, `--no-default-features`, e2e-on-direct).
    - `scripts/verify-appstore-bundle.sh` diff contains ONLY comment lines (asserted by the verify command), `bash -n` passes, and every `assert_*` function appears in the index.
    - Every factual claim traces to a file read in the evidence sweep; where the 2026-07-06 review disagreed with the tree, the doc records the tree's state.
  </done>
</task>

<task type="auto">
  <name>Task 3: Rewrite docs/RELEASE.md around the real pipeline and backfill CHANGELOG.md</name>
  <files>docs/RELEASE.md, CHANGELOG.md</files>
  <action>
**(3a) Rewrite `docs/RELEASE.md` (review F3/F4/F8/KG-3, fix-list #3).**

The current doc is the single most dangerous artifact in the repo: it documents a superseded
hand-authored-`latest.json` flow, a single-arch manifest, "both are currently 0.2.0", and — at
lines 56-58 — regeneration advice that would permanently strand the entire installed base. A
future session following it would skip every safety rail `build-and-publish.mjs` exists to
enforce.

**Authoritative sources for the rewrite** (read them; do not write from the old doc):
`scripts/bump-and-tag.mjs` and `scripts/build-and-publish.mjs` header comments (both document
their ordered pipeline + safety invariants), `src/lib/release/{bumpPlan,publishPlan,manifest,
changelog}.ts`, `scripts/build.sh`, `package.json` scripts, `.env.example`, `lefthook.yml`,
`src-tauri/tauri.conf.json`. Run `pnpm release:publish --dry-run` and `pnpm release:bump
--dry-run` if they are safe no-write paths (the headers say `--dry-run` short-circuits BEFORE
any write and before the build) and quote the REAL printed plan/usage rather than paraphrasing.

Target structure:

1. **TL;DR — the whole release in three commands.** Edit `CHANGELOG.md` `[Unreleased]` (or
   `pnpm release:changelog "<entry>"`) -> `pnpm release:bump <patch|minor|major>` (verify the
   real arg grammar from `parseBumpArgs`) -> `pnpm release:publish`. State plainly that the
   manual steps are a RECOVERY APPENDIX, not the procedure.
2. **What each command actually does** — the ordered pipeline from each script's header, in
   plain list form: bump = preflights (clean tree, branch==master, tag absent local+remote,
   vitest+tsc+eslint) -> write 3 manifests -> lockfiles -> allowlist diff -> commit -> annotated
   tag (message = the CHANGELOG section) -> y/N -> push commit then tag; publish = preflights
   (signing env, Apple env, rustup both targets, `gh` auth + write perm on the public releases
   repo, release-not-already-published) -> universal build -> lipo both-arch assert -> single
   FRESH `.sig` glob -> notarise+staple+`spctl` -> write `latest.json` -> `gh release create`
   (assets FIRST) -> upload `latest.json` LAST -> curl-verify the served version -> print the
   manual round-trip gate.
3. **Preflight expectations / environment** — `scripts/build.sh` sources gitignored `.env`
   itself (`set -a; . ./.env; set +a`; secrets never printed); a standalone `pnpm release:publish`
   needs the same env exported. List the 6 `.env.example` keys by NAME only. Note the per-channel
   `CARGO_TARGET_DIR` trees (`src-tauri/target/{direct,appstore,appstore-pkg}`) and the
   absolute-path requirement. Note the lefthook gates: pre-commit tsc+vitest+eslint, **pre-push
   `cargo test`** — so the bump's push pays a cargo build.
4. **The manual round-trip gate (DST-02)** — keep and sharpen: install an OLD build, Check for
   Updates, verify + relaunch; a signature mismatch MUST refuse. Keep the CSP note.
5. **Rollback = revert-by-republish.** Currently this text exists ONLY as runtime output from
   `renderPublishRecovery`. Put it in the doc: never delete/re-point a published release; revert
   the code, bump forward, publish again; what to do if assets landed but `latest.json` did not
   (and why assets-before-manifest ordering makes that the safe failure).
6. **Moving the update host** (review F4) — the constraint the old doc omitted: the endpoint is
   COMPILED IN (`src-tauri/tauri.conf.json` `plugins.updater.endpoints`), so a host move requires
   publishing a TRANSITIONAL release through the OLD endpoint, carrying the new endpoint, while
   the old one still resolves; only after adoption can the old host go away. Both the
   `endpoints` URL and every `latest.json` `url` change. Same shape as the minisign migration —
   cross-link `docs/KEYS.md`.
7. **Version & tag schemes** (review F8) — two colliding schemes: **release tags** `vX.Y.Z`
   (three-part, created by `release:bump`, tag subject = the CHANGELOG section, pushed to
   `origin`) vs **milestone tags** `vX.Y` (two-part, hand-made, LOCAL-ONLY — never pushed; see
   project memory `milestone-tags-local-only`). Record the real history: releases
   `v0.2.2..v0.4.1`, then `v1.0.1`/`v1.0.2` (2026-08-07); there is NO `v1.0.0` release tag;
   `package.json` + `tauri.conf.json` are at `1.0.2` (bumped to 1.0.0 for the MAS submission);
   direct users jumped 0.4.1 -> 1.0.1. Recommend prefixing FUTURE milestone tags
   (`milestone/v2.0`) to end the collision. Verify the pushed/local split best-effort with
   `git ls-remote --tags origin` — if the network is unavailable, say so in the doc rather than
   asserting.
8. **Key regeneration — DELETE the old advice.** Replace old lines 56-58 entirely with a
   one-paragraph pointer to `docs/KEYS.md`, explicitly labelled: regenerating the minisign
   keypair STRANDS every existing install; it is not a recovery path.
9. **Channel note** — this runbook covers the DIRECT channel only; point at `docs/CHANNELS.md`
   and `docs/appstore/` for the Mac App Store path.
10. **Recovery appendix** — the old §3-§6 hand-authored flow, retained but clearly fenced as
    "only when `build-and-publish.mjs` is unusable", with the manual `latest.json` schema, the
    NEVER-reuse-a-stale-`.sig` warning, and the DMG-flake `hdiutil detach` mitigation (keep —
    still real, project memory `tauri-dmg-bundle-flake`).
11. **Delete outright:** the "Per-arch caveat / universal deferred to the CI phase" callout
    (publish now builds universal and asserts both arches via lipo), "both are currently 0.2.0",
    and the closing "CI release-automation is a deferred future phase" framing — replace with a
    one-line pointer to backlog 999.2 and to `docs/KEYS.md` for the CI custody decision.

Keep the two-independent-signatures explainer (minisign vs Apple Developer-ID) and the split-repo
rationale — both still accurate; re-verify the repo names against `build-and-publish.mjs`.

**(3b) Backfill `CHANGELOG.md` (review F8/R4).**

The `[1.0.1]` and `[1.0.2]` sections both read `- _Nothing yet._`, and the annotated tags
shipped with that as their release notes. Fix the doc of record:

- Derive the user-visible change list for `[1.0.1]` from the archived milestone roadmaps
  (`.planning/milestones/v1.6-ROADMAP.md` .. `v1.9-ROADMAP.md`, their `## Phases` bullets and
  `## Milestone Summary`) plus the phase SUMMARYs restored in Task 1. Write USER-facing bullets
  (what a buyer sees), not phase titles: licensing/activation + Pro gating, the Settings modal
  and its panes (License, Appearance, Hotkeys, General, Updates), the ⌘K Pro upsell, and the two
  new tools shipped in v1.9 (HTML prettifier, JS/TS prettifier — each with Prettify + Minify),
  taking 13 tools total. Verify each bullet against the roadmaps before writing it; omit anything
  store-channel-only that a direct-channel user never sees (or label it "(App Store edition)").
- `[1.0.2]`: the license-test clock-seam fix — internal only. Write it as such (e.g.
  "Internal: pinned time in the license refresh tests via an injectable clock seam; no
  user-facing change") rather than leaving `_Nothing yet._`.
- Add a short HISTORICAL NOTE under `[1.0.1]` (or in the file header): the shipped `v1.0.1` /
  `v1.0.2` annotated tags and their GitHub release bodies were published as `_Nothing yet._`;
  those are history and are deliberately NOT rewritten — this backfill fixes the record going
  forward.
- `[Unreleased]`: leave it accurate. If nothing user-facing has landed since 1.0.2 (docs +
  infra only), say exactly that instead of `_Nothing yet._`.
- Do NOT change the file's header protocol paragraph, and do NOT touch any section at or below
  `[0.4.1]`. Do not create, move, or delete any git tag.

Keep the Keep-a-Changelog heading shape EXACTLY (`## [1.0.1] - 2026-08-07`) — `changelog.ts`
parses these headings and `resolveReleaseNotes` reads the bodies; a reshaped heading silently
breaks release notes.

**Cross-link contract:** `docs/RELEASE.md` must link `docs/KEYS.md` (rotation) and
`docs/CHANNELS.md` (channel split), both created in Task 2, and `docs/KEYS.md`'s reference to
RELEASE.md must still resolve after the rewrite (the path is unchanged).
  </action>
  <verify>
    <automated>grep -q "release:publish" docs/RELEASE.md && grep -q "release:bump" docs/RELEASE.md && grep -q "KEYS.md" docs/RELEASE.md && grep -q "CHANNELS.md" docs/RELEASE.md && grep -qi "rollback" docs/RELEASE.md && grep -qi "transitional" docs/RELEASE.md && ! grep -q "both are currently" docs/RELEASE.md && ! grep -q "deferred to the CI phase" docs/RELEASE.md && grep -q "^## \\[1.0.1\\] - 2026-08-07" CHANGELOG.md && npx tsx -e "import{readFileSync}from('node:fs');import{extractChangelogSection}from('./src/lib/release/changelog.ts');const t=readFileSync('CHANGELOG.md','utf8');for(const v of ['1.0.1','1.0.2']){const s=extractChangelogSection(t,v);if(!s||s.includes('Nothing yet'))throw new Error('CHANGELOG section still empty/placeholder for '+v);console.log(v,'OK');}" && pnpm lint && pnpm vitest run</automated>
  </verify>
  <done>
    - `docs/RELEASE.md` leads with the real three-command flow, documents both drivers' ordered pipelines, the `.env`/`CARGO_TARGET_DIR`/lefthook preflight reality, rollback, update-host migration, and the two tag schemes; the old fleet-stranding regeneration text is GONE and replaced by a `docs/KEYS.md` pointer; the manual flow survives only as a fenced recovery appendix; the per-arch/CI-deferred and "0.2.0" staleness is deleted.
    - `extractChangelogSection` returns a NON-EMPTY body for both `1.0.1` and `1.0.2` (asserted in verify) — i.e. a future `release:publish` can no longer fall back to the bare tag for them.
    - CHANGELOG heading shapes unchanged; nothing at/below `[0.4.1]` edited; no git tag created, moved or deleted.
    - Cross-links between RELEASE.md, KEYS.md and CHANNELS.md all resolve.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| password manager / gitignored `.env` -> committed docs | Task 2 writes docs ABOUT secrets; a slip commits a secret value into a repo that is private today but whose history is permanent |
| git history -> working tree | Task 1 restores 205 files from a historical commit into the live tree |
| ESLint config -> the pre-commit gate | Task 1c changes what lefthook rejects; a too-broad rule blocks all future commits, a too-narrow one is a false GREEN |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-KFS-01 | Information disclosure | `docs/KEYS.md`, `docs/RELEASE-MACHINE.md` | mitigate | HARD CONSTRAINT stated in the task: inventory/locations/expiries/procedures ONLY, zero values. Task 2 `<done>` requires a line-by-line `git diff` review for key/token/password-shaped strings before commit; the RUNBOOK's sha256 fingerprint table is CROSS-LINKED, never duplicated |
| T-KFS-02 | Tampering | `.planning/phases/999.*` | mitigate | Task 1a restores by an EXPLICIT 15-dir list and forbids a wholesale `git checkout 9fcbbd9d^ -- .planning/phases/`; verify asserts `.planning/phases/` still contains exactly the seven `999.*` dirs and nothing else |
| T-KFS-03 | Tampering | restored planning artifacts | mitigate | Restored files are the historical record — the task forbids editing their contents; per-milestone file counts (66/74/65) are asserted in `<verify>` against the counts measured at `9fcbbd9d^` |
| T-KFS-04 | Denial of service | `lefthook.yml` pre-commit | mitigate | The archive guard exits 0 immediately when no `.planning/phases/` deletion is staged (pure `git diff --cached` plumbing, no I/O); an `ALLOW_PHASE_DELETE=1` escape hatch exists and is documented in CLAUDE.md and the script header |
| T-KFS-05 | Denial of service | `eslint.config.js` | mitigate | The rule was audited to pass on the CURRENT tree unmodified (single legal `@tauri-apps` importer; `BrowserRouter` imported nowhere); Task 1 runs the full `lint`+`tsc`+`vitest` suite and explicitly forbids "fixing" real source to satisfy the rule |
| T-KFS-06 | Spoofing (false GREEN) | `eslint.config.js` | mitigate | A throwaway probe file with both violations must produce >= 2 `no-restricted-imports` errors before the rule is accepted; the probe is deleted before commit |
| T-KFS-07 | Tampering | `scripts/verify-appstore-bundle.sh` | mitigate | Comment-only change enforced mechanically: `<verify>` asserts the entire diff contains no non-comment `+`/`-` line, plus `bash -n` |
| T-KFS-08 | Repudiation | `CHANGELOG.md` / git tags | accept | The shipped `v1.0.1`/`v1.0.2` tag annotations and GitHub release bodies already say `_Nothing yet._`. Rewriting published tags would break the fleet's release history; the plan records the fact in the CHANGELOG as a historical note instead |
| T-KFS-09 | Information disclosure | `docs/RELEASE.md` env section | mitigate | Env keys are listed by NAME only (from `.env.example`, which is already committed and value-free); no `.env` contents are read into the doc |
</threat_model>

<verification>
Whole-plan gates, in the harness order. Note which harness steps are N/A and WHY — do not
silently skip them, and do not defer an agent-runnable step to the human.

1. **`/simplify`** over the working-tree diff — quality-only cleanup of the two new scripts/config
   (`scripts/check-planning-archive.sh`, `eslint.config.js`) and de-duplication across the four
   docs (a fact should live in exactly ONE doc, cross-linked from the others; the RUNBOOK's
   fingerprint table in particular must not be duplicated into KEYS.md).
2. **`/code-review xhigh`** over the diff. Spawn its agents on Opus per CLAUDE.md's model
   orchestration policy (edit the persisted workflow script so every `agent()` call passes
   `model: 'opus'` before launching). Address every confirmed finding.
3. **`/codex:adversarial-review --wait --scope working-tree`** — the adversarial pass matters most
   here for the DOC CLAIMS: ask it to challenge factual accuracy (does the described pipeline
   match the scripts? is the rotation advice actually safe? does the channel matrix match the
   confs?) and the guard/lint rules' failure modes, not just line bugs. Address findings; route
   pre-existing design policy questions to the owner rather than fixing them here.
4. **Unit gate:** `pnpm lint`, `pnpm tsc --noEmit`, `pnpm tsc --noEmit -p server/webhook/tsconfig.json`,
   `pnpm vitest run` — all green. The decoder's 19 tests must be untouched and passing.
   `cargo test --manifest-path src-tauri/Cargo.toml` is unaffected (no Rust change) — the
   pre-push hook will run it anyway.
5. **Real-webview UI verification: N/A, and say so in the SUMMARY.** No file under `src/`,
   `src-tauri/src/`, or any asset that reaches the webview or the native window is modified;
   `eslint.config.js` is build-time lint config only and does not enter any bundle. No
   `pnpm tauri build`, no `scripts/ui-capture.sh`, no e2e run is required. **Prove the premise**
   rather than asserting it: `git diff --name-only` must show ZERO paths under `src/`,
   `src-tauri/src/`, `server/`, `test/`, or `infra/`.
6. **Doc fact-verification gate (replaces the UI gate for Tasks 2 and 3).** For each of
   `docs/KEYS.md`, `docs/RELEASE-MACHINE.md`, `docs/CHANNELS.md`, `docs/RELEASE.md`, produce an
   evidence list in the SUMMARY: one line per non-obvious factual claim -> the `file:line` or
   command output that proves it. Any claim that cannot be evidenced must be deleted or
   explicitly marked as an open question. Re-run the `security find-certificate` expiry reads at
   this point so the committed dates are the ones actually on the machine.
7. **Guard live-fire:** stage a synthetic `.planning/phases/999.x` deletion, confirm
   `scripts/check-planning-archive.sh` exits 1 with the remedy text, confirm
   `ALLOW_PHASE_DELETE=1` makes it exit 0, then `git reset` the synthetic staging. Confirm a
   normal commit is unaffected.
</verification>

<success_criteria>
- All 7 todo items are closed: (1) v1.6-v1.8 planning artifacts restored + archiving guarded,
  (2) `docs/KEYS.md`, (3) `docs/RELEASE.md` rewritten + CHANGELOG backfilled, (4) ESLint
  `no-restricted-imports`, (5) `docs/CHANNELS.md`, (6) `docs/RELEASE-MACHINE.md`,
  (7) invariants index on `verify-appstore-bundle.sh`.
- `.planning/milestones/v1.{6,7,8}-phases/` hold 66/74/65 files; `grep -r "D-52"` and
  `grep -r "T-20-01"` both resolve inside the working tree.
- A commit that deletes a phase dir without archiving it FAILS pre-commit (demonstrated).
- A `@tauri-apps/*` import outside `src/lib/platform/**` and a `BrowserRouter` import anywhere
  both FAIL `pnpm lint` (demonstrated with a throwaway probe); the unmodified tree passes.
- `docs/KEYS.md` contains zero secret values and states the minisign stranding rule in plain
  words; `docs/RELEASE.md` no longer contains the old regeneration advice.
- `extractChangelogSection(CHANGELOG.md, "1.0.1")` and `..."1.0.2"` both return non-empty.
- `scripts/verify-appstore-bundle.sh` diff is comment-only and `bash -n` clean.
- `git diff --name-only` shows ZERO paths under `src/`, `src-tauri/src/`, `server/`, `test/`,
  `infra/`. The decoder and its 19 tests are byte-unchanged.
- lint + tsc (root and server) + vitest all green; the harness gates in `<verification>` were
  RUN (not deferred) and their outcomes recorded in the SUMMARY.
</success_criteria>

<output>
After completion, create
`.planning/quick/260808-kfs-operational-hardening-restore-v1-6-v1-8-/260808-kfs-SUMMARY.md`.

It must record: the restored file counts per milestone archive; the guard's live-fire result;
the lint-probe error count; the per-doc fact-verification evidence lists (step 6); the explicit
N/A justification for the UI gate with the `git diff --name-only` proof; and the outcomes of
`/simplify`, `/code-review xhigh` and `/codex:adversarial-review`.

Then mark the todo done: move
`.planning/todos/pending/2026-07-06-operational-hardening-architecture-review-fix-list.md`
to `.planning/todos/done/` (or the repo's existing convention — check the directory layout
first) and add a one-row entry to the `.planning/STATE.md` quick-task table following the shape
of the existing rows.
</output>
