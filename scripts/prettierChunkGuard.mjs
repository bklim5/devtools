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
// A statically-imported dependency can be hoisted into a NON-ENTRY shared/vendor
// chunk that is STILL loaded on initial page load through an entry chunk's
// .imports array. That passes an isEntry-only check yet regresses cold-start
// (a false-GREEN on PRT-02). This guard therefore scopes the shared factory's
// inventory to the STATIC-import fixpoint from the entry chunks (the set of
// chunks the browser actually loads on initial paint) — that `scopeChunks` hook
// is the ONLY thing that differs from the two fold-in guards built on the same
// factory (scripts/lib/chunkModuleGuard.mjs, which documents the traversal).
//
// The module-ID patterns match the RESOLVED absolute Rollup module ids, which end
// in `node_modules/prettier/…` (standalone + every prettier/plugins/*) and
// `node_modules/esbuild-wasm/…` (the esbuild-wasm glue). They live ONLY here —
// vite.config.ts and the self-test reference the guard via import and never
// re-declare them.
import {
  chunksOf,
  initiallyReachableChunks,
  makeChunkModuleGuard,
  matchesAny,
} from "./lib/chunkModuleGuard.mjs";

export const HEAVY_ENGINE_MODULES = [
  /node_modules\/prettier\//,
  /node_modules\/esbuild-wasm\//,
];

export function prettierChunkGuard() {
  return makeChunkModuleGuard({
    name: "prettier-esbuild-chunk-guard",
    // verify-appstore-bundle.sh FATALs on this file's absence, so it is emitted
    // on every outcome.
    sentinelFile: "prettier-chunk-inventory.json",
    // THE difference from the two fold-in guards: only the INITIALLY-REACHABLE
    // chunks count. The engines MAY ship — just not on first paint.
    scopeChunks: (_chunks, bundle) => {
      const initial = initiallyReachableChunks(bundle);
      return chunksOf(bundle).filter((c) => initial.has(c.fileName));
    },
    groups: [
      {
        flagKey: "heavyEngineInitiallyReachable",
        hitsKey: "initialHits",
        patterns: HEAVY_ENGINE_MODULES,
        message: (hits) =>
          "[PRT-02] a prettier/esbuild-wasm module is reachable from an entry chunk via static imports (initially loaded on page load — must be dynamic import() only):\n  " +
          hits.join("\n  "),
      },
    ],
    // POSITIVE evidence: the chunks where a heavy engine legitimately lives —
    // present in the bundle but NOT initially reachable, i.e. split rather than
    // externalised. A clean P32 app build had no consumer yet, so this was empty;
    // it activates at P33's first consumer and is exercised NOW by the self-test's
    // dynamic-only fixtures.
    extraSentinel: ({ chunks, scoped }) => {
      const initial = new Set(scoped.map((c) => c.fileName));
      return {
        asyncOnlyChunkFiles: chunks
          .filter(
            (c) =>
              !initial.has(c.fileName) &&
              Object.keys(c.modules ?? {}).some((id) =>
                matchesAny(id, HEAVY_ENGINE_MODULES),
              ),
          )
          .map((c) => c.fileName),
      };
    },
  });
}
