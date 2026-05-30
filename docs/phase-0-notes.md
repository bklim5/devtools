# Phase 0 / Phase 1 Notes — Harness, Distribution & Automation

This file is the single home for the Phase-1 harness deliverables (HRN-02 / HRN-04)
and the gate-enforcement boundary. Sections are filled across plans:

- **Gate enforcement (HRN-03)** — filled by Plan 01-03 (this plan).
- **HRN-04: `tauri build` (first smoke)** — filled by Plan 01-03 (this plan).
- **HRN-02: macOS webview automation path** — placeholder; filled by Plan 01-04.
- **HRN-04: FINAL release build (post-WebDriver)** — placeholder; the authoritative
  build is filled by Plan 01-04 (it verifies the WebDriver server is absent from the
  release artifact).

---

## Gate enforcement (HRN-03 / D-07 / D-08)

The per-task Definition of Done has three gates, in order:
`/codex:review` → unit tests (`tsc --noEmit` + `vitest run`) → real-webview UI verification.

**What is mechanical (lefthook pre-commit, D-07):** ONLY the unit gate.
`lefthook.yml` installs a `pre-commit` hook (parallel) that runs:

- `pnpm tsc --noEmit`
- `pnpm vitest run`

No commit can land with broken types or a failing test, regardless of agent
discipline. The hook is registered into `.git/hooks/pre-commit` via
`pnpm lefthook install` (the `lefthook` package + the `prepare: lefthook install`
script were installed in Plan 01-01).

**Non-destructive proof it has teeth (Plan 01-03):** rather than make a real bad
commit (which could capture unrelated worktree changes), the gate was exercised via
`pnpm lefthook run pre-commit` against a temporary staged probe file
(`src/__lefthook_probe__.ts`) containing a deliberate type error:

- Probe staged → `pnpm lefthook run pre-commit` exited **non-zero**:
  `typecheck ❯ src/__lefthook_probe__.ts(3,7): error TS2322: Type 'string' is not
  assignable to type 'number'. exit status 2`.
- Probe deleted → `pnpm lefthook run pre-commit` exited **zero** (typecheck ✔️,
  test ✔️ 32/32).

The probe file was deleted and never committed; the only change in Plan 01-03's diff
is `lefthook.yml`. (`package.json` / `pnpm-lock.yaml` were untouched — the HIGH-2
de-conflict with the parallel Plan 02.)

> Note on lefthook v2 behavior: `pre-commit` commands run against the **staged**
> file set, so the probe had to be `git add`-ed for the hook to evaluate it (an
> unstaged probe is reported `(skip) no matching staged files`). This mirrors a real
> `git commit`, where the to-be-committed files are staged.

**What stays MANUAL (D-08) — a git hook cannot run these:**

- **`/codex:review`** — `disable-model-invocation`; must be invoked by the agent per task.
- **Real-webview UI verification** — needs the running app (`tauri dev` / the actual
  WKWebView); a screenshot + a11y/DOM check against `design/`.

These two remain per-task DoD steps. Lefthook covers the unit gate only.

---

## HRN-04: `tauri build` (first smoke build)

**Run:** Plan 01-03, on macOS 26.3.1 (arm64).
**Command:** `pnpm tauri build` (the `beforeBuildCommand` runs `pnpm build` =
`tsc && vite build` to produce `dist/`, then cargo builds the release binary and the
macOS bundler produces the `.app` + `.dmg`).

> This is the **FIRST / smoke** build. It **predates** the debug-only WebDriver
> plugin (added in Plan 01-04 behind `cfg(debug_assertions)`). The **authoritative
> final release build** — the one that must verify the WebDriver server is absent
> from the shipped artifact — is owned by **Plan 01-04** (see placeholder below).
> Confirmed for this smoke build:
> `grep -c webdriver src-tauri/Cargo.toml` → `0`,
> `strings src-tauri/target/release/devtools-app | grep -ci webdriver` → `0`, and
> `… | grep -c 4445` → `0` (no webdriver surface / `:4445` port in the artifact yet).

### Toolchain

| Tool  | Version |
|-------|---------|
| rustc | 1.96.0 (ac68faa20 2026-05-25) |
| cargo | 1.96.0 (30a34c682 2026-05-25) |
| node  | v22.21.1 |
| tauri (crate) | 2.11.2 |
| wry / tao | 0.55.1 / 0.35.3 |
| tauri-plugin-clipboard-manager | 2.3.2 |
| vite (frontend build) | 7.3.3 |
| macOS | 26.3.1, arm64 (aarch64) |

Note: Rust was already bumped to 1.96.0 in Plan 01-01 (the clipboard plugin's
transitive `idna_adapter` needs `edition2024`, unstable in the original cargo 1.83).
No further MSRV/`rustup update` was needed for this build (RESEARCH A6 surprise
budget unused).

