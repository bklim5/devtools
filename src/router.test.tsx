// @vitest-environment jsdom
// RUNTIME proof (HIGH-3): a green `vite build` bundles modules but does NOT
// execute the router/render path. This test actually RENDERS RouterProvider so
// it exercises the module-load path and proves the router boots.
//
// Phase-2 (plan 02-03) state: routes are a pure projection of ENABLED_TOOLS
// (SHL-04), and the index/catch-all redirect now flows through the single
// StartupRedirect → resolveStartupTool seam (SHL-06, D-12/13/14): explicit
// target > real last-used (from prefs) > hero (protobuf-decoder). The old
// hardcoded "first enabled tool" redirect is gone.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { RouterProvider } from "react-router-dom";
import {
  setPlatformForTest,
  resetPlatformForTest,
  type Platform,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { noopWindow, noopNativeShortcut, noopUpdater } from "@/shell/testStore";
import { ENABLED_TOOLS } from "@/lib/tools/registry";
import { HERO_TOOL_ID } from "@/shell/resolveStartupTool";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";

let store: Store;

function makePlatform(s: Store): Platform {
  return {
    clipboard: { writeText: async () => {}, readText: async () => "" },
    store: s,
    window: noopWindow,
    nativeShortcut: noopNativeShortcut,
    updater: noopUpdater,
  };
}

beforeEach(() => {
  store = createStoreStub();
  setPlatformForTest(makePlatform(store));
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

describe("HashRouter (FND-02 runtime proof)", () => {
  it("registry is populated: the three enabled tools surface in ENABLED_TOOLS", () => {
    expect(ENABLED_TOOLS.length).toBeGreaterThan(0);
    const ids = ENABLED_TOOLS.map((t) => t.id);
    expect(ids).toContain("unix-time");
    expect(ids).toContain("base64");
    expect(ids).toContain("protobuf-decoder");
  });

  it("derives exactly one tools/<id> route per ENABLED_TOOL, in registry order (SHL-04)", async () => {
    const { router } = await import("./router");
    const root = router.routes[0];
    const toolPaths = (root.children ?? [])
      .map((c) => c.path)
      .filter((p): p is string => typeof p === "string" && p.startsWith("tools/"));
    expect(toolPaths).toEqual(ENABLED_TOOLS.map((t) => `tools/${t.id}`));
  });

  it("has both an index route and a catch-all '*' route", async () => {
    const { router } = await import("./router");
    const children = router.routes[0].children ?? [];
    expect(children.some((c) => c.index === true)).toBe(true);
    expect(children.some((c) => c.path === "*")).toBe(true);
  });

  it("mounts RouterProvider without throwing", async () => {
    const { router } = await import("./router");
    expect(() => render(<RouterProvider router={router} />)).not.toThrow();
  });

  it("first run (no last-used) redirects the index to the hero tool (D-12)", async () => {
    const { router } = await import("./router");
    await router.navigate("/");
    render(<RouterProvider router={router} />);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/tools/${HERO_TOOL_ID}`),
    );
  });

  it("restores the REAL persisted last-used tool on the index redirect (Pitfall 3, D-13)", async () => {
    // Seed a valid last-used that differs from the hero.
    await store.set(PREFERENCES_STORE_KEY, {
      theme: "dark",
      accent: "#3b82f6",
      lastUsedId: "base64",
      recentToolIds: ["base64"],
    });
    const { router } = await import("./router");
    await router.navigate("/");
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(router.state.location.pathname).toBe("/tools/base64"));
  });

  it("an unknown route falls through the catch-all to the resolved startup tool", async () => {
    const { router } = await import("./router");
    await router.navigate("/totally-unknown");
    render(<RouterProvider router={router} />);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/tools/${HERO_TOOL_ID}`),
    );
  });

  it("renders the real protobuf-decoder tool at its direct route", async () => {
    const { router } = await import("./router");
    const { findByLabelText } = render(<RouterProvider router={router} />);
    await router.navigate(`/tools/${HERO_TOOL_ID}`);
    // 03-04 swapped the placeholder for the real hero UI — its input is present.
    expect(await findByLabelText("Protobuf input")).toBeDefined();
  });
});
