// Settings modal shell — real macOS WKWebView gate (Phase 22, 22-01; SET-04/05/06,
// D-S1..D-S6).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). Run by
// scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts.
//
// This spec proves the shell modal itself on the real runtime (only the real
// WKWebView truly proves the focus-trapped dialog mounts + dismisses):
//   1. The #/settings/license deep-link (D-S6) mounts the [role="dialog"]
//      [aria-modal="true"] Settings modal with the visible "Settings" title.
//   2. The active pane is the License pane (aria-current + the License content).
//   3. Escape dismisses the modal (D-S5).
//   4. (Plan 02) The bottom-anchored sidebar "Settings" row opens the modal and
//      focus RETURNS to that row on Esc-close (the focus-return contract, D-S9).
//   5. (Plan 02) The ⌘K "Settings" command opens the modal and focus returns to
//      the pre-palette element on Esc-close (the palette row unmounts — finding 3).
//
// The License-pane state matrix (free/problem) + the footer re-point live in the
// migrated license-settings.e2e.ts. The native app-menu (⌘,) + tray entries are
// manual-walkthrough (WebDriver cannot drive native chrome) — 22-HUMAN-UAT.
//
// The e2e-spike preflight resets prefs.json + machine.dev.lic to a deterministic
// baseline, so this spec starts from a known free/notActivated state.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assert, navigateToTool, saveScreenshot } from "./helpers";

/** Runner-side (Node) probe verdict for the REAL updater endpoint.
 *
 *  A plain boolean "reachable" was NOT safe: it collapsed config regressions
 *  (missing/typo'd endpoint URL, deleted release asset → 404, schema-broken
 *  latest.json) into the same `false` as a genuine offline runner, so the spec
 *  below would TOLERATE "Update check failed" for exactly the class of bug the
 *  probe exists to catch. Three verdicts instead:
 *    • "healthy"       — HTTP 2xx AND the body parses as an updater latest.json
 *                        (a `version` field). The app must NOT fail its check.
 *    • "misconfigured" — the endpoint is wrong or its artifact is broken:
 *                        missing/empty/malformed URL in tauri.conf.json, any
 *                        non-2xx response (404 = the release asset is gone), a
 *                        non-JSON body, or JSON without `version`. This is a
 *                        wiring/config REGRESSION → the gate must FAIL, never
 *                        tolerate "Update check failed".
 *    • "unreachable"   — the runner itself has no network path: DNS failure
 *                        (ENOTFOUND/EAI_AGAIN), connection refused/reset, or a
 *                        timeout. The ONLY "offline CI / external outage" case,
 *                        and the ONLY one that tolerates "Update check failed". */
type UpdaterProbe = {
  verdict: "healthy" | "misconfigured" | "unreachable";
  detail: string;
};

/** Node/undici error codes that mean "this machine could not reach the network",
 *  as opposed to "the server answered and the answer was wrong". */
const NETWORK_UNAVAILABLE_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "EAI_NODATA",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

/** The network-unavailable reason for a thrown fetch error, or null when the
 *  failure was not a transport failure. Node hangs the syscall code on the error
 *  `cause` chain (fetch wraps it in a bare TypeError), and AbortSignal.timeout
 *  surfaces as a TimeoutError/AbortError DOMException — both are "offline". The
 *  walk must also descend AggregateError.errors: a connection refusal on a
 *  dual-stack host arrives as `TypeError: fetch failed` → cause AggregateError →
 *  errors[] each carrying ECONNREFUSED, so a cause-only walk would misfile a
 *  genuinely offline runner as "misconfigured". */
function networkUnavailableReason(err: unknown): string | null {
  const queue: unknown[] = [err];
  for (let i = 0; i < queue.length && i < 16; i += 1) {
    const node = queue[i];
    if (node === null || typeof node !== "object") continue;
    const e = node as {
      name?: unknown;
      code?: unknown;
      cause?: unknown;
      errors?: unknown;
    };
    if (typeof e.code === "string" && NETWORK_UNAVAILABLE_CODES.has(e.code)) return e.code;
    if (e.name === "TimeoutError" || e.name === "AbortError") return String(e.name);
    if (e.cause !== undefined) queue.push(e.cause);
    if (Array.isArray(e.errors)) queue.push(...e.errors);
  }
  return null;
}

