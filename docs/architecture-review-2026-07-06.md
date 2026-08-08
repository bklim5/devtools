# Architecture Review — 2026-07-06

Senior-architect structural review of the shipped TinkerDev project (6 milestones, ~20 phases, v1.9 audit passed 13/13). Read-only analysis; every claim below was verified against the working tree at commit `e9d85cec` on 2026-07-06. Written to be actionable by an agent with zero conversation history.

Scope note: this review deliberately skips style nits. Everything here is structural: what breaks, when it bites, cheapest mitigation.

---

## Executive summary

The codebase itself is in unusually good shape for a single-maintainer project: the "pure decision-core + thin shell" rule is actually followed (verified, not asserted — see F5), the capability seam is clean, the webhook is small and fully unit-tested, the release driver (`scripts/build-and-publish.mjs`) is a disciplined thin shell over unit-tested pure cores, and e2e coverage runs against the real WKWebView (27 specs in `test/e2e/`).

The risk is not in the code. It is concentrated in three places:

1. **Cryptographic roots of trust are single-copy with no backup or rotation runbook**, and the one doc that mentions key regeneration (`docs/RELEASE.md:56-58`) gives advice that would permanently strand the entire installed base.
2. **The release/support pipeline exists only on one laptop + one Hetzner VPS**, with the offsite database backup explicitly deferred (`infra/keygen/RUNBOOK.md` Step 2.2) and no rebuild-the-machine inventory.
3. **The decision ledger the code cites everywhere (D-xx / T-xx identifiers) was partially deleted from the tree**: commit `9fcbbd9d` ("docs: start milestone v1.9") removed the phase 18–30 planning artifacts (the licensing, settings, and App Store milestones — the most security-critical work) without archiving them under `.planning/milestones/`. Their definitions now exist only in git history and in the 242 KB rolling narrative of `.planning/STATE.md`.

A weaker model continuing this project today would most likely fail by (a) following the stale `docs/RELEASE.md` manual flow instead of `pnpm release:publish`, (b) conflating the two colliding git-tag schemes (release `v0.4.1` vs milestone `v1.8`), or (c) being unable to find what D-52 or T-20-01 mean.

---

## Structural findings (ranked)

### F1 — CRITICAL: single-copy trust anchors, no backup/rotation runbook, and actively dangerous regeneration guidance

**Evidence:**
- Updater minisign private key lives only at `~/.tauri/devtools.key` on the maintainer's laptop; its password is plaintext in the gitignored root `.env` (line 11: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD=<redacted — see password manager>`). The public half is pinned in `src-tauri/tauri.conf.json:52`.
- `docs/RELEASE.md:56-58`: *"If the keypair is ever regenerated, re-paste the new `~/.tauri/devtools.key.pub` contents into `pubkey` and commit — otherwise every update will fail signature verification."* This is incomplete to the point of being wrong: every **already-installed** app has the OLD pubkey compiled in. After regeneration, no existing install will ever accept another update — silent, permanent fleet stranding; users must manually re-download the DMG. Regeneration is a break-the-fleet operation, not a recovery path, and no doc says so.
- No backup instruction for the key exists anywhere (grep of `docs/`, `infra/`, `scripts/` for backup guidance around `devtools.key`: only the RELEASE.md lines above).
- Same class, licensing side: the Keygen CE account Ed25519 signing keypair lives only in the prod Postgres DB on one VPS. Its public half is compiled into every shipped binary (`src-tauri/src/license/config.rs:58`). `infra/keygen/RUNBOOK.md` Step 2.2 sets provider snapshots as the "phase-20 backup floor" and explicitly defers offsite `pg_dump` as "a documented deferred follow-up" — which never landed (nothing in `scripts/`, `infra/`, or the backlog `999.x` list covers it; backlog has CI, Windows port, tools — no backups).
- Apple notary `.p8` (`~/.appstoreconnect/AuthKey_5SC6V2WGQ5.p8`, referenced in `.env:14`) and the Developer ID / Mac Installer certs in the login keychain are also laptop-only.

**What breaks / when:** laptop disk failure, Hetzner account/box loss, or an accidental `keygen` DB wipe. Losing the minisign key ends the direct-channel update capability for all existing installs, forever. Losing the CE DB (which contains the Ed25519 keypair AND every license/machine record) ends activation, refresh, deactivation, and seat-release for every buyer — cached certs then decay to Free within ≤37 days (`config.rs:79-103`: TTL 30d + grace 7d). Recovery would require shipping a new binary — which depends on the updater key you may also have lost.

