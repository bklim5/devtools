// @vitest-environment jsdom
// AccentSwatchGrid (D-23-7) — seven accessible accent swatches. Asserts the
// radiogroup structure (7 role="radio" driven by ACCENT_SCALE.length), each swatch
// has an accessible name, aria-checked + a Check glyph mark the selection (NOT by
// color alone), onChange fires the dark hex on click, and arrow keys move selection.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AccentSwatchGrid } from "./AccentSwatchGrid";
import { ACCENT_SCALE } from "@/shell/appearance";

afterEach(cleanup);

describe("AccentSwatchGrid", () => {
  it("renders one radio per ACCENT_SCALE entry, each with its label name", () => {
    render(<AccentSwatchGrid value={ACCENT_SCALE[0].dark} onChange={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Accent color" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(ACCENT_SCALE.length);
    for (const pair of ACCENT_SCALE) {
      expect(within(group).getByRole("radio", { name: pair.label })).toBeTruthy();
    }
  });

  it("marks the selected swatch via aria-checked AND a visible Check glyph (not color-alone)", () => {
    const selected = ACCENT_SCALE[1]; // violet
    render(<AccentSwatchGrid value={selected.dark} onChange={() => {}} />);
    const radio = screen.getByRole("radio", { name: selected.label });
    expect(radio.getAttribute("aria-checked")).toBe("true");
    // The Check glyph is rendered inside the selected swatch (lucide <svg>).
    expect(radio.querySelector("svg")).not.toBeNull();
    // Unselected swatches render no glyph.
    const other = screen.getByRole("radio", { name: ACCENT_SCALE[0].label });
    expect(other.querySelector("svg")).toBeNull();
  });

  it("fires onChange with the clicked swatch's dark hex", () => {
    const onChange = vi.fn();
    render(<AccentSwatchGrid value={ACCENT_SCALE[0].dark} onChange={onChange} />);
    const target = ACCENT_SCALE[2];
    fireEvent.click(screen.getByRole("radio", { name: target.label }));
    expect(onChange).toHaveBeenCalledWith(target.dark);
  });

  it("moves selection with arrow keys (clamped, no wrap)", () => {
    const onChange = vi.fn();
    render(<AccentSwatchGrid value={ACCENT_SCALE[0].dark} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: ACCENT_SCALE[0].label }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenLastCalledWith(ACCENT_SCALE[1].dark);
  });

  it("clamps at the end (ArrowRight on the last swatch is a no-op)", () => {
    const onChange = vi.fn();
    const last = ACCENT_SCALE[ACCENT_SCALE.length - 1];
    render(<AccentSwatchGrid value={last.dark} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: last.label }), {
      key: "ArrowRight",
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
