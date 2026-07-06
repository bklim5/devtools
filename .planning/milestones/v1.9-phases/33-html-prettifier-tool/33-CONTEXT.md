# Phase 33: HTML Prettifier Tool - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A single registry-only, free-tier **HTML tool** wired onto the proven Phase-32 seam:

- **Prettify** → canonical HTML with embedded `<script>` (JS) and `<style>` (CSS) reformatted to full `prettier --write` parity (html + babel + estree + postcss).
- **Minify** → compact valid HTML with minified embedded code (offline HTML minifier + esbuild for embedded blocks).

The **engine layer already exists** from Phase 32 (`formatHtml` + `minifyHtml` in `src/lib/format/{prettier,minify}.ts`). Phase 33 is therefore **tool wiring + registry entry + the large-paste guard** — NOT engine work.

As the **first mounted consumer** of the Prettier/esbuild engines, this phase discharges two carried-forward P32 obligations: the interactive/offline PRT-04 proof, and the SC6 large-paste guard (Codex adversarial review).

**Out of scope (other phases / deferred):** JS/TS tool (Phase 34), any HTML-specific Prettier knobs beyond indent+printWidth, retrofitting the sync JSON/XML tools with the size guard.

</domain>

<decisions>
## Implementation Decisions

### Large-paste guard (PRT-04 / SC6 carry-forward — the core new design work)
- **D-01: Behavior = HARD REJECT + `role=alert`.** When input exceeds the cap, the engine runner is **NEVER called**: the output pane clears, and the StatusBar shows a **calm `role=alert`** line such as `Input too large (2.4 MB) — 2 MB max`. The input textarea stays **editable** so the user can trim it. No spinner, no partial run, no silent fallback. This matches P32's altitude choice (research: off-threading buys nothing for the common case and complicates the single shared lazy chunk). Soft-warn-but-run and worker/interruptible paths were **rejected**.
- **D-02: Cap = 2 MB (UTF-8 bytes).** Measured via the existing `byteLen()` on the raw input. 2 MB comfortably covers real-world pasted HTML (a large page is ~200–500 KB) while keeping the worst-case 4-plugin Prettier-with-embedded-code parse well under the <2s promise. Exact constant (2 MiB `2_097_152` vs 2 MB `2_000_000`) is planner discretion — message it as "2 MB".
- **D-03: Guard lives in the SHARED `useAsyncFormat` hook.** Implemented as an optional `maxInputBytes` param defaulting to a shared constant (2 MB). Oversized input short-circuits to an `ok:false` `FormatResult` **before** the debounce/runner (mirroring the existing empty-input short-circuit), so it never enters the engine path. **Phase 34 (JS/TS) inherits the guard for free** — no re-implementation (roadmap intent). JSON/XML (sync) are **NOT** retrofitted this phase — noted as a deferred idea, not scope creep.
- **D-04: Guard test (SC6 acceptance).** A test proves oversized input **never reaches the runner** — spy/stub the runner and assert **0 calls** for over-cap input, plus the `role=alert` "too large" status surfaces. Under-cap input runs normally.

### Tool identity & registration (PRT-12)
- **D-05: Identity.** `id: "html-formatter"`, `name: "HTML"`, `description: "HTML prettify / minify"`, `keywords: ["html", "format", "prettify", "minify"]`, category `"formatting"`. Mirrors `xml-formatter/index.ts` exactly (naming parity with JSON/XML).
- **D-06: Icon = a code-ish lucide icon DISTINCT from XML's `FileCode`** (e.g. `Code` / `CodeXml` / `FileCode2` — planner picks the clearest available in the installed lucide set). Placed **adjacent to json/xml** in the formatting group in `src/lib/tools/registry.ts` (append + it auto-derives sidebar / ⌘K / HashRouter — registry-only, single control plane).
- **D-07: Free tier, no entitlement gate** (PRT-12). No Pro check anywhere in the tool or registry entry.

