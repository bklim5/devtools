// @vitest-environment jsdom
// ToolRoute — the element-level entitlement gate (ENT-01/D-30) + module-cached
// React.lazy (ENT-05, RESEARCH Pitfall 2). Fixtures are inline ToolDefinitions
// (never the real registry): the vi.fn loader gives both the render assertion
// AND the never-invoked-when-locked spy (T-18-06 — a locked tool's chunk must
// not be fetched, the future free-build exclusion seam). ToolRoute uses no
// router hooks, so no MemoryRouter wrapper is needed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import type { ToolDefinition } from "@/lib/tools/types";
import { FREE_SET, FULL_SET } from "@/lib/entitlements/entitlements";
import {
  resetEntitlementsForTest,
  setEntitlementsForTest,
} from "@/lib/entitlements/store";
import { ToolRoute } from "./ToolRoute";

const Icon: ComponentType<{ className?: string }> = () => null;

function makeLoader() {
  return vi.fn(() =>
    Promise.resolve({
      default: (() => <div>fixture-tool-ui</div>) as ComponentType,
    }),
  );
}

// Unique id per fixture: ToolRoute's lazyCache is module-level and keyed by
// tool.id, so reusing an id across tests would alias cached lazy components.
function makeTool(
  id: string,
  loader: ReturnType<typeof makeLoader>,
  requiredEntitlements?: string[],
): ToolDefinition {
  return {
    id,
    name: "Fixture",
    description: "test fixture",
    category: "encoding",
    keywords: [],
    icon: Icon,
    component: loader,
    ...(requiredEntitlements ? { requiredEntitlements } : {}),
  };
}

afterEach(() => {
  cleanup();
  resetEntitlementsForTest();
});

describe("ToolRoute locked branch (ENT-01/D-30, T-18-06)", () => {
  it("renders the UpsellPanel under FREE_SET and never invokes the loader", () => {
    setEntitlementsForTest(FREE_SET);
    const loader = makeLoader();
    render(<ToolRoute tool={makeTool("locked-free", loader, ["test.locked"])} />);

    expect(
      screen.getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeDefined();
    // D-19 override (walkthrough 2026-06-10): no "Unlocks:" meta line — lock
    // context comes from the route the user opened.
    expect(screen.queryByText(/Unlocks:/)).toBeNull();
    expect(loader).toHaveBeenCalledTimes(0);
  });

  it("stays locked under FULL_SET when the requirement is an unknown entitlement", () => {
    setEntitlementsForTest(FULL_SET);
    const loader = makeLoader();
    render(<ToolRoute tool={makeTool("locked-full", loader, ["test.locked"])} />);

    expect(
      screen.getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeDefined();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe("ToolRoute unlocked branch (ENT-05)", () => {
  it("renders the lazy component's content once the import resolves", async () => {
    setEntitlementsForTest(FREE_SET);
    const loader = makeLoader();
    render(<ToolRoute tool={makeTool("unlocked", loader)} />);

    expect(await screen.findByText("fixture-tool-ui")).toBeDefined();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe("ToolRoute reactive gate (element-level, not route-level lazy)", () => {
  it("swaps the upsell for the tool when the entitlement set flips on a mounted route", async () => {
    setEntitlementsForTest(FREE_SET);
    const loader = makeLoader();
    render(<ToolRoute tool={makeTool("flips", loader, ["test.locked"])} />);

    expect(
      screen.getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeDefined();
    expect(loader).toHaveBeenCalledTimes(0);

    act(() => {
      setEntitlementsForTest(new Set(["test.locked"]));
    });

    expect(await screen.findByText("fixture-tool-ui")).toBeDefined();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe("ToolRoute lazy identity cache (RESEARCH Pitfall 2, T-18-08)", () => {
  it("invokes the loader at most once across re-renders (lazy created once per tool id)", async () => {
    setEntitlementsForTest(FREE_SET);
    const loader = makeLoader();
    const tool = makeTool("cached", loader);
    const { rerender } = render(<ToolRoute tool={tool} />);

    expect(await screen.findByText("fixture-tool-ui")).toBeDefined();

    rerender(<ToolRoute tool={tool} />);
    rerender(<ToolRoute tool={tool} />);

    expect(await screen.findByText("fixture-tool-ui")).toBeDefined();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
