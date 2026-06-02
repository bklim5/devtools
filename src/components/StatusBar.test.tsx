// @vitest-environment jsdom
// StatusBar (UX-03): the shared parse-state / byte-count / encoding / error / timing
// readout. Phase 7 adds an ADDITIVE, optional input->output byte delta (D-04/D-05):
// when a formatter passes `outputBytes`, the byte readout becomes `1,240 → 890 bytes`.
// Existing single-count callers (Base64/Hex/Bytes, Protobuf) must be byte-identical —
// `byteCount` stays REQUIRED in this phase (Phase 8 owns making it optional).
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
