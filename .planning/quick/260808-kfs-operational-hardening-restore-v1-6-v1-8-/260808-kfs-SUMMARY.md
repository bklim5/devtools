---
phase: quick/260808-kfs
plan: 01
subsystem: operations / documentation / repo hygiene
tags: [operational-hardening, planning-archive, trust-anchors, release-docs, eslint-invariants, secret-scanning]
requires: []
provides:
  - ".planning/milestones/v1.{6,7,8}-phases/ — 205 restored planning artifacts (D-xx/T-xx greppable in-tree)"
  - "scripts/check-planning-archive.sh — blob-identity pre-commit archive guard"
  - "scripts/check-doc-secrets.sh — staged-diff secret scanner"
  - "eslint.config.js — mechanical platform-seam + HashRouter invariants (5 bypass classes)"
  - "docs/KEYS.md, docs/RELEASE-MACHINE.md, docs/CHANNELS.md, rewritten docs/RELEASE.md"
  - "CHANGELOG.md [1.0.1]/[1.0.2] backfill"
affects: [lefthook.yml, CLAUDE.md, scripts/verify-appstore-bundle.sh]
tech-stack:
  added: []
  patterns:
    - "pre-commit guards as bash + git plumbing (no new deps)"
    - "ESLint no-restricted-imports PLUS no-restricted-syntax to close import-style bypasses"
    - "diff-content vs diff-structure disambiguation via --output-indicator-new"
key-files:
  created:
    - scripts/check-planning-archive.sh
    - scripts/check-doc-secrets.sh
    - docs/KEYS.md
    - docs/RELEASE-MACHINE.md
    - docs/CHANNELS.md
    - .planning/milestones/v1.6-phases/ (66 files)
    - .planning/milestones/v1.7-phases/ (74 files)
    - .planning/milestones/v1.8-phases/ (65 files)
  modified:
    - docs/RELEASE.md (rewrite)
    - CHANGELOG.md
    - eslint.config.js
    - lefthook.yml
    - CLAUDE.md
    - scripts/verify-appstore-bundle.sh (comment-only)
decisions:
  - "The historical note about the empty v1.0.1/v1.0.2 release notes lives in the CHANGELOG HEADER, not inside the [1.0.1] section — quoting the placeholder inside the section would have made extractChangelogSection return a body that still contains it."
  - "check-doc-secrets.sh re-labels diff line markers rather than parsing the default '+' form: content and structure must be disjoint or the parser can be steered."
metrics:
  duration: ~1h25m
  tasks: 3
  commits: 6
  completed: 2026-08-08
---

# Quick Task 260808-kfs: Operational Hardening — Restore v1.6–v1.8, Trust-Anchor Docs, Mechanical Invariants

All seven remaining repo-side items from the 2026-07-06 architecture review are closed:
the deleted decision ledger is back in the working tree and mechanically protected, the
four missing/dangerous reference docs exist and are fact-checked, and the two most
load-bearing prose invariants now fail `pnpm lint`.

## Task outcomes

### Task 1 — restore + archive guard + mechanical invariants (3 commits)

**1a — restore (`d8e3a192`).** The 15 phase directories deleted by `9fcbbd9d` were restored
from `9fcbbd9d^` by explicit name (never a wholesale checkout of `.planning/phases/`) and
`git mv`-ed into `.planning/milestones/v1.{6,7,8}-phases/`.

**BLOB-IDENTITY PROOF (the real gate):** for all 15 directories the staged
`(relpath, blob-hash)` set equals the `9fcbbd9d^` set — **205 rows on each side, `diff -u`
empty**. File counts 66/74/65 agree, as a smoke test only. `.planning/phases/` still holds
exactly the seven `999.*` backlog dirs and nothing else. `grep -rl "D-52"` and
`grep -rl "T-20-01"` both resolve inside the working tree
(`.planning/milestones/v1.6-phases/20-purchase-pipeline/20-01-{PLAN,SUMMARY}.md`).

**1b — archive guard (`ee7c9247`).** `scripts/check-planning-archive.sh` matches **per file
and per blob hash**. Live-fired, all three cases, with a `git reset` after each:

| Case | Setup | Result |
|---|---|---|
| (i) NO ARCHIVE | staged `.planning/phases/999.2-ci-integration/.gitkeep` deletion, no archive add | exit **1**, "NO ARCHIVE" + the remedy block |
| (ii) CONTENT MISMATCH | same deletion + an add at `.planning/milestones/v9.9-phases/999.2-ci-integration/.gitkeep` with different bytes | exit **1**, "CONTENT MISMATCH", both hashes printed (`e69de29b…` deleted vs `4395325e…` archived) |
| (iii) real `git mv` | `git mv` of the same file into the archive | exit **0** |

`ALLOW_PHASE_DELETE=1` bypassed (i) and (ii) with a one-line notice. `--no-renames` was
confirmed load-bearing: the raw output for case (iii) shows a full-hash `D` line, which the
default rename detection would have collapsed into a single `R100` line with no `D` at all —
making the guard pass vacuously.

