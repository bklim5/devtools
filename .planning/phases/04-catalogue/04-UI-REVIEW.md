# Phase 4 — UI Review

**Audited:** 2026-05-31
**Baseline:** Abstract 6-pillar standards + the project locked design system (`design/DevTools Mockup.html` tokens, REQUIREMENTS UX-01..05, 04-CONTEXT D-11..D-19) + the Phase-3 AA-token decisions already applied to `@theme` (`--color-tx-3 #868b95`, `--color-accent #5b9bf8`).
**Verification surface:** Code audit (Tailwind token audit, string audit, state-coverage audit, computed WCAG contrast on the `@theme` token pairs in `src/index.css`) **plus** the real-WKWebView e2e gate (`bash scripts/e2e-spike.sh` → 6/6 passing on webkit, including the load-bearing hash SHA-256 secure-context check and the uuid-ulid `crypto.randomUUID`/`getRandomValues` check) **plus** a fresh `tauri build` (.app + .dmg, exit 0). Screenshot artifacts written under `test/e2e/__screenshots__/` per tool.
**Scope:** The four NEW catalogue tools — `src/tools/unix-time/UnixTimeTool.tsx`, `src/tools/jwt/JwtTool.tsx`, `src/tools/hash/HashTool.tsx`, `src/tools/uuid-ulid/UuidUlidTool.tsx` — plus the cross-cutting UX constraints. Shell chrome + the two Phase-3 tools were audited in `03-UI-REVIEW.md` and are referenced only where a token decision carries over.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Specific, instructive labels throughout ("Copy all generated ids", named encoding/claim errors, scoped placeholders); neutral empty states; no generic Submit/OK/Cancel in any of the four tools. |
| 2. Visuals | 4/4 | Clear per-row hierarchy (label → mono value → visible copy); every icon-only control has an `aria-label`; toggles use `role="group"` + `aria-pressed`; advisory JWT flags read as badges, not noise. |
| 3. Color | 4/4 | "Accent = selection only" held in all four tools (toggles, Generate). All colors are `@theme` tokens — zero hardcoded hex/rgb in the tool source. |
| 4. Typography | 4/4 | Two weights (`font-medium`/`font-semibold`) + the shared mono/sans split; the four tools reuse the established 11/12/13px label/value steps, no new sizes introduced. |
| 5. Spacing | 4/4 | Standard scale only (`gap-2/3/4/6`, `p-3/4`, `py-0.5/1/2`); fully layout-agnostic — no fixed pane/component widths (UX-05 held; `w-16` count input is an intrinsic field width, allowed). |
| 6. Experience Design | 4/4 | Paste-instant (no convert button), `aria-invalid` + `text-bad` errors (never opacity-only), neutral empty states, visible focusable copy everywhere, `focus-visible:ring-2 ring-accent` on every interactive element, and — the binding phase gate — every `@theme` token used clears WCAG-AA. |

**Overall: 24/24 — PASS (WCAG-AA across all four tools).**

---

## WCAG-AA Verdict: PASS

The Phase-3 audit raised `--color-tx-3` to `#868b95` and `--color-accent` to `#5b9bf8`; the four Phase-4 tools were built on top of those AA-corrected tokens and introduce **no new color values**. Every text/background pair the four tools render clears the 4.5:1 normal-text floor:

| Token | Used in (Phase-4 tools) | on `--card` | on `--input-bg` | Verdict |
|-------|-------------------------|-------------|-----------------|---------|
| `--tx` #e7e9ee | all mono values | 14.20 | 15.79 | Pass (AAA) |
| `--tx-2` #989da7 | all section/row labels | 6.34 | 7.05 | Pass (AA) |
| `--tx-3` #868b95 | JWT "display-only, signature not verified" note only | 5.04 | 5.61 | Pass (AA) |
| `--accent` #5b9bf8 | selected toggle segment + Generate text | 6.15 | — | Pass (AA) |
| `--accent` on `accent-soft` over surface | selected-toggle text on its tint | **4.88** (over card) | 5.57 (over input-bg) | Pass (AA) — Phase-3 Priority Fix 2 now resolved by the lighter accent |
| `--bad` #f0876b | all field-scoped errors + JWT expired/nbf badges | 6.88 | 7.66 | Pass (AA) |

(Computed from `src/index.css` `@theme`; `accent-soft` = `color-mix(in srgb, accent 15%, transparent)` resolved over the listed surface.)

**No blockers found, so no AA fixes were required for this phase.** The accent-on-accent-soft selected-chip contrast that was a *verify-on-webview* flag in Phase 3 now measures 4.88:1 (over card) / 5.57:1 (over input-bg) with the `#5b9bf8` accent — it clears AA on its own, and selection additionally carries the non-color `border-accent-line` cue, so the selected state never depends on accent text contrast alone.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- No generic CTA labels (`Submit`/`OK`/`Cancel`/`Save`) in any of the four tools.
- CTAs and copy affordances are specific: `Generate`, `Copy all` / `Copy all generated ids`, per-row `Copy {label}` (Local / UTC / ISO 8601 / MD5 / SHA-256 / Header / Payload / Signature / Type / Version / …). Every `CopyButton` carries a descriptive `label`/`aria-label`.
- Empty states are neutral and instructive, not error-toned: each tool maps empty input to the StatusBar `"Empty"` state; placeholders teach the format (`1469922850259`, `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…`, `Paste text, hex, or base64…`, `Paste a UUID or ULID…`).
- Errors are named and field-scoped, never silent: Unix Time ("Enter an integer unix timestamp" / "Invalid date string"), JWT (scope-prefixed `token:`/`header:`/`payload:` message), Hash (the bytes-parse message for the chosen encoding), UUID/ULID (the `decodeId` message). The JWT tool additionally carries the "display-only, signature not verified" honesty note (D-09).

