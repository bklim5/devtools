---
phase: 09-pure-release-core-housekeeping
reviewed: 2026-06-02T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/release/version.ts
  - src/lib/release/version.test.ts
  - src/lib/release/manifest.ts
  - src/lib/release/manifest.test.ts
  - src-tauri/Cargo.toml
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the pure release core (`version.ts`, `manifest.ts`), their test suites, and the `Cargo.toml` dependency wiring. The code is well-aligned with the project's "zero runtime/dev deps, pure string in/string out" constraint: no `fs`, no clock reads, no `semver`/`toml`/`json5` parsing, no platform imports. The fail-loud "exactly one match" design (D-01a) is implemented correctly, and the test coverage is strong (semver carry, malformed-input rejection, byte-identical preservation of dependency pins, dual-arch key invariants).

No Critical issues. One Warning concerns silent acceptance of out-of-range integers in `bumpSemver` that can corrupt a version string. The Info items cover latent regex fragility in the Cargo `[package]` section isolation, an over-permissive semver regex, and a redundant validation branch. None block the phase, but the Warning is worth addressing before Phase 10 wires these into the lockstep 3-file write.

## Warnings

### WR-01: `bumpSemver` accepts numerically-unsafe integers and emits a corrupt version

**File:** `src/lib/release/version.ts:37-47`
**Issue:** `Number(match[N])` is used without range validation. The `SEMVER_RE` (`\d+`) matches arbitrarily long digit runs, so a value beyond `Number.MAX_SAFE_INTEGER` (e.g. `"999999999999999999999.0.0"`) parses to a float and the bump produces `"1e+21.0.0"` — an invalid version string written silently into all three manifests. This contradicts the module's stated goal of failing loudly rather than silently corrupting a release (lines 15-17). Verified: `bumpSemver("999999999999999999999.0.0", "major")` returns `"1e+21.0.0"`.

A related case: leading zeros are silently normalized (`bumpSemver("01.2.3", "patch")` returns `"1.2.4"`), which mutates an unrelated component without flagging the malformed input.

**Fix:** Validate each parsed component is a safe integer (and optionally reject leading zeros to match strict semver):
```typescript
const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]);
if (![major, minor, patch].every(Number.isSafeInteger)) {
  throw new Error(`Invalid semver: ${JSON.stringify(version)} (component out of safe integer range)`);
}
```
Optionally tighten `SEMVER_RE` to disallow leading zeros: `/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/`. Add a test asserting both the large-integer and leading-zero inputs throw.

## Info

### IN-01: Cargo `[package]` section regex truncates at the first `[` of an array value

**File:** `src/lib/release/version.ts:119`
**Issue:** The section isolation regex `/^\[package\][^[]*/m` consumes everything after `[package]` up to the first `[` character *anywhere*, including inside an array-valued key. If a key like `keywords = ["cli", "dev"]` appeared in `[package]` *before* the `version` line, the captured section would be truncated mid-line and the subsequent `version` match would throw "found 0". Verified: for `[package]\nname = "x"\nkeywords = ["a","b"]\nversion = "0.1.0"...`, the captured section stops at `keywords = `. The current `src-tauri/Cargo.toml` is safe because `version` (line 3) precedes any array-valued key, but this is a latent fragility for future `[package]` edits.

**Fix:** Anchor the section to the next *section header* rather than the next `[` char, e.g. match up to a line starting with `[`: `/\[package\][\s\S]*?(?=^\[|\z)/m` (using a lookahead for a line-start `[` or end-of-input), or split on `/^\[/m` lines. Add a fixture with an array-valued key before `version` to lock the behavior.

### IN-02: `SEMVER_RE` permits more than the documented strict form is not the issue — the doc/regex are consistent, but the `default` branch in `bumpSemver` is unreachable under the type signature

**File:** `src/lib/release/version.ts:48-50`
**Issue:** The `default:` branch throwing "Unknown bump level" is defensive against a non-typed caller (the test exercises it via `"build" as never`). This is reasonable, but worth noting it is dead under normal typed usage — the value is only reachable when a caller deliberately defeats the type system. Not a bug; flagged only so it is not mistaken for live logic during future refactors.

**Fix:** No change required. If desired, a brief `// defensive: unreachable under the typed signature` comment documents intent.

### IN-03: `replaceSingleVersion` flag-clone could double-append `g` defensively but currently relies on the input never carrying `g`

**File:** `src/lib/release/version.ts:70`
**Issue:** `new RegExp(re.source, \`${re.flags.replace("g", "")}g\`)` strips an existing `g` then appends one, which is correct and idempotent (verified: produces `gm` from an `m`-only input). All current call-site regexes are non-global, so the strip is a no-op in practice. This is correct as written; noted only because the comment on lines 67-69 explains *why* a non-global `.match` would mislead, which is the actual subtle point — the code is sound.

**Fix:** No change required. The implementation is correct.

---

_Reviewed: 2026-06-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
