// scripts/lib/guardSelftest.mjs
// THE shared real-build harness both chunk-guard self-tests run on.
//
// WHY SELF-TESTS EXIST AT ALL: a fold-in guard that matches nothing passes every
// build. The only way to know a guard's regex still binds to the REAL resolved
// module id is to build a tree that genuinely contains the module and watch the
// guard RED. Each self-test therefore imports the SAME production guard
// vite.config.ts registers (never an inline copy) and runs REAL Vite builds.
//
// Fixtures live in a temp dir INSIDE the repo tree so bare specifiers (e.g.
// `prettier/standalone`) resolve against the repo's node_modules; a temp dir
// outside the repo would not resolve them.
import { build } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { stdout } from "node:process";

/** The repo root, resolved from THIS file (scripts/lib/…). */
export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function log(line) {
  stdout.write(line + "\n");
}

/**
 * A real-Vite-build harness for one guard.
 *
 * @param {object} config
 * @param {string} config.prefix temp-dir prefix (kept under the repo root).
 * @param {object} config.plugin the PRODUCTION guard plugin instance.
 * @param {string} config.sentinelFile the sentinel asset the guard emits.
 * @returns {{ runBuild: Function, cleanup: Function }}
 *   `runBuild(name, entrySource, opts)` builds a fixture and returns
 *   `{ failed, sentinel }` — `failed` true iff the guard threw (which is a PASS
 *   for the "must RED" cases), `sentinel` the parsed emitted JSON (null when the
 *   build failed or emitted nothing).
 *   `opts`: `{ files?: Record<relPath, source>, manualChunks?, define? }`.
 */
export function createGuardSelftest({ prefix, plugin, sentinelFile }) {
  const tmp = mkdtempSync(join(repoRoot, prefix));

  async function runBuild(name, entrySource, { files, manualChunks, define } = {}) {
    const dir = join(tmp, name);
    mkdirSync(dir, { recursive: true });
    for (const [relPath, source] of Object.entries(files ?? {})) {
      const full = join(dir, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, source);
    }
    const entry = join(dir, "entry.js");
    writeFileSync(entry, entrySource);
    const outDir = join(dir, "out");
    try {
      await build({
        root: tmp,
        logLevel: "silent",
        configFile: false,
        plugins: [plugin],
        ...(define ? { define } : {}),
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
      const sentinelPath = join(outDir, sentinelFile);
      return {
        failed: false,
        sentinel: existsSync(sentinelPath)
          ? JSON.parse(readFileSync(sentinelPath, "utf8"))
          : null,
      };
    } catch {
      return { failed: true, sentinel: null };
    }
  }

  function cleanup() {
    rmSync(tmp, { recursive: true, force: true });
  }

  return { runBuild, cleanup };
}

/**
 * Run the declared cases in order and report. A case is
 * `{ label, run: () => Promise<{ ok: boolean, detail?: string }> }`.
 * Returns the process exit code (0 only if ALL cases hold).
 */
export async function runCases(suiteName, cases) {
  let rc = 0;
  for (const { label, run } of cases) {
    const { ok, detail } = await run();
    if (ok) log(`SELFTEST OK: ${label}`);
    else {
      log(`SELFTEST FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
      rc = 1;
    }
  }
  log(
    rc === 0
      ? `${suiteName} self-test: OK (${cases.length}/${cases.length})`
      : `${suiteName} self-test: FAIL`,
  );
  return rc;
}
