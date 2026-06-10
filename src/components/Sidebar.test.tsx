// @vitest-environment jsdom
// SHL-01 / SHL-04: the sidebar is a pure projection of ENABLED_TOOLS in compact
// density. One NavLink per enabled tool (icon + name), each linking to
// /tools/<id>, the active route's item carrying the active marker, and NO
// second keyboard system (D-03 — the ⌘K palette is the sole keyboard switch).
//
// Phase 18 (ENT-02/D-26/D-28): jsdom resolves to the FREE set by default, so the
// projection tests inject FULL_SET to keep exercising the unlocked v1.5 behavior
// unchanged (RESEARCH Pitfall 5 audit). The "free tier" describe injects FREE_SET
// and proves the lock UX: registry-default render with stored prefs untouched,
// every ordering/pinning affordance opening the shared upsell modal, zero writes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ENABLED_TOOLS } from "@/lib/tools/registry";
import { FREE_SET, FULL_SET } from "@/lib/entitlements/entitlements";
import {
  resetEntitlementsForTest,
  setEntitlementsForTest,
} from "@/lib/entitlements/store";
import {
  setPlatformForTest,
  resetPlatformForTest,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";

let store: Store;

beforeEach(() => {
  store = createStoreStub();
  setPlatformForTest(makeMemoryPlatform(store));
  // Pitfall 5: jsdom's environment default is FREE — inject FULL so the existing
  // projection tests keep covering the unlocked behavior they always did.
  setEntitlementsForTest(FULL_SET);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
  resetEntitlementsForTest();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

/** Flush the async prefs mount-load so assertions run against loaded state. */
async function flushPrefsLoad() {
  await act(async () => {});
}

describe("Sidebar (registry-driven, compact)", () => {
  it("renders exactly one nav link per ENABLED_TOOL", () => {
    const { getAllByRole } = renderAt("/");
    expect(getAllByRole("link")).toHaveLength(ENABLED_TOOLS.length);
  });

  it("renders each tool's name", () => {
    const { getByText } = renderAt("/");
    for (const tool of ENABLED_TOOLS) {
      expect(getByText(tool.name)).toBeDefined();
    }
  });

  it("points each link at /tools/<id>", () => {
    const { getAllByRole } = renderAt("/");
    const links = getAllByRole("link") as HTMLAnchorElement[];
    ENABLED_TOOLS.forEach((tool, i) => {
      // MemoryRouter resolves NavLink `to` into the href.
      expect(links[i].getAttribute("href")).toBe(`/tools/${tool.id}`);
    });
  });

  it("marks the active route's item with aria-current", () => {
    const active = ENABLED_TOOLS[1] ?? ENABLED_TOOLS[0];
    const { getAllByRole } = renderAt(`/tools/${active.id}`);
    const links = getAllByRole("link") as HTMLAnchorElement[];
    const current = links.filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("href")).toBe(`/tools/${active.id}`);
  });

  it("renders an icon (svg) inside each item", () => {
    const { getAllByRole } = renderAt("/");
    const links = getAllByRole("link");
    for (const link of links) {
      expect(link.querySelector("svg")).not.toBeNull();
    }
  });

  it("holds no tool list of its own — names come straight from the registry", () => {
    const { getByText } = renderAt("/");
    // protobuf-decoder is the hero; it must be present purely via the registry.
    expect(getByText("Protobuf Decoder")).toBeDefined();
  });
});

describe("Sidebar entitlement gate — unlocked (FULL_SET, D-26 baseline)", () => {
  it("renders the stored pinned group + custom order under FULL_SET", async () => {
    await store.set(PREFERENCES_STORE_KEY, {
      pinnedToolIds: ["base64"],
      toolOrder: [],
    });
    const { getByRole } = renderAt("/");
    await waitFor(() =>
      expect(getByRole("group", { name: "Pinned tools" })).toBeDefined(),
    );
  });

  it("does NOT render the footer 'Unlock Pro' row under FULL_SET (D-29)", async () => {
    const { queryByRole } = renderAt("/");
    await flushPrefsLoad();
    expect(queryByRole("button", { name: "Unlock Pro" })).toBeNull();
  });
});

describe("Sidebar free tier (D-26/D-28)", () => {
  // A non-default stored arrangement: base64 pinned + a custom order.
  const registryIds = ENABLED_TOOLS.map((t) => t.id);
  const customOrder = [...registryIds].reverse();

  async function seedArrangement() {
    await store.set(PREFERENCES_STORE_KEY, {
      pinnedToolIds: ["base64"],
      toolOrder: customOrder,
    });
  }

  beforeEach(() => {
    setEntitlementsForTest(FREE_SET);
  });

  it("renders registry-default order, hides the pinned section, and never writes prefs (D-26)", async () => {
    await seedArrangement();
    const setSpy = vi.spyOn(store, "set");
    const { getAllByRole, queryByRole } = renderAt("/");
    await flushPrefsLoad();

    // Registry-default order — the stored overlay is ignored while locked.
    const links = getAllByRole("link") as HTMLAnchorElement[];
    expect(links.map((l) => l.getAttribute("href"))).toEqual(
      registryIds.map((id) => `/tools/${id}`),
    );
    // No pinned group, no divider.
    expect(queryByRole("group", { name: "Pinned tools" })).toBeNull();
    expect(document.querySelector("hr")).toBeNull();
    // Render alone never persists anything — stored prefs stay on disk untouched.
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("unlocking restores the stored arrangement instantly (stored prefs untouched)", async () => {
    await seedArrangement();
    const { getByRole, queryByRole } = renderAt("/");
    await flushPrefsLoad();
    expect(queryByRole("group", { name: "Pinned tools" })).toBeNull();

    act(() => setEntitlementsForTest(FULL_SET));

    // The pinned group reappears from the UNTOUCHED stored prefs — no reload.
    expect(getByRole("group", { name: "Pinned tools" })).toBeDefined();
  });

  it("pin-button click opens the upsell modal and writes nothing (D-28)", async () => {
    const { getByRole, getByLabelText, getByText } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    fireEvent.click(getByLabelText(`Pin ${ENABLED_TOOLS[0].name}`));

    expect(getByRole("dialog")).toBeDefined();
    expect(
      getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeDefined();
    // D-19: the modal names WHAT is locked.
    expect(getByText("Unlocks: Tool ordering & pinning")).toBeDefined();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("Alt+P (physical KeyP, composed 'π') on a row opens the modal, no write", async () => {
    const { getAllByRole, getByRole } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    // Mirror real macOS: Option+P arrives as key "π" with code "KeyP" (Pitfall 9).
    fireEvent.keyDown(getAllByRole("link")[0], {
      altKey: true,
      code: "KeyP",
      key: "π",
    });

    expect(getByRole("dialog")).toBeDefined();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("Alt+ArrowDown on a row opens the modal instead of reordering, no write", async () => {
    const { getAllByRole, getByRole } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    fireEvent.keyDown(getAllByRole("link")[0], { altKey: true, key: "ArrowDown" });

    expect(getByRole("dialog")).toBeDefined();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("'Reset order' menu item opens the modal instead of clearing the order", async () => {
    await seedArrangement();
    const { getByRole, queryByRole } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    fireEvent.contextMenu(getByRole("navigation"));
    fireEvent.click(getByRole("menuitem", { name: /reset order/i }));

    expect(getByRole("dialog")).toBeDefined();
    // The menu itself closed; the stored order was NOT cleared.
    expect(queryByRole("menu")).toBeNull();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("footer 'Unlock Pro' row renders in free tier, is focusable, and opens the modal (D-29)", async () => {
    const { getByRole } = renderAt("/");
    await flushPrefsLoad();

    const footer = getByRole("button", { name: "Unlock Pro" });
    // Keyboard-reachable: a native button, in the Tab order by default.
    expect(footer.tabIndex).toBe(0);

    fireEvent.click(footer);

    expect(getByRole("dialog")).toBeDefined();
    expect(
      getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeDefined();
  });

  it("Esc closes the modal and focus returns to the invoking control", async () => {
    const { getByRole, getByLabelText, queryByRole } = renderAt("/");
    await flushPrefsLoad();

    const pinButton = getByLabelText(`Pin ${ENABLED_TOOLS[0].name}`);
    act(() => pinButton.focus());
    fireEvent.click(pinButton);
    expect(getByRole("dialog")).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(pinButton);
  });
});
