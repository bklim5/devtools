// Shared test helper: a fresh in-memory Platform whose Store is the same Map-
// backed stub the seam already uses (createStoreStub). Tests inject it via
// setPlatformForTest so prefs/recents round-trip through the REAL seam without
// importing @tauri-apps. Reuses the stub — does NOT hand-roll a new one.
import { createLicenseStub, createStoreStub } from "@/lib/platform/stub";
import type { Platform, Store } from "@/lib/platform";

/** Shared no-op native caps for test Platform stubs (NAT-01). A single source of
 *  truth so every inline `Platform` literal satisfies the widened interface
 *  without hand-rolling (and re-drifting) the window/nativeShortcut shape. */
export const noopWindow: Platform["window"] = {
  show: async () => {},
  setFocus: async () => {},
  unminimize: async () => {},
  minimize: async () => {},
  isVisible: async () => true,
};

export const noopNativeShortcut: Platform["nativeShortcut"] = {
  register: async () => {},
  unregister: async () => {},
  isRegistered: async () => false,
};

/** Shared no-op updater for test Platform stubs (DST-02). Resolves "no update"
 *  and a no-op install so the widened interface is satisfied everywhere without
 *  re-drifting the updater shape in each inline literal. */
export const noopUpdater: Platform["updater"] = {
  check: async () => null,
  downloadAndInstall: async () => {},
};

/** Shared no-op tray/menu events for test Platform stubs (DST-02). The
 *  `menu://check-updates` subscription never fires under jsdom; the returned
 *  unsubscribe is a no-op. One source of truth so every inline literal satisfies
 *  the widened interface without re-drifting the events shape. */
export const noopEvents: Platform["events"] = {
  onMenuCheckUpdates: async () => () => {},
  // SET-01/02: the `menu://open-settings` subscription never fires under jsdom; the
  // returned unsubscribe is a no-op. One source of truth so every inline literal /
  // makeMemoryPlatform spread satisfies the widened interface without re-drifting.
  onOpenSettings: async () => () => {},
};

/** Shared deterministic license arm for test Platform stubs (LIC-01..04):
 *  the same notActivated/serviceUnreachable stub the browser fallback uses,
 *  so jsdom tests never touch licensing or the network. */
export const noopLicense: Platform["license"] = createLicenseStub();

/** Shared no-op opener for test Platform stubs (PAY-01, D-67): opening external
 *  URLs is Tauri-only, so jsdom/vite-preview NEVER navigate — one source of truth
 *  so every inline literal satisfies the widened interface without re-drifting. */
export const noopOpener: Platform["opener"] = {
  openUrl: async () => {},
};

/** Shared no-op autostart for test Platform stubs (SET-09, D-24-7): launch-at-login
 *  is Tauri-only, so jsdom/vite-preview NEVER touch the OS (isEnabled -> false) —
 *  one source of truth so every inline literal / makeMemoryPlatform spread satisfies
 *  the widened interface without re-drifting. */
export const noopAutostart: Platform["autostart"] = {
  async enable() {},
  async disable() {},
  async isEnabled() {
    return false;
  },
};

/** Shared app-metadata arm for test Platform stubs (SET-10, D-25-2): outside Tauri
 *  there is no native version, so getVersion() resolves a deterministic test
 *  sentinel — one source of truth so every inline literal / makeMemoryPlatform
 *  spread satisfies the widened interface without re-drifting. */
export const noopApp: Platform["app"] = {
  async getVersion() {
    return "0.0.0-test";
  },
};

export function makeMemoryPlatform(
  store: Store = createStoreStub(),
  /** Optional license arm override (Phase 21 D-85 flip tests): drive a specific
   *  license_status so resolveEntitlements / LicenseSettings can exercise each
   *  state. Defaults to the deterministic notActivated stub. */
  license: Platform["license"] = noopLicense,
): Platform {
  return {
    clipboard: { writeText: async () => {}, readText: async () => "" },
    store,
    window: noopWindow,
    nativeShortcut: noopNativeShortcut,
    updater: noopUpdater,
    events: noopEvents,
    license,
    opener: noopOpener,
    autostart: noopAutostart,
    app: noopApp,
  };
}
