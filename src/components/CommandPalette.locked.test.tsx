// @vitest-environment jsdom
// D-23/D-24/D-25 + D-18: the palette's tool-level lock badge, proven by FIXTURE
// (mirrors Sidebar.locked.test.tsx). The registry is mocked with one free tool
// and one carrying an UNKNOWN entitlement ("test.locked"); tests inject FULL_SET
// so the fixture stays locked even under the full tier — the dormant-mechanism
// proof (no SHIPPED tool carries requiredEntitlements; production registry zero
// diff). Locked rows get a neutral aria-hidden Lock glyph + a "— locked"
// accessible-name suffix, and selection STILL navigates (the route shows the
// upsell — D-30, Plan 02).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import { FULL_SET } from "@/lib/entitlements/entitlements";
import {
  resetEntitlementsForTest,
  setEntitlementsForTest,
} from "@/lib/entitlements/store";
import { setPlatformForTest, resetPlatformForTest } from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock("@/lib/tools/registry", async () => {
  const { Wrench } = await import("lucide-react");
  const tools = [
    {
      id: "free-fixture",
      name: "Free Fixture",
      description: "fixture without entitlements",
      category: "encoding" as const,
      keywords: [],
      icon: Wrench,
      component: () => Promise.resolve({ default: () => null }),
    },
    {
      id: "locked-fixture",
      name: "Locked Fixture",
      description: "fixture requiring an unknown entitlement",
      category: "encoding" as const,
      keywords: [],
      icon: Wrench,
      component: () => Promise.resolve({ default: () => null }),
      requiredEntitlements: ["test.locked"],
    },
  ];
  return {
    TOOLS: tools,
    ENABLED_TOOLS: tools,
    getToolById: (id: string) => tools.find((t) => t.id === id),
    searchTools: () => tools,
  };
});

beforeEach(() => {
  navigateSpy.mockClear();
  setPlatformForTest(makeMemoryPlatform(createStoreStub()));
  // FULL_SET on purpose: the unknown "test.locked" requirement keeps the fixture
  // locked even under the full tier — the dormant-mechanism proof (D-18).
  setEntitlementsForTest(FULL_SET);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
  resetEntitlementsForTest();
});

async function openPalette() {
  const utils = render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
  act(() => {
    fireEvent.keyDown(window, { key: "k", metaKey: true });
  });
  await utils.findByPlaceholderText("Search tools…");
  return utils;
}

// Accname computation joins inline text nodes without re-inserting the sr-only
// span's leading space — match whitespace-tolerantly (the suffix is the contract).
const LOCKED_NAME = /^Locked Fixture\s*— locked$/;

describe("CommandPalette lock badge (D-23/D-24/D-25, fixture-proven dormant mechanism)", () => {
  it("renders a neutral aria-hidden Lock glyph + SR suffix on the locked row only", async () => {
    const { getByRole } = await openPalette();

    const lockedRow = getByRole("button", { name: LOCKED_NAME });
    const glyph = lockedRow.querySelector('svg[class*="lucide-lock"]');
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
    // D-24: neutral tx-2 only — accent forbidden on lock elements.
    expect(glyph?.getAttribute("class") ?? "").toContain("text-tx-2");
    expect(glyph?.getAttribute("class") ?? "").not.toContain("text-accent");

    const freeRow = getByRole("button", { name: "Free Fixture" });
    expect(freeRow.querySelector('svg[class*="lucide-lock"]')).toBeNull();
  });

  it("selecting a locked tool still navigates to its route (D-30)", async () => {
    const { getByRole } = await openPalette();

    fireEvent.click(getByRole("button", { name: LOCKED_NAME }));

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/tools/locked-fixture"),
    );
  });
});
