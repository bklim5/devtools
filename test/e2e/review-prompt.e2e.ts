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
// What THIS spec proves that none of those can: after three REAL, input-distinct,
// fully SETTLED successful decodes on the real webview, the shipped direct app
// counts nothing and stamps nothing. That is the runtime counterpart of the
// build-time chunk-module guard (scripts/reviewPromptFoldInGuard.mjs) — the
// `keygen-compileout-d04-proof` lesson: a bundle-absence check and a RUNTIME
// no-effect check prove different things, and the runtime one is the load-bearing
// half.
//
// NON-VACUITY IS THE WHOLE DIFFICULTY HERE — "nothing happened" is the trivially
// passing assertion. Three separate guards make it earn its green:
//   1. the decodes are proven REAL (each waits for its OWN distinctive decoded
//      value to render — not bare [data-fnum] existence, which the previous
//      payload's tree already satisfies — each input is DISTINCT, each sits
//      unchanged past the quiet window, and the third is screenshotted);
//   2. the prefs WRITE PATH is proven ALIVE in this same session against the same
//      blob (a tool switch persists `lastUsedId` while the counter stays 0) — so
//      "counter is 0" cannot be explained away by "prefs never persisted";
//   3. the module-load probe clears the resource-timing buffer (and raises its
//      cap) before the decodes, so a buffer overflowed by the boot-time module
//      flood cannot masquerade as "nothing was fetched", and it is only asserted
//      when that buffer is shown to be capturing Vite module fetches at all.
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
// the seam only counts an input that has sat UNCHANGED for a full quiet window.
const SETTLE_PAUSE_MS = 3500;

// The dev/e2e SETTLE_MS override (src/shell/useToolSuccess.ts
// `__setSettleMsForTest`, registered on `window` in test/dev builds ONLY). Using
// it turns three 3.5 s wall-clock sleeps into three ~0.4 s ones without weakening
// the proof: the settle is still a REAL quiet window the seam measured, just a
// shorter one. If the seam is not reachable (a build where the guarded seam is
// inert) the spec falls back to the shipped window and says so.
const SETTLE_OVERRIDE_MS = 250;

// Three payloads whose DECODE differs — not merely their byte counts. Each one
// has a UNIQUE rendered marker, which is what the drive loop waits for: waiting
// on bare `[data-fnum]` existence would be satisfied by the PREVIOUS payload's
// tree still on screen, so all three "decodes" could be one stale render and the
// three-distinct-successes premise would be fiction.
//   089601         -> field #1, varint 150
//   08c801         -> field #1, varint 200   (same shape, different value)
//   120568656c6c6f -> field #2, LEN "hello"  (different field AND different type)
const PAYLOADS: { hex: string; marker: string }[] = [
  { hex: "089601", marker: "150" },
  { hex: "08c801", marker: "200" },
  { hex: "120568656c6c6f", marker: "hello" },
];

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

/** Install the dev-only SETTLE_MS override; false when the seam is unreachable. */
function trySetSettleMs(ms: number | null): Promise<boolean> {
  return browser.execute((value: number | null) => {
    const w = window as unknown as {
      __setSettleMsForTest?: (ms?: number) => void;
    };
    if (typeof w.__setSettleMsForTest !== "function") return false;
    // `null` restores the shipped SETTLE_MS.
    if (value === null) w.__setSettleMsForTest();
    else w.__setSettleMsForTest(value);
    return true;
  }, ms);
}

/**
 * Make the resource-timing buffer a TRUSTWORTHY witness before the decodes run.
 * The default buffer is ~250 entries and this app's boot fetches far more than
 * that in `tauri dev` (one entry per unbundled ES module): a FULL buffer silently
 * drops every later entry, so "no reviewPrompt fetch" would be indistinguishable
 * from "no entries recorded at all". Raise the cap, then clear — so every entry
 * the probe reads was recorded DURING the decodes, with room to spare.
 */
function resetResourceTiming(): Promise<void> {
  return browser.execute(() => {
    performance.setResourceTimingBufferSize(10_000);
    performance.clearResourceTimings();
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
  let settleOverridden = false;
  let blobAfter: Record<string, unknown> | null = null;

  before(async () => {
    // Install BEFORE any interaction so a review invoke fired by any of the three
    // decodes would be captured.
    recorderStatus = await installInvokeRecorder();
    console.log(`[review-prompt] invoke recorder install status: ${recorderStatus}`);
  });

  after(async () => {
    await restoreInvokeRecorder();
    if (settleOverridden) await trySetSettleMs(null);
  });

  it("performs three real, INPUT-distinct, settled successful decodes", async () => {
    await navigateToTool("protobuf-decoder");
    const input = await $("#protobuf-input");
    await input.waitForExist({ timeout: 15_000 });

    // The tool's module graph is loaded now, so the dev-only seam (if this build
    // has one) is registered. Shorten the quiet window BEFORE the first decode.
    settleOverridden = await trySetSettleMs(SETTLE_OVERRIDE_MS);
    const settlePause = settleOverridden ? SETTLE_OVERRIDE_MS + 150 : SETTLE_PAUSE_MS;
    console.log(
      settleOverridden
        ? `[review-prompt] SETTLE_MS overridden to ${SETTLE_OVERRIDE_MS} ms via the dev seam — pausing ${settlePause} ms per payload`
        : `[review-prompt] dev SETTLE_MS seam unavailable — using the shipped window (${settlePause} ms per payload)`,
    );

    // Only entries recorded from HERE ON count as module fetches (see
    // resetResourceTiming): the boot-time flood would otherwise overflow the
    // buffer and make the later absence check unfalsifiable.
    await resetResourceTiming();

    await input.click();

    for (const { hex, marker } of PAYLOADS) {
      await input.setValue(hex);
      // The decode must genuinely SUCCEED, and must be THIS payload's decode —
      // waiting on a UNIQUE rendered value (not bare [data-fnum] existence) is
      // what rules out the previous payload's tree still being on screen.
      await browser.waitUntil(
        async () => {
          const vals = await $$(".val");
          for (const v of vals) {
            if ((await v.getText()).includes(marker)) return true;
          }
          return false;
        },
        {
          timeout: 10_000,
          interval: 100,
          timeoutMsg: `payload ${hex} never rendered its distinctive decoded value "${marker}" — this decode did not actually happen, so it cannot count as a settled success`,
        },
      );
      const noAlert = await $("[role='alert']");
      assert(
        !(await noAlert.isExisting()),
        `payload ${hex} produced an error alert — it must decode cleanly for this to count as a successful result`,
      );
      // Sit past the quiet window with the INPUT UNCHANGED: this is exactly the
      // "natural pause" the appstore build would count as one settled success.
      await browser.pause(settlePause);
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
    // The buffer was cleared (and its cap raised) before the decodes, so every
    // entry here was recorded during this spec's own interactions — including the
    // lazily-routed tool chunks the previous test's two tool switches fetched,
    // which is what proves the buffer is live rather than merely empty.
    const probe = await moduleFetchProbe();
    if (probe.srcModules === 0) {
      // Resource timing is not capturing Vite module fetches in this session —
      // the absence below would be vacuous, so it is reported, not asserted.
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
