// @vitest-environment jsdom
// HotkeysSettings (SET-08, D-24-2/4/5/6, T-24-07) — the pane-level guards that
// HotkeyCaptureField's capture path cannot enforce because Reset is a direct
// button (no capture, no field-level self-collision check):
//   • Resetting a binding onto the OTHER binding's current chord is rejected and
//     persists NOTHING (no two bindings may collide, T-24-07);
//   • every reject (collision OR the summon OS-taken case) is mirrored into the
//     polite aria-live region so AT users hear the failure (WCAG-AA), not just a
//     stale success.
// usePreferences + rebindSummon are mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SUMMON_CHORD } from "@/shell/summon";
import { DEFAULT_PREFERENCES } from "@/shell/preferences";

const setSummonChord = vi.fn();
const setPaletteChord = vi.fn();
const rebindSummon = vi.fn<(oldChord: string, newChord: string) => Promise<void>>();
let mockPreferences: { summonChord: string; paletteChord: string };

vi.mock("@/shell/usePreferences", () => ({
  usePreferences: () => ({
    preferences: mockPreferences,
    setSummonChord,
    setPaletteChord,
  }),
}));
vi.mock("@/shell/summon", async (importActual) => {
  const actual = await importActual<typeof import("@/shell/summon")>();
  return { ...actual, rebindSummon: (o: string, n: string) => rebindSummon(o, n) };
});

import { HotkeysSettings } from "./HotkeysSettings";

const PALETTE_CHORD = DEFAULT_PREFERENCES.paletteChord;
const liveRegionText = () =>
  document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? "";
const resetSummon = () =>
  fireEvent.click(screen.getByRole("button", { name: "Reset Global summon to default" }));
const resetPalette = () =>
  fireEvent.click(screen.getByRole("button", { name: "Reset Command palette to default" }));

beforeEach(() => {
  setSummonChord.mockClear();
  setPaletteChord.mockClear();
  rebindSummon.mockReset();
  rebindSummon.mockResolvedValue(undefined);
  mockPreferences = { summonChord: SUMMON_CHORD, paletteChord: PALETTE_CHORD };
});
afterEach(cleanup);

describe("HotkeysSettings — reset-path collision guard (T-24-07)", () => {
  it("resetting Global summon onto the current palette chord is rejected and persists nothing", () => {
    // Palette currently holds the SUMMON default → resetting summon to it collides.
    mockPreferences = { summonChord: "Alt+J", paletteChord: SUMMON_CHORD };
    render(<HotkeysSettings />);

    resetSummon();

    expect(rebindSummon).not.toHaveBeenCalled();
    expect(setSummonChord).not.toHaveBeenCalled();
    // Surfaced both inline AND in the polite live region (WCAG-AA) — hence getAllByText.
    expect(
      screen.getAllByText("That shortcut is already used by the command palette.").length,
    ).toBeGreaterThanOrEqual(1);
    expect(liveRegionText()).toBe("That shortcut is already used by the command palette.");
  });

  it("resetting Command palette onto the current summon chord is rejected and persists nothing", () => {
    // Summon currently holds the PALETTE default → resetting palette to it collides.
    mockPreferences = { summonChord: PALETTE_CHORD, paletteChord: "Alt+P" };
    render(<HotkeysSettings />);

    resetPalette();

    expect(setPaletteChord).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("That shortcut is already used by the global summon.").length,
    ).toBeGreaterThanOrEqual(1);
    expect(liveRegionText()).toBe("That shortcut is already used by the global summon.");
  });

  it("a non-colliding reset persists the default and announces success", async () => {
    mockPreferences = { summonChord: "Alt+J", paletteChord: PALETTE_CHORD };
    render(<HotkeysSettings />);

    resetSummon();

    await waitFor(() =>
      expect(liveRegionText()).toBe(`Global summon set to ${SUMMON_CHORD}`),
    );
    expect(rebindSummon).toHaveBeenCalledWith("Alt+J", SUMMON_CHORD);
    expect(setSummonChord).toHaveBeenCalledWith(SUMMON_CHORD);
  });

  it("a summon OS-register reject is announced and persists nothing", async () => {
    mockPreferences = { summonChord: "Alt+J", paletteChord: PALETTE_CHORD };
    rebindSummon.mockRejectedValueOnce(new Error("MACHINE register failed"));
    render(<HotkeysSettings />);

    resetSummon();

    await waitFor(() =>
      expect(liveRegionText()).toBe("That shortcut is already in use — try another."),
    );
    expect(setSummonChord).not.toHaveBeenCalled();
  });
});
