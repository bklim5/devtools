import { describe, it, expect, vi, afterEach } from "vitest";

describe("IS_APPSTORE channel constant", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false on the default (direct) channel — no VITE_CHANNEL set", async () => {
    vi.resetModules();
    const { IS_APPSTORE } = await import("./channel");
    expect(IS_APPSTORE).toBe(false);
  });

  it("is true when VITE_CHANNEL=appstore", async () => {
    vi.stubEnv("VITE_CHANNEL", "appstore");
    vi.resetModules();
    const { IS_APPSTORE } = await import("./channel");
    expect(IS_APPSTORE).toBe(true);
  });

  it("is false when VITE_CHANNEL=direct", async () => {
    vi.stubEnv("VITE_CHANNEL", "direct");
    vi.resetModules();
    const { IS_APPSTORE } = await import("./channel");
    expect(IS_APPSTORE).toBe(false);
  });
});
