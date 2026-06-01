// Platform-seam tests. These run WITHOUT any @tauri-apps mock — the whole point
// of the env-safe seam (HIGH-4) is that importing it under node/jsdom never
// pulls in Tauri. If this file needed a Tauri mock to pass, the seam would be
// leaking its top-level import. It does not.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  platform,
  createPlatform,
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
    };
    setPlatformForTest(stub);

    await expect(platform.updater.check()).resolves.toMatchObject({ version: "0.3.0" });
    expect(checkUpdate).toHaveBeenCalledTimes(1);
  });
});