### Prettify option surface (PRT-08)
- **D-08: Toolbar = indent (2/4/tab) + printWidth (80/100/120, default 80) + Minify ONLY.** Exactly PRT-08 / the JSON/XML shape. **No** HTML-specific Prettier knobs (`htmlWhitespaceSensitivity`, `bracketSameLine`, `singleAttributePerLine`) are exposed — Prettier's own HTML defaults (`htmlWhitespaceSensitivity: "css"`, etc.) apply implicitly, identical to dev-time `prettier --write`, so golden parity holds by construction. Keeps the wedge sharp.

### Tool wiring (inherited pattern — Claude's discretion on mechanics)
- **D-09:** New `src/tools/html-formatter/` mirrors `xml-formatter/`: a thin `HtmlFormatterTool.tsx` owning state (`input`, `indent` default `"2"`, `printWidth` default `80`, `mode` default `"prettify"`), driving the shared `useAsyncFormat` hook with a runner that dispatches `mode === "minify" ? minifyHtml(input) : formatHtml(input, { indent, printWidth })`, then renders `FormatterView` with `onPrintWidth` supplied (so the Width segment shows) and the async `pending` status wired through. Placeholder: `"Paste HTML to format…"`. `inputId="html-input"`, `outputId="html-output"` (stable e2e selectors).
- **Note:** unlike JSON/XML (sync, no hook), HTML is the **first async-hook consumer** — the `pending` "Formatting…" StatusBar hint (D-01 from P32) is exercised for real here.

### Verification obligations (carried from Phase 32 — mechanics are Claude's discretion)
- **D-10 (SC5, BLOCKING):** A real-WKWebView **offline paste e2e** (Wi-Fi off, DevTools Network tab clean while prettifying AND minifying) MUST pass before this tool can close — the interactive half of PRT-04 that P32 deferred onto its first mounted consumer.
- **D-11 (PRT-04 interactive half):** Prove on a real paste that parse/format/minify errors surface as a calm `role=alert` line:col, never a crash, never a silent fallback — across both a malformed-HTML case and a bad-embedded-`<script>` case.

