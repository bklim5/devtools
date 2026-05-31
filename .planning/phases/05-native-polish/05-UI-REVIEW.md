# Phase 5 — UI Review

**Audited:** 2026-05-31
**Baseline:** Abstract 6-pillar standards + the project locked design system (`design/DevTools Mockup.html` tokens, REQUIREMENTS UX-01..05) + the Phase-3/4 AA-token decisions already applied to `@theme` (`--color-tx-3 #868b95`, `--color-accent #5b9bf8`). No new visual language introduced (CLAUDE.md constraint).
**Verification surface:** Code audit (Tailwind token audit, `@theme` contrast computation in `src/index.css`, new-UI-surface diff audit) **plus** the real-WKWebView e2e gate (`bash scripts/e2e-spike.sh` → **7/7 passing on webkit**, incl. the load-bearing hash SHA-256 / uuid-ulid `crypto.randomUUID` secure-context checks AND the new `summon.e2e.ts` non-blank-launch + HashRouter deep-link proof) **plus** a fresh `tauri build` (.app + .dmg, exit 0) launch-smoke-tested.
**Scope:** Phase 5 (native polish) is **Rust plugins + a JS platform-seam extension + startup wiring** — it adds **NO new UI surface inside the WKWebView**. There is no new `.tsx` tool/component and no `.css`/`@theme` change in this phase (git log of `src/**/*.tsx` + `src/**/*.css` since the Phase-5 work began returns nothing). The native chrome it adds (tray icon + menu, global summon, single-instance focus, window-geometry restore) lives **outside** the webview DOM in the macOS menu bar / window manager, so it is verified by the human packaged-build sign-off (05-04 Task 2 / VALIDATION Manual-Only), not by the in-webview WCAG audit. Accordingly this audit **re-confirms the six existing tools still clear WCAG-AA in the freshly-built packaged bundle** — the same audit surface as Phases 3 (two tools) and 4 (four tools), now re-run on the Phase-5 build.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Unchanged from Phase 4 — specific, instructive labels; neutral empty states; no generic Submit/OK/Cancel. Phase 5 adds no in-webview copy (tray menu strings "Show DevTools"/"Quit" live in `lib.rs`, are clear/specific, and are not a WCAG-text surface). |
| 2. Visuals | 4/4 | No webview visual change. The packaged window opens `visible: false` and is summoned via chord/tray — verified non-blank-on-launch by `summon.e2e.ts` (Pitfall 6 / no restore-flash) so geometry restore does not regress the visual first paint. |
| 3. Color | 4/4 | "Accent = selection only" still holds across all six tools; `@theme` tokens byte-for-byte the Phase-3/4 AA values; zero new color values introduced in Phase 5. |
| 4. Typography | 4/4 | No new font sizes/weights — Phase 5 touched no `.tsx`/`.css`. The established mono/sans split + 11/12/13px ramp is unchanged. |
| 5. Spacing | 4/4 | No layout change; tools remain layout-agnostic (`flex min-w-0 flex-1`), and the native window chrome is shell/OS-level, not a fixed component width (UX-05 held). |
| 6. Experience Design | 4/4 | Paste-instant + visible focusable copy + `aria-invalid`/`text-bad` errors all unchanged and re-confirmed on the packaged WKWebView (7/7 e2e). Every `@theme` token used clears WCAG-AA (table below). |

**Overall: 24/24 — PASS (WCAG-AA across all six tools, re-confirmed on the Phase-5 packaged build).**

---

## WCAG-AA Verdict: PASS

Phase 5 introduces **no new color values** — it changed no `.tsx`/`.css` file. Every text/background pair the six tools render continues to clear the 4.5:1 normal-text floor on the Phase-3/4 AA-corrected tokens (`--tx-3 #868b95`, `--accent #5b9bf8`):

