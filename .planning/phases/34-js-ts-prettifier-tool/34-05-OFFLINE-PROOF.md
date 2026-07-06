# 34-05 OFFLINE PROOF — JS/TS Formatter (PRT-04/PRT-09/PRT-10/PRT-12 boundary, BLOCKING)

Durable record of the Phase-34 human boundary sign-off for the combined
JS/TS/JSX/TSX prettify+minify tool (the 13th tool). The tool triggers the lazy
Prettier/esbuild chunks on a real paste on the WKWebView and fetches nothing
remote while formatting — proven on the real runtime by the automated e2e and
ratified by the human walkthrough.

> **Honesty note:** the human's sign-off this round was a blanket approval
> ("looks ok" → approved), NOT a per-row Network-tab dictation. The rows below
> record the automated complements (authoritative for the machine-checkable
> parts) plus the human's blanket confirmation. No detailed human observation is
> claimed beyond the approval actually given.

## Build under test

- **Build SHA:** `d7141217` (HEAD — the boundary, after the two Codex
  adversarial-review fixes to `minifyJsTs` semantics landed: `4924ca86`
  jsx:preserve + `d7141217` verbatimModuleSyntax side-effecting imports). Built
  by the Task-2 executor (both channels) as the LAST step after every source
  change landed.
- **Channels built (both, per the binding harness):** direct
  (`pnpm tauri:build:direct`) + appstore (`pnpm tauri:build:appstore`,
  dev-signed). The final non-zero `tauri build` exit is only the absent
  updater-signing key — confirmed via the `.app`/`.dmg` under
  `src-tauri/target/*/release/bundle/macos/`, not the exit code.

## Allowed-request criteria (what a CLEAN Network tab means)

With Wi-Fi OFF, prettifying AND minifying must produce **ZERO remote requests**.
PERMITTED (all local / in-bundle, no network egress): `tauri://localhost` /
`asset://localhost` (the app's own bundled JS/CSS chunks, fonts, vendored
`esbuild.wasm`), `ipc://` internal Tauri IPC, `data:` / `blob:`.

FORBIDDEN (any = FAIL): any `http(s)://` to a NON-local host (a CDN such as
`unpkg.com` / `cdn.jsdelivr.net`, a Prettier/esbuild remote fetch, telemetry, a
font CDN). Because Wi-Fi is OFF during observation, any genuinely-remote fetch
would also FAIL to resolve — so a successful prettify/minify with Wi-Fi off is
itself positive evidence.

## Automated complements (authoritative for the machine-checkable parts)

- **(a)** `test/e2e/js-formatter.e2e.ts` — real-WKWebView gate: all four dialects
  (JS/TS/JSX/TSX) prettify via the lazy Prettier chunk on JavaScriptCore, esbuild
  minifies (incl. JSX-preserve + side-effecting-import survival guards from the
  two Codex fixes), Semi/Single-quotes toggles drive the engine, a malformed
  paste yields a calm `role=alert` line:col with recovery, and
  `performance.getEntriesByType("resource")` shows no non-localhost host. GREEN on
  webkit (`E2E_SPECS=./test/e2e/js-formatter.e2e.ts bash scripts/e2e-spike.sh`).
- **(b)** P32 engine-layer no-network integration test
  (`src/lib/format/offline.integration.test.ts`) — `networkCalls === 0` across
  `formatScript`/`formatHtml`/`minifyScript`.
- **(c)** no-CDN bundle grep over the engine sources + dynamic-import-only (no
  static `from "esbuild-wasm"`).
- **(d)** the heavy-engine chunk-module-inventory sentinel
  (`scripts/prettierChunkGuard.mjs` → `heavyEngineInitiallyReachable:false`).

The WebDriver/WKWebView spike CANNOT intercept native WKWebView network at the OS
layer; this file does NOT claim a machine-checkable OS-level network intercept the
harness cannot perform. The Wi-Fi-off observation is the human's, complemented by
(a)–(d).

## Wi-Fi-off Network-tab evidence — human blanket confirmation

Sign-off is the human's blanket approval ("looks ok"), not a per-row agent
observation. Both channels share the identical webview + the offline complements
(a)–(d) above.

| Channel  | Mode     | Wi-Fi | Formatted OK? | Remote requests | Result |
|----------|----------|-------|---------------|-----------------|--------|
| direct   | Prettify | OFF   | YES (human)   | none (human + (a)–(d)) | PASS ✓ |
| direct   | Minify   | OFF   | YES (human)   | none (human + (a)–(d)) | PASS ✓ |
| appstore | Prettify | OFF   | YES (human)   | none (human + (a)–(d)) | PASS ✓ |
| appstore | Minify   | OFF   | YES (human)   | none (human + (a)–(d)) | PASS ✓ |

## JSX-factory minify semantics — Option A ratified

The Codex fixes settled JSX handling (jsx:preserve — never lower to
`React.createElement`) and side-effecting-import survival (verbatimModuleSyntax).
One residual semantic question was raised for the human: under preserve-mode
minify, esbuild drops an **unused** JSX factory binding (e.g. a
`import {h} from "..."` pragma import left unreferenced once JSX is preserved).

**Human decision: Option A** — accept esbuild's default (unused JSX factory
bindings dropped under preserve-mode minify). This is correct for the modern
automatic runtime, where no explicit factory import is needed. **NO code change,
NO rebuild.** Ratified 2026-07-06.

## WCAG-AA (PRT-12) — audit

Covered by the human sign-off (2026-07-06 "looks ok" → approved). A standalone
`gsd-ui-review` score was NOT separately captured this round; the JS/TS tool
reuses the Phase-33 registry-only / free-tier / WCAG-AA-audited shell
(FormatterView + StatusBar) that the human formally approved 2026-07-02. If a
formal WCAG-AA audit artifact is required, run `/gsd-ui-review 34`.

## Sign-off

- **Human resume-signal:** **APPROVED** (2026-07-06). The human reviewed the
  boundary walkthrough of the freshly built app and confirmed "looks ok", and
  ratified **Option A** for the JSX factory-import minify semantics (no code
  change). No issues were raised to fix.
- **Honesty scope:** this file records the approval actually given plus the
  automated complements (a)–(d). It does not fabricate per-row Network-tab
  observations the human did not individually report.
