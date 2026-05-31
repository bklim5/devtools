// Shared test helper: a fresh in-memory Platform whose Store is the same Map-
// backed stub the seam already uses (createStoreStub). Tests inject it via
// setPlatformForTest so prefs/recents round-trip through the REAL seam without
// importing @tauri-apps. Reuses the stub — does NOT hand-roll a new one.
import { createStoreStub } from "@/lib/platform/stub";
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

export function makeMemoryPlatform(store: Store = createStoreStub()): Platform {
  return {
    clipboard: { writeText: async () => {}, readText: async () => "" },
    store,
    window: noopWindow,
    nativeShortcut: noopNativeShortcut,
  };
}
