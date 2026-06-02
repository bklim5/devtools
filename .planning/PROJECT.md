# DevTools

## What This Is

DevTools is a fast, offline, keyboard-driven **desktop application** (macOS first; cross-platform-capable via Tauri 2) of engineering utilities for the messy bytes developers actually see at work. **Schema-less Protobuf decoding is the hero feature**, supported by a tight, curated set of high-frequency transforms (six at v1.0; the JSON + XML formatters added in v1.1). It is a sharp wedge, not a catalogue — it wins on speed and confidence, not breadth, and every new tool must clear the product wedge before it ships.

## Core Value

**Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, entirely offline, without touching the mouse.** If everything else fails, the Protobuf decoder doing this flawlessly is the product.

## Current State

**Shipped: v1.1 "Formatters"** (2026-06-02) — Phases 7 + 8, on top of v1.0 "Distribution" (Phases 1–6, 2026-06-01).

v1.1 added the first two post-v1.0 tools — a **JSON formatter** and an **XML formatter** — both zero-runtime-dependency over native `JSON` / `DOMParser` / `XMLSerializer`, behind a shared two-pane paste-instant `FormatterView`, plus an opt-in `StatusBar` size readout (UIX-01). All 9 v1.1 requirements validated. Decoder + its 19 tests stayed byte-for-byte untouched; no new runtime deps. Archives: `.planning/milestones/v1.1-ROADMAP.md`, `.planning/milestones/v1.1-REQUIREMENTS.md`.

The app now ships **eight tools**: the Protobuf hero, Base64/Hex/Bytes, Unix Time, JWT, Hash, UUID/ULID, and the JSON + XML formatters.

## Current Milestone: v1.2 Release Tooling

**Goal:** Replace the manual `docs/RELEASE.md` dance with local helper scripts that bump versions in lockstep and build/publish signed, multi-arch releases reproducibly — CI is explicitly parked for a later milestone.

**Target features:**
- **bump-and-tag** script (`pnpm release [patch|minor|major]`) — bumps `package.json` + `tauri.conf.json` + `Cargo.toml` in lockstep, commits, creates the `vX.Y.Z` tag, pushes.
- **build-and-publish** script — runs `tauri build` (universal-apple-darwin), generates `latest.json` from the **fresh** `*.app.tar.gz.sig`, creates the GitHub Release on `bklim5/devtools-releases`, uploads DMG + `.app.tar.gz` + `latest.json`.
- **Universal binary** (Intel + Apple Silicon), closing the local arm64-only gap (Pitfall 7).
- **Stop committing `latest.json`** — generated-only, gitignore the stale root copy (currently pinned at 0.2.1).
- **Notarisation-ready** — honor `APPLE_*` env if present; Apple notarisation itself stays deferred (D-02).

**Scope notes:** App semver (`0.2.x`) stays decoupled from GSD milestone tags (`v1.x`); the release pipeline keys off the **app** version. CI (checks on push/PR + tag-triggered CI release, cross-repo PAT, minisign secrets in Actions) is **parked** for a follow-on milestone. Non-blocking carry-forwards: FormatterView narrow-width vertical stacking (UX-05); NAT-01 configurable global summon hotkey (parked).

**Progress:** Phase 9 (pure release core + housekeeping) **complete & verified** (2026-06-02, 5/5 must-haves) — `src/lib/release/version.ts` (`bumpSemver` + three surgical `setXVersion` manifest editors) + `manifest.ts` (`buildLatestJson` + dual-key `platformKey`), fully unit-tested; `Cargo.toml` reconciled 0.1.0→0.2.1 (REL-02), stale `latest.json` untracked + gitignored (REL-08). Zero new deps, decoder untouched. Next: Phase 10 (`bump-and-tag` driver).

## Requirements

### Validated