/** Probe the REAL updater endpoint from tauri.conf.json — the disambiguator for
 *  the "Check for updates" outcome below. The spec runs in the WDIO Node worker,
 *  so this fetch is independent of the app's own network path: healthy-from-runner
 *  + app-reports-failure = a LOCAL updater wiring regression (plugin unregistered,
 *  capability dropped) that must FAIL the gate. Reading the endpoint FROM
 *  tauri.conf.json (not a copy) means a config typo probes the same wrong URL the
 *  app uses — which is precisely why a typo must classify as "misconfigured"
 *  (both sides fail together) rather than as an external outage.
 *
 *  PREREQUISITE for the strict arm: the harness must run the DIRECT-channel
 *  capability overlay. `updater:default` lives in src-tauri/tauri.direct.conf.json,
 *  NOT in capabilities/default.json (kept out so the appstore build's capability
 *  codegen doesn't fail on a plugin it compiles out). scripts/e2e-spike.sh
 *  (`pnpm tauri:dev:e2e`) therefore passes `--config src-tauri/tauri.direct.conf.json`;
 *  without it every `plugin:updater|*` invoke is ACL-DENIED and the pane can only
 *  ever report "Update check failed" — an ACL no shipped channel uses, which is
 *  exactly what made this assertion untrustworthy before. If this assert fires
 *  with a healthy endpoint, check that overlay first. */
async function probeUpdaterEndpoint(): Promise<UpdaterProbe> {
  let url: string | undefined;
  try {
    const conf = JSON.parse(
      readFileSync(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8"),
    ) as { plugins?: { updater?: { endpoints?: string[] } } };
    url = conf.plugins?.updater?.endpoints?.[0];
  } catch (err) {
    return {
      verdict: "misconfigured",
      detail: `src-tauri/tauri.conf.json could not be read/parsed: ${String(err)}`,
    };
  }
  if (typeof url !== "string" || url.trim() === "") {
    return {
      verdict: "misconfigured",
      detail:
        "plugins.updater.endpoints[0] is missing or empty in src-tauri/tauri.conf.json",
    };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`unsupported protocol ${parsed.protocol}`);
    }
  } catch (err) {
    return {
      verdict: "misconfigured",
      detail: `plugins.updater.endpoints[0] is not a usable http(s) URL (${JSON.stringify(url)}): ${String(err)}`,
    };
  }

  let answer: { status: number; body: string };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    answer = { status: res.status, body: await res.text() };
  } catch (err) {
    const offline = networkUnavailableReason(err);
    if (offline !== null) {
      return {
        verdict: "unreachable",
        detail: `${url} — no network path from the test runner (${offline})`,
      };
    }
    return {
      verdict: "misconfigured",
      detail: `${url} — request failed for a non-transport reason: ${String(err)}`,
    };
  }

  if (answer.status < 200 || answer.status > 299) {
    return {
      verdict: "misconfigured",
      detail: `${url} — HTTP ${answer.status} (the server ANSWERED, so this is not an outage; e.g. a 404 means the release asset is gone — a release/config regression)`,
    };
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(answer.body);
  } catch {
    return {
      verdict: "misconfigured",
      detail: `${url} — HTTP ${answer.status} but the body is not JSON (first 120 chars: ${JSON.stringify(answer.body.slice(0, 120))})`,
    };
  }
  const version = (manifest as { version?: unknown } | null)?.version;
  if (typeof version !== "string" || version.trim() === "") {
    return {
      verdict: "misconfigured",
      detail: `${url} — HTTP ${answer.status} but the body has no "version" field, so it is not an updater latest.json`,
    };
  }
  return {
    verdict: "healthy",
    detail: `${url} — HTTP ${answer.status}, latest.json version ${version}`,
  };
}

/** Open the Settings modal on the License pane via the #/settings/license
 *  deep-link (D-S6). */
function openLicenseDeepLink(): Promise<void> {
  return browser.execute(() => {
    window.location.hash = "#/settings/license";
  });
}

/** Whether the Settings modal (the focus-trapped dialog) is mounted. */
function settingsModalOpen(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
  );
}

