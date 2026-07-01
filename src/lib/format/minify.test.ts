// Unit spec for the offline minify wrappers (PRT-06). Runs in the default `node`
// environment — jsdom's `TextEncoder` returns a cross-realm Uint8Array that trips
// esbuild's own invariant check, and the HTML minifier is a pure string transform
// (no DOMParser), so node is both correct and sufficient.
//
// esbuild-wasm resolves to its NODE build under vitest (the `browser` field the app
// uses is only picked by Vite), and that build's `initialize()` runs the vendored
// service itself — it rejects the browser-only `wasmURL`/`wasmModule`/`worker`
// flags. So `beforeAll` injects an empty init-options provider: the SAME wrapper +
// real esbuild transform, only the engine-loading swapped off the Vite `?url`
// asset pipeline. `initCalls` proves the init is memoized (once).
import { beforeAll, describe, expect, it } from "vitest";
import { __setEsbuildInitForTest, minifyScript } from "./minify";

let initCalls = 0;

beforeAll(() => {
  __setEsbuildInitForTest(async () => {
    initCalls++;
    return {}; // node build self-loads the vendored service; no browser flags
  });
});

/** Parse-check: valid JS never throws when wrapped in a Function. */
function isValidJs(src: string): boolean {
  try {
    new Function(src);
    return true;
  } catch {
    return false;
  }
}

describe("minifyScript", () => {
  it("minifies JS with no ASI breakage (statements stay separated, valid)", async () => {
    const r = await minifyScript("let a = 1;\nlet b = 2;", "js");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.length).toBeGreaterThan(0);
      expect(r.output).not.toContain("\n\n");
      // no ASI hazard: the compact output is still valid JS with both bindings
      expect(isValidJs(r.output)).toBe(true);
      expect(r.output).toContain("a=1");
      expect(r.output).toContain("b=2");
    }
  });

  it("preserves a regex literal (not mis-lexed as division)", async () => {
    const r = await minifyScript("const re = /a\\/b/g;\nconst x = 1 / 2;", "js");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("/a\\/b/g");
      expect(isValidJs(r.output)).toBe(true);
    }
  });

  it("strips TypeScript types → compact valid JS (ts loader)", async () => {
    const r = await minifyScript("const x: number = 1;", "ts");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).not.toContain(": number");
      expect(r.output).toContain("x=1");
      expect(isValidJs(r.output)).toBe(true);
    }
  });

  it("accepts the jsx loader", async () => {
    const r = await minifyScript("const x = <div className='a' />;", "jsx");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.length).toBeGreaterThan(0);
  });

  it("accepts the tsx loader", async () => {
    const r = await minifyScript("const x: unknown = <div />;", "tsx");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.length).toBeGreaterThan(0);
  });

  it("minifies CSS (css loader)", async () => {
    const r = await minifyScript("a {  color : red ; }", "css");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain("a{color:red}");
  });

  it("empty/whitespace input short-circuits to ok WITHOUT initializing esbuild", async () => {
    const before = initCalls;
    for (const input of ["", "   ", "\n\t "]) {
      const r = await minifyScript(input, "js");
      expect(r).toEqual({ ok: true, output: "", inputBytes: 0, outputBytes: 0 });
    }
    // the short-circuit runs before ensureEsbuild → no new init fired
    expect(initCalls).toBe(before);
  });

  it("returns an error VALUE (never throws) on invalid input with a numeric line", async () => {
    const r = await minifyScript("const a = {", "js");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(typeof r.error.message).toBe("string");
      expect(r.error.message.length).toBeGreaterThan(0);
      expect(typeof r.error.line).toBe("number");
      expect(r.error.line).toBe(1);
      expect(typeof r.error.col).toBe("number");
      expect(r.error.col!).toBeGreaterThanOrEqual(1);
    }
  });

  it("initializes esbuild at most once across many calls (memoized)", async () => {
    await minifyScript("const p = 1;", "js");
    await minifyScript("const q = 2;", "js");
    expect(initCalls).toBe(1);
  });
});
