---
phase: 23-appearance-pane
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - index.html
  - src/App.tsx
  - src/components/AccentSwatchGrid.tsx
  - src/components/AccentSwatchGrid.test.tsx
  - src/components/AppearancePreviewStrip.tsx
  - src/components/AppearanceSettings.tsx
  - src/components/AppearanceSettings.test.tsx
  - src/components/LicenseSettings.test.tsx
  - src/components/SettingsModal.tsx
  - src/components/Sidebar.tsx
  - src/components/Sidebar.test.tsx
  - src/components/SidebarResetMenu.tsx
  - src/components/ThemeCardGroup.tsx
  - src/components/ThemeCardGroup.test.tsx
  - src/components/settingsPanes.tsx
  - src/index.css
  - src/lib/entitlements/entitlements.test.ts
  - src/router.test.tsx
  - src/shell/appearance.ts
  - src/shell/appearanceContrast.test.ts
  - src/shell/preferences.ts
  - src/shell/prefsStore.ts
  - src/shell/prefsStore.test.ts
  - src/shell/theme.ts
  - src/shell/theme.test.ts
  - src/shell/useAppearance.ts
  - src/shell/useAppearance.test.ts
  - src/shell/usePreferences.ts
  - src/shell/usePreferences.test.ts
  - test/e2e/appearance.e2e.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-06-16
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Reviewed the Appearance pane feature: theme (light/dark/system) + accent picker behind the `pro.theming` entitlement gate, with live whole-app apply and a flash-free pre-paint script. The architecture is clean and the high-risk areas are well-handled:

- **Pro gate-on-Save is correct.** `AppearanceSettings.onSave` returns BEFORE any setter when `!entitled` (structural — no persist for free users), routing to `openProUpsell`. Verified by `AppearanceSettings.test.tsx`.
- **The no-flash pre-paint script is injection-safe.** `index.html` reads only `localStorage.getItem`, compares against string literals, and writes a hardcoded `"light"` to `dataset.theme`. No user-controlled value is ever interpolated into the DOM/markup — no XSS surface. The `try/catch` correctly fails open (never blocks paint).
- **Paint-hint correctness vs the gated value holds.** `useAppearance` writes the GATED theme name to `td-theme-hint` (`THEME_HINT_KEY` matches the literal in `index.html`), so a lapsed/free relaunch never flashes a stored Pro light theme. Covered by `useAppearance.test.ts`.
- **Accent does not leak to neutral `#N` field numbers.** `AppearancePreviewStrip` renders the `#1` sample with `color: surface.tx` (neutral), accent only on the chip — matching the FieldNode contract. The sidebar drop line uses `bg-tx-2` (neutral), explicitly not `bg-accent`.
- **WCAG-AA is mechanized.** `appearanceContrast.test.ts` enforces ≥4.5:1 for every accent pair in both themes and the full light token ramp.
- **The shared prefs singleton** correctly notifies all subscribed instances so the Appearance pane Save propagates to the App-root `useAppearance` apply.

Two warnings (both maintainability / efficiency, not correctness bugs) and five info items below. No critical issues.

## Warnings

### WR-01: `useAppearance` effects re-run + rewrite the paint-hint on EVERY unrelated prefs change

**File:** `src/shell/useAppearance.ts:45` and `:56`
**Issue:** Both effect dependency arrays list the destructured `preferences.theme` / `preferences.accent` AND the whole `preferences` object: `[preferences.theme, preferences.accent, ents, prefsLoaded, preferences]`. Because the shared prefs singleton replaces the object identity on EVERY write (`setSharedPrefs({ ...sharedPrefs, ...patch })` in `usePreferences.ts:42/128`), the `preferences` dep changes whenever ANY field is written — `lastUsedId` (every route change via `useTrackActiveTool`), `recentToolIds`, `pinnedToolIds`, `toolOrder`, etc. That re-runs `applyAppearance` (a full DOM write) and re-writes `localStorage` on every navigation, not only on a theme/accent change. The granular `preferences.theme`/`preferences.accent` deps are therefore dead (the object dep already covers them). Not a correctness bug — `applyAppearance` is idempotent and the hint value is unchanged — but it is wasted DOM + storage work on the hot path (every tool switch persists last-used) and the redundant deps obscure intent.
**Fix:** Drop the whole-object `preferences` dep and keep only the fields the effect actually reads:
```ts
// first effect
}, [preferences.theme, preferences.accent, ents, prefsLoaded]);
// live-flip effect
}, [preferences.theme, preferences.accent, ents, prefsLoaded]);
```
The body reads `gatePreferences(preferences, ents)`, which only consumes `theme`/`accent` for the appearance result, so the narrower deps are sufficient and the apply stops firing on every navigation.

### WR-02: `AppearanceSettings` pending state goes stale when prefs change while the pane stays mounted

