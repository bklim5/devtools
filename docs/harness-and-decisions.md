# DevTools — Verification Harness & Locked Decisions

**Date:** 2026-05-30
**Status:** Approved — input to `/gsd-new-project`
**Companion to:** `docs/design-and-plan.md` (the settled product spec). This doc adds
(1) the answers to the §14 open questions, (2) one architecture addition, and (3) the
build+verify harness that gates every step. Where this doc and the handoff disagree, **this
doc wins** (the deviations are called out explicitly below).

---

## 1. Locked decisions (resolves design-and-plan.md §14 + the CLAUDE.md blocking questions)

| # | Question | Decision | Notes / deviation |
|---|---|---|---|
| 1 | Linux v1 packaging target? | **Best-effort.** Not a release deliverable. | Matches handoff "Linux as a bonus". |
| 2 | Accessibility floor? | **WCAG AA across the board.** | Visible focus indicators everywhere; AA contrast (fix `--tx-3 #686d77` on dark bg); disabled state must not rely on opacity alone. Audited at each phase boundary. |
| 3 | Self-hosted fonts? | **Yes — bundle IBM Plex Sans + JetBrains Mono locally.** | Both are SIL OFL → redistributable in a desktop binary. License files verified & vendored in Phase 0. No Google Fonts at runtime. |
| 4 | Default Protobuf tree style? | **`cards` default, with a `rows`/`cards` toggle persisted in prefs.** | **DEVIATION** from handoff `TWEAK_DEFAULTS: tree: rows`. User wants `cards` as the start, format switchable by user preference. Build the toggle from the start; persist it. |

**Platform scope (current):** **macOS only for now.** Windows and Linux verification are
deferred — no Windows machine available and the product is being driven on macOS. The
architecture stays cross-platform (Tauri 2), but the harness, builds, and UI verification
target macOS until Windows is reintroduced. The handoff's "signed build on both OSes in
Phase 0" is **descoped to macOS** for now.

All other handoff constraints (§9 binding constraints, six-tools-only, HashRouter,
registry-as-control-plane, port `src/lib/` unchanged, 19-test decoder bar) stand unchanged.

---

## 2. Architecture addition: `src/lib/platform/` capability seam

The only structural addition beyond the handoff. A thin interface wrapping OS-level
capabilities, so the rest of the frontend never imports `@tauri-apps/*` directly.

```
src/lib/platform/
  index.ts        // capability interface: clipboard, store, shortcuts, window
  tauri.ts        // real impl via @tauri-apps/plugin-* (used in the app)
  index.ts picks the impl at startup
```

**Why (re-justified after rejecting the "verify in Chrome" rationale):**
1. **Testability.** vitest/jsdom component tests need *one* injectable mock point for OS
   APIs instead of scattered `@tauri-apps` mocks across every tool.
2. **Mobile/web door.** Handoff §10 already requires layout-agnostic tools; this is the
   runtime-capability half of the same discipline. Near-zero cost now.

**The verification target is the built Tauri app, not a browser.** The seam is for test
isolation and future portability — it does **not** change what we verify against.

**Rule:** tool components import `lib/platform`, never `@tauri-apps/*`. A tool reaching for
a Tauri plugin directly is a bug to be lifted into the seam.

---

## 3. The verification harness — two loops, three gates

Verification centers on the **real Tauri webview** (WKWebView via `tauri dev` / `tauri
build`), because the desktop app *is* the product. No Chrome-proxy stand-in for the primary
path.

### 3.0 Planning gate — runs per **phase**, before execution

After `/gsd-plan-phase` produces the PLAN.md set and the internal `gsd-plan-checker`
passes, but **before** `/gsd-execute-phase` starts, run an independent adversarial
Codex review **over the plans themselves**:

```
/codex:adversarial-review --wait --base <commit-before-the-plan-commit> review these PLAN.md files AS execution plans
```

