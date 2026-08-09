// scripts/lib/chunkModuleGuard.mjs
// THE shared chunk-module guard factory. Three production guards are built from
// it — scripts/licenseUiFoldInGuard.mjs (D-04 + the Phase-29 updater subtree),
// scripts/reviewPromptFoldInGuard.mjs (UP5-03) and scripts/prettierChunkGuard.mjs
// (PRT-02) — and each one's self-test drives the SAME factory output the
// production vite.config.ts registers, so "the guard the test exercises" and
// "the guard the build runs" cannot diverge.
//
// WHAT IS ACTUALLY SHARED (this is the whole reason the factory exists):
//   1. reading the REAL per-chunk module inventory (`chunk.modules` — the
//      absolute module IDs Rollup ACTUALLY folded into each chunk). This is the
//      inventory the Vite manifest LACKS: a module statically folded into the
//      entry chunk still shows up in the manifest as `src/main.tsx` while the
//      shipped JS carries its code (the `keygen-compileout-d04-proof` lesson —
//      a manifest is not a module inventory).
//   2. ALWAYS emitting a load-bearing sentinel asset, pass or fail, so a
//      downstream verifier has a POSITIVE artifact to read and a MISSING
//      sentinel is itself a failure signal.
//   3. throwing (failing the build) on any hit, with the offending
//      chunk → module pairs in the message.
//
// WHAT DIFFERS PER GUARD, and is therefore a parameter:
//   - WHICH chunks count. licenseUi/reviewPrompt: every chunk (those modules may
//     not ship AT ALL). prettier/esbuild: only the INITIALLY-REACHABLE ones —
//     the heavy engines MAY ship, but only from a lazily-imported chunk — hence
//     the `scopeChunks` hook.
//   - extra positive evidence in the sentinel (`extraSentinel`), e.g. PRT-02's
//     `asyncOnlyChunkFiles` (the engines' ALLOWED home).

/** True when `id` matches any of `patterns`. */
export function matchesAny(id, patterns) {
  return patterns.some((re) => re.test(id));
}

/** Every OutputChunk in a Rollup bundle, in bundle order. */
export function chunksOf(bundle) {
  return Object.values(bundle).filter((f) => f.type === "chunk");
}

/**
 * The set of chunk fileNames the browser loads on INITIAL page load: seed with
 * every entry chunk, then follow STATIC `.imports` (never `.dynamicImports`) to
 * a fixpoint. A statically-imported dependency hoisted into a NON-ENTRY
 * shared/vendor chunk is still loaded on first paint, so an `isEntry`-only check
 * is a false GREEN.
 */
export function initiallyReachableChunks(bundle) {
  const chunks = chunksOf(bundle);
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const initial = new Set();
  const work = chunks.filter((c) => c.isEntry).map((c) => c.fileName);
  while (work.length > 0) {
    const name = work.pop();
    if (initial.has(name)) continue;
    initial.add(name);
    for (const imp of byName.get(name)?.imports ?? []) {
      if (!initial.has(imp)) work.push(imp);
    }
  }
  return initial;
}

/**
 * Build a Rollup/Vite `generateBundle` guard.
 *
 * @param {object} config
 * @param {string} config.name plugin name.
 * @param {string} config.sentinelFile emitted asset filename (always emitted).
 * @param {Array<{flagKey: string, hitsKey: string, patterns: RegExp[], message: (hits: string[]) => string}>} config.groups
 *   One entry per independently-reported module family. Sentinel fields are
 *   emitted in this order as `flagKey` (boolean) + `hitsKey` (string[]), and the
 *   FIRST group with hits is the one that throws.
 * @param {(chunks: object[], bundle: object) => object[]} [config.scopeChunks]
 *   Which chunks a hit may be found in. Default: all of them.
 * @param {(ctx: {chunks: object[], scoped: object[], groups: object}) => object} [config.extraSentinel]
 *   Additional sentinel fields (positive evidence), appended after the groups.
 */
export function makeChunkModuleGuard({
  name,
  sentinelFile,
  groups,
  scopeChunks,
  extraSentinel,
}) {
  return {
    name,
    generateBundle(_options, bundle) {
      const chunks = chunksOf(bundle);
      const scoped = scopeChunks ? scopeChunks(chunks, bundle) : chunks;

      const hitsByGroup = groups.map(() => []);
      for (const chunk of scoped) {
        for (const id of Object.keys(chunk.modules ?? {})) {
          groups.forEach((group, i) => {
            if (matchesAny(id, group.patterns)) {
              hitsByGroup[i].push(`${chunk.fileName}: ${id}`);
            }
          });
        }
      }

      const sentinel = {};
      groups.forEach((group, i) => {
        sentinel[group.flagKey] = hitsByGroup[i].length > 0;
        sentinel[group.hitsKey] = hitsByGroup[i];
      });
      Object.assign(
        sentinel,
        extraSentinel?.({ chunks, scoped, hits: hitsByGroup }) ?? {},
      );

      // Emitted REGARDLESS of the outcome: the verifier needs a positive
      // artifact, and a missing sentinel must read as a failure, not a pass.
      this.emitFile({
        type: "asset",
        fileName: sentinelFile,
        source: JSON.stringify(sentinel, null, 2),
      });

      for (let i = 0; i < groups.length; i++) {
        if (hitsByGroup[i].length > 0) throw new Error(groups[i].message(hitsByGroup[i]));
      }
    },
  };
}
