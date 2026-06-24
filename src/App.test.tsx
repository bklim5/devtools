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

// Phase 29 (MAS-NATIVE-02/03): the store build mounts NO updater overlay. The whole
// surface (opt-in prompt + UpdateBanner + the launch/tray effects) lives in the lazy
// <UpdaterOverlay/>, gated to null in App.tsx when IS_APPSTORE is true — so the store
// bundle renders no #update-optin / #update-banner, registers 0 onMenuCheckUpdates
// listeners, and invokes platform.updater.check 0 times. IS_APPSTORE is read once at
// App module-eval (it sets the module-level UpdaterOverlay const), so these cases
// vi.resetModules + vi.doMock the channel true and re-import App + the platform seam
// fresh (mirrors main.test.tsx).
describe("App updater integration — store build (IS_APPSTORE true)", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
    vi.doUnmock("@/lib/platform/channel");
    vi.restoreAllMocks();
  });

  async function renderStoreApp(autoUpdateCheck: boolean | null) {
    vi.resetModules();
    vi.doMock("@/lib/platform/channel", () => ({ IS_APPSTORE: true }));

    // Re-import the seam + helpers from the SAME fresh module graph the re-imported
    // App will use, so setPlatformForTest targets the platform singleton App reads.
    const platformMod = await import("@/lib/platform");
    const { createStoreStub: freshStoreStub } = await import("@/lib/platform/stub");
    const { makeMemoryPlatform: freshMemoryPlatform } = await import(
      "@/shell/testStore"
    );
    const prefsMod = await import("@/shell/usePreferences");
    const updaterMod = await import("@/shell/useUpdater");
    const { DEFAULT_PREFERENCES: DEF, PREFERENCES_STORE_KEY: KEY } = await import(
      "@/shell/preferences"
    );
    const { App: FreshApp } = await import("./App");
    const rdom = await import("react-router-dom");

    prefsMod.resetPreferencesForTest();
    updaterMod.resetUpdaterForTest();

    const freshStore = freshStoreStub();
    await freshStore.set(KEY, { ...DEF, autoUpdateCheck });

    const checkSpy = vi.fn(async () => null);
    let storeMenuHandler: (() => void) | undefined;
    const base = freshMemoryPlatform(freshStore);
    const onMenuSpy = vi.fn(async (handler: () => void) => {
      storeMenuHandler = handler;
      return () => {};
    });
    platformMod.setPlatformForTest({
      ...base,
      updater: { ...base.updater, check: checkSpy },
      events: { ...base.events, onMenuCheckUpdates: onMenuSpy },
    });

    const view = render(
      <rdom.MemoryRouter initialEntries={["/tools/protobuf-decoder"]}>
        <rdom.Routes>
          <rdom.Route path="/" element={<FreshApp />}>
            <rdom.Route path="tools/:id" element={<div data-testid="tool" />} />
          </rdom.Route>
        </rdom.Routes>
      </rdom.MemoryRouter>,
    );
    return { view, checkSpy, onMenuSpy, getMenuHandler: () => storeMenuHandler };
  }

  it("with autoUpdateCheck=null (the fresh-install opt-in trigger), renders NO opt-in + NO banner and invokes 0 updater.check / 0 onMenuCheckUpdates", async () => {
    const { checkSpy, onMenuSpy } = await renderStoreApp(null);
    // Let any effects + a lazy import (there is none in the store arm) settle.
    await waitFor(() => expect(document.querySelector("main")).toBeTruthy());
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector("#update-optin")).toBeNull();
    expect(document.querySelector("#update-banner")).toBeNull();
    expect(checkSpy).toHaveBeenCalledTimes(0);
    expect(onMenuSpy).toHaveBeenCalledTimes(0);
  });

  it("with autoUpdateCheck=true (the auto-check trigger), STILL renders NO opt-in + NO banner and invokes 0 updater.check / 0 onMenuCheckUpdates", async () => {
    const { checkSpy, onMenuSpy } = await renderStoreApp(true);
    await waitFor(() => expect(document.querySelector("main")).toBeTruthy());
    await new Promise((r) => setTimeout(r, 20));

    expect(document.querySelector("#update-optin")).toBeNull();
    expect(document.querySelector("#update-banner")).toBeNull();
    expect(checkSpy).toHaveBeenCalledTimes(0);
    expect(onMenuSpy).toHaveBeenCalledTimes(0);
  });
});