/** The dialog title (the aria-labelledby target), or null when not mounted. */
function dialogTitle(): Promise<string | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!dialog) return null;
    const labelledBy = dialog.getAttribute("aria-labelledby");
    const title = labelledBy ? document.getElementById(labelledBy) : null;
    return title ? (title.textContent ?? "").trim() : null;
  });
}

/** Whether the active nav item (aria-current="page") is the License pane. */
function activeNavIsLicense(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const current = dialog?.querySelector('[aria-current="page"]');
    return (current?.textContent ?? "").includes("License");
  });
}

/** Whether the active nav item (aria-current="page") is the General pane — the
 *  landing pane for the generic Settings openers (sidebar gear / app-menu / tray). */
function activeNavIsGeneral(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const current = dialog?.querySelector('[aria-current="page"]');
    return (current?.textContent ?? "").includes("General");
  });
}

/** Dismiss the modal via Escape (the dialog's document-level keydown listener). */
function dismissModal(): Promise<void> {
  return browser.execute(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

/** Focus + click the bottom-anchored sidebar "Settings" row (D-S9). Returns true
 *  if the row was found. Scoped inside the <aside> so it never matches a pane
 *  control. */
function clickSidebarSettings(): Promise<boolean> {
  return browser.execute(() => {
    const btn = Array.from(document.querySelectorAll("aside button")).find(
      (b) => (b.textContent ?? "").trim() === "Settings",
    ) as HTMLElement | undefined;
    if (!btn) return false;
    btn.focus();
    btn.click();
    return true;
  });
}

/** Whether the currently-focused element is the sidebar "Settings" row (the
 *  focus-return target after Esc-close). */
function activeIsSidebarSettings(): Promise<boolean> {
  return browser.execute(() => {
    const active = document.activeElement;
    return (
      active?.closest("aside") !== null &&
      (active?.textContent ?? "").trim() === "Settings"
    );
  });
}

/** Whether the ⌘K command palette is open (its dialog is NOT aria-modal). */
function paletteOpen(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('[aria-label="Command palette"]') !== null,
  );
}

/** Open the ⌘K palette (the listener lives on window). Phase 22.2: the palette is
 *  Pro-gated (a free user's plain ⌘K opens the upsell modal instead), so use the
 *  DEV-only ⌘⇧K force-open escape hatch — this test exercises the Settings COMMAND
 *  + focus-return, not the gate (the gate is proven in cmdk-pro.e2e.ts). */
function openPalette(): Promise<void> {
  return browser.execute(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        code: "KeyK",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

/** Type a query into the palette through React's controlled-input contract (the
 *  native value setter + a bubbling input event — a bare .value write is
 *  swallowed by React's value tracker). */
function typePaletteQuery(q: string): Promise<void> {
  return browser.execute((query: string) => {
    const el = document.querySelector(
      'input[aria-label="Search tools"]',
    ) as HTMLInputElement | null;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(el, query);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, q);
}

/** Whether the palette's highlighted (bg-accent-soft) row is the "Settings"
 *  command — guards against Enter selecting the wrong row. */
function settingsRowHighlighted(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[aria-label="Command palette"]');
    const on = Array.from(dialog?.querySelectorAll("button") ?? []).find((b) =>
      b.className.includes("bg-accent-soft"),
    );
    return (on?.textContent ?? "").trim() === "Settings";
  });
}

/** Press a bare key on the palette input (ArrowUp/ArrowDown/Enter). */
function pressPaletteKey(key: string): Promise<void> {
  return browser.execute((k: string) => {
    document.querySelector('input[aria-label="Search tools"]')?.dispatchEvent(
      new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
    );
  }, key);
}

// --- Updates pane (SET-10) helpers ------------------------------------------

/** Open the Settings modal (deep-link) then click the "Updates" pane-nav button,
 *  asserting aria-current lands on it (the real keyboard-reachable nav, mirroring
 *  the Appearance-pane pattern). */
async function openUpdatesPane(): Promise<void> {
  await openLicenseDeepLink();
  await browser.waitUntil(async () => settingsModalOpen(), {
    timeout: 10_000,
    timeoutMsg: "expected the Settings modal to open from the #/settings/license deep-link",
  });
  await browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("nav button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "Updates",
    ) as HTMLElement | undefined;
    btn?.click();
  });
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        const current = dialog?.querySelector('[aria-current="page"]');
        return (current?.textContent ?? "").includes("Updates");
      }),
    {
      timeout: 5_000,
      timeoutMsg: 'expected the Updates pane nav button to carry aria-current="page"',
    },
  );
}

