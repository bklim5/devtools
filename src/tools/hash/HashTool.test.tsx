// @vitest-environment jsdom
// HashTool (HASH-01, UX-01..05, D-12/D-13; G-04-1/G-04-2): paste TEXT (always UTF-8 — no
// input-encoding toggle, G-04-1) → MD5 + SHA-1/256/384/512 digests all shown at once,
// stacked (UX-01 — no compute button). MD5 is sync; SHA are async (use waitFor). Empty is
// neutral; UTF-8 never errors so there is no error path. The five digest rows ALWAYS render
// in fixed-height containers from mount so typing never reflows (G-04-2) — the empty test
// asserts on status/empty digest text, NOT on row absence. A casing toggle (D-13) flips hex
// to uppercase. Each digest row exposes a VISIBLE focusable copy <button> (UX-02).
// crypto.subtle is present in the Node test env (Node 22). Clipboard goes through the seam.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { noopWindow, noopNativeShortcut, noopUpdater, noopEvents } from "@/shell/testStore";
import HashTool from "./HashTool";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    clipboard: { writeText, readText: async () => "" },
    store: createStoreStub(),
    window: noopWindow,
    nativeShortcut: noopNativeShortcut,
    updater: noopUpdater,
    events: noopEvents,
  };
  setPlatformForTest(p);
});

afterEach(() => {
  cleanup();
  resetPlatformForTest();
});

function inputFor(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#hash-input");
  if (!el) throw new Error("hash-input not found");
  return el;
}

function rowText(container: HTMLElement, algo: string): string {
  const el = container.querySelector(`[data-algo='${algo}']`);
  if (!el) throw new Error(`${algo} row not found`);
  return el.querySelector("code")!.textContent ?? "";
}

const MD5_ABC = "900150983cd24fb0d6963f7d28e17f72";
const SHA256_ABC_PREFIX = "ba7816bf8f01cfea";

describe("HashTool", () => {
  it("typing 'abc' renders the MD5 digest and (async) the SHA-256 digest", async () => {
    const { container } = render(<HashTool />);
    fireEvent.change(inputFor(container), { target: { value: "abc" } });
    // MD5 is sync.
    expect(rowText(container, "MD5")).toBe(MD5_ABC);
    // SHA rows resolve asynchronously.
    await waitFor(() => {
      expect(rowText(container, "SHA-256")).toMatch(new RegExp(`^${SHA256_ABC_PREFIX}`));
    });
  });

  it("does not render the StatusBar size readout (UIX-01) even with content", () => {
    const { container } = render(<HashTool />);
    fireEvent.change(inputFor(container), { target: { value: "abc" } });
    const status = container.querySelector("footer[role='status']")! as HTMLElement;
    // Size readout is dropped for Hash; the parse-state label still renders.
    expect(within(status).queryByLabelText("byte count")).toBeNull();
    expect(within(status).getByLabelText("parse state")).toBeTruthy();
  });

  it("empty input → status 'empty', no digest values, no error (rows still present, G-04-2)", () => {
    const { container } = render(<HashTool />);
    expect(container.querySelector("footer[role='status']")!.textContent).toContain(
      "Empty",
    );
    // The five rows ALWAYS render (fixed-height, no reflow) — but carry no digest text.
    expect(rowText(container, "MD5")).toBe("");
    expect(rowText(container, "SHA-256")).toBe("");
    // UTF-8 never errors, so there is no field-scoped error element.
    expect(container.querySelector("#hash-input-error")).toBeNull();
  });

  it("the casing toggle flips hex output to uppercase and back", () => {
    const { container } = render(<HashTool />);
    fireEvent.change(inputFor(container), { target: { value: "abc" } });
    expect(rowText(container, "MD5")).toBe(MD5_ABC);
    const upperBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "UPPER",
    )!;
    fireEvent.click(upperBtn);
    expect(rowText(container, "MD5")).toBe(MD5_ABC.toUpperCase());
    const lowerBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "lower",
    )!;
    fireEvent.click(lowerBtn);
    expect(rowText(container, "MD5")).toBe(MD5_ABC);
  });

  it("each of the five digest rows has a focusable Copy button (no hover-only copy)", () => {
    const { container } = render(<HashTool />);
    fireEvent.change(inputFor(container), { target: { value: "abc" } });
    const algos = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];
    for (const algo of algos) {
      const btn = container.querySelector(`button[aria-label='Copy ${algo}']`)!;
      expect(btn).toBeTruthy();
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.getAttribute("tabindex")).not.toBe("-1");
      const hiddenClass = ["opacity", "0"].join("-");
      expect(btn.className).not.toContain(hiddenClass);
    }
  });

  it("the casing toggle also uppercases the COPIED value", () => {
    const { container } = render(<HashTool />);
    fireEvent.change(inputFor(container), { target: { value: "abc" } });
    fireEvent.click(
      Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === "UPPER",
      )!,
    );
    fireEvent.click(
      container.querySelector("button[aria-label='Copy MD5']") as HTMLButtonElement,
    );
    expect(writeText).toHaveBeenCalledWith(MD5_ABC.toUpperCase());
  });
});
