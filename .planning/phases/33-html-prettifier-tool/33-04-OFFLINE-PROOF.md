# 33-04 OFFLINE PROOF — HTML Formatter (SC5 / D-10, BLOCKING)

Durable evidence that the FIRST mounted `useAsyncFormat` consumer (the HTML
prettify/minify tool) triggers the first lazy Prettier/esbuild chunk load on a
real paste and fetches **nothing remote** while formatting — offline, with Wi-Fi
OFF, on the real WKWebView. SC5 must not rest on an ephemeral human glance; this
file is the greppable record.

## Build under test

- **Build SHA:** `986cb3382830633397ac70850f25a65888c211a8` (HEAD at build time — Task 1 e2e commit, the last Phase-33 source/test commit)
- **Channels built (rebuilt LAST, after all Plan 01–03 source landed):**
  - **direct:** `src-tauri/target/direct/universal-apple-darwin/release/bundle/macos/TinkerDev.app` (+ `.../bundle/dmg/*.dmg`)
  - **appstore (dev-signed):** `src-tauri/target/appstore/universal-apple-darwin/release/bundle/macos/TinkerDev.app`
- **Freshness (T-33-10 anti-stale):** each bundle binary mtime asserted **newer than** the last source commit (`986cb338`, 2026-07-01 20:02:29 +0100) before the walkthrough. See "Bundle freshness" below.

## Allowed-request criteria (what a CLEAN Network tab means)

With Wi-Fi OFF, prettifying AND minifying must produce **ZERO remote requests**.
PERMITTED (all local / in-bundle, no network egress):

- `tauri://localhost` / `asset://localhost` — the app's own bundled assets (JS/CSS chunks, fonts, the vendored `esbuild.wasm`).
- `ipc://` / internal Tauri IPC.
- `data:` / `blob:` URLs.

FORBIDDEN (any of these = SC5 FAIL):

- Any `http(s)://` to a NON-local host (a CDN such as `unpkg.com`, `cdn.jsdelivr.net`, a Prettier/esbuild remote fetch, telemetry, a font CDN, etc.).

Because Wi-Fi is OFF during the observation, ANY genuinely-remote fetch would
also FAIL to resolve — so a successful prettify/minify with Wi-Fi off is itself
positive evidence, corroborated by the Network tab showing no remote rows.

## Harness limitation (why the interactive observation is authoritative)

The WebDriver / WKWebView spike (Task 1) CANNOT intercept native WKWebView network
at the OS layer, so SC5's authoritative proof is the interactive **Wi-Fi-off
Network-tab observation recorded in this file**, COMPLEMENTED by:

- **(a)** the Task-1 best-effort `performance.getEntriesByType("resource")` no-remote assertion on the real WKWebView (`test/e2e/html-formatter.e2e.ts`) — GREEN in the E2E_SPECS-scoped spike run.
- **(b)** the P32 engine-layer no-network integration test (`src/lib/format/offline.integration.test.ts`) — `networkCalls === 0` across `formatScript`/`formatHtml`/`minifyScript` (4/4).
- **(c)** the no-CDN bundle grep (`grep -RnE 'unpkg|cdn|https?://'` clean over the engine sources; `grep -c 'from "esbuild-wasm"'` = 0 — dynamic import only).
- **(d)** the heavy-engine chunk-module-inventory sentinel (`scripts/prettierChunkGuard.mjs` → `prettier-chunk-inventory.json` `heavyEngineInitiallyReachable:false`), the "proof = runtime no-invoke + chunk-module inventory" project rule.

This file does NOT claim a machine-checkable OS-level network intercept the harness cannot perform.

## Bundle freshness (T-33-10) — agent-recorded

Agent-recorded (`stat -f %m` on each `.app/Contents/MacOS/devtools-app` vs the
`986cb338` commit epoch `1782932549` = 2026-07-01 20:02:29 +0100). Both bundles
are universal (`lipo -archs` → `x86_64 arm64`).

| Channel  | Bundle binary mtime            | > last source commit? |
|----------|--------------------------------|-----------------------|
| direct   | 1782932663 (2026-07-01 20:04:23) | YES ✓                 |
| appstore | 1782932804 (2026-07-01 20:06:44) | YES ✓                 |

Both builds exited 0. The appstore bundle passed `verify-appstore-bundle.sh
--require-bundle` in full, INCLUDING the PRT-02 sentinel: "prettier + esbuild-wasm
ABSENT from every initially-reachable chunk (heavy engines load only via dynamic
import())" and its own freshness/linkage check (binary + dist newer than commit).

## Native-window capture — agent attempt + hand-off

The agent BUILT both channels and attempted the native-window capture
(`scripts/ui-capture.sh` driving paste → prettify → minify). BOTH built `.app`s
launch to the **tray with no foreground window**, and the tray "Show TinkerDev"
JS window-show path did NOT surface a window under Accessibility automation (AX
`count of windows` = 0 for 20s after a clean launch) — the documented
`window-mutation-needs-a-capability` limitation (JS `window.show/setFocus` is
silently rejected without the capability grant; invisible to headless AX drive).
This is a launcher/window-show constraint, **not an HTML-tool defect**: the tool's
feature flow (mount, async prettify with embedded-JS formatting, minify, BOTH
D-11 line:col error paths, recovery, no-remote) is proven GREEN on the real
WKWebView in Task 1 (`test/e2e/html-formatter.e2e.ts`, screenshot Read showing
the mounted HTML tool + Mode/Indent/Width controls + Copy). Per the harness
("human only launches/tests/approves"), the native-window visual review + both
theme captures are part of the human walkthrough below.

## Wi-Fi-off Network-tab evidence — one row per (channel × mode)

Recorded DURING the human walkthrough (steps 3/4/8 of Task 2). EXPECT: zero remote
requests; only the local/asset criteria above.

| Channel  | Mode     | Wi-Fi | Formatted OK? | Remote requests (Network tab) | Result |
|----------|----------|-------|---------------|-------------------------------|--------|
| direct   | Prettify | OFF   | _TBD_         | _TBD_ (expect: 0 remote)      | _TBD_  |
| direct   | Minify   | OFF   | _TBD_         | _TBD_ (expect: 0 remote)      | _TBD_  |
| appstore | Prettify | OFF   | _TBD_         | _TBD_ (expect: 0 remote)      | _TBD_  |
| appstore | Minify   | OFF   | _TBD_         | _TBD_ (expect: 0 remote)      | _TBD_  |

## D-11 error categories (calm role=alert line:col, no crash) — walkthrough confirm

| Category | Mode | Input | Expected | Observed |
|----------|------|-------|----------|----------|
| embedded-code (esbuild) | Minify | `<script>function(</script>` | calm role=alert line:col, output empty, recovers | _TBD_ |
| html-structure (Prettier html parser) | Prettify | `<div><span>hi</div>` | calm role=alert `1:14 …` (line:col), output empty, recovers | _TBD_ |

(Both are ALSO proven GREEN on the real WKWebView in Task 1's spike.)

## WCAG-AA (PRT-12) — gsd-ui-review audit

<!-- Record the gsd-ui-review WCAG-AA result on the HTML tool: visible focus on all
     mode/indent/width segments + copy, AA contrast, no opacity-only disabled state. -->

- **Result:** _TBD_

## Sign-off

- **Human resume-signal:** _TBD_ ("approved" once all four channel×mode rows are filled with zero-remote evidence AND both D-11 categories calm with line:col AND WCAG-AA passes).
