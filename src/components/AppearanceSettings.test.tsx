// @vitest-environment jsdom
// AppearanceSettings (SET-07, D-23-2/D-23-3) — the gate-on-Save contract.
// Pro Save → setTheme + setAccent (no upsell); free Save → openProUpsell with the
// button el, persists NOTHING; the free Save button shows the visible lock
// affordance and stays keyboard-reachable; selecting a theme/accent updates pending
// state WITHOUT calling the setters (no persist before Save) and never touches the
// document root. usePreferences / useEntitlements / openProUpsell are mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ENT_THEMING, type EntitlementSet } from "@/lib/entitlements/entitlements";
import { ACCENT_SCALE } from "@/shell/appearance";

const setTheme = vi.fn();
const setAccent = vi.fn();
const openProUpsell = vi.fn();
let entitlements: EntitlementSet = new Set();

vi.mock("@/shell/usePreferences", () => ({
  usePreferences: () => ({
    preferences: { theme: "dark", accent: "#5b9bf8" },
    setTheme,
    setAccent,
  }),
}));
vi.mock("@/shell/useEntitlements", () => ({
  useEntitlements: () => entitlements,
}));
vi.mock("@/shell/proUpsell", () => ({
  openProUpsell: (el?: HTMLElement | null) => openProUpsell(el),
}));

import { AppearanceSettings } from "./AppearanceSettings";

beforeEach(() => {
  setTheme.mockClear();
  setAccent.mockClear();
  openProUpsell.mockClear();
  entitlements = new Set();
  delete document.documentElement.dataset.theme;
});
afterEach(cleanup);

describe("AppearanceSettings — gate on Save", () => {
  it("Pro Save persists pending theme + accent and does NOT open the upsell", () => {
    entitlements = new Set([ENT_THEMING]);
    render(<AppearanceSettings />);

    // Change pending selection (light theme + a non-default accent).
    fireEvent.click(screen.getByRole("radio", { name: /Light/ }));
    fireEvent.click(screen.getByRole("radio", { name: ACCENT_SCALE[2].label }));
    // Selection alone must NOT persist.
    expect(setTheme).not.toHaveBeenCalled();
    expect(setAccent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(setTheme).toHaveBeenCalledWith("light");
    expect(setAccent).toHaveBeenCalledWith(ACCENT_SCALE[2].dark);
    expect(openProUpsell).not.toHaveBeenCalled();
  });

  it("free Save opens openProUpsell with the button el and persists NOTHING", () => {
    entitlements = new Set();
    render(<AppearanceSettings />);

    fireEvent.click(screen.getByRole("radio", { name: /Light/ }));
    const saveBtn = screen.getByRole("button", { name: /Unlock Pro to save/ });
    fireEvent.click(saveBtn);

    expect(openProUpsell).toHaveBeenCalledTimes(1);
    expect(openProUpsell).toHaveBeenCalledWith(saveBtn);
    expect(setTheme).not.toHaveBeenCalled();
    expect(setAccent).not.toHaveBeenCalled();
  });

  it("free Save button shows the visible lock affordance and is keyboard-reachable (not disabled)", () => {
    entitlements = new Set();
    render(<AppearanceSettings />);
    const saveBtn = screen.getByRole("button", { name: /Unlock Pro to save/ });
    expect(saveBtn.hasAttribute("disabled")).toBe(false);
    // The lock glyph (lucide <svg>) is rendered inside the button.
    expect(saveBtn.querySelector("svg")).not.toBeNull();
  });

  it("selecting a theme/accent never writes to document.documentElement", () => {
    entitlements = new Set([ENT_THEMING]);
    render(<AppearanceSettings />);
    fireEvent.click(screen.getByRole("radio", { name: /Light/ }));
    fireEvent.click(screen.getByRole("radio", { name: ACCENT_SCALE[1].label }));
    // The contained-preview invariant: the global root is untouched pre-Save.
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("renders the pane header as an h3 (heading order), plus the three radiogroups", () => {
    render(<AppearanceSettings />);
    const h3 = screen.getByRole("heading", { level: 3, name: "Appearance" });
    expect(h3).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Accent color" })).toBeTruthy();
    // The contained preview strip exists (it renders an inert sample toggle).
    const preview = document.querySelector("[data-appearance-preview]");
    expect(preview).not.toBeNull();
    expect((preview as HTMLElement).textContent).toContain("Decoder");
  });
});
