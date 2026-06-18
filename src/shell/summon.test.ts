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
import { SUMMON_CHORD, registerSummon, rebindSummon } from "./summon";

/** Build a Platform whose window + nativeShortcut are vi.fn() spies so we can
 *  assert what registerSummon called and in what order. */
function makeSpyPlatform(
  registerImpl: Platform["nativeShortcut"]["register"] = vi.fn(async () => {}),
  unregisterImpl: Platform["nativeShortcut"]["unregister"] = vi.fn(
    async () => {},
  ),
) {
  const unminimize = vi.fn(async () => {});
  const show = vi.fn(async () => {});
  const setFocus = vi.fn(async () => {});
  const register = vi.fn(registerImpl);
  const unregister = vi.fn(unregisterImpl);

  const base = makeMemoryPlatform();
  const platform: Platform = {
    ...base,
    window: { ...base.window, unminimize, show, setFocus },
    nativeShortcut: { ...base.nativeShortcut, register, unregister },
  };
  return { platform, unminimize, show, setFocus, register, unregister };
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

  it("registers the PASSED chord through the seam (platform.nativeShortcut.register)", async () => {
    const { platform, register } = makeSpyPlatform();
    setPlatformForTest(platform);

    // A user-rebound chord — registerSummon must use the ARGUMENT, not the constant.
    await registerSummon("CommandOrControl+Alt+J");

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      "CommandOrControl+Alt+J",
      expect.any(Function),
    );
  });

  it("on fire, summons the window in order: unminimize → show → setFocus", async () => {
    let captured: (() => void) | undefined;
    const register = vi.fn(async (_acc: string, handler: () => void) => {
      captured = handler;
    });
    const { platform, unminimize, show, setFocus } = makeSpyPlatform(register);
    setPlatformForTest(platform);

    await registerSummon(SUMMON_CHORD);
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

    await expect(registerSummon(SUMMON_CHORD)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});

describe("rebindSummon (D-24-2/5 — user-initiated rebind)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    resetPlatformForTest();
  });

  it("unregisters the OLD chord then registers the NEW chord, in that order", async () => {
    const { platform, register, unregister } = makeSpyPlatform();
    setPlatformForTest(platform);

    await rebindSummon("CommandOrControl+Shift+D", "CommandOrControl+Alt+J");

    expect(unregister).toHaveBeenCalledWith("CommandOrControl+Shift+D");
    expect(register).toHaveBeenCalledWith(
      "CommandOrControl+Alt+J",
      expect.any(Function),
    );
    const [u] = unregister.mock.invocationCallOrder;
    const [r] = register.mock.invocationCallOrder;
    expect(u).toBeLessThan(r); // unregister-old BEFORE register-new
  });

  it("on register REJECT, re-registers the OLD chord and re-throws (working summon preserved)", async () => {
    const register = vi.fn(async (acc: string) => {
      // Only the NEW chord is taken; the OLD-chord restore must succeed.
      if (acc === "CommandOrControl+Alt+J") throw new Error("taken");
    });
    const { platform, register: registerSpy } = makeSpyPlatform(register);
    setPlatformForTest(platform);

    await expect(
      rebindSummon("CommandOrControl+Shift+D", "CommandOrControl+Alt+J"),
    ).rejects.toThrow("taken");

    // The restore call re-registers the OLD chord so summon still works.
    expect(registerSpy).toHaveBeenCalledWith(
      "CommandOrControl+Shift+D",
      expect.any(Function),
    );
  });

  it("an unregister reject (old chord not registered) does not abort the rebind", async () => {
    const unregister = vi.fn(async () => {
      throw new Error("old not registered");
    });
    const { platform, register } = makeSpyPlatform(undefined, unregister);
    setPlatformForTest(platform);

    await expect(
      rebindSummon("CommandOrControl+Shift+D", "CommandOrControl+Alt+J"),
    ).resolves.toBeUndefined();
    expect(register).toHaveBeenCalledWith(
      "CommandOrControl+Alt+J",
      expect.any(Function),
    );
  });
});
