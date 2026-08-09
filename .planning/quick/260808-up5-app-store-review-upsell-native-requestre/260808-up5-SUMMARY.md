---
phase: quick-260808-up5
plan: 01
subsystem: shell + platform seam + native StoreKit bridge
status: complete (Tasks 1–5; awaiting the human walkthrough only)
tags: [app-store, review-prompt, prefs, platform-seam, appstore-channel, success-seam, storekit, swift-bridge]
requires: []
provides:
  - "Preferences.toolSuccessCount + Preferences.lastReviewRequestAt (untrusted-coerced)"
  - "src/shell/reviewPrompt.ts — appstore-only recurring-cadence prompt core"
  - "Platform.review.request() seam (tauri invoke arm + browser/test no-op)"
  - "src/shell/useToolSuccess.ts — the ONE settled-success seam (13/13 tools, 10 call sites)"
  - "src-tauri/src/review/ — appstore-only request_app_store_review command + StoreKit 2 Swift bridge"
  - "scripts/reviewPromptFoldInGuard.mjs — direct-build chunk fold-in guard + reviewprompt-inventory.json sentinel"
  - "test/e2e/review-prompt.e2e.ts — real-WKWebView direct-channel absence proof"
affects:
  - "Task 5 (rebuild-last rule) — the direct .app on disk predates the Task-4 commits; both channels must be rebuilt AFTER every harness fix"
  - "Task 5 (native capture) — the seam is the surface a real settled decode must drive; the appstore half has still never executed"
tech-stack:
  added: []
  patterns:
    - "injectable clock seam (mirrors the license _with_clock discipline)"
    - "promise-chain queue as the single in-memory concurrency guard"
    - "stamp-after-success persistence ordering"
    - "deliberate constant duplication to keep an appstore-only module out of the direct chunk graph"
    - "build-constant ternary over dynamic imports (the ToolRoute idiom) as the channel gate"
    - "settle-time-only hashing: the render path stores refs, the quiet-window callback digests"
    - "null-rendering reporter component so a two-mode tool keeps ONE seam call"
    - "swiftc straight to a static archive in OUT_DIR (no SwiftPM/swift-bridge/objc2 crate) as the ObjC-unreachable-API escape hatch"
    - "RAII Drop guard as the ONLY release path for a process-level in-flight AtomicBool"
    - "address-taking test as a LINK-level proof that a statically-linked FFI symbol resolves"
key-files:
  created:
    - src/shell/reviewPrompt.ts
    - src/shell/reviewPrompt.test.ts
    - src/shell/useToolSuccess.ts
    - src/shell/useToolSuccess.test.tsx
    - src-tauri/src/review/review.swift
    - src-tauri/src/review/mod.rs
    - scripts/reviewPromptFoldInGuard.mjs
    - scripts/reviewPromptFoldInGuard.selftest.mjs
    - test/e2e/review-prompt.e2e.ts
    - test/e2e/review-prompt-appstore.e2e.ts
  modified:
    - vite.config.ts
    - docs/CHANNELS.md
    - src-tauri/build.rs
    - src-tauri/src/lib.rs
    - src/shell/preferences.ts
    - src/shell/prefsStore.ts
    - src/shell/prefsStore.test.ts
    - src/shell/testStore.ts
    - src/lib/platform/index.ts
    - src/lib/platform/tauri.ts
    - src/lib/platform/browser.ts
    - src/lib/platform/platform.test.ts
    - src/lib/platform/tauri.test.ts
    - src/components/FormatterView.tsx
    - src/components/FormatterView.test.tsx
    - src/tools/protobuf-decoder/ProtobufDecoder.tsx
    - src/tools/protobuf-decoder/ProtobufDecoder.test.tsx
    - src/tools/base64/Base64Tool.tsx
    - src/tools/hash/HashTool.tsx
    - src/tools/jwt/JwtTool.tsx
    - src/tools/unix-time/UnixTimeTool.tsx
    - src/tools/uuid-ulid/UuidUlidTool.tsx
    - src/tools/json-formatter/JsonFormatterTool.tsx
    - src/tools/xml-formatter/XmlFormatterTool.tsx
    - src/tools/html-formatter/HtmlFormatterTool.tsx
    - src/tools/js-formatter/JsFormatterTool.tsx
    - src/tools/cron/CronTool.tsx
    - src/tools/regex/RegexTool.tsx
    - src/tools/url/UrlTool.tsx
metrics:
  tasks-complete: "5/5"
  tests-added: 53
  suite: "1468 vitest passing (117 files) + 5 Rust review:: tests (appstore feature) / 87 Rust tests (direct feature) + 27/27 e2e spec files on the real WKWebView + a 3/3 guard selftest"
---

# Quick Task 260808-up5: App Store review upsell — Summary

## Task 1 — Prefs fields, the appstore-only prompt core, and the platform review seam

**Commit:** `745acf6d` — `feat(quick-260808-up5): review-prompt cadence core + prefs fields + platform.review seam`

One-liner: an appstore-only, clock-injectable review cadence core that fires at every
3rd settled tool success with a 7-day floor, stamped only after the native request
resolves, plus the `platform.review` seam the Rust command will back.

### What landed

**Prefs (additive, untrusted-coerced).** `toolSuccessCount: number` (default `0`) is a
LIFETIME counter that increments forever and is never reset by a request; every 3rd value
is a boundary. `lastReviewRequestAt: number | null` (default `null`) is a RATE-LIMIT stamp,
not a one-shot claim. Coercers: non-negative INTEGER clamped at a local `1_000_000` ceiling,
and the `coerceLastUpdateCheck` finite-positive discipline for the stamp. The ceiling is
**duplicated, not imported** from `reviewPrompt.ts` — importing it would fold the
appstore-only module into the always-loaded prefs module's chunk graph and RED the Task-4
guard. `1_000_000 % 3 === 1`, so a clamped counter can never stand permanently on a boundary;
reviewPrompt Test 13 pins both properties (equality + non-multiple) so the duplication
cannot drift.

**`src/shell/reviewPrompt.ts` (new, appstore-only).** Module state is an injectable
`now: () => number = Date.now` plus a `queue: Promise<void>` promise chain — **no `done`
latch**. `recordSettledSuccess()` enqueues `queue.then(runOnce, runOnce)` (both arms are
`runOnce`, so a rejection cannot poison the chain). `runOnce` order: wait for the real
persisted blob → bail unless `getPreferencesLoadOk()` → increment (clamped) through the
single-writer `updatePreferences` → boundary test `next % 3 === 0 && next > 0` → fail-closed
gap test → frontmost check → **re-read the gap, invoke, and stamp only after the await
resolves**, with one final gap re-read so a losing concurrent instance skips its write. A
rejected native call persists nothing and returns, so the next boundary genuinely retries.

**Platform seam.** `Platform.review = { request(): Promise<void> }` + the accessor getter;
the tauri arm is `invoke<void>("request_app_store_review")` (reusing the already-imported
`invoke`, no new import); browser/test arms are deterministic no-ops. `noopReview` added to
`testStore.ts` so `makeMemoryPlatform` and every spread-based stub satisfy the widened
interface; the four full `Platform` object literals in `platform.test.ts` got the new arm.

### Tests (all 21 planned behaviors + 1 extra)

| File | Behaviors |
|---|---|
| `src/shell/reviewPrompt.test.ts` (node env) | Tests 1–15 — first boundary, stamp-after-success ordering, non-boundary no-ops, gap suppression, the inclusive `>=` gap edge in both directions, mid-session counter, previous-session stamp, not-frontmost deferral, failed prefs load, native-failure retry, 10-same-tick serialization, cross-instance race, constants contract, clamped ceiling, real-clock default |
| `src/shell/prefsStore.test.ts` | Tests 16–19 — defaults, counter coercion + clamp, stamp coercion, additive-only round-trip |
| `src/lib/platform/platform.test.ts` | Test 20 (+20b) — browser no-op with no native call; accessor delegation |
| `src/lib/platform/tauri.test.ts` | Test 21 — `invoke("request_app_store_review")` with exactly one argument |

Every cadence expectation is built off the injected clock; the only test touching
`Date.now()` is Test 15, which exists to prove the seam defaults to it.

### Verification

