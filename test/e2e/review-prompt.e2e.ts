// App Store review prompt — DIRECT-channel ABSENCE proof on the real macOS
// WKWebView (quick task 260808-up5, UP5-03; threat T-UP5-04).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). Run by
// scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts `specs:
// ["./test/e2e/*.e2e.ts"]`.
//
// WHY THIS SPEC CAN ONLY PROVE THE DIRECT HALF. The real-WKWebView gate runs on
// the DIRECT overlay — `pnpm tauri:dev:e2e` = `VITE_CHANNEL=direct tauri dev
// --features webdriver --config src-tauri/tauri.direct.conf.json` (docs/CHANNELS.md
// call-out 3). So there is no appstore runtime here to observe, and the appstore
// half of the feature is proven elsewhere:
//   - the counting/cadence core, the 3rd-success boundary, the 7-day gap and the
//     stamp-after-success ordering: src/shell/reviewPrompt.test.ts (channel-mocked,
//     injected clock);
//   - the settle seam + the appstore dynamic-import arm: src/shell/useToolSuccess.test.tsx;
//   - the native command, its process-level in-flight guard and the Swift link
//     edge: the `review::` Rust tests under `--features appstore`;
//   - the only place StoreKit ACTUALLY executes: the Task-5 native capture of the
//     built appstore .app.
//
// What THIS spec proves that none of those can: after three REAL, output-distinct,
// fully SETTLED successful decodes on the real webview, the shipped direct app
// counts nothing and stamps nothing. That is the runtime counterpart of the
// build-time chunk-module guard (scripts/reviewPromptFoldInGuard.mjs) — the
// `keygen-compileout-d04-proof` lesson: a bundle-absence check and a RUNTIME
// no-effect check prove different things, and the runtime one is the load-bearing
// half.
//
// NON-VACUITY IS THE WHOLE DIFFICULTY HERE — "nothing happened" is the trivially
// passing assertion. Three separate guards make it earn its green:
//   1. the decodes are proven REAL (each waits for [data-fnum] to render, each
//      output is DISTINCT, each sits unchanged past SETTLE_MS, and the third is
//      screenshotted);
//   2. the prefs WRITE PATH is proven ALIVE in this same session against the same
//      blob (a tool switch persists `lastUsedId` while the counter stays 0) — so
//      "counter is 0" cannot be explained away by "prefs never persisted";
//   3. the module-load probe is only asserted when resource timing is shown to be
//      capturing Vite module fetches at all.
//
// The plan's fourth probe — a `__TAURI_INTERNALS__.invoke` wrapper recording every
// command name — is attempted but SELF-VALIDATED before it is trusted, because on
// this runtime it is very likely INERT: Tauri's injected core script installs
// `invoke` with Object.defineProperty and no writable/configurable flags, so a
// runtime reassignment is a silent no-op (the finding recorded at length in
// license-buy.e2e.ts's header, where a recorder reported installed:true and then
// observed ZERO commands — not even mount-time license_status). A recorder that
// can never see ANY command would report "no review command" for a build that
// invoked it on every keystroke. So this spec installs it, then PROVES it live by
// routing a KNOWN command (the plugin:store read behind readPrefsBlob) through it;
// the no-review assertion is made only when that liveness probe passes, and the
// outcome either way is logged so the run's evidence is honest.

import { assert, navigateToTool, readPrefsBlob, saveScreenshot } from "./helpers";

// Must match SETTLE_MS in src/shell/useToolSuccess.ts (3000 ms) with headroom —
// the seam only counts an output that has sat UNCHANGED for a full quiet window.
const SETTLE_PAUSE_MS = 3500;

// Three payloads whose DECODED OUTPUT differs — not merely their byte counts.
// That matters because the Task-2 success identity is a FULL-OUTPUT digest: three
// same-length-but-different payloads would still be three distinct episodes, and
// three identical ones would be a single episode. Using genuinely distinct
// decodes means an appstore build running this exact flow WOULD reach the count-3
// boundary, so the direct build's zero is a real difference, not an artefact of
// the inputs.
//   089601         -> field #1, varint 150
//   08c801         -> field #1, varint 200   (same shape, different value)
//   120568656c6c6f -> field #2, LEN "hello"  (different field AND different type)
const PAYLOADS = ["089601", "08c801", "120568656c6c6f"];

interface RecorderState {
  status: "live" | "locked" | "no-internals";
  commands: string[];
}

