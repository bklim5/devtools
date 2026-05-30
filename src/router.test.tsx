// @vitest-environment jsdom
// RUNTIME proof (HIGH-3): a green `vite build` bundles modules but does NOT
// execute the router/render path. This test actually RENDERS RouterProvider so
// it exercises the module-load `firstTool = ENABLED_TOOLS[0]` path (which throws
// if ENABLED_TOOLS is empty) AND proves the `path:"*"` unknown → first-tool
// (skeleton) redirect at runtime.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import { setPlatformForTest, resetPlatformForTest, type Platform } from "@/lib/platform";

// Inject a stub platform so nothing transitively reaches @tauri-apps under jsdom.
const stubPlatform: Platform = {
  clipboard: { writeText: async () => {}, readText: async () => "" },
  store: { get: async () => undefined, set: async () => {} },
};

beforeEach(() => {
  setPlatformForTest(stubPlatform);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

describe("HashRouter (FND-02 runtime proof)", () => {
  it("mounts RouterProvider without throwing", async () => {
    // `router` is created at module load — importing it would throw here if
    // ENABLED_TOOLS were empty (firstTool.id). It resolves because the skeleton
    // is registered enabled:true.
    const { router } = await import("./router");
    expect(() => render(<RouterProvider router={router} />)).not.toThrow();
    // Index route redirects to the first tool (skeleton) — its input renders.
    await waitFor(() => expect(screen.getByTestId("skeleton-input")).toBeTruthy());
  });

  it("redirects an unknown route to the skeleton route (/tools/does-not-exist → /tools/_skeleton)", async () => {
    const { router } = await import("./router");
    render(<RouterProvider router={router} />);

    // Drive navigation to an unknown route; the `path:"*"` Navigate redirects to
    // the first tool. Wait for the redirect to settle, then assert BOTH the
    // resolved location AND that the skeleton actually mounted.
    await router.navigate("/tools/does-not-exist");

    await waitFor(() => expect(router.state.location.pathname).toBe("/tools/_skeleton"));
    expect(screen.getByTestId("skeleton-input")).toBeTruthy();
  });
});
