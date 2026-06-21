// @vitest-environment jsdom
// App-level integration: the silent-launch check AND the tray check now route
// through the SHARED useUpdater hook (D-25-3) — App.tsx has NO direct
// checkForUpdate/installUpdate path. These cases drive the REAL hook (not a mock):
// they stub only the platform seam (updater.check + the onMenuCheckUpdates event)
// and assert the check fired ONCE through the hook AND lastUpdateCheck landed on
// the shared prefs blob. (The real download/verify round-trip + the on-disk
// prefs.json persistence are Plan 05 real-WKWebView gates.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";
import {
  getSharedPreferences,
  resetPreferencesForTest,
} from "@/shell/usePreferences";
import { resetUpdaterForTest } from "@/shell/useUpdater";
import { DEFAULT_PREFERENCES, PREFERENCES_STORE_KEY } from "@/shell/preferences";
import { App } from "./App";

/** App renders an <Outlet/>, so mount it as the element of a parent route. */
function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/tools/protobuf-decoder"]}>
      <Routes>
        <Route path="/" element={<App />}>
          <Route path="tools/:id" element={<div data-testid="tool" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

let store: Store;
let check: Platform["updater"]["check"] & ReturnType<typeof vi.fn>;
/** Captured handler the App registered for the tray menu://check-updates event. */
let menuHandler: (() => void) | undefined;

beforeEach(() => {
  resetPreferencesForTest();
  resetUpdaterForTest();
  store = createStoreStub();
  check = vi.fn<Platform["updater"]["check"]>(async () => null);
  menuHandler = undefined;
  const base = makeMemoryPlatform(store);
  const platform: Platform = {
    ...base,
    updater: { ...base.updater, check },
    events: {
      ...base.events,
      onMenuCheckUpdates: async (handler: () => void) => {
        menuHandler = handler;
        return () => {};
      },
    },
  };
  setPlatformForTest(platform);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
  vi.restoreAllMocks();
});

describe("App updater integration (D-25-3 — shared hook)", () => {
  it("SILENT-LAUNCH: with autoUpdateCheck opted in, mounting App fires the check through the hook and stamps lastUpdateCheck", async () => {
    // Opt in so the silent launch check is allowed to run (D-09).
    await store.set(PREFERENCES_STORE_KEY, {
      ...DEFAULT_PREFERENCES,
      autoUpdateCheck: true,
    });
    renderApp();
    // The launch effect waits for prefsLoaded, then dispatches runCheck(false).
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(typeof getSharedPreferences().lastUpdateCheck).toBe("number"),
    );
  });

  it("does NOT auto-check when the user has not opted in (offline-by-design)", async () => {
    // Default autoUpdateCheck is null ("never asked") → no automatic network call.
    renderApp();
    // Let the tray listener register (proves init + effects have run a full tick),
    // then assert the silent launch check never fired and nothing was stamped.
    await waitFor(() => expect(menuHandler).toBeTypeOf("function"));
    expect(check).not.toHaveBeenCalled();
    expect(getSharedPreferences().lastUpdateCheck).toBeNull();
  });

  it("TRAY: the menu://check-updates event fires runCheck(true) through the hook and stamps lastUpdateCheck", async () => {
    renderApp();
    // Wait for the (init-awaited) tray listener to register its handler.
    await waitFor(() => expect(menuHandler).toBeTypeOf("function"));
    menuHandler?.();
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(typeof getSharedPreferences().lastUpdateCheck).toBe("number"),
    );
  });
});
