# Phase 1: Scaffold + Harness Proof - Research

**Researched:** 2026-05-30
**Domain:** Tauri 2 desktop scaffolding (Vite + React + TS + Tailwind v4) + macOS WKWebView test-automation harness
**Confidence:** HIGH (stack/versions verified via npm registry + official docs); MEDIUM on the WebDriver-plugin spike (young 0.2.x package, verified by source/docs but not yet exercised here)

## Summary

This phase stands up a Tauri 2 + Vite + React + TS app on macOS, ports the verified `src/lib/` unchanged (19 decoder tests must pass), builds the `src/lib/platform/` capability seam, vendors fonts, gets a `tauri build`, and drives one throwaway walking-skeleton feature through the full review→unit→ui gate. Every locked decision in CONTEXT.md (D-01..D-11) is honored below; this research does not relitigate them — it makes them executable with current (2026) versions and exact commands.

The single highest-risk item is **D-01: the macOS WKWebView WebDriver spike**. Good news from this research: `Choochmeque/tauri-plugin-webdriver` matured to **0.2.1 (released 2026-02-17)** and is now a **single self-contained Rust crate** — it embeds a W3C WebDriver server (47 endpoints) directly in the app on `127.0.0.1:4445`, with **no separate driver/intermediary process required** for the plugin path. This materially de-risks the spike versus the picture painted in `harness-and-decisions.md` §3.3 (which assumed 0.1.x immaturity). The `danielraffel/tauri-wd` fallback is a two-crate (CLI + plugin, port 4444) macOS-only approach and is documented as "the less pragmatic choice" by its own author. Recommended order matches D-01: spike Choochmeque first; if it can't drive our real WKWebView within the time-box, fall back to `screencapture` + `chrome-devtools-mcp` against `vite preview`.

**Primary recommendation:** Scaffold with `pnpm create tauri-app` (React + TS), add Tailwind v4 via `@tailwindcss/vite`, pin the `@/` alias in three places (vite/tsconfig/vitest), port `src/lib/` and stub `registry.ts`'s three missing tool imports (do NOT touch decoder/bytes/types), vendor fonts from `@fontsource/*` (OFL-1.1), and spike `tauri-plugin-webdriver@0.2` behind `debug_assertions`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**macOS webview automation (HRN-02)**
- **D-01:** Spike **`Choochmeque/tauri-webdriver`** (cross-platform `tauri-plugin-webdriver`, driven via WebdriverIO) **first**. Chosen over `danielraffel/tauri-wd` for widest future leverage — one plugin also covers Windows/Linux when they return.
- **D-02:** The spike is **time-boxed to a single plan**. Success bar = it can reliably launch our app, find an element, send input, and take a screenshot of the real WKWebView. If it can't within the time-box, **fall back** to `screencapture` of the real app window (visual) + `chrome-devtools-mcp` against the byte-identical static bundle (DOM/a11y automation).
- **D-03:** The chosen path and rationale are **recorded in `docs/phase-0-notes.md`** (this is the HRN-02 deliverable). Whichever path wins becomes the per-task UI gate driver for all later phases.

**Walking-skeleton feature (HRN-01)**
- **D-04:** Throwaway **minimal paste→transform→copy demo** (a "byte inspector": on paste, show input length + an uppercase/hex transform), deliberately exercising paste-transforms-instantly, a visible+focusable copy affordance (≤1 keystroke, no hover-only), and a status bar (parse state · byte count · timing).
- **D-05:** **Explicitly throwaway** — removed before Phase 2. Must **not** reuse the real Protobuf or Base64 tools (Phase 3 owns those).
- **D-06:** Passes the full gate in order — `/codex:review` → `vitest`+`tsc` → real-webview UI verification.