- `pnpm vitest run` — **1456 passed / 116 files** (22 new).
- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec eslint` — clean on all touched files (the 4 repo-wide warnings are pre-existing
  in `SidebarResetMenu.tsx` / `settingsPanes.tsx`, untouched here).
- Decoder untouched: `git diff --quiet HEAD -- src/lib/protobuf/` passes.
- `grep -rn '^import .*"@tauri-apps' src | grep -v platform/tauri.ts | grep -v test` — empty.
- `src/shell/prefsStore.ts` does not import `./reviewPrompt` (comment references only).
- `grep -rn reviewPromptRequestedAt src test` — empty (superseded one-shot name never introduced).
- `reviewPrompt.ts` contains no `done` latch; every `Date.now` occurrence is the default
  assignment, the test-reset restore, or a comment.
- lefthook pre-commit gate (typecheck + lint + full suite) passed on the commit.

### Deviations from Plan

**1. [Rule 1 — spec correction] Test 12's "counter settles at 3" assertion is unachievable and was replaced.**
The plan's Test 12 asks for two module instances racing at count 2→3 and asserts the counter
settles at **3**. With the shared `usePreferences` singleton, two `recordSettledSuccess()`
calls from count 2 necessarily settle at **4** — a settle at 3 would require a LOST UPDATE,
which Test 11 explicitly forbids. Asserting 3 would have forced a bug into the
implementation. Implemented instead the scenario that actually exercises the intended race:
instance A parks in a deferred request at its count-3 boundary; instance B climbs 4, 5, 6 and
reaches its own boundary (legitimately invoking too, since no stamp exists yet); A resolves
and stamps; B resolves, re-reads the gap, sees A's fresh stamp and **skips its write**. The
plan's load-bearing assertions are all kept: at most one `request` per instance (never two
from one — the queue is that instance's pending claim), exactly ONE stamp write across both,
the surviving stamp equals the winner's value, and no lost update (counter settles at 6).
Cross-instance NATIVE dedup remains the Task-3 in-flight guard's job, as the plan states.

**2. [Rule 2 — missing error handling] `recordSettledSuccess()` returns a promise that can never reject.**
The chain was already rejection-safe (`queue.then(runOnce, runOnce)`), but the promise handed
to the CALLER would have rejected if `runOnce` ever threw outside the request try/catch —
and Task 2 calls this fire-and-forget from a React effect, where that is a dev-overlay crash
and prod console noise. Added `return queue.catch(() => {})`; `queue` itself keeps the raw
promise, so recovery semantics are unchanged. This makes the module's documented "never
throws" contract true of its public API, not just its internals.

**3. [Notation] Test 12 obtained its second instance via the plan's PREFERRED path.**
`await import("./reviewPrompt?instance=2")` (through a variable specifier, so TS/Vite do not
statically resolve it) DID yield a genuinely separate module instance under this vitest
config — asserted in-test via `b.recordSettledSuccess !== recordSettledSuccess`. The plan's
`vi.resetModules()` fallback was not needed, so the cross-instance guarantee rests on a real
two-instance test, not only on the persisted gap re-read.

### Notes for Task 2

- Import shape: `const { recordSettledSuccess } = await import("./reviewPrompt")` — the plan's
  `key_links` pattern is `import\("\./reviewPrompt"\)`, and the module must stay free of any
  static importer.
- `recordSettledSuccess()` takes **no arguments** and returns a never-rejecting
  `Promise<void>` that resolves after this call's read-modify-write (and any request it
  triggered) completes. Success IDENTITY/dedup is entirely Task 2's job — this core counts
  every call it receives.
- The core already handles the frontmost check (`document.hasFocus()`), the prefs
  load-ok gate, and all serialization. Task 2 must not duplicate any of them.
- `SETTLE_MS` and `fnv1a32` do NOT exist yet — they are Task 2's to create in
  `src/shell/useToolSuccess.ts`.
- Constants exported for reuse/assertions: `SUCCESS_INTERVAL`, `MIN_REQUEST_GAP_MS`,
  `MAX_TOOL_SUCCESS_COUNT`; test seams: `__setReviewClockForTest`, `__resetReviewPromptForTest`.
- `noopReview` is exported from `src/shell/testStore.ts` for any new Platform stub.
- Task 2's Test 9 (direct-channel no-invoke) can assert `store.set` never carries a non-zero
  `toolSuccessCount`; the field now exists on every merged blob with default `0`.

### Harness status (Task 1)

Unit gate (vitest + tsc + eslint via lefthook) is GREEN. The remaining per-task DoD steps —
`/simplify`, `/code-review xhigh`, `/codex:adversarial-review`, and real-webview UI
verification — are the orchestrator's to run; Task 1 adds no UI surface (pure logic + seam),
so its webview verification naturally folds into the Task-2/Task-5 flow where the seam is
actually exercised.

---

## Task 2 — The shared settled-success seam, wired to all 13 tools

**Commit:** `e6e1952d` — `feat(quick-260808-up5): shared settled-success seam wired to all 13 tools`

One-liner: one hook module that turns "a successful output has sat unchanged for 3 s"
into exactly one counted episode, identified by a full-output FNV-1a-32 digest computed
only in the settle callback, and reaches the appstore-only prompt core through a
build-constant dynamic import that leaves no trace in any direct chunk.

### What landed

**`src/shell/useToolSuccess.ts` (new, the ONE seam).** `SETTLE_MS = 3000` is both the
quiet-window length and the operative definition of "natural pause" — a successful output
must sit UNCHANGED that long before it counts, so a request can never land mid-paste or
mid-typing. `fnv1a32` hashes the WHOLE output string (no truncation), and
`successIdentity(toolId, output)` = `` `${toolId}:${output.length}:${fnv1a32(output).toString(36)}` ``.

The render path does NO hashing: the effect (deps `[ok, toolId, output]`) stores the latest
`(toolId, output)` into a ref and arms a timer; the digest is computed inside the timer
callback, at most once per quiet window. A `lastNotified` ref collapses a re-settle of the
identical identity (StrictMode double-effect, remount) into one episode.

The channel gate is the proven `ToolRoute.tsx` idiom — a MODULE-SCOPE ternary between a
dynamic import and a no-op:

```ts
const notifySettledSuccess: () => void = IS_APPSTORE
  ? () => void import("./reviewPrompt").then((m) => m.recordSettledSuccess())
  : () => {};
