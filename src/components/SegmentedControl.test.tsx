// @vitest-environment jsdom
// SegmentedControl (D-16): the shared accent-on-active aria-pressed toggle promoted
// out of FormatterView, reused by the URL tool's mode switch + component|full scope
// toggle (Phase 13). Asserts the role=group + aria-label wrapper, aria-pressed on the
// active option (accent = selected only), and onChange firing with the clicked value.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { SegmentedControl } from "./SegmentedControl";

afterEach(cleanup);

const OPTIONS = [
  { value: "parse", label: "Parse" },
  { value: "encode", label: "Encode/Decode" },
] as const;

describe("SegmentedControl", () => {
  it("renders a labeled role=group with one button per option", () => {
    const { getByRole } = render(
      <SegmentedControl
        options={OPTIONS}
        value="parse"
        onChange={() => {}}
        ariaLabel="URL tool mode"
      />,
    );
    const group = getByRole("group", { name: "URL tool mode" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });

  it("marks only the active option aria-pressed=true", () => {
    const { getByRole } = render(
      <SegmentedControl
        options={OPTIONS}
        value="parse"
        onChange={() => {}}
        ariaLabel="URL tool mode"
      />,
    );
    expect(getByRole("button", { name: "Parse" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "Encode/Decode" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("calls onChange with the clicked option's value", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <SegmentedControl
        options={OPTIONS}
        value="parse"
        onChange={onChange}
        ariaLabel="URL tool mode"
      />,
    );
    fireEvent.click(getByRole("button", { name: "Encode/Decode" }));
    expect(onChange).toHaveBeenCalledWith("encode");
  });

  it("renders focusable type=button segments (WCAG-AA, D-03)", () => {
    const { getAllByRole } = render(
      <SegmentedControl
        options={OPTIONS}
        value="parse"
        onChange={() => {}}
        ariaLabel="URL tool mode"
      />,
    );
    for (const btn of getAllByRole("button")) {
      expect(btn.getAttribute("type")).toBe("button");
      expect(btn.className).toContain("focus-visible:ring-accent");
    }
  });
});
