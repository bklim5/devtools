// @vitest-environment jsdom
// useBytesConvert: ONE internal Uint8Array is the source of truth; editing any of
// text/base64/hex re-derives the OTHER TWO from the new bytes (ENC-01/02). Invalid
// input flags ONLY that field and CLEARS the other two + bytes (user-directed refinement of D-13).
// The alphabet toggle re-derives ONLY the base64 string from current bytes (ENC-03,
// no round-trip re-parse). All byte work routes through src/lib/bytes.ts.
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBytesConvert } from "./useBytesConvert";

describe("useBytesConvert", () => {
  it("starts empty and neutral (no error)", () => {
    const { result } = renderHook(() => useBytesConvert());
    expect(result.current.text).toBe("");
    expect(result.current.base64).toBe("");
    expect(result.current.hex).toBe("");
    expect(result.current.byteCount).toBe(0);
    expect(result.current.errors).toEqual({});
    expect(result.current.alphabet).toBe("base64");
  });

  it("editText derives base64 + hex from the same bytes", () => {
    const { result } = renderHook(() => useBytesConvert());
    act(() => result.current.editText("hello"));
    expect(result.current.text).toBe("hello");
    expect(result.current.base64).toBe("aGVsbG8=");
    expect(result.current.hex).toBe("68656c6c6f");
    expect(result.current.byteCount).toBe(5);
    expect(result.current.errors).toEqual({});
  });

  it("editHex derives text + base64", () => {
    const { result } = renderHook(() => useBytesConvert());
    act(() => result.current.editHex("68656c6c6f"));
    expect(result.current.text).toBe("hello");
    expect(result.current.base64).toBe("aGVsbG8=");
    expect(result.current.hex).toBe("68656c6c6f");
    expect(result.current.errors.hex).toBeUndefined();
  });

  it("editBase64 derives text + hex", () => {
    const { result } = renderHook(() => useBytesConvert());
    act(() => result.current.editBase64("aGVsbG8="));
    expect(result.current.text).toBe("hello");
    expect(result.current.hex).toBe("68656c6c6f");
    expect(result.current.errors.base64).toBeUndefined();
  });

  it("editHex with an odd length flags ONLY the hex field and clears the others", () => {
    const { result } = renderHook(() => useBytesConvert());
    act(() => result.current.editText("hello")); // establish prior values
    act(() => result.current.editHex("6"));
    expect(result.current.errors.hex).toBe("Hex must have an even number of digits");
    // raw input is shown back to the user
    expect(result.current.hex).toBe("6");
    // text + base64 are CLEARED (no stale last-good); bytes reset to empty
    expect(result.current.text).toBe("");
    expect(result.current.base64).toBe("");
    expect(result.current.byteCount).toBe(0);
    expect(result.current.errors.text).toBeUndefined();
    expect(result.current.errors.base64).toBeUndefined();
  });

  it("editHex with invalid characters flags ONLY the hex field and clears the others", () => {
    const { result } = renderHook(() => useBytesConvert());
    act(() => result.current.editText("hi"));
    act(() => result.current.editHex("zz"));
    expect(result.current.errors.hex).toBe("Invalid hex characters");
    expect(result.current.text).toBe("");
    expect(result.current.base64).toBe("");
  });

  it("editBase64 with invalid input flags ONLY base64 and clears the others", () => {
    const { result } = renderHook(() => useBytesConvert());
    act(() => result.current.editText("hello")); // establish prior values
    act(() => result.current.editBase64("@@@@"));
    expect(result.current.errors.base64).toBeDefined();
    // raw input stays in the base64 field
    expect(result.current.base64).toBe("@@@@");
    expect(result.current.text).toBe("");
    expect(result.current.hex).toBe("");
    expect(result.current.byteCount).toBe(0);
  });

  it("editText never errors and re-derives even from earlier-errored state", () => {
    const { result } = renderHook(() => useBytesConvert());
    act(() => result.current.editHex("6")); // error on hex
    act(() => result.current.editText("hi"));
    expect(result.current.errors.hex).toBeUndefined();
    expect(result.current.text).toBe("hi");
    expect(result.current.hex).toBe("6869");
  });

  it("setAlphabet during a base64 error keeps the raw input (does not blank it)", () => {
    const { result } = renderHook(() => useBytesConvert());
    act(() => result.current.editBase64("@@@@")); // error: base64 holds raw "@@@@"
    expect(result.current.errors.base64).toBeDefined();
    act(() => result.current.setAlphabet("base64url"));
    expect(result.current.alphabet).toBe("base64url");
    expect(result.current.base64).toBe("@@@@"); // preserved, not re-derived to ""
  });

  it("setAlphabet(base64url) changes ONLY the base64 string; text + hex unchanged", () => {
    const { result } = renderHook(() => useBytesConvert());
    // 0xFF 0xFE → base64 has + or /; base64url uses - or _ and drops padding
    act(() => result.current.editHex("fbff"));
    const textBefore = result.current.text;
    const hexBefore = result.current.hex;
    const b64Before = result.current.base64;
    act(() => result.current.setAlphabet("base64url"));
    expect(result.current.alphabet).toBe("base64url");
    expect(result.current.base64).not.toBe(b64Before);
    expect(result.current.text).toBe(textBefore);
    expect(result.current.hex).toBe(hexBefore);
  });
});
