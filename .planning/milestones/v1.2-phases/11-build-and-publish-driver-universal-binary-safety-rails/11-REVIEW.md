---
phase: 11-build-and-publish-driver-universal-binary-safety-rails
reviewed: 2026-06-03T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/release/publishPlan.ts
  - src/lib/release/publishPlan.test.ts
  - scripts/build-and-publish.mjs
  - package.json
  - src/lib/update/downloadProgress.ts
  - src/lib/update/downloadProgress.test.ts
  - src/lib/platform/tauri.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the build-and-publish release driver (the pure `publishPlan.ts` decision
core + its `.mjs` I/O shell), the pure `downloadProgress.ts` updater reducer, both
test suites, `package.json`, and the `platform/tauri.ts` seam.

The architecture is solid and the security posture is strong: the pure/impure split
is clean and load-bearing, every CLI call uses `execFileSync` with an argv array
(no shell-injection surface), secrets flow only through inherited `{ env: process.env }`
and never onto an argv or into a log line, the signing-env and Apple-env checks return
booleans only, and the public-releases-repo invariant is enforced in one constant. The
project constraint that only `tauri.ts` imports `@tauri-apps/*` is respected, and that
seam correctly delegates the percent math to the pure reducer (the 8000% regression is
covered by a test).

No critical issues. The warnings concern robustness of the post-publish `curl` verify
and misleading diagnostics from a reused assertion helper. Info items are minor
consistency/control-flow notes.

## Warnings

### WR-01: Post-publish `curl` verify lacks `--fail` and any propagation retry

