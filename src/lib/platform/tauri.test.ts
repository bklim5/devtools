// @vitest-environment jsdom
// D-05 autostart-seam no-op (T-29-05): tauri.ts's autostart arm must no-op under
// IS_APPSTORE so a stray call can never reach the COMPILED-OUT autostart plugin
// (Phase 27) and reject with a MissingEntitlement / "plugin not found" under
// sandbox. This file mocks @tauri-apps/* (jsdom has no native bridge) + flips the
// build-time channel constant per describe block, then asserts:
//   • IS_APPSTORE true  → enable/disable resolve WITHOUT touching the plugin fns;
//     isEnabled resolves false. (0 plugin calls.)
//   • IS_APPSTORE false → the three arm fns delegate to the plugin (>=1 call each).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enableSpy = vi.fn(async () => {});
const disableSpy = vi.fn(async () => {});
const isEnabledSpy = vi.fn(async () => true);
// UP5-02: observe the command name + argument shape the review arm invokes.
const invokeSpy = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
);

// IS_APPSTORE is a build-time const read once at tauri.ts module-eval, so each
// channel needs a fresh module import (vi.resetModules + a fresh doMock).
const channelMock = vi.hoisted(() => ({ value: false }));

// Stub every @tauri-apps/* import tauri.ts pulls at module top so the module loads
// under jsdom; only the autostart fns are observed.
function installTauriMocks(): void {
  vi.doMock("@tauri-apps/plugin-autostart", () => ({
    enable: enableSpy,
    disable: disableSpy,
    isEnabled: isEnabledSpy,
  }));
  vi.doMock("@tauri-apps/plugin-clipboard-manager", () => ({
    writeText: vi.fn(),
    readText: vi.fn(),
  }));
  vi.doMock("@tauri-apps/plugin-store", () => ({
    load: vi.fn(async () => ({ get: vi.fn(), set: vi.fn(), save: vi.fn() })),
  }));
  vi.doMock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
  vi.doMock("@tauri-apps/plugin-global-shortcut", () => ({
    register: vi.fn(),
    unregister: vi.fn(),
    isRegistered: vi.fn(),
  }));
  vi.doMock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }));
  vi.doMock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
  vi.doMock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
  vi.doMock("@tauri-apps/api/core", () => ({
    Channel: class {},
    invoke: invokeSpy,
  }));
  vi.doMock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
  vi.doMock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));
  vi.doMock("./channel", () => ({
    get IS_APPSTORE() {
      return channelMock.value;
    },
  }));
}

async function importTauriPlatform(isAppstore: boolean) {
  vi.resetModules();
  channelMock.value = isAppstore;
  enableSpy.mockClear();
  disableSpy.mockClear();
  isEnabledSpy.mockClear();
  invokeSpy.mockClear();
  installTauriMocks();
  const mod = await import("./tauri");
  return mod.tauriPlatform;
}

beforeEach(() => {
  channelMock.value = false;
});

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("tauri autostart seam — D-05 (store build no-op)", () => {
  it("IS_APPSTORE true: enable/disable resolve WITHOUT calling the plugin; isEnabled resolves false", async () => {
    const platform = await importTauriPlatform(true);

    await expect(platform.autostart.enable()).resolves.toBeUndefined();
    await expect(platform.autostart.disable()).resolves.toBeUndefined();
    await expect(platform.autostart.isEnabled()).resolves.toBe(false);

    expect(enableSpy).toHaveBeenCalledTimes(0);
    expect(disableSpy).toHaveBeenCalledTimes(0);
    expect(isEnabledSpy).toHaveBeenCalledTimes(0);
  });

  it("IS_APPSTORE false: the three arm fns delegate to the plugin", async () => {
    const platform = await importTauriPlatform(false);

    await platform.autostart.enable();
    await platform.autostart.disable();
    const on = await platform.autostart.isEnabled();

    expect(enableSpy).toHaveBeenCalledTimes(1);
    expect(disableSpy).toHaveBeenCalledTimes(1);
    expect(isEnabledSpy).toHaveBeenCalledTimes(1);
    expect(on).toBe(true); // delegates → the plugin's resolved value
  });
});

// UP5-02: the review arm is a bare `invoke` of the appstore-only Rust command,
// reusing the already-imported `invoke` (no new @tauri-apps import). The command
// takes NO arguments — the cadence (every 3rd settled success, min 7 days apart)
// lives entirely in the webview, so nothing crosses the IPC boundary that the
// native side could be asked to trust.
describe("tauri review seam — UP5-02 (request_app_store_review)", () => {
  it("review.request() invokes request_app_store_review with no arguments (Test 21)", async () => {
    const platform = await importTauriPlatform(true);

    await platform.review.request();

    expect(invokeSpy).toHaveBeenCalledTimes(1);
    expect(invokeSpy).toHaveBeenCalledWith("request_app_store_review");
    // Exactly ONE argument — no payload object rides along.
    expect(invokeSpy.mock.calls[0]).toHaveLength(1);
  });
});
