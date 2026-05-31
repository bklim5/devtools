---
phase: 04-catalogue
plan: 03
subsystem: tools
tags: [jwt, jose, base64url, json, timeformat, react, typescript, display-only]

# Dependency graph
requires:
  - phase: 04-catalogue
    plan: 01
    provides: shared CopyButton + StatusBar (src/components/), shared timeFormat lib, registry placeholder for jwt
  - phase: 03-hero-protobuf-encoding-ux-constraints
    provides: bytes.ts base64url + bytesToUtf8 (port-unchanged), platform clipboard seam, e2e harness (scripts/e2e-spike.sh)
provides:
  - "Pure decodeJwt(token) — split→base64url→JSON with a token/header/payload field-scoped error taxonomy, never throws (src/tools/jwt/decodeJwt.ts)"
  - "JwtTool UI — Header/Payload pretty JSON + raw Signature + alg + humanized flagged exp/iat/nbf claims (src/tools/jwt/JwtTool.tsx)"
  - "jwtTool registry entry now renders the real JwtTool (component swapped off makePlaceholder)"
  - "test/e2e/jwt.e2e.ts — real-WKWebView gate for #/tools/jwt"
affects: [04-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union result object ({empty|error(scope)|ok}) for a pure, never-throwing decode boundary (T-04-07)"
    - "Display-only crypto-adjacent tool: decode + advisory flags, NO verification / NO key surface (D-09)"
    - "Live clock in useState + 1s setInterval (not Date.now in render) to satisfy the React Compiler purity lint while keeping advisory flags live"

key-files:
  created:
    - src/tools/jwt/decodeJwt.ts
    - src/tools/jwt/decodeJwt.test.ts
    - src/tools/jwt/JwtTool.tsx
    - src/tools/jwt/JwtTool.test.tsx
    - test/e2e/jwt.e2e.ts
  modified:
    - src/tools/jwt/index.ts

key-decisions:
  - "decodeJwt is a discriminated union (empty | error(scope) | ok) — empty input is a neutral state, not an error; every base64url-decode and JSON.parse is wrapped so the function never throws past its boundary (T-04-07)"
  - "exp/iat/nbf are treated as unix SECONDS (×1000) per RFC 7519 NumericDate; expired/not-yet-valid flags are explicitly advisory (text-bad badge), NOT cryptographic — no verification surface exists (D-09/T-04-09)"
  - "'now' lives in useState + a 1s interval rather than a render-body Date.now() — the React Compiler purity lint forbids the impure clock read in render (same fix UnixTimeTool used)"

patterns-established:
  - "Tool fixtures (both unit suites) are built by base64url-encoding known JSON via the same bytes.ts primitive the impl consumes — honest round-trip, no hand-rolled base64 in tests either"

requirements-completed: [JWT-01]

# Metrics
duration: 4min
completed: 2026-05-31
---

# Phase 4 Plan 03: JWT Debugger Summary

**Shipped the display-only JWT tool (JWT-01) into the registry-driven shell: a pure `decodeJwt` that splits→base64url-decodes (via `bytes.ts`, no hand-rolled base64)→JSON-parses the header+payload with a token/header/payload field-scoped error taxonomy that never throws, plus a thin `JwtTool` UI rendering pretty-printed Header/Payload + the raw Signature + `alg`, with `exp`/`iat`/`nbf` humanized through the shared `timeFormat` lib and expired/not-yet-valid tokens visibly flagged — no signature verification, no key input (D-09).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-31T12:51:28Z
- **Completed:** 2026-05-31T12:55:46Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- **`decodeJwt` pure module (D-07/D-08/D-09):** discriminated union `{ empty } | { error; scope } | { ok; header; payload; signature; alg? }`. Splits on `.`, base64url-decodes header+payload via `bytes.ts` `base64ToBytes(...,"base64url")` + `bytesToUtf8`, `JSON.parse`s each; signature shown RAW; `alg` lifted from the header when a string. Field-scoped errors: not-3-segments → `token`; non-base64url → that segment's scope; non-JSON → that segment's scope. NEVER throws past the boundary (T-04-07), proven against adversarial inputs (`...`, `a.b.c.d.e`, NULs, `%%%`, 1000 dots).
- **`JwtTool` UI (JWT-01, UX-01..05, D-10):** paste-instant decode (no button) → three labelled blocks (Header / Payload pretty JSON, Signature raw) each with a visible focusable `CopyButton`, plus the surfaced `alg` and a "display-only, signature not verified" note. `exp`/`iat`/`nbf` numbers humanized via `formatTimestamp(ms).iso` (absolute) + `relativeTime(ms)` (relative); `exp` in the past → `expired` badge, `nbf` in the future → `not yet valid` badge (both `text-bad`, never opacity-only). Empty = neutral; malformed = single field-scoped `aria-invalid` + `text-bad` node + StatusBar "Error", never a crash.
- **Registry swap:** `src/tools/jwt/index.ts` `component: makePlaceholder("JWT")` → `component: JwtTool` (import added, `makePlaceholder` import removed); `registry.ts` untouched (entry already in TOOLS from 04-01), keeping this plan conflict-free with the other Wave-2 tool plans.
- **Real-WKWebView gate ADDED + GREEN:** `test/e2e/jwt.e2e.ts` navigates to `#/tools/jwt`, pastes a standard HS256 token, asserts the decoded payload (`John Doe` / `1234567890`) renders on paste and that `Copy Payload` is displayed (hover-only-copy gate), screenshots `jwt-wkwebview.png`. `bash scripts/e2e-spike.sh` → **4 passing on webkit** (base64, jwt, protobuf, unix-time), exit 0.
- **Gate:** full suite **229/229 vitest** (decoder 19 untouched, +15 new: 7 decodeJwt + 8 JwtTool), `tsc --noEmit` exit 0, `eslint` 0 errors.

## Task Commits

1. **Task 1: decodeJwt pure module + error taxonomy** - `0c8ed1ed` (feat, TDD test+impl together)
2. **Task 2: JwtTool UI + humanized flagged claims + registry swap + e2e** - `0ad69e05` (feat)

_TDD note: lefthook blocks committing a red suite (Phase-1/2/3 precedent), so each TDD task's test + impl land together in one GREEN commit; RED was verified locally via `vitest run` before the impl was finalized._

## Files Created/Modified
- `src/tools/jwt/decodeJwt.ts` (+`.test.ts`) - Pure split→base64url→JSON decode + token/header/payload error taxonomy, never throws (T-04-07); 7 cases incl. adversarial
- `src/tools/jwt/JwtTool.tsx` (+`.test.tsx`) - JWT decoder UI: pretty Header/Payload + raw Signature + alg + humanized flagged claims, focusable copy per block; 8 jsdom cases
- `src/tools/jwt/index.ts` - Registry entry `component` swapped `makePlaceholder("JWT")` → `JwtTool`
- `test/e2e/jwt.e2e.ts` - Real-WKWebView gate for `#/tools/jwt`

## Decisions Made
- **decodeJwt as a never-throwing discriminated union.** Empty input is a neutral `{kind:"empty"}` (not an error); every base64url-decode and JSON.parse is wrapped so adversarial tokens become bounded field-scoped errors, never a crash (T-04-07). This mirrors the Protobuf `decodeInput` error-as-data boundary.
- **exp/iat/nbf as unix SECONDS, flags advisory.** Per RFC 7519 NumericDate, claims are seconds → ×1000 before `formatTimestamp`. The expired/not-yet-valid badges are explicitly advisory (`text-bad`), NOT a cryptographic assertion — the tool has no verification surface at all (D-09/T-04-09), and the UI carries a "signature not verified" note so it never implies authenticity.
- **Live 'now' in state, not Date.now() in render.** The React Compiler purity lint rejects the impure clock read in the render body; `nowMs` lives in `useState` refreshed by a 1s `setInterval` (cleanup on unmount), keeping the advisory flags live AND render pure — the identical resolution UnixTimeTool used in 04-02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Date.now()` in render body violated the React Compiler purity lint**
- **Found during:** Task 2 (JwtTool, the `npm run lint` gate)
- **Issue:** The plan's `<action>` says compute the expired/not-yet-valid flags from `Date.now()` at render; eslint's `react-hooks/purity` rule (React Compiler) errors on the impure clock read in the render body (`Cannot call impure function during render`).
- **Fix:** Moved "now" into `useState(() => Date.now())` refreshed by a 1s `setInterval` (cleanup on unmount) — flags stay live, render body is pure. This is the exact pattern STATE.md records UnixTimeTool (04-02) adopting for the same lint.
- **Files modified:** src/tools/jwt/JwtTool.tsx
- **Verification:** `npm run lint` 0 errors; the expired/not-yet-valid jsdom cases still pass.
- **Committed in:** 0ad69e05 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — lint/purity, necessary for the lint gate)
**Impact on plan:** No scope change; the behavior the plan specified (live advisory flags) is preserved, just sourced from state instead of a render-time clock read. No port-unchanged file touched.

## Out-of-scope discoveries
- **`base64.e2e.ts` shows an intermittent `element/.../click` flake** on `scripts/e2e-spike.sh` (one of three runs failed at a base64 pane click during webview navigation; re-runs passed 4/4). This is in a PRE-EXISTING spec unrelated to this plan's changes; the JWT spec passed cleanly in every run. Not fixed here (scope boundary); noted for the phase-boundary sign-off (04-06) in case it recurs.

## Known Stubs
None. `decodeJwt` and `JwtTool` are fully implemented and wired to real data; `{kind:"empty"}` is an intentional neutral state, not a stub. The registry placeholder this plan replaced is now the real `JwtTool`.

## Threat Flags
None. The plan's `<threat_model>` covers the only trust boundary (pasted token → decoder); this plan introduces no new network endpoint, auth path, file access, or schema surface. T-04-07 (DoS) and T-04-08 (info disclosure) are mitigated as planned (never-throws + display-only/no-network/no-logging); T-04-09 (spoofing) is accepted with the "signature not verified" note and no verification surface.

## Issues Encountered
None beyond the deviation above (resolved inline) and the out-of-scope base64 e2e flake (not this plan's code).

## User Setup Required
None — no external service or configuration. The tool is fully offline (no network, no key input).

## Next Phase Readiness
- **JWT-01 Complete.** Wave 2 remaining: `04-04` (Hash), `04-05` (UUID/ULID), then `04-06` / phase boundary (human sign-off on `tauri build` + gsd-ui-review WCAG-AA).
- Each remaining tool plan swaps only its own `index.ts` component (registry.ts stays untouched) and adds its own `test/e2e/<tool>.e2e.ts` run via `scripts/e2e-spike.sh` (standing harness rule).
- **Standing reminder:** the JWT real-WKWebView gate confirmed `bytes.ts` base64url decode + `Intl`/`Date` humanization work on the actual WKWebView (RESEARCH A1/A2 assumptions hold for this tool).

---
*Phase: 04-catalogue*
*Completed: 2026-05-31*

## Self-Check: PASSED

All 6 created/modified source files + the SUMMARY exist on disk; both task commits (0c8ed1ed, 0ad69e05) are present in git history.
