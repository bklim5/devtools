# Roadmap: DevTools

## Overview

DevTools ships as a macOS-first Tauri 2 + Vite + React + TS desktop app whose hero is a schema-less Protobuf decoder. The journey is deliberately risk-first: Phase 1 proves the **entire build+verify harness end-to-end on a trivial feature** (a walking skeleton) before any product code is written — Tauri shell, ported `src/lib/` with its 19 passing decoder tests, the `src/lib/platform/` seam, self-hosted fonts, the per-task review→unit→ui gate, the macOS real-webview automation spike, and a working `tauri build`. Only then do product features follow the handoff §11 order with no interleaving: the registry-driven Shell (Phase 2), the riskiest path — the Protobuf hero plus Base64/Hex/Bytes plus the binding cross-cutting UX constraints — proven early (Phase 3), the remaining four catalogue tools (Phase 4), macOS native polish (Phase 5), and signed/notarised distribution with auto-update (Phase 6). Every phase is gated by per-task DoD (review → unit → ui) and a phase-boundary human sign-off plus `gsd-ui-review` audit; plans within a phase may run in parallel but never bypass those gates.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Scaffold + Harness Proof** - Walking skeleton that proves the full build+verify harness end-to-end before any product feature (completed 2026-05-30)
- [ ] **Phase 2: Shell** - Registry-driven sidebar, ⌘K command palette, prefs persistence, opens-to-last-tool
- [ ] **Phase 3: Hero (Protobuf) + Encoding + UX Constraints** - Schema-less Protobuf decoder and Base64/Hex/Bytes under the binding cross-cutting UX constraints — the riskiest path, proven early
- [x] **Phase 4: Catalogue** - Unix Time, JWT, Hash, UUID/ULID under the same workflow constraints (complete 2026-05-31; the 5 human-UAT defects closed by 04-07 and **human-verified + signed off 2026-06-01** alongside Phase 5)
- [x] **Phase 5: Native Polish** - Tray/menu + single-instance (NAT-02) shipped & human-verified 2026-06-01; window-geometry restore (SHL-05) done. **NAT-01 global summon hotkey PARKED** (G-05-1 — chord collision + no macOS "taken?" API; summon via tray + single-instance; configurable hotkey → future Settings phase)
- [ ] **Phase 6: Distribution** - Code signing + notarisation, DMG, auto-updater (macOS)

## Phase Details

### Phase 1: Scaffold + Harness Proof
**Goal**: The full build+verify harness is proven end-to-end on a trivial walking-skeleton feature, with the Tauri shell standing, the verified `src/lib/` ported (19 decoder tests green), the platform seam and fonts in place, and a working macOS build — so every subsequent phase can build on a de-risked pipeline.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, HRN-01, HRN-02, HRN-03, HRN-04
**Success Criteria** (what must be TRUE):
  1. `tauri dev` launches a dark macOS window matching the design's `--win`/`--bg-app` colors, with `react-router` HashRouter wired and unknown routes redirecting to the first tool (no BrowserRouter).
  2. The verified `src/lib/` (decoder, bytes, tool types, registry) is ported unchanged and `vitest` reports all 19 decoder cases passing on first run; `tsc --noEmit` is clean.
  3. A trivial walking-skeleton feature passes the complete per-task gate in order — `/codex:review` → `vitest`+`tsc` → real-webview UI verification — demonstrating the gate works end-to-end before any product feature exists.
  4. The macOS real-webview automation path is proven (community WebDriver plugin spike) OR the `screencapture`+`chrome-devtools-mcp` fallback is in place, with the chosen path and rationale recorded in `docs/phase-0-notes.md`.
  5. `tauri build` produces a runnable macOS bundle; tools reach OS capabilities only through `src/lib/platform/` (no direct `@tauri-apps/*` imports), IBM Plex Sans + JetBrains Mono load from vendored local files with no network access, and the phase ends with human sign-off + `gsd-ui-review` audit.
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — Scaffold Tauri+React+TS in place, wire @/ alias + Tailwind v4 + vitest, port src/lib/ unchanged (19 tests green), vendor fonts, dark window (FND-01/03/05)
- [x] 01-02-PLAN.md — HashRouter verbatim, platform capability seam (clipboard), throwaway byte-inspector skeleton with TDD (FND-02/04, HRN-01)
- [x] 01-03-PLAN.md — lefthook pre-commit unit gate (blocks bad commits) + runnable unsigned tauri build, findings in phase-0-notes.md (HRN-03/04)
- [x] 01-04-PLAN.md — macOS webview automation spike (tauri-plugin-webdriver, debug-only) or fallback, skeleton through the full review→unit→ui gate, human sign-off (HRN-01/02)
**UI hint**: yes

