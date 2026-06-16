// Appearance pane — real macOS WKWebView gate (Phase 23, 23-03; SET-07,
// D-23-2/D-23-3/D-23-9).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only). Run by
// scripts/e2e-spike.sh; auto-discovered by wdio.conf.ts.
//
// This spec proves the WebDriver-drivable Appearance behaviors — the no-flash
// launch frame + the OS-appearance live flip are the Manual-Only items in
// 23-VALIDATION.md (the phase-boundary human walkthrough, Task 4):
//   1. PENDING preview is CONTAINED pre-Save: picking Light + Violet updates the
//      preview strip but documentElement stays UNCHANGED (no data-theme, the
//      contained-preview invariant D-23-3).
//   2. A Pro Save applies LIVE whole-app: documentElement gets data-theme="light"
//      and the computed --color-accent resolves to the violet LIGHT hex #6d28d9
//      — no restart (D-23-9, the App-root useAppearance effect).
//   3. PERSISTENCE: re-opening Settings ▸ Appearance reads the Light card + Violet
//      swatch as selected (aria-checked) — the prefs seam round-tripped. (Full
//      quit/relaunch restore is Manual-Only — Task 4.)
//
// MEMORY: license-walkthrough-state-pollutes-e2e — the e2e-spike preflight wipes
// prefs.json + machine.dev.lic to a deterministic FREE baseline. Pro must be
// established via the ⌘K dev toggle (ensureProTier); the finally block resets to
// defaults + ensureFreeTier so this spec leaves no state pollution for later specs.

import {
  assert,
  ensureFreeTier,
  ensureProTier,
  navigateToTool,
  saveScreenshot,
} from "./helpers";

// The violet swatch's LIGHT accent variant (ACCENT_SCALE, Plan 01). The applied
// --color-accent under [data-theme="light"] must resolve to this.
const VIOLET_LIGHT_HEX = "#6d28d9";
// #6d28d9 → rgb(109, 40, 217). getComputedStyle may return either form.
const VIOLET_LIGHT_RGB = "rgb(109, 40, 217)";

/** Open the Settings modal on the License pane via the deep-link, then click the
 *  "Appearance" pane-nav button (asserting aria-current lands on it). Returns
 *  once the Appearance header is mounted in the dialog. */
async function openAppearancePane(): Promise<void> {
  await browser.execute(() => {
    window.location.hash = "#/settings/license";
  });
  await browser.waitUntil(
    async () =>
      browser.execute(
        () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
      ),
    {
      timeout: 10_000,
      timeoutMsg: "expected the Settings modal to open from the #/settings/license deep-link",
    },
  );
  // Click the Appearance pane-nav button (left nav button list, scoped to the dialog).
  await browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("nav button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "Appearance",
    ) as HTMLElement | undefined;
    btn?.click();
  });
  // aria-current="page" on the Appearance nav button confirms the pane switched.
  await browser.waitUntil(
    async () =>
      browser.execute(() => {
        const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
        const current = dialog?.querySelector('[aria-current="page"]');
        return (current?.textContent ?? "").includes("Appearance");
      }),
    {
      timeout: 5_000,
      timeoutMsg: 'expected the Appearance pane nav button to carry aria-current="page"',
    },
  );
}

/** Click a theme card (role="radio") by its visible label inside the dialog. */
function clickThemeCard(label: string): Promise<void> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const card = Array.from(
      dialog?.querySelectorAll('[role="radiogroup"][aria-label="Theme"] [role="radio"]') ?? [],
    ).find((b) => (b.textContent ?? "").includes(l)) as HTMLElement | undefined;
    card?.click();
  }, label);
}

/** Click an accent swatch (role="radio") by its aria-label inside the dialog. */
function clickAccentSwatch(label: string): Promise<void> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const sw = Array.from(
      dialog?.querySelectorAll(
        '[role="radiogroup"][aria-label="Accent color"] [role="radio"]',
      ) ?? [],
    ).find((b) => b.getAttribute("aria-label") === l) as HTMLElement | undefined;
    sw?.click();
  }, label);
}

/** Click the Save button (Pro tier — visible text "Save") inside the dialog. */
function clickSave(): Promise<void> {
  return browser.execute(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const btn = Array.from(dialog?.querySelectorAll("button") ?? []).find(
      (b) => (b.textContent ?? "").trim() === "Save",
    ) as HTMLElement | undefined;
    btn?.click();
  });
}

/** Read documentElement's data-theme attribute (null when absent = dark). */
function rootDataTheme(): Promise<string | null> {
  return browser.execute(() => document.documentElement.getAttribute("data-theme"));
}

/** Read the computed --color-accent on documentElement (rgb(...) or hex form). */
function computedAccent(): Promise<string> {
  return browser.execute(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim(),
  );
}

/** Whether a theme card / accent swatch reads selected (aria-checked="true"). */
function themeCardChecked(label: string): Promise<boolean> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const card = Array.from(
      dialog?.querySelectorAll('[role="radiogroup"][aria-label="Theme"] [role="radio"]') ?? [],
    ).find((b) => (b.textContent ?? "").includes(l));
    return card?.getAttribute("aria-checked") === "true";
  }, label);
}

