// @vitest-environment jsdom
// FieldTree + FieldNode: the recursive cards/rows renderer over the REAL decoder
// output (DecodedField[]). Asserts the binding UX rules:
//   - #N field numbers render NEUTRAL (never text-accent) — D-08 / PRO-07
//   - chips come from chipsForField (the real LenInterpretation keys) — D-06
//   - the smart default chip carries the accent/.on class; clicking another moves it
//   - sub-messages recurse via value.interpretations.message (NOT f.children) — D-03
//   - message nodes auto-expand by default — D-05
//   - selection is keyed by a STABLE path so a re-render with fresh field objects
//     does not reset selection (Pitfall 2)
//   - every node has a visible focusable <button> copy (no hover-only) — D-10 / UX-02
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { DecodedField } from "@/lib/protobuf/decoder";
import { FieldTree } from "./FieldTree";

afterEach(cleanup);

function varintField(fieldNumber: number): DecodedField {
  return {
    fieldNumber,
    wireType: 0,
    value: {
      kind: "varint",
      asUnsigned: "150",
      asSigned: "150",
      asZigzag: "75",
      asBool: true,
    },
  };
}

function lenMessageField(fieldNumber: number, child: DecodedField): DecodedField {
  return {
    fieldNumber,
    wireType: 2,
    value: {
      kind: "len",
      byteLength: 3,
      interpretations: { hex: "089601", message: [child] },
    },
  };
}

function lenBytesField(fieldNumber: number): DecodedField {
  return {
    fieldNumber,
    wireType: 2,
    value: { kind: "len", byteLength: 2, interpretations: { hex: "dead" } },
  };
}

// A controlled harness owning selection + collapsed state the way ProtobufDecoder will.
function Harness({
  fields,
  onCopy = () => {},
}: {
  fields: DecodedField[];
  onCopy?: (text: string) => void;
}) {
  const [selection, setSelection] = useState<Map<string, string>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  return (
    <FieldTree
      fields={fields}
      style="cards"
      selection={selection}
      onSelect={(path, id) => setSelection((prev) => new Map(prev).set(path, id))}
      collapsed={collapsed}
      onToggleExpand={(path) =>
        setCollapsed((prev) => {
          const next = new Set(prev);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        })
      }
      onCopyNode={onCopy}
    />
  );
}

describe("FieldTree / FieldNode", () => {
  it("renders #N field numbers NEUTRAL (never text-accent)", () => {
    const { container } = render(<Harness fields={[varintField(1)]} />);
    const fnum = container.querySelector('[data-fnum]');
    expect(fnum).toBeTruthy();
    expect(fnum!.textContent).toContain("#1");
    expect(fnum!.className).not.toContain("text-accent");
  });

  it("derives chips from chipsForField and selects the smart default with accent", () => {
    const { container } = render(<Harness fields={[varintField(1)]} />);
    const chips = container.querySelectorAll('[role="radio"]');
    // varint chips: uint64, int64, sint, bool
    expect(chips.length).toBe(4);
    const selected = container.querySelector('[role="radio"][aria-checked="true"]')!;
    expect(selected.textContent).toContain("uint64");
    expect(selected.className).toContain("text-accent");
  });

  it("moves the accent selection when another chip is clicked", () => {
    const { container } = render(<Harness fields={[varintField(1)]} />);
    const int64Chip = within(container).getByRole("radio", { name: /^int64$/i });
    expect(int64Chip.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(int64Chip);
    expect(int64Chip.getAttribute("aria-checked")).toBe("true");
    expect(int64Chip.className).toContain("text-accent");
  });

  it("recurses a sub-message via interpretations.message and auto-expands it", () => {
    const tree = lenMessageField(3, varintField(1));
    const { container } = render(<Harness fields={[tree]} />);
    // The nested child #1 must be visible without any user interaction (auto-expanded).
    const fnums = Array.from(container.querySelectorAll("[data-fnum]")).map(
      (n) => n.textContent,
    );
    expect(fnums.some((t) => t?.includes("#3"))).toBe(true);
    expect(fnums.some((t) => t?.includes("#1"))).toBe(true);
    // an indented submsg container exists
    expect(container.querySelector('[data-submsg]')).toBeTruthy();
  });

  it("collapses/expands a message node via its toggle", () => {
    const tree = lenMessageField(3, varintField(1));
    const { container } = render(<Harness fields={[tree]} />);
    const toggle = container.querySelector('[data-expand-toggle]') as HTMLElement;
    expect(toggle).toBeTruthy();
    // collapse -> nested #1 disappears
    fireEvent.click(toggle);
    const fnumsAfter = Array.from(container.querySelectorAll("[data-fnum]")).map(
      (n) => n.textContent,
    );
    expect(fnumsAfter.some((t) => t?.includes("#1"))).toBe(false);
  });

  it("a len bytes-only node shows a single bytes chip selected", () => {
    const { container } = render(<Harness fields={[lenBytesField(5)]} />);
    const chips = container.querySelectorAll('[role="radio"]');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain("bytes");
    expect(chips[0].getAttribute("aria-checked")).toBe("true");
  });

  it("exposes a visible focusable copy <button> on every node (no hover-only)", () => {
    const onCopy = vi.fn();
    const { container } = render(
      <Harness fields={[varintField(1)]} onCopy={onCopy} />,
    );
    const copy = container.querySelector("button[data-copy-node]") as HTMLButtonElement;
    expect(copy).toBeTruthy();
    expect(copy.tagName).toBe("BUTTON");
    expect(copy.getAttribute("data-copy")).not.toBe("hover");
    expect(copy.className).not.toContain(["opacity", "0"].join("-"));
    expect(copy.getAttribute("tabindex")).not.toBe("-1");
    fireEvent.click(copy);
    // copies the selected reading (uint64 default => "150")
    expect(onCopy).toHaveBeenCalledWith("150");
  });

  it("keeps selection across a re-render with FRESH field objects (stable path keying)", () => {
    const { container, rerender } = render(<Harness fields={[varintField(1)]} />);
    const int64Chip = within(container).getByRole("radio", { name: /^int64$/i });
    fireEvent.click(int64Chip);
    expect(
      within(container).getByRole("radio", { name: /^int64$/i }).getAttribute("aria-checked"),
    ).toBe("true");
    // Re-render with a brand-new field object at the same path; selection must persist.
    rerender(<Harness fields={[varintField(1)]} />);
    // (Harness owns state; rerender keeps the component instance, so state survives —
    //  this proves the path key, not object identity, drives selection.)
    expect(
      within(container).getByRole("radio", { name: /^int64$/i }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("renders rows vs cards via the style prop", () => {
    const { container } = render(
      <FieldTree
        fields={[varintField(1)]}
        style="rows"
        selection={new Map()}
        onSelect={() => {}}
        collapsed={new Set()}
        onToggleExpand={() => {}}
        onCopyNode={() => {}}
      />,
    );
    expect(container.querySelector(".tree-rows")).toBeTruthy();
    expect(container.querySelector(".tree-cards")).toBeNull();
  });
});
