// App Store review prompt — APPSTORE-channel EXECUTION proof on the real macOS
// WKWebView (quick task 260808-up5, UP5-01/UP5-02).
//
// THE SIBLING SPEC PROVES THE OPPOSITE. review-prompt.e2e.ts drives the DIRECT
// channel and proves the whole feature is ABSENT there (no module, no counter, no
// stamp). This spec drives the APPSTORE channel and proves the same seam ACTUALLY
// FIRES: the counter climbs, the 3rd-success boundary reaches the native
// `request_app_store_review` command, the Swift StoreKit bridge resolves, and the
// stamp lands on disk.
//
// WHY IT IS OPT-IN. The standard gate (`scripts/e2e-spike.sh`) starts
// `pnpm tauri:dev:e2e`, which is the DIRECT overlay — there is no appstore runtime
// in that run, so this spec would be meaningless (and would fail) there. It runs
// only when the harness sets `E2E_CHANNEL=appstore`, i.e. under an appstore-channel
// dev run:
//
//   VITE_CHANNEL=appstore pnpm tauri dev -f appstore,webdriver \
//     --config src-tauri/tauri.appstore.conf.json -- --no-default-features
//
// (the `--no-default-features` after `--` goes to CARGO — a bare `-f appstore`
// keeps the default `direct` feature and produces a hybrid binary, which the
// compile_error! guard in lib.rs rejects.)
//
// WHAT ONLY THIS SPEC CAN SHOW. `AppStore.requestReview(in:)` cannot be reached by
// any unit test: vitest has no Swift, and the Rust `review::` tests deliberately
// stop at the link edge. Here the whole chain executes for real —
// useToolSuccess → the appstore-only dynamic import → reviewPrompt.runOnce →
// platform.review.request() → invoke → the Rust command → run_on_main_thread →
// the Swift bridge → StoreKit.
//
// THE OBSERVABLE IS THE STAMP, NOT A SHEET. The OS decides whether a review sheet
// is ever presented (it legitimately shows nothing for most contexts, and caps real
// prompts at 3 per 365 days). What IS deterministic: `lastReviewRequestAt` is
// persisted ONLY after the native call RESOLVES, and the Rust command resolves Ok
// only when the Swift bridge returned 0 = "the request was issued to StoreKit".
// So a non-null stamp is a positive proof that the native path executed end to end;
// a null stamp at count 3 is a FINDING, not a pass.
//
// FRONTMOST GATE. reviewPrompt skips the request entirely when
// `document.hasFocus()` is false (a backgrounded app must never queue a sheet that
// pops later out of context). Under a LOCKED screen the webview may not hold focus,
// so this spec probes `document.hasFocus()` explicitly and reports it — a skipped
// request with hasFocus=false is the documented behaviour, not a regression, and
// the spec says which case it observed instead of silently passing.

import { execFileSync } from "node:child_process";

import {
  assert,
  navigateToTool,
  readPrefsBlob,
  resetPrefsBlob,
  saveScreenshot,
} from "./helpers";

/** This spec is meaningful ONLY under an appstore-channel dev run. */
const IS_APPSTORE_RUN = process.env.E2E_CHANNEL === "appstore";

/** Dev-only quiet-window override (src/shell/useToolSuccess.ts). */
const SETTLE_OVERRIDE_MS = 250;
const SETTLE_FALLBACK_MS = 3500;

/** Six INPUT-distinct payloads, each with a unique rendered marker so a wait can
 *  never be satisfied by the previous payload's tree still on screen. */
const PAYLOADS: { hex: string; marker: string }[] = [
  { hex: "089601", marker: "150" },
  { hex: "08c801", marker: "200" },
  { hex: "120568656c6c6f", marker: "hello" },
  { hex: "08ac02", marker: "300" },
  { hex: "1203616263", marker: "abc" },
  { hex: "08d004", marker: "592" },
];

function trySetSettleMs(ms: number | null): Promise<boolean> {
  return browser.execute((value: number | null) => {
    const w = window as unknown as { __setSettleMsForTest?: (ms?: number) => void };
    if (typeof w.__setSettleMsForTest !== "function") return false;
    if (value === null) w.__setSettleMsForTest();
    else w.__setSettleMsForTest(value);
    return true;
  }, ms);
}

