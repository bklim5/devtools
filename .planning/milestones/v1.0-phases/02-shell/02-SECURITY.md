# SECURITY.md — Phase 02: Shell & Navigation

**Phase:** 02 — Shell & Navigation
**Plan:** 01 — App Shell & Layout (`.planning/phases/02-shell/01-app-shell-layout/`)
**Scenario:** C — general security audit. No threat model was authored in the plan-prose artifacts (grep for `threat|security|csp|vulnerab` across PLAN/RESEARCH/SUMMARY returns nothing). The threat model below is derived retroactively from the implemented attack surface. NOTE: the *code* carries an informal in-code threat register — threat IDs `T-01-10`, `T-01-11`, `T-02-01`, `T-02-02`, `T-02-04`, `T-02-07`, `T-02-08`, `T-02-10` appear in comments. This audit reconciles those against the implementation and fills the gaps.
**Date:** 2026-05-30
**Auditor:** GSD security auditor (read-only; no source modified)
**ASVS target:** L1 (`.planning/config.json` → `asvs_level: 1`); `block_on: open`

## Audit scope

Phase 02 added the persistent app shell, the registry-driven sidebar, the ⌘K command palette, HashRouter routing with a single startup-tool-resolution seam, last-used / recent-tools persistence (tauri-plugin-store → `prefs.json`, with a localStorage / in-memory fallback behind the platform seam), and the header chrome. Foundational global config (Tauri capabilities, CSP, Rust core) is in scope because the shell inherits it.

All in-scope files were read and verified directly:
- `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`
- `src/router.tsx`, `src/main.tsx`, `src/App.tsx`, `index.css`, `index.html`
- `src/lib/platform/{index,tauri,browser,stub}.ts`, `src/lib/tools/registry.ts`
- `src/shell/{prefsStore,preferences,resolveStartupTool,parseHashTarget,StartupRedirect,useTrackActiveTool,usePreferences,useRecentTools}.{ts,tsx}`
- `src/components/{CommandPalette,Sidebar}.tsx`

## Derived threat model