- **Foundation & harness (Phase 1)** — Tauri 2 + Vite + React + TS dark-window app from one repo; `src/lib/` ported unchanged (19 decoder tests green); `src/lib/platform/` seam; the full build+verify harness proven end-to-end on a walking skeleton + macOS real-WKWebView automation (`scripts/e2e-spike.sh`).
- **Shell (Phase 2)** — registry-driven sidebar + ⌘K palette (fuzzy, recents); registry as single control plane; preferences persistence (theme/accent/last-used/recents; window geometry → Phase 5); opens-to-last-used/hero, no picker.
- **Hero + Encoding + UX (Phase 3)** — the schema-less **Protobuf decoder** (paste→instant wire-format tree, LenInterpretation chips + per-node override, VARINT readings, resizable panes, cards/rows toggle, neutral `#N`, copy + copy-all-as-JSON) and **Base64/Hex/Bytes** (three-pane derive, base64/base64url, explicit errors). Binding UX constraints (paste-instant, visible focusable copy, status bar, WCAG-AA, layout-agnostic) validated across both tools — verified on the real WKWebView + a passing gsd-ui-review.
- **Distribution (Phase 6, DST-01/DST-02)** — packaged macOS app + signature-verified auto-updater. `tauri.conf.json` emits the DMG + updater artifacts (`createUpdaterArtifacts`, ad-hoc hardened-runtime signing wired-but-gated for a credentials-only Developer-ID flip per D-02); the updater UX (opt-in, dismissible WCAG-AA banner, tray check) runs entirely over the `platform.updater` seam with mandatory minisign verify. Proven by a real **0.2.0 → 0.2.1 round-trip** (verified signature → relaunch) against a **split-repo** release layout — private source (`bklim5/devtools`), public artifacts (`bklim5/devtools-releases`). gsd-ui-review 23/24, WCAG-AA PASS. **Gatekeeper-clean notarisation deferred to post-Apple-enrolment (D-02).**
- **Formatters (Phase 7, FMT-01..08)** — JSON + XML formatter tools behind a shared two-pane paste-instant `FormatterView`, zero new runtime dependencies (native `JSON` / `DOMParser` / `XMLSerializer`). JSON: validate (line:col), prettify 2/4/tab, minify (wins over prettify), recursive sort-keys (array order preserved). XML: validate well-formedness (parsererror surfaced with line; WebKit boilerplate stripped), prettify preserving comments/CDATA/attributes/PIs + the `<?xml?>` declaration, minify. Pure transforms in `src/lib/format/`; both tools registered registry-only (single control plane); visible focusable copy via the platform seam (no hover-only). Verified on the real WKWebView (10/10 e2e), WCAG-AA PASS (18/24), human-signed-off on the `tauri build`. Decoder + its 19 tests untouched. **Carry-forward (non-blocking polish):** FormatterView narrow-width vertical stacking (UX-05) — not a WCAG-AA blocker.
- **StatusBar size-readout cleanup (Phase 8, UIX-01)** — the shared `StatusBar` `byteCount` prop is now optional and the `aria-label="byte count"` size span renders only when a caller passes a number (`typeof byteCount === "number"` guard; no discriminated type, no other StatusBar behavior changed). Kept on Base64/Hex/Bytes + the Protobuf decoder + both Formatters (single count or `in → out` delta); dropped from Hash / UUID·ULID / Unix Time / JWT (parse-state label + error/timing only). Locked by a present-where-kept / absent-where-dropped test matrix querying the stable `aria-label` span (not text). Code review clean, verification 4/4 must-haves, real-WKWebView + WCAG-AA + `tauri build` human-signed-off. Zero new deps; decoder + its 19 tests untouched. **→ Milestone v1.1 "Formatters" fully delivered (Phases 7 + 8).**

### Active

<!-- All hypotheses until shipped and validated. Grouped; REQ-IDs assigned in REQUIREMENTS.md. -->

**Foundation & harness** — ✓ validated Phase 1
- [x] Tauri 2 + Vite + React + TS app builds and renders a dark window on macOS from one repo
- [x] Verified `src/lib/` (decoder, bytes, tool types) ported unchanged; **19 decoder vitest cases pass**
- [x] **Walking-skeleton phase that proves the full build+verify harness end-to-end before any product feature** (codex review → unit tests → real-webview UI verification, plus phase-boundary sign-off)
- [x] `src/lib/platform/` capability seam (clipboard/store/shortcuts) so tools never import `@tauri-apps/*` directly

**Shell** — ✓ validated Phase 2
- [x] Sidebar (compact mode) generated from the tool registry
- [x] ⌘K command palette (tool-switcher; fuzzy match over name+keywords+description; recent-tool memory)
- [x] Registry as the single control plane (sidebar, palette, router all derive from it)
- [x] Preferences persistence (theme, last-used tool, tree-style toggle) — window geometry deferred to Phase 5
- [x] Opens to last-used or summoned tool (no "pick a tool" friction)

