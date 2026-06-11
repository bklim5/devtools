# HARNESS.md — e2e gate runbook

Operational runbook for the real-WKWebView e2e gate. Facts sourced from
`scripts/e2e-spike.sh`, `test/e2e/*.e2e.ts`, and `wdio.conf.ts`.

## Running the gate

- **Entry point:** `bash scripts/e2e-spike.sh`
  1. Starts `pnpm tauri:dev:e2e` (= `tauri dev --features webdriver`). The WebDriver
     plugin is an optional Cargo dep — a plain `tauri dev` and every `tauri build`
     exclude it, so :4445 never binds outside this gate.
  2. Polls `127.0.0.1:4445` until the embedded WebDriver server accepts connections.
  3. Runs `pnpm e2e` (WDIO against `wdio.conf.ts`).
  4. ALWAYS tears down via an EXIT/INT/TERM trap that kills the whole `tauri dev`
     process group (vite + Rust app child). Exit code = WDIO's exit code.
- **Ports:**

  | Port | What | Notes |
  |---|---|---|
  | :4445 | embedded WebDriver server | `TAURI_WEBDRIVER_PORT` override; bound to 127.0.0.1 ONLY — never 0.0.0.0 (threat T-01-11) |
  | :1420 | vite dev server | FIXED by `tauri.conf.json` devUrl — `tauri dev` needs exactly this port |

- **Env vars:**

  | Var | Default | Effect |
  |---|---|---|
  | `MAX_WAIT` | 180 (s) | bound on the WebDriver-server startup poll |
  | `E2E_DEMO` | unset | `=1` → slow-motion pauses in specs for watching a run live; inert (no-op) otherwise |
  | `PREFLIGHT_ONLY` | unset | `=1` → run preflight then exit 0 (dry-run, no tauri launch) |

- **Logs:** tauri dev output → `test/e2e/__logs__/tauri-dev.log` (tailed on failure).

## Preflight (why a green run is trustworthy)

1. **Kills orphan `devtools-app` processes** (`pgrep -f` matches the dev binary
   name only — the production app is TinkerDev, so an installed app never matches):
   TERM → ~5s → KILL → ~10s → fail-loud.
   Rationale: the single-instance plugin means an orphan blocks relaunch; worse, an
   orphan holding :4445 would make WDIO test STALE code while looking green.
2. **Kills anything still LISTENING on :4445/:1420** (`lsof -sTCP:LISTEN` — never a
   mere client connection), same TERM → KILL → fail-loud ladder. The script never
   launches over an unkillable holder.

## Session model

- ONE shared app session across all specs: `maxInstances: 1`, a single empty
  capability — the embedded server drives the one app window. Full suite ~10 min.
- Specs live per-tool in `test/e2e/*.e2e.ts` (launch → navigate → drive → assert →
  screenshot).
- Screenshots land in `test/e2e/__screenshots__/` — these ARE the UI-verify
  evidence for the gate.

## WebKit / Tauri quirks (each one cost a debugging session)

- **macOS Option+letter composes to a glyph** (Option+P → "π"): app code must match
  the physical `e.code` (e.g. `"KeyP"`), never `e.key`; e2e specs must dispatch the
  composed key shape (`key: "π", code: "KeyP"`) or they false-positive.
- **Stale chained element handles:** re-query elements after navigation/re-render
  instead of holding chained handles across steps.
- **`dragDropEnabled: false` in `tauri.conf.json` is deliberate:** Tauri v2's native
  dragDrop (default true) swallows in-page HTML5 DnD. WebDriver cannot synthesize
  native OS drag either — drag/drop and other native-OS input is MANUAL-walkthrough
  coverage; make it an explicit human-verify item.

## DMG bundle flake (phase-boundary builds)

- `pnpm tauri build`'s DMG step fails when other DMGs are mounted: `hdiutil detach`
  the mounted volumes, then retry.
- The build's final non-zero exit can be just the absent updater-signing key —
  confirm success via the `.app`/`.dmg` under
  `src-tauri/target/release/bundle/macos/`, not the exit code.