### Pillar 2: Visuals (4/4)
- Consistent per-row hierarchy: an uppercase `text-tx-2` label over a `font-mono text-tx` value, with the visible copy affordance right-aligned. Mirrors the Phase-3 tools, so the catalogue reads as one product.
- Every icon-only control is labelled (the shared `CopyButton` renders an `aria-label`); the segmented toggles are `role="group"` with `aria-label` + per-button `aria-pressed`; the JWT expired/not-yet-valid flags use `role="status"`.
- Advisory signals read clearly without overwhelming: JWT claim flags are small bordered `text-bad` badges; the Hash digests stack all five at once (D-12) so the comparison is at-a-glance.

### Pillar 3: Color (4/4)
- **"Accent = selection only" verified in all four tools.** `text-accent` / `bg-accent-soft` / `border-accent-line` appear only on: the active segment of the s/ms, input-encoding, hex-casing and ID-kind toggles; the default-focused Generate button; and the copy-confirmed state. No accented body text, no accent on neutral values.
- **Zero hardcoded colors in the tool source** — every color is a `@theme` token (`text-tx`/`text-tx-2`/`text-tx-3`/`text-accent`/`text-bad`, `bg-input-bg`, `border-bd`/`border-bd-2`/`border-accent-line`). No `#hex` / `rgb()` / `rgba()` literals in the four `.tsx` files.

### Pillar 4: Typography (4/4)
- Weights limited to `font-medium` + `font-semibold`; mono vs sans handled via the shared `--font-mono`/`--font-sans` tokens (mono for all id/digest/timestamp values, sans for labels).
- The four tools reuse the established label/value steps (11px uppercase labels, 12px secondary, 13px mono values) — no new arbitrary font sizes were introduced beyond the ramp the Phase-3 audit flagged, so the sprawl did not grow.

### Pillar 5: Spacing (4/4)
- Standard scale only across all four tools (`gap-2/3/4/6`, `p-3/4`, `px-2/3`, `py-0.5/1/2`, `mt`/`min-h-[Npx]` for textarea sizing). No fixed component or pane widths — each tool is `flex min-w-0 flex-1 flex-col` and grows with the shell (UX-05 held). The `w-16` UUID count `<input>` is an intrinsic numeric-field width, not a layout width.

### Pillar 6: Experience Design (4/4)
- **Instant transform (UX-01):** no decode/convert/generate-required button for the common case — Unix Time, JWT, Hash and the UUID/ULID *decode* field all transform on `onChange`; the UUID/ULID *generate* side produces one id on open via a lazy initializer and regenerates in ≤1 keystroke (default-focused Generate). Timing surfaced in the StatusBar (`timingMs`) where measured.
- **Error states:** every tool renders a single field-scoped `aria-invalid` + `aria-describedby` + `text-bad` node with `aria-live="polite"`; the StatusBar shows `role="status" aria-live="polite"` with the error. No tool can crash on adversarial input (the pure decode boundaries — `decodeJwt`, `parseInput`, `decodeId`, `formatTimestamp`/`toUnixFromIso` in try/catch — never throw past the UI).
- **Empty states:** neutral `"Empty"` for all four; no error tone on first render.
- **Copy feedback:** the shared `CopyButton`/`useCopyFeedback` gives a momentary confirmation; UUID/ULID "Copy all" shows "Copied all". **No hover-only copy** — every copy is a visible, focusable `<button>` reachable in ≤1 keystroke (the e2e specs assert `isDisplayed()` on the copy affordance per tool).
- **Disabled-by-opacity not used** — no `disabled:opacity` / `opacity-40/50` / `opacity-0 group-hover` in any tool.
- **Focus visibility (UX-04):** `focus-visible:ring-2 focus-visible:ring-accent` on every interactive element (toggles, textareas, the count input, Generate, Copy-all); text inputs also add `focus-visible:border-accent-line`.
- **WCAG-AA (the binding phase gate):** PASS — see the verdict table above. The four tools were also each driven on the real macOS WKWebView (`scripts/e2e-spike.sh`, 6/6), so the contrast + focus + copy behaviors are confirmed in the production webview, not just jsdom.

---

## Files Audited

**Phase-4 tools (in scope):**
- `src/tools/unix-time/UnixTimeTool.tsx`
- `src/tools/jwt/JwtTool.tsx`
- `src/tools/hash/HashTool.tsx`
- `src/tools/uuid-ulid/UuidUlidTool.tsx`

**Design system (referenced for tokens / contrast):**
- `src/index.css` (`@theme` tokens — contrast source of truth; carries the Phase-3 AA fixes `--tx-3 #868b95`, `--accent #5b9bf8`)
- `src/components/CopyButton.tsx`, `src/components/StatusBar.tsx` (shared affordances)

**Real-webview gate (run, not scored):** `test/e2e/{unix-time,jwt,hash,uuid-ulid}.e2e.ts` via `bash scripts/e2e-spike.sh` → 6 passed, 6 total on webkit.

**Context (read, not scored):** 04-CONTEXT.md, 04-VALIDATION.md, 04-02..05 SUMMARY.md, 03-UI-REVIEW.md (token-decision precedent).

---

## Result

**PASS — 24/24, WCAG-AA across all four catalogue tools. No blockers, no fixes required.** The four Phase-4 tools inherit the Phase-3 AA-corrected tokens and add no new color values; full unit suite (269/269, decoder 19 untouched), `tsc` clean, `eslint` 0, the four real-WKWebView e2e specs (6/6 on webkit), and a fresh `tauri build` (.app + .dmg, exit 0) all hold. Awaiting the human sign-off (04-06 Task 2) on the packaged bundle to close Phase 4.
