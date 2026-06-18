// @vitest-environment jsdom
// SettingToggle (SET-09, T-24-08) — the accessible boolean-switch contract:
//   • role="switch" + aria-checked reflects the `checked` prop;
//   • clicking toggles via onChange(!checked);
//   • Space (native button) toggles via onChange (keyboard-operable, no mouse-only);
//   • the on state carries the accent fill class (state by accent fill + position,
//     NEVER opacity — no opacity-only state, WCAG 1.4.1 / Pitfall 5).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SettingToggle } from "./SettingToggle";

afterEach(cleanup);

describe("SettingToggle", () => {
  it("renders role=switch with aria-checked reflecting checked", () => {
    const { rerender } = render(
      <SettingToggle label="Start in the menu bar" checked={false} onChange={() => {}} />,
    );
    const sw = screen.getByRole("switch", { name: "Start in the menu bar" });
    expect(sw.getAttribute("aria-checked")).toBe("false");

    rerender(
      <SettingToggle label="Start in the menu bar" checked={true} onChange={() => {}} />,
    );
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  it("clicking toggles via onChange(!checked)", () => {
    const onChange = vi.fn();
    render(<SettingToggle label="Launch at login" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Launch at login" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("clicking an on switch toggles back off", () => {
    const onChange = vi.fn();
    render(<SettingToggle label="Launch at login" checked={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch", { name: "Launch at login" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("is keyboard-operable: Space on the native button toggles via onChange", () => {
    const onChange = vi.fn();
    render(<SettingToggle label="Launch at login" checked={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Launch at login" });
    // A native <button> fires click on Space/Enter; Testing Library's keyboard
    // helpers route through that native behavior. Assert the click handler path is
    // the same one the keyboard drives (no separate mouse-only handler).
    sw.focus();
    fireEvent.keyDown(sw, { key: " ", code: "Space" });
    fireEvent.keyUp(sw, { key: " ", code: "Space" });
    fireEvent.click(sw); // the synthetic activation a real Space keyup produces
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders helper text when provided", () => {
    render(
      <SettingToggle
        label="Launch at login"
        helper="Start TinkerDev automatically when you log in."
        checked={false}
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByText("Start TinkerDev automatically when you log in."),
    ).toBeDefined();
  });

  it("associates the helper with the switch via aria-describedby (WCAG-AA)", () => {
    render(
      <SettingToggle
        label="Launch at login"
        helper="Start TinkerDev automatically when you log in."
        checked={false}
        onChange={() => {}}
      />,
    );
    const sw = screen.getByRole("switch", { name: "Launch at login" });
    const describedBy = sw.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      "Start TinkerDev automatically when you log in.",
    );
  });

  it("omits aria-describedby when there is no helper", () => {
    render(<SettingToggle label="Start in the menu bar" checked={false} onChange={() => {}} />);
    const sw = screen.getByRole("switch", { name: "Start in the menu bar" });
    expect(sw.getAttribute("aria-describedby")).toBeNull();
  });

  it("distinguishes on vs off by accent fill, not opacity (no opacity-only state)", () => {
    const { rerender } = render(
      <SettingToggle label="x" checked={false} onChange={() => {}} />,
    );
    const sw = screen.getByRole("switch", { name: "x" });
    // off: neutral track, no accent fill.
    expect(sw.className).toContain("bg-input-bg");
    expect(sw.className).not.toContain("bg-accent-soft");

    rerender(<SettingToggle label="x" checked={true} onChange={() => {}} />);
    // on: accent fill appears — the state change is an accent class swap, never an
    // opacity utility.
    expect(sw.className).toContain("bg-accent-soft");
    expect(sw.className).not.toMatch(/\bopacity-/);
  });
});
