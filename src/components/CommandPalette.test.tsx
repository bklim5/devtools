// @vitest-environment jsdom
// SHL-02 / SHL-03: the ⌘K command palette. Opens on ⌘K (never auto-opens, D-07),
// fuzzy-filters via rankTools, surfaces recents first on an empty query (D-05),
// switches tool on Enter with no mouse and records the switch (recents + last-used),
// shows a quiet "No tools match" row on a miss (D-07), and closes on Esc.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CommandPalette } from "./CommandPalette";
import {
  setPlatformForTest,
  resetPlatformForTest,
  type Store,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { makeMemoryPlatform } from "@/shell/testStore";
import { PREFERENCES_STORE_KEY } from "@/shell/preferences";

// Spy on useNavigate so Enter's navigation is observable without a real route.
const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

let store: Store;

beforeEach(() => {
  navigateSpy.mockClear();
  store = createStoreStub();
  setPlatformForTest(makeMemoryPlatform(store));
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
}

function pressMetaK() {
  fireEvent.keyDown(window, { key: "k", metaKey: true });
}

describe("CommandPalette (⌘K fuzzy + recents + keyboard nav)", () => {
  it("does NOT auto-open on mount (D-07)", () => {
    const { queryByPlaceholderText } = renderPalette();
    expect(queryByPlaceholderText("Search tools…")).toBeNull();
  });

  it("opens on ⌘K and closes on a second ⌘K", async () => {
    const { queryByPlaceholderText } = renderPalette();
    act(() => pressMetaK());
    await waitFor(() =>
      expect(queryByPlaceholderText("Search tools…")).not.toBeNull(),
    );
    act(() => pressMetaK());
    await waitFor(() =>
      expect(queryByPlaceholderText("Search tools…")).toBeNull(),
    );
  });

  it("closes on Esc", async () => {
    const { queryByPlaceholderText } = renderPalette();
    act(() => pressMetaK());
    await waitFor(() =>
      expect(queryByPlaceholderText("Search tools…")).not.toBeNull(),
    );
    act(() => fireEvent.keyDown(window, { key: "Escape" }));
    await waitFor(() =>
      expect(queryByPlaceholderText("Search tools…")).toBeNull(),
    );
  });

  it("empty query shows ALL TOOLS (and RECENT once tools have been used)", async () => {
    await store.set(PREFERENCES_STORE_KEY, {
      theme: "dark",
      accent: "#3b82f6",
      lastUsedId: "base64",
      recentToolIds: ["base64"],
    });
    const { getByText, findByText } = renderPalette();
    act(() => pressMetaK());
    expect(await findByText("ALL TOOLS")).toBeDefined();
    // recents loaded async from the store → RECENT section appears
    await waitFor(() => expect(getByText("RECENT")).toBeDefined());
  });

  it("typing fuzzy-filters via rankTools", async () => {
    const { findByPlaceholderText, getByText, queryByText } = renderPalette();
    act(() => pressMetaK());
    const input = await findByPlaceholderText("Search tools…");
    fireEvent.change(input, { target: { value: "proto" } });
    await waitFor(() => expect(getByText("Protobuf Decoder")).toBeDefined());
    expect(queryByText("Unix Time")).toBeNull();
  });

  it("shows a quiet 'No tools match' row on a miss (not an error)", async () => {
    const { findByPlaceholderText, getByText } = renderPalette();
    act(() => pressMetaK());
    const input = await findByPlaceholderText("Search tools…");
    fireEvent.change(input, { target: { value: "zzzzqqqq" } });
    const row = await waitFor(() => getByText("No tools match"));
    expect(row.getAttribute("role")).not.toBe("alert");
  });

  it("↑/↓ + Enter switches tool with no mouse, records the switch, and closes", async () => {
    const { findByPlaceholderText, queryByPlaceholderText, findByText } = renderPalette();
    act(() => pressMetaK());
    const input = await findByPlaceholderText("Search tools…");
    fireEvent.change(input, { target: { value: "proto" } });
    await findByText("Protobuf Decoder");
    // First result is highlighted by default; Enter selects it.
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/tools/protobuf-decoder"),
    );
    // Palette closes after the switch.
    await waitFor(() =>
      expect(queryByPlaceholderText("Search tools…")).toBeNull(),
    );
    // The switch is recorded: recents now lead with the chosen id.
    await waitFor(async () => {
      const prefs = (await store.get(PREFERENCES_STORE_KEY)) as
        | { lastUsedId?: string; recentToolIds?: string[] }
        | undefined;
      expect(prefs?.lastUsedId).toBe("protobuf-decoder");
      expect(prefs?.recentToolIds?.[0]).toBe("protobuf-decoder");
    });
  });

  it("ArrowDown moves the highlight to the second result before Enter", async () => {
    const { findByPlaceholderText } = renderPalette();
    act(() => pressMetaK());
    const input = await findByPlaceholderText("Search tools…");
    // Empty query → registry order: unix-time, base64, protobuf-decoder.
    fireEvent.keyDown(input, { key: "ArrowDown" }); // highlight index 1 (base64)
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/tools/base64"),
    );
  });

  it("clicking a row switches to that tool", async () => {
    const { findByPlaceholderText, findByText } = renderPalette();
    act(() => pressMetaK());
    await findByPlaceholderText("Search tools…");
    const row = await findByText("Unix Time");
    fireEvent.click(row);
    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith("/tools/unix-time"),
    );
  });

  it("renders the footer keyboard hints", async () => {
    const { findByPlaceholderText, getByText } = renderPalette();
    act(() => pressMetaK());
    await findByPlaceholderText("Search tools…");
    expect(getByText(/navigate/i)).toBeDefined();
    expect(getByText(/open/i)).toBeDefined();
    expect(getByText(/close/i)).toBeDefined();
  });

  it("a tampered recents id that is not a real tool is skipped (T-02-10)", async () => {
    await store.set(PREFERENCES_STORE_KEY, {
      theme: "dark",
      accent: "#3b82f6",
      lastUsedId: null,
      recentToolIds: ["../../etc/passwd", "base64"],
    });
    const { findByPlaceholderText } = renderPalette();
    act(() => pressMetaK());
    await findByPlaceholderText("Search tools…");
    // The bogus id never renders a row; only the real "base64" recent does.
    await waitFor(() => {
      const recentLabel = document.body.textContent ?? "";
      expect(recentLabel).not.toContain("etc/passwd");
    });
  });
});
