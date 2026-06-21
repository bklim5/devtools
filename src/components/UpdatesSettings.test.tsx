// @vitest-environment jsdom
// UpdatesSettings (SET-10, D-25-1/4/5/7/8) — the ungated Updates pane. These tests
// drive the REAL useUpdater + usePreferences singletons (stubbing ONLY the platform
// seam via setPlatformForTest), so the pane's wiring to the shared check flow + the
// prefs seam is exercised end-to-end — not a mock of the hooks. Covered:
//   • the injected stub version renders ("1.2.3");
//   • last-checked is the literal "Never" with no prior check, a relative string once
//     lastUpdateCheck is set (D-25-7);
//   • "Check for updates" → runCheck(true): an up-to-date stub surfaces the result
//     copy inline (polite aria-live, WCAG-AA);
//   • the auto-check toggle reflects autoUpdateCheck (null/false → off, true → on) and
//     flipping writes through the single-writer seam (getSharedPreferences changes);
//   • an Install button appears ONLY when an update is detected and is wired to the
//     shared install() — a second entry point to the same action as the banner
//     (D-25-5 revised at the Phase-25 checkpoint);
// plus the append-only SETTINGS_PANES registry shape (Updates present, General first).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { makeMemoryPlatform } from "@/shell/testStore";
import {
  getSharedPreferences,
  resetPreferencesForTest,
  updatePreferences,
} from "@/shell/usePreferences";
import { resetUpdaterForTest, setUpdateInfoForTest } from "@/shell/useUpdater";
import { UpdatesSettings } from "./UpdatesSettings";
import { SETTINGS_PANES } from "./settingsPanes";

/** Install a platform whose app.getVersion returns a fixed sentinel and whose
 *  updater.check resolves null (current — no update available), exercising the
 *  up-to-date path through the REAL useUpdater singleton. */
function installPlatform(): void {
  const base = makeMemoryPlatform();
  const platform: Platform = {
    ...base,
    app: { getVersion: async () => "1.2.3" },
    updater: { ...base.updater, check: async () => null },
  };
  setPlatformForTest(platform);
}

beforeEach(() => {
  resetPreferencesForTest();
  resetUpdaterForTest();
  installPlatform();
});

afterEach(() => {
  resetPlatformForTest();
  cleanup();
});

describe("UpdatesSettings — version + last-checked", () => {
  it("renders the version from the platform seam", async () => {
    render(<UpdatesSettings />);
    await waitFor(() =>
      expect(screen.getByText(/TinkerDev v1\.2\.3/)).toBeTruthy(),
    );
  });

  it('shows "Never" when there has been no check', () => {
    render(<UpdatesSettings />);
    expect(screen.getByText("Never")).toBeTruthy();
  });

  it("shows a relative time (not Never) once lastUpdateCheck is set", async () => {
    // Seed a recent stamp through the single-writer seam BEFORE render so the pane
    // reads it from the shared singleton.
    updatePreferences({ lastUpdateCheck: Date.now() - 5 * 60_000 }); // 5 min ago
    render(<UpdatesSettings />);
    expect(screen.queryByText("Never")).toBeNull();
    // relativeTime yields an "ago" string; the absolute fallback also never says Never.
    const labelHost = screen.getByText(/Last checked:/);
    expect(labelHost.textContent ?? "").not.toContain("Never");
  });
});

describe("UpdatesSettings — check for updates", () => {
  it("clicking Check for updates surfaces the up-to-date result inline", async () => {
    render(<UpdatesSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Check for updates" }));
    // The stub check resolves null (current) → the shared status is the up-to-date
    // copy, surfaced in the pane's polite live region.
    await waitFor(() =>
      expect(screen.getByText("You're up to date")).toBeTruthy(),
    );
  });

  it("renders NO install button until an update is detected", () => {
    render(<UpdatesSettings />);
    expect(screen.queryByRole("button", { name: /install/i })).toBeNull();
  });

  it("shows an Install button when an update is detected, wired to the shared install() (D-25-5 revised)", async () => {
    const downloadAndInstall = vi.fn(async () => {});
    const base = makeMemoryPlatform();
    setPlatformForTest({
      ...base,
      app: { getVersion: async () => "1.2.3" },
      updater: { ...base.updater, check: async () => null, downloadAndInstall },
    });
    // A detected update flows through the SAME shared singleton the banner reads.
    setUpdateInfoForTest({ version: "9.9.9", notes: "shiny", date: "2026-06-21" });
    render(<UpdatesSettings />);

    fireEvent.click(
      screen.getByRole("button", { name: /install version 9\.9\.9/i }),
    );
    // The pane button is a second entry point to the ONE shared install action.
    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalledTimes(1));
  });
});

describe("UpdatesSettings — auto-check toggle", () => {
  it("reflects autoUpdateCheck null/false as off and true as on", () => {
    const { rerender } = render(<UpdatesSettings />);
    // Default autoUpdateCheck is null → the switch reads off.
    let sw = screen.getByRole("switch", {
      name: "Automatically check for updates on launch",
    });
    expect(sw.getAttribute("aria-checked")).toBe("false");

    updatePreferences({ autoUpdateCheck: true });
    rerender(<UpdatesSettings />);
    sw = screen.getByRole("switch", {
      name: "Automatically check for updates on launch",
    });
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("flipping the toggle writes through the single-writer prefs seam", async () => {
    render(<UpdatesSettings />);
    fireEvent.click(
      screen.getByRole("switch", {
        name: "Automatically check for updates on launch",
      }),
    );
    await waitFor(() =>
      expect(getSharedPreferences().autoUpdateCheck).toBe(true),
    );
  });
});

describe("SETTINGS_PANES — append-only Updates entry", () => {
  it("contains exactly one Updates pane and keeps General as the landing pane", () => {
    expect(SETTINGS_PANES.filter((p) => p.id === "updates")).toHaveLength(1);
    expect(SETTINGS_PANES[0].id).toBe("general");
  });
});
