# Phase 1: Scaffold + Harness Proof - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the Tauri 2 + Vite + React + TS application on macOS and prove the **entire build+verify harness end-to-end on a throwaway walking-skeleton feature**, before any product code exists. Concretely: initialize the app, render a dark window, wire HashRouter, port the verified `src/lib/` unchanged (19 decoder tests green), stand up the `src/lib/platform/` capability seam, vendor the fonts, get a working `tauri build`, and run one trivial feature through the full `/codex:review → vitest+tsc → real-webview UI` gate plus a phase-boundary sign-off.

**In scope:** FND-01..05, HRN-01..04.
**Out of scope:** any of the six real tools, the registry-driven shell/sidebar/palette (Phase 2), prefs persistence beyond a platform-store stub (Phase 2).
</domain>

<decisions>
## Implementation Decisions

### macOS webview automation (HRN-02)
- **D-01:** Spike **`Choochmeque/tauri-webdriver`** (cross-platform `tauri-plugin-webdriver`, driven via WebdriverIO) **first**. Chosen over `danielraffel/tauri-wd` for widest future leverage — one plugin also covers Windows/Linux when they return.
- **D-02:** The spike is **time-boxed to a single plan**. Success bar = it can reliably launch our app, find an element, send input, and take a screenshot of the real WKWebView. If it can't within the time-box, **fall back** to `screencapture` of the real app window (visual) + `chrome-devtools-mcp` against the byte-identical static bundle (DOM/a11y automation).
- **D-03:** The chosen path and rationale are **recorded in `docs/phase-0-notes.md`** (this is the HRN-02 deliverable). Whichever path wins becomes the per-task UI gate driver for all later phases.

### Walking-skeleton feature (HRN-01)
- **D-04:** The throwaway feature is a **minimal paste→transform→copy demo** (a "byte inspector": on paste, show input length + an uppercase/hex transform), deliberately exercising the exact UX-constraint surface the per-task UI gate must verify: **paste-transforms-instantly, a visible+focusable copy affordance (≤1 keystroke, no hover-only), and a status bar** (parse state · byte count · timing).
- **D-05:** It is **explicitly throwaway** — removed before Phase 2 begins. It must **not** reuse the real Protobuf or Base64 tools (Phase 3 owns those); it exists only to drive the harness through a realistic shape.
- **D-06:** This skeleton is what passes the full gate in order — `/codex:review` → `vitest`+`tsc` → real-webview UI verification — demonstrating the pipeline works before product code.

### Gate enforcement (HRN-03)
- **D-07:** Add a **`lefthook` pre-commit hook running `tsc --noEmit` + `vitest run`** so no commit lands with broken types or tests — the unit gate is enforced mechanically, not just by agent discipline.
- **D-08:** The **UI gate and `/codex:review` stay manual** steps in the per-task DoD — a git hook can't run them (`/codex:review` is `disable-model-invocation`; UI verification needs the running app). Lefthook covers the unit gate only.

