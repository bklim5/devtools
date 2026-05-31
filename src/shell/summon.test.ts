// Unit coverage for summon.ts (NAT-01): registerSummon wires the global chord
// through the platform seam (never @tauri-apps) and, on fire, summons the window
// in the macOS-safe order (unminimize → show → setFocus, D-03 / RESEARCH Pitfall 1).
//
// The seam is injected via setPlatformForTest with vi.fn()-backed window/
// nativeShortcut stubs, so these tests exercise the REAL seam accessor without
// importing @tauri-apps. Call order is asserted via mock.invocationCallOrder.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setPlatformForTest,
  resetPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "./testStore";
import { SUMMON_CHORD, registerSummon } from "./summon";

/** Build a Platform whose window + nativeShortcut are vi.fn() spies so we can
 *  assert what registerSummon called and in what order. */
function makeSpyPlatform(
  registerImpl: Platform["nativeShortcut"]["register"] = vi.fn(async () => {}),
) {
  const unminimize = vi.fn(async () => {});
  const show = vi.fn(async () => {});
  const setFocus = vi.fn(async () => {});
  const register = vi.fn(registerImpl);

  const base = makeMemoryPlatform();
  const platform: Platform = {
    ...base,
    window: { ...base.window, unminimize, show, setFocus },
    nativeShortcut: { ...base.nativeShortcut, register },
  };
  return { platform, unminimize, show, setFocus, register };
}

describe("summon (NAT-01)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    resetPlatformForTest();
  });

  it("SUMMON_CHORD is the single named constant CommandOrControl+Shift+D", () => {
    expect(SUMMON_CHORD).toBe("CommandOrControl+Shift+D");
  });

  it("registers SUMMON_CHORD through the seam (platform.nativeShortcut.register)", async () => {
    const { platform, register } = makeSpyPlatform();
    setPlatformForTest(platform);

    await registerSummon();

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(SUMMON_CHORD, expect.any(Function));
  });

  it("on fire, summons the window in order: unminimize → show → setFocus", async () => {
    let captured: (() => void) | undefined;
    const register = vi.fn(async (_acc: string, handler: () => void) => {
      captured = handler;
    });
    const { platform, unminimize, show, setFocus } = makeSpyPlatform(register);
    setPlatformForTest(platform);

    await registerSummon();
    expect(captured).toBeTypeOf("function");

    // Invoke the registered summon handler and let its awaits flush.
    await captured!();

    expect(unminimize).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(1);
    expect(setFocus).toHaveBeenCalledTimes(1);

    // Strict ordering (D-03 / Pitfall 1): focus must come AFTER unminimize+show.
    const [u] = unminimize.mock.invocationCallOrder;
    const [s] = show.mock.invocationCallOrder;
    const [f] = setFocus.mock.invocationCallOrder;
    expect(u).toBeLessThan(s);
    expect(s).toBeLessThan(f);
  });

  it("does not throw if register rejects (chord already taken — graceful degrade)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const register = vi.fn(async () => {
      throw new Error("chord already registered");
    });
    const { platform } = makeSpyPlatform(register);
    setPlatformForTest(platform);

    await expect(registerSummon()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