// Install a command-name recorder over __TAURI_INTERNALS__.invoke. Returns the
// install status; "locked" means the property is non-writable/non-configurable on
// this runtime (the documented WKWebView behaviour) and the recorder is inert.
function installInvokeRecorder(): Promise<RecorderState["status"]> {
  return browser.execute(() => {
    const w = window as unknown as {
      __TAURI_INTERNALS__?: { invoke: (...args: unknown[]) => Promise<unknown> };
      __up5Commands?: string[];
      __up5OrigInvoke?: (...args: unknown[]) => Promise<unknown>;
    };
    const internals = w.__TAURI_INTERNALS__;
    if (!internals) return "no-internals";
    const orig = internals.invoke;
    w.__up5Commands = [];
    try {
      internals.invoke = function (...args: unknown[]): Promise<unknown> {
        w.__up5Commands?.push(String(args[0]));
        return orig.apply(internals, args);
      };
    } catch {
      // Non-writable in strict mode throws; in sloppy mode it silently no-ops.
      // Either way the check below is what decides.
    }
    if (internals.invoke !== orig) {
      w.__up5OrigInvoke = orig;
      return "live";
    }
    return "locked";
  });
}

function recordedCommands(): Promise<string[]> {
  return browser.execute(() => {
    const w = window as unknown as { __up5Commands?: string[] };
    return w.__up5Commands ? w.__up5Commands.slice() : [];
  });
}

function restoreInvokeRecorder(): Promise<void> {
  return browser.execute(() => {
    const w = window as unknown as {
      __TAURI_INTERNALS__?: { invoke: (...args: unknown[]) => Promise<unknown> };
      __up5Commands?: string[];
      __up5OrigInvoke?: (...args: unknown[]) => Promise<unknown>;
    };
    if (w.__TAURI_INTERNALS__ && w.__up5OrigInvoke) {
      try {
        w.__TAURI_INTERNALS__.invoke = w.__up5OrigInvoke;
      } catch {
        // Nothing to restore if the assignment never took in the first place.
      }
    }
    delete w.__up5OrigInvoke;
    delete w.__up5Commands;
  });
}

// Resource-timing view of which modules the page actually FETCHED. In `tauri dev`
// Vite serves unbundled ES modules over http, so a dynamic import that executes
// leaves an entry here; one that never executes leaves none.
function moduleFetchProbe(): Promise<{
  total: number;
  srcModules: number;
  reviewHits: string[];
}> {
  return browser.execute(() => {
    const names = performance.getEntriesByType("resource").map((e) => e.name);
    return {
      total: names.length,
      srcModules: names.filter((n) => n.includes("/src/")).length,
      reviewHits: names.filter((n) => /reviewPrompt/i.test(n)),
    };
  });
}

function counterOf(blob: Record<string, unknown> | null): unknown {
  return blob ? blob["toolSuccessCount"] : undefined;
}

function stampOf(blob: Record<string, unknown> | null): unknown {
  return blob ? blob["lastReviewRequestAt"] : undefined;
}