```

**Ten production call sites cover all thirteen tools.** `FormatterView` carries one call for
the four formatter tools (its `toolId` prop is new and required; `pending` is excluded from
`ok` because an async formatter keeps its previous `ok` parseState while the next format is
in flight). The other nine are `ProtobufDecoder`, `Base64Tool`, `HashTool`, `JwtTool`,
`UnixTimeTool`, `UuidUlidTool`, `CronTool`, `RegexTool`, `UrlTool`. No tool file contains
counting logic, and none imports `reviewPrompt`
(`grep -rn "reviewPrompt" src/tools src/components` is empty).

Per-tool `output` reuses the serialization the tool ALREADY shows or copies — never an
invented second one: protobuf's `fieldsToJson` copy-all text (now memoized and shared with
the Copy-all button), JWT's pretty-printed payload block, base64's canonical `hex` rendering
of the one internal byte array, hash's five rendered digest rows, unix-time's three derived
rows, cron's description + run labels, regex's match view + replaced result, url's readout
rows + decoded query table.

Three call sites needed a judgement call, each documented in-file:

- **HashTool** has no `pending` flag, but its four async SHA rows are `""` until they
  resolve — so the output CHANGES on resolve and the window simply restarts. An in-flight
  digest can never settle as a finished result.
- **UuidUlidTool** generates one id on MOUNT, i.e. by mere navigation, which must not count
  (UP5-01). A `generated` boolean (set only by Generate / kind / count) is the tool's success
  discriminant; a valid Decode also counts. Both shapes fold into one output string so the
  file keeps ONE call.
- **UrlTool** owns no output itself — `ParseMode` and `EncodeMode` do. Rather than lift both
  modes' state (a behaviour change: input would survive a mode switch) or plumb callbacks,
  both modes render a null-rendering `UrlSuccess` reporter that makes the file's single
  `useToolSuccess` call.

**`src/shell/useToolSuccess.test.tsx` (new).** The notifier arm is selected at module scope,
so the channel cannot be flipped on a live module: every suite imports a FRESH hook module
behind `vi.resetModules()` + `vi.doMock("@/lib/platform/channel")`. Verified empirically that
this does NOT break React hook identity in this vitest config (react is externalized, so
`resetModules` does not hand the hook a second React instance).

### Tests (all 12 planned behaviors)

| File | Behaviors |
|---|---|
| `src/shell/useToolSuccess.test.tsx` | Tests 1–11 — settle timing at the `SETTLE_MS - 1` / `+1` edge; 10 s of simulated typing then one settle; change-and-resettle = 2 episodes; 24 re-renders of an unchanged output across two windows = 1 episode; equal-length distinct outputs incl. the **>16 KB middle-only difference** (identical 4 KB head AND tail); same text from a different tool = distinct identity; `ok=false` held 10 s = 0; unmount cancels; direct-channel no-invoke + reviewPrompt **never evaluated**; fnv1a32 known vectors + purity + 2 MB scan under 50 ms; 50 re-renders of a 2 MB output hash ZERO times until settle, then exactly 1 |
| `src/tools/protobuf-decoder/ProtobufDecoder.test.tsx` | Test 12 — the hero tool reaches the seam as `("protobuf-decoder", true, <copy-all JSON text>)` on a successful decode and `ok=false` on empty and on a group-byte error; every pre-existing assertion still passes |

### Verification

- `pnpm vitest run` — **1468 passed / 117 files** (12 new; was 1456/116).
- `pnpm exec tsc --noEmit` — clean.
- `pnpm lint` — 0 errors; the only 4 warnings are pre-existing in `SidebarResetMenu.tsx` /
  `settingsPanes.tsx` (untouched).
- Plan verify command passes verbatim: exactly **10** production call sites, and
  `StatusBar.tsx`, `StatusBar.test.tsx`, `src/lib/protobuf/` all byte-unchanged
  (`SEAM-10-STATUSBAR-AND-DECODER-UNTOUCHED`).
- **Tree-shake proven empirically, not assumed** (this is Task 4's guard's precondition):
  - `VITE_CHANNEL=direct vite build` → `grep -rl "recordSettledSuccess\|MIN_REQUEST_GAP_MS"`
    over the whole output is **empty**.
  - `VITE_CHANNEL=appstore vite build` → `assets/reviewPrompt-*.js` is emitted as its own
    lazy chunk.
- lefthook pre-commit gate (archive-guard, doc-secrets, typecheck, test, lint) passed.

### Deviations from Plan

**1. [Rule 3 — blocking issue] `ProtobufDecoder.tsx` contained a raw NUL byte, so the plan's verify command could never pass.**
`const decodeKey = \`${raw}\0${override ?? ""}\`;` held a LITERAL 0x00 byte (present at
HEAD, predating this task). Both git and grep therefore classified the hero tool's source as
BINARY: `git diff` reported only "Binary files differ" (no reviewable diff at all), and
`grep -rn 'useToolSuccess('` silently SKIPPED the file, capping the plan's required count at
9 of 10. Replaced the raw byte with the `\0` escape — byte-identical runtime semantics
(`\0` in a template literal is U+0000, and it is followed by `$`, so no octal-escape
ambiguity), file is now `UTF-8 text`, `git diff` is reviewable again, and the verify command
passes as written. Not a decoder-library change: `src/lib/protobuf/` is byte-untouched.

**2. [Rule 1 — bug] Memoized `fields` to stop the new `outputJson` memo recomputing every render.**
`const fields = result.fields ?? []` allocates a FRESH array on every render whenever the
decode yields no fields, which made the new `useMemo` for `outputJson` (and `FieldTree`'s
props) churn on every render. `react-hooks/exhaustive-deps` flagged it as soon as the memo
existed. Wrapped as `useMemo(() => result.fields ?? [], [result.fields])`.

**3. [Rule 3 — blocking issue] `FormatterView.test.tsx` needed its `renderView` helper updated.**
The plan makes `toolId` a REQUIRED prop, so the existing test helper no longer typechecked.
Added `toolId="json-formatter"` — one line, no assertion changed. The file was not in the
plan's Task-2 `<files>` list, but a required prop cannot be added without it.

**4. [Notation] The seam ref is written in the EFFECT, not during render.**
The plan's sketch assigned `latest.current = { toolId, output }` on the render path. That is
a React-purity violation (this repo runs the React Compiler lint) and is redundant here: the
effect deps already include `toolId` and `output`, so the effect re-runs on every change and
its closure holds the current values. Moved the assignment into the effect body. All the
plan's load-bearing properties are unchanged and directly asserted — the render path does no
hashing (Test 11), and the digest is computed once per quiet window.

### Notes for Task 3

- Task 3 is pure Rust/Swift (`src-tauri/`) and is **independent of Tasks 1–2** — no
  TypeScript file it touches, and no TS file references it except the already-landed
  `invoke<void>("request_app_store_review")` in `src/lib/platform/tauri.ts` (Task 1).
- The webview contract Task 3 must satisfy: `request_app_store_review` takes **no
  arguments** and returns `Promise<void>`. A rejection is a normal, handled outcome —
  `reviewPrompt.runOnce` catches it, persists NOTHING, and retries at the next 3rd-success
  boundary. So the Rust side must **reject** (not silently succeed) whenever the OS was not
  actually asked, or the 7-day window gets burned on a request that never happened.
- The `AtomicBool` is an **IN-FLIGHT** guard, not a once-ever latch: claim on entry, ALWAYS
  release on completion (success and every failure path). A once-ever latch would kill every
  request after the first for the life of the process, breaking the recurring cadence.
- Nothing in Task 3 affects the direct-build absence proof that Task 2 established — but
  Task 4's guard depends on `src/shell/reviewPrompt.ts` keeping **no static importer**. That
  invariant currently holds (verified: the direct bundle contains no reviewPrompt symbol at
  all); do not add one.

### Harness status (Task 2)

Unit gate (vitest + tsc + eslint via lefthook) is GREEN, plus the two-channel Vite build
absence/presence proof above. The remaining per-task DoD steps — `/simplify`,
`/code-review xhigh`, `/codex:adversarial-review`, and real-webview UI verification — are
the orchestrator's to run. Task 2 changes **no markup, no roles, no classes** in any tool
(every call site is a hook call plus a derived string), so its webview verification is a
no-visual-regression check that folds into the Task-5 native capture, where a real settled
decode actually drives the seam.

---

## Task 3 — StoreKit 2 Swift bridge and the appstore-only Rust command

**Commit:** `dd81008d` — `feat(quick-260808-up5): StoreKit 2 review bridge + appstore-gated Rust command`

One-liner: a ~50-line Swift static archive that reaches the Swift-only
`AppStore.requestReview(in:)`, compiled + linked by build.rs under the appstore feature
only, behind a Rust command that hops to the main thread, carries the Swift return code
back, and REJECTS whenever the OS was not actually asked — guarded by an in-flight
`AtomicBool` that an RAII `Drop` releases on every exit path.

### What landed

**`src-tauri/src/review/review.swift` (new).** `@_cdecl("tinkerdev_request_app_store_review")`
→ `MainActor.assumeIsolated { presentReview() }` → `AppStore.requestReview(in:)`. Returns 0
when the request was issued, 1 when there is no presentation anchor. A tao `NSWindow` has a
NIL `contentViewController`, so the bridge lazily creates and RETAINS a zero-size hidden
`NSView` + `NSViewController` inside the real `contentView` (never reparenting the webview;
releasing the controller mid-presentation would pull the anchor out from under the sheet).
`vc.view` is assigned BEFORE it is read — a bare `NSViewController` would try to load a nib.
Window pick order is `keyWindow ?? mainWindow ?? first visible`.

**`src-tauri/build.rs` (extended, not duplicated).** The swiftc call lives INSIDE the existing
`appstore && macos` gate, right after the pre-existing `-rpath,/usr/lib/swift` line (which is
what makes the Swift runtime resolve — it was already there for tauri-plugin-iap). It emits
`rerun-if-changed=src/review/review.swift` (tauri_build already emits its own directives, so
the "any package file" default is off and the Swift source needs an explicit one), maps
`CARGO_CFG_TARGET_ARCH` (`aarch64`→`arm64`, `x86_64`→`x86_64`, anything else → `panic!`) onto
`{arch}-apple-macosx{MACOSX_DEPLOYMENT_TARGET|13.0}`, runs
`swiftc -emit-library -static -O -target <triple> -o $OUT_DIR/libtinkerdev_review.a`, asserts
success with swiftc's stderr in the panic message, and emits the four link directives
(`link-search=native=$OUT_DIR`, `static=tinkerdev_review`, `framework=StoreKit`,
`framework=AppKit`). OUT_DIR keeps `cargo clean` authoritative and adds nothing to gitignore.
A removed/changed StoreKit symbol therefore fails `cargo build` LOUDLY — the availability
check is structural, not a soft runtime lookup.