| # | Threat | Attack vector | Disposition | Status | Evidence |
|---|--------|---------------|-------------|--------|----------|
| T1 | Remote code / asset injection into WKWebView (CSP) | Injected/inline script or remote origin executes in webview | mitigate | **CLOSED** | `tauri.conf.json:24` sets an explicit CSP: `default-src 'self'; img-src 'self' asset: data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost`. No remote origins, no `unsafe-eval`, `script-src 'self'`. Residual: `style-src 'unsafe-inline'` (R1). |
| T2 | Runtime network use / exfiltration (offline constraint) | `fetch`/XHR/WebSocket/CDN call phones home | mitigate | **CLOSED** | grep for `fetch(`/`XMLHttpRequest`/`WebSocket`/`https?://` in `src/` = only a doc-comment URL in `decoder.ts`; `index.html` loads no external resource; CSP `connect-src 'self' ipc:` blocks remote egress |
| T3 | External-font / CDN load (offline constraint) | `@font-face`/`<link>` to googleapis/CDN at runtime | mitigate | **CLOSED** | `index.css:6-14` vendors fonts via `@fontsource/*` `@import`s that Vite resolves to bundled woff2 at build time (emitted to `dist/assets/*.woff2`); the comment explicitly notes the Google Fonts CDN was deliberately dropped. `font-src 'self' data:` in CSP. Zero runtime font fetch. |
| T4 | Over-broad Tauri capabilities | Compromised webview abuses fs/shell/http permissions | mitigate | **CLOSED** | `capabilities/default.json:6-11` grants only `core:default`, `clipboard-manager:allow-read-text`, `clipboard-manager:allow-write-text`, `store:default`. No `fs`/`shell`/`http`/`dialog`. Scoped `windows:["main"]` |
| T5 | Unscoped/unvalidated IPC commands | Frontend `invoke` reaches an unguarded Rust command | n/a by design | **CLOSED** | No `invoke(` anywhere in `src/` (grep clean); `lib.rs:3-12` registers NO custom commands — only `tauri_plugin_clipboard_manager` + `tauri_plugin_store` plugins |
| T6 | Debug/automation server shipped in release | Embedded WebDriver W3C server (127.0.0.1:4445) compiled into a shipped build | mitigate | **CLOSED (exemplary)** | `lib.rs:27` double-gates the webdriver plugin on `#[cfg(all(debug_assertions, feature = "webdriver"))]`; `Cargo.toml:36,39-41` makes the dep `optional` behind the `webdriver` feature. Release builds exclude both the crate and its server (threats T-01-10 / T-01-11, documented inline). Bound to localhost only. |
| T7 | Dynamic code execution in palette / nav | User/registry input → `eval`/`new Function`/dynamic `import()`/innerHTML | mitigate | **CLOSED** | `CommandPalette.tsx:119` navigates via `navigate(\`/tools/${tool.id}\`)`, renders names as text; `Sidebar.tsx:25` builds `to={\`/tools/${tool.id}\`}` from `ENABLED_TOOLS` only. No `dangerouslySetInnerHTML`/`eval`/`new Function` in `src/` (grep clean). The only dynamic `import()` is the lazy `import("./tauri")` gated by `isTauri()` in `platform/index.ts:67` |
| T8 | Tampered `prefs.json` → navigate to / persist a bad tool id | Untrusted local file injects unknown/malicious recent or last-used id | mitigate | **CLOSED** | Every consumer validates ids through `getToolById` (ENABLED_TOOLS only) before use: palette recents `CommandPalette.tsx:40`; startup resolver `resolveStartupTool.ts:27-28`; on-navigation recorder `useTrackActiveTool.ts:30`. A bogus `#/tools/evil` can never render, navigate, or be persisted as last-used (threats T-02-07 / T-02-08 / T-02-10) |
| T9 | Open-redirect / route injection via hash | Crafted `#/...` drives navigation to attacker target | mitigate | **CLOSED** | `router.tsx:2,35` uses `createHashRouter` (no BrowserRouter — static-file 404 + redirect safety). `parseHashTarget.ts:11` extracts only the `#/tools/<id>` segment via a strict regex and `decodeURIComponent`s the id; the result is explicitly UNVALIDATED and run through `getToolById` in `resolveStartupTool` before any `Navigate` (`StartupRedirect.tsx:28-30`). Unknown routes resolve to the validated startup tool, never an arbitrary target |
| T10 | Persisted-prefs schema abuse / prototype pollution | `JSON.parse` of attacker-controlled `prefs.json` with `__proto__`/unexpected shape used downstream | mitigate | **CLOSED** | `prefsStore.ts:53-64` `mergePreferences` never trusts the stored shape — it reads only known fields off the blob and coerces each by type (`coerceTheme`/`coerceAccent`/`coerceLastUsedId`/`normalizeRecents`), building a fresh object literal over `DEFAULT_PREFERENCES`. No spread/merge of the raw parsed object, so `__proto__`/`constructor` keys are never written onto a prototype. Corrupt/non-JSON → `undefined` (`browser.ts:28-32`) → defaults. Reads treated as untrusted (threat T-02-02/T-02-08) |
| T11 | Store split-brain / async-init race | Reads before `initPlatform()` resolves hit localStorage instead of `prefs.json` | mitigate | **CLOSED (design)** | `platform/index.ts:44-82` memoises `initPlatform()`; `prefsStore.ts:76,87` `await initPlatform()` on every load/save so reads and writes always hit the SAME real store (matches the recorded fix). Data-integrity hardening; no direct security impact |
| T12 | Platform-abstraction bypass | A component imports `@tauri-apps/*` directly, escaping the audited seam | mitigate | **CLOSED** | grep for `@tauri-apps` outside `src/lib/platform/` returns only doc-comments asserting the rule. `@tauri-apps/*` is imported ONLY in `platform/tauri.ts:7-8`, reached exclusively via the lazy `import("./tauri")` in `platform/index.ts:67` (gated on `__TAURI_INTERNALS__`) |
| T13 | Clipboard abuse (silent read/write) | Plugin reads/writes clipboard beyond user intent | accept | **CLOSED (residual)** | Capability grants read + text-write; seam in `platform/tauri.ts:36-39` / `browser.ts:40-56`. Acceptable for a copy/paste devtool. Residual: both always granted (R2) |
| T14 | Auto-update supply-chain (unsigned/HTTP) | Malicious / MITM'd update payload | n/a this phase | **N/A** | No updater dep in `Cargo.toml`; no `updater`/`endpoints`/`pubkey` in `tauri.conf.json`. Defer to the auto-update phase (R3) |