**Tools (hero first)**
- [x] Protobuf Decoder (hero): schema-less wire-format tree, all viable LEN interpretations surfaced from `LenInterpretation`, resizable panes, packed-repeated UI, status bar, **cards default with rows/cards toggle** — ✓ Phase 3
- [x] Base64 / Hex / Bytes with feature-detect polyfill (`Uint8Array.toBase64`/`fromBase64`/`toHex`/`fromHex`) — ✓ Phase 3
- [x] Unix Time Converter — ✓ Phase 4 (v1.0)
- [x] JWT Debugger — ✓ Phase 4 (v1.0)
- [x] Hash Generator (Web Crypto SHA family + small MD5 lib) — ✓ Phase 4 (v1.0)
- [x] UUID / ULID Generator + Decoder — ✓ Phase 4 (v1.0)
- [x] JSON formatter (validate line:col / prettify 2·4·tab / minify / sort-keys; native `JSON`, zero-dep) — ✓ Phase 7 (v1.1)
- [x] XML formatter (validate well-formedness / prettify preserving comments·CDATA·attrs·PIs / minify; native `DOMParser`, zero-dep) — ✓ Phase 7 (v1.1)

**Workflow constraints (binding — apply to every tool)** — ✓ validated Phase 3 (both tools)
- [x] Paste-transforms-instantly (no decode button for the common case)
- [x] Copy-result-instantly via visible, focusable affordance (≤1 keystroke; no hover-only copy)
- [x] Status bar: parse state · byte count · current encoding · errors · timing
- [x] WCAG AA accessibility across the board (visible focus, AA contrast, no opacity-only disabled state)

**Ideas / backlog (not yet scheduled)**
- [ ] Protobuf decoder: decimal-byte-array (JS `Uint8Array`) input mode — paste `10, 3, 80, 81, 82` and decode, alongside hex/base64 (user feedback at Phase-3 sign-off, 2026-05-31)

**Native polish & distribution (macOS)**
- [ ] Global shortcut to summon, tray/menu, single-instance
- [ ] Code signing + notarisation (macOS), DMG, auto-updater

### Out of Scope

- **All deferred tools** (JSON/YAML/XML beautifiers, conversions, URL tools, regex tester, diff, etc.) — commodities that would dilute the product wedge. Deferred, not promised.
- **Cloud sync / accounts / payments** — offline by design; a `premium` registry seam is reserved with **zero v1 UX**.
- **Mobile (iOS/Android) UI** — architecture stays open (layout-agnostic tools, responsive Tailwind) but no v1 mobile UI.
- **Windows + Linux verification/packaging (for now)** — deferred to focus on macOS; Tauri keeps them reachable later.
- **Plugin marketplace / third-party tool loading**, **SSR/server runtime** — not the product.
- **Schema-aware Protobuf (`.proto` imports)** — future paid candidate; v1 is schema-less only.

## Context

- **Current state: Milestone v1.1 "Formatters" SHIPPED & ARCHIVED** (2026-06-02 — Phases 7 + 8 both delivered, human-signed-off, and archived to `.planning/milestones/v1.1-*`; tagged `v1.1`). All 9 v1.1 requirements ✓: FMT-01..08 (JSON + XML formatter tools behind a shared `FormatterView`, registry-only, zero new runtime deps) and UIX-01 (the `StatusBar` size readout is now opt-in — kept on Base64/Protobuf/Formatters, dropped from Hash/UUID·ULID/Unix Time/JWT). Phase 8 closed clean: code review 0 issues, verification 4/4, real-WKWebView + WCAG-AA + `tauri build` signed off; decoder + its 19 tests untouched throughout. v1.0 (Phases 1–6) shipped 2026-06-01: foundation/harness, shell, hero+encoding+UX, the catalogue tools, persistence/window-geometry, and a distributable self-updating macOS app (DST-01/DST-02). **Next: start the next milestone (`/gsd-new-milestone`) or promote a backlog item (`/gsd-review-backlog`).** **Carry-forwards (not blockers):** FormatterView narrow-width vertical stacking (UX-05, polish); Gatekeeper-clean notarisation pending Apple Developer enrolment (D-02); NAT-01 (G-05-1) parked; 3 minor a11y polish follow-ups from the updater UI review.
- **Post-design, pre-implementation handoff.** Full spec in `docs/design-and-plan.md`; harness + locked decisions in `docs/harness-and-decisions.md`; original agent brief preserved in `docs/handoff-instructions.md`.
- **Verified assets exist:** `scaffold/src/lib/` (decoder.ts ~295 lines zero-deps + 19 tests, bytes.ts, tool types/registry) — port unchanged. `design/DevTools Mockup.html` is the canonical visual system (CSS vars, IBM Plex Sans + JetBrains Mono). React components in `scaffold/` are structure-reference only — rebuild the visual layer against `design/`.
- **macOS WKWebView automation gap:** official `tauri-driver` supports only Linux/Windows. Community W3C WebDriver plugins for macOS exist (early 2026, 0.1.x). Phase 0 spikes one; fallback is `screencapture` + `chrome-devtools-mcp` against the identical static bundle.
- **Codex CLI + `/codex:review` are installed** and used as the first per-task gate.

