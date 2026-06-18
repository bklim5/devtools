// Unit coverage for startupReveal.ts (D-24-8/9): revealOnStartup shows the window
// through the platform seam (never @tauri-apps) ONLY when start-in-tray is off,
// and NEVER pairs a show() with a hide() (no flash, Pitfall 1).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setPlatformForTest,
  resetPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "./testStore";
import { revealOnStartup } from "./startupReveal";

/** Build a Platform whose window.show is a vi.fn() spy. */
function makeSpyPlatform() {
  const show = vi.fn(async () => {});
  const base = makeMemoryPlatform();
  const platform: Platform = {
    ...base,
    window: { ...base.window, show },
  };
  return { platform, show };
}

describe("revealOnStartup (D-24-8/9)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    resetPlatformForTest();
  });

  it("shows the window when startInTray is false (the sole normal-launch reveal)", async () => {
    const { platform, show } = makeSpyPlatform();
    setPlatformForTest(platform);

    await revealOnStartup({ startInTray: false });

    expect(show).toHaveBeenCalledTimes(1);
  });

  it("does NOT show the window when startInTray is true (no flash)", async () => {
    const { platform, show } = makeSpyPlatform();
    setPlatformForTest(platform);

    await revealOnStartup({ startInTray: true });

    expect(show).not.toHaveBeenCalled();
  });
});
