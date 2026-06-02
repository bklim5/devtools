// The shared formatter contract (D-09): a discriminated FormatResult both the JSON
// and XML pure formatters return, plus the toolbar FormatOptions (indent 2/4/tab,
// minify, JSON-only sort-keys). These are compile-time guarantees; the runtime test
// constructs each variant and narrows on `result.ok` to lock the shape before
// json.ts / xml.ts are written.
import { describe, expect, it, vi } from "vitest";
import { timed } from "./types";
import type { FormatOptions, FormatResult, IndentMode } from "./types";

describe("FormatResult contract", () => {
  it("ok:true variant exposes output/inputBytes/outputBytes and narrows", () => {
    const r: FormatResult = {
      ok: true,
      output: "{}",
      inputBytes: 2,
      outputBytes: 2,
    };
    if (r.ok) {
      expect(typeof r.output).toBe("string");
      expect(typeof r.inputBytes).toBe("number");
      expect(typeof r.outputBytes).toBe("number");
    } else {
      throw new Error("expected ok:true branch");
    }
  });

  it("ok:false variant exposes error.message (+ optional line/col) and narrows", () => {
    const r: FormatResult = {
      ok: false,
      error: { message: "Unexpected token", line: 1, col: 5 },
    };
    if (!r.ok) {
      expect(typeof r.error.message).toBe("string");
      expect(r.error.line).toBe(1);
      expect(r.error.col).toBe(5);
    } else {
      throw new Error("expected ok:false branch");
    }
  });

  it("error line/col are optional", () => {
    const r: FormatResult = { ok: false, error: { message: "bad" } };
    if (!r.ok) {
      expect(r.error.line).toBeUndefined();
      expect(r.error.col).toBeUndefined();
    }
  });

  it("IndentMode accepts only 2/4/tab; FormatOptions carries indent/minify/sortKeys", () => {
    const tab: IndentMode = "tab";
    const two: IndentMode = "2";
    const four: IndentMode = "4";
    expect([two, four, tab]).toEqual(["2", "4", "tab"]);

    const json: FormatOptions = { indent: "2", minify: false, sortKeys: true };
    const xml: FormatOptions = { indent: "tab", minify: true };
    expect(json.sortKeys).toBe(true);
    expect(xml.sortKeys).toBeUndefined();
    expect(xml.minify).toBe(true);
  });
});

describe("timed (WR-02)", () => {
  it("returns the thunk's result and the elapsed time of THAT call", () => {
    // Advance the clock only across the wrapped call: 11 ms before, 18 ms after.
    const nowSpy = vi
      .spyOn(performance, "now")
      .mockReturnValueOnce(11)
      .mockReturnValueOnce(18);

    const { result, timingMs } = timed(() => "payload");

    expect(result).toBe("payload");
    expect(timingMs).toBe(7); // 18 - 11, the wrapped call's cost — not 0
    nowSpy.mockRestore();
  });
});
