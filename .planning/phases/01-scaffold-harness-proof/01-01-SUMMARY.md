---
phase: 01-scaffold-harness-proof
plan: 01
subsystem: infra
tags: [tauri, vite, react, typescript, tailwind-v4, vitest, eslint, prettier, pnpm, fontsource, clipboard, protobuf]

# Dependency graph
requires: []
provides:
  - "Tauri 2 + Vite 7 + React 19 + TS scaffold in place (devtools-handoff/, D-10)"
  - "pnpm@11.5.0 pinned via corepack + packageManager field"
  - "ALL Phase-1 npm deps + scripts installed in Wave 1 (Plans 02/03/04 must NOT run pnpm add or edit package.json)"
  - "@/ alias resolving in vite + tsconfig + vitest (FND-03 blocker cleared)"
  - "src/lib ported byte-for-byte; 19 decoder vitest cases green; tsc --noEmit clean"
  - "registry.ts Phase-3 imports resolved via enabled:false stub modules"
  - "Tailwind v4 @theme design tokens in src/index.css (entry stylesheet)"
  - "Vendored IBM Plex Sans + JetBrains Mono (no CDN, FND-05)"
  - "tauri-plugin-clipboard-manager registered in Rust core + least-privilege capability (FND-04)"
  - "Dark window matching --win/--bg-app (FND-01)"
  - "eslint flat config + prettier (D-09)"
affects: [01-02 (skeleton/router/platform seam), 01-03 (lefthook.yml), 01-04 (wdio.conf.ts/e2e), all later phases]

# Tech tracking
tech-stack:
  added: [tailwindcss@4.3.0, "@tailwindcss/vite@4.3.0", vitest@4.1.7, "@testing-library/react@16.3.2", jsdom@29.1.1, lefthook@2.1.9, webdriverio@9.27.2, eslint@10.4.1, prettier@3.8.3, "typescript-eslint@8.60.0", react-router-dom@7.16.0, "@tauri-apps/plugin-clipboard-manager@2.3.2", "@fontsource/ibm-plex-sans@5.2.8", "@fontsource/jetbrains-mono@5.2.8", tauri-plugin-clipboard-manager (rust crate)]
  patterns: ["@/ alias declared once in vite resolve.alias, mirrored in tsconfig paths, shared with vitest", "Tailwind v4 CSS-first @theme (no tailwind.config.js / postcss.config)", "Wave 1 owns all package.json/lockfile edits; downstream plans write source/config only", "Phase-3 tool imports resolved via enabled:false stub modules"]

key-files:
  created: [src/index.css, eslint.config.js, .prettierrc.json, .prettierignore, pnpm-workspace.yaml, src/lib/bytes.ts, src/lib/protobuf/decoder.ts, src/lib/protobuf/decoder.test.ts, src/lib/tools/types.ts, src/lib/tools/registry.ts, src/tools/unix-time/index.ts, src/tools/base64/index.ts, src/tools/protobuf-decoder/index.ts, src-tauri/Cargo.lock]
  modified: [package.json, vite.config.ts, tsconfig.json, src/main.tsx, src/App.tsx, src-tauri/src/lib.rs, src-tauri/Cargo.toml, src-tauri/capabilities/default.json, src-tauri/tauri.conf.json]

key-decisions:
  - "Scaffolded via temp dir + merge (create-tauri-app refuses non-empty dir); kept devtools-handoff/ root (D-10)"
  - "Accepted create-tauri-app's pinned core versions (React 19.1, Vite 7.0.4, TS 5.8.3, plugin-react 4.6, Tauri CLI/api 2) — did NOT bump to @latest"
  - "Registry stub approach (a): three enabled:false ToolDefinition placeholders under src/tools/{unix-time,base64,protobuf-decoder}"
  - "Excluded scaffold/ from vitest so the decoder spec has a single source of truth in src/"
  - "Updated Rust toolchain 1.83 -> 1.96 — clipboard plugin transitive dep (idna_adapter) requires edition2024"
  - "Static @fontsource weights (Q3 resolved): IBM Plex Sans 400/500/600/700 + JetBrains Mono 400/500/600"

