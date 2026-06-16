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
// zero writes.
//
// 22.1-04 (user-approved 2026-06-16, reverses D-22.1-5/D-28/D-29): the standalone
// "Unlock Pro" upsell modal is GONE. Every ordering/pinning affordance AND the
// footer row now open Settings ▸ License via openSettings("license", invoker) —
// the License pane renders the inline upsell. The tests assert that single redirect
// target (openSettingsSpy), not a stacked dialog.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

// EXPLICIT license entry points (the footer "Unlock Pro" + the bottom-anchored
// Settings row) open the Settings modal via openSettings("license", invoker).
// CONTEXTUAL locked-customization triggers (pin/drag/Alt+P/Alt+↑↓/Reset) now open
// the focused Unlock-Pro MODAL via openUpsell(invoker) — Phase 22.2. Spy both so
// the target + the focus-return invoker are observable.
const openSettingsSpy = vi.fn();
vi.mock("@/shell/settingsStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shell/settingsStore")>();
  return { ...actual, openSettings: (...args: unknown[]) => openSettingsSpy(...args) };
});
const openUpsellSpy = vi.fn();
vi.mock("@/shell/upsellStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shell/upsellStore")>();
  return { ...actual, openUpsell: (...args: unknown[]) => openUpsellSpy(...args) };
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

let store: Store;

