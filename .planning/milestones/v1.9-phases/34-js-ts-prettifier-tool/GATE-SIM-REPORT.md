# Phase 34 Gate-Sim Report — JS/TS Prettifier Tool

Date: 2026-07-06 · Simulator: Chromium (chrome-devtools MCP) against `pnpm dev` on :1420
Caveat: Chromium is a SIMULATOR for the packaged WKWebView app. Chrome's CSP/WASM engine is not WKWebView's. WKWebView-authoritative evidence is the phase's own gate: `test/e2e/js-formatter.e2e.ts` — GREEN on webkit per 34-05-SUMMARY (all four dialects, esbuild minify, toggles, calm error, no-remote check).

## Verdict: PASS

Zero defects found. One harness artifact documented (not an app defect).

## What was driven (all via real UI or DOM-event input on the live page)

| Check | Result | Evidence |
|---|---|---|
| Route `#/tools/js-formatter` renders FormatterView shell (light) | PASS | gate-sim/light-js-formatter-empty.png |
| Prettify JS `const x={a:1,b:2};…` → correct Prettier output | PASS | script output: `const x = { a: 1, b: 2 };…` |
| Prettify TS (interface + typed arrow) | PASS | `interface P {\n  name: string;…` |
| Prettify JSX (className, map/key) | PASS | multi-line JSX with wrapped children |
| Prettify TSX (typed destructured props) | PASS | gate-sim/light-js-formatter-tsx-output.png |
| Semi OFF + Single quotes ON → output changes | PASS | `const s = 'hello'` (no semi, single quotes) |
| D-05 defaults (semi ON, double quotes, indent 2, width 80) | PASS | light-js-formatter-empty.png (Semi active by default) |
| Minify mode hides Semi/Single-quotes (AND indent/width per D-06) | PASS | gate-sim/light-js-formatter-minify.png |
| esbuild-wasm Minify works under dev CSP in Chromium | PASS | `const s="hello",t="world";` · status `OK 32 → 27 bytes` |
| WR-01: malformed `const a = )` → calm single-line error, no code frame | PASS | gate-sim/light-js-formatter-error.png — `role=alert` = `1:11 Expression expected.`, 1 line, 38px, no ASCII frame, no duplicated locus |
| Recovery after error (valid input re-formats, alert clears) | PASS | `const a = 1;` output, alert gone |
| Toggle state survives Prettify↔Minify round-trip | PASS | semi=false preserved across mode switch (controlled re-test) |
| Overflow probe, 1280×800, light + dark, incl. status bar | PASS | 0 offenders |
| Overflow probe at minWidth/minHeight floor 720×480 | PASS | 0 offenders, docOverX=0, controls wrap to 2 rows, status bar visible — gate-sim/light-js-formatter-720x480.png |
| Dark theme: pane + error state render correctly | PASS | gate-sim/dark-js-formatter-prettify.png, dark-js-formatter-error.png |
| Theme apply is pending-until-Save (contained preview D-23-3), Save applies live | PASS | Dark radio checked ≠ applied until Save; after Save appBg `rgb(10,11,13)` |
| Console scan (Refused to/CSP/WebAssembly/Uncaught/Failed to load) | PASS | only vite-connect debug + React DevTools info; zero errors/warnings |
| Static CSP parse (`src-tauri/tauri.conf.json`) | PASS | `script-src 'self' 'wasm-unsafe-eval'` present (packaged-WASM gotcha covered); no CDN/external runtime refs in index.html or src/ |
| Persistence: last-used tool (js-formatter) → startup redirect after reload at `/` | PASS | reload landed on `#/tools/js-formatter` |
| Persistence stale-writer hunt: theme save → 2.5s → pin toggle → reload | PASS | blob `devtools:shell.preferences` retained theme + new pin + lastUsedId; sidebar reflects pin; no clobber |
| Pro gating | PASS (by design) | tool is FREE, no entitlement gate (src/tools/js-formatter/index.ts); theme Save gating not exercisable — dev prefs carry `entitlementsOverride:"full"` |

## Defects

None.

## Harness artifact (documented, NOT a defect)

`resize_page` in the MCP harness reloads the page (verified with a window marker), which resets un-persisted React component state (mode/toggles). An earlier apparent "toggle state reset" was traced to this; a controlled in-page mode round-trip preserved state correctly, and writes to `.planning/` do NOT trigger Vite reloads.

## Not checked here (and why)

- **Real WKWebView behavior** (CSP enforcement, JavaScriptCore parsing, esbuild-wasm init in the packaged app): Chromium cannot prove these. Covered by the phase's own authoritative gate `test/e2e/js-formatter.e2e.ts` (GREEN per 34-05-SUMMARY); not re-run here because the dev server holds :1420 which e2e-spike requires free.
- **Native window chrome** (titlebar, traffic lights, drag) — outside the webview DOM; belongs to `scripts/ui-capture.sh` on the built `.app`.
- **Pro-gated theme-Save upsell path** — dev prefs have `entitlementsOverride:"full"`, so the free "Unlock Pro to save" branch was not exercisable in this session.
- **Real clipboard Copy** — Chromium clipboard permissions differ from the packaged app; not asserted.
- **Over-cap (>2 MB) paste guard** — not driven in this session (unit-covered per plan).

## Screenshots (7)

`.planning/phases/34-js-ts-prettifier-tool/gate-sim/`: light-js-formatter-empty.png, light-js-formatter-tsx-output.png, light-js-formatter-minify.png, light-js-formatter-error.png, light-js-formatter-720x480.png, dark-js-formatter-prettify.png, dark-js-formatter-error.png

## State restoration

Session prefs restored: Cron unpinned, theme back to light (original). `lastUsedId: js-formatter` left as genuine usage.
