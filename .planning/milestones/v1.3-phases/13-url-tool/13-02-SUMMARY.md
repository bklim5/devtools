---
phase: 13-url-tool
plan: 02
subsystem: url
tags: [url, encoding, web, registry, e2e]
requires:
  - "13-01: src/lib/url.ts (parseUrl + encode/decode helpers) + src/components/SegmentedControl.tsx"
provides:
  - "src/tools/url/UrlTool.tsx: the 9th tool view — mode switch + Parse readout/table + Encode/Decode panes"
  - "src/tools/url/index.ts: urlTool ToolDefinition (id 'url'), appended to TOOLS (registry-derived #/tools/url)"
  - "test/e2e/url.e2e.ts: real-WKWebView gate for the URL tool"
affects:
  - "Phases 14/15 reuse the SegmentedControl mode-switch + browser.execute row-read e2e idiom established here"
tech-stack:
  added: []
  patterns:
    - "two-modes-one-view behind a SegmentedControl mode switch (Parse default, no persistence)"
    - "greenfield labeled-readout-rows + key→value table (no table primitive) with per-row/per-value copy"
    - "error-as-value rendering: discriminant switch on ParseResult/StrResult, per-pane role=alert"
    - "e2e reads rendered row text via a single browser.execute round-trip (no stale chained element handles on WebKit)"
key-files:
  created:
    - src/tools/url/UrlTool.tsx
    - src/tools/url/index.ts
    - src/tools/url/UrlTool.test.tsx
    - test/e2e/url.e2e.ts
  modified:
    - src/lib/tools/registry.ts
decisions:
  - "Local CopyButton/Value/OutputPane helpers inside UrlTool.tsx (not new shared components) — D-07/11 copy affordance reused per row, kept tool-local"
  - "Reworded the threat comment to avoid the literal 'dangerouslySetInnerHTML' token so the T-13-04 grep -L/grep -c criterion is unambiguously satisfied"
  - "e2e row assertions read textContent via browser.execute (WebKit parentElement() chained into getText() went stale repeatedly under the embedded WebDriver)"
metrics:
  duration: ~6 min
  completed: 2026-06-03
  tasks: 2
  files: 5
---

# Phase 13 Plan 02: URL tool view + registry + e2e Summary

The 9th registry-driven tool: one `UrlTool.tsx` view with two modes behind a top-level
`SegmentedControl` mode switch (Parse default, no persistence). **Parse** splits an absolute URL
into 8 labeled, individually-copyable readout rows plus a from-scratch decoded query key→value
table; **Encode/Decode** drives a live Encoded + Decoded output pair from one input under a
`component | full` scope toggle with a one-line distinction caption. Every value renders as
escaped React text, every error is a value (relative URL → one inline alert; `%zz` → per-pane
alert with the other pane intact). One additive `TOOLS` append makes the sidebar/palette/router
auto-derive `#/tools/url`. Proven on the real WKWebView (11/11 e2e specs green). Zero new runtime
deps; decoder + its 19 tests byte-for-byte untouched.

## What Was Built

- **`src/tools/url/UrlTool.tsx`** — top-level `SegmentedControl` mode switch `[Parse] [Encode/Decode]`,
  Parse default via `useState<Mode>("parse")`, no persistence (D-01/02/03). All derivations are
  `useMemo` on the input (+ scope), paste-instant.
  - **Parse mode** (`ParseMode`): `useMemo(parseUrl)`; discriminant switch on `ParseResult` —
    `empty` → neutral hint (D-15), `error` → a single `<p role="alert">` (D-13), `url` → the 8
    fixed-order readout rows `[scheme, host, port, path, query, fragment, origin, username,
    password]` each `data-readout-row` with a label, a monospace `Value` (muted `—` when empty,
    D-09) and a per-row `CopyButton aria-label="Copy {label}"` (D-07). Below: a from-scratch query
    table (no primitive exists) — one `data-query-row` per `queryRows` entry in URL order (D-10),
    decoded key → decoded `Value` (`—` when empty, D-12) + a per-value `CopyButton aria-label="Copy
    query value {key}"` (D-11).
  - **Encode/Decode mode** (`EncodeMode`): one textarea; `component|full` `SegmentedControl` scope
    toggle (D-05) selecting the function pair; a mode-aware one-line caption (D-06); two `OutputPane`s
    (`#url-encoded-output` / `#url-decoded-output`) rendering live `StrResult`s — a `{error}` shows
    an inline `role="alert"` in that pane only, leaving the other intact (D-14, the `%zz` case).
  - **Rendering safety (T-13-04 / URL-05):** all values are React text children; no raw-HTML
    injection anywhere (`grep -c` = 0, `grep -L` lists the file).
- **`src/tools/url/index.ts`** — `urlTool` `ToolDefinition` (id `url`, name `URL`, category
  `encoding`, keywords `[url, uri, encode, decode, query, percent]`, `Link` glyph verified present
  in the installed lucide-react, `enabled: true`).
- **`src/lib/tools/registry.ts`** — one import + one `TOOLS` append; sidebar/search/router
  auto-derive `#/tools/url` (registry = single control plane, no other wiring).
