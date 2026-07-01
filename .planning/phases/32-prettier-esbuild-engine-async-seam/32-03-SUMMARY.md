---
phase: 32-prettier-esbuild-engine-async-seam
plan: 03
subsystem: formatter-shell
tags: [formatterview, statusbar, mode-selector, printwidth, retrofit, a11y]
requires:
  - "FormatterView + StatusBar shared shell (Phase 7/8)"
  - "JSON/XML formatter tools + pure src/lib/format transforms (Phase 7)"
provides:
  - "FormatterView unified [ Prettify | Minify ] mode selector (FormatMode) — the shell contract P33 (HTML) + P34 (JS/TS) consume"
  - "Optional printWidth 80/100/120 control (Prettier-tools only, hidden in Minify — D-04/D-06)"
  - "StatusBar role=alert assertive error surface (D-07) + pending Formatting… hint (D-01)"
  - "JSON + XML tools retrofitted to the mode selector (pure transforms unchanged)"
affects:
  - "src/components/FormatterView.tsx (public FormatterControls/FormatterStatus contract changed)"
  - "src/components/StatusBar.tsx (error role now alert across ALL tools)"
tech-stack:
  added: []
  patterns:
    - "Generic SegmentGroup<T> helper backs the mode / indent / printWidth segmented controls"
    - "Mode-derived boolean: tools keep pure formatX(minify: mode === 'minify'), engines stay per-tool (D-05)"
key-files:
  created: []
  modified:
    - src/components/FormatterView.tsx
    - src/components/FormatterView.test.tsx
    - src/components/StatusBar.tsx
    - src/components/StatusBar.test.tsx
    - src/tools/json-formatter/JsonFormatterTool.tsx
    - src/tools/json-formatter/JsonFormatterTool.test.tsx
    - src/tools/xml-formatter/XmlFormatterTool.tsx
    - src/tools/xml-formatter/XmlFormatterTool.test.tsx
    - src/tools/jwt/JwtTool.test.tsx
    - src/tools/protobuf-decoder/ProtobufDecoder.test.tsx
    - src/tools/unix-time/UnixTimeTool.test.tsx
    - test/e2e/json-formatter.e2e.ts
    - test/e2e/xml-formatter.e2e.ts
    - .planning/REQUIREMENTS.md
decisions:
  - "Merged Task 1 (shell) + Task 2 (tool retrofit) into one green-tree feat commit — the FormatterControls contract change transitively breaks JSON/XML compilation, and lefthook runs full tsc+vitest per commit; a shell-only commit could not go green"
  - "role=alert-on-error is a shared StatusBar change → 4 pre-existing JWT/protobuf/unix-time error-state assertions updated (they hard-coded footer[role=status]); correct D-07 behaviour, not a regression"
  - "PRT-11 checkbox left UNCHECKED: the shell + JSON/XML retrofit half is done, but the esbuild-wired Prettier-tool minify half (P33/P34) is not — only the wording is amended"
metrics:
  duration_min: 11
  tasks: 2
  files_changed: 14
  tests: "1317/1317 vitest, tsc clean"
  completed: 2026-07-01
---

# Phase 32 Plan 03: Generalized FormatterView + role=alert StatusBar + JSON/XML Retrofit Summary

Generalized the shared `FormatterView` to a mutually-exclusive `[ Prettify | Minify ]` segmented mode selector with an optional `printWidth` (80/100/120) control that hides in Minify mode (D-03/D-04/D-06), upgraded the shared `StatusBar` error surface to an assertive `role=alert` line:col live region with a calm pending `Formatting…` hint (D-07/D-01), and retrofitted the JSON + XML tools onto the new model with their pure `formatJson`/`formatXml` transforms byte-unchanged — establishing the exact shell contract the P33 HTML and P34 JS/TS tools will consume.

## What Shipped

