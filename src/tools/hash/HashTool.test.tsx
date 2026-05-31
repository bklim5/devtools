// @vitest-environment jsdom
// HashTool (HASH-01, UX-01..05, D-11/D-12/D-13/D-14): paste text/hex/base64 (via an input-
// encoding toggle, single internal Uint8Array) → MD5 + SHA-1/256/384/512 digests all shown
// at once, stacked (UX-01 — no compute button). MD5 is sync; SHA are async (use waitFor).
// Empty is neutral; a bad encoding is a field-scoped error (aria-invalid + text-bad, never
// opacity-only), no crash, no stale digests. A casing toggle (D-13) flips hex to uppercase.
// Each digest row exposes a VISIBLE focusable copy <button> (UX-02). crypto.subtle is present
// in the Node test env (Node 22). Clipboard goes through the platform seam ONLY.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { noopWindow, noopNativeShortcut } from "@/shell/testStore";
import HashTool from "./HashTool";

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
  writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
  const p: Platform = {
    clipboard: { writeText, readText: async () => "" },
    store: createStoreStub(),
    window: noopWindow,
    nativeShortcut: noopNativeShortcut,
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
  it("typing 'abc' (UTF-8) renders the MD5 digest and (async) the SHA-256 digest", async () => {
    const { container } = render(<HashTool />);
    fireEvent.change(inputFor(container), { target: { value: "abc" } });
    // MD5 is sync.
    expect(rowText(container, "MD5")).toBe(MD5_ABC);
    // SHA rows resolve asynchronously.
    await waitFor(() => {
      expect(rowText(container, "SHA-256")).toMatch(new RegExp(`^${SHA256_ABC_PREFIX}`));
    });
  });

  it("hex '616263' yields the SAME digests as text 'abc' (single Uint8Array path)", async () => {
    const { container } = render(<HashTool />);
    // Switch the input encoding to hex.
    const hexBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "hex",
    )!;
    fireEvent.click(hexBtn);
    fireEvent.change(inputFor(container), { target: { value: "616263" } });
    expect(rowText(container, "MD5")).toBe(MD5_ABC);
    await waitFor(() => {
      expect(rowText(container, "SHA-256")).toMatch(new RegExp(`^${SHA256_ABC_PREFIX}`));
    });
  });

  it("the input-encoding toggle exposes UTF-8 / hex / base64 with aria-pressed", () => {
    const { container } = render(<HashTool />);
    const labels = ["UTF-8", "hex", "base64"];
    for (const label of labels) {
      const btn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === label,
      )!;
      expect(btn).toBeTruthy();
      expect(btn.getAttribute("aria-pressed")).not.toBeNull();
    }
  });

  it("invalid input for the chosen encoding shows a field-scoped error, no stale digests", () => {
    const { container } = render(<HashTool />);
    const hexBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "hex",
    )!;
    fireEvent.click(hexBtn);
    // Odd-length hex is invalid.
    fireEvent.change(inputFor(container), { target: { value: "abc" } });
    const field = inputFor(container);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const err = container.querySelector("#hash-input-error")!;
    expect(err).toBeTruthy();
    expect(err.className).toContain("text-bad");
    expect(container.querySelector("footer[role='status']")!.textContent).toContain(
      "Error",
    );
    // No digest rows render in the error state.
    expect(container.querySelector("[data-algo='MD5']")).toBeNull();
  });

  it("empty input → status 'empty', no digests, no error", () => {
    const { container } = render(<HashTool />);
    expect(container.querySelector("footer[role='status']")!.textContent).toContain(
      "Empty",
    );
    expect(container.querySelector("[data-algo='MD5']")).toBeNull();
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
