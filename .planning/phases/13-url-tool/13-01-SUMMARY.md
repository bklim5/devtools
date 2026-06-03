---
phase: 13-url-tool
plan: 01
subsystem: url
tags: [url, encoding, web, segmented-control]
requires: []
provides:
  - "src/lib/url.ts: parseUrl + encodeComponent/decodeComponent/encodeFull/decodeFull (error-as-value)"
  - "src/components/SegmentedControl.tsx: shared accent-on-active aria-pressed toggle (D-16)"
affects:
  - "13-02 (URL tool view) imports these exports directly"
tech-stack:
  added: []
  patterns:
    - "error-as-value discriminated results (StrResult / ParseResult) so the view needs no try/catch"
    - "queryRows via direct URLSearchParams iteration (order + multiplicity + decode)"
    - "generic SegmentedControl<T extends string> over the lifted FormatterView toggle idiom"
key-files:
  created:
    - src/lib/url.ts
    - src/lib/url.test.ts
    - src/components/SegmentedControl.tsx
    - src/components/SegmentedControl.test.tsx
  modified: []
decisions:
  - "FormatterView left unmigrated (D-16 discretionary) — avoids risking the Formatter gates"
  - "scheme displayed without trailing ':' (protocol.replace(/:$/,'')) per D-08 discretion"
metrics:
  duration: ~6 min
  completed: 2026-06-03
  tasks: 3
  files: 4
---

# Phase 13 Plan 01: URL logic foundation + shared SegmentedControl Summary

Pure, fully-tested URL parse/encode/decode core (`src/lib/url.ts`) over native `URL`/`URLSearchParams`/`encodeURI(Component)` — every helper error-as-value, never throwing to the caller — plus the extracted shared `SegmentedControl` (D-16) that 13-02's mode switch and `component|full` scope toggle consume directly. Zero new runtime deps; decoder + its 19 tests byte-for-byte untouched.

## What Was Built

- **`src/lib/url.ts`** (5 exports + 2 interfaces): `encodeComponent`/`decodeComponent` (over `encodeURIComponent`/`decodeURIComponent`), `encodeFull`/`decodeFull` (over `encodeURI`/`decodeURI`, structure-preserving), and `parseUrl`. The four encode/decode helpers return `StrResult = {value} | {error}`; `parseUrl` returns `ParseResult = {url} | {error} | {empty:true}`. Bad percent-sequences (`%zz`) and lone surrogates are caught and returned as `{error}` (D-14); empty input is neutral (`{value:""}` / `{empty:true}`, D-15); a relative/scheme-less URL returns the absolute-URL guidance error (D-13).
- **`parseUrl`** maps all 8 fields (scheme via `protocol` minus trailing `:`, host=`hostname`, port, path=`pathname`, query=`search`, fragment=`hash`, origin, username, password — D-08/09) and builds `queryRows` by iterating `searchParams` directly so `?tag=a&tag=b` yields two ordered `tag` rows with decoded values and `""` preserved for empties (D-10/11/12).
- **`src/components/SegmentedControl.tsx`**: generic `SegmentedControl<T extends string>` — one `aria-pressed` `<button type="button">` per option inside a labeled `role="group"`, accent-on-active (`toggleClasses` lifted verbatim from `FormatterView`), focus-visible ring (WCAG-AA, D-03).

## Verification

- `pnpm vitest run src/lib/url.test.ts src/components/SegmentedControl.test.tsx` → 19 passed.
- `pnpm exec tsc --noEmit` clean; `eslint` clean on all four files (also enforced by the pre-commit lefthook hook on every commit).
- Full suite **541/541** green.
- `git diff --quiet src/lib/protobuf/decoder.ts` ✓ — decoder untouched (last touched Phase 1; this phase never touches it).
- Per-task harness honored: simplify (kept code minimal/DRY) → unit (vitest+tsc+eslint) green. No UI gate this plan (pure logic + a component-test-covered control); the real-WKWebView gate lands in 13-02.

## Deviations from Plan

None — plan executed exactly as written. The one discretionary call (D-16): FormatterView's existing toggle usages were **not** migrated to the new shared component. The plan explicitly gates migration on "only if the Formatter tests stay green — otherwise leave FormatterView untouched"; since FormatterView's `Toggle` is a single standalone bordered button and its indent group uses `aria-labelledby` (not the shared component's `aria-label`), migrating would alter their a11y wiring and risk the Formatter gates for no functional gain. Shipped the new shared component only, as the plan permits.

## Threat Surface

All threat-register items honored, no new surface introduced:
- **T-13-01 (DoS):** every native call (`new URL`, `decodeURI`, `decodeURIComponent`, `encodeURI`) is wrapped in try/catch → error-as-value. Covered by the `%zz`, lone-surrogate, and relative-URL test cases — a thrown `URIError` can never crash the tool.
- **T-13-02 (password disclosure, accepted):** `parseUrl` returns `password` as a plain string only — no `console.log`, no `platform.store` write anywhere in the module.
- **T-13-03 (tampering, downstream):** `url.ts` returns plain strings, no HTML — the view (13-02) renders via React text nodes.

## Notes for 13-02

- Import directly: `parseUrl`, `encodeComponent`, `decodeComponent`, `encodeFull`, `decodeFull`, types `StrResult`/`ParseResult`/`ParsedUrl`/`QueryRow` from `@/lib/url`; `SegmentedControl` from `@/components/SegmentedControl`.
- `SegmentedControl` props: `{ options, value, onChange, ariaLabel }` — drive both the `[Parse] [Encode/Decode]` mode switch (D-01) and the `component | full` scope toggle (D-05).
- Derive all outputs in a `useMemo` on the input (+ scope); switch on the `ParseResult` discriminant (`"url"`/`"error"`/`"empty"`) and the `StrResult` discriminant for the live encoded/decoded panes.

## Self-Check: PASSED

- Files exist: src/lib/url.ts ✓, src/lib/url.test.ts ✓, src/components/SegmentedControl.tsx ✓, src/components/SegmentedControl.test.tsx ✓
- Commits exist: 42e9b3bc ✓, ea573e03 ✓, 809ae7f1 ✓