describe("App Store review prompt — direct-channel absence (real WKWebView)", () => {
  let recorderStatus: RecorderState["status"] = "no-internals";
  let blobAfter: Record<string, unknown> | null = null;

  before(async () => {
    // Install BEFORE any interaction so a review invoke fired by any of the three
    // decodes would be captured.
    recorderStatus = await installInvokeRecorder();
    console.log(`[review-prompt] invoke recorder install status: ${recorderStatus}`);
  });

  after(async () => {
    await restoreInvokeRecorder();
  });

  it("performs three real, output-distinct, settled successful decodes", async () => {
    await navigateToTool("protobuf-decoder");
    const input = await $("#protobuf-input");
    await input.waitForExist({ timeout: 15_000 });
    await input.click();

    for (const payload of PAYLOADS) {
      await input.setValue(payload);
      // The decode must genuinely SUCCEED — a rendered field number is the same
      // signal the hero spec uses. An errored/empty output would not count as a
      // success on ANY channel, which would make the absence proof vacuous.
      const fnum = await $("[data-fnum]");
      await fnum.waitForExist({ timeout: 10_000 });
      const noAlert = await $("[role='alert']");
      assert(
        !(await noAlert.isExisting()),
        `payload ${payload} produced an error alert — it must decode cleanly for this to count as a successful output`,
      );
      // Sit past the quiet window with the output UNCHANGED: this is exactly the
      // "natural pause" the appstore build would count as one settled success.
      await browser.pause(SETTLE_PAUSE_MS);
    }

    // The evidence artefact: the third settled decode really rendered.
    await saveScreenshot(
      "review-prompt",
      "review-prompt-direct-settled.png",
      "third-settled-decode",
    );
  });

  it("the prefs write path is ALIVE in this session, yet the counter never moved", async () => {
    // NON-VACUITY GUARD. "The counter is 0" would also be true if prefs simply
    // never persisted anything. Drive a tool switch — useTrackActiveTool persists
    // `lastUsedId` through the SAME single-writer blob the counter lives in — and
    // prove that write landed on disk.
    // Two DISTINCT persisted writes, asserted against the on-disk blob itself —
    // no tool-specific selector needed, and lastUsedId only lands once the route
    // has actually mounted.
    for (const toolId of ["base64", "protobuf-decoder"]) {
      await navigateToTool(toolId);
      await browser.waitUntil(
        async () => {
          const blob = await readPrefsBlob();
          return blob !== null && blob["lastUsedId"] === toolId;
        },
        {
          timeout: 15_000,
          interval: 250,
          timeoutMsg: `the prefs blob never recorded lastUsedId=${toolId} — the persistence path is not alive, so a zero counter would prove nothing`,
        },
      );
    }
    await $("#protobuf-input").waitForExist({ timeout: 15_000 });

    blobAfter = await readPrefsBlob();
    assert(
      blobAfter !== null,
      "expected a persisted prefs blob after the tool switch (the write path must be alive for the counter assertion to be load-bearing)",
    );

    const count = counterOf(blobAfter);
    assert(
      count === 0 || count === undefined,
      `direct build must never count settled successes — expected toolSuccessCount 0-or-absent after three settled decodes, got ${JSON.stringify(count)}`,
    );

    const stamp = stampOf(blobAfter);
    assert(
      stamp === null || stamp === undefined,
      `direct build must never stamp a review request — expected lastReviewRequestAt null-or-absent, got ${JSON.stringify(stamp)}`,
    );
    console.log(
      `[review-prompt] persisted blob: toolSuccessCount=${JSON.stringify(count)}, lastReviewRequestAt=${JSON.stringify(stamp)}, lastUsedId=${JSON.stringify(blobAfter["lastUsedId"])}`,
    );
  });

  it("never invoked a review command (asserted only once the recorder is proven live)", async () => {
    // The liveness probe: readPrefsBlob goes through __TAURI_INTERNALS__.invoke
    // with plugin:store|* commands. If the recorder is live it MUST have seen
    // them (the previous test already called it several times).
    const commands = await recordedCommands();
    const sawKnownCommand = commands.some((c) => c.startsWith("plugin:store|"));

    if (recorderStatus === "live" && sawKnownCommand) {
      const reviewCommands = commands.filter((c) => /review/i.test(c));
      assert(
        reviewCommands.length === 0,
        `the direct build invoked a review command on the real webview: ${reviewCommands.join(", ")}`,
      );
      console.log(
        `[review-prompt] invoke recorder LIVE (${commands.length} commands seen, 0 matching /review/i) — runtime no-invoke proven directly`,
      );
    } else {
      // Honest reporting rather than a vacuous green: the recorder could not be
      // installed over the locked-down IPC property (license-buy.e2e.ts's
      // documented finding), so this probe observes nothing and asserts nothing.
      // The runtime no-invoke evidence for this run is the prefs proof above —
      // recordSettledSuccess increments the counter BEFORE it can reach
      // platform.review.request(), so a counter still at 0 means the request path
      // was never even approached — plus the module-load probe below and the
      // jsdom no-invoke unit test (useToolSuccess Test 9).
      console.log(
        `[review-prompt] invoke recorder INERT (status=${recorderStatus}, ${commands.length} commands seen) — the IPC transport is non-writable on this WKWebView; not asserting a vacuous no-invoke. See the prefs + module-load proofs.`,
      );
    }
  });

  it("never even FETCHED the reviewPrompt module", async () => {
    const probe = await moduleFetchProbe();
    if (probe.srcModules === 0) {
      // Resource timing is not capturing Vite module fetches in this session (an
      // overflowed/cleared buffer) — the absence below would be vacuous, so it is
      // reported rather than asserted.
      console.log(
        `[review-prompt] resource timing captured no /src/ module fetches (total=${probe.total}) — skipping the module-load probe as non-observable`,
      );
      return;
    }
    assert(
      probe.reviewHits.length === 0,
      `the direct build fetched the appstore-only review module at runtime: ${probe.reviewHits.join(", ")}`,
    );
    console.log(
      `[review-prompt] module-load probe: ${probe.srcModules} /src/ module fetches recorded, 0 matching reviewPrompt`,
    );
  });
});
