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

export function licenseUiFoldInGuard() {
  return {
    name: "appstore-licenseui-foldin-guard",
    generateBundle(_options, bundle) {
      const hits = [];
      for (const file of Object.values(bundle)) {
        if (file.type !== "chunk" || !file.modules) continue;
        for (const id of Object.keys(file.modules)) {
          if (LICENSE_UI_MODULE.test(id)) hits.push(`${file.fileName}: ${id}`);
        }
      }
      const licenseUiInChunks = hits.length > 0;
      // Emit the load-bearing sentinel REGARDLESS (so the verifier has a positive
      // artifact; a missing sentinel is itself a verifier failure).
      this.emitFile({
        type: "asset",
        fileName: "licenseui-inventory.json",
        source: JSON.stringify({ licenseUiInChunks, hits }, null, 2),
      });
      if (licenseUiInChunks) {
        throw new Error(
          `[D-04] src/lib/license/licenseUi was folded into the appstore bundle:\n  ${hits.join("\n  ")}`,
        );
      }
    },
  };
}