/** The Updates pane's version line text ("TinkerDev v…"), or null when absent. */
function updatesVersionText(): Promise<string | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const node = Array.from(dialog?.querySelectorAll("span") ?? []).find((s) =>
      (s.textContent ?? "").startsWith("TinkerDev v"),
    );
    return node ? (node.textContent ?? "").trim() : null;
  });
}

/** The Updates pane's "Last checked:" line text, or null when absent. */
function lastCheckedText(): Promise<string | null> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const node = Array.from(dialog?.querySelectorAll("span") ?? []).find((s) =>
      (s.textContent ?? "").startsWith("Last checked:"),
    );
    return node ? (node.textContent ?? "").trim() : null;
  });
}

/** Click the "Check for updates" button inside the dialog. */
function clickCheckForUpdates(): Promise<void> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "Check for updates",
    ) as HTMLElement | undefined;
    btn?.click();
  });
}

/** The Updates pane's polite live-region result text (empty when idle). */
function checkResultText(): Promise<string> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const region = dialog?.querySelector('[role="status"][aria-live="polite"]:not(.sr-only)');
    return (region?.textContent ?? "").trim();
  });
}

/** Whether the auto-check toggle reads on (aria-checked="true"). */
function autoCheckToggleChecked(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const sw = Array.from(dialog?.querySelectorAll('[role="switch"]') ?? []).find(
      (b) =>
        (b.getAttribute("aria-label") ?? "").includes(
          "Automatically check for updates on launch",
        ),
    );
    return sw?.getAttribute("aria-checked") === "true";
  });
}

/** Keyboard-operate the auto-check toggle: focus it + activate it (a native
 *  <button role=switch> click is exactly what Space/Enter trigger on a focused
 *  button, so this proves the control is keyboard-reachable + operable). Returns
 *  whether the switch was actually focusable. The aria-checked flip is ASYNC (it
 *  routes onChange → setAutoUpdateCheck → updatePreferences → notify → React
 *  re-render), so the caller must WAIT for the flip via autoCheckToggleChecked() —
 *  reading aria-checked synchronously in this same tick would see the stale value. */
function activateAutoCheckToggle(): Promise<boolean> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const sw = Array.from(dialog?.querySelectorAll('[role="switch"]') ?? []).find((b) =>
      (b.getAttribute("aria-label") ?? "").includes(
        "Automatically check for updates on launch",
      ),
    ) as HTMLElement | null;
    if (!sw) return false;
    sw.focus();
    const focused = document.activeElement === sw;
    sw.click(); // native <button role=switch> click = the keyboard-activatable path
    return focused;
  });
}

