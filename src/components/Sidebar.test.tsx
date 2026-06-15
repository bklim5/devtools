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
import { Lock } from "lucide-react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { UpsellModal } from "./UpsellPanel";

// D-88: the footer license-attention affordance routes via useNavigate when there
// is a license to manage; spy it so the routing target is observable.
const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});
import { ENABLED_TOOLS } from "@/lib/tools/registry";
import { FREE_SET, FULL_SET } from "@/lib/entitlements/entitlements";
import {
  resetEntitlementsForTest,
  setEntitlementsForTest,
} from "@/lib/entitlements/store";
import {
  resetLicenseUiForTest,
  setLicenseUiForTest,
} from "@/lib/license/licenseUi";
import {
  setPlatformForTest,
  resetPlatformForTest,
  type LicenseStatusPayload,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform, noopLicense } from "@/shell/testStore";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";
import { closeUpsell } from "@/shell/upsellStore";
import { useUpsellOpen } from "@/shell/useUpsell";

let store: Store;

beforeEach(() => {
  navigateSpy.mockClear();
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
  resetLicenseUiForTest();
  closeUpsell(); // reset the shared upsell-open store between tests
});

// The shared upsell modal now mounts ONCE at the shell (App.tsx), projected from
// the shell/upsellStore flag — not inside Sidebar. This host mirrors that shell
// composition so a Sidebar affordance that calls openUpsell() still renders the
// dialog under test (parity with the real App).
function UpsellModalHost() {
  return useUpsellOpen() ? (
    <UpsellModal icon={Lock} onClose={closeUpsell} />
  ) : null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
      <UpsellModalHost />
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
    const { getByRole, getByLabelText, queryByText } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    fireEvent.click(getByLabelText(`Pin ${ENABLED_TOOLS[0].name}`));

    expect(getByRole("dialog")).toBeDefined();
    expect(
      getByRole("heading", { name: /Thank you for using TinkerDev/ }),
    ).toBeDefined();
    // D-19 override (walkthrough 2026-06-10): no "Unlocks:" meta line — lock
    // context comes from the affordance the user clicked.
    expect(queryByText(/Unlocks:/)).toBeNull();
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

describe("Sidebar license attention footer (D-43/D-88)", () => {
  it("renders 'License needs attention' under FULL_SET when the license has a problem, and ROUTES to the status route (D-88)", async () => {
    // FULL_SET on purpose: a Phase-19 release build has everything unlocked —
    // the attention surface must NOT depend on the free-tier flip.
    const PROBLEM = {
      state: "problem",
      problem: "corrupt",
      hasStoredKey: false,
    } as const;
    setPlatformForTest({
      ...makeMemoryPlatform(store),
      license: { ...noopLicense, status: () => Promise.resolve(PROBLEM) },
    });
    setLicenseUiForTest(PROBLEM);
    const { getByRole, queryByRole } = renderAt("/");
    await flushPrefsLoad();

    const footer = getByRole("button", { name: "License needs attention" });
    expect(footer.tabIndex).toBe(0);
    // The Unlock Pro label is REPLACED, not duplicated — one footer row.
    expect(queryByRole("button", { name: "Unlock Pro" })).toBeNull();
    // No red alarm styling — D-43 is a hint, not an interruption.
    expect(footer.className).not.toContain("text-bad");

    fireEvent.click(footer);

    // D-88: a manageable license routes to the status route, NOT the upsell modal.
    expect(navigateSpy).toHaveBeenCalledWith("/settings/license");
    expect(queryByRole("dialog")).toBeNull();
  });

  it("renders 'License needs attention' for refreshNeeded and routes to the status route (D-84/D-88)", async () => {
    const REFRESH_NEEDED = { state: "refreshNeeded", hasStoredKey: true } as const;
    setPlatformForTest({
      ...makeMemoryPlatform(store),
      license: { ...noopLicense, status: () => Promise.resolve(REFRESH_NEEDED) },
    });
    // refreshNeeded drops entitlements to FREE — the footer must surface AND route.
    act(() => setEntitlementsForTest(FREE_SET));
    setLicenseUiForTest(REFRESH_NEEDED);
    const { getByRole } = renderAt("/");
    await flushPrefsLoad();

    const footer = getByRole("button", { name: "License needs attention" });
    fireEvent.click(footer);
    expect(navigateSpy).toHaveBeenCalledWith("/settings/license");
  });

  it("offlineGrace adds NO footer nag (D-77 — silent outside the status route)", async () => {
    const GRACE: LicenseStatusPayload = {
      state: "offlineGrace",
      expiry: null,
      entitlements: ["pro.theming", "pro.ordering"],
      maskedKey: null,
      email: null,
    };
    // Pro is active in grace → FULL set, so neither the lock-row nor the
    // attention-row condition fires.
    setLicenseUiForTest(GRACE);
    const { queryByRole } = renderAt("/");
    await flushPrefsLoad();
    expect(
      queryByRole("button", { name: /Unlock Pro|needs attention/ }),
    ).toBeNull();
  });

  it("keeps the footer absent under FULL_SET for notActivated AND licensed states", async () => {
    // notActivated is the default snapshot.
    const first = renderAt("/");
    await flushPrefsLoad();
    expect(
      first.queryByRole("button", { name: /Unlock Pro|needs attention/ }),
    ).toBeNull();
    first.unmount();

    act(() =>
      setLicenseUiForTest({
        state: "licensed",
        expiry: null,
        entitlements: [],
        maskedKey: null,
        email: null,
      }),
    );
    const second = renderAt("/");
    await flushPrefsLoad();
    expect(
      second.queryByRole("button", { name: /Unlock Pro|needs attention/ }),
    ).toBeNull();
  });
});