### Artifacts

| Artifact | Path | Size |
|----------|------|------|
| `.app`   | `src-tauri/target/release/bundle/macos/devtools-app.app` | 9.7 MB |
| `.dmg`   | `src-tauri/target/release/bundle/dmg/devtools-app_0.1.0_aarch64.dmg` | 4.1 MB (4,255,267 bytes) |
| release binary | `src-tauri/target/release/devtools-app` | 9.4 MB |

- **Bundle identifier:** `com.boonkhailim.devtools-app`
- **Product name:** `devtools-app`, version `0.1.0` (the window title is `DevTools`).
- **Architecture:** arm64 only (this machine; universal/x86_64 not configured — fine
  for the macOS-first smoke build).

> Naming note: `tauri.conf.json` `productName` is `devtools-app`, so the bundle is
> `devtools-app.app` / `devtools-app_0.1.0_aarch64.dmg` (not `devtools.app`). The
> window title shown to users is `DevTools`. A later phase may align productName to
> `DevTools` for a nicer Finder name — cosmetic, out of Phase-1 scope.

### Build duration

- **cargo release compile: `Finished release profile [optimized] in 42.27s`**; total
  wall time end-to-end ≈ **69s** including the `pnpm build` frontend step (`vite built
  in 727ms`) and the `.app` + `.dmg` packaging (`bundle_dmg.sh`). This was NOT a
  cold-from-scratch compile — Plan 01-01's `cargo check` had already populated the
  dependency build cache, so only the app crate + a few crates recompiled for the
  release profile. A truly cold first release build (empty `target/`) would take
  several minutes (all Tauri crates: tao, wry, tauri, …); expect that on CI / a clean
  checkout.

### Signing / Gatekeeper behavior (unsigned — EXPECTED, in scope)

- `codesign -dv` reports `Signature=adhoc` — i.e. **no Developer ID**; the bundle is
  effectively **unsigned**. This is by design for Phase 1 (signing + notarisation are
  Phase 6 / DST-01). Threat T-01-09 (unsigned bundle is impersonable) is **accepted**
  for this dev build.
- On a fresh copy macOS Gatekeeper will show "unidentified developer" (or "damaged"
  if quarantined). To launch the unsigned bundle locally:
  - right-click → **Open**, **or**
  - `xattr -dr com.apple.quarantine <App>.app` then open it.
- **Launch confirmed (Plan 01-03):** after `xattr -dr com.apple.quarantine
  src-tauri/target/release/bundle/macos/devtools-app.app`, `open` launched the app
  successfully — live process observed
  (`devtools-app.app/Contents/MacOS/devtools-app`, PID 21742), then cleanly killed.
  No signing/notarisation was attempted.

### Surprises / quirks

- **`tauri.conf.json` `bundle.icon` is correctly nested** — verified during this
  build; no icon-nesting warning was emitted and the icons bundled fine. (An earlier
  draft of this note wrongly flagged a flat key; corrected.)
- **No MSRV / cargo errors; no Xcode/CLT issues.** The build completed clean (exit 0).
- **WebDriver surface verified absent** from the smoke artifact:
  `grep -c webdriver src-tauri/Cargo.toml` → 0;
  `strings src-tauri/target/release/devtools-app | grep -ci webdriver` → 0;
  same for the `:4445` port string → 0. (The plugin is added behind
  `cfg(debug_assertions)` in Plan 01-04; the authoritative absence check on the FINAL
  build is Plan 01-04's responsibility — see placeholder below.)

---

## HRN-02: macOS webview automation path *(placeholder — Plan 01-04)*

> To be filled by Plan 01-04 (the time-boxed `tauri-plugin-webdriver` 0.2 spike, D-01/D-02).
> Record here: whether the WebDriver plugin reliably drove the real WKWebView
> (launch → find element → send input → screenshot), or whether the
> `screencapture` + `chrome-devtools-mcp`-against-`vite preview` fallback was adopted.
> Whichever path wins becomes the per-task UI-gate driver for all later phases (D-03).

---

## HRN-04: FINAL release build (post-WebDriver) *(placeholder — Plan 01-04)*

> To be filled by Plan 01-04 after the debug-only WebDriver plugin is added.
> This is the **authoritative** phase-boundary build. It MUST verify that the
> WebDriver server (the plugin's `127.0.0.1:4445` surface) is **absent** from the
> release artifact — i.e. the plugin is correctly gated under
> `[target.'cfg(debug_assertions)'.dependencies]` + `#[cfg(debug_assertions)]`
> (RESEARCH Pitfall 4; threat T-01-08). Record the verification method (e.g. confirm
> the webdriver dep does not appear in the release dependency graph / the endpoint is
> unreachable in the built `.app`) and the final artifact paths/sizes.