- **FormatterView (D-03/D-04/D-06):** `export type FormatMode = "prettify" | "minify"`. `FormatterControls` drops the required `minify`/`onMinify` and gains `mode`/`onMode`, optional `printWidth`/`onPrintWidth`; `FormatterStatus` gains optional `pending`. A generic `SegmentGroup<T>` helper renders the mode, indent, and printWidth segmented controls (accent-on-selected, `aria-pressed`, `role=group` + `aria-labelledby`). The indent group is wrapped in `mode === "prettify"`; the printWidth group renders only when `onPrintWidth` is supplied AND `mode === "prettify"` — both hidden in Minify (D-04). The sortKeys toggle is unchanged (visible in both modes).
- **StatusBar (D-07/D-01):** `role={parseState === "error" ? "alert" : "status"}` + matching `aria-live` assertive/polite; a subtle `<span aria-label="formatting">Formatting…</span>` renders in the left cluster when `pending && parseState !== "error"`. Error span still carries line:col + `aria-label` + `data-status="error"`.
- **JSON + XML tools:** `const [mode, setMode] = useState<FormatMode>("prettify")`; `minify = mode === "minify"` fed to the UNCHANGED pure transforms; controls pass `mode/onMode` (JSON keeps sortKeys; neither exposes printWidth, D-06).
- **Tests:** rewrote `FormatterView.test.tsx` + extended `StatusBar.test.tsx` for the new model; updated JSON/XML tool tests (Minify segment, D-04 hide-Indent, role=alert on error); updated JSON/XML e2e to click the Minify/Prettify segments and query the role-agnostic `<footer>`; amended PRT-11 wording.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 + Task 2 merged into one green-tree commit**
- **Found during:** Task 1 (attempting to commit the shell change alone)
- **Issue:** Removing `minify`/`onMinify` from `FormatterControls` transitively breaks `JsonFormatterTool.tsx` + `XmlFormatterTool.tsx` compilation; lefthook runs full `tsc` + `vitest` on every commit, so a shell-only commit is rejected (matches the project's "TDD RED commits blocked by lefthook" learning).
- **Fix:** Landed the FormatterView/StatusBar generalization AND the JSON/XML tool retrofit + all affected unit tests in one `feat(32-03)` commit; e2e + REQUIREMENTS went in a second `test(32-03)` commit.
- **Files modified:** all Task-1 + Task-2 code/unit-test files.
- **Commit:** `053011c6`

**2. [Rule 1 - Bug] Shared StatusBar role change broke 3 unrelated tools' error-state tests**
- **Found during:** Task 1 (first commit attempt — lefthook vitest failed)
- **Issue:** `StatusBar` is shared by every tool. Switching the error role from `status` → `alert` (D-07, correct + intended for ALL tools) broke `JwtTool.test.tsx`, `ProtobufDecoder.test.tsx` (×2), and `UnixTimeTool.test.tsx`, which hard-coded `container.querySelector("footer[role='status']")` in their ERROR-state assertions (returned null → crash).
- **Fix:** Updated those 4 error-context assertions to query the role-agnostic `<footer>` and assert `role === "alert"`. OK/empty-state footer queries in the same files (and in base64/hash/uuid) were left untouched — their role stays `status`.
- **Files modified:** `src/tools/jwt/JwtTool.test.tsx`, `src/tools/protobuf-decoder/ProtobufDecoder.test.tsx`, `src/tools/unix-time/UnixTimeTool.test.tsx`
- **Commit:** `053011c6`
- **Scope note:** directly caused by this task's shared-component change (in scope, not pre-existing).

## Threat Model Coverage

- **T-32-06 (Info Disclosure / XSS in StatusBar error):** mitigated — error text stays escaped React text nodes; `role=alert` changes only announcement politeness, no `dangerouslySetInnerHTML` added.
- **T-32-07 (silent wrong minify result):** mitigated — `git diff --quiet` on `src/lib/format/json.ts`/`xml.ts` + their tests is CLEAN (verified); unit + e2e prove the Minify segment yields the same compact output the old toggle did.

## Verification

- `pnpm exec vitest run` — **1317/1317** pass (full suite, incl. new FormatterView/StatusBar coverage + updated tool tests).
- `pnpm exec tsc --noEmit` — exit 0 (includes `test/e2e`).
- Pure transforms + their tests byte-untouched: `git diff --quiet -- src/lib/format/json.ts src/lib/format/xml.ts src/lib/format/json.test.ts src/lib/format/xml.test.ts` → CLEAN.
- Decoder immovable bar: `git diff --quiet -- src/lib/protobuf/` → CLEAN.
- All plan acceptance greps pass (Prettify segment present; no `onMinify`/`minify:` in FormatterView; both indent + printWidth guarded by `mode === "prettify"`; PRINT_WIDTH 80/100/120; StatusBar role conditional; `mode === "minify"` in both tools; e2e references Minify/Prettify segments and no error-case `role=status`).

### NOT auto-run by the executor (run at the Phase-32 boundary per the binding harness)
`/simplify` → `/code-review xhigh` → `/codex:adversarial-review` → **real-WKWebView** UI verification (`scripts/e2e-spike.sh` for `json-formatter.e2e.ts` + `xml-formatter.e2e.ts`; native-window capture per CLAUDE.md step 5). The mode-selector + role=alert changes are DOM-visible; the updated e2e specs are the load-bearing real-runtime proof. Chunk-split/offline build-artifact proofs land in 32-05.

## Requirement Status

- **PRT-11 (amended by D-05):** FormatterView generalized to the unified mode selector + optional printWidth; JSON/XML retrofitted with unchanged pure behaviour; wording amended in REQUIREMENTS.md. Checkbox left UNCHECKED — the esbuild-wired Prettier-tool Minify half (P33/P34) is still pending.
- **PRT-04 (error-surface half):** parse/format/minify errors now surface as a calm `role=alert` line:col value across all tools. Checkbox left UNCHECKED — the async HTML/JS-TS "never a crash" half lands with P33/P34.

## Self-Check: PASSED
- All 7 spot-checked created/modified files exist on disk.
- Both task commits (`053011c6`, `10c0ac46`) present in git log.
