// scripts/prettierChunkGuard.selftest.mjs
// MANDATORY non-vacuous self-test for scripts/prettierChunkGuard.mjs. It imports
// the SAME production guard vite.config.ts uses (never an inline/copied guard) and
// runs REAL Vite builds against tiny fixtures that consume the REAL prettier +
// esbuild-wasm packages, asserting the guard's actual chunk.modules /
// initial-reachability behaviour. Mirrors verify-appstore-bundle.sh's
// selftest_foldin_realbuild pattern, extended to BOTH engines + the non-entry
// static-chunk trap.
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
//
// Fixtures live INSIDE the repo tree (a temp dir under the repo root) so the bare
// `prettier/standalone` / `esbuild-wasm` imports resolve against the repo's
// node_modules; a temp dir outside the repo would not resolve them.
import { build } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { stdout, exit } from "node:process";
import { prettierChunkGuard } from "./prettierChunkGuard.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(repoRoot, ".prettier-guard-selftest-"));

function log(line) {
  stdout.write(line + "\n");
}

/**
 * Run a real Vite build of `entrySource` and return whether it threw (the guard
 * fired) plus the emitted sentinel (parsed) when it succeeded. `manualChunks`
 * optionally forces a heavy engine into its own non-entry chunk.
 */
async function runBuild(name, entrySource, manualChunks) {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  const entry = join(dir, "entry.js");
  writeFileSync(entry, entrySource);
  const outDir = join(dir, "out");
  try {
    await build({
      root: tmp,
      logLevel: "silent",
      configFile: false,
      plugins: [prettierChunkGuard()],
      build: {
        outDir,
        emptyOutDir: true,
        minify: false,
        rollupOptions: {
          input: entry,
          output: {
            entryFileNames: "[name].js",
            chunkFileNames: "[name]-[hash].js",
            ...(manualChunks ? { manualChunks } : {}),
          },
        },
      },
    });
    const sentinelPath = join(outDir, "prettier-chunk-inventory.json");
    const sentinel = existsSync(sentinelPath)
      ? JSON.parse(readFileSync(sentinelPath, "utf8"))
      : null;
    return { failed: false, sentinel };
  } catch {
    return { failed: true, sentinel: null };
  }
}

let rc = 0;

// (a) PRETTIER FOLD-IN — static import into the entry → MUST FAIL.
{
  const r = await runBuild(
    "prettier-foldin",
    'import * as p from "prettier/standalone";\nglobalThis.__p = p;\n',
  );
  if (r.failed) log("SELFTEST OK: prettier static fold-in FAILS the build");
  else {
    log("SELFTEST FAIL: prettier static fold-in did NOT fail the build (guard vacuous for prettier)");
    rc = 1;
  }
}

// (b) ESBUILD FOLD-IN — static import into the entry → MUST FAIL (esbuild matcher
// non-vacuous, Finding 2).
{
  const r = await runBuild(
    "esbuild-foldin",
    'import * as e from "esbuild-wasm";\nglobalThis.__e = e;\n',
  );
  if (r.failed) log("SELFTEST OK: esbuild-wasm static fold-in FAILS the build");
  else {
    log("SELFTEST FAIL: esbuild-wasm static fold-in did NOT fail the build (esbuild matcher vacuous)");
    rc = 1;
  }
}

// (c) NON-ENTRY-STATIC trap — prettier statically imported by the entry but hoisted
// (manualChunks) into a NON-ENTRY vendor chunk that the entry STILL statically
// imports → initially reachable through entry.imports → MUST FAIL. An isEntry-only
// check would MISS this (prettier is not in the entry chunk's own modules); the
// .imports traversal catches it (Finding 1).
{
  const r = await runBuild(
    "prettier-nonentry-static",
    'import * as p from "prettier/standalone";\nglobalThis.__p = p;\n',
    (id) => (id.includes("node_modules/prettier/") ? "vendor-prettier" : undefined),
  );
  if (r.failed)
    log("SELFTEST OK: prettier hoisted into a non-entry chunk that the entry STATICALLY imports FAILS the build (.imports traversal, not isEntry)");
  else {
    log("SELFTEST FAIL: the non-entry-static (hoisted shared chunk) case did NOT fail — the guard only checks isEntry, missing initial reachability via static .imports");
    rc = 1;
  }
}

// (d) PRETTIER CLEAN — dynamic import ONLY → MUST PASS with the engine in a
// non-initially-reachable chunk.
{
  const r = await runBuild(
    "prettier-clean",
    'const load = () => import("prettier/standalone");\nglobalThis.load = load;\n',
  );
  const ok =
    !r.failed &&
    r.sentinel &&
    r.sentinel.heavyEngineInitiallyReachable === false &&
    Array.isArray(r.sentinel.asyncOnlyChunkFiles) &&
    r.sentinel.asyncOnlyChunkFiles.length > 0;
  if (ok)
    log("SELFTEST OK: prettier dynamic-only build PASSES (heavyEngineInitiallyReachable:false, asyncOnlyChunkFiles non-empty — split, not externalised)");
  else {
    log("SELFTEST FAIL: prettier dynamic-only build did not pass cleanly: " + JSON.stringify(r));
    rc = 1;
  }
}

// (e) ESBUILD CLEAN — dynamic import ONLY → MUST PASS with esbuild in an
// async-only chunk.
{
  const r = await runBuild(
    "esbuild-clean",
    'const load = () => import("esbuild-wasm");\nglobalThis.load = load;\n',
  );
  const ok =
    !r.failed &&
    r.sentinel &&
    r.sentinel.heavyEngineInitiallyReachable === false &&
    Array.isArray(r.sentinel.asyncOnlyChunkFiles) &&
    r.sentinel.asyncOnlyChunkFiles.length > 0;
  if (ok)
    log("SELFTEST OK: esbuild-wasm dynamic-only build PASSES (heavyEngineInitiallyReachable:false, esbuild in asyncOnlyChunkFiles)");
  else {
    log("SELFTEST FAIL: esbuild-wasm dynamic-only build did not pass cleanly: " + JSON.stringify(r));
    rc = 1;
  }
}

rmSync(tmp, { recursive: true, force: true });

if (rc === 0) log("prettierChunkGuard self-test: OK (5/5)");
else log("prettierChunkGuard self-test: FAIL");
exit(rc);
