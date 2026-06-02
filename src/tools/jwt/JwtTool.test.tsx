// @vitest-environment jsdom
// JwtTool (JWT-01, UX-01..05, D-09/D-10): paste a token → header + payload (pretty JSON)
// + raw signature + alg render instantly (no decode button, UX-01); empty is neutral;
// a malformed token is a field-scoped explicit error (aria-invalid + text-bad, never
// opacity-only, UX-04), no crash (T-04-07). Standard claims (exp/iat/nbf) are humanized
// and an EXPIRED / NOT-YET-VALID token is visibly flagged (D-10, advisory). Each output
// block exposes a VISIBLE focusable copy <button> (UX-02). Clipboard goes through the
// platform seam ONLY (no @tauri-apps). Fixtures are built with the same bytes.ts
// base64url primitive the impl consumes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { bytesToBase64, utf8ToBytes } from "@/lib/bytes";
import {
  resetPlatformForTest,
  setPlatformForTest,
  type Platform,
} from "@/lib/platform";
import { createStoreStub } from "@/lib/platform/stub";
import { noopWindow, noopNativeShortcut, noopUpdater, noopEvents } from "@/shell/testStore";
import JwtTool from "./JwtTool";

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

function seg(s: string): string {
  return bytesToBase64(utf8ToBytes(s), "base64url");
}

function makeToken(header: object, payload: object, signature = "sig"): string {
  return `${seg(JSON.stringify(header))}.${seg(JSON.stringify(payload))}.${signature}`;
}

const NOW_S = Math.floor(Date.now() / 1000);

function inputFor(container: HTMLElement): HTMLTextAreaElement {
  const el = container.querySelector<HTMLTextAreaElement>("#jwt-input");
  if (!el) throw new Error("jwt-input not found");
  return el;
}

describe("JwtTool", () => {
  it("pasting a valid token renders header + payload JSON, raw signature, and alg", () => {
    const { container } = render(<JwtTool />);
    fireEvent.change(inputFor(container), {
      target: {
        value: makeToken(
          { alg: "HS256", typ: "JWT" },
          { sub: "1234567890", name: "John Doe", iat: 1516239022 },
          "rawSigSegment",
        ),
      },
    });
    expect(container.querySelector("#jwt-header")!.textContent).toContain('"HS256"');
    const payload = container.querySelector("#jwt-payload")!.textContent!;
    expect(payload).toContain('"John Doe"');
    expect(payload).toContain('"1234567890"');
    // Signature shown RAW (D-07).
    expect(container.querySelector("#jwt-signature")!.textContent).toBe("rawSigSegment");
    expect(container.querySelector("#jwt-alg")!.textContent).toBe("HS256");
  });

  it("empty input → status parseState 'empty' and NO error node", () => {
    const { container } = render(<JwtTool />);
    const status = container.querySelector("footer[role='status']")!;
    expect(status.textContent).toContain("Empty");
    expect(container.querySelector("#jwt-input-error")).toBeNull();
    expect(inputFor(container).getAttribute("aria-invalid")).not.toBe("true");
  });

  it("a 2-segment token → a visible token-level error (text-bad), status 'error', no crash", () => {
    const { container } = render(<JwtTool />);
    fireEvent.change(inputFor(container), { target: { value: "a.b" } });
    const field = inputFor(container);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const err = container.querySelector("#jwt-input-error")!;
    expect(err).toBeTruthy();
    expect(err.className).toContain("text-bad");
    expect(err.textContent!.toLowerCase()).toContain("token");
    expect(container.querySelector("footer[role='status']")!.textContent).toContain(
      "Error",
    );
  });

  it("a token with exp in the PAST renders a visible 'expired' flag (text-bad)", () => {
    const { container } = render(<JwtTool />);
    fireEvent.change(inputFor(container), {
      target: {
        value: makeToken({ alg: "HS256" }, { exp: NOW_S - 3600 }),
      },
    });
    const claim = container.querySelector("#jwt-claim-exp")!;
    expect(claim.textContent!.toLowerCase()).toContain("expired");
    const flag = Array.from(claim.querySelectorAll("span")).find((s) =>
      /expired/i.test(s.textContent ?? ""),
    )!;
    expect(flag.className).toContain("text-bad");
  });

  it("a token with nbf in the FUTURE renders a visible 'not yet valid' flag", () => {
    const { container } = render(<JwtTool />);
    fireEvent.change(inputFor(container), {
      target: {
        value: makeToken({ alg: "HS256" }, { nbf: NOW_S + 3600 }),
      },
    });
    const claim = container.querySelector("#jwt-claim-nbf")!;
    expect(claim.textContent!.toLowerCase()).toContain("not yet valid");
  });

  it("iat/exp/nbf show humanized absolute datetimes (ISO appears)", () => {
    const { container } = render(<JwtTool />);
    fireEvent.change(inputFor(container), {
      target: {
        value: makeToken({ alg: "HS256" }, { iat: 1516239022 }),
      },
    });
    // 1516239022 s = 2018-01-18T01:30:22.000Z
    expect(container.querySelector("#jwt-claim-iat")!.textContent).toContain(
      "2018-01-18T01:30:22.000Z",
    );
  });

  it("header/payload/signature each expose a focusable Copy button (no hover-only copy)", () => {
    const { container } = render(<JwtTool />);
    fireEvent.change(inputFor(container), {
      target: { value: makeToken({ alg: "HS256" }, { sub: "x" }) },
    });
    const labels = ["Copy Header", "Copy Payload", "Copy Signature"];
    for (const label of labels) {
      const btn = container.querySelector(`button[aria-label='${label}']`)!;
      expect(btn).toBeTruthy();
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.getAttribute("tabindex")).not.toBe("-1");
      const hiddenClass = ["opacity", "0"].join("-");
      expect(btn.className).not.toContain(hiddenClass);
    }
  });

  it("does not render the StatusBar size readout (UIX-01) even with a decoded token", () => {
    const { container } = render(<JwtTool />);
    fireEvent.change(inputFor(container), {
      target: { value: makeToken({ alg: "HS256" }, { sub: "x" }) },
    });
    const status = container.querySelector("footer[role='status']")! as HTMLElement;
    expect(within(status).queryByLabelText("byte count")).toBeNull();
    expect(within(status).getByLabelText("parse state")).toBeTruthy();
  });

  it("the Header copy writes the pretty-printed JSON through the platform seam", () => {
    const { container } = render(<JwtTool />);
    fireEvent.change(inputFor(container), {
      target: { value: makeToken({ alg: "HS256", typ: "JWT" }, { sub: "x" }) },
    });
    fireEvent.click(
      container.querySelector("button[aria-label='Copy Header']") as HTMLButtonElement,
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('"alg": "HS256"');
  });
});
