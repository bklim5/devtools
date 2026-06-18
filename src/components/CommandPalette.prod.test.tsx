// @vitest-environment jsdom
// D-32 PROD simulation: with `import.meta.env.DEV` stubbed false BEFORE the
// module evaluates, the module-level DEV_COMMANDS branch is empty — the
// "Toggle free tier (dev)" command must be absent from BOTH the empty-query
// list and a typed-query search. The bundle-level proof remains
// scripts/check-dev-strip.sh (string tree-shaken from dist/assets); this test
// guards the runtime gate itself, including the new searchable-command path.
//
// Module-graph discipline: DEV_COMMANDS is evaluated at import time, so the
// component AND its seams (platform store, entitlements store) are imported
// dynamically from the SAME fresh registry after vi.stubEnv + vi.resetModules
// (a stale-graph seam would point setPlatformForTest at the wrong instance).
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("'Toggle free tier (dev)' is absent in a PROD-simulated build — empty query AND typed query (D-32)", async () => {
  vi.stubEnv("DEV", false);
  vi.resetModules();

  const [
    { CommandPalette },
    { setPlatformForTest },
    { createStoreStub },
    { makeMemoryPlatform },
    { FULL_SET },
    { setEntitlementsForTest },
  ] = await Promise.all([
    import("./CommandPalette"),
    import("@/lib/platform"),
    import("@/lib/platform/stub"),
    import("@/shell/testStore"),
    import("@/lib/entitlements/entitlements"),
    import("@/lib/entitlements/store"),
  ]);
  setPlatformForTest(makeMemoryPlatform(createStoreStub()));
  setEntitlementsForTest(FULL_SET);

  const { findByPlaceholderText, queryByText, getAllByRole } = render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
  act(() => {
    fireEvent.keyDown(window, { key: "k", code: "KeyK", metaKey: true });
  });
  const input = await findByPlaceholderText("Search tools…");

  // Empty query: the trailing dev-command row must not exist.
  const rows = getAllByRole("button");
  expect(rows[rows.length - 1].textContent ?? "").not.toContain(
    "Toggle free tier (dev)",
  );
  expect(queryByText("Toggle free tier (dev)")).toBeNull();

  // Typed query (the searchable path added for the 18-04 walkthrough fix):
  // still absent — nothing for the filter to surface in PROD.
  fireEvent.change(input, { target: { value: "toggle free" } });
  await waitFor(() =>
    expect(queryByText("Toggle free tier (dev)")).toBeNull(),
  );
});
