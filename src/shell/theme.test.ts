// @vitest-environment jsdom
// Pure apply helpers (D-23-9): resolveEffectiveTheme is now an identity (the named
// theme IS the effective theme — "system" removed, D-23-4); applyAppearance stamps
// data-theme + --color-accent on documentElement. documentElement mutations are
// cleaned up in afterEach so tests never leak state into each other.
import { afterEach, describe, expect, it } from "vitest";
import { applyAppearance, resolveEffectiveTheme } from "./theme";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.documentElement.style.removeProperty("--color-accent");
});

describe("resolveEffectiveTheme", () => {
  it("returns the theme verbatim for dark/light (identity — system removed)", () => {
    expect(resolveEffectiveTheme("dark")).toBe("dark");
    expect(resolveEffectiveTheme("light")).toBe("light");
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

});
