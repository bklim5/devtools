// Golden-fixture generator for the Prettier parity lock (PRT-05).
//
// This authors/refreshes the CHECKED-IN `.golden` files from the ONE source of
// truth: the local pinned Prettier CLI (`node_modules/.bin/prettier`) — the same
// engine dev-time `prettier --write` uses. Each fixture is run through the CLI
// with `--no-config` (the standalone wrapper has no filesystem, so it never reads
// the repo `.prettierrc` printWidth:100) and EXPLICIT options that mirror the
// wrapper's defaults in src/lib/format/prettier.ts EXACTLY:
//   --print-width 80 --tab-width 2 --semi --no-single-quote --trailing-comma all
// so a golden equals what the wrapper (formatScript/formatHtml at default opts)
// must produce.
//
// TWO independent checks keep regeneration from ever masking drift:
//   1. prettier.parity.test.ts reads the COMMITTED goldens off disk and byte-
//      compares the wrapper output — it NEVER runs this generator (RED on wrapper
//      drift).
//   2. This generator + `git diff --exit-code -- test/fixtures/prettier/` is the
//      SEPARATE integrity check — RED if the committed goldens have gone stale vs
//      a fresh CLI run at the pin.
// Never wire this generator into the parity test: that would let a drifted golden
// be silently rewritten green.
//
// Usage: `node scripts/gen-prettier-golden.mjs` then commit the .golden files.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { stdout } from "node:process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const fixturesDir = join(repoRoot, "test", "fixtures", "prettier");
const prettierBin = join(repoRoot, "node_modules", ".bin", "prettier");

// Explicit per-fixture parser — no extension inference, so the source of truth is
// unambiguous and matches the wrapper's parser choice per language.
const FIXTURES = [
  { file: "messy.js", parser: "babel" },
  { file: "messy.ts", parser: "typescript" },
  { file: "embedded.html", parser: "html" },
];

// Mirror src/lib/format/prettier.ts `optionsFrom` at the default opts (indent "2").
const OPTIONS = [
  "--no-config",
  "--print-width",
  "80",
  "--tab-width",
  "2",
  "--semi",
  "--no-single-quote",
  "--trailing-comma",
  "all",
];

for (const { file, parser } of FIXTURES) {
  const input = join(fixturesDir, file);
  const output = execFileSync(
    prettierBin,
    [...OPTIONS, "--parser", parser, input],
    { encoding: "utf8", cwd: repoRoot },
  );
  const goldenPath = join(fixturesDir, `${file}.golden`);
  writeFileSync(goldenPath, output);
  stdout.write(`wrote ${goldenPath} (${output.length} bytes, parser=${parser})\n`);
}
