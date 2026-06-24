// scripts/licenseUiFoldInGuard.mjs
// SINGLE source of truth for the D-04 fold-in guard. Imported by BOTH
// vite.config.ts (the production appstore plugin) AND verify-appstore-bundle.sh's
// --selftest-realbuild harness, so the self-test exercises the EXACT production
// guard (same regex, same emitFile, same throw) — a divergent test guard is
// impossible by construction.
//
// Inspects the REAL per-chunk module inventory (chunk.modules — the absolute module
// IDs Rollup ACTUALLY folded into each chunk) and FAILS the build if
// src/lib/license/licenseUi is folded into ANY chunk (D-04). This is the
// authoritative fold-in inventory the Vite chunk/asset manifest LACKS: a static
// licenseUi import folded into the main entry chunk leaves the Vite manifest keyed
// as src/main.tsx while the JS still ships the license-UI code (the false-GREEN this
// replaces). The guard ALSO emits a load-bearing sentinel asset
// (licenseui-inventory.json) so verify-appstore-bundle.sh can assert
// {licenseUiInChunks:false} on the SIGNED bundle.
//
// The module-ID regex matches the RESOLVED absolute Rollup module id, which ends in
// the repo-relative path src/lib/license/licenseUi.{ts,tsx,js,jsx}. It lives ONLY
// here — vite.config.ts and the self-test reference the guard via import and never
// re-declare it.
export const LICENSE_UI_MODULE = /src\/lib\/license\/licenseUi\.[tj]sx?$/;

// Phase 29 (MAS-NATIVE-02/03) — the updater UI subtree (the App-shell updater
// overlay) must TREE-SHAKE OUT of the store bundle. 29-02 extracted the WHOLE
// overlay (UpdaterOverlay → useUpdater → shell/update → UpdateBanner) and mounts
// it ONLY in the direct build via an IS_APPSTORE-gated lazy import, so none of
// these UI module IDs may be folded into a store chunk. This guard inventories
// them the SAME way it inventories licenseUi (the chunk.modules idiom) and emits
// their absence into the same sentinel; the build THROWS on fold-in.
//
// These are RESOLVED absolute Rollup module ids ending in the repo-relative path.
// Each is end-anchored with [tj]sx?$ so:
//   - src/components/UpdatesSettings.tsx (the DIRECT-only Updates pane) MATCHES,
//   - src/components/StoreUpdatesSettings.tsx (the store Updates pane that
//     LEGITIMATELY ships) does NOT (the leading path segment differs — the regex
//     anchors on /UpdatesSettings, not /…UpdatesSettings, so the Store-prefixed
//     file is not false-matched).
//
// DELIBERATELY EXCLUDED — the `@tauri-apps/plugin-updater` PACKAGE id is NOT here
// (and must never be added). tauri.ts imports plugin-updater at TOP LEVEL (line 21)
// and index.ts loads tauri.ts via ONE shared dynamic import("./tauri") that BOTH
// builds load via initPlatform(), so the inert plugin-updater JS rides along in the
// shared platform seam regardless of the overlay extraction — exactly like
// plugin-autostart (tauri.ts line 26), which D-05 ALREADY ACCEPTS (D-05 = a runtime
// no-op, not a bundle removal). Asserting plugin-updater PACKAGE absence is
// unsatisfiable and contradicts D-05; it would FALSE-RED every real store build. The
// load-bearing proof the updater is gone from the store build is two-part:
//   (1) these updater UI modules absent from the store chunks (this guard), AND
//   (2) the 29-02 RUNTIME no-invoke assertion (platform.updater.check called 0 times
//       on the store boot path) — mirroring keygen-compileout-d04-proof, where a
//       string/package-presence test is insufficient and the runtime no-invoke proof
//       is the load-bearing one.
export const UPDATER_MODULES = [
  /src\/shell\/update\.[tj]sx?$/,
  /src\/shell\/useUpdater\.[tj]sx?$/,
  /src\/components\/UpdateBanner\.[tj]sx?$/,
  /src\/components\/UpdaterOverlay\.[tj]sx?$/,
  /src\/components\/UpdatesSettings\.[tj]sx?$/,
];

export function licenseUiFoldInGuard() {
  return {
    name: "appstore-licenseui-foldin-guard",
    generateBundle(_options, bundle) {
      const hits = [];
      const updaterHits = [];
      for (const file of Object.values(bundle)) {
        if (file.type !== "chunk" || !file.modules) continue;
        for (const id of Object.keys(file.modules)) {
          if (LICENSE_UI_MODULE.test(id)) hits.push(`${file.fileName}: ${id}`);
          if (UPDATER_MODULES.some((re) => re.test(id)))
            updaterHits.push(`${file.fileName}: ${id}`);
        }
      }
      const licenseUiInChunks = hits.length > 0;
      const updaterInChunks = updaterHits.length > 0;
      // Emit the load-bearing sentinel REGARDLESS (so the verifier has a positive
      // artifact; a missing sentinel is itself a verifier failure). Keep the D-04
      // licenseUi fields AND add the Phase-29 updater fields in the SAME sentinel.
      this.emitFile({
        type: "asset",
        fileName: "licenseui-inventory.json",
        source: JSON.stringify(
          { licenseUiInChunks, hits, updaterInChunks, updaterHits },
          null,
          2,
        ),
      });
      if (licenseUiInChunks) {
        throw new Error(
          `[D-04] src/lib/license/licenseUi was folded into the appstore bundle:\n  ${hits.join("\n  ")}`,
        );
      }
      if (updaterInChunks) {
        throw new Error(
          `[Phase-29] an updater UI subtree module was folded into the appstore bundle:\n  ${updaterHits.join("\n  ")}`,
        );
      }
    },
  };
}