function hasFocus(): Promise<boolean> {
  return browser.execute(() => document.hasFocus());
}

/**
 * Make the app window FRONTMOST so `document.hasFocus()` is true.
 *
 * reviewPrompt skips the request entirely when the app is not frontmost, and a
 * WebDriver session does NOT by itself make the window key — under an agent
 * session (and with the screen locked) the webview reports hasFocus()===false, so
 * a spec that just drove decodes would silently prove only the counter and never
 * reach the native StoreKit call.
 *
 * Accessibility (`System Events … set frontmost`) is the same seam
 * scripts/ui-capture.sh uses, and it works even when the screen is locked. Spec
 * code runs in Node, so it can drive it directly. Returns the resulting focus
 * state; never throws (a machine without Accessibility granted simply reports
 * false and the spec then documents the frontmost-gate path instead).
 */
async function ensureFrontmost(): Promise<boolean> {
  if (await hasFocus()) return true;
  try {
    const pid = execFileSync("pgrep", ["-f", "devtools-app"], { encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)[0];
    if (!pid) return false;
    execFileSync("osascript", [
      "-e",
      `tell application "System Events" to tell (first process whose unix id is ${pid}) to set frontmost to true`,
    ]);
  } catch {
    return false; // Accessibility denied / no matching process — reported, not fatal
  }
  await browser.pause(1000);
  return hasFocus();
}

function counterOf(blob: Record<string, unknown> | null): unknown {
  return blob ? blob["toolSuccessCount"] : undefined;
}

function stampOf(blob: Record<string, unknown> | null): unknown {
  return blob ? blob["lastReviewRequestAt"] : undefined;
}

describe("App Store review prompt — appstore-channel execution (real WKWebView)", function () {
  let settlePause = SETTLE_FALLBACK_MS;
  let settleOverridden = false;
  let firstStamp: unknown = null;

  before(async function () {
    if (!IS_APPSTORE_RUN) {
      console.log(
        "[up5-appstore] E2E_CHANNEL!=appstore — skipping (this spec needs an appstore-channel dev run)",
      );
      this.skip();
      return;
    }
    // Start from a KNOWN blob: this spec asserts exact counter values (3, then 6),
    // so a leftover count from a previous run would make it unrunnable twice. The
    // reset clears the on-disk key; the reload re-hydrates the prefs singleton
    // from it (usePreferences only re-reads on a full webview reload).
    await resetPrefsBlob();
    await browser.refresh();
    await navigateToTool("protobuf-decoder");
    await $("#protobuf-input").waitForExist({ timeout: 20_000 });
    settleOverridden = await trySetSettleMs(SETTLE_OVERRIDE_MS);
    settlePause = settleOverridden ? SETTLE_OVERRIDE_MS + 200 : SETTLE_FALLBACK_MS;
    const focused = await ensureFrontmost();
    console.log(
      `[up5-appstore] settle override=${settleOverridden} (pause ${settlePause} ms), document.hasFocus()=${focused}`,
    );
  });

  after(async () => {
    if (settleOverridden) await trySetSettleMs(null);
  });

  /** Paste one payload and wait for ITS distinctive decoded value, then settle. */
  async function driveDecode(hex: string, marker: string): Promise<void> {
    const input = await $("#protobuf-input");
    await input.click();
    await input.setValue(hex);
    await browser.waitUntil(
      async () => {
        for (const v of await $$(".val")) {
          if ((await v.getText()).includes(marker)) return true;
        }
        return false;
      },
      {
        timeout: 10_000,
        interval: 100,
        timeoutMsg: `payload ${hex} never rendered "${marker}" — this decode did not happen, so it cannot count as a settled success`,
      },
    );
    const alert = await $("[role='alert']");
    assert(
      !(await alert.isExisting()),
      `payload ${hex} produced an error alert — a failed decode must never count`,
    );
    await browser.pause(settlePause);
  }

  /** Wait for the persisted counter to reach `want` (the blob is the observable). */
  async function waitForCount(want: number): Promise<Record<string, unknown> | null> {
    let blob: Record<string, unknown> | null = null;
    await browser.waitUntil(
      async () => {
        blob = await readPrefsBlob();
        return counterOf(blob) === want;
      },
      {
        timeout: 20_000,
        interval: 250,
        timeoutMsg: `the persisted toolSuccessCount never reached ${want} (last seen ${JSON.stringify(
          counterOf(blob),
        )}) — the appstore counting seam did not run`,
      },
    );
    return blob;
  }

  it("counts three settled successes and STAMPS the boundary review request", async () => {
    // The frontmost gate is evaluated when the THIRD settle fires, so focus has to
    // hold across the drive — re-assert it immediately before, and re-read it
    // after, so the log reports the state the gate actually saw.
    const focusedBefore = await ensureFrontmost();
    for (const { hex, marker } of PAYLOADS.slice(0, 3)) await driveDecode(hex, marker);

    // Count 3 is a BOUNDARY, so it persists immediately (not deferred).
    const blob = await waitForCount(3);
    const stamp = stampOf(blob);
    const focused = focusedBefore && (await hasFocus());

    await saveScreenshot(
      "review-prompt-appstore",
      "review-prompt-appstore-boundary.png",
      "third-settled-decode-at-the-review-boundary",
    );

    console.log(
      `[up5-appstore] after 3 settled successes: toolSuccessCount=${JSON.stringify(
        counterOf(blob),
      )}, lastReviewRequestAt=${JSON.stringify(stamp)}, document.hasFocus()=${focused}`,
    );

    if (!focused) {
      // Documented behaviour, not a regression: the frontmost gate skips the
      // request entirely and the NEXT boundary gets the turn. Say so loudly
      // instead of asserting a stamp the code deliberately did not write.
      assert(
        stamp === null || stamp === undefined,
        `the app was NOT frontmost, so no request may have been made — yet a stamp exists: ${JSON.stringify(stamp)}`,
      );
      console.log(
        "[up5-appstore] FRONTMOST GATE ACTIVE (document.hasFocus()===false): the request was correctly skipped; the native StoreKit path was NOT exercised in this run",
      );
      return;
    }

    assert(
      typeof stamp === "number" && stamp > 0,
      `expected lastReviewRequestAt to be stamped after the count-3 boundary (the native request must have resolved), got ${JSON.stringify(stamp)}`,
    );
    firstStamp = stamp;
    console.log(
      `[up5-appstore] NATIVE PATH EXECUTED: request_app_store_review resolved Ok and the stamp ${String(stamp)} was persisted DURABLY`,
    );
  });

  it("re-settling the IDENTICAL input does not count again", async () => {
    // The dedupe is DELIBERATE: the metric is unique successful inputs. Re-pasting
    // the same payload re-settles the same identity and must be one episode.
    const { hex, marker } = PAYLOADS[2]!;
    await driveDecode(hex, marker);
    await driveDecode(hex, marker);

    const blob = await readPrefsBlob();
    assert(
      counterOf(blob) === 3,
      `re-settling the identical input must NOT count — expected toolSuccessCount 3, got ${JSON.stringify(counterOf(blob))}`,
    );
    console.log(
      "[up5-appstore] identity dedupe holds: two more settles of the SAME payload left the counter at 3",
    );
  });

  it("three MORE distinct successes reach count 6, and the 7-day gap suppresses a second request", async () => {
    for (const { hex, marker } of PAYLOADS.slice(3, 6)) await driveDecode(hex, marker);

    const blob = await waitForCount(6);
    const stamp = stampOf(blob);

    await saveScreenshot(
      "review-prompt-appstore",
      "review-prompt-appstore-second-boundary.png",
      "sixth-settled-success-inside-the-7-day-gap",
    );

    if (firstStamp === null) {
      console.log(
        `[up5-appstore] no first-boundary stamp to compare against (frontmost gate) — count reached 6, lastReviewRequestAt=${JSON.stringify(stamp)}`,
      );
      return;
    }
    assert(
      stamp === firstStamp,
      `the count-6 boundary is INSIDE the 7-day floor, so the stamp must be unchanged — expected ${String(firstStamp)}, got ${JSON.stringify(stamp)}`,
    );
    console.log(
      `[up5-appstore] 7-day gap honoured: counter 6, stamp unchanged at ${String(stamp)} (no second request)`,
    );
  });
});
