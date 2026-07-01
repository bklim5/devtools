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

  it("keeps the byte count in a non-shrinking cluster while the error truncates (no overlap regression)", () => {
    // A long error must not squeeze the short left cluster until the byte count
    // wraps to a second line and overflows the fixed-height footer. Structural
    // guard: the left cluster is `shrink-0` (won't compress) and the error span
    // truncates within the flexible right cluster.
    render(<StatusBar parseState="error" byteCount={10} error={longError} />);
    const byteEl = screen.getByLabelText("byte count");
    const errEl = screen.getByLabelText(longError);
    // Byte count lives in the shrink-0 left cluster (its parent never compresses).
    expect(byteEl.parentElement?.className).toContain("shrink-0");
    // The error is the element that yields space + clips.
    expect(errEl.className).toContain("truncate");
    // Its cluster absorbs the shrink (min-w-0 + flex-1), so truncate has a bound.
    expect(errEl.parentElement?.className).toContain("min-w-0");
    expect(errEl.parentElement?.className).toContain("flex-1");
  });
});

// Phase 32 (D-07/D-01): the single footer is the one error surface — upgraded to an
// assertive role=alert live region on error (was always role=status), and gains a
// calm "Formatting…" pending hint for the async formatter tools.
describe("StatusBar live region + pending hint", () => {
  it("uses role=alert / aria-live=assertive when parseState is error (D-07)", () => {
    const { container } = render(
      <StatusBar parseState="error" byteCount={10} error="3:5 unexpected token" />,
    );
    const footer = container.querySelector("footer")!;
    expect(footer.getAttribute("role")).toBe("alert");
    expect(footer.getAttribute("aria-live")).toBe("assertive");
    // line:col is still surfaced on the error span.
    expect(screen.getByLabelText("3:5 unexpected token").textContent).toContain("3:5");
  });

  it("uses role=status / aria-live=polite when ok", () => {
    const { container } = render(<StatusBar parseState="ok" byteCount={12} />);
    const footer = container.querySelector("footer")!;
    expect(footer.getAttribute("role")).toBe("status");
    expect(footer.getAttribute("aria-live")).toBe("polite");
  });

  it("uses role=status when empty", () => {
    const { container } = render(<StatusBar parseState="empty" />);
    expect(container.querySelector("footer")!.getAttribute("role")).toBe("status");
  });

  it("renders a subtle 'Formatting…' hint when pending and not in error (D-01)", () => {
    render(<StatusBar parseState="ok" byteCount={12} pending />);
    expect(screen.getByLabelText("formatting").textContent).toContain("Formatting");
  });

  it("hides the 'Formatting…' hint in an error state even when pending", () => {
    render(<StatusBar parseState="error" error="boom" pending />);
    expect(screen.queryByLabelText("formatting")).toBeNull();
  });

  it("renders no 'Formatting…' hint by default (synchronous tools omit pending)", () => {
    render(<StatusBar parseState="ok" byteCount={12} />);
    expect(screen.queryByLabelText("formatting")).toBeNull();
  });
});
