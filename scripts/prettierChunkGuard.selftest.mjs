// scripts/prettierChunkGuard.selftest.mjs
// MANDATORY non-vacuous self-test for scripts/prettierChunkGuard.mjs. It imports
// the SAME production guard vite.config.ts uses (never an inline/copied guard) and
// runs REAL Vite builds against tiny fixtures that consume the REAL prettier +
// esbuild-wasm packages, asserting the guard's actual chunk.modules /
// initial-reachability behaviour. The build harness is shared with
// scripts/reviewPromptFoldInGuard.selftest.mjs (scripts/lib/guardSelftest.mjs);
// it mirrors verify-appstore-bundle.sh's selftest_foldin_realbuild, extended to
// BOTH engines + the non-entry static-chunk trap.
//
// Run BOTH guard self-tests with `pnpm guard:selftest` (wired into lefthook
// pre-push — see lefthook.yml for why it is per-push, not per-commit).
//
// Five cases (exit 0 only if ALL hold):
//   (a) prettier static fold-in (entry) → build MUST FAIL
//   (b) esbuild-wasm static fold-in (entry) → build MUST FAIL (esbuild matcher
//       non-vacuous)
//   (c) prettier hoisted into a NON-ENTRY chunk STATICALLY imported by the entry
//       (manualChunks) → build MUST FAIL (proves .imports traversal, not isEntry)
//   (d) prettier dynamic-import-only → build MUST PASS, sentinel
//       heavyEngineInitiallyReachable:false, asyncOnlyChunkFiles non-empty
//   (e) esbuild-wasm dynamic-import-only → build MUST PASS, same
import { exit } from "node:process";
import { prettierChunkGuard } from "./prettierChunkGuard.mjs";
import { createGuardSelftest, runCases } from "./lib/guardSelftest.mjs";

const { runBuild, cleanup } = createGuardSelftest({
  prefix: ".prettier-guard-selftest-",
  plugin: prettierChunkGuard(),
  sentinelFile: "prettier-chunk-inventory.json",
});

/** A static fold-in MUST fire the guard. */
function foldInCase(label, name, entrySource, opts) {
  return {
    label,
    run: async () => {
      const r = await runBuild(name, entrySource, opts);
      return {
        ok: r.failed,
        detail: r.failed ? undefined : "guard vacuous for this engine/shape",
      };
    },
  };
}

/** A dynamic-only import MUST pass, with the engine in a non-initial chunk. */
function cleanCase(label, name, entrySource) {
  return {
    label,
    run: async () => {
      const r = await runBuild(name, entrySource);
      const ok =
        !r.failed &&
        r.sentinel &&
        r.sentinel.heavyEngineInitiallyReachable === false &&
        Array.isArray(r.sentinel.asyncOnlyChunkFiles) &&
        r.sentinel.asyncOnlyChunkFiles.length > 0;
      return { ok, detail: ok ? undefined : JSON.stringify(r) };
    },
  };
}

const rc = await runCases("prettierChunkGuard", [
  foldInCase(
    "prettier static fold-in FAILS the build",
    "prettier-foldin",
    'import * as p from "prettier/standalone";\nglobalThis.__p = p;\n',
  ),
  foldInCase(
    "esbuild-wasm static fold-in FAILS the build",
    "esbuild-foldin",
    'import * as e from "esbuild-wasm";\nglobalThis.__e = e;\n',
  ),
  // (c) Hoisted into a NON-ENTRY vendor chunk the entry STILL statically imports
  // → initially reachable through entry.imports. An isEntry-only check would MISS
  // this (prettier is not in the entry chunk's own modules).
  foldInCase(
    "prettier hoisted into a non-entry chunk that the entry STATICALLY imports FAILS the build (.imports traversal, not isEntry)",
    "prettier-nonentry-static",
    'import * as p from "prettier/standalone";\nglobalThis.__p = p;\n',
    {
      manualChunks: (id) =>
        id.includes("node_modules/prettier/") ? "vendor-prettier" : undefined,
    },
  ),
  cleanCase(
    "prettier dynamic-only build PASSES (heavyEngineInitiallyReachable:false, asyncOnlyChunkFiles non-empty — split, not externalised)",
    "prettier-clean",
    'const load = () => import("prettier/standalone");\nglobalThis.load = load;\n',
  ),
  cleanCase(
    "esbuild-wasm dynamic-only build PASSES (heavyEngineInitiallyReachable:false, esbuild in asyncOnlyChunkFiles)",
    "esbuild-clean",
    'const load = () => import("esbuild-wasm");\nglobalThis.load = load;\n',
  ),
]);

cleanup();
exit(rc);