Wired into `lefthook.yml` pre-commit as a fourth parallel command; it ran on every
subsequent commit in this task (`✔️ archive-guard`, 0.02–0.38 s), which is itself the
evidence it works. `CLAUDE.md` records the archive-not-delete rule and the override.

**1c — ESLint (`d06a0276`).** `no-restricted-imports` **plus** `no-restricted-syntax`.
All five bypass classes fired, each with its own throwaway probe, each probe then deleted:

| # | Class | Probe | Rule that fired |
|---|---|---|---|
| 1 | static `@tauri-apps` import | `import { getVersion } from "@tauri-apps/api/app"` | `no-restricted-imports` |
| 2 | static `BrowserRouter` import | `import { BrowserRouter } from "react-router-dom"` | `no-restricted-imports` (+ `no-restricted-syntax`) |
| 3 | dynamic import | `import("@tauri-apps/api/window")` | `no-restricted-syntax` |
| 4 | `require` | `require("@tauri-apps/api")` | `no-restricted-syntax` |
| 5 | namespace member access | `import * as RR …; RR.BrowserRouter` | `no-restricted-syntax` (+ `no-restricted-imports`) |

Seam-scoped re-runs inside `src/lib/platform/` behaved as designed: classes 1, 3 and 4 are
**silent** there (the seam is the only legal `@tauri-apps` importer), class 5 **still fires**
(the router restriction is re-declared, not switched off).

`pnpm lint` on the unmodified tree exits **0** — no real file trips either rule, confirming
the audit. `git status` was clean of every probe file before committing.

### Task 2 — three new reference docs + the invariant index (1 commit, `82581f59`)

The secret scanner was written **first**, before a line of doc prose was staged.

- **`docs/KEYS.md`** — 7 sections: the one rule, a 9-row anchor inventory (A1–A9), per-anchor
  loss consequences, per-anchor rotation procedures, the expiry calendar, backup/restore-test
  status, and the CI custody decision for backlog 999.2. States in plain words that
  regenerating the minisign keypair **strands every install permanently**, and gives the only
  safe migration (a transitional release signed with the OLD key carrying the NEW pubkey,
  plus a multi-week adoption wait). Cross-links the RUNBOOK fingerprint table; does not
  duplicate it.
- **`docs/RELEASE-MACHINE.md`** — toolchain, hand-restored files, the four keychain
  identities, auth sessions, and a five-step smoke test. Flags
  `src-tauri/embedded.provisionprofile` as gitignored **and in no backup**.
- **`docs/CHANNELS.md`** — a 22-row dimension × channel × enforcing-artifact matrix plus the
  three call-outs: the capability silent-drop trap, `--no-default-features`, and e2e running
  on the direct overlay only.
- **`scripts/verify-appstore-bundle.sh`** — a comment-only invariant index (I-01…I-14,
  S-01…S-03) keyed to the enforcing `assert_*`/`selftest_*` function and its real D/T
  identifier (`[-]` where the existing prose names none), plus a pointer to CHANNELS.md.

### Task 3 — RELEASE.md rewrite + CHANGELOG backfill (1 commit, `ea56bb9e`)

`docs/RELEASE.md` now leads with the real three-command flow, documents both drivers'
ordered pipelines and safety invariants, the `.env`/`CARGO_TARGET_DIR`/lefthook preflight
reality, the DST-02 round-trip gate, rollback-by-republish (including the assets-landed-but-
manifest-did-not case), update-host migration, and the two colliding tag schemes. The old
fleet-stranding regeneration advice is **deleted** and replaced by a KEYS.md pointer; the
hand-authored flow survives only as a fenced recovery appendix; the per-arch caveat, the
"both are currently 0.2.0" line and the CI-deferred framing are gone.

`CHANGELOG.md` `[1.0.1]` and `[1.0.2]` carry real notes;
`extractChangelogSection` returns 17 and 3 lines respectively, neither containing the
placeholder. Nothing at or below `[0.4.1]` was touched (0 diff lines matching prior
versions); no git tag was created, moved or deleted (19 tags before and after).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] A scan hole in the secret scanner I wrote in this task (`cd5d7447`)**

- **Found during:** the post-Task-3 self-review pass.
- **Issue:** the scanner parsed the default unified diff, where an added line whose text
  begins with `++ ` is emitted as `+++ …` — byte-identical to a file header. The parser
  therefore treated it as a header, re-pointed (or cleared) the current path, and **skipped
  every following added line**. Reproduced: a `RESEND_API_KEY=re_…` line placed after a line
  reading `++ /dev/null` passed the gate cleanly. A secret scanner with a steerable parser is
  worse than none, because it is trusted.
- **Fix:** pass `--output-indicator-new='>' --output-indicator-old='<'
  --output-indicator-context='='` so diff **content** and diff **structure** are disjoint —
  an added line is always `>`-prefixed, a real header always starts with `+++ `.