### Claude's Discretion (tooling baseline — not separately discussed)
- **D-09:** Package manager **pnpm**; **Tailwind v4** (CSS-first `@theme`, maps cleanly to the design's CSS-variable system); **eslint + prettier**. Verify current `create-tauri-app` options and Tailwind v4 stability at plan time (per-phase research is enabled).
- **D-10:** Keep the project in the current directory (`devtools-handoff/`) rather than renaming to `devtools/` — renaming a live git repo mid-stream is needless churn; the handoff's rename suggestion is cosmetic.
- **D-11:** `src/lib/platform/` ships in Phase 1 as a **real seam with a Tauri impl + thin stubs** sufficient for the skeleton (clipboard at minimum). Full persistence/store lands in Phase 2 (SHL-05).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### Product spec & decisions
- `docs/design-and-plan.md` — full spec; §3 stack rationale, §5 architecture, §7 decoder, §11 milestones (Phase 0 = this phase's scaffold portion)
- `docs/harness-and-decisions.md` — the build+verify harness (§3 two-loop, three-gate), locked decisions (§1), platform seam (§2), macOS automation spike + fallback (§3.3). **Authoritative where it differs from the handoff.**
- `docs/handoff-instructions.md` — original agent brief; "Phase 0" section + "Port unchanged" list + target repo layout

### Visual system (for the skeleton's dark window + skeleton UI)
- `design/DevTools Mockup.html` — CSS variables (`--win`, `--bg-app`, etc.), IBM Plex Sans + JetBrains Mono, status-bar/copy patterns

### Verified code to port UNCHANGED (FND-03)
- `scaffold/src/lib/protobuf/decoder.ts` — hero decoder (~295 lines, zero deps); do not modify
- `scaffold/src/lib/protobuf/decoder.test.ts` — the 19-case test bar; must pass on first run
- `scaffold/src/lib/bytes.ts` — Uint8Array ↔ base64/base64url/hex
- `scaffold/src/lib/tools/types.ts` — extended `ToolDefinition` contract
- `scaffold/src/lib/tools/registry.ts` — registry contract (control plane)
- `scaffold/README.md` — port-unchanged vs rebuild guidance
- `scaffold/src/{App,main,router}.tsx`, `scaffold/src/components/Sidebar.tsx` — **structure reference only**, rebuild visuals against `design/`

### External tooling to research at plan time
- `Choochmeque/tauri-webdriver` (GitHub) — cross-platform `tauri-plugin-webdriver`; primary automation spike target (D-01)
- `danielraffel/tauri-wd` (GitHub) — macOS W3C WebDriver; fallback automation candidate
- Tauri 2 WebDriver docs (`v2.tauri.app/develop/tests/webdriver/`) — note: official `tauri-driver` is Linux/Windows only

### Deliverable this phase creates
- `docs/phase-0-notes.md` — distribution spike + automation-path decision (HRN-02, HRN-04)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (port unchanged)
- `scaffold/src/lib/` — decoder, bytes, tool types, registry. Copy verbatim to `src/lib/`; run vitest immediately (FND-03). Uses `@/` path alias (`@/lib/...`, `@/tools/...`) — Vite + tsconfig must define it.

### Established Patterns
- **Registry-as-control-plane**: `registry.ts` exports `TOOLS`/`ENABLED_TOOLS`/`getToolById`/`searchTools`. The router maps `ENABLED_TOOLS` to `tools/<id>` routes via `createHashRouter`. The skeleton can register itself as a temporary tool to exercise this, OR live outside the registry — planner's choice (it's throwaway).
- **HashRouter only** (`createHashRouter`), unknown route → first tool (`router.tsx` pattern).

### Integration Points
- The skeleton tool wires through `src/lib/platform/` for clipboard (copy affordance), proving tools never import `@tauri-apps/*` directly (FND-04).
- Vendored fonts load via local `@font-face` (FND-05) — no Google Fonts (`design/DevTools Mockup.html` currently loads them from CDN; fix on port).

### Constraints from existing architecture
- `registry.ts` currently imports three tools (`unix-time`, `base64`, `protobuf-decoder`) that won't exist yet — porting it unchanged means either stubbing those imports or adjusting the registry array for Phase 1 (planner decides; do NOT alter the decoder/bytes/types files).
</code_context>

<specifics>
## Specific Ideas

- The dark window must match the design's `--win` (#15171c) / `--bg-app` (#0a0b0d) colors (Phase 1 success criterion #1).
- The skeleton's copy button must be the `always`-visible, focusable variant — the design's `hover` copy mode is explicitly forbidden (§9). Use the skeleton to prove the gate catches a hover-only regression.
</specifics>

<deferred>
## Deferred Ideas

- **Windows + Linux build/verify/signing** (V2-02) — deferred; the cross-platform plugin choice (D-01) keeps the door cheap.
- **Real prefs persistence / store** (SHL-05) — Phase 2; Phase 1 ships only a platform-store stub.
- **Registry-driven sidebar + ⌘K palette** (SHL-01..04) — Phase 2.
- **CI (GitHub Actions) for cross-platform build matrix** — deferred with Windows/Linux.

None of the above were scope creep — they surfaced as natural boundaries while scoping the skeleton.
</deferred>

---

*Phase: 01-scaffold-harness-proof*
*Context gathered: 2026-05-30*