**File:** `scripts/build-and-publish.mjs:328-330`
**Issue:** The served-version verification runs:
```js
const served = run("curl", ["-L", LATEST_JSON_ENDPOINT]).stdout;
assertVersionMatches(extractServedVersion(JSON.parse(served)), version);
```
Two robustness gaps:
1. `curl -L` without `-f`/`--fail` exits 0 on an HTTP 4xx/5xx and returns the GitHub
   error/HTML body. `JSON.parse(served)` then throws a generic `SyntaxError` ("Unexpected
   token <") that is caught by the surrounding `try` and surfaces the recovery text — but
   the operator sees an opaque parse error rather than "the endpoint returned HTTP 404."
2. The plan's own copy (`publishPlan.ts:124-125`, `renderPublishRecovery`) acknowledges a
   "redirect hasn't propagated" failure mode, yet the verify is a single immediate request
   with no short retry/backoff. GitHub's `releases/latest/download` redirect can lag a few
   seconds after `gh release create`, so a freshly-correct publish can fail the gate purely
   on timing, then pass on a manual re-run — eroding trust in the gate.
**Fix:** Add `--fail` (or `--fail-with-body`) and `--silent --show-error` so HTTP errors
become a clear non-zero `curl` exit, and wrap the verify in a small bounded retry:
```js
function verifyServed(version, attempts = 5, delayMs = 2000) {
  for (let i = 1; i <= attempts; i++) {
    const res = run("curl", ["-fsSL", LATEST_JSON_ENDPOINT], { allowFailure: true });
    if (res.ok) {
      try {
        assertVersionMatches(extractServedVersion(JSON.parse(res.stdout)), version);
        return;
      } catch (e) {
        if (i === attempts) throw e; // version mismatch is real after retries
      }
    }
    if (i < attempts) run("sleep", [String(delayMs / 1000)]); // or a JS sleep
  }
  throw new Error(`served latest.json never reported version ${version} after ${attempts} tries`);
}
```
This keeps a genuine version mismatch fatal while tolerating redirect-propagation lag and
turning HTTP errors into legible messages.

### WR-02: `assertSingleSig` reused for `.app.tar.gz` and `.dmg` globs emits signature-specific diagnostics

**File:** `scripts/build-and-publish.mjs:279-281`
**Issue:** `assertSingleSig` is reused as a generic "exactly one match" guard for the
tarball and DMG globs:
```js
const tarball = assertSingleSig(globSync(`${UNIVERSAL_MACOS_DIR}/*.app.tar.gz`));
const dmg = assertSingleSig(globSync(`${UNIVERSAL_DMG_DIR}/*.dmg`));
```
But the helper's messages are hardcoded to the signature case
(`publishPlan.ts:70-78`): a missing `.dmg` would print "The build produced no signature —
was the signing env ... exported?", and two DMGs would say "Found more than one (>1)
`*.app.tar.gz.sig` file". For a missing/duplicated DMG or tarball these diagnostics point
the operator at the wrong root cause.
**Fix:** Extract a generic `assertSingleMatch(matches, label)` in `publishPlan.ts` that
takes a descriptive label, and have `assertSingleSig` delegate to it with `"*.app.tar.gz.sig"`:
```ts
export function assertSingleMatch(matches: string[], label: string): string {
  if (matches.length === 0) throw new Error(`Found 0 ${label} files in the bundle dir.`);
  if (matches.length > 1) throw new Error(`Found >1 ${label} files — ambiguous. Matches: ${matches.join(", ")}`);
  return matches[0];
}
```
Keep `assertSingleSig` for the security-critical `.sig` (with its signing-env hint), and
call `assertSingleMatch(glob, "*.dmg")` / `"*.app.tar.gz"` for the assets.

### WR-03: `existsSync` guard on the stale-`.sig` clear can leave a stale sig when the dir layout differs

**File:** `scripts/build-and-publish.mjs:245-251`
**Issue:** The stale-signature clear is gated on `existsSync(UNIVERSAL_MACOS_DIR)`. The
intent (T-11-07) is that the single-match glob is meaningful only if no prior `.sig`
survives. `globSync` already returns `[]` for a non-existent dir, so the `existsSync`
guard adds nothing for the happy path — but it does mean that if the build later writes
the `.sig` into a sibling/renamed path (e.g. a Tauri version that nests the bundle
differently), a stale sig elsewhere would be silently retained and the subsequent
single-match glob could pick up a non-fresh signature. The clear and the assert key off
the same `UNIVERSAL_MACOS_DIR` constant, so they stay consistent today, but the safety
relies entirely on that path being exact.
**Fix:** Drop the redundant `existsSync` wrapper (let `globSync` no-op on a missing dir),
and add a post-build assertion that the freshly-globbed `.sig` mtime is newer than the
build start timestamp, so a stale signature from an unexpected location can never satisfy
the single-match check:
```js
const buildStart = Date.now();
runGate("tauri build (universal)", ...);
const sigs = globSync(`${UNIVERSAL_MACOS_DIR}/*.app.tar.gz.sig`);
const sigPath = assertSingleSig(sigs);
if (statSync(sigPath).mtimeMs < buildStart) abort(`signature ${sigPath} predates this build — stale.`);
```

## Info

### IN-01: `readCurrentVersion` control flow relies on `abort()` never returning

**File:** `scripts/build-and-publish.mjs:142-148`
**Issue:** When `pkg.version` is not a string, the function calls `abort(...)` and then
falls through to `return pkg.version`. `abort` calls `process.exit(1)`, so the `return` is
unreachable at runtime, but neither the type system nor a linter knows that, so the
function's declared/return contract permits returning a non-string `undefined`. The same
pattern recurs wherever `abort` is used as a terminal statement.
**Fix:** Type `abort` as `never` (in a `.mjs` you can't annotate, but you can `return`
after it for clarity) or `throw` from `abort` instead of `process.exit`, then catch at
`main`. Minimally, add `return abort(...)` so readers see the early-out explicitly.

### IN-02: `viewerPermission` accepts `MAINTAIN` but the threat-model comment says only WRITE/ADMIN

**File:** `scripts/build-and-publish.mjs:202` (vs comment at line 182)
**Issue:** The preflight comment for T-11-09 reads "gh auth + WRITE/ADMIN permission", but
the check accepts `["ADMIN", "WRITE", "MAINTAIN"]`. Allowing MAINTAIN is reasonable (it
grants release management), but the comment and the code disagree, which could confuse a
future auditor verifying the threat model.
**Fix:** Update the comment to list all three accepted permissions (or drop MAINTAIN if the
threat model deliberately excludes it).

### IN-03: `run()` exposes a `raw` option used only implicitly via default

**File:** `scripts/build-and-publish.mjs:96-117`
**Issue:** The `run` helper destructures `raw = false` and branches on it
(line 105), but no caller in this file passes `raw: true`. It is dead configurability —
harmless, but it widens the helper's surface beyond what's exercised, and the trim/no-trim
distinction is untested.
**Fix:** Drop the `raw` option until a caller needs it, or add a caller/test that uses it
so the branch is covered.

### IN-04: `downloadProgress` reducer ignores `chunkLength` on an over-100 unknown-total path only via clamp

**File:** `src/lib/update/downloadProgress.ts:42-49`
**Issue:** Not a bug — the clamp and the `contentLength <= 0 → undefined` guards are correct
and well-tested. One minor edge: a malformed `Progress` event with a negative
`chunkLength` would decrement `downloaded` and could yield a negative `pct` (no lower
clamp). The plugin never emits negatives, so this is defensive-only.
**Fix (optional):** Clamp the low end too: `Math.max(0, Math.min(100, (downloaded / total) * 100))`,
or guard `event.data.chunkLength` to `>= 0` when accumulating.

---

_Reviewed: 2026-06-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
