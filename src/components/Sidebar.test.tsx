// @vitest-environment jsdom
// SHL-01 / SHL-04: the sidebar is a pure projection of ENABLED_TOOLS in compact
// density. One NavLink per enabled tool (icon + name), each linking to
// /tools/<id>, the active route's item carrying the active marker, and NO
// second keyboard system (D-03 — the ⌘K palette is the sole keyboard switch).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ENABLED_TOOLS } from "@/lib/tools/registry";

afterEach(cleanup);

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe("Sidebar (registry-driven, compact)", () => {
  it("renders exactly one nav link per ENABLED_TOOL", () => {
    const { getAllByRole } = renderAt("/");
    expect(getAllByRole("link")).toHaveLength(ENABLED_TOOLS.length);
  });

  it("renders each tool's name", () => {
    const { getByText } = renderAt("/");
    for (const tool of ENABLED_TOOLS) {
      expect(getByText(tool.name)).toBeDefined();
    }
  });

  it("points each link at /tools/<id>", () => {
    const { getAllByRole } = renderAt("/");
    const links = getAllByRole("link") as HTMLAnchorElement[];
    ENABLED_TOOLS.forEach((tool, i) => {
      // MemoryRouter resolves NavLink `to` into the href.
      expect(links[i].getAttribute("href")).toBe(`/tools/${tool.id}`);
    });
  });

  it("marks the active route's item with aria-current", () => {
    const active = ENABLED_TOOLS[1] ?? ENABLED_TOOLS[0];
    const { getAllByRole } = renderAt(`/tools/${active.id}`);
    const links = getAllByRole("link") as HTMLAnchorElement[];
    const current = links.filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute("href")).toBe(`/tools/${active.id}`);
  });

  it("renders an icon (svg) inside each item", () => {
    const { getAllByRole } = renderAt("/");
    const links = getAllByRole("link");
    for (const link of links) {
      expect(link.querySelector("svg")).not.toBeNull();
    }
  });

  it("holds no tool list of its own — names come straight from the registry", () => {
    const { getByText } = renderAt("/");
    // protobuf-decoder is the hero; it must be present purely via the registry.
    expect(getByText("Protobuf Decoder")).toBeDefined();
  });
});