beforeEach(() => {
  openSettingsSpy.mockClear();
  openUpsellSpy.mockClear();
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

  it("pin-button click opens the focused Unlock-Pro modal and writes nothing (D-22.2-7)", async () => {
    const { getByLabelText } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    const pinBtn = getByLabelText(`Pin ${ENABLED_TOOLS[0].name}`);
    fireEvent.click(pinBtn);

    // The contextual locked affordance opens the focused modal instead of writing
    // prefs, threading the clicked control as the explicit focus-return target
    // (MED-22-02 — a WKWebView click leaves document.activeElement unreliable).
    expect(openUpsellSpy).toHaveBeenCalledWith(pinBtn);
    expect(openSettingsSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("a LAPSED (refreshNeeded) customer's pin click goes to Settings ▸ License recovery, NOT the pitch modal (D-44)", async () => {
    // refreshNeeded resolves to FREE entitlements (so the pin is locked), but the
    // user is a paying customer — openProUpsell must route them to the recovery
    // form, never the sales-pitch modal. (The Codex-flagged 22.2 regression.)
    act(() => setLicenseUiForTest({ state: "refreshNeeded", hasStoredKey: true }));
    const { getByLabelText } = renderAt("/");
    await flushPrefsLoad();

    const pinBtn = getByLabelText(`Pin ${ENABLED_TOOLS[0].name}`);
    fireEvent.click(pinBtn);

    expect(openSettingsSpy).toHaveBeenCalledWith("license", pinBtn);
    expect(openUpsellSpy).not.toHaveBeenCalled();
  });

  it("Alt+P (physical KeyP, composed 'π') on a row opens the focused Unlock-Pro modal, no write", async () => {
    const { getAllByRole } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    // Mirror real macOS: Option+P arrives as key "π" with code "KeyP" (Pitfall 9).
    const row = getAllByRole("link")[0];
    fireEvent.keyDown(row, {
      altKey: true,
      code: "KeyP",
      key: "π",
    });

    // The focused row is threaded as the explicit focus-return target (MED-22-02).
    expect(openUpsellSpy).toHaveBeenCalledWith(row);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("Alt+ArrowDown on a row opens the focused Unlock-Pro modal instead of reordering, no write", async () => {
    const { getAllByRole } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    const row = getAllByRole("link")[0];
    fireEvent.keyDown(row, { altKey: true, key: "ArrowDown" });

    // The focused row is threaded as the explicit focus-return target (MED-22-02).
    expect(openUpsellSpy).toHaveBeenCalledWith(row);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("'Reset order' menu item opens the focused Unlock-Pro modal instead of clearing the order", async () => {
    await seedArrangement();
    const { getByRole, queryByRole } = renderAt("/");
    await flushPrefsLoad();
    const setSpy = vi.spyOn(store, "set");

    fireEvent.contextMenu(getByRole("navigation"));
    fireEvent.click(getByRole("menuitem", { name: /reset order/i }));

    // The locked reset opens the focused modal and passes the resolved menu
    // return-focus element (finding 3) as the explicit invoker. The menu closed;
    // the stored order was NOT cleared.
    expect(openUpsellSpy).toHaveBeenCalledWith(expect.anything());
    expect(queryByRole("menu")).toBeNull();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("footer 'Unlock Pro' row renders in free tier, is focusable, and opens Settings ▸ License (D-29 → 22.1-04)", async () => {
    const { getByRole } = renderAt("/");
    await flushPrefsLoad();

    const footer = getByRole("button", { name: "Unlock Pro" });
    // Keyboard-reachable: a native button, in the Tab order by default.
    expect(footer.tabIndex).toBe(0);

    fireEvent.click(footer);

    // MED-22-02: the clicked footer is passed as the explicit focus-return target.
    expect(openSettingsSpy).toHaveBeenCalledWith("license", footer);
  });
});

describe("Sidebar bottom-anchored Settings row (SET-03/D-S9/D-S10/D-S11)", () => {
  it("renders an unconditional Settings row even under FULL_SET (no Unlock-Pro/attention row), opening the Settings modal on the License pane", async () => {
    // FULL_SET + notActivated → the Unlock-Pro / attention footer row is ABSENT,
    // so this proves the Settings row is UNCONDITIONAL (D-S10), not nested under
    // the licenseAttention ternary.
    const { getByRole, queryByRole } = renderAt("/");
    await flushPrefsLoad();

    expect(queryByRole("button", { name: /Unlock Pro|needs attention/ })).toBeNull();

    const settingsRow = getByRole("button", { name: "Settings" });
    // Keyboard-reachable native button (in the Tab order by default), no lock badge.
    expect(settingsRow.tabIndex).toBe(0);

    fireEvent.click(settingsRow);
    // MED-22-02: the clicked row is passed as the explicit focus-return target
    // (e.currentTarget) so focus returns reliably on a WKWebView mouse click.
    expect(openSettingsSpy).toHaveBeenCalledWith("license", settingsRow);
  });

  it("renders the Settings row in the free tier too (opens for everyone, D-S10)", async () => {
    act(() => setEntitlementsForTest(FREE_SET));
    const { getByRole } = renderAt("/");
    await flushPrefsLoad();

    const settingsRow = getByRole("button", { name: "Settings" });
    fireEvent.click(settingsRow);
    expect(openSettingsSpy).toHaveBeenCalledWith("license", settingsRow);
  });

  it("free-tier 'Unlock Pro' opens Settings ▸ License (22.1-04 — converges with the Settings row, no separate upsell modal)", async () => {
    act(() => setEntitlementsForTest(FREE_SET));
    const { getByRole } = renderAt("/");
    await flushPrefsLoad();

    const footer = getByRole("button", { name: "Unlock Pro" });
    fireEvent.click(footer);

    // 22.1-04: the free-tier Unlock-Pro affordance now ALSO routes to the License
    // pane (the inline upsell lives there) — the standalone modal is gone.
    expect(openSettingsSpy).toHaveBeenCalledWith("license", footer);
  });
});

describe("Sidebar license attention footer (D-43/D-88)", () => {
  it("renders 'License needs attention' under FULL_SET when the license has a problem, and OPENS the Settings modal on the License pane (D-S11)", async () => {
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

    // D-S11: a manageable license opens the Settings modal on the License pane,
    // NOT the upsell modal and NOT a route navigation. MED-22-02: the clicked
    // footer is the explicit focus-return target.
    expect(openSettingsSpy).toHaveBeenCalledWith("license", footer);
    expect(queryByRole("dialog")).toBeNull();
  });

  it("renders 'License needs attention' for refreshNeeded and opens the Settings modal on the License pane (D-84/D-S11)", async () => {
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
    expect(openSettingsSpy).toHaveBeenCalledWith("license", footer);
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