describe("Settings modal shell (real WKWebView)", () => {
  it("the #/settings/license deep-link mounts the aria-modal Settings dialog on the License pane, dismissible by Escape (SET-04/05/06)", async () => {
    // Land on a deterministic tool so the shell is mounted.
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // 1. The deep-link opens the shell Settings modal (D-S6).
      await openLicenseDeepLink();
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg:
          "expected #/settings/license to open the [role=dialog][aria-modal] Settings modal (D-S6)",
      });

      // The visible dialog title is "Settings" (the aria-labelledby target).
      await browser.waitUntil(async () => (await dialogTitle()) === "Settings", {
        timeout: 5_000,
        timeoutMsg: `expected the dialog title to be "Settings", got ${JSON.stringify(await dialogTitle())}`,
      });

      // 2. The active pane is the License pane (aria-current + License content).
      assert(
        await activeNavIsLicense(),
        'expected the active nav item (aria-current="page") to be the License pane',
      );
      await saveScreenshot("settings", "settings-modal-license-pane.png", "license-pane");

      // 3. Escape dismisses the modal (D-S5).
      await dismissModal();
      await browser.waitUntil(async () => !(await settingsModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the Settings modal (D-S5)",
      });
    } finally {
      // Leave no modal open for the next spec in this WDIO run.
      try {
        if (await settingsModalOpen()) {
          await dismissModal();
          await browser.waitUntil(async () => !(await settingsModalOpen()), {
            timeout: 5_000,
          });
        }
      } catch (cleanupError) {
        console.error("[settings] cleanup failed:", cleanupError);
      }
    }
  });

  it("the bottom-anchored sidebar Settings row opens the modal on the General pane and returns focus to itself on Esc-close (SET-03/D-S9/D-S10)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // D-S10: the Settings row is reachable in the default free/notActivated
      // state — it opens for everyone, no lock badge.
      assert(
        await clickSidebarSettings(),
        'expected a bottom-anchored "Settings" row inside the sidebar <aside> (D-S9)',
      );
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg:
          "expected the sidebar Settings row to open the [role=dialog][aria-modal] Settings modal (SET-03)",
      });
      // Generic Settings opener lands on the General pane (the first pane);
      // License-specific entry points (Unlock Pro / deep-link) open License.
      assert(
        await activeNavIsGeneral(),
        "expected the sidebar Settings row to open on the General pane",
      );
      await saveScreenshot(
        "settings",
        "settings-modal-from-sidebar.png",
        "from-sidebar",
      );

      // Esc-close returns focus to the sidebar Settings row (the focus-return
      // contract — the row is a persistent invoker, captured synchronously).
      await dismissModal();
      await browser.waitUntil(async () => !(await settingsModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the Settings modal",
      });
      await browser.waitUntil(async () => activeIsSidebarSettings(), {
        timeout: 5_000,
        timeoutMsg:
          "expected focus to return to the sidebar Settings row on Esc-close (D-S9)",
      });
    } finally {
      try {
        if (await settingsModalOpen()) {
          await dismissModal();
          await browser.waitUntil(async () => !(await settingsModalOpen()), {
            timeout: 5_000,
          });
        }
      } catch (cleanupError) {
        console.error("[settings] sidebar cleanup failed:", cleanupError);
      }
    }
  });

  it("the ⌘K Settings command opens the modal and returns focus to the pre-palette element on Esc-close (SET-03/D-S8)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // Focus a known persistent pre-palette element (the protobuf input) so the
      // focus-return target is unambiguous and is NOT <body>.
      await browser.execute(() => {
        const el = document.querySelector("textarea, input") as HTMLElement | null;
        el?.focus();
      });

      await openPalette();
      const input = await $('input[aria-label="Search tools"]');
      await input.waitForExist({ timeout: 10_000 });

      await typePaletteQuery("settings");
      await browser.waitUntil(async () => settingsRowHighlighted(), {
        timeout: 5_000,
        timeoutMsg:
          'expected the typed query "settings" to highlight the Settings command row (D-S8)',
      }).catch(async () => {
        // The first row may be a tool match; ArrowUp wraps to the LAST row — the
        // command appends after tool matches (D-32 ordering).
        await pressPaletteKey("ArrowUp");
        await browser.waitUntil(async () => settingsRowHighlighted(), {
          timeout: 5_000,
          timeoutMsg:
            'expected ArrowUp to land the highlight on the "Settings" command row',
        });
      });
      await pressPaletteKey("Enter");

      // The palette closes (commands close-first, then run) and the modal mounts.
      await browser.waitUntil(async () => !(await paletteOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected the palette to close after running the Settings command",
      });
      await browser.waitUntil(async () => settingsModalOpen(), {
        timeout: 10_000,
        timeoutMsg:
          "expected the ⌘K Settings command to open the [role=dialog][aria-modal] Settings modal (D-S8)",
      });
      await saveScreenshot("settings", "settings-modal-from-palette.png", "from-palette");

      // Esc-close returns focus OFF <body> (the pre-palette element, not the
      // unmounted palette row — finding 3 / T-22-07).
      await dismissModal();
      await browser.waitUntil(async () => !(await settingsModalOpen()), {
        timeout: 5_000,
        timeoutMsg: "expected Escape to dismiss the Settings modal",
      });
      await browser.waitUntil(
        async () =>
          browser.execute(() => document.activeElement !== document.body),
        {
          timeout: 5_000,
          timeoutMsg:
            "expected focus to return to the pre-palette element on Esc-close, not <body> (T-22-07)",
        },
      );
    } finally {
      try {
        if (await paletteOpen()) {
          await browser.execute(() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            ),
          );
        }
        if (await settingsModalOpen()) {
          await dismissModal();
          await browser.waitUntil(async () => !(await settingsModalOpen()), {
            timeout: 5_000,
          });
        }
      } catch (cleanupError) {
        console.error("[settings] ⌘K cleanup failed:", cleanupError);
      }
    }
  });
});