- **`src/tools/url/UrlTool.test.tsx`** (TDD) — 9 cases: Parse default, anchor 8-row readout
  (host/port populated), decoded query table (two `tag`, decoded `q="hello world"`, empty `—`),
  relative `/foo?x=1` → one alert + no rows, neutral empty state, copy-through-platform-seam,
  both-direction encode under `component`, the `component→full` slash distinction, and the `%zz`
  per-pane error.
- **`test/e2e/url.e2e.ts`** — the real-WKWebView gate driving `#/tools/url`: anchor parse
  (host `api.example.com`, port `8080`, decoded `q="hello world"`, ≥4 query rows), the relative-URL
  inline alert with no host row, and the `component` (`%2F`) vs `full` (`/`) encode distinction;
  screenshots `url-wkwebview.png`.

## Verification

- `pnpm vitest run src/tools/url` → **9/9**; full suite **550/550** green; `pnpm exec tsc --noEmit`
  clean; `eslint` clean on the new files (also enforced by the lefthook pre-commit hook on both
  task commits — both passed `typecheck` + `test`).
- **Real-WKWebView gate `bash scripts/e2e-spike.sh` → exit 0, 11/11 specs** (the new URL spec +
  all 10 existing specs, no regression); `url-wkwebview.png` written (218 KB).
- `git diff --quiet src/lib/protobuf/decoder.ts` ✓ — decoder byte-for-byte untouched.
- Registry-derived: `#/tools/url` resolves on the real webview; one `TOOLS` append, no router/sidebar edits.
- All acceptance greps pass (`@/lib/url`, `SegmentedControl`, `parseUrl`, `useMemo`, `id: "url"`,
  `Link`, `urlTool`, `role="alert"`, e2e anchors `#/tools/url` / `api.example.com` / `hello world` /
  `/foo?x=1` / `%2F`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] e2e row assertions went stale on the real WebKit WebDriver**
- **Found during:** Task 2 (first e2e gate run — 1 failing).
- **Issue:** WebdriverIO's `parentElement()` chained into `getText()` repeatedly re-fetched and
  went stale against the embedded `tauri-plugin-webdriver` (the `Copy host` button was found, but
  reading its parent's text failed: "Can't call getText on parent element … because it wasn't
  found"). This was an e2e-harness flake, not a tool bug — the component tests prove the rows render.
- **Fix:** Read each row's `textContent` via a single `browser.execute(rowTextByCopyLabel, …)`
  round-trip (find the copy button by aria-label, `.closest("[data-readout-row],[data-query-row]")`,
  return text), and wrapped the encode-output assertions in `browser.waitUntil`. Re-ran the gate →
  **11/11 green**.
- **Files modified:** `test/e2e/url.e2e.ts`
- **Commit:** `a2b27936`

**2. [Rule 1 - Bug] Threat-comment token tripped the T-13-04 acceptance grep**
- **Found during:** Task 1 (post-implementation grep check).
- **Issue:** The rendering-safety comment literally contained the string the acceptance criterion
  asserts ABSENT (`grep -c` returned 1, from the comment), which would read as a false-positive
  threat flag.
- **Fix:** Reworded the comment to "raw-HTML injection is FORBIDDEN" — intent preserved, the literal
  token no longer appears anywhere in the file (`grep -c` = 0, `grep -L` lists the file).
- **Files modified:** `src/tools/url/UrlTool.tsx`
- **Commit:** `5996e71a`

## Threat Surface

All plan threat-register items honored; no new surface introduced:
- **T-13-04 (Tampering/XSS, mitigate):** every readout value, query key/value, and encoded/decoded
  output is a React text child (default escaping); raw-HTML injection is absent (asserted by
  `grep -c`=0 / `grep -L`). A pasted `<script>`/`javascript:` value renders as inert text.
- **T-13-05 (DoS, mitigate):** all parse/decode flows through 13-01's error-as-value helpers; the
  view renders `role="alert"` inline (relative URL + `%zz`) and keeps the rest intact. The e2e
  exercises the relative-URL path on the real WKWebView (it surfaces an alert, never blanks/throws).
- **T-13-06 (Info disclosure, accept):** `password` is displayed plainly and copied only on explicit
  user click via the platform seam; the tool never logs or persists it (D-09, consciously accepted).

No threat flags: pure-frontend, offline, no new endpoints/auth/backend/persistence/code-eval.

## Status: 2 of 3 tasks complete — phase-boundary checkpoint pending

Tasks 1 + 2 (the autonomous tasks) are done and all automated gates are green. **Task 3 is a
blocking `checkpoint:human-verify`** — the phase-boundary sign-off (`pnpm tauri build` + a built-app
walkthrough + a `gsd-ui-review` WCAG-AA audit on the URL tool). That gate requires a human and was
NOT auto-bypassed (this plan is `autonomous: false`). URL-01..05 are implemented and proven on the
real WKWebView; they flip fully validated on the human sign-off.

## Self-Check: PASSED

- Files exist: src/tools/url/UrlTool.tsx ✓, src/tools/url/index.ts ✓, src/tools/url/UrlTool.test.tsx ✓, test/e2e/url.e2e.ts ✓, src/lib/tools/registry.ts (urlTool appended) ✓
- Commits exist: 5996e71a ✓ (feat), a2b27936 ✓ (test/e2e)
- Real-WKWebView gate: 11/11 specs, exit 0 ✓; url-wkwebview.png written ✓
- Decoder untouched: git diff --quiet src/lib/protobuf/decoder.ts ✓
