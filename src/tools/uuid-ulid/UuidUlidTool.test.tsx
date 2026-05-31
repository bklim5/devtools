// @vitest-environment jsdom
// UuidUlidTool (UID-01, UX-01..05, D-15/D-16/D-17): generate UUID v4 / v7 / ULID (one
// on open, a single keystroke regenerates), an optional batch count → N copyable entries
// + copy-all, and a decode field that auto-detects a pasted UUID/ULID and shows a full
// breakdown (malformed → an explicit field-scoped error, never a crash). Generation uses
// crypto (randomUUID / the Plan-01 CSPRNG libs), never Math.random. Clipboard goes through
// the platform seam ONLY. crypto.randomUUID/getRandomValues exist in the Node test env.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import UuidUlidTool from "./UuidUlidTool";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    clipboard: { writeText, readText: async () => "" },
    store: createStoreStub(),
  };
  setPlatformForTest(p);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

const UUID_V7 = "017f22e2-79b0-7cc3-98c4-dc0c0c180cc3";
const ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

function genValues(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-generated-id]"),
  ).map((el) => el.getAttribute("data-generated-id") ?? "");
}

function clickByText(container: HTMLElement, text: string) {
  const btn = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  if (!btn) throw new Error(`button "${text}" not found`);
  fireEvent.click(btn);
}

function decodeField(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#uuid-ulid-decode");
  if (!el) throw new Error("decode field not found");
  return el;
}

describe("UuidUlidTool", () => {
  it("generates one id on open with a focusable Copy button (D-16)", () => {
    const { container } = render(<UuidUlidTool />);
    const ids = genValues(container);
    expect(ids.length).toBeGreaterThanOrEqual(1);
    expect(ids[0]).toBeTruthy();
    const copy = container.querySelector("button[aria-label^='Copy']");
    expect(copy).toBeTruthy();
    expect(copy!.tagName).toBe("BUTTON");
  });

  it("regenerates a DIFFERENT id when Generate is clicked", () => {
    const { container } = render(<UuidUlidTool />);
    const before = genValues(container)[0];
    clickByText(container, "Generate");
    const after = genValues(container)[0];
    expect(after).not.toBe(before);
    expect(after).toBeTruthy();
  });

  it("the kind toggle (UUID v4 / UUID v7 / ULID) exposes aria-pressed", () => {
    const { container } = render(<UuidUlidTool />);
    for (const label of ["UUID v4", "UUID v7", "ULID"]) {
      const btn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === label,
      );
      expect(btn, `kind button ${label}`).toBeTruthy();
      expect(btn!.getAttribute("aria-pressed")).not.toBeNull();
    }
  });

  it("selecting ULID generates a 26-char Crockford string", () => {
    const { container } = render(<UuidUlidTool />);
    clickByText(container, "ULID");
    const id = genValues(container)[0];
    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("selecting UUID v7 generates a dashed v7 (version nibble 7)", () => {
    const { container } = render(<UuidUlidTool />);
    clickByText(container, "UUID v7");
    const id = genValues(container)[0];
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("a batch count of 3 renders 3 entries each with its own copy + a copy-all", () => {
    const { container } = render(<UuidUlidTool />);
    const count = container.querySelector<HTMLInputElement>("#uuid-ulid-count")!;
    fireEvent.change(count, { target: { value: "3" } });
    expect(genValues(container)).toHaveLength(3);
    const perRowCopies = container.querySelectorAll(
      "[data-generated-id] button[aria-label^='Copy']",
    );
    expect(perRowCopies.length).toBe(3);
    const copyAll = Array.from(container.querySelectorAll("button")).find((b) =>
      /copy all/i.test(b.textContent ?? ""),
    );
    expect(copyAll).toBeTruthy();
  });

  it("copy-all writes every generated id newline-joined", () => {
    const { container } = render(<UuidUlidTool />);
    const count = container.querySelector<HTMLInputElement>("#uuid-ulid-count")!;
    fireEvent.change(count, { target: { value: "3" } });
    const ids = genValues(container);
    const copyAll = Array.from(container.querySelectorAll("button")).find((b) =>
      /copy all/i.test(b.textContent ?? ""),
    )!;
    fireEvent.click(copyAll);
    expect(writeText).toHaveBeenCalledWith(ids.join("\n"));
  });

  it("decoding the v7 vector shows version 7 and a humanized timestamp", () => {
    const { container } = render(<UuidUlidTool />);
    fireEvent.change(decodeField(container), { target: { value: UUID_V7 } });
    const out = container.querySelector("#uuid-ulid-breakdown")!;
    expect(out.textContent).toContain("7");
    expect(out.textContent).toMatch(/2022/); // 2022-02-22 embedded ts
  });

  it("decoding the ULID vector shows the decoded timestamp", () => {
    const { container } = render(<UuidUlidTool />);
    fireEvent.change(decodeField(container), { target: { value: ULID } });
    const out = container.querySelector("#uuid-ulid-breakdown")!;
    expect(out.textContent).toMatch(/2016/); // 2016-07-30 decoded ts
  });

  it("decoding a malformed id shows an explicit field-scoped error (no crash)", () => {
    const { container } = render(<UuidUlidTool />);
    fireEvent.change(decodeField(container), { target: { value: "not-an-id" } });
    const field = decodeField(container);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const err = container.querySelector("#uuid-ulid-decode-error")!;
    expect(err).toBeTruthy();
    expect(err.className).toContain("text-bad");
    expect(container.querySelector("#uuid-ulid-breakdown")).toBeNull();
  });

  it("empty decode field is neutral (no error, no breakdown)", () => {
    const { container } = render(<UuidUlidTool />);
    expect(decodeField(container).getAttribute("aria-invalid")).not.toBe("true");
    expect(container.querySelector("#uuid-ulid-decode-error")).toBeNull();
    expect(container.querySelector("#uuid-ulid-breakdown")).toBeNull();
  });

  it("clicking a generated id's copy writes that id via the platform seam", () => {
    const { container } = render(<UuidUlidTool />);
    const id = genValues(container)[0];
    const row = container.querySelector("[data-generated-id]")!;
    const copy = within(row as HTMLElement).getByRole("button", {
      name: /^Copy/,
    });
    fireEvent.click(copy);
    expect(writeText).toHaveBeenCalledWith(id);
  });
});
