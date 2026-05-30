# DevTools — Project Handoff for Claude Code

You are picking up a cross-platform desktop app project at the **post-design, pre-implementation** stage. The plan is settled, the visual design is settled, the hero-feature logic is written and verified. Your job is to build out the rest.

---

## Mission

Build **DevTools**, a desktop application for engineering utilities (macOS + Windows; Linux as a bonus). Six v1 tools. **Schema-less Protobuf decoding is the hero feature.** Stack is **Tauri 2 + Vite + React + TypeScript** with `react-router` `HashRouter`. Offline by design — no network at runtime, no accounts, no setup.

## Read these, in order, before doing anything else

1. **`docs/design-and-plan.md`** — the full spec. Decisions, milestones, UX constraints, risks. This is the source of truth.
2. **`design/DevTools Mockup.html`** — the canonical visual design (CSS variables, layout, typography). Read the source; do not render.
3. **`design/devtools-ui.jsx`** — React component structure + sample protobuf payload. Prototype code, not production.
4. **`scaffold/README.md`** — what's verified, what to port unchanged, what to rebuild.

After reading: **answer the four blocking questions at the end of this file with the user** before starting Phase 0.

## Scope of v1

Six tools, in this order:

1. **Protobuf Decoder** *(hero)*
2. Base64 / Hex / Bytes
3. Unix Time Converter
4. JWT Debugger
5. Hash Generator
6. UUID / ULID

No other tools in v1. The plan's §2 deferred list exists — **do not pull from it**, no matter how easy a candidate looks.

## Sources of truth

| For | Read |
|---|---|
| Decisions, plan, milestones, success criteria | `docs/design-and-plan.md` |
| Visual design (colors, layout, typography) | `design/DevTools Mockup.html` |
| Component structure, sample data, UI states | `design/devtools-ui.jsx` |
| Decoder behaviour (canonical) | `scaffold/src/lib/protobuf/decoder.ts` |
| Test bar (canonical) | `scaffold/src/lib/protobuf/decoder.test.ts` |
| Registry contract | `scaffold/src/lib/tools/types.ts` |
| UX constraints (binding) | `docs/design-and-plan.md` §9 |

If these conflict, **raise the conflict to the user** before resolving on your own.

## What's verified — port unchanged

These files have been written, executed, and tested. **Port them into the new project's `src/lib/` exactly as-is.** After porting, run vitest. The 19 decoder tests must pass on first run; treat any regression as a bug.

- `scaffold/src/lib/protobuf/decoder.ts` (~295 lines, zero deps)
- `scaffold/src/lib/protobuf/decoder.test.ts` (19 cases)
- `scaffold/src/lib/bytes.ts`
- `scaffold/src/lib/tools/types.ts` (the extended `ToolDefinition`)

What the 19 decoder tests cover, so you know the bar: varint, zigzag, nested message, string LEN, I32 float, I64 double, BigInt at 2^53+1, truncated input, group wire type, field number 0, runaway varint, oversize payload rejection, MAX_DEPTH bounding, packed-varints/fixed32/non-multiple-of-4 handling, 3000-iteration random-byte fuzz, golden composites.

## What's provisional — rebuild against the design

- `scaffold/src/components/Sidebar.tsx`
- `scaffold/src/tools/{protobuf-decoder,base64,unix-time}/index.tsx`
- `scaffold/src/App.tsx`, `main.tsx`, `router.tsx`

These were written with a generic Tailwind palette before the Claude Design files arrived. They exist as **React-structure reference only** — use them to understand how the tool plugin pattern works against the registry, but rebuild the visual layer against `design/`. Match the design's CSS variables, typography (IBM Plex Sans + JetBrains Mono — self-hosted, not from Google Fonts), and component composition.

## Binding constraints — these are not goals, they are constraints

From `docs/design-and-plan.md` §9. Violations should be raised as bugs, not silently accepted:

1. **Paste-transforms-instantly.** Cmd+V in any tool's primary input triggers the transform. No "decode" button for the common case.
2. **Copy-result-instantly.** Every output region has a **visible, focusable** copy affordance. Keyboard path to clipboard ≤ 1 combo. **The design's `hover` copy mode must not ship** — hidden affordances aren't keyboard-reachable.
3. **All viable interpretations surfaced in the Protobuf tree.** LEN field chips must drive directly off `decoder.ts`'s `LenInterpretation` object — i.e., must show `packed-varints` / `packed-i32` / `packed-i64` when valid, alongside `message` / `string` / `bytes`. **The design's `FIELDS` data model under-represents this** by hand-curating only message/string/bytes; do not copy its chip set verbatim. Compute chips from the decoder's output.
4. **Sparing accent.** Strong blue reserved for "currently selected/active" only. Specifically: `#N` field numbers must be **neutral**, not the accent — even though the design currently shows them in accent.
5. **Status bar contents** (every tool): parse state · byte count · current encoding · errors · timing.
6. **Resizable panes** on tools with input/output split. Critical for Protobuf.
7. **No network at runtime.** Self-host fonts; no CDN dependencies. The design HTML loads Google Fonts — fix this when porting.
8. **`BrowserRouter` is forbidden.** Use `HashRouter` only. Tauri serves static files; non-hash routes 404 on reload.

