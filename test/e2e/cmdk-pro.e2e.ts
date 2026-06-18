// Phase 22.2 — the ⌘K command palette is Pro-gated. Real-WKWebView proof that:
//   • a FREE user's ⌘K opens the focused Unlock-Pro MODAL, NOT the palette;
//   • a FREE user's locked customization trigger (pin click) opens that SAME modal;
//   • a PRO user's ⌘K opens the palette as normal.
//
// Tier is established via the hardened ensureFreeTier/ensureProTier helpers (the
// ⌘K dev-toggle, force-opened with ⌘⇧K so it works even while gated). The focused
// modal is the standalone aria-modal dialog labelled by "upsell-heading"
// (stackedUpsellModalPresent); the palette is its "Search tools" input.
import {
  assert,
  ensureFreeTier,
  ensureProTier,
  stackedUpsellModalPresent,
} from "./helpers";

/** Dispatch a PLAIN ⌘K on window (the gated chord — NOT the ⌘⇧K dev escape). */
function pressMetaK(): Promise<void> {
  return browser.execute(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "k",
        code: "KeyK",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

/** Whether the ⌘K command palette is open (its search input is mounted). */
function paletteOpen(): Promise<boolean> {
  return browser.execute(
    () => document.querySelector('input[aria-label="Search tools"]') !== null,
  );
}

/** Close any open overlay (modal/palette) with Escape, dispatched on document. */
function pressEscape(): Promise<void> {
  return browser.execute(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
}

/** Click the first sidebar pin button (a locked customization affordance). */
function clickFirstPin(): Promise<boolean> {
  return browser.execute(() => {
    const pin = document.querySelector(
      'aside button[aria-label^="Pin "]',
    ) as HTMLElement | null;
    if (!pin) return false;
    pin.click();
    return true;
  });
}

describe("Phase 22.2 — ⌘K Pro gate + focused Unlock-Pro modal", () => {
  afterEach(async () => {
    // Leave the app at the FREE baseline (the e2e-spike preflight default) so the
    // next spec starts clean; close any overlay first.
    await pressEscape();
    await ensureFreeTier();
  });

  it("FREE: ⌘K opens the focused Unlock-Pro modal, NOT the palette", async () => {
    await ensureFreeTier();
    await pressMetaK();

    await browser.waitUntil(async () => stackedUpsellModalPresent(), {
      timeout: 8_000,
      timeoutMsg: "expected a free user's ⌘K to open the focused Unlock-Pro modal",
    });
    assert(!(await paletteOpen()), "the command palette must NOT open for a free user");
  });

  it("FREE: a locked pin click opens the focused Unlock-Pro modal", async () => {
    await ensureFreeTier();
    await pressEscape(); // ensure no stale overlay

    assert(await clickFirstPin(), "expected a sidebar pin button to be present");
    await browser.waitUntil(async () => stackedUpsellModalPresent(), {
      timeout: 8_000,
      timeoutMsg: "expected a locked pin click to open the focused Unlock-Pro modal",
    });
  });

  it("PRO: ⌘K opens the command palette as normal (no upsell)", async () => {
    await ensureProTier();
    await pressMetaK();

    const input = await $('input[aria-label="Search tools"]');
    await input.waitForExist({
      timeout: 8_000,
      timeoutMsg: "expected a Pro user's ⌘K to open the command palette",
    });
    assert(
      !(await stackedUpsellModalPresent()),
      "the upsell modal must NOT open for a Pro user",
    );
    await pressEscape();
  });
});
