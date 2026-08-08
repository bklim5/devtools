---
phase: 18-entitlements-seam-central-gate
reviewed: 2026-06-10T21:55:29Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - docs/licensing-research.md
  - scripts/check-dev-strip.sh
  - src/components/CommandPalette.locked.test.tsx
  - src/components/CommandPalette.prod.test.tsx
  - src/components/CommandPalette.test.tsx
  - src/components/CommandPalette.tsx
  - src/components/Sidebar.locked.test.tsx
  - src/components/Sidebar.test.tsx
  - src/components/Sidebar.tsx
  - src/components/ToolRoute.test.tsx
  - src/components/ToolRoute.tsx
  - src/components/UpsellPanel.test.tsx
  - src/components/UpsellPanel.tsx
  - src/lib/entitlements/entitlements.test.ts
  - src/lib/entitlements/entitlements.ts
  - src/lib/entitlements/resolve.test.ts
  - src/lib/entitlements/resolve.ts
  - src/lib/entitlements/store.ts
  - src/lib/tools/types.ts
  - src/main.tsx
  - src/router.tsx
  - src/shell/fuzzy.test.ts
  - src/shell/preferences.ts
  - src/shell/prefsStore.test.ts
  - src/shell/prefsStore.ts
  - src/shell/useEntitlements.ts
  - src/tools/base64/index.ts
  - src/tools/cron/index.ts
  - src/tools/hash/index.ts
  - src/tools/json-formatter/index.ts
  - src/tools/jwt/index.ts
  - src/tools/protobuf-decoder/index.ts
  - src/tools/regex/index.ts
  - src/tools/unix-time/index.ts
  - src/tools/url/index.ts
  - src/tools/uuid-ulid/index.ts
  - src/tools/xml-formatter/index.ts
  - test/e2e/entitlements.e2e.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-06-10T21:55:29Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 18's entitlements seam is well-built: one vocabulary (`entitlements.ts`), one resolution point (`resolve.ts`), one snapshot store consumed exclusively via `useEntitlements()`, and all three surfaces (sidebar, palette, ToolRoute gate) route lock decisions through `isToolLocked`. The downgrade-only D-31 override is enforced at two independent layers (coercer accepts only `"free"`; resolver only ever downgrades from the environment base), and tests prove both. The lazy-registry conversion (`component: () => import(...)` on all 11 tools) plus the module-cached `lazy()` in ToolRoute correctly establishes the future free-build code-split seam without touching `decoder.ts`. Test coverage is thorough, including the macOS Option+P composed-key shape and the prod-simulated tree-shake proof.

No critical issues. Two warnings: a defense-in-depth gap where `unpinAll` can write prefs without an entitlement check (relying solely on render-time hiding for D-26 preservation), and a vacuous-pass hole in `check-dev-strip.sh` when `dist/assets` contains no `.js` files. Three info items on seam consistency and minor error handling.

## Warnings

### WR-01: `unpinAll` is not gated on `orderingUnlocked` — D-26 prefs preservation relies solely on render-time hiding

**File:** `src/components/Sidebar.tsx:495-499`
**Issue:** `resetOrder` (line 480) explicitly checks `orderingUnlocked` and opens the upsell before any setter — the comment at `togglePin` (line 209) calls this pattern "structural" prefs preservation (T-18-12). But `unpinAll` calls `setPinnedToolIds([])` with no entitlement check at all. It is currently unreachable while locked only because the "Unpin all" menu item renders behind `pinned.length > 0` (line 802) and the locked partition forces `pinned` to `[]`. That is a rendering-condition guard, not a write-path guard: any future caller of `unpinAll` (or a change to the menu-item condition) would silently clear the user's stored pinned set while locked — exactly the data loss D-26 forbids. Every other locked customization path (`togglePin`, `onDragStart`, `onRowKeyDown` Alt-chords, `resetOrder`) guards at the write site.
**Fix:**
```tsx
const unpinAll = useCallback(() => {
  if (!orderingUnlocked) {
    openOrderingUpsell();
    closeResetMenu({ restoreFocus: true });
    return;
  }
  setPinnedToolIds([]); // clears the whole pinned set (PIN-09)
  announce("All tools unpinned");
  closeResetMenu({ restoreFocus: true });
}, [orderingUnlocked, openOrderingUpsell, setPinnedToolIds, announce, closeResetMenu]);
```