## Defaults to ship

Lifted from the design's `TWEAK_DEFAULTS`, with the constraints above applied:

- `tree: rows` *(but see open question 4)*
- `copyMode: always` *(NOT `hover`)*
- `density: comfortable`
- `sidebar: compact` (icon + name; descriptions in palette and search)
- `palette: bound to ⌘K, not visible on load`
- `premium: false` — no Pro UI visible in v1

**`design/tweaks-panel.jsx` is a Claude Design dev tool — do not include it in the production build.**

## Mobile (iOS / Android) — future, but two disciplines now

No mobile UI in v1. Tauri 2 supports iOS/Android from one codebase, so keeping the door open cheaply requires two disciplines from commit one:

- **Tool components are layout-agnostic.** Tools render content; all layout chrome (sidebar/drawer/etc.) lives in the shell. No fixed widths in tool UIs.
- **Responsive Tailwind everywhere.** Use `sm:`/`md:`/`lg:` utilities.

If you find yourself hard-coding a width inside a tool component, stop and lift it to the shell.

## Phase 0 — your first session

1. Confirm template choice with the user (verify against current `create-tauri-app` options at the time you run it; the Tauri ecosystem moves).
2. Initialize the project at this directory's root (`devtools-handoff/` becomes the project root; rename to `devtools/` if you prefer).
3. Set up Tailwind, `react-router` (`HashRouter`), vitest.
4. Copy `scaffold/src/lib/` → `src/lib/` unchanged. Run vitest. **Confirm 19 tests pass.** Treat a regression as a blocker.
5. **Distribution spike**: produce an unsigned test build on macOS *and* Windows. Surface code-signing surprises early. Document findings in `docs/phase-0-notes.md`.
6. Render a blank dark window matching `design/DevTools Mockup.html`'s `--win` / `--bg-app` colors.

**Exit criteria for Phase 0:** blank window renders on both target OSes from one repo, lib tests green on both, distribution spike documented.

After Phase 0, work the milestones in `docs/design-and-plan.md` §11 in order: Shell → Hero + #2 → Catalogue → Native polish → Distribution. Do not interleave.

## Do not do

- Do not add tools beyond the six in §2 — not even "easy" ones.
- Do not refactor `decoder.ts` or its tests without explicit user approval. The 19-test bar is the hero feature's spec.
- Do not include `tweaks-panel.jsx` in the production build.
- Do not load fonts from Google Fonts at runtime.
- Do not implement anything gated behind the `premium: true` flag in v1 — the field is a reserved architectural seam, not a feature.
- Do not use `BrowserRouter`.
- Do not silently resolve plan-vs-design conflicts. Ask.

## Blocking questions — get answers before Phase 0

From `docs/design-and-plan.md` §14:

1. **Linux** — explicit v1 packaging target, or best-effort?
2. **Accessibility floor** — WCAG AA across the board, a documented subset, or "fix in flight"?
3. **Self-hosted fonts** — confirm bundling IBM Plex Sans + JetBrains Mono locally, and that the licences allow desktop redistribution.
4. **Default tree style** — `rows` (design default, denser) or `cards` (used in current screenshots, richer chrome)?

The remaining §14 questions (action-palette day-one scope, stable-vs-experimental status assignment) can be deferred until Phase 2–3.

## Target repo layout

```
devtools/                              ← this directory, renamed
├── CLAUDE.md
├── README.md
├── docs/
│   ├── design-and-plan.md
│   └── phase-0-notes.md               ← you will create this
├── design/                            ← reference only, do not modify
│   ├── DevTools Mockup.html
│   ├── devtools-ui.jsx
│   └── tweaks-panel.jsx
├── src-tauri/                         ← you create in Phase 0
└── src/
    ├── main.tsx, App.tsx, router.tsx
    ├── components/
    ├── lib/                           ← ported from scaffold/src/lib/, unchanged
    │   ├── bytes.ts
    │   ├── protobuf/{decoder.ts, decoder.test.ts}
    │   └── tools/{types.ts, registry.ts}
    └── tools/
        ├── protobuf-decoder/
        ├── base64/
        ├── unix-time/
        ├── jwt/
        ├── hash/
        └── uuid/
```

You may delete `scaffold/` from the repo root once `src/lib/` has been populated and tests are green.

---

If something in this brief is unclear, ask the user before guessing. The cost of clarifying is a few minutes; the cost of building the wrong thing is days.
