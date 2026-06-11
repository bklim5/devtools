// Cron tool — real macOS WKWebView gate (Phase 15, 15-04; HRN-02).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the same harness as
// url.e2e.ts / regex.e2e.ts. Run by scripts/e2e-spike.sh (starts
// `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears the
// child down). Auto-discovered by wdio.conf.ts `specs: ["./test/e2e/*.e2e.ts"]` —
// no config edit needed. Stable selectors come from CronTool.tsx: the expression
// input #cron-expression, the description headline <h2>, the [data-run-row] run
// rows, and the inline [role="alert"] error node.
//
// The load-bearing real-runtime check: the next-run engine's native
// `Intl.DateTimeFormat`/`formatToParts` + `Date` arithmetic must render 5 correct
// 24-hour local runs on JavaScriptCore — only the real WKWebView truly proves the
// h23 hourCycle round-trip (no AM/PM, midnight is 00:00). It also proves the calm
// "never" state does NOT throw/freeze the view (the assertion completing is the
// proof) and that an invalid expression surfaces an inline alert with no run rows.

import { assert, navigateToTool, saveScreenshot } from "./helpers";

describe("Cron tool (real WKWebView)", () => {
  it("renders scheduled 24-hour runs, the zone caption, @reboot, the calm never state, and the invalid error", async () => {
    // Navigate to the Cron tool via HashRouter (deterministic regardless of the
    // startup-resolved tool).
    await navigateToTool("cron");

    const input = await $("#cron-expression");
    await input.waitForExist({ timeout: 15_000 });

    // Single round-trips for reading DOM — see the stale-handle lesson in helpers.ts.
    const runRowCount = () =>
      browser.execute(() => document.querySelectorAll("[data-run-row]").length);
    const headingText = () =>
      browser.execute(
        () => document.querySelector("h2")?.textContent ?? null,
      );
    const runRowTexts = () =>
      browser.execute(() =>
        Array.from(document.querySelectorAll("[data-run-row]")).map(
          (r) => r.textContent ?? "",
        ),
      );

    // 1. SCHEDULED (CRON-01/05): `0 9 * * *` → 5 run rows, the description headline
    //    and every row show 24-hour 09:00 (Intl h23 on JSC), never AM/PM.
    await input.click();
    await input.setValue("0 9 * * *");
    await browser.waitUntil(async () => (await runRowCount()) === 5, {
      timeout: 5_000,
      timeoutMsg: "expected exactly 5 run rows for 0 9 * * *",
    });

    const heading = await headingText();
    assert(
      !!heading && heading.includes("09:00") && !/AM|PM/.test(heading),
      `expected a 24-hour "09:00" description headline (no AM/PM), got "${heading}"`,
    );

    const rows = await runRowTexts();
    assert(rows.length === 5, `expected 5 run rows, got ${rows.length}`);
    for (const t of rows) {
      assert(
        t.includes("09:00") && !/\bAM\b|\bPM\b/.test(t),
        `expected each run row to show 24-hour 09:00 (no AM/PM), got "${t}"`,
      );
    }

    // 2. ZONE CAPTION (CRON-05): the system IANA zone label shows once.
    const hasZoneCaption = await browser.execute(() =>
      Array.from(document.querySelectorAll("p")).some((p) =>
        (p.textContent ?? "").includes("Local time ·"),
      ),
    );
    assert(hasZoneCaption, 'expected a "Local time · {zone}" caption');

    // 3. @reboot (CRON-09): the neutral startup banner appears, NO run rows.
    await input.setValue("@reboot");
    await browser.waitUntil(
      async () => {
        const h = await headingText();
        return !!h && /startup/i.test(h);
      },
      {
        timeout: 5_000,
        timeoutMsg: "expected the @reboot startup banner headline",
      },
    );
    assert(
      (await runRowCount()) === 0,
      "expected NO run rows in the @reboot state",
    );

    // 4. IMPOSSIBLE (CRON-08): `0 0 30 2 *` → a calm neutral "No upcoming runs"
    //    message, NO [role=alert] (it is a valid result, not an error). The view
    //    does not freeze — the assertion completing IS the proof.
    await input.setValue("0 0 30 2 *");
    await browser.waitUntil(
      async () =>
        await browser.execute(() =>
          Array.from(document.querySelectorAll("p")).some((p) =>
            (p.textContent ?? "").includes("No upcoming runs"),
          ),
        ),
      {
        timeout: 5_000,
        timeoutMsg: 'expected the calm "No upcoming runs" message for 0 0 30 2 *',
      },
    );
    const alertInNever = await browser.execute(
      () => !!document.querySelector('[role="alert"]'),
    );
    assert(
      !alertInNever,
      "expected NO [role=alert] in the impossible-expression state (it is not an error)",
    );

    // 5. INVALID (CRON-11): `0 99 * * *` → an inline [role=alert] error, NO run rows.
    await input.setValue("0 99 * * *");
    const alert = await $('[role="alert"]');
    await alert.waitForExist({ timeout: 5_000 });
    assert(
      await alert.isDisplayed(),
      "expected an inline [role=alert] error for 0 99 * * *",
    );
    assert(
      (await runRowCount()) === 0,
      "expected NO run rows in the invalid-expression error state",
    );

    // 6. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    await saveScreenshot("cron", "cron-wkwebview.png");
  });
});
