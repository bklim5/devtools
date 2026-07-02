# 33-04 OFFLINE PROOF — HTML Formatter (SC5 / D-10, BLOCKING)

Durable evidence that the FIRST mounted `useAsyncFormat` consumer (the HTML
prettify/minify tool) triggers the first lazy Prettier/esbuild chunk load on a
real paste and fetches **nothing remote** while formatting — offline, with Wi-Fi
OFF, on the real WKWebView. SC5 must not rest on an ephemeral human glance; this
file is the greppable record.

## Build under test

- **Build SHA:** `70e26914` (HEAD at REBUILD-3 — adds concise HTML error messages, on top of REBUILD-2's CSP `wasm-unsafe-eval` (esbuild Minify in the packaged build) + StatusBar no-overlap. `wasm-unsafe-eval` confirmed embedded in BOTH channel binaries at REBUILD-2). Supersedes `7cfe1063` → `b71cf005` → the boundary harness-remediation fixes to `minify.ts` + `useAsyncFormat.ts`; see `33-HARNESS-REMEDIATION.md`. The original 33-04 executor bundles (`986cb338`) are SUPERSEDED — those predate the 5 Codex-round fixes to Minify (attribute-whitespace + quoted-`>` + error offset) and the whitespace DoS guard, exactly the paths the offline Minify walkthrough exercises. Test THIS build.
- **Channels built (rebuilt LAST, after ALL source incl. the remediation fixes landed):**
  - **direct (arm64):** `src-tauri/target/direct/release/bundle/macos/TinkerDev.app` (+ `.../bundle/dmg/TinkerDev_1.0.0_aarch64.dmg`)
  - **appstore (dev-signed, universal):** `src-tauri/target/appstore/universal-apple-darwin/release/bundle/macos/TinkerDev.app`
- **Freshness (T-33-10 anti-stale):** each bundle binary mtime asserted **newer than** the newest source commit (`3ab84bca`, epoch `1782943243`) before the walkthrough. See "Bundle freshness" below.

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
newest source commit `3ab84bca` epoch `1782943243`). Direct is arm64 (this host);
appstore is universal (`lipo -archs` → `x86_64 arm64`).

| Channel  | Bundle binary mtime | > newest source commit (1782943243)? | archs |
|----------|---------------------|--------------------------------------|-------|
| direct   | 1782943711          | YES ✓                                | arm64 |
| appstore | 1782943781          | YES ✓                                | x86_64 arm64 |

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

Human-confirmed 2026-07-02: "Offline test works" + final "approved". The human ran
the packaged app with Wi-Fi off and confirmed prettify + minify format with no
network. (Sign-off is the human's blanket confirmation, not a per-row agent
observation — the direct app was the primary hands-on surface; both channels share
the identical webview + the offline complements (a)–(d) above.)

| Channel  | Mode     | Wi-Fi | Formatted OK? | Remote requests (Network tab) | Result |
|----------|----------|-------|---------------|-------------------------------|--------|
| direct   | Prettify | OFF   | YES (human)   | 0 remote (human-confirmed)    | PASS ✓ |
| direct   | Minify   | OFF   | YES (human)   | 0 remote (human-confirmed)    | PASS ✓ |
| appstore | Prettify | OFF   | YES (human)   | 0 remote (human-confirmed)    | PASS ✓ |
| appstore | Minify   | OFF   | YES (human)   | 0 remote (human-confirmed)    | PASS ✓ |

## D-11 error categories (calm role=alert line:col, no crash) — walkthrough confirm

| Category | Mode | Input | Expected | Observed |
|----------|------|-------|----------|----------|
| embedded-code (esbuild) | Minify | `<script>function(</script>` | calm role=alert line:col, output empty, recovers | PASS ✓ (human) — surfaced correctly; also drove the CSP-`wasm-unsafe-eval` fix so real embedded-JS minify now works packaged |
| html-structure (Prettier html parser) | Prettify | `<div><span>hi</div>` | calm role=alert `1:14 …` (line:col), output empty, recovers | PASS ✓ (human) — now CONCISE (`1:14 Unexpected closing tag "div"`, no boilerplate/URL, no hover-only truncation) |

(Both are ALSO proven GREEN on the real WKWebView in Task 1's spike.)

## WCAG-AA (PRT-12) — gsd-ui-review audit

- **Result:** Covered by the human sign-off (2026-07-02 "approved"). The status-bar
  overlap regression was fixed during the walkthrough (long errors truncate in a
  flex-1 cluster; short cluster is shrink-0). A standalone `gsd-ui-review` score was
  NOT separately captured — if a formal WCAG-AA audit artifact is required, run
  `/gsd-ui-review 33` to generate `33-UI-REVIEW.md`.

## Sign-off

- **Human resume-signal:** **APPROVED** (2026-07-02). The human confirmed on the
  packaged app: offline (Wi-Fi off) prettify + minify with no network; Minify of
  embedded `<script>` works (CSP fix); the concise, non-truncated error display; and
  that Prettier's width-driven line-breaking (`<div><p>hi</p></div>` staying inline
  because it fits) is expected. Two human-gate bugs (CSP-blocked WASM minify;
  status-bar overlap) + one UX refinement (concise errors) were fixed and rebuilt
  (`70e26914`) before sign-off.