### Claude's Discretion
- Exact byte constant for the cap (2 MiB vs 2 MB) and the precise "too large" status wording.
- Which specific lucide icon (must be visually distinct from XML's `FileCode`).
- `useAsyncFormat` guard shape (`maxInputBytes` param vs a wrapper) and the exact status-message plumbing.
- Golden-fixture design for the script+style parity test (SC1) and the minify fixture (SC2) — must go RED on Prettier version/option drift.
- Offline-e2e and role=alert e2e mechanics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-32 foundation (the seam this tool consumes — read first)
- `.planning/phases/32-prettier-esbuild-engine-async-seam/32-CONTEXT.md` — the locked async/mode/printWidth/error-surface decisions (D-01..D-07) this tool inherits verbatim.
- `src/lib/format/prettier.ts` — `formatHtml(input, opts)` (html+babel+estree+postcss parity); `PrettierFormatOptions` (adds `printWidth`); error-as-value.
- `src/lib/format/minify.ts` — `minifyHtml(input)` (offline whitespace/comment collapse, `<pre>`/`<textarea>` verbatim, non-JS `<script>` data blocks preserved, embedded JS/CSS via esbuild); error-as-value with HTML-mapped line:col.
- `src/lib/format/types.ts` — `FormatResult` / `FormatOptions` / `IndentMode` / `byteLen()` / `timed()` / `offsetToLineCol()` contract.
- `src/shell/useAsyncFormat.ts` — shared debounce (180ms) + latest-wins reqId + pending hook; **the file to extend with the D-03 size guard** (mirror the existing empty-input short-circuit).
- `src/components/FormatterView.tsx` — the shared shell; already renders the Prettify|Minify mode selector + optional printWidth (shows when `onPrintWidth` supplied) + StatusBar `role=alert`. No change expected; HTML just supplies props.
- `src/components/StatusBar.tsx` — the single error/status surface (already `role=alert` for errors, `pending` hint).

### Pattern to clone
- `src/tools/xml-formatter/` (`XmlFormatterTool.tsx` + `index.ts`) — the thin tool + registry-entry template to mirror (HTML adds `onPrintWidth` and swaps the sync `useMemo(timed(...))` for the async `useAsyncFormat` hook).
- `src/tools/json-formatter/` — same pattern; shows the `.test.tsx` shape.
- `src/lib/tools/registry.ts` — append the new `htmlFormatterTool` to `TOOLS` (single control plane).
- `src/lib/tools/types.ts` — `ToolDefinition` shape.

### Requirements & harness
- `.planning/REQUIREMENTS.md` §PRT-04 (carried interactive+offline half), PRT-07, PRT-08, PRT-12 — this phase's acceptance criteria.
- `.planning/ROADMAP.md` §"Phase 33" — the 6 success criteria (incl. SC6 large-paste guard, SC5 offline e2e).
- `docs/harness-and-decisions.md` — the binding build/verify harness (simplify → code-review → codex → unit → real-WKWebView UI, both channels).
- `CLAUDE.md` / `.planning/PROJECT.md` — the two scoped runtime-dep exceptions (Prettier + esbuild), offline/lazy; "no network at runtime" preserved.

### v1.9 research (from Phase 32, still applicable)
- `.planning/research/STACK.md` — verified plugin matrix (HTML parity = html+babel+estree+postcss), import surface, bundle costs.
- `.planning/research/PITFALLS.md` — "works in dev ≠ code-split in prod"; plugin-subpath interop — relevant to the PRT-02 chunk guard the HTML chunk must respect.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (nearly everything already exists)
- **Engines** `formatHtml` + `minifyHtml` — complete, tested in Phase 32; the HTML tool only calls them.
- **`useAsyncFormat`** — the async hook; extend it with the shared size guard (D-03). HTML is its first real consumer.
- **`FormatterView`** — already renders mode selector + printWidth + pending StatusBar; the tool supplies props, no component change expected.
- **`xml-formatter/`** — the exact thin-tool + registry-entry template to clone.

### Established Patterns
- Tools live in `src/tools/<tool>/`, register **registry-only** (`component: () => import(...)`) → sidebar/⌘K/HashRouter auto-derive. Rollup auto-splits the heavy Prettier/esbuild chunk (PRT-02 guard already in `vite.config.ts`).
- Tools import `src/lib/platform/` seam (clipboard), never `@tauri-apps/*` directly. `FormatterView` already writes copy through the seam.
- JSON/XML are sync (`useMemo(timed(...))`); HTML is the **first async** tool — use `useAsyncFormat`, not `useMemo`.

### Integration Points
- `src/shell/useAsyncFormat.ts` — the one shared file that gains new behavior (size guard), inherited by P34.
- `src/lib/tools/registry.ts` — one-line append.

</code_context>

<specifics>
## Specific Ideas

- Oversize UX (user-approved preview): input stays editable, output empty, StatusBar `role=alert`: `Input too large (2.4 MB) — 2 MB max`.
- HTML is the tool that finally exercises the P32 async pending "Formatting…" hint and the first-format lazy-chunk load on a real paste — the SC5 offline e2e must catch that first load fetching nothing remote.

</specifics>

<deferred>
## Deferred Ideas

- **Retrofit the size guard onto the sync JSON/XML tools** — they can also freeze on multi-MB input, but they are sync/cheap and out of Phase-33 scope. The guard is built in the shared hook (D-03); wiring JSON/XML through it (or a sync analog) is a future cleanup, not this phase.
- **HTML-specific Prettier knobs** (`htmlWhitespaceSensitivity`, `bracketSameLine`, `singleAttributePerLine`) — deliberately not exposed (D-08); could revisit if users ask, as its own small phase.

</deferred>

---

*Phase: 33-html-prettifier-tool*
*Context gathered: 2026-07-01*
