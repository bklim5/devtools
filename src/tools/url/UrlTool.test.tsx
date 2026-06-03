// @vitest-environment jsdom
// UrlTool (URL-01..05, D-01..D-15): one tool, two modes behind a top-level
// SegmentedControl mode switch (Parse default). Parse renders 8 labeled copyable
// readout rows + a decoded query key→value table; a relative URL shows ONE inline
// error (no rows/table). Encode/Decode shows live Encoded + Decoded outputs from a
// single input under a component|full scope toggle; a bad percent-sequence shows a
// per-output inline error while the other pane stays intact. All values render as
// escaped React text (never dangerouslySetInnerHTML). Copy writes through the
// platform clipboard seam (no @tauri-apps).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { noopWindow, noopNativeShortcut, noopUpdater, noopEvents } from "@/shell/testStore";
import UrlTool from "./UrlTool";

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

const ANCHOR =
  "https://user:pass@api.example.com:8080/v1/users?tag=a&tag=b&q=hello%20world&empty=#section";

function parseInput(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#url-parse-input");
  if (!el) throw new Error("parse input #url-parse-input not found");
  return el;
}

function encodeInput(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#url-encode-input");
  if (!el) throw new Error("encode input #url-encode-input not found");
  return el;
}

function switchToEncode(container: HTMLElement) {
  const btn = within(container).getByRole("button", { name: "Encode/Decode" });
  fireEvent.click(btn);
}

describe("UrlTool", () => {
  it("defaults to Parse mode with the parse input present", () => {
    const { container } = render(<UrlTool />);
    expect(parseInput(container)).toBeTruthy();
    // Mode switch exposes both options.
    expect(within(container).getByRole("button", { name: "Parse" })).toBeTruthy();
    expect(
      within(container).getByRole("button", { name: "Encode/Decode" }),
    ).toBeTruthy();
  });

  it("parses the anchor URL into 8 readout rows (host, port populated)", () => {
    const { container } = render(<UrlTool />);
    fireEvent.change(parseInput(container), { target: { value: ANCHOR } });

    const host = within(container).getByLabelText("Copy host");
    const row = host.closest("[data-readout-row]")!;
    expect(within(row as HTMLElement).getByText("api.example.com")).toBeTruthy();

    const port = within(container).getByLabelText("Copy port");
    const portRow = port.closest("[data-readout-row]")!;
    expect(within(portRow as HTMLElement).getByText("8080")).toBeTruthy();

    // All 8 component rows present (scheme/host/port/path/query/fragment/origin/username/password = 9 labels).
    for (const label of [
      "scheme",
      "host",
      "port",
      "path",
      "query",
      "fragment",
      "origin",
      "username",
      "password",
    ]) {
      expect(within(container).getByLabelText(`Copy ${label}`)).toBeTruthy();
    }
  });

  it("renders a decoded query table: two tag rows, decoded q='hello world', empty as —", () => {
    const { container } = render(<UrlTool />);
    fireEvent.change(parseInput(container), { target: { value: ANCHOR } });

    // Decoded query value (q) shows "hello world" in its row — the table decodes
    // values (the raw "?…hello%20world…" remains only in the `query` readout row).
    const qCopy = within(container).getByLabelText("Copy query value q");
    const qRow = qCopy.closest("[data-query-row]")!;
    expect(within(qRow as HTMLElement).getByText("hello world")).toBeTruthy();
    expect((qRow as HTMLElement).textContent).not.toContain("hello%20world");

    // Four query rows: tag=a, tag=b, q=hello world, empty=(—).
    const valueCopies = container.querySelectorAll(
      "button[aria-label^='Copy query value']",
    );
    expect(valueCopies.length).toBe(4);
  });

  it("a relative URL '/foo?x=1' shows ONE inline error and NO readout rows", () => {
    const { container } = render(<UrlTool />);
    fireEvent.change(parseInput(container), { target: { value: "/foo?x=1" } });

    const alerts = container.querySelectorAll("[role='alert']");
    expect(alerts.length).toBe(1);
    // No readout copy buttons render in the error state.
    expect(
      container.querySelectorAll("button[aria-label^='Copy host']").length,
    ).toBe(0);
  });

  it("empty parse input is a neutral state (no alert)", () => {
    const { container } = render(<UrlTool />);
    expect(container.querySelectorAll("[role='alert']").length).toBe(0);
  });

  it("copies a readout value through the platform clipboard seam", () => {
    const { container } = render(<UrlTool />);
    fireEvent.change(parseInput(container), { target: { value: ANCHOR } });
    fireEvent.click(within(container).getByLabelText("Copy host"));
    expect(writeText).toHaveBeenCalledWith("api.example.com");
  });

  it("encode/decode shows both directions live under the component scope", () => {
    const { container } = render(<UrlTool />);
    switchToEncode(container);
    fireEvent.change(encodeInput(container), { target: { value: "a b/c" } });

    const encoded = container.querySelector("#url-encoded-output")!;
    const decoded = container.querySelector("#url-decoded-output")!;
    // component scope escapes the slash.
    expect(encoded.textContent).toContain("%2F");
    // decode of plain text is a no-op echo.
    expect(decoded.textContent).toContain("a b/c");
  });

  it("the component|full scope toggle changes the encoding (slash kept in full)", () => {
    const { container } = render(<UrlTool />);
    switchToEncode(container);
    fireEvent.change(encodeInput(container), { target: { value: "a b/c" } });
    const encodedComponent = container.querySelector("#url-encoded-output")!.textContent;
    expect(encodedComponent).toContain("%2F");

    fireEvent.click(within(container).getByRole("button", { name: "full" }));
    const encodedFull = container.querySelector("#url-encoded-output")!.textContent;
    // full (encodeURI) keeps the slash intact.
    expect(encodedFull).toContain("/");
    expect(encodedFull).not.toContain("%2F");
  });

  it("a bad percent-sequence '%zz' errors the Decoded pane only; Encoded intact", () => {
    const { container } = render(<UrlTool />);
    switchToEncode(container);
    fireEvent.change(encodeInput(container), { target: { value: "%zz" } });

    const decoded = container.querySelector("#url-decoded-output")!;
    expect(decoded.querySelector("[role='alert']")).toBeTruthy();
    // Encoded pane stays intact (encodeURIComponent of "%zz" → "%25zz").
    const encoded = container.querySelector("#url-encoded-output")!;
    expect(encoded.querySelector("[role='alert']")).toBeNull();
    expect(encoded.textContent).toContain("%25zz");
  });
});