**Cheapest mitigation (≈1–2 hours total):**
1. Tonight: copy `~/.tauri/devtools.key` + password + `.p8` into a password manager / offline medium. Two independent copies.
2. Cron an offsite nightly `pg_dump` from the VPS (even `pg_dump | gpg | rclone` to object storage). Test one restore.
3. Write `docs/KEYS.md`: inventory of all trust anchors (minisign keypair, CE Ed25519 keypair, CE admin credentials/token, LS webhook secret, Resend key, Apple certs + `.p8` with expiry dates), what breaks if each is lost, and the correct rotation procedure for each. For the minisign key the honest procedure is: *there is no rotation without stranding; protect the key; a planned migration requires shipping a transitional version signed with the old key that carries the new pubkey.*
4. Fix `docs/RELEASE.md:56-58` to state the stranding consequence.

### F2 — HIGH: the entire release + support pipeline is one laptop, zero CI

**Evidence:** `docs/RELEASE.md:280`: *"CI release-automation … is a deferred future phase"*; backlog item `999.2-ci-integration` exists but is parked. `pnpm release:bump` / `release:publish` (package.json:17-20) run locally, depend on: `~/.tauri` key, `~/.appstoreconnect` `.p8`, keychain certs, `src-tauri/*.provisionprofile` (gitignored per `.gitignore` — present in the working tree but in no backup), local `gh auth`, rustup with both targets, and the `tinkerdev-box` SSH key for support operations (`infra/keygen/RUNBOOK.md` seat-release section).

**What breaks / when:** any laptop replacement or failure produces a multi-day scramble reconstructing an environment that exists nowhere as a checklist. Secondary: Apple Developer ID certs and the ASC API key will eventually expire with no documented renewal note or expiry calendar.