**`src-tauri/src/review/mod.rs` (new).** `request_app_store_review` is `async` **on purpose**:
a SYNC Tauri command runs ON the main thread, so a sync body that both dispatched to the main
thread and waited for the result would deadlock against its own dispatch. The async body hops
via `app.run_on_main_thread(...)` and carries the `i32` back over a capacity-1
`tauri::async_runtime::channel` using `try_send` (never a blocking send from the event-loop
thread — tokio's `blocking_send` panics inside a runtime context, and capacity-1-and-empty
makes `try_send` infallible here). A dropped sender (closure never ran) maps to
`Unavailable`, as does a `run_on_main_thread` failure and a non-zero Swift return; only `0`
is `Ok(())`. `ReviewError` has ONE variant, serialized `{"code":"reviewUnavailable"}` — the
webview's reaction to every failure is identical ("persist nothing, retry at the next
boundary"), so a finer taxonomy would carry no behavior.

`REVIEW_IN_FLIGHT: AtomicBool` is claimed by a `compare_exchange` and released ONLY by
`impl Drop for InFlight`, bound immediately after a successful claim — so the `?`, both match
arms, a panic, and a dropped/cancelled future all release it. The overlap check returns
BEFORE binding the guard, so a losing caller's silent `Ok(())` cannot release the winner's
claim.

**`src-tauri/src/lib.rs`.** `#[cfg(feature = "appstore")] mod review;` beside the gated
`mod iap;`, and `review::request_app_store_review` added to BOTH appstore `generate_handler!`
arms (debug + release) and NEITHER direct arm. No capability entry (app-defined commands need
none), so `capabilities/default.json` and both config overlays are byte-unchanged.

### Tests (4 planned behaviors + 1 added)

| Test | Behavior |
|---|---|
| `concurrent_claims_admit_exactly_one` | 16 barrier-synchronized threads call `try_claim()` without releasing → exactly 1 wins, 15 lose |
| `review_error_serializes_code` | `code() == "reviewUnavailable"` and `{"code":"reviewUnavailable"}` (mirrors the `IapError` contract test) |
| `sequential_claims_both_succeed` | claim → drop the `InFlight` → claim again succeeds: an IN-FLIGHT guard, not a once-ever latch |
| `every_exit_path_releases_the_claim` | drives all four shapes through `with_in_flight_claim` — success `Ok(0)`, non-zero return `Ok(1)`, dispatch failure `Err(..)` each release; the OVERLAP case never presents, returns `Ok(())`, and does NOT release the owner's claim |
| `swift_bridge_symbol_resolves_at_link_time` (**added**) | takes the address of the extern symbol so the linker must resolve it out of `libtinkerdev_review.a` |

The static is process-global while `cargo test` runs on multiple threads, so the three tests
that touch it hold a poison-tolerant `TEST_LOCK` that also resets the static on acquisition.

### Verification

- `cargo test --no-default-features --features appstore review::` — **5 passed**, zero warnings.
- `cargo check --no-default-features --features appstore --target x86_64-apple-darwin` — exit 0,
  zero warnings; `lipo -archs` on the produced archive says `x86_64` (the arm64 build produced
  an `arm64` one), so the per-arch keying works for the universal build.
- `cargo check` (default = **direct**) — exit 0, zero warnings.
- `cargo test` (default = direct) — **87 passed**, and `review::` matches nothing (the module
  does not exist there).
- **Direct-absence proven on the linked binary**, not just by cfg reading: the direct lib-test
  binary has `nm | grep tinkerdev_request` = 0, `strings | grep SKStoreReviewController` = 0,
  `otool -L | grep StoreKit` = 0, no `review::` symbols, and no `libtinkerdev_review.a` exists
  under any direct build-script OUT_DIR (only the appstore ones have it).
- Deprecated API is absent from the COMPILED artifact:
  `strings libtinkerdev_review.a | grep -c SKStoreReviewController` = 0.
- `git diff --quiet HEAD -- src-tauri/Cargo.toml src-tauri/capabilities/
  src-tauri/tauri.appstore.conf.json src-tauri/tauri.direct.conf.json` →
  `CARGOTOML-CAPS-OVERLAYS-UNTOUCHED`.
- `rustfmt` clean on both new/edited files (the repo is not fmt-clean at HEAD — 29 pre-existing
  diffs in `license/`, `iap/`, `lib.rs` — but nothing this task wrote adds to that).
- lefthook pre-commit gate (archive-guard, doc-secrets, typecheck, vitest, lint) passed.

### Deviations from Plan

**1. [Rule 2 — missing critical functionality] Added a 5th test because the plan's link claim was VACUOUS without it.**
The plan's `<done>` asserts the appstore build "links `libtinkerdev_review.a`". It did not.
Measured: after the four planned tests passed, `nm` on the appstore test binary found ZERO
occurrences of `_tinkerdev_request_app_store_review` — the only production reference sits
inside `present_on_main_thread<R: Runtime>`, a generic a test build need not monomorphize, so
nothing produced an undefined symbol and the linker never pulled the archive member. A
missing, renamed, or mis-mangled Swift export would have linked CLEANLY and the whole "the
bridge links" criterion would have been unfalsifiable. `swift_bridge_symbol_resolves_at_link_time`
takes the symbol's address (never calls it — the real call needs the main thread and a live
window) behind `std::hint::black_box`, which forces the link edge; `nm` now finds the symbol
(`T _tinkerdev_request_app_store_review`). `black_box` rather than a null check because
`useless_ptr_null_checks` correctly warns that a fn pointer is never null, and the repo's
Rust build is warning-free.

**2. [Rule 1 — spec contradiction] The plan's `<done>` grep for `SKStoreReviewController` cannot be empty, because the plan's own `<action>` mandates the string.**
The prescribed header comments for BOTH `review.swift` and `mod.rs` name the deprecated API
verbatim to record why it is not used. Kept the comments (a greppable "deliberately NOT used"
note is exactly what a future maintainer needs) and verified the criterion's INTENT instead:
the only two occurrences are `//` / `//!` comment lines, no code line references it
(`grep -rn SKStoreReviewController src-tauri src` → `review.swift:5` and `mod.rs:10`, both
comments), and the compiled Swift archive contains zero references to the class.

