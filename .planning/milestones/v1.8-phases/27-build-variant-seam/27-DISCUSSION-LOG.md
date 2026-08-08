# Phase 27: The Build-Variant Seam (3 layers) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 27-build-variant-seam
**Areas discussed:** Canonical build command, Compile-out mechanism, Verify-script scope, Frontend channel constant

---

## Canonical appstore build command

| Option | Description | Selected |
|--------|-------------|----------|
| Full launch-ready (promote spike) | One command: build universal → embed profile → deep re-sign → verify; signed sandbox-launchable .app in one step | ✓ |
| Bundle only, sign separately | pnpm emits the bundle; dev-signing + profile embed stays a separate documented step | |

**User's choice:** Full launch-ready (promote `build-appstore-spike.sh` into the committed canonical command).
**Notes:** Directly satisfies Criterion 2's "launches on the SIGNED .app" gate in one step.

---

## Compile-out mechanism (updater + autostart)

| Option | Description | Selected |
|--------|-------------|----------|
| One umbrella 'direct-only' default feature, both out now | Updater + autostart behind a default-enabled feature dropped via `--no-default-features --features appstore`; cargo tree clean for both in Phase 27 | ✓ |
| Updater out now, autostart in Phase 29 | Only updater gated here; would need Criterion 3's grep relaxed | |
| Separate per-plugin features | Distinct cargo features per plugin; most granular, more flag surface | |

**User's choice:** One umbrella "direct-only" default feature — both updater and autostart compile out in Phase 27.
**Notes:** Cargo features are additive, so compile-out requires a default feature the appstore build drops. Phase 29 then handles only the UI-side launch-at-login hiding.

---

## verify-appstore-bundle.sh scope

| Option | Description | Selected |
|--------|-------------|----------|
| Entitlements + plugins now, strings in Phase 28 | Assert entitlements present + forbidden plugins absent (cargo tree/otool); Phase 28 extends with Keygen string grep | ✓ |
| Full check now (strings included, may fail until 28) | All checks now including Keygen $9/license.tinkerdev.io grep; red between phases unless marked expected-fail | |

**User's choice:** Entitlements + plugins now; Keygen forbidden-string checks deferred to Phase 28 (extends same script).
**Notes:** Keeps each phase's gate green. Follows the `check-dev-strip.sh` bundle-assertion pattern.

---

## IS_APPSTORE frontend constant location

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated platform channel module | New src/lib/platform/channel.ts exporting IS_APPSTORE from VITE_CHANNEL; single import point for Phase 28 | ✓ |
| Inline import.meta.env.VITE_CHANNEL at call sites | Read env directly wherever needed; scatters the channel check | |

**User's choice:** Dedicated `src/lib/platform/channel.ts` module.
**Notes:** Honors the "tools import src/lib/platform/, never @tauri-apps/* directly" constraint; statically tree-shakeable like import.meta.env.DEV.

## Claude's Discretion

- Umbrella default feature name; whether `tauri-plugin-process` (relaunch) joins it.
- `package.json` variant script names/shape.
- Cleanup of `build-appstore-spike.sh` as it becomes canonical (preserve AMFI-413 rationale).

## Deferred Ideas

- Keygen forbidden-string grep in verify script → Phase 28 (MAS-BUILD-04).
- App-Store-managed Updates pane → Phase 28 (MAS-BUILD-07).
- UI-side launch-at-login hiding → Phase 29 (MAS-NATIVE-04).
- SMAppService → v2.
- `.pkg` / Apple Distribution signing / ASC upload → Phase 30.
