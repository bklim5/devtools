# Quick Task 260714-dla — Summary

**Task:** Move Protobuf Decoder to the top of the tool list and make it the default-selected tool on first launch.
**Commit:** 365a2820
**Date:** 2026-07-14

## What changed

- `src/lib/tools/registry.ts` — `protobufDecoderTool` moved to `TOOLS[0]`. The registry is the single control plane, so the sidebar, command palette, and router default order all follow.
- **No production change was needed for the first-launch default** — `resolveStartupTool` already falls back to `HERO_TOOL_ID = "protobuf-decoder"` when no target/default/last-used exists. Fresh installs already opened on the hero.
- `src/lib/tools/registry.test.ts` (new) — hero-first invariant lock: protobuf leads `TOOLS`/`ENABLED_TOOLS`; no drop/duplicate on reorder (`>= 13` floor, not exact count — the set is wedge-gated but growing).
- `src/shell/resolveStartupTool.test.ts` — tripwire asserting `HERO_TOOL_ID === ENABLED_TOOLS[0].id` (the hero is a deliberate product constant; this catches a reorder that forgets it, or vice versa).
- `src/components/CommandPalette.test.tsx` — ArrowDown nav test now derives the expected second row from `ENABLED_TOOLS[1]` instead of hardcoding the old order.
- `test/e2e/sidebar.e2e.ts` + `test/e2e/helpers.ts` — real-WKWebView locks: fresh install (prefs blob wiped via new `resetPrefsBlob()`) → sidebar leads with Protobuf Decoder AND bare `#/` redirects to it; existing user → after using Base64, persisted `lastUsedId` (read via new `readPrefsBlob()`) restores Base64 through the actual `StartupRedirect`/`resolveStartupTool` path (bare-index navigation, not a same-route refresh — Codex finding), while the sidebar still leads with Protobuf Decoder. A/B-proven load-bearing (test REDs when last-used is forced elsewhere).

## Behavior notes

- **Existing users:** startup tool unchanged (`lastUsedId` precedence). Their sidebar/palette *default order* does change to protobuf-first on update — intended (free users and never-reordered Pro users follow the registry default; Pro pin/reorder overlays are untouched).
- The registry head is the *default* order only — Pro users can still pin/reorder above the hero.

## Verification (per-task harness)

| Gate | Result |
|---|---|
| simplify | 0 cleanups beyond review fixes (diff minimal) |
| /code-review xhigh (9 angles → verify) | 12 candidates → 5 confirmed test-design issues fixed (redundant duplicate tests consolidated, hardcoded count → floor, overclaiming comment scoped); 0 production bugs |
| vitest + tsc | 1434/1434 green, tsc clean (decoder's 19 tests untouched) |
| Real-WKWebView e2e | sidebar block 6/6 green incl. both new tests; screenshots confirm protobuf visually first. Full suite 22/5 spec files — the 5 failures are the pre-existing license-state-pollution/updater-network class (identical before/after, unrelated) |
| Codex adversarial | 1 medium finding (e2e bypassed startup redirect) — fixed + A/B-proven |

## Known pre-existing issues surfaced (not addressed here)

- 5 e2e spec files fail independent of this change (license drop-notice pollution chain + updater network check) — matches the known `license-walkthrough-state-pollutes-e2e` class.