**3. [Notation] The command is `async`, and the main-thread result travels over a capacity-1 tokio channel.**
The plan says "do the presentation inside `app.run_on_main_thread(...)`" and "map … a non-zero
Swift return … to `ReviewError::Unavailable`", which together require the return code to come
BACK. `run_on_main_thread` is fire-and-forget (`FnOnce() + Send`, returns `Result<()>`), and a
SYNC Tauri command already runs on the main thread — so a sync command would have deadlocked
waiting for work queued behind itself. Hence `async fn` (Tauri spawns those on the async
runtime) plus `tauri::async_runtime::channel::<i32>(1)`; that re-export is tokio's mpsc, so
NO Cargo.toml change was needed (the repo's own direct `tokio` dep enables only `time`).

**4. [Notation] Testability seam: `with_in_flight_claim` + `present_on_main_thread`.**
The plan asks for a test that drives the success, dispatch-failure and non-zero-return paths,
which is impossible against a live `AppHandle` in a unit test. The command body is now one
line delegating to `with_in_flight_claim(|| present_on_main_thread(app))`, a generic over the
presenting future — so all four exit shapes are driven directly, and the claim/release logic
under test is literally the code the command runs (not a copy).

### Notes for Task 4

- The Rust/Swift half of the direct-absence proof is ALREADY mechanically established (see
  Verification above): no review symbols, no StoreKit linkage, no Swift archive in a direct
  build. Task 4's `strings`-on-the-binary step can reuse those exact probes; note that
  `strings` alone is weak here — the load-bearing checks were `nm` (symbol absent) and
  `otool -L` (framework not linked).
- `capabilities/default.json` and both `tauri.*.conf.json` overlays are untouched and MUST
  stay so — app-defined commands need no ACL entry, and a non-empty
  `app.security.capabilities` would REPLACE the capabilities-dir glob.
- The webview contract is unchanged and honored: `invoke<void>("request_app_store_review")`,
  no arguments, `Promise<void>`; a rejection is `{"code":"reviewUnavailable"}` and means the
  OS was NOT asked (so `reviewPrompt.runOnce` correctly persists nothing and retries).
- The appstore build now REQUIRES `swiftc` on PATH (it already did, via tauri-plugin-iap) and
  `MACOSX_DEPLOYMENT_TARGET` (defaults to 13.0 when unset). `scripts/build-appstore-*.sh`
  already export it.
- Task 5's native capture is the only place the Swift path actually EXECUTES — no unit or e2e
  layer can call `AppStore.requestReview(in:)`. Expect the OS to legitimately show nothing;
  the observable signal is the command resolving (and `lastReviewRequestAt` landing in
  prefs.json), not a visible sheet.

### Harness status (Task 3)

Rust unit gate is GREEN (5 appstore tests + the 87 direct tests, both channels warning-free)
and both channel `cargo check`s pass. Task 3 touches NO TypeScript and NO markup, so vitest/
tsc/eslint are unchanged (they ran green in the lefthook gate anyway). The remaining per-task
DoD steps — `/simplify`, `/code-review xhigh`, `/codex:adversarial-review`, and the real-webview
/ native-window verification — are the orchestrator's to run; the native half necessarily
folds into Task 5, since the Swift bridge only executes inside a running appstore `.app`.

---

## Task 4 — Mechanical direct-build absence proof (guard, sentinel, selftest, e2e) and docs

**Commits:**
- `7996a43b` — `feat(quick-260808-up5): direct-build review-prompt absence guard, sentinel, selftest + real-webview e2e`
- `27f2ab8b` — `docs(quick-260808-up5): CHANNELS.md review-prompt row + close the origin todo`

One-liner: the direct channel's absence is now enforced by a build-time chunk-module
guard that a three-case REAL-build selftest proves non-vacuous, and observed at
runtime on the real WKWebView after three genuinely settled decodes — with the
plan's own runtime probe replaced after measurement showed it could only ever
pass vacuously.

### What landed

**`scripts/reviewPromptFoldInGuard.mjs` (new).** The INVERSION of
`licenseUiFoldInGuard`: same `generateBundle` + `chunk.modules` + `emitFile` +
`throw` idiom, opposite channel. `REVIEW_PROMPT_MODULES =
[/src\/shell\/reviewPrompt\.[tj]sx?$/]` is the single source of truth for the
matcher; the guard walks EVERY chunk (not just the entry), always emits
`reviewprompt-inventory.json` with `{ reviewPromptInChunks, hits }` — a missing
sentinel is itself a failure signal — then throws on any hit. The header records the
two DELIBERATE exclusions and why asserting them would be unsatisfiable:
`src/shell/useToolSuccess.ts` ships in both channels by design (its direct arm is an
empty function), and the `invoke("request_app_store_review")` literal inside the
SHARED `src/lib/platform/tauri.ts` rides along exactly as plugin-updater /
plugin-autostart do under D-05. It then names the four load-bearing proofs
(chunk inventory, Rust `#[cfg]` + build.rs Swift gate on the built binary, jsdom
no-invoke, real-WKWebView no-effect) so a future reader cannot mistake the guard
for the whole proof.

**`vite.config.ts`.** `...(isAppstoreBuild ? [licenseUiFoldInGuard()] :
[reviewPromptFoldInGuard()])` — one fold-in guard per channel, mutually exclusive,
with a comment stating the mirror-image relationship (the previous "the direct
build's plugin list is byte-unchanged" claim in the neighbouring comment is no
longer true and would have misled).

**`scripts/reviewPromptFoldInGuard.selftest.mjs` (new).** Three REAL Vite builds
against fixtures that place the stand-in module at `<case>/src/shell/reviewPrompt.js`
so the resolved Rollup id ends in the exact path the PRODUCTION regex anchors on —
the selftest exercises the production matcher, it does not approximate it. Case (b)
reproduces the actual shipping shape (a module-scope ternary on a `false` build
constant with the dynamic import in the dead arm), so it proves the guard does not
false-RED the pattern `useToolSuccess.ts` uses.

**`test/e2e/review-prompt.e2e.ts` (new).** Three output-distinct payloads
(`089601` → #1 varint 150; `08c801` → #1 varint 200; `120568656c6c6f` → #2 LEN
"hello"), each waited for `[data-fnum]`, each asserted free of `[role=alert]`, each
held unchanged for 3500 ms (past `SETTLE_MS`), then screenshotted. Four `it` blocks:
the drive, the prefs assertion, the invoke-recorder assertion, and the module-fetch
assertion.

**`docs/CHANNELS.md`.** The new matrix row (both channel columns + the enforcing
artefacts), a note that the two fold-in guards are mirror images so their direction
is not misread, a note that the appstore channel now compiles TWO Swift units (so a
Swift toolchain stays an appstore-build prerequisite), and a refreshed verified-on
date. Nothing else restructured.

**Origin todo closed.** `2026-08-07-app-store-review-upsell-after-3-actions.md` moved
to `.planning/todos/completed/` with a `## Resolved by quick task 260808-up5` section
naming what shipped against each bullet the todo asked for.

### Verification (observed values, not claims)

| Probe | Observed |
|---|---|
| `node scripts/reviewPromptFoldInGuard.selftest.mjs` | **3/3**, exit 0 — "static fold-in FAILS", "dead-arm dynamic import PASSES with sentinel {reviewPromptInChunks:false, hits:[]}", "hoisted NON-ENTRY chunk FAILS" |
| `VITE_CHANNEL=direct vite build` (guard live on the real tree) | `dist/reviewprompt-inventory.json` = `{"reviewPromptInChunks": false, "hits": []}` |
| `pnpm tauri:build:direct` | `TinkerDev.app` + `TinkerDev_1.0.2_aarch64.dmg` bundled; final exit 1 is ONLY `TAURI_SIGNING_PRIVATE_KEY` absent (confirmed at the artefacts, not the exit code) |
| `strings <direct binary> \| grep -c request_app_store_review` | **0** |
| `strings <direct binary> \| grep -c tinkerdev_request_app_store_review` | **0** |
| `otool -L <direct binary> \| grep -c StoreKit` | **0** |
| `grep -rl 'recordSettledSuccess\|MIN_REQUEST_GAP_MS' dist/` | **0 files** |
| `bash scripts/e2e-spike.sh` (FULL suite) | **27/27 spec files passed**, exit 0 — no pre-existing spec regressed |
| new spec `review-prompt.e2e.ts` | **4/4 passing** (11.8 s) |
| persisted prefs after 3 settled decodes | `toolSuccessCount=0`, `lastReviewRequestAt=null`, `lastUsedId="protobuf-decoder"` |
| module-fetch probe | 98 `/src/` module fetches recorded, **0** matching `reviewPrompt` |
| invoke recorder | install status **`locked`**, 0 commands observed (see Deviation 1) |
| `pnpm exec tsc --noEmit` / `pnpm lint` / `pnpm vitest run` | clean / 0 errors (4 pre-existing warnings) / **1468 passed, 117 files** |
| lefthook pre-commit gate | passed on BOTH commits (archive-guard, doc-secrets, typecheck, test, lint) |

Screenshot evidence read back: `test/e2e/__screenshots__/review-prompt-direct-settled.png`
shows the third payload settled and rendered (`#2 LEN string "hello"`, status `OK 7 bytes`)
with no review sheet and no new UI anywhere.

### Deviations from Plan

**1. [Rule 1 — the plan's own runtime probe was VACUOUS; replaced with a self-validating one]**
The plan's e2e Test 3 says to "install an `__TAURI_INTERNALS__.invoke` wrapper that
records every command name" and assert no name matches `/review/i`. On this runtime
that wrapper CANNOT be installed: Tauri's injected core script defines `invoke` with
`Object.defineProperty` and no `writable`/`configurable` flags, so a reassignment is a
silent no-op — the finding already documented at length in `license-buy.e2e.ts`'s
header, where a recorder reported `installed:true` and then observed ZERO commands, not
even mount-time `license_status`. A recorder that can never see ANY command reports
"no review command" for a build that invoked it on every keystroke, so the plan's
assertion would have been a **guaranteed false GREEN**. Implemented instead: install the
wrapper, then PROVE it live by routing a KNOWN command (the `plugin:store|*` reads behind
`readPrefsBlob`) through it; assert the no-review contract only when that liveness probe
passes, and log the outcome either way. **Measured this run: status `locked`, 0 commands
observed** — i.e. the plan's version would indeed have passed vacuously. The spec logs
that honestly and does not assert it.

**2. [Rule 2 — missing non-vacuity guard] The prefs assertion now proves the write path is ALIVE first.**
"`toolSuccessCount` is 0" is equally true of a session in which prefs never persisted at
all, which would make the plan's Test 2 unfalsifiable. The spec now drives two real tool
switches (`base64` → `protobuf-decoder`) and waits for each to land as `lastUsedId` in the
SAME on-disk blob before asserting the counter — so the observed
`toolSuccessCount=0, lastReviewRequestAt=null, lastUsedId="protobuf-decoder"` means "the
blob was written twice during this run and the counter still did not move". Asserted via
the blob rather than tool-specific selectors, so it stays decoupled from the Base64 tool's
markup.

**3. [Rule 2 — replacement runtime evidence for the signal Deviation 1 removed] Added a module-fetch probe.**
With the invoke recorder inert, the spec adds a runtime NO-LOAD proof that does work here:
in `tauri dev` Vite serves unbundled ES modules, so an executed dynamic import leaves a
resource-timing entry. The probe asserts no entry matches `reviewPrompt` — and only after
confirming resource timing is capturing `/src/` module fetches at all (98 recorded this
run), so an overflowed/cleared buffer degrades to a logged skip rather than a vacuous pass.
This is the runtime complement to the build-time guard: the module is neither bundled nor
ever fetched.

**4. [Notation] `scripts/verify-appstore-bundle.sh` deliberately NOT touched — no I-row applies.**
That script is the **appstore** verifier; the new guard runs on the **direct** build and
its sentinel is emitted into the direct `dist/` only, which no appstore invariant can
observe. Adding an I-row would be exactly the lie its own index header warns against
("adding a check here without implementing it is a lie"). The plan's Task-4 action list
does not ask for one; Task 5 only re-runs the verifier to confirm nothing regressed.
`capabilities/` and both config overlays likewise stay byte-unchanged.

**5. [Notation] The todo's file RENAME rode along in the feat commit; its Resolved content is in the docs commit.**
`git mv` had staged the rename before the feat commit was made, and `git commit` commits
the whole index. Net tree state is identical to the plan's intent (the todo is in
`completed/` with its Resolved section); only the split point between the two commits
differs.

**6. [Notation] The two new `.mjs` files are left un-Prettier-formatted, matching their siblings.**
`prettier --check` also flags the existing `scripts/licenseUiFoldInGuard.mjs` and
`scripts/prettierChunkGuard.selftest.mjs`; no gate (lefthook or otherwise) enforces
formatting on `scripts/`. Formatting only the new files would have made them inconsistent
with the very files they mirror.

### Notes for Task 5

- **Nothing in Task 4 has been re-verified after a Task-5 fix.** The direct `.app` under
  `src-tauri/target/direct/release/bundle/macos/` was built at commit `dd81008d` + the
  working tree, i.e. BEFORE commits `7996a43b`/`27f2ab8b` landed — those commits touch no
  shipped source (guard, selftest, e2e spec, docs), so the bundle's CONTENT is unaffected,
  but the harness rule still stands: **rebuild BOTH channels LAST**, after every
  `/simplify` / `/code-review` / `/codex` fix, and check each bundle binary's mtime against
  the last source commit before any walkthrough.
- The direct-binary probes Task 5 step 4 asks for have already been run once and are all
  at their required values (table above); re-run them on the FRESH build. Note `strings`
  alone is weak — `nm` (symbol absent) and `otool -L` (framework not linked) are the
  load-bearing ones, per Task 3's note.
- The e2e gate leaves an orphan `devtools-app` + `vite` pair behind on this machine after
  `scripts/e2e-spike.sh` finishes (observed again this run; both reaped manually). Reap
  before AND after any Task-5 e2e re-run or the next launch will hit the single-instance
  block.
- `E2E_SPECS=./test/e2e/review-prompt.e2e.ts` narrows the run to this spec for a quick
  re-check (positional spec args are ignored by `e2e-spike.sh`).
- The appstore half of this feature has still never EXECUTED anywhere. Task 5 step 6 is the
  first and only place `AppStore.requestReview(in:)` runs; a counter of 3 with a still-null
  `lastReviewRequestAt` is a FINDING (the native path failed), not a pass.
- The appstore build emits no `reviewprompt-inventory.json` (the guard is direct-only) —
  that is correct, not a missing artefact.

---

## Review remediation (2026-08-09) — commits `f5b893d9`..`c9abc713`

Findings from `/code-review xhigh` + `/codex:adversarial-review` over
`745acf6d..27f2ab8b`, applied in five logical commits. Nothing pushed.

### Structural root cause: the identity was keyed on the OUTPUT

Nine findings (xF2–xF5, sF15–sF18, sF23) were one design error. The settled-success
identity digested each tool's RENDERED OUTPUT, so every way of LOOKING at one
result manufactured another counted success — a Protobuf LEN-chip click, a
formatter indent/width/semi/sort-keys toggle, a regex flag flip — and it forced ten
call sites to build a serialization purely to feed the seam (the hero tool grew an
EAGER `fieldsToJson` of the whole tree on its paste path).

The contract is now `useToolSuccess(toolId, ok, identityInput)`, where
`identityInput` is the SOURCE the user submitted. Consequences, all landed:

| Site | Identity now | Note |
|---|---|---|
| ProtobufDecoder | `raw` | eager `fieldsToJson` memo REVERTED to copy-time-only; `fields` memo + `\0` escape kept |
| FormatterView (×4 tools) | `input` | option toggles no longer count |
| RegexTool | memoized `pattern + "\n" + text` | per-render all-matches join deleted |
| UuidUlidTool | 2 calls: freshly generated ids / `decodeRaw` | sticky `generated` latch KILLED |
| UrlTool | `mode + that mode's input`, ONE call at tool level | null-rendering `UrlSuccess` wrapper deleted (its remount reset the dedup ref) |
| HashTool | `raw`, `ok` requires ALL digest rows resolved | `.catch` on the `Promise.all` renders an error state |
| Base64/Jwt/UnixTime/Cron | `hex` / `raw` / `raw` / `expr` | no per-render allocation at any site |

Seam internals: the redundant `latest` ref is gone (the effect closure already
holds the current values), the digest is still computed ONLY at settle, and
`__hashCallCountForTest` is behind the shared `isTestOrDev`.

### Per-finding outcome

| Finding | Outcome | Where |
|---|---|---|
| xF1 appstore Rust tests unwired | FIXED | `pnpm cargo:test:appstore` in lefthook pre-push, own `CARGO_TARGET_DIR` |
| xF2–xF5, sF15–sF18, sF23 output-keyed identity | FIXED | see table above (`f5b893d9`) |
| xF6 overlap returned `Ok` without asking | FIXED | overlap now `Err(ReviewError::Unavailable)`; webview comment + Rust test updated |
| xF7 HashTool "ok" with blank rows | FIXED | `allDigestsResolved` gate + `.catch` → StatusBar error |
| xF8 unhandled dynamic-import rejection | FIXED | `.catch` (silent skip + one dev-only `console.warn`) |
| xF9 sentinel + selftests unasserted | FIXED | release preflight asserts the sentinel; `pnpm guard:selftest` in pre-push |
| xF10 e2e waited on a non-distinct marker | FIXED | waits for `"150"/"200"/"hello"` in a `.val` node |
| xF11 resource-timing buffer could be full | FIXED | `setResourceTimingBufferSize(10000)` + `clearResourceTimings()` before the decodes |
| xF12 forward clock skew bricks the prompt | FIXED | stamp > `now + 1 day` treated as invalid (Tests 17/17b, injected clock) |
| xF13 native call could park the queue | FIXED | 30 s timeout race (Test 18, never-settling stub) |
| xF14 + sA24 Swift anchor not window-keyed | FIXED | `(weak window, controller)` pair, rebuilt when the resolved window differs; stale view detached |
| xF15 prefs write churn | FIXED | `updatePreferences(patch, {persist:"deferred"})` + `flushPreferences()` on pagehide/window-hide |
| sR1+sR2 duplicated guard + selftest bodies | FIXED | `scripts/lib/chunkModuleGuard.mjs`, `scripts/lib/guardSelftest.mjs` (3 guards + 2 selftests consume) |
| sR3 `isTestOrDev` ×3 | FIXED (went further: 5 → 1) | `src/lib/env.ts` |
| sR4 Rust code-error impl ×3 | FIXED | `impl_code_error_serialize!` in `src-tauri/src/code_error.rs` |
| sS7 redundant `latest` ref | FIXED | removed |
| sS8 no-op `whenPreferencesLoaded` awaits | FIXED | 2 dropped, the load-bearing re-READS kept |
| sS9 `__hashCallCountForTest` ungated | FIXED | behind `isTestOrDev`; returns −1 in release |
| sS10 oversized coercer docblock | FIXED | trimmed to the sibling idiom |
| sS11+sS12 duplicated rationale/comments | FIXED | channel-gate rationale stated ONCE in `reviewPrompt.ts`; the 10 identical call-site comments dropped |
| sS14 `InFlight` surface | FIXED | `try_claim() -> Option<InFlight>`; no free `release_claim` |
| s#6 `platform.test.ts` stubs | FIXED | uses `noopReview` (4 copies → 1) |
| s#21 e2e `SETTLE_MS` sleeps | FIXED | dev-only `__setSettleMsForTest` seam; spec 11.8 s → 2.7 s |

**Nothing was judged factually wrong.** One item was scoped differently than
written: sR1 asks all three guards to consume `makeChunkModuleGuard`, and they do —
but `prettierChunkGuard`'s different violation predicate (initial-reachability, not
membership) is expressed as the factory's `scopeChunks` hook plus an `extraSentinel`
contributor rather than as the same code path. Behaviour is byte-identical, proven
by its own 5/5 self-test and by the emitted sentinel shapes.