- **Why:** `gsd-plan-checker` is a GSD-internal reviewer and shares blind spots with the
  GSD planner that wrote the plans. A second, independent model challenges the *approach*
  (decision coverage vs CONTEXT.md, task sequencing / wave dependencies, hidden risks,
  missing acceptance criteria, scope creep) before any code is written — the cheapest place
  to catch a wrong plan.
- **Scope:** the plan commit only. Plans are committed by the planner, so use `--base`
  pointed at the commit *before* `docs(NN): create phase plan` (e.g. the `docs(NN): capture
  phase context` commit) so Codex sees exactly the new PLAN.md files.
- **Review-only.** Findings are triaged and folded back via a `gsd-planner` revision (or a
  manual plan edit) and re-checked; execution does not start until they're addressed or
  consciously waived. This mirrors the inner loop's `/codex:adversarial-review` but targets
  plans, not code.

### 3.1 Inner loop — runs per GSD **task**

Every task's Definition of Done = **all five gates green**, in this order, before the next
task starts:

1. **`/simplify`** — run on the just-written changes to apply reuse / simplification /
   efficiency / altitude cleanups. Quality only (it does not hunt for bugs — that's the next
   step). Running it first means review and tests cover the simplified code, not throwaway.
2. **`/code-review xhigh`** — recall-mode multi-angle bug hunt over the task's diff (9 finder
   angles → 1-vote verify → sweep). Catch every real bug; address each confirmed finding.
   Runs before the adversarial pass so the deep line-level defects are already fixed when the
   second opinion looks at design.
3. **`/codex:adversarial-review`** — `/codex:adversarial-review --wait --scope working-tree`
   on the task's diff. An independent adversarial second opinion that challenges the
   implementation approach + design choices (not just line bugs). Review-only (it never
   patches); findings are addressed before moving on. Because we use TDD, unit tests already
   exist and are green by review time, so review scrutinizes design and correctness, not
   broken plumbing.
4. **Unit tests** — `vitest` green + `tsc --noEmit` clean. The decoder's **19 cases are the
   immovable bar**; every new tool/feature adds its own cases (TDD: tests first).
5. **UI test** — against **`tauri dev`** (the real WKWebView, hot-reload). Screenshot +
   computed-ARIA / a11y check + DOM assertions, diffed against `design/DevTools Mockup.html`
   and the §9 binding constraints. Driven via the macOS WebDriver path (see §3.3).

Gate order is the user's explicit sequence: **simplify → code-review xhigh → adversarial review → unit → ui**.

### 3.2 Outer loop — runs per **phase boundary** (human sign-off)

1. **The agent runs `pnpm tauri build` automatically** when a phase reaches the
   human-verify checkpoint — the human should never have to kick off the build.
   The build's final non-zero exit is only the absent updater-signing key
   (`TAURI_SIGNING_PRIVATE_KEY`); confirm success by the presence of the
   `.app`/`.dmg` under `src-tauri/target/release/bundle/macos/`, not the exit code.
   - **The build MUST be the last step before the walkthrough, after EVERY source
     change in the phase has landed.** In a multi-plan phase, an early checkpoint
     plan can trigger `tauri build` *before* later plans land their webview changes —
     reusing that earlier bundle ships the human a STALE app (they test old behavior
     and report an already-fixed "bug"). Before presenting ANY phase-boundary
     walkthrough, **rebuild and verify the bundle binary's mtime is newer than the
     last source commit**: compare `stat -f %Sm src-tauri/target/release/bundle/macos/TinkerDev.app/Contents/MacOS/devtools-app`
     against `git log -1 --format=%cd`. Never relay a subagent's "build done" as
     current without that mtime check.
2. The agent reports the built-app path; the **human launches the packaged app and
   walks the new tool** through the checkpoint scenarios.
3. **`gsd-ui-review`** 6-pillar visual audit + WCAG AA a11y pass on the built app.
4. **Human reviews and approves** before the next phase begins. Launching, testing,
   and approval are the only required manual steps — the build is automated.