**Threats assessed: 14. Closed: 13 (incl. T11 design-closed). N/A this phase: 1 (T14). Open blockers under `block_on: open`: 0.**

## Findings / remediation (severity-ranked)

### LOW — CSP allows `style-src 'unsafe-inline'` (T1 residual)
**Evidence:** `src-tauri/tauri.conf.json:24`.
**Why it matters:** The CSP is otherwise tight (no remote origins, no `unsafe-eval`, `script-src 'self'`). `style-src 'unsafe-inline'` is the one loosened directive — almost always required by Tailwind's runtime/utility styles and far lower risk than script injection (no script execution vector). It does slightly widen CSS-injection / data-exfil-via-CSS surface, but with `connect-src 'self'` and no remote origins the practical impact is minimal. Acceptable at L1.
**Remediation (R1):** If the Tailwind v4 build allows it, move to nonce/hash-based styles and drop `'unsafe-inline'`; otherwise document as an accepted residual. Re-evaluate before the Protobuf decoder renders untrusted bytes.

### INFO — Clipboard read+write always granted (T13 residual)
**Remediation (R2):** Narrow clipboard permissions to the minimum the UX needs if feasible; both read and write are currently granted app-wide.

### INFO — Auto-update not yet present (T14, future phase)
**Remediation (R3):** When auto-update lands, require signed updates over HTTPS with a pinned public key in `tauri.conf.json`; re-audit at that time.

## Additional observations (non-blocking, positive)

- **Build-time attack-surface control (exemplary):** the webdriver double-gate (`debug_assertions` AND opt-in feature, `lib.rs:27` / `Cargo.toml:36`) with inline rationale is a model for excluding debug tooling from release artifacts. No action.
- **Defense-in-depth on untrusted ids is consistent:** the same `getToolById` validation is applied at all three consumption points (palette, startup, on-nav recorder) rather than once — a tampered id has no path through.
- **Untrusted-input discipline in the store seam:** `mergePreferences` + `normalizeRecents` (allow-list by field/type, fresh literal) and the `JSON.parse → undefined` fallback are the correct pattern for treating on-disk prefs as untrusted.
- **In-code threat IDs:** the executor references `T-01-xx` / `T-02-xx` across comments. Recommend consolidating these into one tracked register (PROJECT.md or a phase threat-model block) so future audits start from an explicit list rather than reconstructing it.

## Summary verdict

**Posture: STRONG. No open blockers.** This Phase-2 shell holds every core security constraint and several controls are exemplary. Verified CLOSED: explicit non-permissive CSP with `script-src 'self'` and no `unsafe-eval` (T1); confirmed offline with no network/CDN and build-time-vendored fonts (T2/T3); least-privilege Tauri capabilities with no fs/shell/http (T4); zero custom IPC surface (T5); a build-excluded debug/automation server behind a documented double-gate (T6); no dynamic-code sinks (T7); registry-validated id handling at all three consumption points (T8); HashRouter with strict hash parsing and validated startup resolution (T9); prototype-pollution-safe, allow-list prefs merging (T10); an async-init-race-hardened store seam (T11); and a clean single-file platform-abstraction boundary (T12).

No CRITICAL, HIGH, or MEDIUM defects were found. The only residual is **LOW — `style-src 'unsafe-inline'` in the CSP (R1)**, which is acceptable at ASVS L1 and typical for Tailwind; tighten or formally accept it before untrusted-data rendering begins in the decoder phase. T13 (clipboard scope) and T14 (future auto-update signing) are informational.

**Recommended action:** none required for sign-off. Optionally address R1 before the Protobuf-decoder phase.
