// @vitest-environment jsdom
// HotkeyCaptureField (SET-08, D-24-1/2/3/4) — the reusable capture contract:
//   • activating the field enters recording ("Press a shortcut…");
//   • Escape cancels with NO onCommit (D-24-1);
//   • a valid Cmd+Shift+J commits the e.code-based chord;
//   • a reserved Cmd+Space does NOT commit (inline reserved message);
//   • an Option+P composed-glyph event (key:"π", code:"KeyP") commits Alt+P via
//     the PHYSICAL code (macos-option-key-composes-letters);
//   • a chord equal to otherChord does NOT commit (self-collision guard);
//   • Reset is keyboard-reachable and calls onReset.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HotkeyCaptureField } from "./HotkeyCaptureField";

const onCommit = vi.fn();
const onReset = vi.fn();
const onRecordingClearReject = vi.fn();

function renderField(overrides: Partial<Parameters<typeof HotkeyCaptureField>[0]> = {}) {
  return render(
    <HotkeyCaptureField
      label="Global summon"
      helper="Show TinkerDev from anywhere."
      chord="CommandOrControl+Shift+D"
      otherChord="CommandOrControl+K"
      otherLabel="the command palette"
      rejectMessage={null}
      onCommit={onCommit}
      onReset={onReset}
      onRecordingClearReject={onRecordingClearReject}
      {...overrides}
    />,
  );
}

/** Dispatch a keydown on window in the CAPTURE phase (the listener is attached
 *  with capture: true). jsdom delivers capture-phase listeners on window. */
function pressKey(init: KeyboardEventInit) {
  fireEvent(
    window,
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
  );
}

function startRecording() {
  fireEvent.click(screen.getByRole("button", { name: "Rebind Global summon" }));
}

beforeEach(() => {
  onCommit.mockClear();
  onReset.mockClear();
  onRecordingClearReject.mockClear();
});
afterEach(cleanup);

describe("HotkeyCaptureField", () => {
  it("idle shows the current chord and an accessible Rebind name", () => {
    renderField();
    expect(screen.getByText("CommandOrControl+Shift+D")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rebind Global summon" })).toBeTruthy();
  });

  it("activating the field enters recording (Press a shortcut…)", () => {
    renderField();
    startRecording();
    expect(screen.getByText("Press a shortcut…")).toBeTruthy();
    expect(screen.getByText("Esc to cancel")).toBeTruthy();
  });

  it("Escape cancels recording with NO onCommit (D-24-1)", () => {
    renderField();
    startRecording();
    pressKey({ key: "Escape", code: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    // Back to idle: the chord is shown again, the recording prompt is gone.
    expect(screen.queryByText("Press a shortcut…")).toBeNull();
  });

  it("a valid Cmd+Shift+J commits the e.code-based chord", () => {
    renderField();
    startRecording();
    pressKey({ key: "j", code: "KeyJ", metaKey: true, shiftKey: true });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("CommandOrControl+Shift+J");
    expect(onRecordingClearReject).toHaveBeenCalledTimes(1);
  });

  it("a reserved Cmd+Space does NOT commit (calm reserved message)", () => {
    renderField();
    startRecording();
    pressKey({ key: " ", code: "Space", metaKey: true });
    expect(onCommit).not.toHaveBeenCalled();
    expect(
      screen.getByText("That shortcut is reserved by macOS — try another."),
    ).toBeTruthy();
  });

  it("an invalid chord (no non-shift modifier) keeps recording and shows the hint", () => {
    renderField();
    startRecording();
    pressKey({ key: "j", code: "KeyJ", shiftKey: true }); // shift-only → invalid
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("Add Cmd, Ctrl, or Alt to set a shortcut.")).toBeTruthy();
    // Still recording (the prompt remains).
    expect(screen.getByText("Press a shortcut…")).toBeTruthy();
  });

  it("an Option+P composed glyph (key:π, code:KeyP) commits Alt+P via the physical code", () => {
    renderField();
    startRecording();
    pressKey({ key: "π", code: "KeyP", altKey: true });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith("Alt+P");
  });

  it("a chord equal to otherChord does NOT commit (self-collision guard, T-24-07)", () => {
    renderField();
    startRecording();
    // otherChord is CommandOrControl+K → press Cmd+K.
    pressKey({ key: "k", code: "KeyK", metaKey: true });
    expect(onCommit).not.toHaveBeenCalled();
    expect(
      screen.getByText("That shortcut is already used by the command palette."),
    ).toBeTruthy();
  });

  it("the parent reject message renders below the field (calm, neutral)", () => {
    renderField({ rejectMessage: "That shortcut is already in use — try another." });
    expect(
      screen.getByText("That shortcut is already in use — try another."),
    ).toBeTruthy();
  });

  it("Reset is keyboard-reachable and calls onReset", () => {
    renderField();
    const resetBtn = screen.getByRole("button", {
      name: "Reset Global summon to default",
    });
    expect(resetBtn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
