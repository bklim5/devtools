---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-05-31T12:49:52.182Z"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 18
  completed_plans: 14
  percent: 78
---

# Project State

## Current Position

Phase: 04 (catalogue) — EXECUTING
Plan: 3 of 6

**Phase 3 (Hero + Encoding + UX) COMPLETE — signed off 2026-05-31.** All 4 plans done; both tools (Protobuf hero + Base64/Hex/Bytes) shipped, code-reviewed, verified on the real macOS WKWebView (e2e), WCAG-AA audited, and built (`tauri build` → .app + .dmg, exit 0). PRO-01..07 + ENC-01..03 + UX-01..05 all Complete. Phase-boundary gates: 182/182 vitest (decoder 19 untouched), tsc clean, eslint 0; gsd-ui-review 19/24 with both AA blockers fixed (--tx-3 #868b95, accent #5b9bf8).

**BACKLOG (user feedback at 03 sign-off, 2026-05-31):** add a **decimal-byte-array (JS `Uint8Array`) input mode** to the Protobuf decoder — paste e.g. `10, 3, 80, 81, 82` (comma/space-separated 0–255) and decode as protobuf, alongside hex/base64. New `InputEncoding` variant + parser + a third encoding-toggle segment. Capture for a Phase-3 polish increment or Phase-4 scope discussion. (Not yet planned.)

## Active Plan

**Phase 4 (catalogue) EXECUTING — Wave 1 (04-01 foundation) + Wave 2 `04-02` (Unix Time) ✓ DONE.**

**`04-02` (Unix Time tool, TIME-01) ✓ COMPLETE** — 2 commits (`3e6783d6` UnixTimeTool + TDD, `06445f18` registry swap + e2e gate). Shipped the real two-way Unix Time converter into the registry-driven shell over Plan 01's shared `timeFormat` lib (zero date-math duplication): forward pane pastes an s/ms timestamp → instant LOCAL + UTC + ISO rows each with a visible focusable copy (UX-01/02), `classifyUnit` magnitude auto-detect + an s/ms override toggle (aria-pressed, accent = selected only); reverse ISO/datetime field derives the timestamp back into the forward field (two-way, D-06); live "now" on a 1s interval (cleanup on unmount) with copy. Empty = neutral; malformed = field-scoped `aria-invalid` + `text-bad` error, never a crash (T-04-05). Registry `index.ts` swapped `makePlaceholder` → real `UnixTimeTool` (registry.ts untouched — entry already in TOOLS from 04-01). **Real-WKWebView gate ADDED + GREEN**: `test/e2e/unix-time.e2e.ts` types `1469922850259`, asserts ISO `2016-07-30T23:54:10.259Z` renders on paste + a `Copy ISO 8601` button is displayed; `bash scripts/e2e-spike.sh` → **3 passing on webkit** (base64, protobuf, unix-time). Gate: **214/214 vitest** (decoder 19 untouched, +8 new), tsc clean, eslint 0. **TIME-01 Complete.** Two decisions: (1) empty forward field defaults the active unit to **ms** so the reverse ISO field derives full-precision ms back (s would floor away milliseconds on round-trip); (2) timing (`performance.now`) is measured in the change handler not render — the React Compiler purity lint forbids impure clock reads in the render body, so the forward derive stays render-pure (mirrors Base64's event-scoped `timed()`). No deviations (plan ran as written). SUMMARY: `.planning/phases/04-catalogue/04-02-SUMMARY.md`.

**Next: Wave 2 remaining — `04-03` (JWT, also consumes `timeFormat`), `04-04` (Hash), `04-05` (UUID/ULID), then `04-06` / phase boundary (human sign-off on `tauri build` + gsd-ui-review WCAG-AA).**

---

Prior (Phase 4) Active-Plan history:

**`04-01`** (catalogue foundation scaffold) ✓ COMPLETE — 4 commits (`be31358a`, `3e32b0c3`, `ac0a892d`, `4c8bbe27`). Relocated shared StatusBar to `src/components/`, extracted CopyButton, hand-rolled pure ULID/UUIDv7/timeFormat libs (TDD vs fixed vectors), installed js-md5@0.8.3 offline, registered all four catalogue tools as placeholders (every registry.ts edit concentrated in Wave 1). SUMMARY: `.planning/phases/04-catalogue/04-01-SUMMARY.md`.

---

Prior (Phase 3) Active-Plan history:

**Phase 3 / 03-03** (Base64/Hex/Bytes tool) ✓ CLOSED — 8 commits (`00296c24`, `929fcc39`, then verification-feedback `423898ae`/`63a8935d`/`025b97b5`/`d16f009d`/`6bf732d4`/`e1358476`).

`03-03` (Base64/Hex/Bytes tool) ✓ CLOSED — 8 commits (`00296c24`, `929fcc39`, then verification-feedback `423898ae`/`63a8935d`/`025b97b5`/`d16f009d`/`6bf732d4`/`e1358476`). Shipped the real tool into the Outlet (registry off `makePlaceholder`): three panes over one internal `Uint8Array`, alphabet toggle, per-field errors, status bar, visible focusable copy. **Real-WKWebView human-verify APPROVED by the user (2026-05-31)** after 5 feedback fixes: (1) **`bytes.ts` native `toBase64` now passes `omitPadding` for base64url** — the real webview kept `=` while the btoa fallback stripped it (approved port-unchanged edit; only `decoder.ts`+19 tests are locked; fix proven by a prototype-stub test since Node 22 lacks native `toBase64`); (2) **field parse error now CLEARS the other panes** (user-directed refinement of D-13, not last-good); (3) **"Copied" confirmation** (tick, ~1.2s, per-click re-arm); (4) **`setAlphabet` guard** so toggling during a base64 error keeps the raw input (code-review find); (5) **trimmed the redundant status-bar encoding chip** (reserved for auto-detection; **03-04 should surface detected encoding as an ACCENT CHIP** — recorded in 03-CONTEXT.md `<refinements>`). **Automated real-WKWebView gate ADDED**: `test/e2e/base64.e2e.ts` drives the actual webview (derive · clear-on-error · base64url-no-padding · focusable copy), `wdio.conf` now globs `test/e2e/*.e2e.ts`, stale `skeleton.e2e.ts` removed (D-05). `bash scripts/e2e-spike.sh` → **1 passing on webkit**. Gate: **155/155 vitest** (decoder 19 untouched), tsc clean, eslint 0. **ENC-01/02/03 Complete; UX-01..05 Partial** (Base64 ✓; Protobuf 03-04 must also satisfy). SUMMARY: `.planning/phases/03-hero-protobuf-encoding-ux-constraints/03-03-SUMMARY.md`.

**Standing harness rule (user-directed 2026-05-31):** the real-webview UI gate = build + drive the ACTUAL WKWebView; every verify-gate run writes/updates the per-tool `test/e2e/<tool>.e2e.ts` and RUNS `scripts/e2e-spike.sh`. Chromium/chrome-devtools-mcp screenshots are a preview only. (Memory: verify-gate-builds-real-app.)

---