### Phase 2: Shell
**Goal**: A registry-driven application shell where the sidebar, ⌘K palette, and router all derive from a single tool registry, preferences persist across restarts, and the app opens straight to the last-used or summoned tool with no "pick a tool" friction.
**Depends on**: Phase 1
**Requirements**: SHL-01, SHL-02, SHL-03, SHL-04, SHL-05 (PARTIAL — window-geometry deferred to Phase 5 per D-11), SHL-06
**Success Criteria** (what must be TRUE):
  1. The compact sidebar (icon + name) renders entirely from the tool registry, and adding a tool (one file + one registry entry) makes it appear in sidebar, palette, and route with no other wiring (single control plane).
  2. ⌘K opens a command palette that fuzzy-matches over name+keywords+description, surfaces recently-used tools, and switches tools on Enter — achieving no-mouse tool switching end-to-end.
  3. Preferences (theme, last-used tool, window geometry, Protobuf tree style) persist across an app restart via the platform store seam. *(Phase 2 delivers theme/accent + last-used + recents; window geometry is deferred to Phase 5 (D-11) and the Protobuf tree-style value is written by Phase 3 — SHL-05 is therefore PARTIAL at the Phase 2 boundary.)*
  4. Relaunching the app opens directly to the last-used tool (or the summoned tool) with no "pick a tool" step.
  5. Every plan in the phase passes the per-task gate (review → unit → ui) with no skipping ahead, and the phase ends with a passing `gsd-ui-review` WCAG-AA audit and human sign-off on a fresh `tauri build`.
**Plans**: 4 plans
Plans:
- [x] 02-01-PLAN.md — Foundation: install lucide-react@1.17.0 + @tauri-apps/plugin-store@2.4.3, register the Rust store plugin + scope store:default, make the Store seam real (plugin-store / localStorage), add shell CSS tokens, enable the three tools as a shared placeholder (SHL-04/05; D-01/09/10)
- [x] 02-02-PLAN.md — In-house zero-dependency fuzzy ranker rankTools over name+keywords+description, fully unit-tested (SHL-02; D-06)
- [x] 02-03-PLAN.md — usePreferences + useRecentTools over the Store seam, single resolveStartupTool seam (explicit > last-used > hero), router index-route wiring + prefs preload (SHL-03/04/05/06; D-08/12/13/14)
- [x] 02-04-PLAN.md — Registry-driven compact Sidebar + ⌘K CommandPalette (fuzzy + recents + keyboard nav) + App.tsx shell chrome, ending with the phase human-verify checkpoint (SHL-01/02/03/04/06; D-02/03/04/05/07)
**UI hint**: yes

### Phase 3: Hero (Protobuf) + Encoding + UX Constraints
**Goal**: The schema-less Protobuf decoder and the Base64/Hex/Bytes tool are shipped to the §1 workflow bar, with the binding cross-cutting UX constraints applied to both — proving the riskiest path (the hero and its ambiguity/workflow constraints) immediately after the shell.
**Depends on**: Phase 2
**Requirements**: PRO-01, PRO-02, PRO-03, PRO-04, PRO-05, PRO-06, PRO-07, ENC-01, ENC-02, ENC-03, UX-01, UX-02, UX-03, UX-04, UX-05
**Success Criteria** (what must be TRUE):
  1. Pasting hex or base64 bytes renders the recursive wire-format field tree instantly with no decode button (wire types 0/1/2/5 supported, groups 3/4 surfaced as errors not crashes), and the full interpretation runs paste-to-interpretation in under 2 seconds.
  2. Every LEN field's interpretation chips are computed directly from the decoder's `LenInterpretation` — showing message/string/bytes plus packed-varints/packed-i32/packed-i64 when structurally valid — and the user can resolve ambiguity per node by selecting a chip (VARINT nodes also show zigzag + signed int64); panes are resizable, the tree defaults to cards with a persisted rows/cards toggle, and `#N` numbers render neutral (accent reserved for selected state).
  3. In the Base64/Hex/Bytes tool, editing any of text/base64/hex derives the other two from an internal `Uint8Array`, modern `Uint8Array` base64/hex APIs are used with a feature-detect polyfill fallback, encoding errors are explicit, and a base64/base64url alphabet toggle works.
  4. Both tools satisfy the binding cross-cutting constraints: paste transforms instantly (Cmd+V), every output region has a visible focusable copy affordance reachable in ≤1 keystroke (no hover-only copy), a status bar shows parse state · byte count · current encoding · errors · timing, tool components are layout-agnostic (responsive Tailwind, no fixed widths), and WCAG AA holds (visible focus, AA contrast, no opacity-only disabled state).
  5. Plans run in parallel but every one passes the per-task gate (review → unit → ui) with the decoder's 19 tests still green and new tools adding their own TDD cases; the phase ends with a passing `gsd-ui-review` audit and human sign-off on a `tauri build`.
