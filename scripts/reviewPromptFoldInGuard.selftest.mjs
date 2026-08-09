// scripts/reviewPromptFoldInGuard.selftest.mjs
// MANDATORY non-vacuous self-test for scripts/reviewPromptFoldInGuard.mjs. It
// imports the SAME production guard vite.config.ts registers on the DIRECT build
// (never an inline/copied guard) and runs REAL Vite builds against tiny fixtures,
// asserting the guard's actual chunk.modules / throw / sentinel behaviour.
// Mirrors scripts/prettierChunkGuard.selftest.mjs, which mirrors
// verify-appstore-bundle.sh's selftest_foldin_realbuild.
//
// WHY this exists: a fold-in guard that matches nothing passes every build. The
// only way to know the regex still binds to the real module id is to build a tree
// that genuinely contains the module and watch the guard RED.
//
// Three cases (exit 0 only if ALL hold):
//   (a) reviewPrompt STATICALLY imported by the entry            → build MUST FAIL
//   (b) reviewPrompt reachable ONLY through a dynamic import in the dead arm of a
//       `false` build constant (the production IS_APPSTORE shape) → build MUST
//       PASS, sentinel {reviewPromptInChunks:false, hits:[]}
//   (c) reviewPrompt hoisted (manualChunks) into a NON-ENTRY chunk the entry
//       statically imports                                       → build MUST FAIL
//       (proves EVERY chunk is inspected, not just the entry chunk)
//
// Fixtures live INSIDE the repo tree (a temp dir under the repo root) purely for
// symmetry with the prettier self-test's resolution requirement; these fixtures
// import only relative paths, so nothing is resolved out of node_modules.
//
// The fixture module lives at `<case>/src/shell/reviewPrompt.js` so the RESOLVED
// absolute Rollup id ends in the exact repo-relative path the production regex
// anchors on (`src/shell/reviewPrompt.[tj]sx?$`) — the fixture exercises the
// production matcher, it does not approximate it.
import { build } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { stdout, exit } from "node:process";
import { reviewPromptFoldInGuard } from "./reviewPromptFoldInGuard.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(repoRoot, ".reviewprompt-guard-selftest-"));

function log(line) {
  stdout.write(line + "\n");
}

// The stand-in for src/shell/reviewPrompt.ts: only its PATH matters to the guard.
const REVIEW_PROMPT_SOURCE = "export function recordSettledSuccess() {}\n";

/**
 * Run a real Vite build of `entrySource` (plus the fixture reviewPrompt module)
 * and return whether it threw (the guard fired) plus the emitted sentinel
 * (parsed) when it succeeded. `manualChunks` optionally forces the module into
 * its own non-entry chunk; `define` optionally supplies build constants.
 */
async function runBuild(name, entrySource, { manualChunks, define } = {}) {
  const dir = join(tmp, name);
  mkdirSync(join(dir, "src", "shell"), { recursive: true });
  writeFileSync(join(dir, "src", "shell", "reviewPrompt.js"), REVIEW_PROMPT_SOURCE);
  const entry = join(dir, "entry.js");
  writeFileSync(entry, entrySource);
  const outDir = join(dir, "out");
  try {
    await build({
      root: tmp,
      logLevel: "silent",
      configFile: false,
      plugins: [reviewPromptFoldInGuard()],
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
    const sentinelPath = join(outDir, "reviewprompt-inventory.json");
    const sentinel = existsSync(sentinelPath)
      ? JSON.parse(readFileSync(sentinelPath, "utf8"))
      : null;
    return { failed: false, sentinel };
  } catch {
    return { failed: true, sentinel: null };
  }
}

let rc = 0;

// (a) STATIC FOLD-IN into the entry → MUST FAIL. This is the case the guard
// exists for: a stray `import { recordSettledSuccess } from "./reviewPrompt"`
// anywhere in always-loaded shell code drags the appstore-only module into the
// direct bundle.
{
  const r = await runBuild(
    "reviewprompt-foldin",
    'import { recordSettledSuccess } from "./src/shell/reviewPrompt.js";\nglobalThis.__r = recordSettledSuccess;\n',
  );
  if (r.failed) log("SELFTEST OK: reviewPrompt static fold-in FAILS the build");
  else {
    log(
      "SELFTEST FAIL: reviewPrompt static fold-in did NOT fail the build (the matcher is vacuous — it no longer binds to the real module id)",
    );
    rc = 1;
  }
}

// (b) CLEAN — the PRODUCTION shape: a module-scope ternary on a build constant
// that is `false` on this channel, with the dynamic import in the dead arm
// (useToolSuccess.ts's `IS_APPSTORE ? () => void import("./reviewPrompt")… : () => {}`,
// the proven ToolRoute idiom). Rollup folds the constant, drops the dead arm, and
// the module reaches NO chunk → build MUST PASS with a clean sentinel.
{
  const r = await runBuild(
    "reviewprompt-clean",
    'const notify = __IS_APPSTORE__\n' +
      '  ? () => void import("./src/shell/reviewPrompt.js").then((m) => m.recordSettledSuccess())\n' +
      "  : () => {};\nglobalThis.notify = notify;\n",
    { define: { __IS_APPSTORE__: "false" } },
  );
  const ok =
    !r.failed &&
    r.sentinel &&
    r.sentinel.reviewPromptInChunks === false &&
    Array.isArray(r.sentinel.hits) &&
    r.sentinel.hits.length === 0;
  if (ok)
    log(
      "SELFTEST OK: the dead-arm dynamic import (false build constant) PASSES with sentinel {reviewPromptInChunks:false, hits:[]}",
    );
  else {
    log(
      "SELFTEST FAIL: the gated dynamic-import build did not pass cleanly (either the guard false-REDs the production shape, or the sentinel is missing/dirty): " +
        JSON.stringify(r),
    );
    rc = 1;
  }
}

// (c) NON-ENTRY chunk trap — reviewPrompt statically imported by the entry but
// hoisted (manualChunks) into a SEPARATE vendor chunk. It is no longer in the
// entry chunk's own modules, so an entry-only inspection would MISS it; the guard
// walks EVERY chunk in the bundle → MUST FAIL.
{
  const r = await runBuild(
    "reviewprompt-nonentry",
    'import { recordSettledSuccess } from "./src/shell/reviewPrompt.js";\nglobalThis.__r = recordSettledSuccess;\n',
    {
      manualChunks: (id) => (id.includes("/src/shell/reviewPrompt") ? "vendor-review" : undefined),
    },
  );
  if (r.failed)
    log(
      "SELFTEST OK: reviewPrompt hoisted into a NON-ENTRY chunk FAILS the build (every chunk is inspected, not just the entry)",
    );
  else {
    log(
      "SELFTEST FAIL: the non-entry (hoisted chunk) case did NOT fail — the guard only inspects the entry chunk and would miss a hoisted fold-in",
    );
    rc = 1;
  }
}

rmSync(tmp, { recursive: true, force: true });

if (rc === 0) log("reviewPromptFoldInGuard self-test: OK (3/3)");
else log("reviewPromptFoldInGuard self-test: FAIL");
exit(rc);