### A real bug the remediation itself introduced and caught

Tightening `try_claim()` to return the RAII guard, the first version used
`bool::then_some(InFlight)`. `then_some` takes its argument BY VALUE, so an
`InFlight` was constructed on the LOSING branch too and immediately dropped —
releasing the WINNER's claim. The barrier test measured 4 of 16 threads "winning".
Fixed to `.then(|| InFlight)`, with the trap recorded in-file.

### Verification (observed, this remediation)

| Gate | Result |
|---|---|
| `pnpm vitest run` | **1479 passed / 117 files** (was 1468; +11) |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm lint` | 0 errors (the same 4 pre-existing warnings in `SidebarResetMenu.tsx` / `settingsPanes.tsx`) |
| `cargo test` (direct, default features) | **87 passed**, zero warnings |
| `cargo test --no-default-features --features appstore` | **19 passed** (incl. the 5 `review::`), zero warnings |
| `pnpm cargo:test:appstore` wall time | **36 s cold / 2.5 s warm** — kept as a pre-push gate |
| `pnpm guard:selftest` | **3/3 + 5/5**, 0.97 s |
| `verify-appstore-bundle.sh --selftest-realbuild` | **4/4** (licenseUi guard behaviour unchanged by the refactor) |
| `bash scripts/e2e-spike.sh` (FULL) | **27/27 spec files**, exit 0, 50 s; orphans reaped before + after |
| `review-prompt.e2e.ts` alone | 4/4 in **2.7 s** (was 11.8 s); `SETTLE_MS overridden to 250 ms via the dev seam` |
| e2e persisted blob | `toolSuccessCount=0, lastReviewRequestAt=null, lastUsedId="protobuf-decoder"` |
| e2e module-fetch probe | 2 `/src/` fetches recorded AFTER the buffer clear, **0** matching `reviewPrompt` |
| `VITE_CHANNEL=direct vite build` | `reviewprompt-inventory.json` = `{reviewPromptInChunks:false, hits:[]}`; 0 files matching `recordSettledSuccess\|MIN_REQUEST_GAP_MS\|FUTURE_STAMP_SLACK`; no `reviewPrompt` chunk |
| `VITE_CHANNEL=appstore vite build` | `assets/reviewPrompt-*.js` emitted as its own lazy chunk; `licenseui-inventory.json` + `prettier-chunk-inventory.json` unchanged in shape |
| lefthook pre-commit | passed on all five commits |

Screenshot re-read: `review-prompt-direct-settled.png` shows the third settled
decode (`#2 LEN string "hello"`, `OK 7 bytes`) with no review sheet and no new UI.

