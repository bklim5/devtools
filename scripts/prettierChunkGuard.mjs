// scripts/prettierChunkGuard.mjs
// PRT-02 heavy-engine chunk-isolation guard. Modeled on the D-04
// scripts/licenseUiFoldInGuard.mjs precedent (a generateBundle plugin that
// inspects the REAL per-chunk module inventory + emits a load-bearing sentinel),
// but with a CRITICALLY DIFFERENT violation predicate.
//
// licenseUi must NEVER ship in ANY chunk, so that guard checks chunk-membership
// across every chunk. The heavy prettier + esbuild-wasm engines MAY ship — they
// are the app's canonical prettify/minify engines — but ONLY from a chunk loaded
// LAZILY via dynamic `import()`. The offline/cold-start requirement (PRT-02,
// PITFALLS 3) is that neither engine is loaded on INITIAL page load. So the
// violation is INITIAL-REACHABILITY, not chunk-membership and not merely isEntry.
//
// In Rollup's generateBundle each OutputChunk exposes:
//   .isEntry        — true for entry chunks (the initial-reachability SEED)
//   .imports        — fileNames of chunks loaded via STATIC import (on page load)
//   .dynamicImports — fileNames loaded via dynamic import() (lazy, NOT initial)
// A statically-imported dependency can be hoisted into a NON-ENTRY shared/vendor
// chunk that is STILL loaded on initial page load through an entry chunk's
// .imports array. That passes an isEntry-only check yet regresses cold-start
// (a false-GREEN on PRT-02). This guard therefore traverses the STATIC-import
// graph from the entry chunks to a fixpoint (the set of chunks the browser
// actually loads on initial paint) and fails the build if any heavy engine
// module lives in that initially-reachable set.
//
// The module-ID patterns match the RESOLVED absolute Rollup module ids, which end
// in `node_modules/prettier/…` (standalone + every prettier/plugins/*) and
// `node_modules/esbuild-wasm/…` (the esbuild-wasm glue). They live ONLY here —
// vite.config.ts and the self-test reference the guard via import and never
// re-declare them.
export const HEAVY_ENGINE_MODULES = [
  /node_modules\/prettier\//,
  /node_modules\/esbuild-wasm\//,
];

export function prettierChunkGuard() {
  return {
    name: "prettier-esbuild-chunk-guard",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter((f) => f.type === "chunk");
      const byName = new Map(chunks.map((c) => [c.fileName, c]));

      // Compute the INITIALLY-REACHABLE chunk set: seed with every entry chunk,
      // then follow STATIC `.imports` (NOT `.dynamicImports`) to a fixpoint.
      const initial = new Set();
      const work = chunks.filter((c) => c.isEntry).map((c) => c.fileName);
      while (work.length > 0) {
        const name = work.pop();
        if (initial.has(name)) continue;
        initial.add(name);
        const chunk = byName.get(name);
        if (!chunk) continue;
        for (const imp of chunk.imports ?? []) {
          if (!initial.has(imp)) work.push(imp);
        }
      }

      // Classify every chunk that folds in a heavy engine module: an
      // initially-reachable one is a violation; a non-initially-reachable
      // (dynamic-import-only) one is the ALLOWED home and is recorded for the
      // positive proof.
      const initialHits = [];
      const asyncOnlyChunkFiles = [];
      for (const chunk of chunks) {
        const heavy = Object.keys(chunk.modules ?? {}).filter((id) =>
          HEAVY_ENGINE_MODULES.some((re) => re.test(id)),
        );
        if (heavy.length === 0) continue;
        if (initial.has(chunk.fileName)) {
          for (const id of heavy) initialHits.push(`${chunk.fileName}: ${id}`);
        } else {
          asyncOnlyChunkFiles.push(chunk.fileName);
        }
      }

      const heavyEngineInitiallyReachable = initialHits.length > 0;

      // Emit the load-bearing sentinel REGARDLESS (a missing sentinel is itself a
      // verifier failure — verify-appstore-bundle.sh FATALs on its absence). A
      // clean P32 app build has no consumer yet, so both arrays are empty; the
      // positive present-in-async-chunk proof activates at P33's first consumer
      // and is exercised NOW by the self-test's dynamic-only fixtures.
      this.emitFile({
        type: "asset",
        fileName: "prettier-chunk-inventory.json",
        source: JSON.stringify(
          { heavyEngineInitiallyReachable, initialHits, asyncOnlyChunkFiles },
          null,
          2,
        ),
      });

      if (heavyEngineInitiallyReachable) {
        throw new Error(
          "[PRT-02] a prettier/esbuild-wasm module is reachable from an entry chunk via static imports (initially loaded on page load — must be dynamic import() only):\n  " +
            initialHits.join("\n  "),
        );
      }
    },
  };
}