patterns-established:
  - "@/ alias single-source in vite.config, mirrored in tsconfig, inherited by vitest"
  - "Tailwind v4 @theme tokens map the design's CSS variables"
  - "Stub-then-enable registry pattern: Plan 01 stubs Phase-3 tools enabled:false; Plan 02 adds skeleton enabled:true"

requirements-completed: [FND-01, FND-03, FND-05]

# Metrics
duration: 9min
completed: 2026-05-30
---

# Phase 1 Plan 01: Scaffold + Harness Proof Summary

**Tauri 2 + Vite 7 + React 19 + TS app scaffolded in place with the `@/` alias resolving across vite/tsconfig/vitest, the verified `src/lib/` ported byte-for-byte (19/19 decoder tests green), Tailwind v4 design tokens, vendored fonts (zero CDN), and a clipboard-enabled Rust core rendering a dark window.**

## Performance

- **Duration:** ~9 min (active executor time; excludes Rust toolchain download + first cargo compile)
- **Started:** 2026-05-30T11:29:04Z
- **Completed:** 2026-05-30T11:37:56Z
- **Tasks:** 3
- **Files modified/created:** 51 (excluding vendored scaffold/ reference)

## Accomplishments
- Scaffolded the full Tauri+React+TS stack in place (D-10) without clobbering `.planning/`, `docs/`, `design/`, `scaffold/`, `CLAUDE.md`, `README.md`.
- Installed EVERY Phase-1 npm dependency and EVERY package.json script in Wave 1 so Plans 02/03/04 never touch `package.json` or the lockfile (HIGH-1/HIGH-2 de-conflict).
- Cleared the FND-03 blocker: `@/` alias resolves in app, build, AND test; the 19 ported decoder cases pass green on first run; `tsc --noEmit` clean.
- Ported `src/lib/` byte-for-byte (diff-clean) and resolved registry's three Phase-3 imports via `enabled:false` stub modules.
- Vendored IBM Plex Sans + JetBrains Mono via `@fontsource` (woff2 embedded in `dist`, no `googleapis`/`gstatic` anywhere) — FND-05.
- Registered `tauri-plugin-clipboard-manager` in the Rust core with a least-privilege capability (read-text/write-text only) — FND-04 seam ready for Plan 02.
- Rendered the dark window matching `--bg-app` (#0a0b0d) / `--win` (#15171c) with IBM Plex Sans — FND-01.

## Task Commits

1. **Task 1: Scaffold + install all deps/scripts + wire @/ alias, Tailwind v4, vitest, eslint/prettier** - `12cec3a` (feat)
2. **Task 2: Port src/lib byte-for-byte, stub registry's Phase-3 imports, 19 decoder tests green** - `90583b7` (feat)
3. **Task 3: Vendor fonts (no CDN), register clipboard plugin, render dark window** - `5874905` (feat)

**Plan metadata:** (final docs commit — see below)

## Files Created/Modified

**Config / tooling**
- `package.json` - name `devtools`, `packageManager: pnpm@11.5.0`, all deps + lint/format/format:check/prepare/e2e scripts
- `pnpm-workspace.yaml` - `allowBuilds` (esbuild+lefthook enabled; edge/geckodriver disabled), `minimumReleaseAgeExclude`
- `vite.config.ts` - `@/` alias, `react()` + `tailwindcss()` plugins, vitest `test` block (env=node, globals=false, scaffold/ excluded)
- `tsconfig.json` - `baseUrl` + `paths { "@/*": ["./src/*"] }`
- `eslint.config.js` - ESLint 10 flat config (js + typescript-eslint + react-hooks/react-refresh), ignores dist/scaffold/target
- `.prettierrc.json`, `.prettierignore` - prettier baseline
- `lefthook.yml` - auto-generated example (commented; Plan 03 replaces with the real tsc+vitest pre-commit gate)

**App entry / styling**
- `src/index.css` - entry stylesheet: `@fontsource` @imports, `@import "tailwindcss"`, `@theme` design tokens, dark-window body gradient
- `src/main.tsx` - imports `./index.css`
- `src/App.tsx` - throwaway dark-window placeholder (Plan 02 ports the real router/App)

**Ported lib (byte-frozen) + stubs**
- `src/lib/bytes.ts`, `src/lib/protobuf/decoder.ts`, `src/lib/protobuf/decoder.test.ts`, `src/lib/tools/types.ts`, `src/lib/tools/registry.ts` - ported verbatim (diff-clean vs scaffold/)
- `src/tools/{unix-time,base64,protobuf-decoder}/index.ts` - Phase-1 `enabled:false` stubs (each marked `// PHASE 1 STUB`)

**Rust core**
- `src-tauri/src/lib.rs` - `.plugin(tauri_plugin_clipboard_manager::init())`
- `src-tauri/Cargo.toml` - `tauri-plugin-clipboard-manager = "2.3.2"`
- `src-tauri/Cargo.lock` - committed for reproducibility
- `src-tauri/capabilities/default.json` - `clipboard-manager:allow-read-text` + `allow-write-text`
- `src-tauri/tauri.conf.json` - window `theme: "Dark"`, title `DevTools`, 1100x720 (min 720x480)

## Decisions Made
- **Scaffold approach:** temp dir (`/tmp/devtools-scaffold/devtools-app`) via `pnpm create tauri-app --template react-ts --manager pnpm --yes`, then merged files into the repo root. `create-tauri-app` refuses a non-empty dir, so an in-place run was not possible; the merge preserved all existing docs/design/scaffold/.planning/.git assets.
- **Pinned versions create-tauri-app chose (accepted, not bumped):** react `^19.1.0`, react-dom `^19.1.0`, vite `^7.0.4`, typescript `~5.8.3`, @vitejs/plugin-react `^4.6.0`, @tauri-apps/cli `^2`, @tauri-apps/api `^2`, plus `@tauri-apps/plugin-opener ^2` (template default — kept).
- **Entry stylesheet name:** `src/index.css` (matches the verbatim `main.tsx` `import "./index.css"` that Plan 02 ports). No `src/styles.css` orphan.
- **Registry stub choice:** approach (a) stub modules, `enabled:false`. At the end of THIS plan `ENABLED_TOOLS` is intentionally EMPTY — Plan 02 adds the throwaway skeleton as the first `enabled:true` entry so `router.tsx`'s `firstTool = ENABLED_TOOLS[0]` resolves at module load.
- **ToolDefinition.id confirmed a plain `string`** (types.ts line 28) — Plan 02's `"_skeleton"` id is valid without any types.ts edit.
- **Fonts:** static `@fontsource` weights (Q3 resolved static).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded `scaffold/` from the vitest run**
- **Found during:** Task 2 (running the decoder tests)
- **Issue:** vitest matched BOTH `src/lib/protobuf/decoder.test.ts` and the vendored `scaffold/src/lib/protobuf/decoder.test.ts`, reporting 38 tests across 2 files and giving an ambiguous "19 passed" signal.
- **Fix:** Added `exclude: ["**/node_modules/**", "**/dist/**", "scaffold/**"]` to the vitest `test` block so the decoder spec has a single source of truth in `src/`.
- **Files modified:** `vite.config.ts`
- **Verification:** `pnpm vitest run` → 1 file, 19 passed.
- **Committed in:** `90583b7` (Task 2 commit)

**2. [Rule 3 - Blocking] Updated the Rust toolchain 1.83 -> 1.96**
- **Found during:** Task 3 (`cargo check` after adding the clipboard crate)
- **Issue:** A transitive dependency of `tauri-plugin-clipboard-manager` (`idna_adapter-1.2.2`) requires the `edition2024` Cargo feature, unstabilized in cargo 1.83.0 → `cargo check` failed to parse the manifest. (Anticipated by RESEARCH assumption A6 / cargo-version note.)
- **Fix:** `rustup update stable` (1.83.0 → 1.96.0), per the RESEARCH-prescribed remedy.
- **Files modified:** none in-repo (toolchain only); `src-tauri/Cargo.lock` generated and committed.
- **Verification:** `cargo check` → `Finished dev profile` clean.
- **Committed in:** `5874905` (Task 3 commit)

**3. [Rule 3 - Blocking] Installed eslint flat-config plugins**
- **Found during:** Task 1 (authoring `eslint.config.js`)
- **Issue:** ESLint 10 flat config for TS+React needs `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` — none were in the install set the plan enumerated.
- **Fix:** `pnpm add -D @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals` (config-shape is Claude's discretion per D-09). Keeps the de-conflict invariant intact (all eslint-related installs still happen here in Wave 1).
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm lint` (eslint .) exits 0.
- **Committed in:** `12cec3a` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 - blocking)
**Impact on plan:** All three were necessary to satisfy the plan's own acceptance criteria (19-test unambiguity, a compiling Rust core, a runnable `pnpm lint`). No scope creep; the Wave-1-owns-all-installs invariant is preserved (deviation #3's installs are eslint-baseline, still in Wave 1).

## Issues Encountered
- The `prepare` (`lefthook install`) script failed on the FIRST `pnpm install` because lefthook wasn't installed yet (`lefthook: command not found`). Expected per the plan ("Do NOT fail the build over the prepare script here"). Resolved once lefthook was added and `allowBuilds.lefthook: true` let its postinstall run — `lefthook install` then synced hooks and created the example `lefthook.yml`. The real tsc+vitest pre-commit gate is Plan 03's deliverable.
- pnpm 11.5.0 gates build scripts via `pnpm-workspace.yaml` `allowBuilds` (not the older `approve-builds` prompt). Set `esbuild: true` (needed by vite/vitest) and `lefthook: true`; left `edgedriver`/`geckodriver: false` (the macOS WKWebView automation path in Plan 04 doesn't need Chrome/Firefox drivers).

## Allowlisted non-runtime http(s) references (LOW-item, FND-05 broad scan)
The broad `grep -rEoi "https?://" src index.html dist` after build returned only non-runtime references (NO `googleapis`/`gstatic`/CDN/font hosts):
- `http://www.w3.org/{2000/svg, 1999/xlink, 1998/Math/MathML, XML/1998/namespace}` — SVG/XML namespace identifiers (not fetched), in `dist/*.svg` and the bundled JS.
- `https://react.dev/errors/` — React error-decoder link emitted in the build (informational, not fetched).
- `https://protobuf.dev/programming-guides/encoding/` — a source-comment doc link inside the byte-frozen `decoder.ts` (not in runtime fetch path).

## Notes for downstream plans
- **Plan 02:** Port `main.tsx`/`router.tsx`/`App.tsx` from scaffold; add the throwaway skeleton as the first `enabled:true` entry in `registry.ts` (control plane, modifiable) so `ENABLED_TOOLS` is non-empty. Build the `src/lib/platform/` seam against `@tauri-apps/plugin-clipboard-manager` (already installed + Rust-registered). Do NOT run `pnpm add` or edit `package.json`.
- **Plan 03:** Only WRITE `lefthook.yml` (the real `pre-commit: tsc --noEmit + vitest run`) and run `pnpm lefthook install`. The `lefthook` package + `prepare` script already exist. The current `lefthook.yml` is the commented example — overwrite it.
- **Plan 04:** Only WRITE `wdio.conf.ts` + e2e tests + the Cargo.toml webdriver line. `webdriverio` + the `e2e` script already exist.
- **Toolchain note:** Rust is now 1.96.0 (was 1.83.0). `pnpm tauri build` (HRN-04, Plan 04) should proceed; surface any further MSRV/signing quirks in `docs/phase-0-notes.md`.

## Next Phase Readiness
- Foundation is unblocked: alias resolves everywhere, 19 decoder tests green, dark window renders, clipboard seam wired, fonts vendored.
- Manual gates still pending (per harness): real-webview UI check via `pnpm tauri dev`, and the phase-boundary `pnpm tauri build` + WebDriver spike (Plan 04 / phase-0-notes).
- No blockers for Plan 02 (skeleton + router + platform seam).

## Self-Check: PASSED

All 18 claimed key files exist on disk; all 3 task commits (`12cec3a`, `90583b7`, `5874905`) exist in git history.

---
*Phase: 01-scaffold-harness-proof*
*Completed: 2026-05-30*
