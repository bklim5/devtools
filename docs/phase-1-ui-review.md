# Phase 1 UI Review — gsd-ui-review WCAG-AA Audit (HRN-01 / HIGH-6)

**Audited:** 2026-05-30
**Subject:** the throwaway "Byte Inspector" walking skeleton (`src/tools/_skeleton/index.tsx`)
**Method:** real-WKWebView drive via the proven `tauri-plugin-webdriver` path
(`bash scripts/e2e-spike.sh`) + a 6-pillar WCAG-AA review of the rendered DOM,
focus order, and computed colour contrast.
**Result:** PASS after one auto-fix (status-bar / label muted text bumped
`text-white/40` → `text-white/60` for AA-normal contrast). This audit was
ACTUALLY RUN before the Phase-1 human sign-off, per CLAUDE.md's phase DoD.

> Scope note: the skeleton is explicitly throwaway (D-05) and is deleted before
> Phase 2. The audit's purpose is to prove the UI gate is real and has teeth on a
> realistic feature shape — and the contrast fix shows the audit produces concrete,
> actioned findings, not a rubber stamp.

---

## The 6 pillars (+ WCAG-AA)

| # | Pillar | Check | Verdict | Evidence |
|---|--------|-------|---------|----------|
| 1 | **Visible focus** | Every interactive control shows a visible focus indicator (not removed) | PASS | `<textarea>` and the copy `<button>` both use `focus:border-accent` (accent #3b82f6 border, ≥3:1 non-text contrast vs #0a0b0d). `focus:outline-none` only removes the default outline because a visible `focus:border-accent` replaces it — focus is never invisible. |
| 2 | **AA text contrast** | Normal text ≥ 4.5:1, large text ≥ 3:1, non-text (focus/borders) ≥ 3:1 | PASS (after fix) | See contrast table below. The only failures were the `text-white/40` muted spans (3.4–3.8:1); fixed to `text-white/60` (6.49:1). |
| 3 | **Keyboard reachability / no-mouse** | All actions reachable & operable by keyboard; no mouse-only affordances | PASS | The input is a native `<textarea>`; the copy control is a real `<button type="button">` in the tab order. The e2e spike asserts the button `isDisplayed()` in the real WKWebView. Paste (Cmd+V) → instant transform needs no pointer. |
| 4 | **No opacity-only disabled / hidden state** | No control hidden or "disabled" via opacity alone | PASS | The copy button is always rendered fully opaque — no `opacity-0`, no `group-hover:opacity-100`. The gate was proven to CATCH a deliberately-injected hover-only regression (see below). |
| 5 | **Always-visible focusable copy** | Copy affordance visible without hover, reachable in ≤1 keystroke | PASS | Real `<button data-testid="skeleton-copy">`; routes through the platform seam (`platform.clipboard.writeText`), never `@tauri-apps/*` directly. Visible at all times; one Tab from the textarea. |
| 6 | **Status-bar legibility** | Status bar (parse state · byte count · timing) is legible at AA | PASS (after fix) | Status row text was `text-white/60` (6.49:1 — already PASS) except the empty-state `○ empty` span at `text-white/40` (3.43:1 — FAIL), now `text-white/60`. `● parsed` uses `text-ok` (#34d399, 8.27:1). |

---

## Computed contrast ratios (sRGB, WCAG 2.x relative-luminance)

Backgrounds: app pane `--bg-app` #0a0b0d; status/titlebar `--win` ≈ #15171c.
Translucent `text-white/N` composited over the background before measuring.

| Foreground | Background | Ratio | AA-normal (4.5) | AA-large (3.0) |
|------------|-----------|-------|-----------------|----------------|
| base text #e7e9ee | #0a0b0d | **16.39:1** | PASS | PASS |
| white/80 | #0a0b0d | **12.59:1** | PASS | PASS |
| white/60 (status, labels) | #15171c | **6.49:1** | PASS | PASS |
| `text-ok` #34d399 (`● parsed`) | #15171c | **8.27:1** | PASS | PASS |
| accent #3b82f6 (focus border) | #0a0b0d | ~3.6:1 | n/a (non-text) | PASS (≥3:1, WCAG 1.4.11) |
| ~~white/40 (muted)~~ on #15171c | — | ~~3.43:1~~ | ~~FAIL~~ | PASS |
| ~~white/40 (muted)~~ on #0a0b0d | — | ~~3.77:1~~ | ~~FAIL~~ | PASS |

---

## Findings & fixes

### FIXED — F1: muted text below AA-normal (contrast)
- **Pillar:** 2 (AA contrast) / 6 (status legibility)
- **Issue:** `text-white/40` muted spans rendered at 3.4–3.8:1 — below the 4.5:1
  AA-normal threshold for normal-size text (they only met AA-large).
- **Where:** header `(skeleton)` label, output `upper:` / `hex:` labels, and the
  empty-state `○ empty` status span (4 occurrences).
- **Fix:** bumped all four to `text-white/60` (6.49:1, AA-normal PASS).
- **Commit:** `3954bb5` — `fix(01-04): bump skeleton text-white/40 to /60 for WCAG-AA contrast`.
- **Re-verified:** 32/32 vitest, `tsc --noEmit` clean, real-WKWebView spike still `1 passing`.

### ACCEPTED — N1: textarea uses `aria-label`, not `id`+`<label>`
- **Pillar:** 3 (keyboard) / WCAG 4.1.2 (Name, Role, Value) & 1.3.1 (Info & Relationships)
- **Observation:** the `<textarea>` carries `aria-label="Bytes to inspect"` and no `id`/visible `<label>`.
- **Disposition:** ACCEPTED. `aria-label` provides a valid programmatic accessible
  name; with no separate visible label, an `id`/`for` pairing is not required to meet AA.
  No change needed.

---

## Gate-has-teeth demonstration (the UI gate catches a real regression)

To prove the UI gate is not a rubber stamp, the copy button was temporarily made
hover-only (`opacity-0 group-hover:opacity-100`) and the same real-WKWebView spike
was re-run:

- **Result:** the e2e run FAILED — exit code 1, `0 passing / 1 failing`, with the
  exact assertion message:
  `copy button is not visible — hover-only copy is forbidden`.
- The regression was then **reverted**; the spike returned to `1 passing` (exit 0).

This confirms pillar 4/5 are enforced by the automation harness, not just by
inspection. (Run logs archived under the gitignored `test/e2e/__logs__/`.)

---

## Real-webview evidence

- **Driver:** `bash scripts/e2e-spike.sh` (starts `tauri dev --features webdriver`,
  waits for the embedded W3C server on `127.0.0.1:4445`, runs WDIO, tears the child
  down via `trap`).
- **Spec:** `test/e2e/skeleton.e2e.ts` — finds `data-testid="skeleton-input"`, sends
  keys (`hello`), asserts the uppercase transform + 5-byte count appear instantly,
  asserts the copy button `isDisplayed()`, then screenshots the real WKWebView.
- **Artifact:** `test/e2e/__screenshots__/skeleton-wkwebview.png` (1960×1360, the
  Retina render of the 980×680 window — gitignored generated artifact).

---

*Phase: 01-scaffold-harness-proof*
*Audit performed: 2026-05-30 (HRN-01 UI half / HIGH-6)*
