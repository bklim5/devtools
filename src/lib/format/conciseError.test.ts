// conciseError: the shared error-trimming helper both the HTML and JS/TS formatter
// tools use to strip Prettier's explanatory boilerplate + spec URL + trailing
// "(line:col)" locus from an engine error, while passing esbuild-style errors
// through unchanged (aside from a trailing paren-locus). Behavior must stay
// byte-identical to the inline version the HTML tool formerly carried.
import { describe, expect, it } from "vitest";
import { conciseError } from "./conciseError";

describe("conciseError", () => {
  it("strips a Prettier 'It may happen…' boilerplate clause to the essential head", () => {
    const msg =
      'Unexpected closing tag "div". It may happen when the tag has already been closed by another tag. For more info see https://example.com/x';
    expect(conciseError(msg)).toBe('Unexpected closing tag "div"');
  });

  it("strips a 'For more info see …' clause (no 'It may happen') to the head", () => {
    const msg =
      "Something went wrong parsing this. For more info see https://prettier.io/docs";
    expect(conciseError(msg)).toBe("Something went wrong parsing this");
  });

  it("strips the 'For more information see …' spelling variant too", () => {
    const msg =
      "Bad token here. For more information see https://prettier.io/docs";
    expect(conciseError(msg)).toBe("Bad token here");
  });

  it("removes a trailing '(1:14)' locus", () => {
    expect(conciseError("Unexpected token (1:14)")).toBe("Unexpected token");
  });

  it("removes both boilerplate AND a trailing locus, then trims", () => {
    const msg =
      "Unexpected token. It may happen when the tag is unclosed (12:3)";
    // The boilerplate split fires first (leaving "Unexpected token"); the split
    // already removed the trailing locus segment, so the head trims clean.
    expect(conciseError(msg)).toBe("Unexpected token");
  });

  it("leaves an esbuild-style message (no boilerplate) unchanged aside from a paren-locus", () => {
    expect(conciseError("Expected \";\" but found \"}\" (3:5)")).toBe(
      'Expected ";" but found "}"',
    );
  });

  it("passes a boilerplate-free, locus-free message through unchanged (aside from trim)", () => {
    expect(conciseError("  Transform failed with 1 error  ")).toBe(
      "Transform failed with 1 error",
    );
  });

  it("cuts the typescript parser's multi-line code frame to the head, stripping the re-exposed trailing locus", () => {
    // Prettier 3.8.3 `typescript` parser shape for `const a = )` — head line
    // carries a `(1:11)` locus, then an ASCII code frame on following lines.
    const msg = "Expression expected. (1:11)\n> 1 | const a = )\n    |           ^";
    expect(conciseError(msg)).toBe("Expression expected.");
  });

  it("cuts the babel parser's multi-line code frame (blank-line-separated frame) to the head", () => {
    // Prettier 3.8.3 `babel` parser shape — head line, a blank line, then the frame.
    const msg =
      "Unexpected token (1:11)\n\n> 1 | const a = )\n    |           ^";
    expect(conciseError(msg)).toBe("Unexpected token");
  });
});