**Gate enforcement (HRN-03)**
- **D-07:** `lefthook` pre-commit hook running `tsc --noEmit` + `vitest run`.
- **D-08:** UI gate and `/codex:review` stay **manual** per-task DoD steps (a git hook can't run them; `/codex:review` is `disable-model-invocation`; UI needs the running app). Lefthook covers the unit gate only.

**Tooling baseline (Claude's discretion — D-09..D-11)**
- **D-09:** Package manager **pnpm**; **Tailwind v4** (CSS-first `@theme`); **eslint + prettier**.
- **D-10:** Keep project in current directory (`devtools-handoff/`), do NOT rename to `devtools/`.
- **D-11:** `src/lib/platform/` ships a **real seam with a Tauri impl + thin stubs** (clipboard at minimum). Full persistence/store lands in Phase 2 (SHL-05).

### Claude's Discretion
- Skeleton may register itself as a temporary registry tool OR live outside the registry (planner's choice — it's throwaway).
- How to handle `registry.ts`'s three missing tool imports (stub vs adjust array) — planner decides; do NOT alter decoder/bytes/types.
- ESLint/Prettier config shape; lefthook.yml structure.

### Deferred Ideas (OUT OF SCOPE)
- **Windows + Linux build/verify/signing** (V2-02) — deferred. The cross-platform plugin choice (D-01) keeps the door cheap.
- **Real prefs persistence / store** (SHL-05) — Phase 2; Phase 1 ships only a platform-store stub.
- **Registry-driven sidebar + ⌘K palette** (SHL-01..04) — Phase 2.
- **CI (GitHub Actions) cross-platform build matrix** — deferred with Windows/Linux.
- **Code-signing / notarisation / DMG / auto-updater** (DST-01/02) — Phase 6. Phase 1 only produces an **unsigned** dev bundle to surface surprises early.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Tauri 2 + Vite + React + TS builds & launches a dark window on macOS from one repo | `create-tauri-app` (React+TS) §Standard Stack; dark window = inline `--win`/`--bg-app` CSS before Tailwind lands |
| FND-02 | `react-router` HashRouter wired; unknown routes → first tool | Scaffold `router.tsx` is correct as-is (`createHashRouter` + `Navigate` fallback); port verbatim. Needs `react-router-dom` 7.x |
| FND-03 | Port `src/lib/` unchanged; **19 decoder vitest cases pass** | vitest 4.x; tests are zero-dep (only `vitest` imports); `@/` alias + node environment; stub registry imports §Pitfall 3 |
| FND-04 | `src/lib/platform/` seam; tools never import `@tauri-apps/*` directly | `@tauri-apps/plugin-clipboard-manager` 2.3.2 behind `tauri.ts` impl; index.ts picks impl §Architecture Pattern 2 |
| FND-05 | IBM Plex Sans + JetBrains Mono self-hosted (vendored, SIL OFL); no CDN | `@fontsource/ibm-plex-sans` + `@fontsource/jetbrains-mono` 5.2.8, both OFL-1.1 verified §Don't Hand-Roll |
| HRN-01 | Walking-skeleton exercises full gate | Skeleton spec D-04; gate order review→unit→ui |
| HRN-02 | macOS real-webview automation proven OR fallback documented in `docs/phase-0-notes.md` | `tauri-plugin-webdriver` 0.2.1 spike §Pattern 3; fallback `screencapture`+`chrome-devtools-mcp`+`vite preview` |
| HRN-03 | Per-task DoD enforced; parallel plans never bypass gates | lefthook pre-commit (unit gate, mechanical) + manual review/ui gates §Don't Hand-Roll |
| HRN-04 | `tauri build` produces runnable macOS bundle; build verified each phase boundary | `pnpm tauri build` → unsigned `.app`/`.dmg` in `src-tauri/target/release/bundle/macos/` §Pitfall 6 |
</phase_requirements>

## Standard Stack

All versions below are the npm `latest` as of **2026-05-30**, verified via `npm view <pkg> version`. **Important:** let `create-tauri-app` choose its own pinned versions for the core React/Vite/Tauri deps rather than forcing `@latest` — the template ships a tested combination. Add the rest explicitly.

### Core (scaffolded by `create-tauri-app`)
| Library | Version (latest verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/cli` | 2.11.2 [VERIFIED: npm] | Tauri 2 build/dev CLI | Official; drives `tauri dev`/`tauri build` |
| `@tauri-apps/api` | 2.11.0 [VERIFIED: npm] | JS bridge to Rust core | Official |
| `react` / `react-dom` | 19.2.6 [VERIFIED: npm] | UI | Stack-locked (PROJECT.md) |
| `react-router-dom` | 7.16.0 [VERIFIED: npm] | HashRouter (FND-02) | Scaffold `router.tsx` uses `createHashRouter`/`Navigate` from here |
| `vite` | 8.0.14 [VERIFIED: npm] | bundler/dev server | Conventional Tauri pairing (design-and-plan §3) |
| `@vitejs/plugin-react` | 6.0.2 [VERIFIED: npm] | React Fast Refresh | Standard |
| `typescript` | 6.0.3 [VERIFIED: npm] | types + `tsc --noEmit` gate | Stack-locked |

> ⚠️ **Do NOT chase npm `latest` for Vite/TS blindly.** `create-tauri-app@4.6.2` pins its own (likely Vite 7 / TS 5.x) tested set. `npm view vite version` = 8.0.14 and `typescript` = 6.0.3 are the absolute latest, but Tailwind v4.3 declares Vite peer `^5.2.0 || ^6 || ^7 || ^8` so Vite 8 is compatible if the template ships it. **Recommendation:** accept the template's pinned versions; only bump if a concrete need arises. [VERIFIED: npm peer-dep ranges]

### Supporting (add explicitly)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwindcss` | 4.3.0 [VERIFIED: npm] | styling | D-09; CSS-first `@theme` |
| `@tailwindcss/vite` | 4.3.0 [VERIFIED: npm] | Tailwind v4 Vite plugin | v4's official integration (no PostCSS/autoprefixer needed) |
| `vitest` | 4.1.7 [VERIFIED: npm] | unit gate (FND-03) | Runs 19 decoder tests |
| `@testing-library/react` | 16.3.2 [VERIFIED: npm] | component tests for skeleton | jsdom env; for skeleton paste/copy assertions |
| `jsdom` | 29.1.1 [VERIFIED: npm] | DOM for component tests | Only for skeleton UI tests, not decoder tests |
| `lefthook` | 2.1.9 [VERIFIED: npm] | pre-commit unit gate (D-07) | `tsc --noEmit` + `vitest run` |
| `eslint` | 10.4.1 [VERIFIED: npm] | lint (D-09) | flat config (eslint 9+) |
| `prettier` | 3.8.3 [VERIFIED: npm] | format (D-09) | — |
| `@tauri-apps/plugin-clipboard-manager` | 2.3.2 [VERIFIED: npm] | clipboard for platform seam (D-11/FND-04) | Real impl in `platform/tauri.ts` |
| `@fontsource/ibm-plex-sans` | 5.2.8, OFL-1.1 [VERIFIED: npm] | vendored sans (FND-05) | woff2 + @font-face |
| `@fontsource/jetbrains-mono` | 5.2.8, OFL-1.1 [VERIFIED: npm] | vendored mono (FND-05) | woff2 + @font-face |

### Spike / harness tooling
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `tauri-plugin-webdriver` (crate) | 0.2.1, 2026-02-17 [CITED: github.com/Choochmeque/tauri-plugin-webdriver] | embedded W3C WebDriver server (D-01) | Rust dev-dep behind `debug_assertions`; port 4445 |
| `webdriverio` | 9.27.2 [VERIFIED: npm] | drives the spike | `remote({hostname,port:4445})` |
| `chrome-devtools-mcp` | 1.1.1, Apache-2.0 [VERIFIED: npm] | fallback DOM/a11y automation (D-02) | Drives `vite preview` static bundle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tauri-plugin-webdriver` (Choochmeque) | `danielraffel/tauri-wd` | macOS-only, two-crate (CLI :4444 + plugin), author calls Choochmeque "more pragmatic" — D-01 already chose Choochmeque; tauri-wd is the *documented fallback candidate* only |
| `@fontsource/*` packages | manual woff2 download from `IBM/plex` + JetBrains releases | Fontsource gives versioned npm + ready `@font-face`; manual is more files to vet. Fontsource is the lower-friction path |
| `lefthook` | `husky` + `lint-staged` | D-07 locked lefthook (single Go binary, faster, no JS deps); don't relitigate |
| Tailwind v4 `@tailwindcss/vite` | v4 PostCSS plugin | Vite plugin is the v4-blessed path; no `postcss.config` needed |
| `@fontsource/*` (static weights) | `@fontsource-variable/*` (also 5.2.8, OFL-1.1) | Variable fonts = one file, smaller; design only needs 400/500/600/700 sans + 400/500/600 mono. Either works; static is simplest to reason about for "no network" verification. Planner's choice |

**Installation (after `create-tauri-app` scaffolds the base):**
```bash
# enable pnpm (NOT installed globally — see Environment Availability)
corepack enable
corepack prepare pnpm@latest --activate

# scaffold (interactive: choose React, TypeScript, pnpm)
pnpm create tauri-app

# styling + tooling
pnpm add -D tailwindcss @tailwindcss/vite vitest @testing-library/react jsdom \
  lefthook eslint prettier @vitejs/plugin-react

# fonts (vendored, OFL-1.1)
pnpm add @fontsource/ibm-plex-sans @fontsource/jetbrains-mono

# clipboard for the platform seam
pnpm add @tauri-apps/plugin-clipboard-manager
cd src-tauri && cargo add tauri-plugin-clipboard-manager && cd ..

# spike (Rust dev-dep behind debug_assertions — see Pattern 3)
pnpm add -D webdriverio
```

## Architecture Patterns

### Recommended Project Structure (matches handoff target layout, dir kept per D-10)
```
devtools-handoff/                    # D-10: NOT renamed to devtools/
├── src/
│   ├── main.tsx, App.tsx, router.tsx   # router.tsx ported verbatim (FND-02)
│   ├── styles.css                      # @import "tailwindcss"; @theme {...}; @font-face
│   ├── components/                     # rebuild visuals vs design/ (Phase 2 mostly)
│   ├── lib/                            # PORTED UNCHANGED (FND-03)
│   │   ├── bytes.ts
│   │   ├── protobuf/{decoder.ts, decoder.test.ts}
│   │   ├── tools/{types.ts, registry.ts}   # registry imports stubbed (Pitfall 3)
│   │   └── platform/                   # NEW seam (FND-04, D-11)
│   │       ├── index.ts                # capability interface + impl picker
│   │       ├── tauri.ts                # real clipboard impl
│   │       └── stub.ts                 # store/shortcuts thin stubs (Phase 2 fills)
│   └── tools/
│       └── _skeleton/                  # throwaway byte-inspector (D-04/D-05), deleted before Phase 2
├── src-tauri/                          # created by create-tauri-app
│   ├── Cargo.toml                      # tauri-plugin-webdriver under [target.'cfg(debug_assertions)'.dependencies]
│   ├── tauri.conf.json                 # frontendDist: ../dist, devUrl, beforeBuildCommand
│   ├── capabilities/default.json       # clipboard-manager:allow-read-text / allow-write-text
│   └── src/lib.rs                      # .plugin(clipboard) + cfg(debug) .plugin(webdriver)
├── docs/phase-0-notes.md               # HRN-02/HRN-04 deliverable (create)
├── vite.config.ts                      # @ alias + tailwind + react + test config
├── tsconfig.json                       # @ path mapping
├── lefthook.yml                        # pre-commit: tsc --noEmit + vitest run
└── (scaffold/ may be deleted once src/lib ported + tests green)
```

### Pattern 1: `@/` path alias resolved in app + tests + build (CRITICAL — FND-03 blocker if wrong)
The ported lib uses `@/lib/...` and `@/tools/...` (verified by grep: `registry.ts`, `Sidebar.tsx`, all three tool index files). The alias must resolve in **three** configs or builds/tests fail.

```ts
// vite.config.ts — Source: vite docs + @tailwindcss/vite docs [CITED]
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // Tauri expects a fixed port and no clearing of the rust error overlay
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  test: {                       // vitest reads this (or use vitest.config.ts)
    environment: "node",        // decoder tests need no DOM; jsdom only for skeleton component tests
    globals: false,             // scaffold tests import { describe, it, expect } explicitly
  },
});
```
```jsonc
// tsconfig.json — must mirror the alias so tsc --noEmit (the D-07 gate) passes
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```
**When to use:** Always — this is non-optional for the ported lib. **Vitest reads the Vite `resolve.alias`** automatically when config is shared, so one alias definition covers app + test. If a separate `vitest.config.ts` is used, it must re-declare the alias (or `mergeConfig` the vite config).

### Pattern 2: `src/lib/platform/` capability seam (FND-04, D-11)
```ts
// src/lib/platform/index.ts — Source: harness-and-decisions §2 [CITED]
export interface Platform {
  clipboard: { writeText(t: string): Promise<void>; readText(): Promise<string> };
  store: { get(k: string): Promise<unknown>; set(k: string, v: unknown): Promise<void> }; // stub in P1
  // shortcuts/window: stubbed in P1, real in P2/P5
}
import { tauriPlatform } from "./tauri";
export const platform: Platform = tauriPlatform; // index picks impl at startup
```
```ts
// src/lib/platform/tauri.ts — real clipboard impl (the only real capability in P1)
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
export const tauriPlatform = {
  clipboard: { writeText, readText },
  store: { /* thin stub: in-memory or no-op; real @tauri-apps/plugin-store in Phase 2 */ },
};
```
**Rule (from harness-and-decisions §2):** tool components import `lib/platform`, **never `@tauri-apps/*`**. The skeleton's copy button MUST go through `platform.clipboard.writeText` — this is the FND-04 proof. A test mock replaces `platform` at one injectable point.

### Pattern 3: WebDriver spike behind `debug_assertions` (D-01, HRN-02)
```toml
# src-tauri/Cargo.toml — Source: github.com/Choochmeque/tauri-plugin-webdriver [CITED]
[target.'cfg(debug_assertions)'.dependencies]
tauri-plugin-webdriver = "0.2"   # 0.2.1, released 2026-02-17
```
```rust
// src-tauri/src/lib.rs
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init());
    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_webdriver::init()); // server on 127.0.0.1:4445
    builder.run(tauri::generate_context!()).expect("error while running tauri application");
}
```
```js
// wdio spike — Source: Choochmeque docs [CITED]
import { remote } from "webdriverio";
const browser = await remote({ hostname: "127.0.0.1", port: 4445, capabilities: {} });
// success bar (D-02): launch app → findElement → sendKeys → takeScreenshot of real WKWebView
```
**When to use:** The D-01 spike. The plugin is self-contained (47 W3C endpoints, no separate driver/intermediary process). `init_with_port()` or `TAURI_WEBDRIVER_PORT` env var customizes the port. **Never ship in production** (it's gated by `debug_assertions`, which is the documented pattern).

### Pattern 4: Tailwind v4 CSS-first `@theme` mapping the design's CSS variables (D-09)
The design (`design/DevTools Mockup.html`) already defines `:root { --bg-app, --win, --accent, ... }`. Two valid approaches:
- **(a) Keep the design's `:root` variables as-is** and reference them in Tailwind via arbitrary values / `@theme inline`. Lowest-friction since the design is already authored this way.
- **(b) Re-declare design tokens inside `@theme`** as `--color-bg-app`, `--color-accent`, etc., to get auto-generated utilities (`bg-bg-app`).
```css
/* src/styles.css — Source: tailwindcss.com/blog/tailwindcss-v4 [CITED] */
@import "tailwindcss";
@theme {
  --color-bg-app: #0a0b0d;
  --color-win: #15171c;
  --color-accent: #3b82f6;
  /* ...map the design's palette; status-bar colors --ok #34d399 / --bad #f0876b */
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```
**Gotcha:** v4 uses `@import "tailwindcss";` — the v3 `@tailwind base/components/utilities` triple does NOT work in v4. No `tailwind.config.js`, no `postcss.config` needed with `@tailwindcss/vite`.

### Anti-Patterns to Avoid
- **`BrowserRouter`** — forbidden (CLAUDE.md, FND-02). Static files 404 on reload. The scaffold already uses `createHashRouter` — port verbatim.
- **Importing `@tauri-apps/*` inside a tool** — bug per harness-and-decisions §2. Route through `lib/platform`.
- **Modifying `decoder.ts`/`bytes.ts`/`types.ts`/`decoder.test.ts`** — forbidden without approval; the 19 tests ARE the spec. Stub the registry imports instead (Pitfall 3).
- **Hover-only copy** — explicitly forbidden (§9, CONTEXT D-04). The skeleton's copy must be `always`-visible + focusable; use it to prove the gate catches a hover regression.
- **Loading Google Fonts at runtime** — the design HTML has `<link>` to `fonts.googleapis.com` (lines 7-9). Strip on port; vendor instead (FND-05).
- **`@tailwind base;` (v3 syntax)** — silently produces no styles in v4.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git pre-commit gate | custom shell hook script | `lefthook` + `lefthook.yml` (D-07) | Auto-installs via `prepare`/`lefthook install`; runs `tsc --noEmit` + `vitest run` reliably, parallel-capable |
| Self-hosted fonts | hand-curated woff2 + handwritten @font-face | `@fontsource/ibm-plex-sans` + `@fontsource/jetbrains-mono` (5.2.8, OFL-1.1) | Versioned, woff2 included, ready `@font-face` CSS, license bundled — import `@fontsource/ibm-plex-sans/400.css` etc. |
| macOS WKWebView automation | bespoke AppleScript/Accessibility driver | `tauri-plugin-webdriver` (D-01) or `screencapture`+`chrome-devtools-mcp` fallback | W3C-standard, 47 endpoints, WebdriverIO-compatible |
| Clipboard access | `navigator.clipboard` (unreliable in webview) + custom | `@tauri-apps/plugin-clipboard-manager` behind the seam | Native, permissioned, testable via the seam mock |
| HashRouter wiring | custom hash listener | `react-router-dom` `createHashRouter` (scaffold `router.tsx`) | Already written + correct; port verbatim |
| Base64/hex transforms (for skeleton) | new conversion code | the ported `bytes.ts` — BUT D-05 forbids reusing real tools; skeleton should do a *trivial* uppercase/length transform, not call the real lib | Keeps skeleton genuinely throwaway |

**Key insight:** Almost nothing in this phase is novel code — it's wiring verified pieces and proving the harness. The only "new" surface is the throwaway skeleton (kept deliberately trivial) and the platform seam (a thin interface). Resist building anything the ecosystem already ships.

## Runtime State Inventory

> This is a greenfield scaffold phase (no existing app to rename/migrate). One item warrants explicit note: a **stale `scaffold/` directory** and a **directory-name decision**.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB/datastore yet. | None — verified: repo has no `src-tauri`, no database. |
| Live service config | None — no external services configured. | None. |
| OS-registered state | None — app not yet built/registered; no LaunchAgents/tray. | None (until Phase 5 native polish). |
| Secrets/env vars | `TAURI_WEBDRIVER_PORT` (optional, spike-only) — not a secret. | None; documented in phase-0-notes if used. |
| Build artifacts | `scaffold/` directory contains the pre-port source; after `src/lib/` is populated + 19 tests green, `scaffold/` should be **deleted** (handoff §"You may delete scaffold/"). No `node_modules`/`target` exist yet. | Delete `scaffold/` once ported + green; verify no `@/` import still points at it. |

**Directory name (D-10):** Keep `devtools-handoff/` as the repo/project root. The handoff's target layout shows `devtools/` but D-10 explicitly overrides this — `create-tauri-app` must scaffold **in place** (or scaffold to a temp and merge), NOT create a `devtools/` subdir. Verify `tauri.conf.json` `frontendDist`/paths are relative to the kept root.

## Common Pitfalls

### Pitfall 1: `@/` alias not resolving in tests → 19 decoder tests fail on first run
**What goes wrong:** vitest can't resolve `@/...`; FND-03 fails despite the lib being correct.
**Why:** alias declared in vite but not picked up by vitest (separate config) or missing in tsconfig (breaks `tsc` gate).
**How to avoid:** Define `resolve.alias` once in `vite.config.ts` with a `test` block, OR `mergeConfig` into `vitest.config.ts`; mirror in `tsconfig.json` `paths`. Note: `decoder.test.ts` itself imports only from `./decoder` (relative) — but `registry.ts` and tool files use `@/`, so the alias still matters project-wide and for the skeleton's tests.
**Warning signs:** `Cannot find module '@/...'` or `Failed to resolve import "@/..."`.

### Pitfall 2: vitest environment mismatch
**What goes wrong:** decoder tests are pure (Uint8Array, no DOM) — running them under jsdom is slower and unnecessary; but the skeleton's React component test NEEDS jsdom.
**How to avoid:** Default `environment: "node"`; opt the skeleton test into jsdom via a top-of-file `// @vitest-environment jsdom` comment or per-file `environmentMatchGlobs`. Confirmed: scaffold tests have **no special deps** — only `import { describe, expect, it } from "vitest"` (verified in `decoder.test.ts` line 1).
**Warning signs:** `document is not defined` in component tests, or slow decoder runs.

### Pitfall 3: porting `registry.ts` unchanged breaks the build (the known issue from CONTEXT)
**What goes wrong:** `registry.ts` imports `@/tools/unix-time`, `@/tools/base64`, `@/tools/protobuf-decoder` (verified lines 2-4) — none exist in Phase 1. Importing it as-is → unresolved modules → `tsc` + build fail.
**Why:** those tools belong to Phase 3.
**How to avoid (planner picks one; do NOT touch decoder/bytes/types):**
  - **(a) Stub the three tool modules** — create `src/tools/{unix-time,base64,protobuf-decoder}/index.ts` exporting a minimal `ToolDefinition` placeholder so registry imports resolve. Cleanest; registry stays verbatim.
  - **(b) Temporarily edit the `TOOLS` array** in `registry.ts` to `[]` or to only the skeleton — but this modifies a "port unchanged" file (acceptable since registry is explicitly the rebuild-adjacent control plane, but flag it).
  - **(c) Skeleton lives outside the registry** entirely (CONTEXT allows this) and registry is ported but not yet imported by a live route until Phase 2.
**Recommendation:** (a) or (c). (a) keeps registry literally verbatim and exercises the registry→router wiring with the skeleton; (c) is simplest if the skeleton doesn't need a route. Either honors "do NOT alter the decoder/bytes/types files."
**Warning signs:** build error `Could not resolve "@/tools/unix-time"`.

### Pitfall 4: WebDriver plugin shipped in release / port conflict
**What goes wrong:** plugin compiled into production build (security hole), or `:4445` already bound.
**How to avoid:** Gate strictly under `[target.'cfg(debug_assertions)'.dependencies]` + `#[cfg(debug_assertions)]`. The plugin docs explicitly warn "never include in production builds." Use `TAURI_WEBDRIVER_PORT` if 4445 conflicts.
**Warning signs:** webdriver endpoints reachable in a `tauri build` artifact.

### Pitfall 5: Tailwind v4 produces no styles
**What goes wrong:** Using v3 `@tailwind base/components/utilities` or expecting a `tailwind.config.js`.
**How to avoid:** Single `@import "tailwindcss";` + `@tailwindcss/vite` plugin in `vite.config.ts`. Config lives in CSS `@theme`, not JS.
**Warning signs:** unstyled app, or "unknown at-rule @tailwind".

### Pitfall 6: `tauri build` first run on macOS — Rust toolchain + unsigned bundle expectations
**What goes wrong:** First `cargo` build is slow (compiles all Tauri crates); the produced `.app`/`.dmg` is **unsigned** → Gatekeeper shows "unidentified developer" / "damaged" on copy. This is EXPECTED for Phase 1 (signing is Phase 6 / DST-01).
**How to avoid:** Run `pnpm tauri build`; locate artifacts in `src-tauri/target/release/bundle/macos/*.app` and `bundle/dmg/*.dmg`. To launch the unsigned app locally for the phase-boundary check, right-click → Open, or `xattr -dr com.apple.quarantine <App>.app`. Document toolchain quirks + unsigned-bundle behavior in `docs/phase-0-notes.md` (HRN-04 deliverable). Cargo 1.83 + Xcode are present (see Environment Availability).
**Warning signs:** notarisation/signing errors — **out of scope**; do not attempt to fix in Phase 1 (deferred to Phase 6).

### Pitfall 7: `pnpm` not on PATH
**What goes wrong:** D-09 mandates pnpm but it's not installed globally on this machine (verified).
**How to avoid:** `corepack enable && corepack prepare pnpm@latest --activate` (corepack 0.34.0 ships with Node 22.21.1 — verified present). Pin via `packageManager` field in `package.json` so the version is reproducible.
**Warning signs:** `command not found: pnpm`.

## Code Examples

### lefthook.yml — pre-commit unit gate (D-07/HRN-03)
```yaml
# Source: github.com/evilmartians/lefthook + pkgpulse 2026 guide [CITED]
# Install once: pnpm lefthook install  (or it auto-runs via package.json "prepare")
pre-commit:
  parallel: true
  commands:
    typecheck:
      run: pnpm tsc --noEmit
    test:
      run: pnpm vitest run
```
> D-08 reminder: lefthook covers the **unit gate only**. `/codex:review` (`disable-model-invocation`) and the real-webview UI check stay manual per-task DoD steps — a git hook cannot run them.

### Vendored fonts (FND-05) — no network at runtime
```css
/* src/styles.css — import the woff2-backed @font-face from fontsource (local, bundled) */
@import "@fontsource/ibm-plex-sans/400.css";
@import "@fontsource/ibm-plex-sans/500.css";
@import "@fontsource/ibm-plex-sans/600.css";
@import "@fontsource/ibm-plex-sans/700.css";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/500.css";
@import "@fontsource/jetbrains-mono/600.css";
```
**No-network verification:** after `tauri build`, grep the bundle/built `dist/` for `googleapis`/`gstatic` (must be absent), and confirm woff2 files are embedded. Fontsource @font-face uses relative `url(./files/*.woff2)` resolved at build time — no runtime fetch.

### clipboard capability (FND-04)
```jsonc
// src-tauri/capabilities/default.json — Source: v2.tauri.app/plugin/clipboard [CITED]
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "clipboard-manager:allow-read-text",
    "clipboard-manager:allow-write-text"
  ]
}
```
**Note:** clipboard-manager enables **no permissions by default** (security) — `allow-write-text` is required for the skeleton's copy affordance, `allow-read-text` for a paste-from-clipboard path.

### Fallback: serve the static bundle for chrome-devtools-mcp (D-02)
```bash
# If the WebDriver spike fails its success bar within the time-box:
pnpm vite build            # → dist/ (byte-identical web content WKWebView renders)
pnpm vite preview --port 4173   # serve the static bundle locally
# Then drive http://localhost:4173 with chrome-devtools-mcp for DOM/a11y/visual-diff,
# AND screencapture the real `tauri dev` window for the "literally inside WKWebView" visual check.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| macOS WKWebView automation = "unproven, 0.1.x only" (per harness-and-decisions §3.3) | `tauri-plugin-webdriver` 0.2.1 — single self-contained crate, 47 W3C endpoints, no separate driver | 2026-02-17 | **De-risks D-01.** The spike is more likely to succeed than the docs assumed |
| Tailwind v3 `@tailwind` triple + `tailwind.config.js` + PostCSS/autoprefixer | v4 `@import "tailwindcss"` + `@tailwindcss/vite` + CSS `@theme` (no PostCSS/JS config) | Tailwind v4.0 (early 2026) | Simpler config; design's CSS vars map cleanly to `@theme` |
| Official `tauri-driver` (Linux/Windows only) | Community plugins fill the macOS gap | 2026 | macOS automation now viable; cross-platform plugin keeps Windows/Linux door open (V2-02) |
| `husky` + `lint-staged` for git hooks | `lefthook` (single Go binary) | trend through 2025-2026 | Faster, no JS dependency chain; D-07 locked it |

**Deprecated/outdated:**
- `@tailwind base/components/utilities` directives — replaced by `@import "tailwindcss";` in v4.
- `danielraffel/tauri-webdriver` as primary — author himself recommends Choochmeque's for cross-platform; kept only as documented fallback candidate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `create-tauri-app` React+TS template does NOT pre-bundle Tailwind (add manually) | Standard Stack / create-project | LOW — if it does bundle Tailwind v4 already, skip the manual add; quick to verify post-scaffold |
| A2 | The template's pinned Vite version is in Tailwind v4.3's peer range (^5.2.0–^8) | Standard Stack | LOW — verified peer range covers Vite 5-8; only breaks if template ships an exotic version |
| A3 | `tauri-plugin-webdriver` 0.2.1 can drive *our specific* WKWebView app (launch+find+input+screenshot) | Pattern 3 / HRN-02 | MEDIUM — this is exactly what the D-02 time-boxed spike exists to verify; fallback is in place. Do not assume success |
| A4 | Decoder tests run green under `environment: node` with the `@/` alias, no extra deps | Pitfall 1/2 | LOW — verified test imports only `vitest`; node env is correct for Uint8Array logic |
| A5 | Fontsource `@font-face` resolves woff2 at build time with zero runtime network | FND-05 / Code Examples | LOW — standard Fontsource behavior; verify by grepping built bundle for `googleapis` |
| A6 | Unsigned `tauri build` succeeds on this macOS 26.3 / Xcode / cargo 1.83 setup | Pitfall 6 / HRN-04 | MEDIUM — toolchain present; signing surprises are the documented reason this build runs early. Surface in phase-0-notes |

## Open Questions

1. **Does `create-tauri-app@4.6.2` offer a Tailwind option in its React flow?**
   - What we know: it prompts for framework + TS/JS + package manager; community templates add Tailwind separately.
   - What's unclear: whether the official React template now includes a Tailwind toggle.
   - Recommendation: scaffold first, then add `@tailwindcss/vite` only if absent. Cheap to check post-scaffold (A1).

2. **Skeleton: in-registry vs out-of-registry?**
   - What we know: CONTEXT explicitly leaves this to the planner.
   - Recommendation: out-of-registry (or its own minimal route) keeps registry literally verbatim and avoids the Pitfall-3 churn; in-registry better exercises the registry→router wiring. Either is valid — pick based on whether you want the skeleton to prove the registry path too.

3. **Static vs variable Fontsource packages?**
   - What we know: both `@fontsource/*` and `@fontsource-variable/*` exist at 5.2.8, OFL-1.1.
   - Recommendation: static weights (explicit 400/500/600/700 sans, 400/500/600 mono per design) — easiest to reason about and verify; variable is a fine smaller-footprint alternative.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Vite/React/vitest | ✓ | 22.21.1 | — |
| corepack (→ pnpm) | D-09 pnpm | ✓ (corepack) | corepack 0.34.0 → pnpm 11.5.0 | `npm i -g pnpm` |
| pnpm (global) | D-09 | ✗ | — | `corepack enable` (above) |
| Rust / cargo | Tauri build, webdriver plugin | ✓ | cargo 1.83.0 / rustc 1.83.0 | — |
| Xcode / CLT | macOS Tauri build | ✓ | `/Applications/Xcode.app` | — |
| screencapture | fallback UI gate (D-02) | ✓ | system binary | — |
| macOS | target platform | ✓ | 26.3.1 (build 25D2128) | — |
| `tauri-plugin-webdriver` crate | D-01 spike | n/a (fetched at build) | 0.2.1 | `danielraffel/tauri-wd` then `screencapture`+`chrome-devtools-mcp` |
| chrome-devtools-mcp | D-02 fallback | n/a (npx/npm on demand) | 1.1.1 | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:**
- **pnpm not globally installed** → enable via `corepack enable && corepack prepare pnpm@latest --activate` (corepack is present with Node 22). This is a one-line setup step the planner must include as the first scaffold task.

**Note on cargo version:** cargo 1.83.0 (Oct 2024) is somewhat old relative to 2026. Tauri 2.11 should build fine, but if a Tauri/crate MSRV error appears, `rustup update stable` is the fix. Flag in phase-0-notes.

## Validation Architecture

> nyquist_validation is enabled (config.json). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.7 [VERIFIED: npm] |
| Config file | `vite.config.ts` `test:` block (or `vitest.config.ts`) — see Wave 0 |
| Quick run command | `pnpm vitest run src/lib/protobuf/decoder.test.ts` |
| Full suite command | `pnpm vitest run` (+ `pnpm tsc --noEmit`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-03 | 19 decoder cases pass unchanged | unit | `pnpm vitest run src/lib/protobuf/decoder.test.ts` | ✅ (ported from scaffold) |
| FND-04 | tools reach clipboard only via `lib/platform` | unit | `pnpm vitest run src/lib/platform/*.test.ts` (mock seam) | ❌ Wave 0 |
| HRN-01 | skeleton: paste transforms instantly | unit/component | `pnpm vitest run src/tools/_skeleton/*.test.tsx` (jsdom) | ❌ Wave 0 |
| UX (skeleton) | copy affordance focusable, not hover-only | component | RTL: assert button is in tab order + visible | ❌ Wave 0 |
| FND-01/02 | dark window renders; HashRouter redirects unknown→first | manual + ui-gate | real-webview screenshot vs `--win`/`--bg-app`; route check | manual |
| FND-05 | no CDN font fetch at runtime | smoke | grep built `dist/` for `googleapis`/`gstatic` (must be absent) | ❌ Wave 0 (script) |
| HRN-04 | `tauri build` produces runnable bundle | manual (phase gate) | `pnpm tauri build` → launch `.app` | manual |
| HRN-02 | webview automation proven OR fallback documented | manual (spike) | wdio connects :4445 + screenshot; else fallback note | manual → phase-0-notes |

### Sampling Rate
- **Per task commit:** `pnpm tsc --noEmit && pnpm vitest run` (lefthook enforces — D-07)
- **Per wave merge:** full `pnpm vitest run` + `pnpm tsc --noEmit`
- **Phase gate:** full suite green + `pnpm tauri build` + manual review→ui sign-off before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vite.config.ts` `test:` block (env=node default) + `@/` alias — covers FND-03
- [ ] `src/lib/platform/*.test.ts` — seam mock test for FND-04
- [ ] `src/tools/_skeleton/*.test.tsx` (jsdom) — HRN-01 paste/copy behavior
- [ ] no-CDN-font smoke check (grep script over `dist/`) — FND-05
- [ ] Framework install: `pnpm add -D vitest @testing-library/react jsdom` (none detected — greenfield)

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version`) — all Standard Stack versions, font licenses (OFL-1.1), 2026-05-30
- `v2.tauri.app/plugin/clipboard/` — clipboard install, registration, permission identifiers
- `v2.tauri.app/start/create-project/` — create-tauri-app prompts/flow
- `tailwindcss.com/blog/tailwindcss-v4` — `@import "tailwindcss"` + `@theme` CSS-first config
- github.com/Choochmeque/tauri-plugin-webdriver — 0.2.1, Cargo dep, port 4445, lib.rs registration, WebdriverIO config
- Local repo files: `scaffold/src/lib/tools/registry.ts` (missing-import issue), `router.tsx` (HashRouter), `decoder.test.ts` (vitest-only imports), `design/DevTools Mockup.html` (CSS vars, Google Fonts link to strip)
- Local toolchain probe: Node 22.21.1, cargo 1.83.0, Xcode, macOS 26.3.1, corepack 0.34.0

### Secondary (MEDIUM confidence)
- danielraffel.me/2026/02/14 (tauri-wd writeup) — fallback candidate maturity, two-crate architecture, port 4444
- evilmartians/lefthook + pkgpulse 2026 — lefthook.yml pre-commit pattern with pnpm
- fontsource.org / npmjs @fontsource — self-host @font-face advanced usage (Vite-compatible)
- v2.tauri.app/start/frontend/vite + discussion #11474 — `frontendDist: ../dist`, beforeBuildCommand

### Tertiary (LOW confidence)
- create-tauri-app Tailwind-inclusion question (A1) — resolve empirically post-scaffold

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified against npm registry today; peer-dep ranges checked
- Architecture: HIGH — patterns derived from official docs + the repo's own verified scaffold
- Pitfalls: HIGH — Pitfall 1/2/3 verified directly against repo source; 5/6/7 against docs + local toolchain
- WebDriver spike (HRN-02): MEDIUM — plugin verified at 0.2.1 via source/docs, but "drives OUR app" is the time-boxed spike's job (A3); fallback fully specified

**Research date:** 2026-05-30
**Valid until:** 2026-06-13 (14 days — Tauri/Tailwind/webdriver-plugin ecosystem moves; re-verify versions at plan time if later)
