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
