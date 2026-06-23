// @vitest-environment jsdom
// StoreUpdatesSettings (MAS-BUILD-07, Phase 28-03, D-13) — the App-Store-managed
// Updates pane for the `appstore` build variant. KEEPS the running-version readout
// (the existing platform.app.getVersion() seam) and REPLACES the entire updater
// action block (Check / Install buttons + auto-check toggle + Last-checked) with a
// single calm "managed by the App Store" line. A SEPARATE module from
// UpdatesSettings so the updater machinery tree-shakes OUT of the store bundle.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";
import { StoreUpdatesSettings } from "./StoreUpdatesSettings";

/** Install a platform whose app.getVersion returns a fixed sentinel. */
function installPlatform(version = "1.2.3"): void {
  const base = makeMemoryPlatform();
  const platform: Platform = {
    ...base,
    app: { getVersion: async () => version },
  };
  setPlatformForTest(platform);
}

beforeEach(() => {
  installPlatform();
});

afterEach(() => {
  resetPlatformForTest();
  cleanup();
});

describe("StoreUpdatesSettings — version + managed line", () => {
  it("Test 1 — renders the running version from the platform seam", async () => {
    render(<StoreUpdatesSettings />);
    await waitFor(() =>
      expect(screen.getByText(/TinkerDev v1\.2\.3/)).toBeTruthy(),
    );
  });

  it("Test 2 — renders the App-Store-managed action line", () => {
    render(<StoreUpdatesSettings />);
    expect(
      screen.getByText("Your app updates are managed by the App Store."),
    ).toBeTruthy();
  });

  it("Test 3 — REMOVES the updater affordances (no Check/Install/toggle/Last-checked)", () => {
    render(<StoreUpdatesSettings />);
    expect(screen.queryByText("Check for updates")).toBeNull();
    expect(screen.queryByText(/^Install/)).toBeNull();
    expect(
      screen.queryByText("Automatically check for updates on launch"),
    ).toBeNull();
    expect(screen.queryByText(/Last checked/)).toBeNull();
  });
});