### WR-02: `check-dev-strip.sh` passes vacuously when `dist/assets` contains zero `.js` files

**File:** `scripts/check-dev-strip.sh:13-21`
**Issue:** The script explicitly guards against vacuous passes (the `dist/assets` existence check at lines 8-11 exists for exactly this reason), but a second hole of the same class remains: if the directory exists but contains no `*.js` files (e.g., a partially failed build, or Vite ever switching to `.mjs` chunk extensions), `grep -R --include='*.js'` scans nothing, exits 1 ("not found"), and the script prints `OK: dev toggle absent from dist/assets` without having checked any bundle. This script is reused at the Phase 21 flip gate, where a false "OK" would matter.
**Fix:** Verify at least one `.js` artifact exists before grepping:
```bash
if ! find dist/assets -name '*.js' -print -quit | grep -q .; then
  echo "FAIL: no .js bundles found under dist/assets/ — nothing was checked" >&2
  exit 1
fi
```

## Info

### IN-01: `gatePreferences` has no production consumer — the Sidebar inlines its own ordering gate

**File:** `src/lib/entitlements/entitlements.ts:36-44`, `src/components/Sidebar.tsx:68-74`
**Issue:** `gatePreferences` is documented as "the prefs-APPLY seam" (D-26/D-27) and is fully tested, but no production code calls it. The Sidebar expresses the same ordering policy independently (`ents.has(ENT_ORDERING) ? prefs.pinnedToolIds : []`), and the `ENT_THEMING` arm (forcing default theme/accent) is applied nowhere — no UI currently reads `preferences.accent` into `--accent`, so the theming gate is dormant alongside the not-yet-built theming UI. Two expressions of the ordering policy can drift: a future change to `gatePreferences`' ordering arm would not affect the Sidebar. The module header claims "Every surface ... consumes ONLY these predicates — no scattered checks."
**Fix:** Either have the Sidebar derive its gated view through `gatePreferences(preferences, ents)` (taking `toolOrder`/`pinnedToolIds` from the result), or note in `gatePreferences`' doc comment that the Sidebar intentionally inlines the ordering arm and the function's first real consumer is the future theming apply path.

### IN-02: `isTauriEnv` duplicates the platform seam's private `isTauri()` detection

**File:** `src/lib/entitlements/resolve.ts:10-12`, `src/lib/platform/index.ts:67-69`
**Issue:** The exact same `"__TAURI_INTERNALS__" in window` check exists in both files. The resolve.ts comment acknowledges it "mirrors" the platform seam, but mirroring is a divergence risk: if the detection ever changes (e.g., a Tauri version renames the marker), the gate and the capability seam could disagree about the environment — precisely what the comment says must never happen.
**Fix:** Export `isTauri` from `src/lib/platform/index.ts` and re-export/consume it in `resolve.ts`, making the single-detection guarantee structural instead of by-convention.

### IN-03: Dev-toggle command's rejection is unhandled (`void row.run()`)

**File:** `src/components/CommandPalette.tsx:196`, `:65-74`
**Issue:** `selectRow` fires commands with `void row.run()`. The dev toggle's `run` awaits `savePreferences` (which can reject if `store.set` fails — unlike `loadPreferences`, it has no catch) and `refreshEntitlements`. A rejection becomes an unhandled promise rejection with no user-visible or console feedback, leaving the toggle silently un-applied. DEV-only impact (the command is tree-shaken from production), so severity is low.
**Fix:** `void row.run()?.catch?.(...)` is awkward for the union type — simplest is `void Promise.resolve(row.run()).catch((err) => console.error("[palette] command failed:", err));`, matching the `main.tsx` pattern.

---

_Reviewed: 2026-06-10T21:55:29Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
