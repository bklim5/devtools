// Platform-seam tests. These run WITHOUT any @tauri-apps mock — the whole point
// of the env-safe seam (HIGH-4) is that importing it under node/jsdom never
// pulls in Tauri. If this file needed a Tauri mock to pass, the seam would be
// leaking its top-level import. It does not.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  platform,
  createPlatform,
  initPlatform,
  setPlatformForTest,
  resetPlatformForTest,
  type Platform,
} from "./index";
import { browserPlatform } from "./browser";

afterEach(() => {
  resetPlatformForTest();
});

describe("platform seam", () => {
  it("delegates clipboard.writeText to the active impl (Test 1)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const stub: Platform = {
      clipboard: { writeText, readText: vi.fn().mockResolvedValue("") },
      store: { get: vi.fn(), set: vi.fn() },
      window: {
        show: vi.fn().mockResolvedValue(undefined),
        setFocus: vi.fn().mockResolvedValue(undefined),
        unminimize: vi.fn().mockResolvedValue(undefined),
        minimize: vi.fn().mockResolvedValue(undefined),
        isVisible: vi.fn().mockResolvedValue(true),
      },
      nativeShortcut: {
        register: vi.fn().mockResolvedValue(undefined),
        unregister: vi.fn().mockResolvedValue(undefined),
        isRegistered: vi.fn().mockResolvedValue(false),
      },
      updater: {
        check: vi.fn().mockResolvedValue(null),
        downloadAndInstall: vi.fn().mockResolvedValue(undefined),
      },
      events: {
        onMenuCheckUpdates: vi.fn().mockResolvedValue(() => {}),
        onOpenSettings: vi.fn().mockResolvedValue(() => {}),
      },
      license: {
        status: vi.fn().mockResolvedValue({
          state: "notActivated",
          hasStoredKey: false,
        }),
        statusDetail: vi.fn().mockResolvedValue({
          state: "notActivated",
          hasStoredKey: false,
        }),
        activate: vi.fn(),
        refresh: vi.fn(),
        deactivate: vi.fn(),
      },
      opener: { openUrl: vi.fn().mockResolvedValue(undefined) },
      autostart: {
        enable: vi.fn().mockResolvedValue(undefined),
        disable: vi.fn().mockResolvedValue(undefined),
        isEnabled: vi.fn().mockResolvedValue(false),
      },
      app: { getVersion: vi.fn().mockResolvedValue("0.0.0-test") },
    };
    setPlatformForTest(stub);

    await platform.clipboard.writeText("hello");

    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("store stub round-trips get/set without throwing (Test 2)", async () => {
    // Use the real browser-fallback in-memory store stub.
    setPlatformForTest(browserPlatform);

    await expect(platform.store.set("k", 42)).resolves.toBeUndefined();
    await expect(platform.store.get("k")).resolves.toBe(42);
    await expect(platform.store.get("missing")).resolves.toBeUndefined();
  });

  it("importing the seam does NOT require a @tauri-apps mock (Test 3)", async () => {
    // Outside Tauri (`__TAURI_INTERNALS__` absent under node/jsdom),
    // createPlatform() resolves the browser fallback — it never imports ./tauri,
    // so @tauri-apps/* is never loaded and this test passes with NO mock.
    expect("__TAURI_INTERNALS__" in (globalThis as Record<string, unknown>)).toBe(false);
    const impl = await createPlatform();
    expect(impl).toBe(browserPlatform);
  });

  it("browser fallback routes clipboard.writeText to navigator.clipboard (Test 4)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // Provide a navigator.clipboard for the duration of this test.
    vi.stubGlobal("navigator", { clipboard: { writeText, readText: vi.fn() } });

    await browserPlatform.clipboard.writeText("via-navigator");

    expect(writeText).toHaveBeenCalledWith("via-navigator");
    vi.unstubAllGlobals();
  });
});

