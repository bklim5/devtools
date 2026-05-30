# Next Session Pickup — Phase 1, Plan 01-04

**Status:** Plan 01-04 ~60% done. Autonomous tasks remain, then a human-verify checkpoint.
**Resume command:** `/gsd-execute-phase 1` (it skips completed plans 01-01..01-03, resumes 01-04), OR continue 01-04 manually with the checklist below.

## Where things stand

| Plan | State |
|---|---|
| 01-01 scaffold + lib (19 tests) + fonts + dark window | ✓ complete, committed |
| 01-02 HashRouter + platform seam + skeleton (32 tests) | ✓ complete, reviewed, UI-verified, committed |
| 01-03 lefthook gate + first tauri build smoke | ✓ complete, committed |
| 01-04 webdriver spike + full-gate proof + WCAG + sign-off | ⏳ scaffolding committed; runner installed; spike not yet run |

## What's already in place for 01-04

- `src-tauri/Cargo.toml` — `tauri-plugin-webdriver = "0.2"` (was duplicated 4×; fixed to one).
- `src-tauri/src/lib.rs` — plugin registered behind `#[cfg(debug_assertions)]` (out of release).
- `wdio.conf.ts`, `test/e2e/skeleton.e2e.ts`, `scripts/e2e-spike.sh` — reproducible spike harness.
- wdio runner deps installed: `@wdio/cli@9`, `@wdio/local-runner@9`, `@wdio/mocha-framework@9`, `tsx`.
- Proven already: the embedded W3C WebDriver server comes up on `127.0.0.1:4445` under `pnpm tauri dev`; `cargo tree --release | grep webdriver` = 0 (excluded from release).
- Real-webview UI of the skeleton already verified once via chrome-devtools-mcp against the `vite preview` bundle (screenshot: paste→hex works, copy button focusable+visible, status bar shows bytes+timing). So the D-02 fallback path is known-good.

## Checklist to finish 01-04

1. **Confirm Rust compiles:** `cd src-tauri && cargo check` (validates the dedup'd webdriver dep in dev profile).
2. **Run the real-WKWebView spike (time-boxed):** `bash scripts/e2e-spike.sh`. Success bar = launch app, find `data-testid="skeleton-input"`, send keys, screenshot the real WKWebView.
   - If wdio drives it cleanly → that's the D-01 win.
   - If flaky/too slow → take the D-02 fallback (screencapture of the `tauri dev` window + chrome-devtools-mcp on `vite preview`).
   - **Record which path won + rationale in `docs/phase-0-notes.md` (HRN-02).**
3. **WCAG-AA + 6-pillar audit → `docs/phase-1-ui-review.md`** (HRN-01 UI half). Textarea `id` a11y fix already applied; re-check focus indicators, contrast of the status-bar `--tx` colors on dark bg, no opacity-only disabled state.
4. **Full-gate proof (HRN-01):** record the skeleton passing simplify → codex:review → unit (vitest+tsc) → real-webview UI; demonstrate the UI check would CATCH a hover-only-copy regression.
5. **Authoritative final build (HRN-04):** `pnpm vitest run && pnpm tsc --noEmit && pnpm tauri build`; verify the webdriver server is ABSENT from the release artifact (no :4445; symbol/grep). Record in `docs/phase-0-notes.md`.
6. **Write `01-04-SUMMARY.md`**, update STATE.md + ROADMAP.md + REQUIREMENTS.md (HRN-02 → complete).
7. **Human-verify checkpoint** (the user signs off on): dark window matches design `--win`/`--bg-app`; paste-transforms-instantly; visible+focusable copy; unknown-route → skeleton redirect; the automation-path decision.
8. **Phase verification:** spawn `gsd-verifier`, then `phase complete 1`. After Phase 1: `/gsd-discuss-phase 2` (Shell).

## Cautions for next session (learned this session)

- This Bash shell has **no `shopt`/dotglob**; never rely on glob to move dotfiles, and never `rm -rf` a dir without verifying every entry is duplicated at the destination first (caused an `rm -rf` data loss — recovered via Time Machine).
- Inline Bash output sometimes **garbles** (escape codes, repeated lines); when it does, write to a temp file and use the Read tool.
- Subagent executors **lost their commits** twice this session; when delegating, verify commits actually landed (`git log`) afterward, or commit from the orchestrator.
- Run long `codex exec` / `tauri build` / `vite preview` with `run_in_background: true` and `stdin < /dev/null` (codex hangs on stdin otherwise).