**Cheapest mitigation:** not CI (that's real work) — a one-page `docs/RELEASE-MACHINE.md` inventory: every file, keychain item, auth session, and provisioning profile the pipeline needs, where the canonical copy lives, and cert/key expiry dates. ~1 hour, converts a scramble into a checklist. CI (999.2) remains the durable fix; note that CI will need the signing key as a secret — decide the custody model in `KEYS.md` first.

### F3 — HIGH: `docs/RELEASE.md` is stale and contradicts the real pipeline — a weaker-model trap

**Evidence:** RELEASE.md (last touched 2026-06-21) documents the superseded manual flow: hand-authoring `latest.json` (§5), a **single-arch** `darwin-aarch64`-only manifest with universal builds *"deferred to the CI phase"* (Callout "Per-arch caveat", lines 234-240), and *"both are currently `0.2.0`"* (line 64). The actual pipeline since Phases 10/11 is `pnpm release:bump` + `pnpm release:publish` (`scripts/build-and-publish.mjs`): universal build, lipo assert, single-fresh-`.sig` glob, both platform keys via pure `buildLatestJson` (`src/lib/release/manifest.ts`), DMG notarise+staple+`spctl`, assets-before-manifest ordering, served-version curl verify. RELEASE.md mentions `release:publish` exactly once, in a key-path footnote (line 89). README.md and CLAUDE.md still route readers to docs as source of truth.

**What breaks / when:** the first time a future session (or the owner, months from now) "follows the runbook": a hand-written manifest, possibly single-arch, skipping the lipo/notary/ordering safety rails the script exists to enforce. The failure mode is precisely the class of error the script was built to prevent.

**Cheapest mitigation:** rewrite RELEASE.md around the two commands + preflight expectations + the manual round-trip gate (the text `build-and-publish.mjs:516-523` already prints), demote the manual steps to a "recovery appendix", and add the missing sections: rollback (revert-by-republish — currently only rendered at runtime by `renderPublishRecovery`) and update-host migration (see F4). ~2 hours.

### F4 — HIGH: service-continuity fuses are compiled into shipped binaries; no migration runbooks

**Evidence:**
- Updater endpoint compiled in: `src-tauri/tauri.conf.json:53-55` → `github.com/bklim5/devtools-releases/releases/latest/download/latest.json`. RELEASE.md:52-53 says "if you ever move it, update both URLs" — but omits the binding constraint: **a host move requires publishing a transitional release through the OLD endpoint while it still resolves**, or every existing install stops seeing updates.
- License host compiled in: `src-tauri/src/license/config.rs:28` → `license.tinkerdev.io`, no runtime override in release builds (by design, D-52). DNS is the only seam. Good news: it IS a DNS name on Cloudflare, so a box migration that restores the DB and re-points the A record is transparent. Bad news: that depends on the DB backup that doesn't exist (F1.2), and both CE and the webhook run on the single CX23 VPS (`infra/keygen/compose.yaml`), monitored only by free-tier UptimeRobot (`RUNBOOK.md` Step 8).
- Revocation exposure is well-engineered and documented in code (`config.rs:79-84`: worst case ≈37 days) — not a finding, noted for completeness.

**What breaks / when:** GitHub org/repo rename, a decision to move off GitHub Releases, VPS provider exit, or an extended box outage. Outage math: connected users renew ahead (7d window), so a box down for less than ~a week is invisible; beyond cert-remaining+7d, paying users silently drop to Free — a support-and-refund event.

**Cheapest mitigation:** two short runbook sections (in RELEASE.md and `infra/keygen/RUNBOOK.md` respectively): "moving the update host" (transitional-release requirement spelled out) and "restore the license box from backup" (snapshot restore + DNS repoint + smoke: `/v1/health`, one refresh round-trip). Depends on F1.2's backup existing.

### F5 — MEDIUM: architecture invariants are enforced by prose and comments, not machinery

**Evidence:** the good news first — the rules are actually being followed. Verified: zero `from "@tauri-apps/..."` imports outside `src/lib/platform/` (repo-wide grep; every hit elsewhere is a comment saying "never @tauri-apps"). The seam contract is stated in CLAUDE.md:41 and `docs/harness-and-decisions.md:53-54`. But `eslint.config.js` contains no `no-restricted-imports` rule; nothing mechanical rejects a violation. Same for: HashRouter-only (CLAUDE.md:37), registry-as-single-control-plane, "don't refactor `decoder.ts` or its 19 tests" (CLAUDE.md:39), tools layout-agnostic. The project's method has relied on the five-gate harness + adversarial review to hold the line — i.e., on agent discipline and on the harness config, which itself lives in gitignored `.claude/` (`.gitignore:30`) and user-global hooks, so a fresh clone has none of the enforcement.

**What breaks / when:** the first `/gsd-quick` or low-effort session that touches a tool. One direct plugin import compiles, passes tests (jsdom mocks won't notice), and quietly forks the seam. Six months later the "mobile/web door" and test-injection point the seam exists for (`harness-and-decisions.md:44-51`) are gone.

**Cheapest mitigation (~30 min):** ESLint `no-restricted-imports`: forbid `@tauri-apps/*` except under `src/lib/platform/**` (flat-config per-files override), and forbid `react-router-dom`'s `BrowserRouter`. Optionally a trivial vitest that hashes `decoder.ts` to make the "explicit approval" rule mechanical (update the hash = the approval act). These convert the three most load-bearing prose rules into pre-commit failures (lefthook already runs lint — `lefthook.yml:26-27`).

### F6 — MEDIUM: the App Store channel's correctness rests on an 849-line untested bash monolith

**Evidence:** `scripts/verify-appstore-bundle.sh` — 849 lines (`wc -l`), the verifier for the channel split (licenseUi folded out, updater/autostart compiled out, entitlements, receipt posture). `build-appstore-pkg.sh` 402 lines, `build-appstore-bundle.sh` 232. None have tests. Contrast with the pattern the repo itself established: `prettierChunkGuard.mjs` has `prettierChunkGuard.selftest.mjs`, and the release driver's decisions live in unit-tested `src/lib/release/publishPlan.ts`. The Vite-plugin guards (`licenseUiFoldInGuard`, `prettierChunkGuard` in `vite.config.ts:26-35`) are structural and good — the bash layer above them is the soft spot.

**What breaks / when:** the next Tauri/macOS/Apple-toolchain change that shifts a path or plist quirk. An 849-line bash script fails in ways only its author can debug, and a weaker model editing it can break a check silently (bash has no type/test gate here; lefthook doesn't touch it).

**Cheapest mitigation:** don't rewrite it. Add a header block enumerating the invariants it asserts (one line each, with the D/T identifier), so a future agent can re-derive intent; move any new checks into `.mjs`+vitest per the established pattern. If one thing gets extracted, make it the pass/fail decision logic.

### F7 — MEDIUM: dual-channel capability overlay is a silent-failure trap guarded only by a comment and a manual gate

**Evidence:** `src-tauri/tauri.direct.conf.json:9` — a single (excellent) JSON-string comment documents that Tauri's capability resolution drops ALL globbed grants the moment the overlay array is non-empty, and that a malformed identifier/window/permission "would silently drop the grant — a direct-channel false-GREEN". The direct channel's updater/restart/autostart permissions exist only via this overlay. The only thing standing between a typo here and shipping a direct build whose updater UI can't call the updater is the manual round-trip gate at release time (`build-and-publish.mjs:516-523`).

**What breaks / when:** any future capability edit (new plugin, renamed window). The failure is invisible in dev if the maintainer tests via `tauri dev` with different config, and invisible in CI (there is none).

**Cheapest mitigation:** a small `cargo` or e2e assertion in the direct-channel build path that the runtime capability set includes `updater:default` (even a grep of the built ACL blob in `verify-appstore-bundle.sh`'s counterpart, or a smoke e2e that calls `check()` and asserts a non-permission error). Second best: promote the JSON comment into `docs/CHANNELS.md` (see KG-4) so the knowledge survives config refactors.

### F8 — MEDIUM: two colliding version/tag schemes + stale CHANGELOG will misfire the next direct release

**Evidence:** git tags contain both **release tags** `v0.2.2 … v0.4.1` (three-part, created by `release:bump`, subjects = changelog bodies) and **milestone tags** `v1.0 … v1.8` (two-part, subjects like "v1.6 Licensing"). Meanwhile `package.json:4` and `tauri.conf.json:4` are already at `1.0.0` (bumped for the App Store submission), the last direct-channel release is `0.4.1` (2026-06-21), and `CHANGELOG.md`'s `[Unreleased]` section says "_Nothing yet._" despite v1.6–v1.9 shipping licensing, settings, MAS, and four formatter tools since. CHANGELOG's own header protocol ("maintainer edits the section BEFORE running release:bump/publish") has not been followed since 0.4.1.

**What breaks / when:** the next `pnpm release:publish` ships tag `v1.0.0` — numerically adjacent to milestone tag `v1.0` ("Distribution", 2026-06-02) — with fallback notes ("shipping the tag as notes", `build-and-publish.mjs:457-462`) instead of six milestones of release notes. Direct-channel users get a giant silent jump 0.4.1→1.0.0. A weaker model reading `git tag` will conflate milestones with releases (I initially did).

**Cheapest mitigation:** one paragraph in RELEASE.md defining the two schemes; backfill CHANGELOG `[Unreleased]` before the next publish; consider prefixing future milestone tags (`milestone/v2.0`) to end the collision.

### F9 — LOW-MEDIUM: repo/workspace hygiene

Verified clean, contrary to reasonable suspicion: `.env` files, `latest.json`, `dist/`, `.DS_Store`, `.tmp-verify/`, provisioning profiles, `target/` are all untracked (`.gitignore` + `.git/info/exclude`; `git ls-files` confirms; `git status` clean). Remaining items:
- `scaffold/` is now a stale duplicate: `scaffold/src/lib/protobuf/decoder.ts` is byte-identical to `src/`'s, but `scaffold/src/lib/tools/registry.ts` has diverged. CLAUDE.md:15 still calls it "verified code to port unchanged" — the port finished at Phase 1. An agent could plausibly "re-port" stale code. Delete it or re-label as historical; it has no scaffold-for-next-app value (see F10).
- `.planning/STATE.md` is 242 KB in 280 lines (single lines up to 6.6 KB). It's the de-facto decision narrative (see KG-1) but is at the size where a weaker model can't ingest it whole.
- Tracked binary/screenshot weight (~0.5 MB PNGs in `docs/seeds/`, `marketing-screens/`, `.planning/phases/*/gate-sim/`) — fine for now, just don't let gate-sim screenshots accrete per phase forever.

### F10 — LOW (strategic): nothing here is extraction-ready for the "more apps" plan, and `scaffold/` is not that scaffold

**Evidence/assessment:** the genuinely reusable assets in this repo are: (a) the platform seam pattern (`src/lib/platform/` — interface + tauri + browser impls), (b) the release toolchain (`scripts/bump-and-tag.mjs`, `build-and-publish.mjs` + `src/lib/release/` pure cores) — which hardcodes `bklim5/devtools-releases` at `build-and-publish.mjs:76` and `publishPlan.ts:124`, (c) the entire licensing stack (`infra/keygen/`, `server/webhook/` with its MoR seam `server/webhook/src/mor.ts`, `src-tauri/src/license/` with per-app constants isolated in `config.rs`), and (d) the harness definition (`docs/harness-and-decisions.md`). All of these are one-parameterization away from reuse (repo name, product name, keygen host/account, APP_SALT, bundle id), and the code's own comments already mark the seams. The `scaffold/` dir is unrelated legacy (the ORIGINAL pre-project code drop) — not a template.

**Recommendation:** don't extract preemptively. When app #2 starts, extract in this order (highest leverage first): webhook + infra (already app-agnostic except env), license Rust module (only `config.rs` + keychain service names are app-specific — the keychain SERVICE constants at `keychain.rs:26-28` and `APP_SALT` at `config.rs:70` must be fresh per app, and `config.rs:67-69` warns APP_SALT is frozen per app forever), then the release scripts (parameterize the two hardcoded repo constants). Budget a day, not a milestone. What will hurt: the giant load-bearing comments encode THIS app's history (D/T numbers) — extraction should strip or generalize them, or the next app inherits misleading provenance.

---

## 6-month risk register

| # | Risk | Likelihood | Impact | Trigger horizon | Mitigation (cheapest) |
|---|---|---|---|---|---|
| R1 | Loss of minisign key / CE DB / Apple creds (no backups) | Low-Med | Fatal to channel / to licensing | Any time; probability compounds | F1: backups tonight + `docs/KEYS.md` |
| R2 | Stale RELEASE.md followed for a release | High (first non-scripted attempt) | Bad/broken release, single-arch manifest | Next release done "by the doc" | F3: rewrite runbook |
| R3 | VPS outage >7 days or provider loss | Low | Paying users decay to Free in ≤37d; support storm | Any time | F4: restore runbook + F1 pg_dump |
| R4 | Next direct publish ships v1.0.0 with empty notes + tag-scheme confusion | High | Embarrassing, not fatal | Next `release:publish` | F8: CHANGELOG backfill + scheme doc |
| R5 | Seam/architecture erosion by a future low-context session | Med | Slow structural rot; loses portability + testability | First unguarded session | F5: eslint restricted-imports (~30 min) |
| R6 | Capability-overlay regression ships a direct build with dead updater | Low-Med | Users stranded until manual reinstall | Next capability edit | F7: build-time ACL assert |
| R7 | Apple cert / ASC key expiry with no calendar | Med (12-mo certs) | Blocked releases until renewal dance | Cert anniversary | Expiry dates into `docs/KEYS.md` |
| R8 | `verify-appstore-bundle.sh` breaks on toolchain drift; nobody can fix it | Med | MAS releases blocked | Next Tauri/Xcode major | F6: invariants header |
| R9 | GitHub releases-repo move/rename without transitional release | Low | All installs stop updating | Only if provoked | F4: migration note |

---

## Knowledge gaps for future agents (Part B)

Question assessed: could a weaker model with zero history safely continue from disk? **Mostly yes for feature work** — CLAUDE.md is a real entry point, the harness is written down (`docs/harness-and-decisions.md`), `.planning/` v1.0–v1.3 archives are intact, and code comments are exceptional (they carry threat-model IDs and decision rationale inline). **No for anything touching release, keys, infra, or channel plumbing**, because of the following gaps.

### KG-1 — The D-xx / T-xx decision ledger is partially deleted from the tree (worst gap)

Code and configs cite decision/threat IDs pervasively (`config.rs` alone: D-40/41/45/51/52/73-76, A5; `tauri.direct.conf.json`: Finding 1, T-20-01; `build-and-publish.mjs`: REL-*, T-11-*). The v1.0–v1.3 phase archives that define the early IDs survive under `.planning/milestones/`. But commit `9fcbbd9d` ("docs: start milestone v1.9") **deleted the phase 18–30 planning artifacts without archiving them** — there are no `v1.6-phases/`, `v1.7-phases/`, `v1.8-phases/` directories, and those milestones (Licensing, Settings, Mac App Store) are where the D-40..D-81 and T-19/T-20/T-30 series live. Today, "what is D-52?" is answerable only via a passing mention in `.planning/STATE.md:226` (a 6.6 KB line) or `git show 9fcbbd9d^:.planning/phases/...`. A weaker model will not do that archaeology.

**Fix (prioritized #1):** restore the deleted phase docs from `9fcbbd9d^` into `.planning/milestones/v1.6-phases/` etc. (mechanical: `git checkout 9fcbbd9d^ -- .planning/phases/18* 19* 20* ...` then move), or generate a single `docs/DECISIONS.md` index (ID → one-line meaning → source) from git history. Also fix whatever `gsd-cleanup`/milestone-close step deleted instead of archiving, or it will happen again at v1.9 close.

### KG-2 — No key/trust-anchor runbook (`docs/KEYS.md`)

Covered in F1. Sections it needs: anchor inventory with locations and expiry dates; loss consequences per anchor; rotation procedure per anchor (including "minisign rotation strands the fleet — don't"); backup locations and restore test cadence. Nothing on disk currently tells a future agent that the updater pubkey is pinned in every shipped binary, except one euphemistic RELEASE.md line.

### KG-3 — Release runbook stale; rollback and host-migration undocumented

Covered in F3/F4. Concrete sections to add to `docs/RELEASE.md`: "Current pipeline (`release:bump` → CHANGELOG edit → `release:publish`)"; "Rollback = revert-by-republish" (text currently only exists as runtime script output); "Moving the releases repo / update endpoint" (transitional-release constraint); "Version & tag schemes" (F8); "Release machine inventory" (F2, or its own `RELEASE-MACHINE.md`).

### KG-4 — No single channel-matrix document

The direct-vs-appstore split (plugins compiled out, capability overlay, `VITE_CHANNEL`, licenseUi fold-out guard, Keygen vs StoreKit upsell, entitlements files, provisioning profiles, per-channel `CARGO_TARGET_DIR` trees) is currently reconstructable only from comments scattered across `tauri.direct.conf.json`, `tauri.appstore.conf.json`, `vite.config.ts`, `package.json` scripts, and three build scripts. One-page `docs/CHANNELS.md` table: dimension × channel × enforcing artifact. This is also where the F7 silent-drop trap belongs in prose.

### KG-5 — Harness enforcement config is off-repo

`.claude/` and `.agents/` are gitignored (`.gitignore:29-32`); the deterministic gate hooks live in the user's global config (per owner's own memory notes). A fresh clone gets the harness *description* (CLAUDE.md, harness-and-decisions.md) but none of the *mechanics*. Either commit the project-scoped hook/skill config, or document in CLAUDE.md that gates are user-global and what they enforce, so their absence is at least detectable.

### KG-6 — Support runbooks: good but scattered, one hole

`infra/keygen/RUNBOOK.md` (seat release — excellent, copy-pasteable), `infra/keygen/suspend-license.sh` (revocation), `docs/appstore/REFUND-TEST-RUNBOOK.md` exist. Missing: "buyer lost the license email / key resend" procedure, and a one-line index in README or CLAUDE.md pointing at all support paths — a future agent has to already know these files exist.

### Prioritized fix list (effort-ranked)

1. **Back up the three key materials + start offsite pg_dump** (F1) — hours, removes the only fatal risks.
2. **Restore/replace the deleted v1.6–v1.8 planning artifacts; fix the milestone-close archiving step** (KG-1) — ≤1 hour, mechanical.
3. **Rewrite `docs/RELEASE.md` + add KEYS.md skeleton + version-scheme paragraph + CHANGELOG backfill** (F3/F8/KG-2/KG-3) — one sitting.
4. **ESLint restricted-imports for the seam + BrowserRouter** (F5) — 30 min.
5. **`docs/CHANNELS.md` channel matrix + capability-attach assertion** (F7/KG-4) — half day.
6. **Release-machine inventory doc** (F2) — 1 hour.
7. **Invariants header on `verify-appstore-bundle.sh`** (F6) — 1 hour.
8. Defer: CI (999.2) until after 1–3; extraction/template work until app #2 actually starts (F10).

---

*Method note: all file:line citations verified by direct read/grep on 2026-07-06. Things checked and found NOT to be problems, to save the next reviewer time: capability seam purity (clean), tracked secrets/artifacts (none — `.env*`, `latest.json`, `dist/`, profiles all ignored), webhook signature verification (raw-body HMAC + constant-time compare, `server/webhook/src/verify.ts`), webhook idempotency (keyed mutex + metadata search, single-instance documented, `lock.ts`), CSP (tight; the two GitHub hosts in `connect-src` are documented as defensive, `RELEASE.md:227-230`), updater manifest integrity (minisign mandatory; assets-before-manifest ordering; served-version verify), capability scopes (narrow, e.g. opener pinned to `https://tinkerdev.io/*`, `capabilities/default.json:20-24`), e2e realness (27 specs against real WKWebView via embedded WebDriver, localhost-pinned, debug-only).*
