// @vitest-environment jsdom
// ResizableSplit (D-09 / PRO-05 / UX-05): an in-house ~30-line col-resize divider.
// Renders left + right children with a draggable separator; a pointer drag updates
// the split ratio using RELATIVE grid units (no fixed px widths on the panes).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ResizableSplit } from "./ResizableSplit";

afterEach(cleanup);

describe("ResizableSplit", () => {
  it("renders both children and a col-resize separator", () => {
    const { getByText, container } = render(
      <ResizableSplit left={<div>LEFT</div>} right={<div>RIGHT</div>} />,
    );
    expect(getByText("LEFT")).toBeTruthy();
    expect(getByText("RIGHT")).toBeTruthy();
    const separator = container.querySelector('[role="separator"]');
    expect(separator).toBeTruthy();
    expect(separator!.className).toContain("cursor-col-resize");
  });

  it("uses relative fr grid units (no fixed-px pane widths)", () => {
    const { container } = render(
      <ResizableSplit left={<div>L</div>} right={<div>R</div>} />,
    );
    const grid = container.firstChild as HTMLElement;
    const cols = grid.style.gridTemplateColumns;
    // Both panes are fr (relative); the ONLY px is the fixed 7px divider gutter.
    expect(cols).toMatch(/fr 7px [\d.]+fr/);
    const pxTokens = cols.match(/[\d.]+px/g) ?? [];
    expect(pxTokens).toEqual(["7px"]);
  });

  it("a pointer drag updates the grid-template ratio", () => {
    const { container } = render(
      <ResizableSplit left={<div>L</div>} right={<div>R</div>} />,
    );
    const grid = container.firstChild as HTMLElement;
    const separator = container.querySelector('[role="separator"]') as HTMLElement;
    // jsdom gives a 0-size rect; stub getBoundingClientRect so the ratio math has a width.
    grid.getBoundingClientRect = () =>
      ({ left: 0, width: 1000, top: 0, height: 100, right: 1000, bottom: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;

    const before = grid.style.gridTemplateColumns;
    fireEvent.pointerDown(separator, { clientX: 500 });
    fireEvent.pointerMove(window, { clientX: 750 });
    fireEvent.pointerUp(window, { clientX: 750 });
    expect(grid.style.gridTemplateColumns).not.toBe(before);
  });
});