| Token | Used in | on `--card` | on `--input-bg` | Verdict |
|-------|---------|-------------|-----------------|---------|
| `--tx` #e7e9ee | all mono values | 14.20 | 15.79 | Pass (AAA) |
| `--tx-2` #989da7 | all section/row labels | 6.34 | 7.05 | Pass (AA) |
| `--tx-3` #868b95 | JWT "display-only, signature not verified" note only | 5.04 | 5.61 | Pass (AA) |
| `--accent` #5b9bf8 | selected toggle segment + Generate text | 6.15 | — | Pass (AA) |
| `--accent` on `accent-soft` over surface | selected-toggle text on its tint | 4.88 (over card) | 5.57 (over input-bg) | Pass (AA) |
| `--bad` #f0876b | all field-scoped errors + JWT expired/nbf badges | 6.88 | 7.66 | Pass (AA) |

(Computed from `src/index.css` `@theme`; `accent-soft` = `color-mix(in srgb, accent 15%, transparent)` resolved over the listed surface. Identical to the Phase-4 table because the tokens are unchanged.)

**No blockers found; no AA fixes were required for this phase** (none were possible to require — Phase 5 added no rendered color/text surface inside the webview).

---

## Native-Chrome Note (outside the WCAG webview surface)

Phase 5's native additions are **not** in the WKWebView DOM and are therefore **not** WCAG-AA-auditable in-code; they are batched into the human packaged-build sign-off (05-04 Task 2):

- **Tray icon + menu** (NAT-02): reuses `default_window_icon()`; menu strings "Show DevTools" / "Quit" are specific and instructive (no generic labels). Tray presence/contrast is a macOS-menu-bar concern, system-rendered.
- **Global summon** (NAT-01): `CommandOrControl+Shift+D` — no visual surface; the summoned window paints the existing AA-passing tool UI.
- **Single-instance focus** (NAT-02) + **window-geometry restore** (SHL-05 / D-11): window-manager state; the `visible: false` → summon path is proven non-blank by `summon.e2e.ts` so there is no blank-window flash regressing the visual first paint (Pitfall 6 / A5).

---

## Files Audited

**Phase-5 surface (in scope):**
- `src-tauri/src/lib.rs` (tray menu strings — not a WCAG-text surface; reviewed for label clarity)
- `src/lib/platform/{index,tauri,browser}.ts`, `src/shell/summon.ts` (seam + wiring — **no rendered UI**, no color/text)

**Design system (referenced for tokens / contrast — unchanged from Phase 3/4):**
- `src/index.css` (`@theme` tokens — contrast source of truth; `--tx-3 #868b95`, `--accent #5b9bf8`)

**Re-confirmed tool surface (unchanged code, re-run on the Phase-5 build):**
- `src/tools/{protobuf-decoder,base64,unix-time,jwt,hash,uuid-ulid}/*.tsx` + `src/components/{CopyButton,StatusBar}.tsx`

**Real-webview gate (run, not scored):** `test/e2e/*.e2e.ts` via `bash scripts/e2e-spike.sh` → **7 passed, 7 total on webkit** (incl. `summon.e2e.ts`).

**Context (read, not scored):** 05-VALIDATION.md, 05-01/02/03 SUMMARY.md, 04-UI-REVIEW.md (format + token-decision precedent).

---

## Result

**PASS — 24/24, WCAG-AA across all six tools, re-confirmed on the Phase-5 packaged build. No blockers, no fixes required.** Phase 5 adds no in-webview UI surface and no new color values; the six tools inherit the Phase-3/4 AA-corrected tokens. Full unit suite **277/277** (decoder 19 untouched), `tsc` clean, `eslint` 0, **7/7 real-WKWebView e2e on webkit**, and a fresh `tauri build` (.app + .dmg, exit 0, launch-smoke-tested, zero webdriver strings in the release binary) all hold. The native OS-level behaviors (global summon, tray, single-instance, geometry restore) are outside the WCAG webview surface and await the human packaged-build sign-off (05-04 Task 2), batched with the deferred Phase-4 UAT.
