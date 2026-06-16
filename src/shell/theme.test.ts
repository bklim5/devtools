// @vitest-environment jsdom
// Pure apply helpers (D-23-9): resolveEffectiveTheme reads matchMedia; applyAppearance
// stamps data-theme + --color-accent on documentElement. jsdom has no real
// matchMedia, so each test stubs window.matchMedia; documentElement mutations are
// cleaned up in afterEach so tests never leak state into each other.
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAppearance, resolveEffectiveTheme } from "./theme";

function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty("--color-accent");
});

describe("resolveEffectiveTheme", () => {
  it("returns the concrete theme verbatim for dark/light", () => {
    expect(resolveEffectiveTheme("dark")).toBe("dark");
    expect(resolveEffectiveTheme("light")).toBe("light");
  });

  it("system → dark when matchMedia prefers dark", () => {
    stubMatchMedia(true);
    expect(resolveEffectiveTheme("system")).toBe("dark");
  });

  it("system → light when matchMedia prefers light", () => {
    stubMatchMedia(false);
    expect(resolveEffectiveTheme("system")).toBe("light");
  });
});

describe("applyAppearance", () => {
  it("light: sets data-theme=light AND the light accent variant", () => {
    applyAppearance("light", "#5b9bf8");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(
      "#1763d6",
    );
  });

  it("dark: DELETES data-theme (dark = absence) AND sets the dark accent", () => {
    // Seed a stale light attribute to prove it gets removed, not set to "dark".
    document.documentElement.dataset.theme = "light";
    applyAppearance("dark", "#5b9bf8");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(
      "#5b9bf8",
    );
  });

  it("system with matchMedia-light: data-theme=light + light accent", () => {
    stubMatchMedia(false);
    applyAppearance("system", "#a78bfa");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(
      "#6d28d9",
    );
  });

  it("system with matchMedia-dark: deletes data-theme + dark accent", () => {
    stubMatchMedia(true);
    applyAppearance("system", "#a78bfa");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(
      "#a78bfa",
    );
  });
});
