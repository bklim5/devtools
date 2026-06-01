// update.ts — orchestration state machine over the platform.updater seam (DST-02,
// D-09/D-10/D-11/D-12). These tests inject a stub Platform (setPlatformForTest +
// makeMemoryPlatform with a vi.fn() updater) so they exercise the REAL seam
// WITHOUT importing @tauri-apps. The false-branch / no-call discipline is asserted
// directly: when the user has opted OUT, the launch path makes NO check() call.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform, noopUpdater } from "./testStore";
import {
  checkForUpdate,
  installUpdate,
  needsOptInPrompt,
  shouldAutoCheck,
} from "./update";

/** Build a Platform whose updater methods are vi.fns the test can assert against. */
function platformWithUpdater(updater: Partial<Platform["updater"]>): {
  platform: Platform;
  check: ReturnType<typeof vi.fn>;
  downloadAndInstall: ReturnType<typeof vi.fn>;
} {
  const check = vi.fn(updater.check ?? noopUpdater.check);
  const downloadAndInstall = vi.fn(
    updater.downloadAndInstall ?? noopUpdater.downloadAndInstall,
  );
  const base = makeMemoryPlatform();
  return {
    platform: { ...base, updater: { check, downloadAndInstall } },
    check,
    downloadAndInstall,
  };
}

afterEach(() => {
  resetPlatformForTest();
});

describe("checkForUpdate", () => {
  it("returns an update result when the seam check resolves an UpdateInfo", async () => {
    const info = { version: "0.3.0", notes: "shiny", date: null };
    const { platform, check } = platformWithUpdater({
      check: async () => info,
    });
    setPlatformForTest(platform);

    const result = await checkForUpdate();

    expect(result).toEqual({ kind: "update", info });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("returns a current result when the seam check resolves null (up to date)", async () => {
    const { platform } = platformWithUpdater({ check: async () => null });
    setPlatformForTest(platform);

    await expect(checkForUpdate()).resolves.toEqual({ kind: "current" });
  });

  it("returns an error-kind result (never throws) when the seam check rejects", async () => {
    const { platform } = platformWithUpdater({
      check: async () => {
        throw new Error("offline / endpoint unreachable");
      },
    });
    setPlatformForTest(platform);

    const result = await checkForUpdate();

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("offline");
    }
  });
});

describe("installUpdate", () => {
  it("calls the seam downloadAndInstall and forwards the progress callback", async () => {
    const { platform, downloadAndInstall } = platformWithUpdater({
      downloadAndInstall: async (onProgress?: (pct: number) => void) => {
        onProgress?.(42);
      },
    });
    setPlatformForTest(platform);

    const onProgress = vi.fn();
    await installUpdate(onProgress);

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(42);
  });

  it("lets a signature-mismatch / install failure propagate to the caller", async () => {
    const { platform } = platformWithUpdater({
      downloadAndInstall: async () => {
        throw new Error("signature mismatch");
      },
    });
    setPlatformForTest(platform);

    await expect(installUpdate()).rejects.toThrow("signature mismatch");
  });
});

describe("opt-in predicates", () => {
  it("shouldAutoCheck is true only when the pref is exactly true", () => {
    expect(shouldAutoCheck(true)).toBe(true);
    expect(shouldAutoCheck(false)).toBe(false);
    expect(shouldAutoCheck(null)).toBe(false);
  });

  it("needsOptInPrompt is true only when the pref is null (never asked)", () => {
    expect(needsOptInPrompt(null)).toBe(true);
    expect(needsOptInPrompt(true)).toBe(false);
    expect(needsOptInPrompt(false)).toBe(false);
  });

  it("with the pref false, a launch-style guarded check makes NO seam call", async () => {
    const { platform, check } = platformWithUpdater({});
    setPlatformForTest(platform);

    // The launch path is `if (shouldAutoCheck(pref)) await checkForUpdate()`.
    const pref: boolean | null = false;
    if (shouldAutoCheck(pref)) {
      await checkForUpdate();
    }

    expect(check).not.toHaveBeenCalled();
  });

  it("with the pref null (never asked), the launch path also makes NO seam call", async () => {
    const { platform, check } = platformWithUpdater({});
    setPlatformForTest(platform);

    const pref: boolean | null = null;
    if (shouldAutoCheck(pref)) {
      await checkForUpdate();
    }

    expect(check).not.toHaveBeenCalled();
  });
});