### Still outstanding (unchanged by this remediation)

- The **appstore half has still never EXECUTED**. `AppStore.requestReview(in:)`
  only runs inside a built appstore `.app` — Task 5's native capture remains the
  first and only place it does. A counter of 3 with a still-null
  `lastReviewRequestAt` there is a FINDING, not a pass.
- Both channel `.app` bundles must be REBUILT after these commits before any
  walkthrough (the harness rebuild-last rule); the bundles on disk predate them.

---

## Task 5 — Durability round + the first REAL execution of the appstore half

**Commits:**
- `f2405419` — `fix(quick-260808-up5): keep prefs writes flushable until the save RESOLVES`
- `852550ea` — `fix(quick-260808-up5): stamp the review request DURABLY before resolving`
- `d91ffac8` — `docs(quick-260808-up5): record the identity dedupe as a DELIBERATE choice`
- `e6dd1d18` — `test(quick-260808-up5): appstore-channel execution proof on the real WKWebView`

One-liner: the review stamp is now awaited to durability behind a serialized,
retry-preserving prefs write path — and the appstore half finally EXECUTED, both
in an appstore-channel dev run and in the signed, sandboxed, packaged `.app`,
where three settled decodes stamped `lastReviewRequestAt` and the 7-day floor
then held across two further boundaries.

### FIX 1 (high) — the stamp is awaited to durability

`reviewPrompt.runOnce` wrote `lastReviewRequestAt` fire-and-forget straight after
StoreKit had been asked. A quit — or a store rejection — in the next few ms lost
it, and the app would re-ask at the very next 3rd-success boundary: the 7-day
floor silently meant nothing.

- New `updatePreferencesDurable(patch): Promise<boolean>` in `usePreferences.ts`.
  It applies the merge SYNCHRONOUSLY (so every in-session gate keeps exact
  semantics even when the disk write fails) and resolves only once the blob has
  reached the store. It NEVER rejects, so an `await` on it cannot poison the
  serialization queue.
- The stamp write is `await withTimeout(updatePreferencesDurable(…), REQUEST_TIMEOUT_MS)`.
  The timeout is load-bearing for the same reason the native call has one: this
  await sits ON the queue, and a store write that never settles would stop every
  later settled success from being counted. A failure logs (dev only) and leaves
  the blob flushable; `recordSettledSuccess()` now resolves only after the stamp
  is durably persisted (or definitively failed/timed out).
- Tests: **Test 19** (the call must NOT resolve while the stamp write is in
  flight; the in-memory stamp is live but nothing is on "disk" yet) and **Test 20**
  (a REJECTED stamp write neither wedges the queue nor loses the write — later
  successes keep counting and a flush retries it once the store recovers).
  Test 19 was verified RED against the fire-and-forget version before landing.

### FIX 2 (medium) — a pending write survives a failed/torn-down save

`flushPreferences` cleared `deferredSavePending` BEFORE the async save resolved,
so a rejected write (or a webview torn down mid-save) dropped the outstanding
change with no retry and no signal.

