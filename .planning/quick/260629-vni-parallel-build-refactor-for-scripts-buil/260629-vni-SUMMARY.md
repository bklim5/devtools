# Quick Task 260629-vni — Parallel-build refactor for scripts/build.sh

**Completed:** 2026-06-29
**Goal:** ONE command emits all three channel artifacts (direct, appstore, appstore-pkg) into independent per-channel `CARGO_TARGET_DIR` trees so they **coexist** instead of overwriting each other at the shared `src-tauri/target/universal-apple-darwin/...` bundle path (the original bug: the distribution-signed appstore-pkg `.app` overwrote / masqueraded as the dev-signed appstore `.app`, which then would not launch — AMFI -413).

## Scope decision (resolved with the user up-front)

The original ask mentioned "concurrent" builds + an sccache/registry-cache tradeoff. The user clarified: **sequential is fine** — they just want one command, not three. That collapsed the design:

- **SEQUENTIAL, not concurrent** → no shared-`dist/` clobber problem (each channel's `pnpm build` rewrites `../dist` with its own `VITE_CHANNEL` in turn). No per-channel dist isolation needed.
- **Per-channel `CARGO_TARGET_DIR` is still the mechanism** — it is what makes the three artifacts coexist in separate trees, even one-at-a-time.
- **No sccache.** The cargo *registry* cache (`~/.cargo`) is already shared globally; only *compiled* artifacts duplicate across the separate target dirs (~3x disk, accepted). Sequential builds never contend for the cache, so the contention half of the concern is moot. Adding sccache would introduce a dev-tool dependency against the project's zero-dep ethos — declined.

## What changed (5 files)

1. **`scripts/build.sh`** — added `--all` (and `--parallel` as an honestly-documented *sequential* alias) that runs `direct → appstore → appstore-pkg` back-to-back, fail-fast, with a final per-channel artifact-path summary (✓ built / ✗ failed / – skipped). Every invocation — single-target *and* `--all` — exports an **absolute** per-channel `CARGO_TARGET_DIR=$ROOT/src-tauri/target/<channel>` (absolute is required: Tauri runs cargo with CWD=`src-tauri/`, so a relative value would resolve to the wrong tree).
2. **`scripts/build-appstore-bundle.sh`** / **`scripts/build-appstore-pkg.sh`** — `APP_OUT`/`PKG_OUT` derive from `BUNDLE_ROOT="${CARGO_TARGET_DIR:-src-tauri/target}"`; each fails closed if a *set* `CARGO_TARGET_DIR` is relative.
3. **`scripts/build-and-publish.mjs`** — bundle dir constants honor `process.env.CARGO_TARGET_DIR` (same absolute guard); passes the resolved macos dir into the pure core.
4. **`src/lib/release/publishPlan.ts`** — `universalMachoPath()` + `buildPublishPlanView()` gained an **optional trailing `baseMacosDir` param defaulting to the existing constant**, so the pure core stays env-free and every existing test/caller is unchanged. (Critical: the direct-channel path lived in *two* places — the `.mjs` AND this pure core's `sigGlob`/macho path; threading only the `.mjs` would have made the build write to the per-channel dir but glob the `.sig` at the default path → fail.)
5. **`scripts/verify-appstore-bundle.sh`** — (adversarial-review fix) its no-arg *default* APP path now also honors `${CARGO_TARGET_DIR:-src-tauri/target}`.

**Backward-compat invariant (verified):** with `CARGO_TARGET_DIR` unset, every resolved path string is **byte-identical** to today's literal. Standalone `pnpm tauri:build:appstore` / `release:build-only` and the app-store runbooks (which use the `pnpm` commands, not `build.sh`) are unchanged.

## Binding harness — all gates passed

| Gate | Result |
|---|---|
| `/code-review xhigh` (parallel finders) | No confirmed feature bugs; 2 low-sev out-of-band find-stale notes |
| `/codex:adversarial-review` | `needs-attention` → 1 medium finding **addressed** (verify-script default now honors `CARGO_TARGET_DIR`) |
| `tsc --noEmit` | clean |
| `vitest` | **1279/1279** (decoder's 19 + publishPlan defaulted-param all green) |
| `shellcheck scripts/build.sh` | clean |
| decoder.ts + 19 tests | byte-for-byte untouched |
| lefthook pre-commit (typecheck/test/lint) | green on every commit |

### Real-build coexistence + signature proof (`scripts/build.sh --all`, exit 0)

All three artifacts built and **coexist in separate trees** with **distinct, correct signatures**:

| Channel | Tree | Signature |
|---|---|---|
| direct | `target/direct` | **Developer ID Application** + DMG notarization staple validated ✓ |
| appstore | `target/appstore` | **Apple Development** (launches locally) ✓ |
| appstore-pkg `.app` | `target/appstore-pkg` | **Apple Distribution** ✓ |
| appstore-pkg `.pkg` | `target/appstore-pkg` | **3rd Party Mac Developer Installer** chain ✓ |

This is the definitive proof of the fix: the dev-signed appstore `.app` and the distribution-signed appstore-pkg `.app`/`.pkg` now live side-by-side and neither overwrites the other. It also proves the load-bearing assumption — **Tauri 2 honors `CARGO_TARGET_DIR` for bundle output**.

## Known limitations (documented, not fixed — out of scope)

- **`scripts/check-dev-strip.sh:53`** — a *comment* example still cites the legacy `src-tauri/target/release/...` path. Cosmetic; the script is arg-driven.
- **Pre-existing `SC2164`** (`cd "$ROOT_DIR"` without `|| exit`) in the two appstore sub-scripts — pre-dates this work, on untouched lines; left as-is to avoid scope creep into unrelated hardening.
- **Live `.app` launch** of the dev-signed appstore bundle (open without AMFI -413) is the documented human gate — the `Apple Development` signature (vs the distribution one that triggers AMFI -413) is the determinant and is proven above.

## Commits

- `3966bf91` — Task 1: sub-scripts + pure core honor `CARGO_TARGET_DIR`
- `1abc6b0e` — Task 2: `build.sh --all`/`--parallel` + per-channel absolute `CARGO_TARGET_DIR` + summary
- `68b4b178` — shellcheck-clean `.env` source in build.sh
- `55dab17e` — fail closed when a *set* `CARGO_TARGET_DIR` is relative
- `6e8bb177` — (adversarial-review fix) verify-appstore-bundle default honors `CARGO_TARGET_DIR`

---

## Follow-up (2026-06-30): canonical per-channel target dir for ALL entry points

User observed that `scripts/build.sh direct` and `pnpm release:publish` produce the same build in **different** trees → duplicate multi-GB target dirs. Asked to publish to one shared target per channel. User chose "all three channels canonical."

**Change:** every build *entry point* now self-defaults + exports its canonical absolute `CARGO_TARGET_DIR` when unset, so cargo and the path-readers always agree, regardless of whether invoked via `scripts/build.sh` or standalone `pnpm`:
- `build-appstore-bundle.sh` → `$ROOT_DIR/src-tauri/target/appstore`
- `build-appstore-pkg.sh` → `$ROOT_DIR/src-tauri/target/appstore-pkg`
- `build-and-publish.mjs` → `resolve(src-tauri/target/direct)`, set on `process.env` so the `tauri build` subprocess inherits it (so `release:publish` + `release:build-only` share the `direct/` tree with `build.sh direct` — no duplicate)
- `tauri:build:direct` npm script → `$PWD/src-tauri/target/direct`
- `build.sh` still pre-exports the same absolute dir (redundant twin); the guard runs BEFORE the default so a set-relative value still fails closed.

Updated the appstore runbooks (`PHASE-26-SANDBOX-WALKTHROUGH`, `REFUND-TEST-RUNBOOK`) to the new per-channel paths. Pointed `verify-appstore-bundle.sh`'s bare default at the appstore channel (its canonical home).

**Note:** `docs/RELEASE.md` documents the bare `pnpm tauri build` manual flow (host-arch → `src-tauri/target/release/bundle/`), which this change did NOT touch — it remains accurate. The real automated publish path is `release:publish` (now `direct/`).

**Harness (all passed):** review agent (no bugs) → codex adversarial review (needs-attention: single finding = verifier default/runbooks → addressed) → tsc clean + vitest 1279/1279 → shellcheck clean (only pre-existing SC2164 on untouched `cd` lines). **Real proof:** standalone `pnpm tauri:build:appstore` (CARGO_TARGET_DIR unset) landed fresh in `target/appstore/` + passed all compliance/freshness gates while the bare `universal-apple-darwin` tree stayed untouched; `release:publish --dry-run` resolved all bundle paths to `target/direct/`; bare `verify-appstore-bundle.sh --require-bundle` now inspects `target/appstore/` and its freshness gate correctly flags a stale bundle (fail-safe).

**Commits:** `664eead2` (canonical unification), `1f155665` (verify default → appstore channel).

**Stale legacy trees:** `src-tauri/target/{universal-apple-darwin,aarch64-apple-darwin,x86_64-apple-darwin}` (Jun 2) are now unused by every script — safe to `rm -rf`. `release`/`debug` remain the bare `pnpm tauri build` / `tauri dev` caches.