- **Verification:** the hole case now fires (with the correct line number); all 10 rules
  still fire on the all-rules probe; the negative probe (migration prose, short commit shas,
  placeholder assignments) stays clean; shellcheck clean. Every doc line added by this task
  was then re-scanned with the fixed rules — **830 added lines, 0 findings on all 10 rules**.
- **Files:** `scripts/check-doc-secrets.sh`. **Commit:** `cd5d7447`.

**2. [Plan-text adjustment] CHANGELOG historical note relocated to the file header**

The plan offered "under `[1.0.1]` (or in the file header)". Placing it under `[1.0.1]`
required quoting the `_Nothing yet._` placeholder, which made the plan's own verification
assertion (`section must not include "Nothing yet"`) fail — correctly, since
`extractChangelogSection` would then return a body containing it. The note moved to the
header, where it is outside every version section. Content unchanged.

No Rule 2, Rule 3 or Rule 4 deviations. No architectural decisions were required.

## Secret-scanner evidence

| When | Command | Result |
|---|---|---|
| Self-test, all rules | staged `docs/__secret-probe.md` with one line per rule | exit **1**, all **10** rules named: `pem-header`, `env-assignment`, `long-b64`, `long-hex`, `apple-p8`, `github-token`, `resend-key`, `minisign`, `healthcheck`, `r2-endpoint` |
| Self-test, false positives | "migration"/"migrating" prose, `9fcbbd9d`, a 40-char sha, `APPLE_API_KEY=<your-key-id>`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=`, NAME-only key lists, R2 bucket prose | exit **0**, clean |
| **Before the Task 2 commit** | `bash scripts/check-doc-secrets.sh docs/` | **exit 0** — "clean (501 added lines scanned)" |
| **Before the Task 3 commit** | `bash scripts/check-doc-secrets.sh docs/RELEASE.md CHANGELOG.md` | **exit 0** — "clean (329 added lines scanned)" |
| Post-fix retro-scan | all 10 rules replayed over the whole task's doc diff (`17617e00..HEAD`) | **830 added lines, 0 findings** |

No path allowlist was added and no rule was deleted or loosened. The one narrowing recorded
in the script header (`apple-p8` anchored to a ≥20-char base64 tail) was designed in from the
start so the docs' legitimate "migration" prose cannot be used to argue the rule loose.

## Doc fact-verification evidence (gate 6)

Every non-obvious claim traces to something read on 2026-08-08. Selected load-bearing ones:

**docs/KEYS.md**
- minisign public key compiled in → `src-tauri/tauri.conf.json:52`; endpoint → `:53-55`
- Keygen Ed25519 public key compiled in → `src-tauri/src/license/config.rs:58`
- TTL 30 / renew-ahead 7 / grace 7 → `config.rs:93,98,103` (so decay ≤ 37 days, **not** the
  review's assumed 30+7 without checking)
- `.env` key names → `.env.example:8-19`; `.p8` present → `ls ~/.appstoreconnect/`
- minisign keypair present → `ls ~/.tauri/` (`devtools.key`, `devtools.key.pub`)
- 4 identities + expiries → `security find-identity -v` and `security find-certificate -c
  "<CN>" -p | openssl x509 -noout -enddate`: **2027-02-01**, **2027-06-22**, **2027-06-22**,
  **2027-06-22** (the two the plan left for the executor were read, not assumed)
- provisioning profile expiry **2027-06-22** → `security cms -D -i
  src-tauri/embedded.provisionprofile | plutil -extract ExpirationDate raw -`; gitignored →
  `.gitignore:80`; present → `ls -la`
- backup secret locations → `infra/keygen/RUNBOOK.md:304-320`; fingerprint table → `:664-695`

**docs/RELEASE-MACHINE.md**
- `packageManager: pnpm@11.5.0`, `prepare: lefthook install` → `package.json`
- `.env` sourced without printing → `scripts/build.sh:44-52`
- identity auto-detection by name → `build-appstore-bundle.sh:45`, `build-appstore-pkg.sh:93,104`
- profile path → `build-appstore-pkg.sh:64`
- releases repo + `--repo` (not a git remote) → `build-and-publish.mjs:76`, `git remote -v`
- `--dry-run` is a zero-side-effect short-circuit → `build-and-publish.mjs:13-29`, and
  **run live**: it aborted at the first preflight ("signing env missing …") with no build

**docs/CHANNELS.md**
- every matrix row cites the config/script/line it came from; all four Tauri configs,
  `capabilities/default.json`, both entitlements plists, `Cargo.toml:114-133`,
  `lib.rs:11-17`, `vite.config.ts:22,34`, `channel.ts:13-14`,
  `src/lib/entitlements/resolve.ts:27,42,83-84`, and the `package.json` scripts were read
- the `--no-default-features` position after `--` → `build-appstore-bundle.sh:127-131`
- e2e runs on the direct overlay → `package.json` `tauri:dev:e2e`

**docs/RELEASE.md**
- both drivers' pipelines quoted from their header comments
  (`bump-and-tag.mjs:11-24`, `build-and-publish.mjs:13-29`)
- arg grammar `patch|minor|major [--dry-run]` → `bumpPlan.ts:23,41-69`; allowlist →
  `bumpPlan.ts:167-205`; publish flags → `publishPlan.ts:21,60-75`
- recovery text → `renderPublishRecovery` (`publishPlan.ts:390-405`)
- round-trip gate wording → `build-and-publish.mjs:514-523`
- tag reality → `git tag` (19) and `git ls-remote --tags origin` (network available):
  pushed = `v0.2.2 v0.3.0 v0.3.1 v0.3.3 v0.4.0 v0.4.1 v1.0.1 v1.0.2`. **New finding beyond
  the plan: `v0.3.2` exists locally but was never pushed** — recorded in the doc. All ten
  `vX.Y` milestone tags are local-only, as project memory says.
- 284 commits between `v0.4.1` and `v1.0.1` → `git rev-list --count`

Every claim that could not be evidenced was cut. Where the review disagreed with the tree,
the tree won (the R2 backup + restore validation are DONE, not a gap; `v1.0.1`/`v1.0.2` have
shipped).

**CHANGELOG `[1.0.1]` bullets** were derived from `.planning/milestones/v1.8-ROADMAP.md` and
`v1.9-ROADMAP.md` plus `git log --oneline v0.4.1..v1.0.1`, and restricted to what a
**direct-channel** user actually sees: two new tools (13 total), the Prettify|Minify + width
retrofit on JSON/XML, protobuf-first ordering, the sidebar-scroll fix, the titlebar-theme
fix, and the App Store edition explicitly labelled *(App Store edition)*.

## Harness gates

| Gate | Status |
|---|---|
| 1. `/simplify` | **Run as a manual self-review pass, not the slash command** (a subagent cannot invoke slash commands). Both new scripts are **shellcheck-clean**; the shared `BROWSER_ROUTER_IMPORT` / `ROUTER_SELECTORS` / `TAURI_SELECTORS` constants are defined once and reused by both ESLint blocks (no copy-paste drift); doc de-duplication verified — the RUNBOOK's sha256 fingerprint table is cross-linked and **not** duplicated (the `long-hex` replay returns 0), and rotation advice lives only in KEYS.md while RELEASE.md points at it. **The real `/simplify` still owes a pass — flagged for the orchestrator.** |
| 2. `/code-review xhigh` | **NOT RUN — cannot be invoked from a subagent.** Flagged for the orchestrator. The self-review it partially substitutes for did find one real bug (the scanner parse hole, Rule 1 above). |
| 3. `/codex:adversarial-review` | **NOT RUN — cannot be invoked from a subagent.** Flagged for the orchestrator. This is the gate that matters most here: it should challenge the DOC CLAIMS (does the described pipeline match the scripts? is the rotation advice actually safe? does the channel matrix match the confs?) and the guard/lint failure modes. |
| 4. Unit gate | **GREEN.** `pnpm lint` 0 errors (4 pre-existing react-refresh warnings, out of scope), `pnpm tsc --noEmit` 0, `pnpm tsc --noEmit -p server/webhook/tsconfig.json` 0, `pnpm vitest run` **1434/1434** across 115 files. Ran on every commit via lefthook. The decoder and its 19 tests are byte-unchanged (no file under `src/` was touched at all). `cargo test` unaffected — zero Rust changes. |
| 5. Real-webview UI verification | **N/A, premise proven not asserted.** `git diff --name-only 17617e00..HEAD -- src/ src-tauri/src/ server/ test/ infra/` returns **0 paths**. `eslint.config.js` is build-time lint config and enters no bundle; `scripts/verify-appstore-bundle.sh` changed by comment lines only. No `tauri build`, no `ui-capture.sh`, no e2e run was required. |
| 6. Doc fact-verification | **DONE** — see the evidence lists above. Certificate expiries were re-read at this point, so the committed dates are the ones on the machine. |
| 7. Archive-guard live-fire | **DONE** — three cases + the `ALLOW_PHASE_DELETE` bypass, table above. |
| 8. Secret-scanner live-fire | **DONE** — probe fired all 10 rules, no false positives, exit 0 before both docs commits, table above. |
| 9. Lint bypass-class live-fire | **DONE** — five classes + four seam-scoped re-runs, table above. |

**Scope fence held:** the only non-doc, non-planning, non-script file modified is
`eslint.config.js`. `scripts/verify-appstore-bundle.sh` is comment-only — asserted
mechanically (the diff contains no non-comment `+`/`-` line) and `bash -n` clean, with every
`assert_*`/`selftest_*` function represented in the index.

## Commits

| Hash | Type | What |
|---|---|---|
| `d8e3a192` | docs | restore 205 v1.6–v1.8 planning files, byte-identical to `9fcbbd9d^` |
| `ee7c9247` | feat | `check-planning-archive.sh` + lefthook wiring + CLAUDE.md rule |
| `d06a0276` | feat | ESLint seam + HashRouter invariants (5 bypass classes) |
| `82581f59` | docs | KEYS.md, RELEASE-MACHINE.md, CHANNELS.md, `check-doc-secrets.sh`, invariant index |
| `ea56bb9e` | docs | RELEASE.md rewrite + CHANGELOG `[1.0.1]`/`[1.0.2]` backfill |
| `cd5d7447` | fix | close the secret scanner's diff-parse scan hole |

## Follow-ups

1. **Run gates 1–3** (`/simplify`, `/code-review xhigh`, `/codex:adversarial-review --wait
   --scope working-tree`) at the orchestrator level, all subagents on Opus per CLAUDE.md.
   Point the adversarial pass at the doc claims, not just line bugs.
2. **`src-tauri/embedded.provisionprofile` is in no backup** (KEYS.md A9). Owner action:
   put a copy in the password manager.
3. **CI key-custody decision** (KEYS.md § 7) must be made before backlog 999.2 starts.
4. **The direct channel has no automated capability-overlay check** (CHANNELS.md call-out 1);
   its only backstop is the manual updater round-trip. Related pending todo:
   `2026-08-07-appstore-channel-acl-e2e-gate.md`.
5. **Milestone tag prefixing** (`milestone/vX.Y`) recommended in RELEASE.md § 7 — not applied
   to existing tags.

## Self-Check: PASSED

All created files verified present on disk; all six commit hashes verified in `git log`.

---

# Remediation pass — review findings (2026-08-08)

Applied after `/simplify`, `/code-review xhigh` and `/codex:adversarial-review` ran at the
orchestrator level over `17617e00..cd5d7447`. Five commits, all lefthook-clean, none pushed.
Scope fence held: `git diff --name-only 17617e00..HEAD -- src/ src-tauri/src/ server/ test/
infra/` returns **0 paths**.

| Commit | Scope |
|---|---|
| `42e141dd` | SECURITY — redact the leaked minisign passphrase; honest history-exposure note |
| `51a802d5` | `check-doc-secrets.sh` — fail closed, lefthook wiring, rule redesign (B1–B5) |
| `c68a98dc` | `check-planning-archive.sh` — scope, remedy text, set algebra (C1–C5) |
| `9c49ec3d` | `eslint.config.js` — rescope router selectors to real usage (D) |
| `d02b7b29` | docs/CHANGELOG — sentinel, single-owner de-duplication (E1–E7) |

## Per-finding outcome

| Item | Finding | Outcome | Evidence |
|---|---|---|---|
| **A** | `architecture-review-2026-07-06.md:28` quoted the literal `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` value | **FIXED** | Value → `<redacted — see password manager>`; finding text unchanged. Full-tree staged scan of `docs/ CHANGELOG.md README.md infra/`: **clean, 7526 lines**. `docs/KEYS.md` § 1a records the exposure honestly (introduced `5b90a60a`, redacted `42e141dd`, **still in git history**, blast radius, two open owner decisions) instead of implying the repo is clean |
| **B1** | scanner not wired in; "enforced mechanically" was aspirational | **FIXED** | `lefthook.yml` `pre-commit: doc-secrets`; default pathspec widened to `docs/ CHANGELOG.md README.md infra/`. Ran green (`✔️ doc-secrets`) on all 4 subsequent commits |
| **B2** | fail-open on git errors; no repo-root anchor; binaries unscanned | **FIXED** | `cd $(git rev-parse --show-toplevel)`; diff captured to a file (process substitution discarded git's status); every git/grep failure → FATAL exit 2. Binary adds refused unless magic bytes **and** extension agree it is an image. Probes: outside-worktree → 2, malformed pathspec → 2, `.p12` in `docs/` → 1, key material renamed `.png` → 1, real screenshot → 0, invoked from `docs/` → still resolves |
| **B3** | F7 placeholder suppression was per-line; F10 no spaces around `=` | **FIXED** | Per-MATCH via `grep -noE`. `APPLE_API_KEY=<your-key-id> and RESEND_API_KEY=re_live…` fires on the second. `MY_SECRET = hunter2hunter2hunter2` and `LS_WEBHOOK_SECRET  =  "…"` both fire |
| **B4** | `long-hex` subsumed; `long-b64` false-positive on paths | **FIXED** | `long-hex` removed (`[0-9a-f]` ⊂ base64 alphabet). `long-b64` gains three **shape** exemptions, no file allowlist: path-shape (optional leading/trailing `/`, 3+ letter-initial ≤16-char segments, no `+`/`=`), <32-char payload, and a ±3-line public-value context (`sha256`/`fingerprint`/`pubkey`/`public key`). Proven: `…bundle/macos/TinkerDev` clean; a real 44-char base64 secret fires **with and without `+`/`=`**; the RUNBOOK's sha256 table and its two-line Ed25519 pubkey both clean |
| **B5** | prove the suite again | **DONE** | 40-case probe matrix, all PASS (9 rules fire, 18 known-FP negatives, F7/F10, binary, fail-closed, subdirectory). Full-tree scan clean. Green in lefthook on this pass's own commits |
| **C1** | F12 intra-`phases/` renames blocked | **FIXED** | Blob-only match against same-blob adds elsewhere under `.planning/phases/`. Phase renumber via `git mv` → exit 0; single-file move → exit 0; renumber **that also rewrites** the file → still exit 1 |
| **C2** | F13 archive adds landing as MODIFY missed | **FIXED** | Archive side collected with `--diff-filter=AM`. Probe: archive written over an already-tracked path → exit 0 |
| **C3** | F14 guard oversold as preventing history loss | **FIXED** | Script header gained a "WHAT IT DOES *NOT* COVER" block (in-place M/T rewrites out of scope by design; nothing about `milestones/` after archiving; `ALLOW_PHASE_DELETE` bypasses). `CLAUDE.md` keeps the rule, drops the mechanism/env-var restatement, and says the guard catches un-archived **deletions only** |
| **C4** | F6 remedy command missing `<version>` | **FIXED** | `gsd-tools.cjs:690` passes `args[2]` as the version and `milestone.cjs:90` errors without it — so `--archive-phases` was being parsed **as** the version. Corrected to `gsd-tools milestone complete <vX.Y> --archive-phases` in the script's REMEDY block and CLAUDE.md; the probe asserts the corrected string is in the output |
| **C5** | eval indirection, per-file `sed`, O(dels×adds) grep | **FIXED** | `eval` gone (D-side sha = field 3, A-side = field 4, read directly); `sed` replaced by parameter expansion (`${path#prefix}`, `${key#*-phases/}`); grep loops replaced by `sort`/`comm`/`join` under `LC_ALL=C`. Also made git failures fatal. **12-case** live-fire matrix all PASS, incl. spaces-in-path (archive + report) and a mixed good-archive-plus-bare-delete batch |
| **D** | F15 bare `Identifier` selector over-fires + triple-reports | **FIXED** | One owner per class. `no-restricted-imports` owns acquisition (widened to all three names, and to `react-router` + `history`, since the Identifier selector had been silently covering `createBrowserRouter`/`createBrowserHistory`); `no-restricted-syntax` owns runtime reach-around (`MemberExpression` dotted **and** computed, `JSXIdentifier`, bare factory `CallExpression`). 25-case matrix: 5 original classes + 6 further reach-arounds + **6 new negatives** (local var, parameter, `vi.mock` object key, object-literal key, type alias, `vi.doMock` string arg — all silent) + single-report assertions + 5 seam-scoped re-runs |
| **E1** | F5 `- _Nothing yet._` sentinel destroyed | **FIXED** | Sentinel restored as the sole `[Unreleased]` body. `tsx` round-trip proves the contract: body `=== UNRELEASED_PLACEHOLDER`, `appendUnreleasedEntry` **replaces** it, `promoteUnreleased` carries the notes and re-emits it; `extractChangelogSection` still non-empty for 1.0.1 (17 lines) and 1.0.2 (3 lines). Post-mortem prose moved out of `CHANGELOG.md` entirely → `RELEASE.md` § 7 |
| **E2** | F3 recovery build missing channel pins | **FIXED** | § 9 step 1 is now `VITE_CHANNEL=direct pnpm tauri build --target universal-apple-darwin --config src-tauri/tauri.direct.conf.json`, matching `build-and-publish.mjs`, with both failure modes spelled out (silent capability drop; ambient `VITE_CHANNEL=appstore` compiling store copy into the DMG) |
| **E3** | F4 pubkey↔private-key pairing check deleted | **FIXED** | New `RELEASE.md` § 3 subsection, **executed verbatim on 2026-08-08**: `pnpm tauri signer sign` a scratch file (key + passphrase from env, never argv), then compare the 8-byte signing key id against the one inside the committed `plugins.updater.pubkey`. Result: both `9ab6e166ef9a8f97` → `PAIRED`, rc 0. Key IDs are public (they are in the committed pubkey's own comment) |
| **E4** | simplify#1/#2 three copies of the invariant enumeration | **FIXED** | The script's INVARIANT INDEX (I-01…I-14, S-01…S-03, D/T ids kept) is the single enumeration. The (a)-(j) prose is replaced by the four design decisions the index cannot express; `CHANNELS.md` call-out 3 points at the index; `CHANNELS.md`'s pointer under the matrix kept. Diff remains **COMMENT-ONLY** (asserted: zero non-comment `+`/`-` lines vs `17617e00`; 85 insertions / 73 deletions) and `bash -n` clean; all 11 `assert_*`/`selftest_*` functions appear in the index |
| **E5** | simplify#3/#4/#5 duplicated facts | **FIXED** | `CARGO_TARGET_DIR`: `RELEASE.md` § 3 owns the absolute-path rule, `CHANNELS.md` owns the per-channel values, `RELEASE-MACHINE.md` points at § 3. `RELEASE.md` § 8 collapses to a `KEYS.md` pointer. Signing CNs: `KEYS.md` § 5 owns the exact strings; `RELEASE-MACHINE.md` keeps roles + the `SIGN_ID`/`INSTALLER_ID` lookup symbols |
| **E6** | simplify#13/#24 narrative bloat | **FIXED** | Both guard scripts' incident narratives are ≤10 lines (archive guard 8, scanner 5 + an 8-line scan-hole note). All four docs' provenance blockquotes reduced to a verified-date stamp; plan and finding IDs dropped |
| **E7** | simplify#23 raw line numbers in CHANNELS.md | **FIXED** | All 32 `path:line` citations converted to symbol / function / config-key anchors (`SIGN_ID`, `INSTALLER_ID`, `PROFILE`, `run_channel`, `IS_APPSTORE`, `baseFromLicense`/`baseFromStoreKit`, `bundle.macOS.entitlements`, `app.security.capabilities`, `[features]`, …). `grep -nE '\.(md\|ts\|tsx\|json\|sh\|mjs\|toml\|rs):[0-9]'` → **none** |

Nothing was judged factually wrong; all items were applied.

## Verification

| Gate | Result |
|---|---|
| `bash -n` + `zsh -n` + `shellcheck -S style` | **clean** on `check-doc-secrets.sh` and `check-planning-archive.sh`; `bash -n` clean on `verify-appstore-bundle.sh` |
| `pnpm lint` | **0 errors** (4 pre-existing react-refresh warnings, out of scope) |
| `pnpm tsc --noEmit` (root + `server/webhook`) | **0 errors** |
| `pnpm vitest run` | **1434/1434** across 115 files |
| lefthook on this pass's commits | `archive-guard` ✔️ and `doc-secrets` ✔️ on all 5 |
| Scanner probe matrix | **40/40 PASS** |
| Archive-guard live-fire matrix | **12/12 PASS** |
| ESLint probe matrix | **25/25 PASS** |
| Full-tree staged secret scan (`docs/ CHANGELOG.md README.md infra/`) | **clean, 7526 added lines** |
| CHANGELOG `tsx` assertion | 1.0.1 / 1.0.2 non-empty; sentinel contract round-trip green |
| `verify-appstore-bundle.sh` comment-only | **asserted** vs `17617e00` |
| Scope fence | `git diff --name-only 17617e00..HEAD -- src/ src-tauri/src/ server/ test/ infra/` → **0 paths**; 19 git tags before and after |

**Real-webview UI gate: still N/A**, premise re-proven by the scope-fence line above. No file
reaching the webview or the native window changed; `eslint.config.js` is build-time only.

## Corrections to earlier claims in this document

- The commit message on `c68a98dc` says "13-case live-fire matrix". The matrix has **12**
  cases. The count is the only error; every case listed passes.
- The Harness-gates table above records `/simplify`, `/code-review xhigh` and
  `/codex:adversarial-review` as NOT RUN. They have since been run at the orchestrator
  level; this section is the result of applying their findings.

## Still open (owner decisions, not code)

1. **A1 passphrase remains in git history** (`docs/KEYS.md` § 1a). Working-tree redaction
   does not remove it. Decide: re-encrypt the existing minisign key under a new passphrase
   with `minisign -C` (does **not** strand the fleet — the public key is unchanged), and/or
   a `git filter-repo` history rewrite plus force-push (invalidates every clone). Neither
   has been done.
2. `src-tauri/embedded.provisionprofile` is still in no backup (`KEYS.md` A9).
3. The CI key-custody decision (`KEYS.md` § 7) is still unmade.
4. The direct channel still has no automated capability-overlay check; its only backstop is
   the manual updater round-trip (`CHANNELS.md` call-out 1).

---

# Closing round — Codex final pass (2026-08-08), commit `855aa797`

Three items, one commit, no scope growth. Not pushed.

| # | Finding | Outcome | Evidence |
|---|---|---|---|
| **1** | **Rename bypass.** With rename detection on, a tracked file `git mv`-ed INTO a scanned path is reported as a content-free `R100`, and a binary one is dropped by `--diff-filter=AM` | **FIXED** | Both git calls now force `--no-renames`; the binary prepass filter is `--diff-filter=AMRC` (R/C are belt-and-braces — they cannot appear while `--no-renames` holds). Counterfactual on identical scratch repos, `scripts/notes.md` → `docs/notes.md`: **pre-fix rc 0** ("no staged additions — nothing to scan"), **fixed rc 1** (`[env-assignment] docs/notes.md:2 :: PASSWORD=realvalue12345`). Same for `scripts/id.p12` → `docs/id.p12`: **pre-fix rc 0**, **fixed rc 1** ("unscannable BINARY … docs/id.p12"). Note the bypass needs BOTH sides inside the pathspec — which widening to `scripts/` (item 3) newly created |
| **2** | **Public-context exemption too broad** — a ±3-line window around `sha256`/`fingerprint`/`pubkey` exempted anything in a 7-line neighbourhood | **FIXED** | `context_says_public` → `is_published`, structural only: **(a)** the match is exactly **64 lowercase hex** (a sha256 digest, one-way) AND is labelled `sha256`/`fingerprint` on its own line or by the header of the markdown table it sits in (the header walk climbs only *contiguous table-row lines of the same file* and stops at the first non-row, so it cannot reach into prose); **(b)** the line — or the line **immediately above**, the wrapped-value case — labels it a public key. Counterfactual: a 44-char base64 secret with "public key" 3 lines away was **clean under the old rule (rc 0)** and now **fires** (`[long-b64] docs/a.md:4`). Re-proven clean: the RUNBOOK sha256 table (both rows, one below the `|---|` rule), the wrapped Ed25519 pubkey, the same-line `ed25519 pubkey: MATCH (…)` line, `EXPECT_ED25519_PUBKEY=` |
| **3** | **Dishonest guarantee** in `docs/KEYS.md`; pathspec missing `scripts/` | **FIXED** | `KEYS.md` § 1 now keeps "no secret VALUE ever appears in this repository" as **the RULE**, and calls the scanner **partial mechanical support** with review as backstop, then states the exact surface (staged **additions** only, pathspec `docs/ CHANGELOG.md README.md infra/ scripts/`, client-side lefthook `pre-commit`) and five accepted residual risks: **commit/tag messages**, **client-hook bypass** (`--no-verify`, or no `lefthook install`; the remote is release-only so nothing re-checks), paths outside the pathspec, history (§ 1a), and shape-not-semantics (a low-entropy secret matches nothing). `lefthook.yml`'s comment says the same. Default pathspec widened to `scripts/` |

**Rule-shape fixes that widening to `scripts/` required** (no allowlist, no rule deleted):

- **`pem-header` narrowed** to a PRIVATE-key delimiter (`-{5}BEGIN[A-Z ]*PRIVATE KEY`) or any
  `-----BEGIN X-----` followed by 20+ base64 chars **on the same line** (a one-line paste). A bare
  `-----BEGIN` fired on `scripts/keygen-ce/spike.sh`'s `grep -q -- "-----BEGIN MACHINE FILE-----"`
  needle and would fire on every CERTIFICATE / PUBLIC KEY mention. Given up: a multi-line paste of a
  *non-private* PEM whose header line carries no base64 — its body is 41+ base64 chars, so `long-b64`
  still catches it on the next line (probe-pinned, not assumed).
- **`env-assignment` exempts a CODE right-hand side** — an identifier, optionally dotted, immediately
  followed by `(` (`process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(` in `build-and-publish.mjs`),
  the same class as the existing `$(…)`/`${…}` shell exemption. Probe-pinned that a `*_TOKEN` assigned
  a literal still fires.
- **Two patterns respelled so the file does not match itself** now that it scans `scripts/`:
  `-{5}BEGIN` and `untrusted[ ]comment:` — identical ERE semantics, different source bytes. Marked
  DO-NOT-SIMPLIFY in a SELF-SCAN NOTE.
- **Two of the scanner's own comments rewrote their prose** (they quoted a token-shaped literal and a
  literal value) — remedy #1 in the script's own header, applied to itself.

**One doc line changed to satisfy the tightened rule:** `infra/keygen/RUNBOOK.md`'s
`# MUST print:` became `# MUST print — account id | ed25519 public key:`, so the public key on the
line below is labelled where the structural rule looks. The value is unchanged.

Also corrected while in the file: the FAIL-CLOSED header claimed an unscannable binary exits **2**;
it exits **1**. Now stated correctly.

## Verification

| Gate | Result |
|---|---|
| Probe matrix (rebuilt, every case in a throwaway repo) | **49/49 PASS** — 16 positives (all 9 rules), 3 rename cases, 9 exemption cases (4 must-fire / 5 must-stay-clean), 18 negatives, 3 fail-closed/invocation |
| Counterfactual vs the pre-fix scanner | rename text **rc 0 → 1**, rename binary **rc 0 → 1**, ±3-window secret **rc 0 → 1** |
| Full-tree staged scan, `docs/ CHANGELOG.md README.md infra/` | **clean, 7526 lines** (unchanged from the last pass) |
| Full-tree staged scan, default pathspec **incl. `scripts/`** | **clean, 12541 lines**; `scripts/` alone **clean, 4989 lines** |
| `bash -n` + `zsh -n` + `shellcheck -S style` | **clean** |
| lefthook on this commit | `✔️ archive-guard` `✔️ doc-secrets` (clean, 219 added lines) `✔️ typecheck` `✔️ lint` (0 errors, 4 pre-existing warnings) `✔️ test` **1434/1434** |
| Scope fence | `git show --stat 855aa797` = 4 files: `scripts/check-doc-secrets.sh`, `docs/KEYS.md`, `lefthook.yml`, `infra/keygen/RUNBOOK.md`. Nothing under `src/`, `src-tauri/`, `server/`, `test/`. **Not pushed** |

**UI gate: N/A**, premise unchanged — no file reaching the webview or the native window was touched.

**Residual risks now written down** (`KEYS.md` § 1, script header): a private value written **on** a
line that says "public key" or directly under one still slips `long-b64`; `--no-verify` and an
uninstalled hook skip the gate entirely; commit and tag messages are never scanned.