- The flag (renamed `unsavedChanges` — its meaning is now "in-memory is ahead of
  disk") is cleared ONLY when a save RESOLVES successfully, and only if nothing
  changed the blob after the snapshot that save wrote (a monotonic `prefsVersion`
  guards that, so a write landing mid-save is not mistaken for persisted).
- All writers now share one `persistShared()` behind a save CHAIN, which also
  fixes an ordering hazard nobody had noticed: two overlapping `store.set`s could
  resolve out of order and leave an OLDER blob on disk.
- `flushPreferences()` returns the save outcome; the pagehide/visibilitychange
  listeners ignore it.
- **Accepted by design, now documented in-file:** a HARD kill (SIGKILL, crash) can
  still lose ≤2 sub-boundary `toolSuccessCount` increments — no webview API can
  make an async write survive that. Cost: one boundary arrives a little late.
  Boundary counts persist immediately, so a lost count can never make the app ask
  EARLY. Observed live: `pkill` (SIGTERM) on the packaged app did NOT deliver a
  pagehide, and the pending sub-boundary count was indeed lost — the documented
  behaviour, not a regression.
- Tests: rejected-save retry for BOTH a deferred and an immediate write, durable
  resolve ordering + failure reporting, and save ordering under overlap. The
  flush-retry test was verified RED against the clear-up-front version.

### The DECISION, documented (no behaviour change)

The identity dedupe — the same `(tool, input)` re-settling does NOT count again
until the input changes or the component remounts — is DELIBERATE. The metric is
**unique successful inputs**, not keystroke episodes. Recorded as a comment at the
dedupe in `useToolSuccess.ts` and here: under-asking is the safe direction, since
Apple 5.6.1 forbids nagging and the OS caps real prompts at 3 per 365 days
regardless — a missed ask costs nothing, while an extra one spends a scarce,
non-renewable prompt on a user who did no new work.

### Deviation — [Rule 1, bug] Two latent read-after-write races, surfaced and fixed

The save chain adds one microtask before `savePreferences` is called, and that
immediately turned the `CommandPalette` Pro⇄Free test RED. Root cause was NOT the
chain: the DEV palette tier toggle (and `clearEntitlementsOverride`) write the
override fire-and-forget and then call `refreshEntitlements()`, which re-resolves
from the **persisted** blob (`resolve.ts` → `loadPreferences`). The write racing
its own reader only ever passed by accident of microtask ordering; a slower store
would re-apply the OLD tier and leave the toggle visibly dead. Both call sites now
`await updatePreferencesDurable(...)`. The pre-existing test is what proves it (it
fails without the fix). `clearEntitlementsOverride`'s docstring already promised
this ordering — it just was not true.

### Task 5 gates (all re-run AFTER the fixes landed)

| Gate | Result |
|---|---|
| `pnpm vitest run` | **1485 passed / 117 files** (was 1479; +6) |
| `pnpm exec tsc --noEmit` | clean |
| `pnpm lint` | 0 errors (the same 4 pre-existing warnings) |
| `cargo test` (direct, default features) | **87 passed**, zero warnings |
| `pnpm cargo:test:appstore` (`--no-default-features --features appstore`) | **5 `review::` passed** |
| `pnpm guard:selftest` | **3/3 + 5/5** |
| `bash scripts/e2e-spike.sh` (FULL, direct overlay) | **28/28 spec files**, exit 0; orphans reaped before + after |
| `scripts/verify-appstore-bundle.sh --require-bundle` (standalone, post-build) | **13 OK / 0 FAIL**, exit 0 |
| lefthook pre-commit | passed on all four commits |

### Built apps (fresh — rebuilt LAST, after every source commit)

| Channel | Path | Binary mtime vs last commit |
|---|---|---|
| direct | `src-tauri/target/direct/release/bundle/macos/TinkerDev.app` (+ `.../dmg/TinkerDev_1.0.2_aarch64.dmg`) | 1786307855 > 1786307797 — FRESH |
| appstore (dev-signed, sandboxed) | `src-tauri/target/appstore/universal-apple-darwin/release/bundle/macos/TinkerDev.app` | 1786307923 > 1786307797 — FRESH |

The direct build's final exit 1 is ONLY the absent `TAURI_SIGNING_PRIVATE_KEY`
(artefacts confirmed on disk). `scripts/build.sh direct` cannot be used here — its
publish preflight aborts on "v1.0.2 already published"; `pnpm tauri:build:direct`
is the build-only route.

### The appstore half EXECUTED — first time ever

`AppStore.requestReview(in:)` had never run. It has now, twice over.

**(a) Appstore-channel dev run under WebDriver** (`VITE_CHANNEL=appstore pnpm tauri dev
-f appstore,webdriver --config src-tauri/tauri.appstore.conf.json -- --no-default-features`),
driving the new `test/e2e/review-prompt-appstore.e2e.ts` — **3/3 passing**:

```
settle override=true (pause 450 ms), document.hasFocus()=true
after 3 settled successes: toolSuccessCount=3, lastReviewRequestAt=1786306937051
NATIVE PATH EXECUTED: request_app_store_review resolved Ok and the stamp was persisted DURABLY
identity dedupe holds: two more settles of the SAME payload left the counter at 3
7-day gap honoured: counter 6, stamp unchanged at 1786306937051 (no second request)
```

**(b) The PACKAGED, signed, SANDBOXED appstore `.app`** — driven natively (no
WebDriver exists in a release build): Accessibility to front/activate the window,
a purpose-built CGEvent clicker to focus the textarea, and clipboard + ⌘V for each
payload (AppleScript `keystroke` of letters is mangled by the active IME — `c`
came out as `吃`, so every letter-bearing hex payload must be PASTED, not typed).
Observed in the sandbox container
(`~/Library/Containers/com.tinkerdev.app/Data/Library/Application Support/com.tinkerdev.app/prefs.json`):

| Step (real 3 s settles) | Observed on disk |
|---|---|
| 3 distinct decodes (`089601`→150, `08c801`→200, `120568656c6c6f`→"hello") | `toolSuccessCount=3`, `lastReviewRequestAt=1786307272060` (2026-08-09T21:27:52) |
| 2 IDENTICAL re-pastes | count **unchanged at 3** — the deliberate dedupe |
| 3 more distinct decodes | count reaches 6, **stamp unchanged** |
| 3 more distinct decodes | count reaches 9 (boundary persists immediately), **stamp still unchanged** |

The stamp is the load-bearing observable: it is written only after the Rust
command resolves `Ok`, which happens only when the Swift bridge returned 0 = "the
request was ISSUED to StoreKit". So the full chain executed inside the shipped
binary: seam → appstore-only dynamic import → reviewPrompt → invoke →
`run_on_main_thread` → Swift → StoreKit.

**Did the sheet appear? NO.** The window capture at the boundary shows the decode
(`#2 LEN string "hello"`, `OK 7 bytes`) and NO review sheet. That is the expected,
documented outcome: a StoreKit review sheet is window-modal (it would have been
inside the captured window rect), and the OS legitimately presents nothing for a
locally dev-signed build with no App Store receipt — it also caps real prompts at
3 per 365 days. "The OS was asked" is what we control and what we proved.

**Direct packaged `.app`, same treatment:** three genuinely settled successful
decodes (`089601`→150, `08c801`→200, `120568656c6c6f`, `08ac02`→300 — each
rendered and screenshotted) left `toolSuccessCount=0` and
`lastReviewRequestAt=null`. Non-vacuous: `autoUpdateCheck=false` (the first-run
prompt dismissal) was written through the SAME blob in that same session, so the
persistence path is demonstrably alive while the counter never moves. Binary
probes on the fresh direct build: `strings request_app_store_review`=0,
`otool -L | grep StoreKit`=0, `nm tinkerdev_request_app_store_review`=0; direct
`dist/` sentinel `{reviewPromptInChunks:false,hits:[]}` and 0 files matching the
review symbols.

### Environment finding (why the harness needed new tricks)

The machine's screen was LOCKED for this whole round
(`CGSSessionScreenIsLocked=true`). Consequences worth recording for the next
native-capture task:

- `scripts/ui-capture.sh` still works, and `System Events … set frontmost` still
  works — but a `.app` launched with `open` while locked can take a while to get a
  window into the AX tree (the first attempt failed with `-1719`).
- `document.hasFocus()` is FALSE for a WebDriver-driven window until something
  activates the process — and reviewPrompt's frontmost gate then (correctly) skips
  the request. The first appstore e2e run proved only the counter for exactly this
  reason; `ensureFrontmost()` (Accessibility activate from the spec) is what made
  the native path reachable. The spec reports the focus state either way, so it
  can never pass vacuously.
- `System Events`' `click at` is a no-op on this macOS, and neither `cliclick` nor
  pyobjc/Quartz is installed — a ~20-line Swift CGEvent clicker (`swiftc -o
  /tmp/uiclick`) was the working path for focusing a webview element natively.

### Left for the human

1. **Launch + walk through** both fresh apps (paths above). Nothing is blocked on
   this — it is the standard phase-boundary sign-off.
2. **A real Sandbox/production review sheet.** The only thing that cannot be
   agent-verified: whether macOS actually PRESENTS the sheet for a
   TestFlight/App-Store-installed build. Our side is proven up to "the OS was
   asked"; the presentation decision is Apple's and is deliberately opaque.
3. Note the review-request cadence is per-install: the packaged appstore app's
   container now holds `toolSuccessCount=9` and a stamp of 2026-08-09T21:27:52, so
   the next request there is gated until 2026-08-16. Delete the container's
   `prefs.json` (or reset those two fields) before any fresh-eyes walkthrough.
