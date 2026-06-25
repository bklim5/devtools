// @vitest-environment jsdom
// useAppearance (D-23-9/D-23-5) applies the GATED effective theme+accent to
// documentElement and writes the gated paint-hint to localStorage, ONLY once both
// prefs are loaded AND entitlements are resolved (no Pro launch dark-flash). With
// "system" removed (D-23-4) there is no OS-appearance live-flip. usePreferences /
// useEntitlements / useEntitlementsResolved are mocked so the test drives
// prefs+ents directly.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { DEFAULT_PREFERENCES, type Preferences } from "./preferences";
import { FREE_SET, FULL_SET } from "@/lib/entitlements/entitlements";
import { THEME_HINT_KEY, useAppearance } from "./useAppearance";

// --- mocks ------------------------------------------------------------------

let mockPrefs: Preferences;
let mockPrefsLoaded: boolean;
let mockEnts: ReadonlySet<string>;
let mockEntsResolved: boolean;

vi.mock("./usePreferences", () => ({
  usePreferences: () => ({ preferences: mockPrefs, prefsLoaded: mockPrefsLoaded }),
}));
vi.mock("./useEntitlements", () => ({
  useEntitlements: () => mockEnts,
  useEntitlementsResolved: () => mockEntsResolved,
}));

// Spy on the native window-chrome seam (Overlay titlebar theme sync). hoisted so
// the vi.mock factory can close over it.
const { setThemeSpy } = vi.hoisted(() => ({ setThemeSpy: vi.fn() }));
vi.mock("@/lib/platform", () => ({
  initPlatform: vi.fn().mockResolvedValue(undefined),
  platform: { window: { setTheme: setThemeSpy } },
}));

function prefs(overrides: Partial<Preferences>): Preferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

beforeEach(() => {
  mockPrefs = DEFAULT_PREFERENCES;
  mockPrefsLoaded = true;
  mockEnts = FULL_SET;
  mockEntsResolved = true;
  localStorage.clear();
  setThemeSpy.mockClear();
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty("--color-accent");
});

describe("useAppearance", () => {
  it("does NOTHING before prefsLoaded — documentElement untouched, no hint written", () => {
    mockPrefsLoaded = false;
    mockPrefs = prefs({ theme: "light", accent: "#a78bfa" });
    renderHook(() => useAppearance());
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe("");
    expect(localStorage.getItem(THEME_HINT_KEY)).toBeNull();
  });

  it("does NOTHING before entitlements resolve — no Pro launch dark-flash (D-23-5)", () => {
    // A Pro user whose prefs say light, but entitlements not yet resolved: the
    // apply must HOLD (the pre-paint frame stands) so dark never clobbers light.
    mockEntsResolved = false;
    mockEnts = FULL_SET;
    mockPrefs = prefs({ theme: "light", accent: "#a78bfa" });
    renderHook(() => useAppearance());
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_HINT_KEY)).toBeNull();
  });

  it("FULL_SET, light + violet → applies light + the violet LIGHT accent + light hint", () => {
    mockEnts = FULL_SET;
    mockPrefs = prefs({ theme: "light", accent: "#a78bfa" });
    renderHook(() => useAppearance());
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(
      "#6d28d9", // violet light variant
    );
    expect(localStorage.getItem(THEME_HINT_KEY)).toBe("light");
  });

  it("FREE_SET forces dark + #5b9bf8 + a GATED dark hint even when prefs say light/violet", () => {
    mockEnts = FREE_SET;
    mockPrefs = prefs({ theme: "light", accent: "#a78bfa" });
    // Seed a stale light attribute to prove the gate deletes it (dark = absence).
    document.documentElement.dataset.theme = "light";
    renderHook(() => useAppearance());
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(
      "#5b9bf8",
    );
    expect(localStorage.getItem(THEME_HINT_KEY)).toBe("dark"); // gated, not raw "light"
  });

  // --- native window-chrome sync (Overlay titlebar legibility) --------------

  it("syncs native window theme to the gated effective theme (light) once ents resolve", async () => {
    mockEnts = FULL_SET;
    mockPrefs = prefs({ theme: "light", accent: "#a78bfa" });
    renderHook(() => useAppearance());
    await waitFor(() => expect(setThemeSpy).toHaveBeenCalledWith("light"));
  });

  it("FREE_SET gates the native theme to dark even when prefs say light", async () => {
    mockEnts = FREE_SET;
    mockPrefs = prefs({ theme: "light", accent: "#a78bfa" });
    renderHook(() => useAppearance());
    await waitFor(() => expect(setThemeSpy).toHaveBeenCalledWith("dark"));
  });

  it("before ents resolve, syncs native chrome to the pre-paint HINT (not gated) so the titlebar matches the DOM at reveal", async () => {
    // The DOM apply HOLDS until ents resolve, but the native chrome must still
    // track what the pre-paint script painted — the hint — or the Overlay title
    // goes invisible in the opposite mode during the entitlement-resolve window.
    mockEntsResolved = false;
    mockPrefs = prefs({ theme: "dark" });
    localStorage.setItem(THEME_HINT_KEY, "light");
    renderHook(() => useAppearance());
    await waitFor(() => expect(setThemeSpy).toHaveBeenCalledWith("light"));
    // DOM apply still held (existing invariant) — only the native chrome synced.
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
