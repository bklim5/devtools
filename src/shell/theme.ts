// Pure apply helpers for whole-app theme + accent (D-23-9). jsdom-testable: no
// native platform import — touches only document.documentElement (allowed DOM).
// The App root calls applyAppearance with the GATED (gatePreferences) theme/accent
// so a free user is always forced to the defaults.

import type { ThemeName } from "./preferences";
import { accentForTheme } from "./appearance";

/** With "system" removed (D-23-4), the named theme IS the effective theme — no
 *  prefers-color-scheme resolution. Kept as a thin identity so callers/tests that
 *  expect a "light" | "dark" return type stay stable. */
export function resolveEffectiveTheme(theme: ThemeName): "light" | "dark" {
  return theme;
}

/** The ONE place whole-app theme + accent is written to the DOM. Dark = the
 *  ABSENCE of data-theme (the @theme defaults paint); light = the
 *  [data-theme="light"] re-declaration block (Plan 02). Accent maps to the
 *  theme-appropriate hex via accentForTheme (the persisted value is the dark hex). */
export function applyAppearance(theme: ThemeName, accentDarkHex: string): void {
  const resolved = resolveEffectiveTheme(theme);
  const root = document.documentElement;
  if (resolved === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
  root.style.setProperty("--color-accent", accentForTheme(accentDarkHex, resolved));
}