// Updates pane (SET-10, D-25-1/4/5/7/8) — the real-WKWebView gate for the pane's
// render + keyboard reach. The lastUpdateCheck PERSISTENCE-across-restart + the
// toggle-survives-restart checks are the Plan 05 human walkthrough (WebDriver can't
// restart the packaged app between assertions — memory tauri-store-async-init-race).
// The e2e-spike preflight wipes prefs.json to a deterministic FREE baseline, so the
// pane starts with lastUpdateCheck=null ("Never") and autoUpdateCheck=null (off).
describe("Settings ▸ Updates pane (real WKWebView)", () => {
  it("renders version + Never last-checked, the Check button surfaces a result, and the auto-check toggle is keyboard-operable (SET-10)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    try {
      // The Updates pane is reachable via the keyboard-navigable pane nav (ungated —
      // it opens for everyone, no Pro tier needed, D-25-1).
      await openUpdatesPane();

      // (a) A version line renders. In the packaged app this is the real
      // tauri.conf version (semver); the dash placeholder would never satisfy
      // "TinkerDev vX.Y.Z", so a matched semver proves getVersion() resolved.
      await browser.waitUntil(
        async () => /^TinkerDev v\d+\.\d+\.\d+/.test((await updatesVersionText()) ?? ""),
        {
          timeout: 5_000,
          timeoutMsg: `expected a "TinkerDev vX.Y.Z" version line, got ${JSON.stringify(await updatesVersionText())}`,
        },
      );

      // (b) "Last checked: Never" on the fresh (preflight-wiped) prefs state (D-25-7).
      assert(
        ((await lastCheckedText()) ?? "").includes("Never"),
        `expected "Last checked: Never" on a fresh prefs state, got ${JSON.stringify(await lastCheckedText())}`,
      );
      await saveScreenshot("settings", "settings-updates-pane.png", "updates-pane");

      // (c) Clicking "Check for updates" surfaces an inline result in the polite
      // live region (WCAG-AA, never opacity-only) — this is the ONE e2e proof of a
      // real check() round-trip through the seam (plugin registered, capability
      // granted, endpoint wired). The button drives the REAL updater check()
      // against the live GitHub release endpoint (tauri.conf.json), so the outcome
      // is environment-dependent. ALL THREE real outcomes (UpdatesSettings
      // resultLine) are accepted:
      //   • "You're up to date"        — endpoint serves latest.json, not newer;
      //   • "Version X.Y.Z available"  — local version BEHIND the latest published
      //     release (e.g. any branch cut pre-release — a legitimate dev state);
      //   • "Update check failed"      — tolerated ONLY when the runner-side probe
      //     classifies the endpoint as "unreachable", i.e. the TEST RUNNER itself
      //     has no network path (DNS failure, connection refused/reset, timeout —
      //     offline CI / a real external outage). Every other probe verdict FAILS
      //     the gate: "healthy" means a LOCAL updater wiring regression (plugin
      //     unregistered / capability dropped), and "misconfigured" (missing or
      //     malformed endpoint URL, non-2xx such as a 404 from a deleted release
      //     asset, or a latest.json that isn't the updater schema) is a
      //     config/release regression — exactly the class a boolean "reachable"
      //     used to launder into a tolerated false-green.
      const probe = await probeUpdaterEndpoint();
      await clickCheckForUpdates();
      // F5: capture the last-seen readout in the predicate's closure — an `await`
      // inside the timeoutMsg template would evaluate EAGERLY at options-build
      // time and report the pre-poll snapshot, not what timed out on screen.
      let lastResult = "";
      try {
        await browser.waitUntil(
          async () => {
            lastResult = await checkResultText();
            return (
              lastResult.includes("up to date") ||
              lastResult.includes("Update check failed") ||
              /^Version .+ available$/.test(lastResult)
            );
          },
          { timeout: 10_000 },
        );
      } catch {
        throw new Error(
          `expected the Check button to surface an inline result ("You're up to date", "Version X.Y.Z available", or "Update check failed") in the polite live region, got ${JSON.stringify(lastResult)}`,
        );
      }
      if (lastResult.includes("Update check failed")) {
        assert(
          probe.verdict === "unreachable",
          `the app reported "Update check failed", which is tolerated ONLY when the test runner itself has no network path. Runner probe verdict: ${probe.verdict} — ${probe.detail}. ${
            probe.verdict === "healthy"
              ? "The endpoint serves a valid latest.json from this machine, so the app failing is a LOCAL updater wiring regression (plugin unregistered / capability dropped / direct-channel overlay missing)."
              : "The endpoint itself is broken (bad URL, non-2xx / deleted release asset, or a body that is not an updater latest.json) — a config/release REGRESSION, not an external outage."
          }`,
        );
      }

      // (d) The auto-check toggle is keyboard-reachable + operable: focus it +
      // activate → aria-checked flips on (it started off on the fresh state). The
      // flip is async (React re-render after the prefs write), so wait for it.
      assert(
        (await autoCheckToggleChecked()) === false,
        "expected the auto-check toggle to start OFF on the fresh prefs state",
      );
      const focused = await activateAutoCheckToggle();
      assert(focused, "expected the auto-check toggle to be keyboard-focusable");
      await browser.waitUntil(async () => await autoCheckToggleChecked(), {
        timeout: 5_000,
        timeoutMsg: `expected the auto-check toggle to flip ON after keyboard activation, got ${JSON.stringify(await autoCheckToggleChecked())}`,
      });

      // (e) When an update is detected (dev-only inject — the real download/verify
      // is Manual-Only, Plan 05), the pane offers an Install button as a SECOND
      // entry point to the shared install() action (D-25-5 revised). Assert it
      // renders inside the pane AND is keyboard-reachable; do NOT click it (no real
      // artifact to download in the gate).
      await browser.execute(() => {
        (
          window as unknown as {
            __injectUpdate?: (i: {
              version: string;
              notes: string | null;
              date: string | null;
            }) => void;
          }
        ).__injectUpdate?.({ version: "9.9.9", notes: "e2e", date: null });
      });
      const installFocusable = await browser.waitUntil(
        async () =>
          browser.execute(() => {
            const dialog = document.querySelector(
              '[role="dialog"][aria-modal="true"]',
            );
            const btn = Array.from(
              dialog?.querySelectorAll("button") ?? [],
            ).find((b) =>
              (b.textContent ?? "").includes("Install version 9.9.9"),
            ) as HTMLElement | undefined;
            if (!btn) return false;
            btn.focus();
            return document.activeElement === btn;
          }),
        {
          timeout: 5_000,
          timeoutMsg:
            "expected a keyboard-focusable pane Install button after a detected update",
        },
      );
      assert(
        installFocusable === true,
        "expected the pane Install button to be keyboard-focusable",
      );
      // Clear the injected update (also removes the bottom-right banner) so this
      // spec leaves no updater state behind.
      await browser.execute(() => {
        document.getElementById("update-dismiss")?.focus();
      });
      await browser.keys("Enter");
    } finally {
      // Leave no modal open + reset the auto-check toggle so this spec leaves no
      // prefs pollution for later specs in the WDIO run.
      try {
        if (await settingsModalOpen()) {
          if (await autoCheckToggleChecked()) {
          await activateAutoCheckToggle();
          await browser.waitUntil(
            async () => !(await autoCheckToggleChecked()),
            { timeout: 5_000 },
          );
        }
          await dismissModal();
          await browser.waitUntil(async () => !(await settingsModalOpen()), {
            timeout: 5_000,
          });
        }
      } catch (cleanupError) {
        console.error("[settings] Updates pane cleanup failed:", cleanupError);
      }
    }
  });
});