// NAT-01: the seam's two new native capabilities. Outside Tauri (jsdom) they MUST
// degrade to harmless no-ops so tests + `vite preview` never throw (threat T-05-05),
// and the `platform` accessor MUST forward them to the active impl (getter wiring).
describe("platform seam — native capabilities (NAT-01)", () => {
  it("nativeShortcut.isRegistered resolves false under the browser fallback (Test 5)", async () => {
    setPlatformForTest(browserPlatform);
    await expect(platform.nativeShortcut.isRegistered("CmdOrCtrl+Shift+K")).resolves.toBe(
      false,
    );
  });

  it("nativeShortcut.register/unregister resolve without throwing in the fallback (Test 6)", async () => {
    setPlatformForTest(browserPlatform);
    // No-op register does NOT invoke the handler and does NOT touch @tauri-apps.
    const handler = vi.fn();
    await expect(
      platform.nativeShortcut.register("CmdOrCtrl+Shift+K", handler),
    ).resolves.toBeUndefined();
    await expect(
      platform.nativeShortcut.unregister("CmdOrCtrl+Shift+K"),
    ).resolves.toBeUndefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it("window no-ops resolve in the fallback; isVisible resolves true (Test 7)", async () => {
    setPlatformForTest(browserPlatform);
    await expect(platform.window.isVisible()).resolves.toBe(true);
    await expect(platform.window.show()).resolves.toBeUndefined();
    await expect(platform.window.setFocus()).resolves.toBeUndefined();
    await expect(platform.window.unminimize()).resolves.toBeUndefined();
    await expect(platform.window.minimize()).resolves.toBeUndefined();
  });

  it("accessor delegates nativeShortcut/window to an injected stub (Test 8)", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const show = vi.fn().mockResolvedValue(undefined);
    const stub: Platform = {
      clipboard: { writeText: vi.fn(), readText: vi.fn() },
      store: { get: vi.fn(), set: vi.fn() },
      window: {
        show,
        setFocus: vi.fn(),
        unminimize: vi.fn(),
        minimize: vi.fn(),
        isVisible: vi.fn(),
      },
      nativeShortcut: {
        register,
        unregister: vi.fn(),
        isRegistered: vi.fn(),
      },
      updater: {
        check: vi.fn().mockResolvedValue(null),
        downloadAndInstall: vi.fn().mockResolvedValue(undefined),
      },
      events: {
        onMenuCheckUpdates: vi.fn().mockResolvedValue(() => {}),
        onOpenSettings: vi.fn().mockResolvedValue(() => {}),
      },
      license: {
        status: vi.fn().mockResolvedValue({
          state: "notActivated",
          hasStoredKey: false,
        }),
        statusDetail: vi.fn().mockResolvedValue({
          state: "notActivated",
          hasStoredKey: false,
        }),
        activate: vi.fn(),
        refresh: vi.fn(),
        deactivate: vi.fn(),
      },
      opener: { openUrl: vi.fn().mockResolvedValue(undefined) },
      autostart: {
        enable: vi.fn().mockResolvedValue(undefined),
        disable: vi.fn().mockResolvedValue(undefined),
        isEnabled: vi.fn().mockResolvedValue(false),
      },
      app: { getVersion: vi.fn().mockResolvedValue("0.0.0-test") },
    };
    setPlatformForTest(stub);

    const handler = () => {};
    await platform.nativeShortcut.register("CmdOrCtrl+Shift+K", handler);
    await platform.window.show();

    expect(register).toHaveBeenCalledWith("CmdOrCtrl+Shift+K", handler);
    expect(show).toHaveBeenCalledTimes(1);
  });
});

// DST-02: the seam's auto-updater capability. Outside Tauri (jsdom) it MUST be a
// harmless no-op so tests + `vite preview` never make a network call (threat
// T-06-05), and the `platform` accessor MUST forward it to the active impl.
describe("platform seam — auto-updater (DST-02)", () => {
  it("updater.check resolves null under the browser fallback (Test 9)", async () => {
    setPlatformForTest(browserPlatform);
    await expect(platform.updater.check()).resolves.toBeNull();
  });

  it("updater.downloadAndInstall resolves without throwing in the fallback (Test 10)", async () => {
    setPlatformForTest(browserPlatform);
    // No-op install never touches @tauri-apps and never relaunches under jsdom.
    await expect(platform.updater.downloadAndInstall()).resolves.toBeUndefined();
  });

  it("accessor delegates updater.check to an injected stub (Test 11)", async () => {
    const checkUpdate = vi.fn().mockResolvedValue({
      version: "0.3.0",
      notes: "new",
      date: null,
    });
    const stub: Platform = {
      clipboard: { writeText: vi.fn(), readText: vi.fn() },
      store: { get: vi.fn(), set: vi.fn() },
      window: {
        show: vi.fn(),
        setFocus: vi.fn(),
        unminimize: vi.fn(),
        minimize: vi.fn(),
        isVisible: vi.fn(),
      },
      nativeShortcut: {
        register: vi.fn(),
        unregister: vi.fn(),
        isRegistered: vi.fn(),
      },
      updater: {
        check: checkUpdate,
        downloadAndInstall: vi.fn().mockResolvedValue(undefined),
      },
      events: {
        onMenuCheckUpdates: vi.fn().mockResolvedValue(() => {}),
        onOpenSettings: vi.fn().mockResolvedValue(() => {}),
      },
      license: {
        status: vi.fn().mockResolvedValue({
          state: "notActivated",
          hasStoredKey: false,
        }),
        statusDetail: vi.fn().mockResolvedValue({
          state: "notActivated",
          hasStoredKey: false,
        }),
        activate: vi.fn(),
        refresh: vi.fn(),
        deactivate: vi.fn(),
      },
      opener: { openUrl: vi.fn().mockResolvedValue(undefined) },
      autostart: {
        enable: vi.fn().mockResolvedValue(undefined),
        disable: vi.fn().mockResolvedValue(undefined),
        isEnabled: vi.fn().mockResolvedValue(false),
      },
      app: { getVersion: vi.fn().mockResolvedValue("0.0.0-test") },
    };
    setPlatformForTest(stub);

    await expect(platform.updater.check()).resolves.toMatchObject({ version: "0.3.0" });
    expect(checkUpdate).toHaveBeenCalledTimes(1);
  });
});

// SET-01/02 + HIGH-22-01: App.tsx subscribes the native menu/tray Settings +
// Check-Updates events through the seam, but `platform.events` is a getter over
// the CURRENT impl (the browser stub until initPlatform() resolves). The fix is
// to `await initPlatform()` BEFORE reading `platform.events` — so the listener
// binds to the RESOLVED impl, never the pre-init stub. This asserts that
// contract: reading the accessor AFTER awaiting init routes to the resolved impl.
describe("platform seam — events bind to the resolved impl (HIGH-22-01)", () => {
  it("platform.events after `await initPlatform()` routes to the resolved impl, not the browser stub (Test 15)", async () => {
    const onOpenSettings = vi.fn().mockResolvedValue(() => {});
    const onMenuCheckUpdates = vi.fn().mockResolvedValue(() => {});
    const stub: Platform = {
      clipboard: { writeText: vi.fn(), readText: vi.fn() },
      store: { get: vi.fn(), set: vi.fn() },
      window: {
        show: vi.fn(),
        setFocus: vi.fn(),
        unminimize: vi.fn(),
        minimize: vi.fn(),
        isVisible: vi.fn(),
      },
      nativeShortcut: {
        register: vi.fn(),
        unregister: vi.fn(),
        isRegistered: vi.fn(),
      },
      updater: {
        check: vi.fn().mockResolvedValue(null),
        downloadAndInstall: vi.fn().mockResolvedValue(undefined),
      },
      events: { onMenuCheckUpdates, onOpenSettings },
      license: {
        status: vi.fn().mockResolvedValue({
          state: "notActivated",
          hasStoredKey: false,
        }),
        statusDetail: vi.fn().mockResolvedValue({
          state: "notActivated",
          hasStoredKey: false,
        }),
        activate: vi.fn(),
        refresh: vi.fn(),
        deactivate: vi.fn(),
      },
      opener: { openUrl: vi.fn().mockResolvedValue(undefined) },
      autostart: {
        enable: vi.fn().mockResolvedValue(undefined),
        disable: vi.fn().mockResolvedValue(undefined),
        isEnabled: vi.fn().mockResolvedValue(false),
      },
      app: { getVersion: vi.fn().mockResolvedValue("0.0.0-test") },
    };
    // setPlatformForTest seeds the memoised init promise with the stub, so
    // `await initPlatform()` resolves to it — mirroring how App.tsx awaits init
    // before reading the events accessor.
    setPlatformForTest(stub);

    const handler = () => {};
    // The App.tsx pattern: await init FIRST, THEN read platform.events.
    await initPlatform();
    await platform.events.onOpenSettings(handler);
    await platform.events.onMenuCheckUpdates(handler);

    expect(onOpenSettings).toHaveBeenCalledWith(handler);
    expect(onMenuCheckUpdates).toHaveBeenCalledWith(handler);
  });
});

// LIC-01..04: the seam's license capability. Outside Tauri the arms MUST be
// deterministic — status is always notActivated and mutations reject with the
// same `{ code }` shape the real Rust commands serialize, never a network call
// (the ENT-03 mirror) — and the `platform` accessor MUST forward the capability
// to the active impl so Plan 04's UI tests can inject a custom license stub.
describe("platform seam — license (LIC-01..04)", () => {
  it("browser fallback license.status resolves notActivated deterministically (Test 12)", async () => {
    setPlatformForTest(browserPlatform);
    await expect(platform.license.status()).resolves.toEqual({
      state: "notActivated",
      hasStoredKey: false,
    });
  });

  it("browser fallback license mutations reject with the serviceUnreachable code (Test 13)", async () => {
    setPlatformForTest(browserPlatform);
    await expect(platform.license.activate("x")).rejects.toEqual({
      code: "serviceUnreachable",
    });
    await expect(platform.license.refresh()).rejects.toEqual({
      code: "serviceUnreachable",
    });
    await expect(platform.license.deactivate()).rejects.toEqual({
      code: "serviceUnreachable",
    });
  });

  it("browser fallback opener.openUrl resolves without navigating (Test 14b, PAY-01/D-67)", async () => {
    // Opening external URLs is Tauri-only: the browser/test arm is a deterministic
    // no-op that NEVER navigates jsdom — mirrors the license-arm determinism.
    setPlatformForTest(browserPlatform);
    const hrefBefore =
      typeof window !== "undefined" ? window.location.href : undefined;
    await expect(
      platform.opener.openUrl("https://tinkerdev.io/buy"),
    ).resolves.toBeUndefined();
    if (typeof window !== "undefined") {
      expect(window.location.href).toBe(hrefBefore);
    }
  });

  it("accessor routes opener through an injected custom stub (Test 14c)", async () => {
    const openUrl = vi.fn().mockResolvedValue(undefined);
    const stub: Platform = { ...browserPlatform, opener: { openUrl } };
    setPlatformForTest(stub);
    await platform.opener.openUrl("https://x.example/");
    expect(openUrl).toHaveBeenCalledWith("https://x.example/");
  });

  it("accessor routes license through an injected custom stub (Test 14)", async () => {
    const status = vi.fn().mockResolvedValue({
      state: "licensed",
      expiry: null,
      entitlements: ["pro.theming"],
    });
    const activate = vi.fn().mockResolvedValue({
      state: "licensed",
      expiry: null,
      entitlements: [],
    });
    const stub: Platform = {
      ...browserPlatform,
      license: {
        status,
        statusDetail: vi.fn(),
        activate,
        refresh: vi.fn(),
        deactivate: vi.fn(),
      },
    };
    setPlatformForTest(stub);

    await expect(platform.license.status()).resolves.toMatchObject({
      state: "licensed",
      entitlements: ["pro.theming"],
    });
    await platform.license.activate("KEY-1");
    expect(status).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledWith("KEY-1");
  });
});

// SET-10 / D-25-2: the seam's app-metadata capability. Outside Tauri (jsdom) it
// MUST resolve a safe fallback string with NO native call so tests + `vite
// preview` never touch the runtime, and the `platform` accessor MUST forward
// app.getVersion() to the ACTIVE impl (getter wiring, not a snapshot) so the
// Updates pane (Plan 04) reads the real version in the packaged app.
describe("platform seam — app.getVersion (SET-10)", () => {
  it("browser fallback app.getVersion resolves a non-empty string with no native call (Test 16)", async () => {
    setPlatformForTest(browserPlatform);
    const v = await platform.app.getVersion();
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });

  it("accessor delegates app.getVersion to the active injected impl (Test 17)", async () => {
    // Spread the shared factory and override ONLY the app arm so the delegate is
    // proven to read the active impl (not a snapshot) — the sentinel can only
    // surface if `platform.app` forwards to the injected stub.
    const stub: Platform = {
      ...browserPlatform,
      app: { getVersion: vi.fn().mockResolvedValue("9.9.9-fixture") },
    };
    setPlatformForTest(stub);
    await expect(platform.app.getVersion()).resolves.toBe("9.9.9-fixture");
  });
});