Prior 03-02 context: **Plan 3 of 4 was 03-03; 03-02 was the prior.** `03-02` (Protobuf logic core) closed — commits `06009dc2` (detectEncoding), `a1cb51d3` (interpretationChips), `863f9b6e` (useDecode + copyAsJson). Built the four pure, node-unit-tested modules under `src/tools/protobuf-decoder/` that map the UI 1:1 onto the REAL decoder shape (mockup keys never referenced): `detectEncoding` (D-02 hex/base64 classifier, import-free, empty→base64); `chipsForField`/`defaultChipId` (chips gated on present `LenInterpretation` keys, locked D-04 precedence message>string>packed-varints>packed-i32>packed-i64>bytes(hex), default=first present; VARINT exposes uint64/int64/sint(zigzag)/bool; i64→double, i32→float defaults); `decodeInput` (wraps bytes-conversion + `decodeMessage` in ONE try/catch so groups/truncation/oversize/bad-bytes surface as an error STRING never a crash — PRO-02, T-03-03; empty=neutral; manual encoding override D-01; timed); `fieldsToJson` (field-numbers-as-keys, selected interpretation per node, nested-message recurse, repeated→array, packed→array of readings; returns a string only, NO `@tauri-apps`/clipboard — T-03-05; clipboard write lands in 03-04 via the platform seam). TDD RED+GREEN landed together (lefthook blocks red, Phase-2 precedent). Gate: **131/131 vitest** (decoder 19 green; +49 in this plan's 5 suites), tsc clean, eslint 0. No deviations — plan executed exactly as written. **PRO-02 Complete; PRO-01/03/04 PARTIAL** (logic done & tested; paste→render + chip-render + chip-selection UI lands in 03-04). SUMMARY: `.planning/phases/03-hero-protobuf-encoding-ux-constraints/03-02-SUMMARY.md`. Real-WKWebView UI verification of these behaviors deferred to 03-04 (this plan ships no UI surface).

---

Prior 03-01 context: **`03-01`** (protobufTreeStyle prefs persistence) closed — commit `e0f5403f`. Extended the Phase-2 prefs seam with one field `protobufTreeStyle: "cards" | "rows"` (default `"cards"`), a `coerceTreeStyle` untrusted-merge coercer wired into `mergePreferences` (only `"rows"` honored; `"banana"`/`42` → `"cards"`, threat T-03-01), and a write-on-change `setTreeStyle` setter on `usePreferences`. TDD RED (4 coercion + 1 round-trip cases) + GREEN impl landed together (lefthook blocks red suites, Phase-2 precedent). Gate: **101/101 vitest** (decoder 19 green), tsc clean, eslint 0. No `@tauri-apps` import added, `Store` seam not widened, no port-unchanged file touched. Deviation (1, Rule 3): `useRecentTools` cold-start fallback now derives from `DEFAULT_PREFERENCES` instead of a hardcoded literal so it can't drift on schema growth. **PRO-06 stays PARTIAL** — only the persistence layer exists; the tree + rows/cards toggle UI lands in 03-04. SUMMARY: `.planning/phases/03-hero-protobuf-encoding-ux-constraints/03-01-SUMMARY.md`. Real-WKWebView verification of the toggle deferred to 03-04 (this plan has no UI surface).

---

Prior Phase 2 context: All Phase 2 plans ✓ COMPLETE. `02-04` (Sidebar + ⌘K CommandPalette + App.tsx shell chrome) closed — commits `3881a13` (Sidebar), `4dba1da` (CommandPalette + atomic recordSwitch fix), `3f15524` (App shell), plus post-checkpoint fix `d4e44f5`. The Phase-2 human-verify checkpoint (Task 4) is **APPROVED (2026-05-30)**: during real-WKWebView sign-off the user found two production-only startup bugs (opened to Unix Time not the protobuf hero; tool switch didn't survive restart). Both fixed in `d4e44f5` — `src/shell/useTrackActiveTool.ts` records last-used on every navigation; memoized+awaited `initPlatform` ends the packaged store split-brain; palette reloads recents on open. After the fix: **vitest 96/96** (decoder 19 green), tsc clean, eslint 0, `vite build` clean; user rebuilt + verified on the real WKWebView → approved. SHL-01/02/03/04/06 now Complete in REQUIREMENTS.md; SHL-05 stays PARTIAL (window geometry → Phase 5, D-11).

## Recent Activity

- Plan 01-01 ✓ scaffold, lib ported (19 tests), fonts, dark window
- Plan 01-02 ✓ HashRouter, env-safe platform seam, throwaway skeleton (32 tests); codex-reviewed + /simplify applied; render bug fixed; real-webview UI verified via chrome-devtools-mcp screenshot (paste→hex, focusable copy, status bar all good)
- Plan 01-03 ✓ lefthook unit gate (proven to block), first tauri build smoke (DMG + .app, adhoc-signed, launch confirmed)
- Plan 01-04 ✓ COMPLETE — Task-3 human-verify checkpoint **reviewed & approved by the user (2026-05-30)**; Phase 1 fully signed off:
  - **D-01 automation path PROVEN**: `bash scripts/e2e-spike.sh` drives the real macOS WKWebView (find→sendKeys→screenshot, 1 passing, exit 0). Screenshot at `test/e2e/__screenshots__/skeleton-wkwebview.png`. This is the per-task UI-gate driver for Phases 2-6 (HRN-02 recorded in docs/phase-0-notes.md).
  - **Gating BUG fixed (T-01-10)**: webdriver was in plain `[dependencies]` (shipped in release). Now an optional dep + double gate `#[cfg(all(debug_assertions, feature = "webdriver"))]`. Verified absent from release: `cargo tree --release | grep webdriver`=0, no webdriver strings in binary, :4445 unbound when release .app runs. (`[target.'cfg(debug_assertions)'.dependencies]` does NOT work — Cargo rejects it.)
  - **Gate has teeth**: hover-only-copy regression → spike FAILS (`copy button is not visible — hover-only copy is forbidden`); reverted → 1 passing.
  - **WCAG-AA audit run** → docs/phase-1-ui-review.md (1 fix: muted text white/40→/60).
  - **Authoritative final build** green (32/32 vitest, tsc clean, tauri build exit 0).
  - SUMMARY written: `.planning/phases/01-scaffold-harness-proof/01-04-SUMMARY.md`.
- **Phase 1 CLOSED** ✓ — checkpoint approved; throwaway walking-skeleton + its registry entry deleted (D-05, commit `ded661d`); ROADMAP marks Phase 1 `[x]`, all FND-01..05 + HRN-01..04 requirements Complete.
- **Phase 2 PLANNED** ✓ — `/gsd-plan-phase 2`: 4 plans in 3 waves; gsd-plan-checker PASSED on first pass (all 11 dimensions); SHL-01..06 covered (SHL-05 PARTIAL — window geometry → Phase 5 per D-11). Commit `ff7de4a`.
- **Plan 02-01 ✓ COMPLETE** (commits `5d7812d`, `e5c18e8`, `ae7fb78`) — foundation unblock:
  - `platform.store` is now REAL: `@tauri-apps/plugin-store` writes `prefs.json` on disk in Tauri; `localStorage` (JSON, `devtools:` ns) in browser; in-memory stub fallback. `get`/`set` interface unchanged; corrupt/non-JSON values degrade to `undefined` (T-02-02). Only `tauri.ts` imports `@tauri-apps/*` (grep-verified).
  - `store:default` capability granted; `tauri_plugin_store` registered unconditionally in `lib.rs` (cargo check green).
  - **3 tools ENABLED** as a shared `makePlaceholder("name")` (Clock/Binary/Boxes lucide icons) — `ENABLED_TOOLS` is now populated; router redirects to the first tool. Port-unchanged files (`registry.ts`/`types.ts`/`decoder.ts`/`bytes.ts`) untouched.
  - Shell `@theme` tokens added (card/bd/bd-2/tx/tx-2/tx-3/input-bg + accent-soft/line via `color-mix`, D-10).
  - Gate: 31/31 vitest (decoder 19 green), tsc clean, eslint 0 errors. SUMMARY: `.planning/phases/02-shell/02-01-SUMMARY.md`. Requirements SHL-04 + SHL-05 marked (SHL-05 still PARTIAL — window geometry → Phase 5).
  - Deviations (3 auto-fixed): `defaults:{}` required by plugin-store@2.4.3 (Rule 3); `router.test.tsx` stale empty-registry assertion updated (Rule 1); store.test.ts jsdom env + brittle redirect assertion (Rule 1). No scope creep.
  - lefthook (correctly) blocks committing a red suite → TDD RED was verified via local `vitest run`, then test+impl landed together in the GREEN commit.
- **Plan 02-02 ✓ COMPLETE** (commit `46f96f9`) — wave 1 done. In-house zero-dependency fuzzy ranker (D-06):
  - `src/shell/fuzzy.ts` exports `rankTools(query, tools)` (subsequence ranker, best-first) + `subsequenceScore(needle, haystack)` (null=no match). Field weighting name>keywords>description; contiguous-run + word-boundary + earlier-position bonuses. Empty/whitespace query passes through (D-05); no-match → `[]` (D-07); case-insensitive; stable tie-break by registry order.
  - Imports ONLY the `ToolDefinition` *type* (grep-verified) — no React, no @tauri-apps, no platform; query scanned char-by-char, never a RegExp (T-02-05). No runtime dep added (no cmdk/fuse.js).
  - `searchTools()` in `registry.ts` left untouched — the palette swaps to `rankTools` in **02-04** (registry.ts is a no-edit file this plan).
  - Gate: **42/42 vitest** (decoder 19 green; +11 new fuzzy tests, ≥6 required), tsc clean, eslint 0 errors. SUMMARY: `.planning/phases/02-shell/02-02-SUMMARY.md`. No deviations (plan ran exactly as written).
  - SHL-02 left **Pending** — the ranker is only the matching engine; the ⌘K palette open/Enter-navigate UI (02-04) completes SHL-02. Marking it complete now would be a false claim (no palette exists yet).
- **Plan 02-03 ✓ COMPLETE** (commits `bd58111`, `bf39a8a`, `263dcc6`) — wave 2 done. Prefs/recents persistence + startup-resolution + router wiring:
  - `src/shell/preferences.ts` (typed `Preferences` schema + `DEFAULT_PREFERENCES`: `theme:"dark"` NAMED value per D-10, `accent:"#3b82f6"`, `lastUsedId:null`, `recentToolIds:[]`; extensible for Phase 3 `protobufTreeStyle`) + `prefsStore.ts` (untrusted-merge load/save over `platform.store` — single `shell.preferences` blob key; `mergePreferences`/`normalizeRecents` accept only known fields/types, drop non-string recents → defaults; threat T-02-08).
  - `usePreferences` (theme/accent/lastUsedId round-trip, write-on-change per Pitfall 5, `prefsLoaded` flag) + `useRecentTools` (`push(id)` most-recent-first, de-duped, capped at 5) — both over the seam, **no @tauri-apps** (grep-verified).
  - `resolveStartupTool(target, lastUsedId)` + `HERO_TOOL_ID="protobuf-decoder"` — single seam, explicit (D-14) > valid last-used (D-13) > hero (D-12); both inputs validated via `getToolById` (ENABLED_TOOLS only) before navigation, so disabled/unknown ids silently fall to hero (T-02-07/V5). `StartupRedirect` (index/catch-all element) + `parseHashTarget` (#/tools/<id> extractor) wire it into `router.tsx`, **replacing the hardcoded `firstTool` redirect**; HashRouter + `ENABLED_TOOLS.map` routes preserved (SHL-04). `main.tsx` warms the store after `initPlatform()`.
  - **Pitfall 3 solved + proven:** `prefsLoaded` defers the redirect until the real last-used is known; a router test seeds `lastUsedId:"base64"` → index redirects to `/tools/base64` while first-run → `/tools/protobuf-decoder` (first-launch ≠ relaunch). A `dirtyRef` guard in both hooks stops the async mount-load from clobbering an early setter/push.
  - Gate: **72/72 vitest** (decoder 19 green; +17 new), tsc clean, eslint 0 errors/0 warnings. SUMMARY: `.planning/phases/02-shell/02-03-SUMMARY.md`. Requirements **SHL-03** (recents DATA layer; palette UI in 02-04) + **SHL-06** (opens-to-last/hero, no picker) marked complete. SHL-05 stays PARTIAL (window geometry → Phase 5, D-11).
  - Deviations (3 auto-fixed): `prefsLoaded` added (Rule 2 — needed to tell first-run-null from still-loading, Pitfall 3); `dirtyRef` guard (Rule 1 — load clobbered early writes, surfaced as test failures); `parseHashTarget` split into its own module (Rule 1/quality — react-refresh only-export-components). No scope creep; no port-unchanged file touched; `Store` not widened.
- **Plan 02-04 ✓ COMPLETE** (commits `3881a13`, `4dba1da`, `3f15524`, + post-checkpoint fix `d4e44f5`) — wave 3 done; the visible shell chrome:
  - `Sidebar.tsx` (registry-driven compact sidebar, accent reserved to active, D-03 pointer+Tab only), `CommandPalette.tsx` (⌘K fuzzy via `rankTools` + recents-first empty state + ↑/↓+Enter no-mouse switch + quiet "No tools match", never auto-opens D-07), `App.tsx` (Sidebar + main/Outlet + single mounted palette + ⌘K hint pill). Single control plane proven end-to-end (sidebar+palette+router all from `ENABLED_TOOLS`).
  - **Phase-2 real-WKWebView human-verify checkpoint (Task 4) APPROVED by the user (2026-05-30).** During sign-off the user found two production-only startup bugs → fixed in `d4e44f5`: (1) opened to Unix Time not the protobuf hero — added `src/shell/useTrackActiveTool.ts` to record last-used on EVERY navigation, not just the palette path; (2) tool switch didn't survive restart (packaged store split-brain) — memoized `initPlatform()` and had `prefsStore` await the one memoized init (single store backend); palette reloads recents on open. After fix: **vitest 96/96** (decoder 19 green), tsc clean, eslint 0, `vite build` clean; user rebuilt + verified on the real WKWebView → approved.
  - Requirements **SHL-01/02/03/04/06** marked Complete in REQUIREMENTS.md (post sign-off). **SHL-05 stays PARTIAL** (window geometry → Phase 5, D-11). SUMMARY: `.planning/phases/02-shell/02-04-SUMMARY.md`. **Phase 2 execution complete.**

## Blocker

- **None.** Phase-3 Wave 1 is complete: 03-01, 03-02, 03-03 all committed, green, and (for 03-03) approved on the real WKWebView with an automated e2e gate. Wave 2 = 03-04 (the Protobuf hero UI), an `autonomous: false` plan that ends the phase with a human sign-off checkpoint covering BOTH Phase-3 tools.

## Next Step (pick up here next session)

**Phase 3 — execute Wave 2 / `03-04` (the Protobuf hero UI).** Wave 1 (03-01 prefs, 03-02 logic core, 03-03 Base64/Hex/Bytes tool) is ✓ COMPLETE. `03-04` renders thin React components over 03-02's pure logic into the shell's `<Outlet/>`: resizable input/output split, recursive cards/rows field tree, `LenInterpretation` chips with smart default + per-node override, VARINT zigzag/signed readings, auto-expanded nested messages, neutral `#N` (accent = selection only), visible focusable copy + copy-all-as-JSON, persisted rows/cards toggle (via 03-01's `protobufTreeStyle`/`setTreeStyle`), and a `ProtobufStatusBar`. It completes PRO-01/03/04/05/06/07 and flips UX-01..05 to Complete, then ends the phase with the human sign-off checkpoint. **Per the standing harness rule, 03-04 must add `test/e2e/protobuf-decoder.e2e.ts` and run `scripts/e2e-spike.sh` as its real-webview gate.**

Reminders:

- **03-04 consumes 03-02's logic core:** `decodeInput(raw, override?)` for paste→decode (error-as-string, neutral empty, manual override), `chipsForField`/`defaultChipId` for chip rendering + smart default, `fieldsToJson(fields, selection)` for copy-as-JSON. The selection model is a Map keyed by node path (`"<index>"` / `"<parentPath>.<index>"`) — reuse it verbatim in the UI. Clipboard write is via the `src/lib/platform/` seam ONLY (copyAsJson deliberately returns a string).

- The 3 tools are `enabled: true` rendering `makePlaceholder` — `ENABLED_TOOLS` is populated. Do NOT touch `decoder.ts`/`bytes.ts`/`types.ts` (and `registry.ts` stays port-unchanged — its "ENABLED_TOOLS is empty" comment is stale but must not be edited).
- 02-04 consumes: shell `@theme` tokens (02-01), `rankTools` from `src/shell/fuzzy.ts` (02-02), `usePreferences` for theme/accent application via CSS variables (02-03), and `useRecentTools` for the palette's empty-query recents group per D-05 (02-03). The router already redirects to last-used/hero via `StartupRedirect`/`resolveStartupTool`.
- `CommandPalette` filters with `rankTools(query, tools)` (caller layers recents/registry order for the empty-query case per D-05). SHL-02 completes in 02-04; SHL-03's palette UI also completes there (its data layer is done).
- Do NOT widen the `Store` seam; prefs go through `usePreferences`/`useRecentTools`, never `platform.store` directly.

## Harness reminder (per-task DoD, in order)

simplify → /codex:review → unit (vitest + tsc) → real-webview UI. Phase boundary: human sign-off on `tauri build` + gsd-ui-review WCAG-AA. Never skip gates; parallelize plans but not past the gates.

## Decisions (Phase 3)

- **03-02:** LEN chip precedence locked as message > string > packed-varints > packed-i32 > packed-i64 > bytes(hex); chips are gated on present `LenInterpretation` keys (never a hard-coded full list), default-selected = first present per precedence (D-04). Chips bind strictly to the real `FieldValue`/`LenInterpretation` keys — the mockup's invented keys are never referenced.
- **03-02:** `decodeInput` wraps BOTH bytes-conversion and `decodeMessage` in one try/catch, so every error (bad bytes, groups, truncation, oversize) becomes a status string and never throws past the boundary (PRO-02, threat T-03-03); empty input is a neutral empty state; a manual encoding override forces hex/base64 (D-01).
- **03-02:** `fieldsToJson` keys by field number, serializes the selected interpretation per node (path-keyed selection Map, fallback to smart default), recurses nested messages, and collects repeated field numbers into arrays; packed-* selections emit an array of readings. Returns a string only — no `@tauri-apps`/clipboard (T-03-05).
- **03-03 (D-13 refined, user-directed):** on a field parse error the OTHER two panes are CLEARED (bytes→empty), not left at last-good — the edited field keeps its raw text + a named error. Unified via a `failParse(field, clearOther, e)` helper; a `setAlphabet` guard preserves the raw base64 when it is mid-error.
- **03-03 (`bytes.ts`, approved port-unchanged edit):** native `Uint8Array.toBase64` now receives `omitPadding: alphabet === "base64url"` so the real webview drops base64url padding like the btoa fallback. Only `decoder.ts`+its 19 tests are locked; this is a user-reported correctness fix, proven by a prototype-stub test (Node 22 has no native `toBase64`).
- **03-03 (status bar):** `StatusBar.encoding` is now OPTIONAL; the Base64 tool omits the redundant chip (the alphabet toggle already shows it). **03-04 must surface the AUTO-DETECTED encoding as an ACCENT CHIP** (the active/selected interpretation per D-08), recorded in `03-CONTEXT.md` `<refinements>`.
- **03-03 (verify-gate, standing rule):** the real-webview UI gate builds + drives the actual WKWebView; each tool gets `test/e2e/<tool>.e2e.ts` run via `scripts/e2e-spike.sh`. Base64's spec passes on webkit; `wdio.conf` globs `test/e2e/*.e2e.ts`; stale `skeleton.e2e.ts` removed.

## Notes

- Repo relocated to top-level root (`.../playground/devtools`); devtools-handoff wrapper dissolved (handoff content consolidated into docs/).
- Recovered .git + .planning from a Time Machine local snapshot after an `rm -rf` incident during the restructure (shell lacks `shopt`/dotglob). No history lost.
- Gate currently green: tsc clean, eslint 0 errors, 31/31 vitest (decoder 19). lefthook pre-commit active (tsc + vitest).
- Deps added in 02-01: `lucide-react@1.17.0`, `@tauri-apps/plugin-store@2.4.3` (JS) + `tauri-plugin-store@2.4.3` (Rust). One out-of-scope eslint warning (pre-existing, `test/e2e/skeleton.e2e.ts:56`) logged in `.planning/phases/02-shell/deferred-items.md`.
