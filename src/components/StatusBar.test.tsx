// @vitest-environment jsdom
// StatusBar (UX-03): the shared parse-state / byte-count / encoding / error / timing
// readout. Phase 7 added an ADDITIVE, optional input->output byte delta (D-04/D-05):
// when a formatter passes `outputBytes`, the byte readout becomes `1,240 → 890 bytes`.
// Existing single-count callers (Base64/Hex/Bytes, Protobuf) must be byte-identical.
// Phase 8 (UIX-01) makes `byteCount` OPTIONAL: the size span renders only when a
// caller passes a number; omitting it (with or without `outputBytes`) renders no
// size readout — tools where input/output size isn't meaningful (Hash/UUID/Unix
// Time/JWT) omit it. The optional-branch coverage lives in the dedicated describe below.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";

afterEach(cleanup);

describe("StatusBar byte readout", () => {
  it("renders a single byte count (with no outputBytes) unchanged", () => {
    render(<StatusBar parseState="ok" byteCount={1240} />);
    const bytes = screen.getByLabelText("byte count");
    expect(bytes.textContent).toBe("1240 bytes");
  });

  it("renders an input->output delta when outputBytes is provided", () => {
    render(<StatusBar parseState="ok" byteCount={1240} outputBytes={890} />);
    const bytes = screen.getByLabelText("byte count");
    expect(bytes.textContent).toContain("1,240");
    expect(bytes.textContent).toContain("890");
    expect(bytes.textContent).toContain("→");
    expect(bytes.textContent).toContain("bytes");
  });

  it("still renders both numbers when outputBytes === byteCount (no special-casing)", () => {
    render(<StatusBar parseState="ok" byteCount={500} outputBytes={500} />);
    const bytes = screen.getByLabelText("byte count");
    // Both sides of the delta present (e.g. "500 → 500 bytes").
    expect(bytes.textContent?.match(/500/g)?.length).toBe(2);
    expect(bytes.textContent).toContain("→");
  });

  it("renders the singular 'byte' for byteCount=1 with no outputBytes", () => {
    render(<StatusBar parseState="ok" byteCount={1} />);
    const bytes = screen.getByLabelText("byte count");
    expect(bytes.textContent).toBe("1 byte");
  });
});

describe("StatusBar optional byteCount", () => {
  it("renders no byte-count span when byteCount is omitted", () => {
    render(<StatusBar parseState="empty" />);
    expect(screen.queryByLabelText("byte count")).toBeNull();
    // The parse-state span still renders (only the size span is conditional).
    expect(screen.getByLabelText("parse state").textContent).toBe("Empty");
  });

  it("renders the single count when byteCount is provided", () => {
    render(<StatusBar parseState="ok" byteCount={5} />);
    expect(screen.getByLabelText("byte count").textContent).toBe("5 bytes");
  });

  it("renders the delta when both byteCount and outputBytes are provided", () => {
    render(<StatusBar parseState="ok" byteCount={1240} outputBytes={890} />);
    const bytes = screen.getByLabelText("byte count");
    expect(bytes.textContent).toContain("1,240");
    expect(bytes.textContent).toContain("890");
    expect(bytes.textContent).toContain("→");
    expect(bytes.textContent).toContain("bytes");
  });

  it("renders no byte-count span when outputBytes is passed without byteCount", () => {
    render(<StatusBar parseState="ok" outputBytes={890} />);
    expect(screen.queryByLabelText("byte count")).toBeNull();
  });
});

describe("StatusBar error full-text affordance (Fix-2)", () => {
  const longError =
    "line 1: Opening and ending tag mismatch: someVeryLongTagNameThatWillBeClippedByTruncate and anotherLongOne";

  it("exposes the full error message as the accessible name (not the word 'error')", () => {
    render(<StatusBar parseState="error" byteCount={10} error={longError} />);
    // The full message is reachable by its accessible name, even when clipped.
    const errEl = screen.getByLabelText(longError);
    expect(errEl.textContent).toBe(longError);
    // There is no control whose accessible name is the literal word "error".
    expect(screen.queryByLabelText("error")).toBeNull();
  });

  it("sets a native title tooltip carrying the full message", () => {
    render(<StatusBar parseState="error" byteCount={10} error={longError} />);
    const errEl = screen.getByLabelText(longError);
    expect(errEl.getAttribute("title")).toBe(longError);
  });
});