function accentSwatchChecked(label: string): Promise<boolean> {
  return browser.execute((l: string) => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const sw = Array.from(
      dialog?.querySelectorAll(
        '[role="radiogroup"][aria-label="Accent color"] [role="radio"]',
      ) ?? [],
    ).find((b) => b.getAttribute("aria-label") === l);
    return sw?.getAttribute("aria-checked") === "true";
  }, label);
}

/** Dismiss the Settings modal via Escape (its document-level keydown listener). */
function dismissModal(): Promise<void> {
  return browser.execute(() => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
}

function settingsModalOpen(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('[role="dialog"][aria-modal="true"]') !== null,
  );
}

/** Reset appearance to defaults (Dark + Blue) + Save, so the spec leaves the
 *  app in the deterministic baseline for later specs. Pro must still be live. */
async function resetAppearanceToDefault(): Promise<void> {
  await openAppearancePane();
  await clickThemeCard("Dark");
  await clickAccentSwatch("Blue");
  await clickSave();
  await browser.waitUntil(async () => (await rootDataTheme()) === null, {
    timeout: 5_000,
    timeoutMsg: "expected documentElement to return to dark (no data-theme) after the reset Save",
  });
  await dismissModal();
  await browser.waitUntil(async () => !(await settingsModalOpen()), { timeout: 5_000 });
}

describe("Appearance pane (real WKWebView)", () => {
  it("Pro Save applies the theme+accent live whole-app, the pending preview is contained pre-Save, and the choice persists (SET-07)", async () => {
    await navigateToTool("protobuf-decoder");
    const firstHandle = await $('button[aria-label^="Reorder "]');
    await firstHandle.waitForExist({ timeout: 15_000 });

    // Establish Pro so Save persists (ENT_THEMING) — the post-D-85 baseline is FREE.
    await ensureProTier();

    try {
      await openAppearancePane();

      // BEFORE Save: pick Light + Violet (pending state) — the preview reflects
      // them, but documentElement stays UNCHANGED (contained preview, D-23-3).
      await clickThemeCard("Light");
      await clickAccentSwatch("Violet");
      // The pending selection is reflected in the pane (aria-checked) WITHOUT any
      // global mutation: data-theme is still absent (dark) on documentElement.
      await browser.waitUntil(async () => themeCardChecked("Light"), {
        timeout: 5_000,
        timeoutMsg: "expected the Light theme card to read selected (pending) before Save",
      });
      assert(
        await accentSwatchChecked("Violet"),
        "expected the Violet accent swatch to read selected (pending) before Save",
      );
      assert(
        (await rootDataTheme()) === null,
        `documentElement must be UNCHANGED before Save (contained preview, D-23-3) — got data-theme=${JSON.stringify(await rootDataTheme())}`,
      );

      // Click Save → live whole-app apply (D-23-9): data-theme="light" + the violet
      // LIGHT accent resolved on documentElement, with NO restart.
      await clickSave();
      await browser.waitUntil(async () => (await rootDataTheme()) === "light", {
        timeout: 5_000,
        timeoutMsg: 'expected documentElement data-theme="light" after a Pro Save (live apply, D-23-9)',
      });
      const accent = await computedAccent();
      assert(
        accent.toLowerCase() === VIOLET_LIGHT_HEX || accent === VIOLET_LIGHT_RGB,
        `expected the computed --color-accent to be the violet LIGHT variant (${VIOLET_LIGHT_HEX} / ${VIOLET_LIGHT_RGB}), got ${JSON.stringify(accent)}`,
      );
      await saveScreenshot("appearance", "appearance-live-light-violet.png", "live-light");

      // PERSISTENCE: re-open Settings ▸ Appearance — the Light card + Violet swatch
      // read as selected (the prefs seam round-tripped). Full quit/relaunch restore
      // is Manual-Only (Task 4).
      await dismissModal();
      await browser.waitUntil(async () => !(await settingsModalOpen()), { timeout: 5_000 });
      await openAppearancePane();
      await browser.waitUntil(async () => themeCardChecked("Light"), {
        timeout: 5_000,
        timeoutMsg: "expected the Light theme card to persist as selected on re-open",
      });
      assert(
        await accentSwatchChecked("Violet"),
        "expected the Violet accent swatch to persist as selected on re-open",
      );
    } finally {
      // Reset to defaults (dark + blue) + drop back to the FREE baseline so this
      // spec leaves no theme/accent or tier pollution for later specs.
      try {
        if (!(await settingsModalOpen())) {
          await openAppearancePane();
        }
        await dismissModal();
        await browser.waitUntil(async () => !(await settingsModalOpen()), { timeout: 5_000 }).catch(() => {});
        await resetAppearanceToDefault();
        await ensureFreeTier();
      } catch (cleanupError) {
        console.error("[appearance] cleanup failed:", cleanupError);
      }
    }
  });
});
