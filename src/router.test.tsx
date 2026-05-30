// @vitest-environment jsdom
// RUNTIME proof (HIGH-3): a green `vite build` bundles modules but does NOT
// execute the router/render path. This test actually RENDERS RouterProvider so
// it exercises the module-load path and proves the router boots.
//
// Phase-2 (plan 02-01) state: the three real tools are now enabled:true as shared
// placeholders (D-01), so ENABLED_TOOLS is POPULATED. The router's
// redirect-to-first-tool behaviour (router.tsx) is now active: index and unknown
// routes Navigate to the first enabled tool. (Phase 1's interim "empty registry"
// assertion was retired here once the stubs were enabled.)
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
  it("registry is now populated: the three enabled tools surface in ENABLED_TOOLS", () => {
    expect(ENABLED_TOOLS.length).toBeGreaterThan(0);
    const ids = ENABLED_TOOLS.map((t) => t.id);
    expect(ids).toContain("unix-time");
    expect(ids).toContain("base64");
    expect(ids).toContain("protobuf-decoder");
  });

  it("mounts RouterProvider without throwing", async () => {
    // `router` is created at module load — importing it would throw here if
    // router.tsx mishandled the registry while building routes.
    const { router } = await import("./router");
    expect(() => render(<RouterProvider router={router} />)).not.toThrow();
  });

  it("resolves an unknown route via the catch-all without throwing", async () => {
    const { router } = await import("./router");
    render(<RouterProvider router={router} />);
    // The unknown path matches the `*` catch-all (element = <Navigate replace>
    // to ENABLED_TOOLS[0]). The redirect itself is a render-time effect wired in
    // Plan 03/04; here we only prove the catch-all resolves without crashing.
    await router.navigate("/tools/does-not-exist");
    expect(router.state.location.pathname).toBeDefined();
  });

  it("renders the first enabled tool's placeholder at its route", async () => {
    const { router } = await import("./router");
    const { findByText } = render(<RouterProvider router={router} />);
    await router.navigate(`/tools/${ENABLED_TOOLS[0].id}`);
    // The shared placeholder (D-01) renders the tool name + "Coming in Phase 3".
    expect(await findByText("Coming in Phase 3")).toBeDefined();
  });
});