**Plans**: 4 plans
Plans:
- [x] 03-01-PLAN.md — Add persisted protobufTreeStyle (cards/rows) to the Preferences seam (PRO-06; D-07)
- [x] 03-02-PLAN.md — Protobuf pure logic: detectEncoding, chip derivation + smart default, decode orchestration (errors-as-strings), copy-as-JSON (PRO-01/02/03/04; D-01/02/04/06/11)
- [x] 03-03-PLAN.md — Base64/Hex/Bytes tool: single-Uint8Array derive, alphabet toggle, status bar, focusable copy + registry swap (ENC-01/02/03, UX-01/02/03/04/05; D-12/13/14)
- [x] 03-04-PLAN.md — Protobuf hero UI: resizable split, recursive cards/rows tree, LenInterpretation chips, per-node + copy-all-as-JSON, persisted toggle, neutral #N + registry swap + phase sign-off (PRO-01..07, UX-01..05; D-03/05/08/09/10)
**UI hint**: yes

### Phase 4: Catalogue
**Goal**: The remaining four tools — Unix Time, JWT, Hash, UUID/ULID — ship under the identical binding workflow constraints, completing the six-tool v1 catalogue.
**Depends on**: Phase 3
**Requirements**: TIME-01, JWT-01, HASH-01, UID-01
**Success Criteria** (what must be TRUE):
  1. Pasting a unix timestamp (s/ms) shows human-readable local + UTC datetimes and the reverse conversion works; pasting a JWT shows decoded header + payload (and the signature segment) with malformed tokens reported clearly.
  2. Inputting text/bytes produces MD5 + SHA-1/256/384/512 digests (Web Crypto for SHA, JS lib for MD5), and the user can generate UUIDs/ULIDs with one keystroke and decode a pasted UUID/ULID into its components.
  3. All four tools honor the cross-cutting constraints (instant paste-transform, ≤1-keystroke visible copy, status bar, WCAG AA, layout-agnostic components) and the app's no-mouse switching and opens-to-last-tool behaviors continue to hold.
  4. Plans run in parallel but each passes the per-task gate (review → unit → ui) with no skipping ahead; the phase ends with a passing `gsd-ui-review` audit and human sign-off on a `tauri build`.
**Plans**: 6 plans
Plans:
- [x] 04-01-PLAN.md — Foundation (Wave 1): relocate shared StatusBar → src/components + extract CopyButton (D-04), install js-md5@0.8.3, hand-roll ulid.ts + uuidv7.ts + shared timeFormat.ts (TDD vectors), register all four tools as placeholders in registry.ts (TIME-01/JWT-01/HASH-01/UID-01; D-01/02/03/04)
- [x] 04-02-PLAN.md — Unix Time tool (Wave 2): two-way s/ms↔local/UTC/ISO over timeFormat, auto-detect+override unit, reverse field, live now, status bar + focusable copy, component swap + e2e (TIME-01; D-03/05/06)
- [x] 04-03-PLAN.md — JWT tool (Wave 2): pure decodeJwt (split→base64url→JSON + field-scoped error taxonomy), humanized+flagged exp/iat/nbf claims, display-only, component swap + e2e (JWT-01; D-07/08/09/10)
- [x] 04-04-PLAN.md — Hash tool (Wave 2): hashes.ts (js-md5 sync + Web Crypto SHA async) vs known vectors, text/hex/base64 input toggle → single Uint8Array, 5 stacked digests + casing toggle + per-row copy, component swap + e2e (HASH-01; D-01/11/12/13/14/19)
- [x] 04-05-PLAN.md — UUID/ULID tool (Wave 2): generate v4/v7/ULID (on-open + 1-keystroke regen + batch + copy-all) + decodeId auto-detect breakdown, component swap + e2e (UID-01; D-02/15/16/17)
- [x] 04-06-PLAN.md — Phase boundary (Wave 3): full suite + fresh tauri build + four real-WKWebView e2e + gsd-ui-review WCAG-AA audit + mark phase complete (autonomous: false) — **Task 1 (automated gates) COMPLETE; human sign-off DEFERRED (user AFK), tracked in 04-HUMAN-UAT.md**
**UI hint**: yes