## Constraints

- **Tech stack**: Tauri 2 + Vite + React + TypeScript + Tailwind; `react-router` **HashRouter only** (`BrowserRouter` forbidden — static files 404 on reload). Tool logic is pure frontend TS; Rust core is thin (clipboard, hotkey, tray, single-instance, auto-update).
- **No network at runtime** — self-host fonts (IBM Plex Sans + JetBrains Mono, SIL OFL, vendored), no CDN, no accounts, no setup.
- **Curated tool set, wedge-gated** — v1.0 locked "six tools only"; v1.1 deliberately reopened that to add the JSON + XML formatters (now eight tools). Growth is mechanical (registry is a plain array) but each new tool must clear the product wedge (offline, paste-instant, keyboard-driven, registry-driven, WCAG-AA, zero new runtime deps). No grab-bag additions.
- **Zero new runtime dependencies** — every tool so far is built on native browser/Web APIs (`JSON`, `DOMParser`, Web Crypto, `Uint8Array` base64/hex); the only runtime dep is `js-md5`. Hold this line.
- **Do not refactor `decoder.ts` or its 19 tests** without explicit approval — the test bar is the hero feature's spec.
- **Performance**: paste-to-interpretation < 2s; the app should feel instant (OS webview, small binary).
- **Verification (binding harness)**: every task's Definition of Done = **`/codex:review` → unit tests green (`vitest` + `tsc`) → real-webview UI verification**, in that order. Every phase ends with a **human sign-off** on a `tauri build` + `gsd-ui-review` audit. **Parallelize plans, but never let a plan advance past these gates — no skipping ahead.**
- **Platform (current)**: macOS only for build/verify; Windows + Linux deferred.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Verify against the **built Tauri app**, not a Chrome proxy | Desktop is the product's core positioning | ✓ Good — real-WKWebView e2e caught regressions unit tests missed (v1.1: `<parsererror>` newline concat) |
| Per-task gate order **review → unit → ui**; human sign-off per phase | User's explicit verification discipline for a desktop app | ✓ Good — held through 8 phases; code review caught real bugs each milestone |
| Dedicated **walking-skeleton phase** proves the harness before any feature | De-risk the whole pipeline first; macOS webview automation is unproven | ✓ Good — every later phase built on a de-risked pipeline |
| Protobuf tree **`cards` default + rows/cards toggle** (overrides handoff `tree: rows`) | User preference; build switchable format from the start | ✓ Good |
| WCAG **AA across the board** | Fits keyboard-driven positioning; audited each phase | ✓ Good — every phase passed `gsd-ui-review` WCAG-AA |
| **macOS only** for now (Windows/Linux deferred) | No Windows machine; focus the v1 path | ✓ Good (still macOS-only at v1.1) |
| Add `src/lib/platform/` capability seam | Single mock point for tests + cheap mobile/web door | ✓ Good — formatters' copy + every tool route through it; no `@tauri-apps` in shell |
| Self-host IBM Plex Sans + JetBrains Mono (SIL OFL) | "No network" constraint; licenses allow desktop redistribution | ✓ Good |
| Hand-rolled decoder over `protobufjs` | The product *is* the schema-less heuristics + ambiguity UI | ✓ Good (19 tests pass; untouched through v1.1) |
| **Zero new runtime deps for formatters** — native `JSON`/`DOMParser`/`XMLSerializer` (v1.1) | The zero-dep ethos is part of the wedge; avoids supply-chain + bundle bloat | ✓ Good — both formatters shipped with no new deps |
| **Shared two-pane `FormatterView`** reused by JSON + XML; pure logic in `src/lib/format/` (v1.1) | One layout, no duplication; pure logic keeps GUI thin + a future CLI reachable | ✓ Good |
| **`StatusBar.byteCount` opt-in** via optional prop + type guard, no discriminated type (v1.1) | Minimal additive API; keep/drop decided against real callers (Phase 8 after 7) | ✓ Good |
| **Reopen "six tools only"** to add JSON + XML formatters (v1.1) | Highest-value adjacent tools; wedge still gates additions | ✓ Good — eight tools, wedge intact |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-02 — Phase 9 (pure release core + housekeeping) complete & verified within milestone v1.2 "Release Tooling". Previous: v1.2 started (local release helper scripts; CI parked); v1.1 "Formatters" — Phases 7 + 8 archived, tagged v1.1*
