// scripts/reviewPromptFoldInGuard.selftest.mjs
// MANDATORY non-vacuous self-test for scripts/reviewPromptFoldInGuard.mjs. It
// imports the SAME production guard vite.config.ts registers on the DIRECT build
// (never an inline/copied guard) and runs REAL Vite builds against tiny fixtures,
// asserting the guard's actual chunk.modules / throw / sentinel behaviour. The
// build harness is shared with scripts/prettierChunkGuard.selftest.mjs
// (scripts/lib/guardSelftest.mjs); it mirrors verify-appstore-bundle.sh's
// selftest_foldin_realbuild.
//
// Run BOTH guard self-tests with `pnpm guard:selftest` (wired into lefthook
// pre-push — see lefthook.yml for why it is per-push, not per-commit).
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
// The fixture module lives at `<case>/src/shell/reviewPrompt.js` so the RESOLVED
// absolute Rollup id ends in the exact repo-relative path the production regex
// anchors on (`src/shell/reviewPrompt.[tj]sx?$`) — the fixture exercises the
// production matcher, it does not approximate it.
import { exit } from "node:process";
import { reviewPromptFoldInGuard } from "./reviewPromptFoldInGuard.mjs";
import { createGuardSelftest, runCases } from "./lib/guardSelftest.mjs";

const { runBuild, cleanup } = createGuardSelftest({
  prefix: ".reviewprompt-guard-selftest-",
  plugin: reviewPromptFoldInGuard(),
  sentinelFile: "reviewprompt-inventory.json",
});

// The stand-in for src/shell/reviewPrompt.ts: only its PATH matters to the guard.
const FIXTURE_FILES = {
  "src/shell/reviewPrompt.js": "export function recordSettledSuccess() {}\n",
};

const STATIC_IMPORT_ENTRY =
  'import { recordSettledSuccess } from "./src/shell/reviewPrompt.js";\n' +
  "globalThis.__r = recordSettledSuccess;\n";

// The PRODUCTION shape, byte-for-byte in structure: a module-scope ternary on a
// build constant, the dynamic import in the dead arm, and the .catch the real
// useToolSuccess.ts wraps it in.
const DEAD_ARM_ENTRY =
  "const notify = __IS_APPSTORE__\n" +
  "  ? () => {\n" +
  '      void import("./src/shell/reviewPrompt.js")\n' +
  "        .then((m) => m.recordSettledSuccess())\n" +
  "        .catch(() => {});\n" +
  "    }\n" +
  "  : () => {};\nglobalThis.notify = notify;\n";

const rc = await runCases("reviewPromptFoldInGuard", [
  {
    // (a) The case the guard exists for: a stray static import anywhere in
    // always-loaded shell code drags the appstore-only module into the direct
    // bundle.
    label: "reviewPrompt static fold-in FAILS the build",
    run: async () => {
      const r = await runBuild("reviewprompt-foldin", STATIC_IMPORT_ENTRY, {
        files: FIXTURE_FILES,
      });
      return {
        ok: r.failed,
        detail: r.failed
          ? undefined
          : "the matcher is vacuous — it no longer binds to the real module id",
      };
    },
  },
  {
    // (b) Rollup folds the constant, drops the dead arm, and the module reaches
    // NO chunk → build MUST PASS with a clean sentinel.
    label:
      "the dead-arm dynamic import (false build constant) PASSES with sentinel {reviewPromptInChunks:false, hits:[]}",
    run: async () => {
      const r = await runBuild("reviewprompt-clean", DEAD_ARM_ENTRY, {
        files: FIXTURE_FILES,
        define: { __IS_APPSTORE__: "false" },
      });
      const ok =
        !r.failed &&
        r.sentinel &&
        r.sentinel.reviewPromptInChunks === false &&
        Array.isArray(r.sentinel.hits) &&
        r.sentinel.hits.length === 0;
      return {
        ok,
        detail: ok
          ? undefined
          : "either the guard false-REDs the production shape, or the sentinel is missing/dirty: " +
            JSON.stringify(r),
      };
    },
  },
  {
    // (c) Statically imported but hoisted into a SEPARATE vendor chunk: no longer
    // in the entry chunk's own modules, so an entry-only inspection would MISS it.
    label:
      "reviewPrompt hoisted into a NON-ENTRY chunk FAILS the build (every chunk is inspected, not just the entry)",
    run: async () => {
      const r = await runBuild("reviewprompt-nonentry", STATIC_IMPORT_ENTRY, {
        files: FIXTURE_FILES,
        manualChunks: (id) =>
          id.includes("/src/shell/reviewPrompt") ? "vendor-review" : undefined,
      });
      return {
        ok: r.failed,
        detail: r.failed
          ? undefined
          : "the guard only inspects the entry chunk and would miss a hoisted fold-in",
      };
    },
  },
]);

cleanup();
exit(rc);