`gsd-ui-phase` produces the `UI-SPEC.md` design contract at the start of each frontend
phase; `gsd-ui-review` audits against it at the end.

### 3.3 macOS real-webview automation (Phase 0 spike, with fallback)

The official `tauri-driver` does **not** support macOS — Apple ships no WKWebView driver
(only Linux/Windows are officially supported). As of early 2026, community W3C WebDriver
implementations exist for WKWebView (`tauri-plugin-webdriver`, `tauri-wd`), but they are
young (0.1.x).

- **Phase 0 spike:** prove one of them can drive *our* app (find element, input, screenshot,
  ARIA roles). If it works, it becomes the inner-loop UI driver.
- **Fallback if it doesn't:** per-task UI check = `screencapture` of the real app window
  (visual sign-off) **+** `chrome-devtools-mcp` against the byte-identical static bundle for
  deep DOM / a11y / visual-diff automation. The bundle is the same web content WKWebView
  renders, so DOM/a11y findings transfer; only "literally inside WKWebView" is lost.
- **Decision recorded in** `docs/archive/phase-0-notes.md`.

### 3.4 Tooling summary

| Concern | Tool |
|---|---|
| Planning gate (per phase, pre-execute) | `/codex:adversarial-review --wait --base <pre-plan-commit>` over the PLAN.md set |
| Bug-hunt gate | `/code-review xhigh` (recall-mode, 9 angles) |
| Adversarial review gate | `/codex:adversarial-review --wait --scope working-tree` |
| Unit / logic | `vitest`, `@testing-library/react`, jsdom; `tsc --noEmit` |
| Real-webview UI (per task) | `tauri dev` + macOS WebDriver plugin (spike) **or** `screencapture` + `chrome-devtools-mcp` (fallback) |
| Build (per phase) | `tauri build` (macOS) |
| UI contract / audit | `gsd-ui-phase` (UI-SPEC.md) · `gsd-ui-review` (6-pillar) |
| a11y (WCAG AA) | `chrome-devtools-mcp` a11y audit on the static bundle + computed-ARIA on the real webview |

---

## 4. Mapping onto GSD

`/gsd-new-project` produces `PROJECT.md` + `ROADMAP.md`. Seed the roadmap with the handoff's
phases, in order, no interleaving:

| Phase | Scope (from design-and-plan.md §11) | Harness emphasis |
|---|---|---|
| 0. Scaffold | Tauri 2 + Vite + React + TS; HashRouter; dark window; port `src/lib/` (19 tests green); **macOS** dist spike | **Plus:** prove macOS real-webview automation path (§3.3); vendor fonts; set up `src/lib/platform` |
| 1. Shell | Sidebar (compact), ⌘K palette (tool-switcher), registry, clipboard, prefs persistence (incl. tree-style toggle), `TransformTool` primitives | Three-gate loop active; `gsd-ui-phase` contract |
| 2. Hero + #2 | Protobuf decoder (19-bar, resizable panes, packed-repeated UI, status bar, **cards default**); Bytes/Base64/Hex | §1 workflow targets must hold; chips driven from `LenInterpretation` |
| 3. Catalogue | Unix Time, JWT, Hash, UUID/ULID; action-palette layer | Same constraints per tool |
| 4. Native polish | Global shortcut, tray, single-instance | macOS only for now |
| 5. Distribution | Code signing + notarisation (macOS), DMG, auto-updater | Windows/Linux deferred |

The **five-gate Definition of Done (simplify → code-review xhigh → adversarial review → unit → ui)**
and the **phase-boundary human sign-off** become project conventions in `PROJECT.md`, so every
`gsd-execute-phase` enforces them.

---

## 5. Open items intentionally deferred (not blocking)

- Action-palette day-one action set (design-and-plan.md §14.2) — decided in Phase 3.
- stable vs experimental status per tool (§14.3) — Protobuf is stable; others assessed in Phase 2–3.
- Windows + Linux verification and packaging — reintroduced after macOS v1 path is proven.
