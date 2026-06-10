// @vitest-environment jsdom
// D-23/D-24/D-25 + D-18: the sidebar's tool-level lock badge, proven by FIXTURE.
//
// The registry is mocked with a 2-tool fixture — one free, one carrying an
// UNKNOWN entitlement ("test.locked"). Tests inject FULL_SET: the fixture stays
// locked even under the full tier, which is the dormant-mechanism proof (D-18 —
// no SHIPPED tool carries requiredEntitlements; the production registry has zero
// diff this phase). The badge is a neutral aria-hidden Lock glyph inline after
// the name, the accessible name gains a " — locked" suffix, and the NavLink
// still navigates (the route shows the upsell — D-30, Plan 02).
//
// NOTE: the D-29 footer "Unlock Pro" row behaviors (FREE shows + opens modal,
// FULL hides) live in Sidebar.test.tsx — the chosen single home — because they
// are registry-independent free/full-tier behaviors.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { FULL_SET } from "@/lib/entitlements/entitlements";
import {
  resetEntitlementsForTest,
  setEntitlementsForTest,
} from "@/lib/entitlements/store";
import { setPlatformForTest, resetPlatformForTest } from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";

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

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

// The accessible name ends with "— locked" (D-25). Accname computation joins
// inline text nodes without re-inserting the sr-only span's leading space, so
// match whitespace-tolerantly — the suffix is the contract, not the join space.
const LOCKED_NAME = /^Locked Fixture\s*— locked$/;

describe("Sidebar lock badge (D-23/D-24/D-25, fixture-proven dormant mechanism)", () => {
  it("renders a neutral aria-hidden Lock glyph on the locked tool's row only", () => {
    const { getByRole } = renderSidebar();

    const lockedRow = getByRole("link", { name: LOCKED_NAME });
    const glyph = lockedRow.querySelector('svg[class*="lucide-lock"]');
    expect(glyph).not.toBeNull();
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
    // D-24: neutral tx-2 only — accent forbidden on lock elements.
    expect(glyph?.getAttribute("class") ?? "").toContain("text-tx-2");
    expect(glyph?.getAttribute("class") ?? "").not.toContain("text-accent");

    const freeRow = getByRole("link", { name: "Free Fixture" });
    expect(freeRow.querySelector('svg[class*="lucide-lock"]')).toBeNull();
  });

  it("appends the SR-only '— locked' suffix to the locked row's accessible name only", () => {
    const { getByRole, queryByRole } = renderSidebar();
    // The suffix IS part of the accessible name (sr-only span inside the link).
    expect(getByRole("link", { name: LOCKED_NAME })).toBeDefined();
    // The free row's name carries no suffix.
    expect(queryByRole("link", { name: /Free Fixture\s*— locked/ })).toBeNull();
    expect(getByRole("link", { name: "Free Fixture" })).toBeDefined();
  });

  it("adds no opacity/dimming treatment to the locked row (ENT-04)", () => {
    const { getByRole } = renderSidebar();
    const lockedRow = getByRole("link", { name: LOCKED_NAME });
    expect(lockedRow.getAttribute("class") ?? "").not.toContain("opacity");
  });

  it("the locked row still navigates — href unchanged, click marks it current (D-30)", () => {
    const { getByRole } = renderSidebar();
    const lockedRow = getByRole("link", { name: LOCKED_NAME });
    expect(lockedRow.getAttribute("href")).toBe("/tools/locked-fixture");

    act(() => lockedRow.click());

    // Navigation happened (the ROUTE then shows the upsell — Plan 02's gate).
    expect(lockedRow.getAttribute("aria-current")).toBe("page");
  });
});
