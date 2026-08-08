# Phase 27: The Build-Variant Seam (3 layers) - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

One codebase builds **two variants from single canonical commands**:
- **direct** — today's DMG + auto-updater, Developer-ID, minSystem 10.15 (unchanged)
- **appstore** — sandboxed StoreKit `.app`, dev-signed for local launch, minSystem 13.0, updater compiled OUT

Phase 27 delivers: the 3-layer seam (cargo feature + `tauri.appstore.conf.json` overlay + `VITE_CHANNEL`), a **signed sandboxed `.app` that launches without white-screen**, the auto-updater (+autostart) **compiled out** of the store build, the 13.0/10.15 split living only in the overlay, and a committed `scripts/verify-appstore-bundle.sh`.

**In scope:** build plumbing, feature gating, the overlay config, the channel constant, the verify script.
**NOT in scope:** entitlement-source swap / store License pane / Keygen-string compile-out (Phase 28), sandbox-safe native features (Phase 29), `.pkg`/ASC submission (Phase 30).
</domain>

<decisions>
## Implementation Decisions

### Canonical build commands
- **D-01:** The single `pnpm tauri:build:appstore` command is **launch-ready in one step** — it runs the whole flow: build universal appstore bundle → embed the Mac Development provisioning profile → deep re-sign → verify. Promote the existing `scripts/build-appstore-spike.sh` into the committed canonical command (clean it up; it already does build + embed + deep re-sign + verify). This directly satisfies Success Criterion 2's "launches on the SIGNED `.app`" gate without a second command.
- **D-02:** Keep a clear direct-channel command path too (the existing `pnpm tauri build` / `release:publish` direct flow stays the canonical direct command — it builds with default features = updater present, 10.15, Developer-ID). A half-variant must be impossible: each variant has exactly one command.

### Compile-out mechanism (updater + autostart)
- **D-03:** Compile **both** updater and autostart OUT of the appstore build via **one umbrella "direct-only" default-enabled Cargo feature**. Cargo features are additive (you cannot subtract a dep by adding a feature), so the direct-only native deps (updater, autostart, and any relaunch-for-apply backend they need) move behind a `default`-enabled feature; the appstore command builds with `--no-default-features --features appstore` so `cargo tree --features appstore | grep -E 'updater|autostart'` is empty.
- **D-04:** This makes Success Criterion 3's grep pass for **both** updater and autostart in Phase 27. Phase 29 then handles only the **UI-side** launch-at-login hiding (the General-pane toggle), not the compile-out — the compile-out lands here.
- **D-05:** The direct build keeps default features on, so updater + autostart stay present in the DMG channel exactly as today. The base `tauri.conf.json` is untouched for the direct path (updater plugin config + `createUpdaterArtifacts` remain on base; the overlay turns them off for appstore).

### Overlay config (`tauri.appstore.conf.json`)
- **D-06:** Commit the overlay as a real file (today the spike inlines it as a `--config` JSON string). It carries ONLY the appstore deltas: `entitlements: entitlements.appstore.plist`, `minimumSystemVersion: 13.0`, `hardenedRuntime: false`, the dev `signingIdentity`, bundle `targets: ["app"]` (no dmg), and `createUpdaterArtifacts: false` + remove the `updater` plugin block. The **13.0 bump lives only here** — never on the base config (Criterion 4).

### Frontend channel constant
- **D-07:** `IS_APPSTORE` lives in a **dedicated platform channel module** — new `src/lib/platform/channel.ts` exporting `IS_APPSTORE`, derived from `VITE_CHANNEL` (build-time, statically tree-shakeable like `import.meta.env.DEV`). Honors the "tools import `src/lib/platform/`, never `@tauri-apps/*` directly" constraint and gives Phase 28 a single import point for pane/upsell gating. No scattered inline `import.meta.env.VITE_CHANNEL === 'appstore'` checks.
- **D-08:** `VITE_CHANNEL` is bound in the `package.json` appstore build script (one place), so a half-variant (cargo feature on, frontend channel off, or vice-versa) cannot ship.

