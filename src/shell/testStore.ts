// Shared test helper: a fresh in-memory Platform whose Store is the same Map-
// backed stub the seam already uses (createStoreStub). Tests inject it via
// setPlatformForTest so prefs/recents round-trip through the REAL seam without
// importing @tauri-apps. Reuses the stub — does NOT hand-roll a new one.
import { createStoreStub } from "@/lib/platform/stub";
import type { Platform, Store } from "@/lib/platform";

export function makeMemoryPlatform(store: Store = createStoreStub()): Platform {
  return {
    clipboard: { writeText: async () => {}, readText: async () => "" },
    store,
  };
}
