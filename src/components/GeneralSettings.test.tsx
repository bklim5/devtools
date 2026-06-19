// @vitest-environment jsdom
// GeneralSettings (SET-09, D-24-7/10/12) — the pane-level behaviors beyond the
// reusable controls:
//   • launch-at-login toggle calls the autostart seam AND persists on success,
//     announcing the result;
//   • if the OS REJECTS the plist write (denied/MDM-locked), it persists NOTHING
//     and announces a calm message — never an unhandled rejection + silent revert;
//   • the "Open to" <select> guards a persisted default-tool id that is no longer
//     in the registry — it shows "Last used" rather than a blank option.
// platform.autostart + usePreferences are mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ENABLED_TOOLS } from "@/lib/tools/registry";

const setLaunchAtLogin = vi.fn();
const setStartInTray = vi.fn();
const setDefaultToolId = vi.fn();
const enable = vi.fn<() => Promise<void>>();
const disable = vi.fn<() => Promise<void>>();
const isEnabled = vi.fn<() => Promise<boolean>>();

let mockPreferences: {
  launchAtLogin: boolean;
  startInTray: boolean;
  defaultToolId: string | null;
};
let prefsLoaded: boolean;

vi.mock("@/lib/platform", () => ({
  platform: {
    autostart: {
      enable: () => enable(),
      disable: () => disable(),
      isEnabled: () => isEnabled(),
    },
  },
}));
vi.mock("@/shell/usePreferences", () => ({
  usePreferences: () => ({
    preferences: mockPreferences,
    prefsLoaded,
    setLaunchAtLogin,
    setStartInTray,
    setDefaultToolId,
  }),
}));

import { GeneralSettings } from "./GeneralSettings";

const liveRegionText = () =>
  document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  enable.mockResolvedValue(undefined);
  disable.mockResolvedValue(undefined);
  isEnabled.mockResolvedValue(false); // matches launchAtLogin:false → no reconcile write
  prefsLoaded = true;
  mockPreferences = {
    launchAtLogin: false,
    startInTray: false,
    defaultToolId: null,
  };
});
afterEach(cleanup);

describe("GeneralSettings — launch at login", () => {
  it("toggling ON calls enable(), persists the intent, and announces", async () => {
    render(<GeneralSettings />);
    fireEvent.click(screen.getByRole("switch", { name: "Launch at login" }));

    await waitFor(() => expect(setLaunchAtLogin).toHaveBeenCalledWith(true));
    expect(enable).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(liveRegionText()).toBe("Launch at login on"));
  });

  it("a rejected enable() persists NOTHING and announces a calm failure (no unhandled rejection)", async () => {
    enable.mockRejectedValueOnce(new Error("plist write denied"));
    render(<GeneralSettings />);
    fireEvent.click(screen.getByRole("switch", { name: "Launch at login" }));

    await waitFor(() =>
      expect(liveRegionText()).toBe("Couldn't change the login item — try again."),
    );
    expect(setLaunchAtLogin).not.toHaveBeenCalled();
  });

  it("reconciles the toggle to the OS truth on mount when the plist disagrees", async () => {
    isEnabled.mockResolvedValue(true); // OS says ON, persisted intent is false
    render(<GeneralSettings />);
    await waitFor(() => expect(setLaunchAtLogin).toHaveBeenCalledWith(true));
  });
});

describe("GeneralSettings — Open to (default tool)", () => {
  it("falls back to Last used when the persisted default-tool id is not in the registry", () => {
    mockPreferences.defaultToolId = "tool-that-no-longer-exists";
    render(<GeneralSettings />);
    const select = screen.getByLabelText("Open to") as HTMLSelectElement;
    expect(select.value).toBe("last-used");
  });

  it("shows the persisted tool when it is still in the registry", () => {
    const tool = ENABLED_TOOLS[0];
    mockPreferences.defaultToolId = tool.id;
    render(<GeneralSettings />);
    const select = screen.getByLabelText("Open to") as HTMLSelectElement;
    expect(select.value).toBe(tool.id);
  });

  it("selecting Last used persists null, selecting a tool persists its id", () => {
    render(<GeneralSettings />);
    const select = screen.getByLabelText("Open to") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: ENABLED_TOOLS[0].id } });
    expect(setDefaultToolId).toHaveBeenCalledWith(ENABLED_TOOLS[0].id);
    fireEvent.change(select, { target: { value: "last-used" } });
    expect(setDefaultToolId).toHaveBeenCalledWith(null);
  });
});