### Verify script (`scripts/verify-appstore-bundle.sh`)
- **D-09:** Phase 27's verify script asserts what is TRUE at the Phase 27 gate: **required entitlements present** (`app-sandbox` + `network.client` via `codesign -d --entitlements`) + **forbidden plugins absent** (`cargo tree --features appstore` clean for updater/autostart; `otool`/binary check as needed). It stays **green** at the Phase 27 boundary.
- **D-10:** The **Keygen forbidden-string** checks (`license.tinkerdev.io`, literal `$9`, external buy link, key field — MAS-BUILD-04) are **deferred to Phase 28**, which EXTENDS the same script once that surface is compiled out. No red/expected-fail checks introduced between phases. (Pattern to follow: `scripts/check-dev-strip.sh` already does grep-style bundle assertions.)

### Claude's Discretion
- Exact name of the umbrella default feature (`direct`, `direct-native`, `updater`+`autostart` grouping) — planner picks; must be `default`-enabled and excluded by the appstore command.
- Whether `tauri-plugin-process` (relaunch) moves under the same umbrella feature (it backs the updater apply flow; if unused by appstore it can be gated or left — keep the appstore build clean and compiling).
- The `package.json` script names/shape for the two variants (e.g. `tauri:build:appstore`, `tauri:build:direct`) and how the appstore script invokes the promoted build flow.
- Cleanup/refactor of `build-appstore-spike.sh` content as it becomes the canonical command (keep the AMFI-413 / dev-signing rationale comments).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & roadmap
- `.planning/REQUIREMENTS.md` — MAS-BUILD-01, -02, -03, -05, -06 (the five Phase 27 requirements); MAS-BUILD-04/-07 noted as Phase 28 (don't pull forward).
- `.planning/ROADMAP.md` §"Phase 27" — goal + 5 success criteria (verbatim acceptance bar).
- `docs/harness-and-decisions.md` — authoritative locked decisions / build+verify harness.

### Build seam (already-built Phase 26 scaffolding to extend)
- `scripts/build-appstore-spike.sh` — the existing dev-signed sandbox build flow to **promote into the canonical command** (build → embed profile → deep re-sign → verify; carries the AMFI-413/dev-vs-distribution rationale).
- `scripts/check-dev-strip.sh` — existing bundle-assertion pattern; template for `verify-appstore-bundle.sh`.
- `src-tauri/Cargo.toml` §`[features]` (line ~105) — the `appstore = ["dep:tauri-plugin-iap"]` feature + the currently-UNCONDITIONAL `tauri-plugin-updater` / `tauri-plugin-autostart` deps to gate.
- `src-tauri/src/lib.rs` — the `#[cfg(feature = "appstore")]` registration matrix + the unconditional updater/autostart `.plugin(...)` calls to feature-gate.
- `src-tauri/tauri.conf.json` — base (Developer-ID, 10.15, updater plugin, `createUpdaterArtifacts:true`, targets `[app,dmg]`) — must stay untouched for the direct path; overlay carries appstore deltas.
- `src-tauri/entitlements.appstore.plist` — appstore entitlements (app-sandbox + network.client + application-identifier); `src-tauri/entitlements.plist` — direct entitlements.

### Sandbox / StoreKit context (Phase 26)
- `.planning/phases/26-storekit-bridge-spike/26-CONTEXT.md` — the bridge decisions this seam builds on.
- `docs/appstore/PHASE-26-BRIDGE-VIABILITY.md` — why the iap capability stays Rust-side (overlay grants entitlements + signing ONLY, never `iap:default`/`plugin:iap|*`).
- `docs/appstore/PHASE-26-SANDBOX-WALKTHROUGH.md` — the human sandbox launch/round-trip walkthrough the Phase 27 gate reuses.

### Standing project constraints
- `CLAUDE.md` / `.planning/PROJECT.md` — HashRouter only, six tools only, no network at runtime, `decoder.ts` + 19 tests untouched, tools import `src/lib/platform/`.
- Memory `mas-signing-dev-vs-distribution`: local sandbox launch needs **DEVELOPMENT** signing + embedded **Mac Development** profile (distribution profile → AMFI-413). Tauri 2.x has no `provisioningProfile` config key — the script embeds + deep re-signs.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-appstore-spike.sh` — full working dev-signed sandbox build (universal build + profile embed + deep re-sign + verify). Becomes the canonical appstore command (D-01).
- `scripts/check-dev-strip.sh` — bundle grep/assertion harness; pattern template for `verify-appstore-bundle.sh`.
- `appstore` cargo feature + `entitlements.appstore.plist` — already exist (Phase 26).
- The `#[cfg(feature = "appstore")]` matrix in `lib.rs` (iap registration) — the established gating idiom to extend for updater/autostart compile-out.
- `import.meta.env.DEV` usage across `src/` — the static-tree-shaking pattern `IS_APPSTORE`/`VITE_CHANNEL` should mirror.

### Established Patterns
- Cargo features are **additive** — compile-OUT requires a `default`-enabled feature dropped via `--no-default-features` (D-03), not an `appstore` feature that "removes" deps.
- Per-invocation `--config` overlay idiom already proven in the spike; base config stays the direct channel (Pitfall 11: 13.0 must not leak onto base).
- `src/lib/platform/` is the only allowed Tauri boundary — channel constant belongs there (D-07).

### Integration Points
- `package.json` `scripts` — add the two canonical variant commands; bind `VITE_CHANNEL` for appstore.
- `Cargo.toml [features]` + `lib.rs` plugin registration — the umbrella default feature + `#[cfg(...)]` gates.
- `src/lib/platform/channel.ts` (new) — consumed by Phase 28 for pane/upsell/Updates-pane gating.
- `tauri.appstore.conf.json` (new) — the committed `--config` overlay.

### Caveats for planner
- The launch-ready command needs a dev cert + `src-tauri/dev.provisionprofile` (machine-specific, gitignored) — fresh checkout / CI without them fails at the embed step; the verify/launch gate is a **local human** step (WebDriver can't drive the sandbox), consistent with the Phase 26 walkthrough gate.
- Build last / verify on the SIGNED bundle (harness rule); judge success by the bundle + signature, not the `tauri build` exit code (absent updater key makes it non-zero).
</code_context>

<specifics>
## Specific Ideas

- Promote, don't rewrite: `build-appstore-spike.sh` is proven — clean it into the canonical command, preserve its dev-signing/AMFI-413 rationale comments.
- One umbrella default feature is the explicit preference over per-plugin features (less flag surface).
- The verify script must stay green at each phase boundary — strings come with their compile-out in Phase 28, not before.
</specifics>

<deferred>
## Deferred Ideas

- **Keygen forbidden-string grep in verify script** (`license.tinkerdev.io`, `$9`, buy link, key field) — Phase 28 (MAS-BUILD-04), extends the same script after the surface is compiled out.
- **App-Store-managed Updates pane** (retained pane, "managed by the App Store" copy, affordances removed) — Phase 28 (MAS-BUILD-07). Phase 27 only compiles the updater backend out.
- **UI-side launch-at-login hiding** (General-pane toggle absent in store build) — Phase 29 (MAS-NATIVE-04). Phase 27 only compiles the autostart backend out.
- **SMAppService adoption** — deferred to v2 (Phase 29 notes).
- **`.pkg` / Apple Distribution signing / ASC upload** — Phase 30 (the spike's dev-signing is for local launch only; distribution signing is Phase 30).

None of these were scope creep — all are downstream phases already on the roadmap.
</deferred>

---

*Phase: 27-build-variant-seam*
*Context gathered: 2026-06-23*