### Phase 5: Native Polish ✓ COMPLETE (signed off 2026-06-01)
**Goal**: macOS native integration — a global shortcut summons/focuses the app from anywhere, the app has tray/menu presence, and a second launch focuses the existing window — all routed through the platform seam. *(Outcome: tray + single-instance + window-geometry shipped & human-verified; the global-hotkey summon was PARKED per decision G-05-1 — summon ships via tray + single-instance, configurable hotkey defers to a future Settings phase.)*
**Depends on**: Phase 4
**Requirements**: NAT-01, NAT-02
**Success Criteria** (what must be TRUE):
  1. A global keyboard shortcut summons and focuses the app window from any other application on macOS, deep-linking via hash routes where applicable.
  2. The app shows tray/menu presence, and launching a second instance focuses the existing window rather than opening a new one (single-instance).
  3. Native capabilities are reached through `src/lib/platform/` (no direct `@tauri-apps/*` imports in tools), and offline-by-design still holds (no network at runtime).
  4. Each plan passes the per-task gate (review → unit → ui); the phase ends with a passing `gsd-ui-review` audit and human sign-off on a `tauri build`.

  *Note: window-geometry persistence (SHL-05's deferred clause, D-11) lands here alongside the native window work.*
**Plans**: 4 plans
Plans:
- [x] 05-01-PLAN.md — Rust foundation (Wave 1): add tauri-plugin-single-instance@2.4.2 + global-shortcut@2.3.2 + window-state@2.4.1 + tray-icon feature; register single-instance FIRST in lib.rs; tray icon + menu (Show/Quit) in setup(); grant least-privilege capabilities; window visible:false for flash-free restore; keep webdriver release-exclusion intact (NAT-02; D-02/03)
- [x] 05-02-PLAN.md — Platform-seam extension (Wave 1): install @tauri-apps/plugin-global-shortcut@2.3.2; extend Platform with window + nativeShortcut (real impl in tauri.ts ONLY, no-ops in browser.ts); Wave-0 platform.test.ts coverage; grep audit clean (NAT-01)
- [x] 05-03-PLAN.md — Shell wiring (Wave 2): summon.ts with SUMMON_CHORD constant (CommandOrControl+Shift+D) + registerSummon() over the seam (unminimize→show→setFocus order, graceful register-failure); wire into main.tsx; real-WKWebView e2e for HashRouter deep-link + launch-with-plugins (NAT-01; D-01/03/04)
- [x] 05-04-PLAN.md — Phase boundary (Wave 3, autonomous: false): full suite + seam/release/offline/capability audits + fresh tauri build + e2e + gsd-ui-review WCAG-AA + HUMAN packaged-build sign-off (NAT-01/NAT-02/SHL-05, OS-level — batched the deferred Phase-4 UAT). **Signed off 2026-06-01**: tray + single-instance + geometry PASS; Phase-4 amendments PASS; NAT-01 hotkey PARKED (G-05-1, summon removed from startup)
**UI hint**: yes

### Phase 6: Distribution
**Goal**: A signed, notarised, distributable macOS release — a DMG the user can install, with a wired and verifying auto-updater.
**Depends on**: Phase 5
**Requirements**: DST-01, DST-02
**Success Criteria** (what must be TRUE):
  1. The macOS build is code-signed and notarised and packages as a DMG that installs and launches on a clean machine without Gatekeeper warnings.
  2. The auto-updater is wired and verifies updates (signature check) before applying them.
  3. The shipped release preserves the §1 workflow targets end-to-end: paste-to-interpretation under 2s, no-mouse tool switching, one-keystroke copy, opens-to-last-tool, and no network at runtime.
  4. The release passes a final per-task gate and a phase-boundary human sign-off + `gsd-ui-review` audit on the distributed bundle.
**Plans**: 5 plans
Plans:
- [x] 06-01-PLAN.md — Repo hygiene: .gitignore secrets hardening + lockstep version bump to 0.2.0 (D-05/D-16)
- [x] 06-02-PLAN.md — Platform-seam updater accessor + autoUpdateCheck pref coercion + Wave-0 unit scaffolds (DST-02; D-09/D-12)
- [x] 06-03-PLAN.md — Tauri config wiring: updater/process plugins + tray item + capabilities + tauri.conf updater/signing block + entitlements + minisign keygen (autonomous: false) (DST-01/DST-02; D-02/D-04/D-07/D-15)
- [ ] 06-04-PLAN.md — Updater UX: orchestration + WCAG-AA dismissible banner + first-run opt-in + manual tray-check + e2e (DST-02; D-09/D-10/D-11/D-13)
- [ ] 06-05-PLAN.md — Phase boundary: RELEASE.md runbook + full gate + signed build + real updater round-trip human sign-off (autonomous: false) (DST-01/DST-02; D-14/D-16)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold + Harness Proof | 4/4 | Complete    | 2026-05-30 |
| 2. Shell | 2/4 | In Progress|  |
| 3. Hero + Encoding + UX | 1/4 | In Progress|  |
| 4. Catalogue | 6/6 | Complete (sign-off deferred) | 2026-05-31 |
| 5. Native Polish | 4/4 | Complete | 2026-06-01 |
| 6. Distribution | 0/5 | Planned | - |
