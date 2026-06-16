// @vitest-environment jsdom
// useAppearance (D-23-9/D-23-5) applies the GATED effective theme+accent to
// documentElement, writes the gated paint-hint to localStorage, and live-flips on
// an OS appearance change while the effective theme is system. usePreferences /
// useEntitlements are mocked so the test drives prefs+ents directly; matchMedia is
// stubbed (jsdom has none) so the "system" path + its change listener are testable.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { DEFAULT_PREFERENCES, type Preferences } from "./preferences";
import { FREE_SET, FULL_SET } from "@/lib/entitlements/entitlements";
import { THEME_HINT_KEY, useAppearance } from "./useAppearance";

// --- mocks ------------------------------------------------------------------

let mockPrefs: Preferences;
let mockPrefsLoaded: boolean;
let mockEnts: ReadonlySet<string>;

vi.mock("./usePreferences", () => ({
  usePreferences: () => ({ preferences: mockPrefs, prefsLoaded: mockPrefsLoaded }),
}));
vi.mock("./useEntitlements", () => ({
  useEntitlements: () => mockEnts,
}));

// A controllable matchMedia: each call returns the same handle so the test can
// fire its "change" listener and assert add/removeEventListener.
const mqAdd = vi.fn();
const mqRemove = vi.fn();
let mqMatches = false;
let mqChangeHandler: (() => void) | null = null;

function stubMatchMedia(matches: boolean): void {
  mqMatches = matches;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: mqMatches,
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: () => void) => {
      mqChangeHandler = cb;
      mqAdd();
    },
    removeEventListener: () => {
      mqChangeHandler = null;
      mqRemove();
    },
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  }));
}

function prefs(overrides: Partial<Preferences>): Preferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

beforeEach(() => {
  mockPrefs = DEFAULT_PREFERENCES;
  mockPrefsLoaded = true;
  mockEnts = FULL_SET;
  mqAdd.mockClear();
  mqRemove.mockClear();
  mqChangeHandler = null;
  stubMatchMedia(false);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("system: applies the live OS theme and live-flips on a matchMedia change", () => {
    mockEnts = FULL_SET;
    mockPrefs = prefs({ theme: "system", accent: "#5b9bf8" });
    stubMatchMedia(false); // OS prefers light
    renderHook(() => useAppearance());
    // Initial apply: OS light → data-theme=light.
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(mqAdd).toHaveBeenCalled();

    // OS flips to dark → fire the change listener → re-applies to dark (absence).
    mqMatches = true;
    expect(mqChangeHandler).not.toBeNull();
    mqChangeHandler?.();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("removes the matchMedia listener on unmount (no leak)", () => {
    mockEnts = FULL_SET;
    mockPrefs = prefs({ theme: "system", accent: "#5b9bf8" });
    const { unmount } = renderHook(() => useAppearance());
    expect(mqAdd).toHaveBeenCalled();
    unmount();
    expect(mqRemove).toHaveBeenCalled();
  });

  it("does NOT subscribe matchMedia when the effective theme is not system", () => {
    mockEnts = FULL_SET;
    mockPrefs = prefs({ theme: "dark", accent: "#5b9bf8" });
    renderHook(() => useAppearance());
    expect(mqAdd).not.toHaveBeenCalled();
  });
});
