# Phase 6: Distribution - Research

**Researched:** 2026-06-01
**Domain:** Tauri 2 macOS distribution — DMG packaging, code signing/notarisation, signature-verifying auto-updater
**Confidence:** HIGH (versions, config shapes, and artifact formats verified against this repo's lockfiles + Tauri 2 official docs; the "wire-but-gate-on-cert" strategy edges are flagged)

## Summary

This phase wires a complete, release-ready macOS distribution path — DMG packaging, ad-hoc signing, the full Tauri 2 minisign-verifying auto-updater (UX + endpoint + key), and all Developer-ID-signing/notarisation config — such that real signing + notarisation become a single config-flip + credentials step once the user enrols in the Apple Developer Program (D-01/D-02). Notarisation does NOT block phase completion; "release-ready, pending cert" is the acceptance shape.

The repo is on **Tauri core 2.11.2** [VERIFIED: src-tauri/Cargo.lock]. The matching plugins are **`tauri-plugin-updater` 2.10.1** (Rust + JS) and **`tauri-plugin-process` (Rust) / `@tauri-apps/plugin-process` 2.3.1** (JS) [VERIFIED: crates.io + npm registry]. The updater's signature verification (minisign, separate from Apple code signing) cannot be disabled — it is core to DST-02. On macOS the build emits TWO distinct artifacts: the **DMG (first-install only)** and a **`.app.tar.gz` + `.app.tar.gz.sig` (the updater payload)** [CITED: v2.tauri.app/plugin/updater + tauri-docs]. This two-artifact reality is the single most important fact for the planner.

The hardest reconciliation is the offline-by-design CSP (`connect-src 'self'`): the updater is the only sanctioned egress (D-09) and must reach GitHub Releases — including the `objects.githubusercontent.com` redirect for asset downloads — without widening network access for any tool. This is solvable with a narrow `connect-src` addition.

**Primary recommendation:** Add `tauri-plugin-updater` 2.10.1 + `tauri-plugin-process` behind the existing `cfg(any(...))` target block and the `src/lib/platform/` seam; generate the minisign keypair now (pubkey committed, private key gitignored env); configure `bundle.macOS` with hardened-runtime entitlements + ad-hoc `signingIdentity: "-"` so Developer-ID activation is purely env-credential-driven; persist the first-run update opt-in via the existing `usePreferences`/`mergePreferences` seam; and ship the check→prompt→verify→install→relaunch flow across the three surfaces (tray / app-menu / dismissible banner). Write a `RELEASE.md` runbook capturing the manual version-bump → build → publish → `latest.json` steps.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Apple Developer Program = **not enrolled yet** → notarisation + Developer-ID signing cannot run this phase.
- **D-02:** Strategy = **wire everything, gate notarisation on the cert.** Ship DMG packaging + ad-hoc signing + full updater + all config. Developer-ID signing + notarisation activate via config-flip + credentials at enrolment. Phase complete in "release-ready, pending cert" state; the "no Gatekeeper warnings" clause is re-verified post-enrolment, NOT a blocker now.
- **D-03:** Notarytool auth (for when it activates) = **App Store Connect API key** (`.p8` + key-id + issuer-id). Chosen over Apple-ID + app-specific-password.
- **D-04:** Configure the standard macOS **hardened-runtime entitlements** required for notarisation as part of the "wired but gated" config (so the flip is genuinely just credentials), respecting the no-network/offline posture.
- **D-05:** This phase = **local gitignored env vars only.** Dev-ID cert in login keychain; notary API key + minisign private key + password as local shell/`.env` exports, gitignored, **never committed**.
- **D-06:** CI phase (deferred) = lift-and-shift identical values into GitHub Actions encrypted secrets. (OUT OF SCOPE here.)
- **D-07:** Artifacts (DMG, updater `.sig`) + manifest hosted on **GitHub Releases**; updater endpoint points at a stable GitHub Release URL.
- **D-08:** Manifest style = **static `latest.json`** (Tauri default), fetched + version-compared. Chosen over GitHub's dynamic endpoint.
- **D-09:** Update trigger = **opt-in on first run.** Ask once on first launch; persist via the Phase-2 Store/prefs seam. If enabled, silent check at launch; if not, no automatic network call ever. **Manual check always available** regardless of toggle. Preserves offline-by-design.
- **D-10:** Apply flow = **prompt → install on user confirm.** Newer version → "vX.Y available" + notes + Install/Later. On Install: download → **verify signature** → relaunch (satisfies DST-02 verify-before-apply).
- **D-11:** Surfaces (three): (a) **tray menu** "Check for Updates…"; (b) **native About / app-menu** entry; (c) **dismissible in-app banner** shown whenever a newer version is detected (reappears on subsequent detections/launches while still outdated; dismissible each time).
- **D-12:** Updater reached through the **`src/lib/platform/` seam** — tools/shell never import `@tauri-apps/*` directly. Browser/jsdom fallbacks are harmless no-ops.
- **D-13:** In-app banner must be **layout-agnostic** (responsive Tailwind, no fixed widths) and meet **WCAG-AA** (visible focus, AA contrast, keyboard-reachable dismiss, no opacity-only states).
- **D-14:** Release build = **local `pnpm tauri build`** on the user's Mac this phase (signed DMG + updater artifacts). CI deferred.
- **D-15:** Updater signing key = **generate the Tauri minisign keypair now** (`tauri signer generate`). Public key committed to `tauri.conf.json`; private key + password local gitignored env. Verification wired against the pubkey.
- **D-16:** Versioning = **manual version bump now** (`tauri.conf.json` + `package.json`) captured in a **`RELEASE.md` runbook** (build → publish GitHub Release → update `latest.json`). CI-driven later (deferred).

### Claude's Discretion
- Hardened-runtime entitlement specifics, DMG window layout/background/icon positioning, exact `tauri.conf.json` updater block shape, banner copy/placement, and `RELEASE.md` structure — within the decisions above.
- Reconciling updater network access with CSP `connect-src 'self'` — determine the minimal CSP/capability change for the GitHub Releases endpoint while keeping all tool runtime offline.

### Deferred Ideas (OUT OF SCOPE)
- **CI / release-automation phase (NEW):** GitHub Actions pipeline (sign, notarise, build DMG, publish, update `latest.json`, read secrets from Actions) — destination for D-06/D-14/D-16's "eventually CI" clauses.
- **Apple Developer Program enrolment** — user completes out-of-band; notarisation + DST-01 Gatekeeper-clean re-verify after.
- **Windows + Linux signing/packaging** — deferred (macOS-only now).
- **Backlog (unrelated):** Protobuf decimal-byte-array input mode — tracked in STATE.md, not this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DST-01** | macOS build is code-signed + notarised, packaged as a DMG that installs past Gatekeeper | DMG already a bundle target (`bundle.targets: ["app","dmg"]`). This phase adds `bundle.macOS` (entitlements, hardenedRuntime, signingIdentity) wired for ad-hoc NOW + Developer-ID/notarisation via env-credentials LATER (D-02/D-03/D-04). **Notarisation/Gatekeeper-clean re-verified post-enrolment — not a phase blocker.** See § "macOS Signing / Notarisation (Wired but Gated)". |
| **DST-02** | Auto-updater wired + verifies updates before applying | `tauri-plugin-updater` 2.10.1 + `tauri-plugin-process` behind the platform seam; minisign signature verification is mandatory and on-by-default in the plugin (cannot be disabled). check→prompt→verify→install→relaunch flow (D-09/D-10/D-11). See § "Updater Wiring" + "Updater UX Flow". |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

The planner MUST NOT recommend approaches that contradict these. They have locked-decision authority.

- **HashRouter only** — `BrowserRouter` forbidden. (Banner + any update UI must not introduce routing.)
- **No network at runtime** — self-hosted fonts, CSP. **The updater is the ONLY sanctioned network egress** and must be explicitly opt-in (D-09). Minimal CSP widening only.
- **`src/lib/platform/` seam** — tools/shell never import `@tauri-apps/*` directly. The updater capability lives behind this seam (D-12), mirroring `clipboard`/`store`/`window`/`nativeShortcut` (real impl in `tauri.ts`, no-op in `browser.ts`).
- **Six tools only**; do **NOT** refactor `decoder.ts` or its **19 tests** (immovable bar).
- **Least-privilege Tauri capabilities** — specific allow-lists, no wildcards (Phase-5 precedent).
- **Binding per-task DoD (in order):** `/simplify` → `/codex:review` → unit (vitest + tsc clean) → real-WKWebView UI verification. **Per-phase:** human sign-off on a fresh `tauri build` + passing `gsd-ui-review` WCAG-AA audit.

## Standard Stack

### Core (verified against this repo's Tauri 2.11.2 line)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri-plugin-updater` (Rust) | **2.10.1** | Updater backend: fetch manifest, download, minisign-verify, swap bundle | Official Tauri 2 updater; mandatory signature verify [VERIFIED: crates.io max_stable 2.10.1] |
| `@tauri-apps/plugin-updater` (JS) | **2.10.1** | JS `check()` / `update.downloadAndInstall()` API | Official JS counterpart [VERIFIED: npm 2.10.1] |
| `tauri-plugin-process` (Rust) | latest 2.x | `relaunch()` backend so the app restarts into the new bundle after install | Required by the updater apply flow [CITED: v2.tauri.app/plugin/updater] |
| `@tauri-apps/plugin-process` (JS) | **2.3.1** | JS `relaunch()` | Official JS counterpart [VERIFIED: npm 2.3.1] |

> **Version note:** Tauri's own internal compat range is what matters — the updater/process plugins are published on their own cadence (2.10.1 / 2.3.1), NOT lockstep with core 2.11.2. This is normal for Tauri 2 plugins (cf. clipboard-manager 2.3.2, store 2.4.3, global-shortcut 2.3.2 already in this repo). Pin to the exact versions above to match the repo's existing pinning style. [VERIFIED: package.json/Cargo.toml pin every plugin]

### Supporting (already present — no install needed)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| `tauri` (Rust, `tray-icon`) | 2.11.2 | App runtime + tray for "Check for Updates…" item | Tray menu already built in `lib.rs` `setup()` |
| `@tauri-apps/plugin-store` | 2.4.3 | Persists the first-run update opt-in via `usePreferences` | Seam already real (Phase 2) |
| `@tauri-apps/api` | ^2 | (Optional) app-menu construction if a native About item is added in Rust | — |

### Installation
```bash
# Rust (target-scoped, into the existing cfg(any(...)) block in Cargo.toml)
cargo add tauri-plugin-updater@2.10.1 --target 'cfg(any(target_os = "macos", windows, target_os = "linux"))'
cargo add tauri-plugin-process            # not target-scoped; needed on all desktop

# JS
pnpm add @tauri-apps/plugin-updater@2.10.1 @tauri-apps/plugin-process@2.3.1
```

**Version verification done this session:**
- `tauri-plugin-updater` 2.10.1 — max_stable on crates.io [VERIFIED]
- `@tauri-apps/plugin-updater` 2.10.1 — npm `latest` [VERIFIED]
- `@tauri-apps/plugin-process` 2.3.1 — npm `latest` [VERIFIED]
- repo core `tauri` 2.11.2 — Cargo.lock [VERIFIED]

> Confirm `tauri-plugin-process` Rust version with `cargo add` output at plan time (crates.io probe was sandbox-blocked this session — JS counterpart 2.3.1 verified, Rust likely 2.3.x). [ASSUMED — confirm at install]

## Architecture Patterns

### Pattern 1: Updater behind the platform seam (D-12) — MANDATORY
Mirror the existing `clipboard`/`store`/`window`/`nativeShortcut` accessors. The `Platform` interface gains an `updater` surface; the real impl imports `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process` **only in `tauri.ts`**; `browser.ts` is a no-op.

```typescript
// src/lib/platform/index.ts — add to Platform interface
export interface UpdateInfo { version: string; notes: string | null; date: string | null; }
export interface Platform {
  // ...existing clipboard/store/window/nativeShortcut...
  /** Auto-updater (DST-02). No-op (resolves "no update") in the browser fallback. */
  updater: {
    /** Fetch manifest + compare version. Resolves null when up-to-date or unavailable. */
    check(): Promise<UpdateInfo | null>;
    /** Download → minisign-verify → install → relaunch. Throws on signature mismatch. */
    downloadAndInstall(onProgress?: (pct: number) => void): Promise<void>;
  };
}
```
```typescript
// src/lib/platform/tauri.ts — the ONLY @tauri-apps importer
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
// updater: {
//   async check() {
//     const u = await check();              // null when no update
//     return u && { version: u.version, notes: u.body ?? null, date: u.date ?? null };
//   },
//   async downloadAndInstall(onProgress) {
//     const u = await check();
//     if (!u) return;
//     await u.downloadAndInstall(/* progress event → onProgress */);  // verifies sig internally
//     await relaunch();
//   },
// }
```
```typescript
// src/lib/platform/browser.ts — harmless no-op (jsdom/vite preview never throw)
// updater: { async check() { return null; }, async downloadAndInstall() {} },
```
> **Seam subtlety (carries the Phase-5 lesson):** widening `Platform` breaks `tsc` on EVERY inline `Platform` test stub (router.test, testStore, tool tests), not just `platform.test.ts`. Phase 5 solved this by exporting shared `noopWindow`/`noopNativeShortcut` from `src/shell/testStore.ts`. Add a `noopUpdater` there the same way. [VERIFIED: STATE.md 05-02 deviation note]

### Pattern 2: First-run opt-in via the existing prefs seam (D-09)
Add ONE field to the `Preferences` schema and coerce it in `mergePreferences` (the untrusted-merge coercer), exactly like `protobufTreeStyle` was added in Phase 3.

```typescript
// src/shell/preferences.ts
export interface Preferences {
  // ...existing...
  /** null = first-run (ask once); true/false = user's auto-update-check choice (D-09). */
  autoUpdateCheck: boolean | null;
}
// DEFAULT_PREFERENCES.autoUpdateCheck = null;   // null distinguishes "never asked" from "declined"
```
- `null` → first launch shows the one-time opt-in prompt; set to `true`/`false` on answer.
- `true` → silent `platform.updater.check()` at launch (after `initPlatform()` resolves, in the `main.tsx` preload chain).
- `false` → no automatic network call ever.
- **Manual check** ("Check for Updates…" tray/menu + banner) calls `check()` regardless of the toggle (D-09).
- Coerce in `mergePreferences`: only `true`/`false` honored; anything else → `null` (threat: untrusted persisted value). [VERIFIED: usePreferences.ts + STATE.md 03-01 `coerceTreeStyle` precedent]

### Pattern 3: Launch-time check hook in `main.tsx`
Chain off the existing memoised `initPlatform()` preload — the same pattern Phase 5's `registerSummon()` used (await init, then act, single `.catch`, never blocks first paint). Read `autoUpdateCheck` from the prefs store; if `true`, fire a non-blocking `platform.updater.check()` and surface the banner on a hit. [VERIFIED: main.tsx preload chain + STATE.md 05-03]

### Recommended file structure (additions only)
```
src-tauri/
├── tauri.conf.json          # + plugins.updater block, + bundle.createUpdaterArtifacts, + bundle.macOS
├── Cargo.toml               # + tauri-plugin-updater (cfg block), + tauri-plugin-process
├── capabilities/default.json# + "updater:default", "process:allow-restart"
├── entitlements.plist       # NEW — hardened-runtime entitlements (D-04)
└── src/lib.rs               # + .plugin(process), + updater plugin in setup(); + "Check for Updates…" tray item
src/
├── lib/platform/{index,tauri,browser}.ts   # + updater surface (D-12)
├── shell/
│   ├── preferences.ts       # + autoUpdateCheck field
│   ├── testStore.ts         # + noopUpdater stub
│   └── update.ts            # NEW — orchestrates check→prompt→verify→install→relaunch
└── components/
    └── UpdateBanner.tsx      # NEW — dismissible, layout-agnostic, WCAG-AA (D-13)
docs/
└── RELEASE.md               # NEW — manual release runbook (D-16)
.env / .envrc (gitignored)   # TAURI_SIGNING_PRIVATE_KEY(+_PASSWORD), APPLE_* (D-05/D-15)
~/.tauri/devtools.key(.pub)  # minisign keypair (private gitignored; pub committed to conf)
```

### Anti-Patterns to Avoid
- **Importing `@tauri-apps/plugin-updater` outside `tauri.ts`** — breaks the seam (grep-audited every phase). [CLAUDE.md]
- **Trying to update via the DMG** — the updater consumes the `.app.tar.gz`, NOT the DMG. The DMG is first-install only. Mismatching these breaks the round-trip.
- **Broadening CSP to `connect-src *` or `https:`** — violates offline-by-design. Scope to the exact GitHub hosts only.
- **Treating Apple code signing and minisign updater signing as the same thing** — they are independent. Minisign verifies the *update payload* (mandatory, DST-02); Apple signing verifies the *app identity* for Gatekeeper (DST-01, gated on cert).

## Updater Wiring (the exact config the planner needs)

### `tauri.conf.json` additions
```jsonc
{
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],
    "createUpdaterArtifacts": true,   // emits .app.tar.gz + .app.tar.gz.sig (Tauri 2 native; NOT "v1Compatible")
    "macOS": { /* see signing section */ }
  },
  "plugins": {
    "updater": {
      "pubkey": "<CONTENT OF ~/.tauri/devtools.key.pub — minisign public key, committed; it is public>",
      "endpoints": [
        "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
      ]
      // NO "windows" installMode block needed — macOS-only this phase
    }
  }
}
```
> **Endpoint choice:** the `releases/latest/download/latest.json` URL is a stable GitHub redirect to the newest release's `latest.json` (D-08 static manifest). The plugin substitutes `{{target}}`/`{{arch}}`/`{{current_version}}` if present in the URL, but a static `latest.json` listing all platforms does NOT require them — the plugin reads the manifest and picks `darwin-aarch64` / `darwin-x86_64` itself. [CITED: v2.tauri.app/plugin/updater]

### `Cargo.toml`
Add `tauri-plugin-updater` into the **existing** `cfg(any(target_os = "macos", windows, target_os = "linux"))` block (next to single-instance/global-shortcut/window-state). Add `tauri-plugin-process` to the main `[dependencies]` (it is desktop-wide, not target-gated). [VERIFIED: Cargo.toml current structure]

### `lib.rs`
```rust
// .plugin(tauri_plugin_process::init())   // add to the builder chain
// in setup():
//   #[cfg(desktop)]
//   app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
```
Plus a new `MenuItem::with_id(app, "check_updates", "Check for Updates…", true, None)` in the tray menu, wired in `on_menu_event` to emit an event the JS shell listens for (or invoke a command) — the actual `check()` runs in JS through the seam. [CITED: v2.tauri.app/plugin/updater lib.rs snippet]

### `capabilities/default.json`
Add to the existing `permissions` array (least-privilege — only what's used, no wildcards):
```json
"updater:default",
"process:allow-restart"
```
[CITED: v2.tauri.app/plugin/updater + VERIFIED: current default.json already uses the *:default / *:allow-* pattern]

## Minisign Updater Signing (D-15 — DST-02 verify-before-apply)

```bash
pnpm tauri signer generate -- -w ~/.tauri/devtools.key
# → ~/.tauri/devtools.key (PRIVATE — gitignored) and ~/.tauri/devtools.key.pub (PUBLIC)
```
- **Public key** → paste into `plugins.updater.pubkey` in `tauri.conf.json` (committed; it is public by design — it verifies, it cannot sign). [VERIFIED: D-15]
- **Private key + password** → supplied at build time as env vars, gitignored, never committed:
  ```bash
  export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/devtools.key)"   # or the file path
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<password>"
  ```
- At `pnpm tauri build` (with `createUpdaterArtifacts: true`), Tauri signs the `.app.tar.gz` with the private key, producing `.app.tar.gz.sig`. The `.sig` content goes into `latest.json`'s `platforms.<key>.signature`.
- **Verification:** at update time the updater downloads the payload + reads the `signature` from `latest.json`, and verifies it against the committed `pubkey` BEFORE applying. A mismatch throws — this IS the DST-02 verify-before-apply mechanism. The check is mandatory and cannot be disabled. [CITED: v2.tauri.app/plugin/updater]

> **`.env` gitignore status:** the current `.gitignore` ignores `*.local`, `dist/`, `node_modules/`, `src-tauri/target/`, `.claude/`, `.agents/` — but does NOT yet ignore `.env`/`.envrc`. **The plan must add `.env`/`.envrc` (and `*.key`) to `.gitignore`** before any secret touches the tree (D-05). [VERIFIED: .gitignore read this session]

## macOS Signing / Notarisation (Wired but Gated — D-02/D-03/D-04)

The goal: ad-hoc signing works NOW; Developer-ID + notarisation activate via env-credentials + ONE config value LATER, with zero structural change.

### `bundle.macOS` in `tauri.conf.json`
```jsonc
"macOS": {
  "signingIdentity": "-",                 // ad-hoc NOW (D-02). At enrolment → "Developer ID Application: <Name> (<TeamID>)" OR drive via env APPLE_SIGNING_IDENTITY
  "hardenedRuntime": true,                // required for notarisation (D-04) — set NOW so the flip is just credentials
  "entitlements": "entitlements.plist",   // see below (D-04)
  "minimumSystemVersion": "10.15"         // discretion; choose per target
  // "providerShortName": "<TeamID>"      // ADD at enrolment (D-03) — only needed for Developer-ID/notarisation
}
```

### What is env/credential-driven vs file-committed
| Value | This phase | At enrolment | Mechanism |
|-------|-----------|--------------|-----------|
| `signingIdentity` | `"-"` (ad-hoc) | Developer-ID identity | Set `APPLE_SIGNING_IDENTITY` env (overrides config) OR flip the config string [CITED: macos sign docs] |
| `hardenedRuntime` | `true` (committed) | unchanged | committed now |
| `entitlements.plist` | committed | unchanged | committed now |
| `providerShortName` | omitted | `<TeamID>` | one config add at enrolment |
| Notary auth | absent | `.p8` + key-id + issuer-id | env: `APPLE_API_KEY` (key-id), `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` (D-03) [CITED: macos sign docs] |
| Notarisation trigger | none (ad-hoc can't notarise) | automatic when `APPLE_*` env present at `tauri build` | env presence drives it [CITED] |

> **The flip is genuinely "just credentials + 1 line":** hardenedRuntime + entitlements are committed now. At enrolment the user (a) exports `APPLE_API_KEY`/`APPLE_API_ISSUER`/`APPLE_API_KEY_PATH` + `APPLE_SIGNING_IDENTITY`, (b) adds `providerShortName`, (c) rebuilds. Tauri notarises automatically when the notary env vars are present. [CITED: v2.tauri.app/distribute/sign/macos]

### Standard hardened-runtime entitlements for an OFFLINE Tauri app (D-04)
Tauri's WKWebView uses JIT, so the JIT/unsigned-memory entitlements are standard. **Do NOT add the network client/server entitlements** — the app is offline by design; the updater egress is an outbound HTTPS fetch that does not require a network *entitlement* (entitlements gate sandbox capabilities, not plain outbound HTTP from a non-sandboxed Developer-ID app). A minimal offline `entitlements.plist`:
```xml
<!-- entitlements.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
</dict></plist>
```
> `disable-library-validation` is commonly required because Tauri/webview loads frameworks not signed by the same Team ID. Verify against a real notarisation once the cert exists; the set above is the standard offline-app baseline. [ASSUMED — exact entitlement set should be confirmed at the post-enrolment notarisation re-verify; this is the documented common baseline for Tauri/Electron-class apps]

## CSP / Capability Reconciliation (the offline-by-design edge)

Current CSP: `... connect-src 'self' ipc: http://ipc.localhost`. The updater must reach GitHub Releases for `latest.json` + the `.app.tar.gz`.

**GitHub Releases asset downloads redirect** from `github.com/.../releases/download/...` to **`objects.githubusercontent.com`** (and the release page assets can come from `*.githubusercontent.com`). The `latest.json` "latest/download" URL also redirects. So both hosts must be reachable. [VERIFIED: well-documented GitHub asset-redirect behavior]

**Minimal `connect-src` change** — add ONLY the two GitHub hosts, nothing wildcard:
```
connect-src 'self' ipc: http://ipc.localhost https://github.com https://objects.githubusercontent.com
```
- This widens *only* `connect-src` (network fetch), and *only* to GitHub. No tool ever calls these hosts; the updater is the sole caller, gated behind the opt-in (D-09). Tool runtime stays offline.
- `default-src 'self'`, `script-src 'self'`, `font-src`, `img-src`, `style-src` are **unchanged** — no fonts/scripts/styles/images load from the network.

> **Open verification:** confirm whether the Tauri updater's HTTP client is subject to the webview CSP at all, or whether it runs in the Rust process (outside webview CSP). Tauri's updater downloads happen in **Rust** (the plugin uses a Rust HTTP client), so the **CSP may not even gate the download** — but `check()`/manifest fetch behavior and any webview-initiated fetch should be tested on the real WKWebView. Add the `connect-src` hosts defensively (harmless, scoped) and verify the round-trip works without broader CSP. [ASSUMED — the Rust-side download likely bypasses webview CSP; verify on the real build. Flag: this is a sharp edge — do NOT assume CSP is the blocker without testing.]

## `latest.json` Manifest + Release Runbook (D-07/D-08/D-16)

### `latest.json` schema (static, hosted on the GitHub Release)
```json
{
  "version": "0.2.0",
  "notes": "What changed in this release.",
  "pub_date": "2026-06-01T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<contents of devtools-app.app.tar.gz.sig for the arm64 build>",
      "url": "https://github.com/<owner>/<repo>/releases/download/v0.2.0/devtools-app_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "<contents of the x86_64 .app.tar.gz.sig>",
      "url": "https://github.com/<owner>/<repo>/releases/download/v0.2.0/devtools-app_x64.app.tar.gz"
    }
  }
}
```
[CITED: v2.tauri.app/plugin/updater manifest schema; platform keys are `OS-ARCH`]

> **Per-arch decision (pitfall):** the build host's arch determines the artifact. A Mac on Apple Silicon produces `darwin-aarch64`; Intel users won't be served unless an `x86_64` build is also published (or a **universal** binary via `tauri build --target universal-apple-darwin`, which produces ONE `.app.tar.gz` that satisfies both — but updater platform-key matching with universal binaries is a known rough edge). **Recommendation:** for the local-build v1 (D-14), ship the build host's arch and document the gap in `RELEASE.md`; revisit universal/both-arch in the CI phase. [CITED + ASSUMED on universal-key matching — flag for the planner.]

### `RELEASE.md` runbook (D-16) — manual steps to capture
1. Bump version in **both** `src-tauri/tauri.conf.json` (`version`) and `package.json` (`version`) — keep them in sync (both are `0.1.0` now). [VERIFIED]
2. `export TAURI_SIGNING_PRIVATE_KEY=… TAURI_SIGNING_PRIVATE_KEY_PASSWORD=…` (and, post-enrolment, `APPLE_*`).
3. `pnpm tauri build` → produces `target/release/bundle/dmg/*.dmg`, `bundle/macos/*.app.tar.gz`, `*.app.tar.gz.sig`.
   - **DMG flake mitigation (STATE.md 2026-06-01):** unmount stray DMGs first — `hdiutil info` then `hdiutil detach <node>`; the `bundle_dmg.sh`/AppleScript step fails when other DMGs are mounted. Retry the build clean.
4. Create a GitHub Release tagged `vX.Y.Z`; upload the DMG + `.app.tar.gz`.
5. Read the `.app.tar.gz.sig` contents → paste into `latest.json` `signature`; set `url` to the uploaded asset's `releases/download/...` URL; bump `version`/`pub_date`/`notes`.
6. Upload `latest.json` to the same release (so `releases/latest/download/latest.json` resolves).
7. Verify: install the DMG, run the OLD version, trigger "Check for Updates…", confirm prompt → install → relaunch into the new version.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Update signature verification | Custom hash/signature check | `tauri-plugin-updater` (minisign, mandatory) | Verification is built-in, cryptographically correct, can't be disabled — DST-02 is satisfied by config, not code |
| Version comparison | Custom semver parser | The plugin's `check()` | It compares `latest.json.version` to the app version internally |
| Relaunch-into-new-bundle | `std::process` / `execvp` calls | `@tauri-apps/plugin-process` `relaunch()` | macOS bundle-swap + re-exec is fiddly; the plugin handles it [GitHub #11392 shows hand-rolled restart is buggy] |
| DMG layout/build | Custom `hdiutil` scripting | Tauri's `dmg` bundle target | Already working (STATE.md: green build); only needs unmount-stray-DMG hygiene |
| Notarisation/stapling | `notarytool` shell wrapper | Tauri's built-in notarisation (env-driven) | Automatic when `APPLE_*` env present at build [CITED] |

**Key insight:** nearly all of DST-01/DST-02 is *configuration*, not application code. The only real code is the thin platform-seam updater accessor + the UX (banner, prompt, opt-in persistence). Everything cryptographic is the plugin's job.

## Updater UX Flow (D-09/D-10/D-11)

```typescript
// src/shell/update.ts (orchestrator — calls the seam, never @tauri-apps)
// 1. check:   const info = await platform.updater.check();   // null = up-to-date
// 2. prompt:  if (info) showBanner(info);                    // "v{info.version} available" + notes + Install/Later
// 3. install: onInstall → platform.updater.downloadAndInstall(setProgress)  // verifies sig, then relaunches
// 4. relaunch happens inside downloadAndInstall (plugin-process)
```
- **Silent launch check (opt-in only):** in `main.tsx`, after `initPlatform()`, read `autoUpdateCheck`; if `true`, fire `check()` and show the banner on a hit. If `false`/`null`, no automatic call. [D-09]
- **Manual check (always available):** tray "Check for Updates…" + native About/app-menu entry + (re-checkable) banner. These call `check()` regardless of toggle. A manual check with no update should surface a quiet "You're up to date" confirmation. [D-11]
- **Banner (D-11c / D-13):** shown EVERY time a newer version is detected (not one-shot — re-appears on each detection/launch while still outdated), individually dismissible. Reuse Phase-3 UI primitives + WCAG-AA token system. Layout-agnostic (responsive Tailwind, no fixed widths), keyboard-reachable dismiss, visible focus, AA contrast, no opacity-only state. [VERIFIED: D-13 + existing CopyButton/StatusBar patterns]
- **First-run opt-in prompt:** when `autoUpdateCheck === null`, show a one-time prompt ("Enable automatic update checks?") on first launch; persist the answer. [D-09]

> **Idiomatic pattern:** "silent at launch only if opted in; manual always available" = read the persisted flag in the preload chain for the auto path, and expose `check()` directly behind the tray/menu/banner for the manual path. The plugin's `check()` is the single entry for both. [CITED: v2.tauri.app/plugin/updater JS flow]

## Common Pitfalls

### Pitfall 1: DMG vs `.app.tar.gz` confusion
**What goes wrong:** Pointing the updater at the DMG, or forgetting `createUpdaterArtifacts`, so no `.app.tar.gz`/`.sig` is produced and the updater has nothing to consume.
**How to avoid:** Set `bundle.createUpdaterArtifacts: true`. The updater consumes `.app.tar.gz`; the DMG is first-install only. `latest.json.url` points at the `.app.tar.gz`, NOT the DMG. [CITED]

### Pitfall 2: Signature mismatch (`InvalidSignature`)
**What goes wrong:** `latest.json.signature` doesn't match the committed `pubkey` — wrong key, stale `.sig`, or copy-paste error. The updater refuses to install (correctly — this is DST-02 working).
**How to avoid:** Always copy the freshly-built `.app.tar.gz.sig` content into `latest.json` for THAT build; never reuse a `.sig` across builds; ensure the `pubkey` in `tauri.conf.json` matches the private key used at build time. [GitHub tauri#4610]

### Pitfall 3: Ad-hoc signature + the updater
**What goes wrong:** Ad-hoc signing (`"-"`) is fine for the minisign-verified update payload (minisign is independent of Apple signing), but an ad-hoc-signed app shows Gatekeeper friction on first install (expected, gated per D-02). Don't conflate "updater won't apply" with "Gatekeeper warning" — they're different layers.
**How to avoid:** Verify the updater round-trip with ad-hoc builds NOW (minisign works regardless of Apple signing); defer Gatekeeper-clean verification to post-enrolment. [D-02]

### Pitfall 4: Endpoint URL templating
**What goes wrong:** Using `{{target}}/{{arch}}/{{current_version}}` path segments with a *static* `latest.json` that lists all platforms — the substitution produces a 404.
**How to avoid:** With a single static `latest.json` (D-08), use a plain URL (`releases/latest/download/latest.json`); the plugin reads platforms from the manifest. Templating is for *dynamic* per-platform endpoints, which D-08 explicitly rejects. [CITED]

### Pitfall 5: DMG/hdiutil mount flake (repo-specific, STATE.md 2026-06-01)
**What goes wrong:** `bundle_dmg.sh`'s `hdiutil`/AppleScript step fails when other DMGs are mounted.
**How to avoid:** `hdiutil detach` stray volumes before `tauri build`; retry. Document in `RELEASE.md`. (See also MEMORY: tauri-dmg-bundle-flake.) [VERIFIED: STATE.md + user memory]

### Pitfall 6: `.env`/keys leaking into git
**What goes wrong:** `.gitignore` does NOT currently ignore `.env`/`.envrc`/`*.key`; a secret could be committed.
**How to avoid:** Add `.env`, `.envrc`, `*.key`, `*.p8` to `.gitignore` as the FIRST task touching secrets (D-05). [VERIFIED: .gitignore read]

### Pitfall 7: Per-arch coverage gap
**What goes wrong:** A local build on Apple Silicon only serves `darwin-aarch64`; Intel users get no update.
**How to avoid:** Document the served arch in `RELEASE.md`; defer universal/both-arch to CI. [CITED]

### Pitfall 8: Tauri version skew between plugins and core
**What goes wrong:** Assuming updater/process plugins are version-locked to core 2.11.2.
**How to avoid:** Pin updater 2.10.1 / process 2.3.1 (their actual `latest`), matching the repo's per-plugin pinning style. [VERIFIED]

## Validation Architecture

> nyquist_validation: assumed enabled (no `.planning/config.json` `workflow.nyquist_validation: false` found in repo; STATE shows the binding per-task gate is the project's validation backbone). This section lets a VALIDATION.md be derived.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **vitest 4.1.7** (jsdom) + **tsc --noEmit** (TS ~5.8.3) for unit/type; **WebdriverIO 9.27.2** for real-WKWebView e2e |
| Config file | `vitest` (in `vite`/repo config), `wdio.conf.ts` (globs `test/e2e/*.e2e.ts`) |
| Quick run command | `pnpm test` (`vitest run`) + `pnpm exec tsc --noEmit` |
| Full suite command | `pnpm test && pnpm exec tsc --noEmit && pnpm lint && bash scripts/e2e-spike.sh` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File |
|-----|----------|-----------|-------------------|------|
| DST-02 | `browser.ts` updater no-op resolves null / never throws (jsdom) | unit | `pnpm test` | `src/lib/platform/platform.test.ts` (extend) — Wave 0 |
| DST-02 | Seam accessor delegates to injected stub (`platform.updater` getter) | unit | `pnpm test` | `platform.test.ts` (extend) — Wave 0 |
| DST-02 | `autoUpdateCheck` coercion in `mergePreferences` (true/false honored, junk→null) | unit | `pnpm test` | `prefsStore.test.ts` (extend) — Wave 0 |
| DST-02 | Update orchestration logic (check→banner→install state machine) over a stub seam | unit | `pnpm test` | `src/shell/update.test.ts` — Wave 0 |
| DST-02 | First-run opt-in: null→prompt; true→auto-check; false→no call | unit | `pnpm test` | `update.test.ts` / `usePreferences.test.ts` — Wave 0 |
| DST-02/D-13 | Banner renders, is keyboard-dismissible, has visible focus + AA (no opacity-only) | unit (RTL) + e2e | `pnpm test` + `bash scripts/e2e-spike.sh` | `UpdateBanner.test.tsx` + `test/e2e/update.e2e.ts` — Wave 0 |
| DST-02 | App still launches non-blank with the two new plugins registered | e2e | `bash scripts/e2e-spike.sh` | `test/e2e/*.e2e.ts` (existing launch assertions cover this) |
| DST-01 | DMG builds (exit 0); `.app.tar.gz` + `.sig` produced | build-gated | `pnpm tauri build` | manual / RELEASE.md step 3 — **Manual-Only** |
| DST-01 | Real updater round-trip (old build → check → verify → relaunch into new) | manual | n/a — needs two signed builds + a published Release | **Manual-Only (human sign-off)** |
| DST-01 | Gatekeeper-clean install on a clean machine | manual | n/a | **Manual-Only, DEFERRED to post-enrolment (D-02)** |
| All | Decoder's 19 tests stay green; tools stay offline in jsdom | unit | `pnpm test` | `decoder` suite — **MUST stay untouched** |

### Sampling Rate
- **Per task commit:** `pnpm test` + `pnpm exec tsc --noEmit` (the lefthook gate; blocks red).
- **Per wave merge:** full vitest + tsc + eslint + `scripts/e2e-spike.sh` (real WKWebView).
- **Phase gate:** fresh `pnpm tauri build` (DMG + updater artifacts, exit 0) + `gsd-ui-review` WCAG-AA (banner) + HUMAN sign-off on the packaged build, including a real updater round-trip (build N → publish → build N+1 → update applies). Gatekeeper-clean is the one clause DEFERRED to post-enrolment.

### Wave 0 Gaps
- [ ] `src/lib/platform/platform.test.ts` — extend with updater no-op + delegation tests (DST-02)
- [ ] `src/shell/testStore.ts` — add exported `noopUpdater` stub (prevents tsc breakage across all Platform stubs)
- [ ] `src/shell/prefsStore.test.ts` — extend for `autoUpdateCheck` coercion (DST-02)
- [ ] `src/shell/update.test.ts` — NEW; check→prompt→install state machine + opt-in branches
- [ ] `src/components/UpdateBanner.test.tsx` — NEW; render/dismiss/a11y (D-13)
- [ ] `test/e2e/update.e2e.ts` — NEW; banner visible + keyboard-dismissible on the real WKWebView (the actual update *download* can't be driven by WebDriver — Manual-Only)
- [ ] No new framework install needed — vitest/tsc/wdio all present.

*Note: the cryptographic verify (minisign) and the bundle swap are plugin internals — NOT unit-testable in jsdom; they are exercised only by the manual round-trip at the phase gate. Keep tool runtime offline in jsdom (the updater no-op fallback guarantees this).*

## Security Domain

> `security_enforcement` not explicitly set in repo config → treated as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `latest.json` is untrusted remote input; the plugin validates the manifest + (critically) the minisign signature before applying. The opt-in pref value is coerced in `mergePreferences` (untrusted persisted input). |
| V6 Cryptography | yes | **Never hand-roll** — minisign signature verification is the plugin's, and is mandatory/non-disableable. Apple code signing/notarisation is Apple's toolchain. |
| V9 Communication | yes | HTTPS-only updater endpoint (TLS enforced by the plugin in production; `dangerousInsecureTransportProtocol` is dev-only and MUST NOT be set). GitHub Releases over `https://`. |
| V2/V3/V4 Auth/Session/Access | no | No accounts, no sessions, no server — offline single-user desktop app. |

### Known Threat Patterns for a Tauri auto-updater
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/forged update payload | Tampering / Elevation | Mandatory minisign verify against committed pubkey before apply (DST-02) — cannot be disabled |
| MITM on update fetch | Tampering / Info-disclosure | HTTPS-only endpoint; signature verify is the backstop even if transport is compromised |
| Leaked signing private key | Spoofing | Private key gitignored env only (D-05), never committed; `.gitignore` hardened (Pitfall 6); rotates to CI secrets later (D-06) |
| Untrusted persisted opt-in flag | Tampering | `mergePreferences` coerces to `true`/`false`/`null` only (Phase-3 `coerceTreeStyle` precedent) |
| Over-broad network egress | Info-disclosure | CSP `connect-src` scoped to GitHub hosts only; tools never call them; updater opt-in gated (D-09) |
| Untrusted argv on relaunch | Tampering | Single-instance already ignores `_argv`/`_cwd` (Phase-5 T-05-02); relaunch via plugin-process, not raw exec |

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Tauri v1 updater (built into core, `tauri.updater` API) | Tauri v2 plugin (`tauri-plugin-updater` + `tauri-plugin-process`) | Tauri 2.0 GA | Must use the plugin; `createUpdaterArtifacts: true` (NOT `"v1Compatible"` — this is a fresh v2 app) |
| Notarisation via Apple-ID + app-specific password | App Store Connect API key (`.p8`) | current best practice | D-03 already chose the API-key path — automation-friendly, rotatable |
| Hand-rolled `latest.json` endpoints with templating | Static `latest.json` listing all platforms | current | D-08; plugin picks the platform key itself; simpler/robust |

**Deprecated/outdated:** anything referencing Tauri v1's `tauri.conf.json > tauri.updater` block, or the v1 `@tauri-apps/api/updater` import — those are v1 and do not apply.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tauri-plugin-process` Rust crate is ~2.3.x (JS counterpart 2.3.1 verified; crates.io probe sandbox-blocked) | Standard Stack | Low — `cargo add` resolves the correct compatible version automatically; confirm at install |
| A2 | The updater's HTTP download runs in Rust (outside webview CSP), so CSP may not even gate it; `connect-src` GitHub hosts added defensively | CSP Reconciliation | Medium — if a webview-side fetch IS gated, the listed hosts cover it; if not, the addition is harmless. MUST test the real round-trip. |
| A3 | The offline hardened-runtime entitlement set (`allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation`) is sufficient for notarisation | macOS Signing | Medium — re-verified at the post-enrolment notarisation step (which is deferred anyway, D-02); a missing entitlement surfaces only when notarisation actually runs |
| A4 | Universal-binary updater platform-key matching is a rough edge; per-arch (build-host arch) is the v1 path | latest.json / Pitfall 7 | Low — documented gap in RELEASE.md; Intel coverage deferred to CI phase |

## Open Questions (RESOLVED)

1. **Does the webview CSP gate the updater's network fetch at all?**
   - Known: Tauri updater downloads happen Rust-side; `check()` is invoked from JS through the plugin.
   - Unclear: whether any part traverses the webview's `connect-src`.
   - Recommendation: add the scoped GitHub hosts to `connect-src` (harmless), then verify the real round-trip on the packaged build; if it works without them, note it but keep them for safety. (A2)
   - **RESOLVED (A2):** Plan 03 Task 5 widens `connect-src` defensively to `https://github.com` + `https://objects.githubusercontent.com` only; Plan 05 Task 3 (phase gate) runs the blocking real round-trip that confirms the download verifies and applies — the authoritative test of whether the CSP gates the Rust-side fetch.

2. **Exact `providerShortName` / notary env behavior at enrolment** — cannot be fully exercised without the Developer ID cert. Recommendation: structure config so the flip is `APPLE_*` env + `providerShortName` add only; re-verify the full notarisation at the post-enrolment step (explicitly out of this phase's blocking scope, D-02).
   - **RESOLVED (D-02):** Deferred to post-enrolment — Plan 03 wires `hardenedRuntime` + `entitlements` + ad-hoc `signingIdentity "-"` now so the Developer-ID/`providerShortName`/notary activation is a credentials-only `APPLE_*` env flip; Plan 05 RELEASE.md documents the flip. Not a Phase-6 blocker.

3. **GitHub Release asset URL stability** — owner/repo for the public repo must be decided so the `endpoints` URL + `latest.json` `url`s are concrete. Recommendation: planner pins `<owner>/<repo>` from the actual GitHub remote at plan time.
   - **RESOLVED:** Pinned to `boonkhailim/devtools` in Plan 03 (`plugins.updater.endpoints`, derived from identifier `com.boonkhailim.devtools-app`) as a placeholder-to-confirm; Plan 05 RELEASE.md step 0 makes confirming/creating the real public repo a blocking pre-release step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Tauri CLI (`@tauri-apps/cli`) | build, `tauri signer generate` | ✓ | ^2 | — |
| `pnpm` | all build/install | ✓ | 11.5.0 | — |
| Rust/cargo toolchain | `tauri build` | ✓ | (builds green per STATE.md) | — |
| `hdiutil` (macOS) | DMG bundling | ✓ (system) | — | unmount stray DMGs (Pitfall 5) |
| Apple Developer ID cert | Developer-ID signing | ✗ | — | **ad-hoc `"-"` (D-02) — this phase's path** |
| App Store Connect API key (`.p8`) | notarisation | ✗ | — | **skip notarisation (D-01/D-02) — deferred** |
| minisign keypair | updater signing | ✗ (generate this phase) | — | `tauri signer generate` (D-15) |
| GitHub repo/Releases | update hosting | ✓ (git remote exists) | — | confirm owner/repo at plan time |

**Missing with no fallback:** none that block this phase (the two Apple items are intentionally gated, D-02).
**Missing with fallback:** Apple cert → ad-hoc; notarisation → deferred; minisign key → generated this phase.

## Sources

### Primary (HIGH confidence)
- `v2.tauri.app/plugin/updater/` — updater config block, Cargo/JS deps, capabilities, `latest.json` schema, endpoint templating, signing key gen, env vars, JS flow [CITED]
- `v2.tauri.app/distribute/sign/macos/` — `bundle.macOS` keys, signing identity (ad-hoc `"-"` vs Developer-ID), notary env vars (App Store Connect API key), hardened runtime [CITED]
- `tauri-apps/tauri-docs` (v2 branch) + WebSearch — macOS updater artifacts = `.app.tar.gz` + `.app.tar.gz.sig`; DMG is install-only [CITED]
- Repo lockfiles — `tauri` 2.11.2, plugin pinning style, current `tauri.conf.json`/`Cargo.toml`/`lib.rs`/capabilities/platform-seam/prefs [VERIFIED this session]
- npm registry — `@tauri-apps/plugin-updater` 2.10.1, `@tauri-apps/plugin-process` 2.3.1 [VERIFIED]
- crates.io — `tauri-plugin-updater` max_stable 2.10.1 [VERIFIED]

### Secondary (MEDIUM confidence)
- GitHub issues tauri#4610 (InvalidSignature), tauri#11392 (relaunch quirks) — pitfall corroboration
- Community guides (thatgurjot.com, dev.to Tauri-v2-signing) — corroborate GitHub-Releases updater pattern

### Tertiary (LOW confidence — flagged for validation)
- Exact hardened-runtime entitlement set for notarising an offline Tauri app (A3) — verify at post-enrolment notarisation
- Whether webview CSP gates the Rust-side updater download (A2) — verify on real build

## Metadata

**Confidence breakdown:**
- Standard stack / versions: **HIGH** — verified against repo lockfiles + npm/crates registries
- Updater config + `latest.json` + signing flow: **HIGH** — official Tauri 2 docs, exact snippets
- macOS signing/notarisation "wire-but-gate" structure: **MEDIUM-HIGH** — config keys + env vars verified; the precise entitlement set + notary behavior only fully confirmable with the cert (intentionally deferred, D-02)
- CSP reconciliation: **MEDIUM** — GitHub redirect behavior verified; whether CSP even gates the Rust-side download needs a real-build test (A2)
- Pitfalls: **HIGH** — drawn from official docs + repo STATE.md + user memory

**Research date:** 2026-06-01
**Valid until:** ~2026-07-01 (Tauri 2 plugin versions move; re-verify updater/process versions at plan time)

## RESEARCH COMPLETE

**Phase:** 06 - Distribution
**Confidence:** HIGH (with two MEDIUM edges flagged: CSP-gating-of-updater A2, and exact notarisation entitlements A3 — both deferred-verifiable)

### Key Findings
1. **Almost all of DST-01/DST-02 is configuration, not code.** Minisign verification is the plugin's job and is mandatory/non-disableable — DST-02's "verify before apply" is satisfied by wiring, not custom crypto. The only real app code is the thin seam accessor + UX (banner, opt-in, prompt).
2. **Two artifacts, not one:** the build emits a **DMG (first-install only)** AND a **`.app.tar.gz` + `.sig` (updater payload)**. `bundle.createUpdaterArtifacts: true` is required; `latest.json.url` points at the `.app.tar.gz`, never the DMG. This is the #1 thing to get right.
3. **Versions verified:** core `tauri` 2.11.2; `tauri-plugin-updater` 2.10.1 (Rust+JS), `@tauri-apps/plugin-process` 2.3.1 — pinned per the repo's per-plugin style; NOT lockstep with core.
4. **"Wire-but-gate" is clean:** commit `hardenedRuntime: true` + `entitlements.plist` + ad-hoc `signingIdentity: "-"` NOW; at enrolment the flip is just `APPLE_*` env vars (App Store Connect `.p8`, key-id, issuer-id) + adding `providerShortName`. Notarisation runs automatically when the env is present.
5. **CSP edge:** the updater download is Rust-side and may not even traverse webview CSP; add `https://github.com` + `https://objects.githubusercontent.com` to `connect-src` defensively (scoped, tools never use them) and verify the real round-trip. `default-src`/`script-src`/`font-src` stay `'self'` — offline-by-design holds.
6. **Repo gaps to close first:** `.gitignore` does NOT yet ignore `.env`/`*.key` (must add before any secret, D-05); `tauri.conf.json` + `package.json` both at `0.1.0` (bump in lockstep, D-16).

### File Created
`.planning/phases/06-distribution/06-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Versions verified against lockfiles + npm/crates |
| Architecture (seam, prefs, UX) | HIGH | Mirrors verified Phase-2/3/5 patterns in-repo |
| Updater config + signing | HIGH | Official Tauri 2 docs, exact snippets |
| macOS signing/notarisation | MEDIUM-HIGH | Config verified; entitlement set + notary behavior deferred-verifiable (D-02) |
| CSP reconciliation | MEDIUM | GitHub redirects verified; CSP-gating of Rust download needs a real-build test |

### Open Questions
Does webview CSP gate the Rust-side updater fetch (A2)? · Exact notary/entitlement behavior at enrolment (deferred, D-02)? · Pin `<owner>/<repo>` for the endpoint URL at plan time.

### Ready for Planning
Research complete. The planner can derive plans (suggested waves: Wave 0 test scaffolds + `.gitignore`/version hygiene → updater wiring behind the seam → macOS signing config + entitlements → UX/banner/opt-in → RELEASE.md + phase-boundary build/sign-off). A VALIDATION.md can be derived from the Validation Architecture section.
