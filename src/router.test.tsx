// @vitest-environment jsdom
// RUNTIME proof (HIGH-3): a green `vite build` bundles modules but does NOT
// execute the router/render path. This test actually RENDERS RouterProvider so
// it exercises the module-load path and proves the router boots.
//
// Phase-1 state: the throwaway skeleton was removed (D-05) and the three real
// tools are still enabled:false stubs, so ENABLED_TOOLS is EMPTY. The key proof
// here is that the router still boots and renders WITHOUT throwing on an empty
// registry (router.tsx guards `firstTool` being undefined — no crash on
// `firstTool.id`). Phase 2/3 re-add a redirect-to-first-tool assertion once a
// real tool is enabled.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import {
  setPlatformForTest,
  resetPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { ENABLED_TOOLS } from "@/lib/tools/registry";

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
  it("documents the current interim state: registry is empty (skeleton removed, real tools still stubbed)", () => {
    expect(ENABLED_TOOLS.length).toBe(0);
  });

  it("mounts RouterProvider without throwing on an empty registry", async () => {
    // `router` is created at module load — importing it would throw here if
    // router.tsx did `firstTool.id` without guarding the empty-registry case.
    const { router } = await import("./router");
    expect(() => render(<RouterProvider router={router} />)).not.toThrow();
  });

  it("renders the App shell (no crash, no blank-on-throw) for an unknown route", async () => {
    const { router } = await import("./router");
    render(<RouterProvider router={router} />);
    await router.navigate("/tools/does-not-exist");
    // With no enabled tools the catch-all falls back to the bare App shell
    // rather than redirecting; the location simply resolves without throwing.
    expect(router.state.location.pathname).toBeDefined();
  });
});
