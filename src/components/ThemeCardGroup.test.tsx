// @vitest-environment jsdom
// ThemeCardGroup (D-23-6) — three accessible theme radio cards. Asserts the
// radiogroup structure (3 role="radio" cards Dark/Light/System), aria-checked
// reflects the value, onChange fires the right theme on click, and arrow keys move
// selection (clamped, no wrap). NOT a SegmentedControl.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeCardGroup } from "./ThemeCardGroup";

afterEach(cleanup);

describe("ThemeCardGroup", () => {
  it("renders exactly three theme radio cards labelled Dark/Light/System", () => {
    render(<ThemeCardGroup value="dark" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(within(group).getByRole("radio", { name: /Dark/ })).toBeTruthy();
    expect(within(group).getByRole("radio", { name: /Light/ })).toBeTruthy();
    expect(within(group).getByRole("radio", { name: /System/ })).toBeTruthy();
  });

  it("reflects the selected value via aria-checked", () => {
    render(<ThemeCardGroup value="light" onChange={() => {}} />);
    const light = screen.getByRole("radio", { name: /Light/ });
    expect(light.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByRole("radio", { name: /Dark/ }).getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("fires onChange with the clicked theme", () => {
    const onChange = vi.fn();
    render(<ThemeCardGroup value="dark" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /System/ }));
    expect(onChange).toHaveBeenCalledWith("system");
  });

  it("moves selection with arrow keys (next/prev, clamped)", () => {
    const onChange = vi.fn();
    render(<ThemeCardGroup value="dark" onChange={onChange} />);
    // dark -> right -> light
    fireEvent.keyDown(screen.getByRole("radio", { name: /Dark/ }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenLastCalledWith("light");
  });

  it("clamps at the start (ArrowLeft on the first card is a no-op)", () => {
    const onChange = vi.fn();
    render(<ThemeCardGroup value="dark" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: /Dark/ }), {
      key: "ArrowLeft",
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clamps at the end (ArrowRight on System is a no-op)", () => {
    const onChange = vi.fn();
    render(<ThemeCardGroup value="system" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: /System/ }), {
      key: "ArrowRight",
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