**File:** `src/components/AppearanceSettings.tsx:32-33`
**Issue:** `pendingTheme`/`pendingAccent` are seeded once from `preferences.theme`/`preferences.accent` via `useState(...)`. The seed never re-syncs. Two consequences while the Settings modal is open:
1. If entitlements drop (the live D-85 flip) or another instance Saves, `preferences` updates but the pane keeps showing the old pending values — the cards/swatches read selected against a value no longer applied.
2. The seed reads the RAW persisted `preferences`, not the gated value. A free user who has a previously-persisted Pro accent/theme on disk will see those raw Pro values pre-selected as "pending" even though the live app (and `useAppearance`) is forced to dark + `#5b9bf8`. The pane then advertises a selection that does not match the running app.
Within a single open-pick-Save flow this is harmless (the e2e covers that path), but the pane is long-lived (the modal can stay open across an entitlement flip), so the seed can drift from the source of truth.
**Fix:** Either seed from the gated value, or re-sync when the persisted value changes. Minimal: gate the seed so a free user's pending matches what is actually applied —
```ts
const gated = gatePreferences(preferences, ents);
const [pendingTheme, setPendingTheme] = useState<ThemeName>(gated.theme);
const [pendingAccent, setPendingAccent] = useState<string>(gated.accent);
```
If staleness across a live flip matters, add an effect that resets pending to the (gated) persisted value when `preferences.theme`/`preferences.accent`/`ents` change and no edit is in flight.

## Info

### IN-01: `accentForTheme` accepts a non-scale dark hex but applies it raw under light

**File:** `src/shell/appearance.ts:40-44`
**Issue:** `accentForTheme` returns an unknown (hand-edited/legacy) dark hex UNCHANGED under the light theme (fail-soft, documented as T-23-02). That is the right safety choice, but it means a hand-edited prefs accent that is not in `ACCENT_SCALE` is applied verbatim on a near-white light surface, where it can fail WCAG-AA (the whole reason the dual-value scale exists). The contrast test only covers the seven scale entries. This is only reachable via hand-edited prefs.json (untrusted input), and a Pro user picking from the UI always lands on a scale value, so the exposure is narrow.
**Fix:** Acceptable as-is given the threat model (no UI path produces an off-scale value). Optionally, `coerceAccent` could snap an unrecognized hex back to `DEFAULT_PREFERENCES.accent` rather than preserve it, closing the AA gap for tampered blobs — at the cost of dropping a forward-compat custom value.

### IN-02: `coerceAccent` validates only "non-empty string", not hex/color shape

**File:** `src/shell/prefsStore.ts:71-75`
**Issue:** Unlike the theme coercer (which gates to a known enum), `coerceAccent` accepts ANY non-empty string from untrusted prefs.json. The value is later written to `--color-accent` via `root.style.setProperty` (`theme.ts:27`). `setProperty` is safe (it silently drops an invalid CSS value, and cannot break out into other declarations), so this is not an injection vector — but a junk accent string would yield no accent color rather than the default. Documented as intentional forward-compat ("stored as a free string").
**Fix:** Optional — validate against a hex pattern (`/^#[0-9a-f]{3,8}$/i`) and fall back to the default on a non-match, so a corrupt value degrades to the working blue instead of an empty custom property.

### IN-03: `togglePinned` callback deps include `preferences.pinnedToolIds` but read the module singleton

**File:** `src/shell/usePreferences.ts:148-156`
**Issue:** `togglePinned` closes over `preferences.pinnedToolIds` (which is `sharedPrefs.pinnedToolIds`) and lists it as a dep. Because `sharedPrefs` is a module global re-read on every render, the closure is correct, but the dep is doing double duty (the render already re-reads the global). This is intentional per the inline comment (RESEARCH prefsRef pitfall) and works; noting only that the "reactive" dep on a module-singleton field is a subtle pattern a future reader may misread as local state.
**Fix:** None required — leave the comment. Consider deriving the toggle from the freshest singleton read inside `update` to make the singleton-vs-closure relationship explicit if this is ever refactored.

### IN-04: `AppearancePreviewStrip` color-mix on an off-scale accent is not AA-guaranteed

**File:** `src/components/AppearancePreviewStrip.tsx:41-42`
**Issue:** The preview computes `accentSoft`/`accentLine` via `color-mix` from `accentHex`, which for an off-scale persisted accent is the raw dark hex even under the light surface (see IN-01). The preview is illustrative only (it never persists or applies globally), so an AA miss here is cosmetic and contained. Listed for completeness alongside IN-01.
**Fix:** None required — preview-only, no global impact. Resolving IN-01/IN-02 (snapping off-scale accents) would also fix this.

### IN-05: Pre-paint hint comment references `THEME_HINT_KEY` coupling that has no build-time guard

**File:** `index.html:21` and `src/shell/useAppearance.ts:24`
**Issue:** The literal `"td-theme-hint"` is duplicated in `index.html` (the synchronous pre-paint reader) and `useAppearance.ts` (`THEME_HINT_KEY`, the writer). Both carry strong comments that they MUST stay byte-identical, but nothing fails the build/tests if they drift — `useAppearance.test.ts` asserts against the constant, not the HTML literal, so a divergence would silently reintroduce the wrong-theme flash and only surface in the Manual-Only walkthrough.
**Fix:** Optional hardening — add a test that reads `index.html` and asserts it contains `localStorage.getItem("<THEME_HINT_KEY value>")`, so a drift between the two literals fails CI instead of the human walkthrough.

---

_Reviewed: 2026-06-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
