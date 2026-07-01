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
import { __setEsbuildInitForTest, minifyHtml, minifyScript } from "./minify";

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

describe("minifyHtml", () => {
  it("collapses inter-element whitespace (semantically equivalent)", async () => {
    const r = await minifyHtml("<div>  <span>hi</span>  </div>");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<span>hi</span>");
      expect(r.output).not.toMatch(/\s{2,}/); // no collapsed-away runs remain
      expect(r.output).not.toContain("\n");
    }
  });

  it("strips a non-conditional HTML comment", async () => {
    const r = await minifyHtml("<div><!-- remove me --><span>hi</span></div>");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).not.toContain("<!--");
      expect(r.output).not.toContain("remove me");
      expect(r.output).toContain("<span>hi</span>");
    }
  });

  it("preserves <pre> content verbatim (whitespace-sensitive)", async () => {
    const r = await minifyHtml("<div>\n  <pre>  a   b\n  c  </pre>\n</div>");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<pre>  a   b\n  c  </pre>");
    }
  });

  it("minifies an embedded <script> body via esbuild (js)", async () => {
    const r = await minifyHtml("<script>const a = 1 ;  const b = 2 ;</script>");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<script>");
      expect(r.output).toContain("const a=1");
      expect(r.output).not.toContain("const a = 1 ;");
    }
  });

  it("minifies an embedded <style> body via esbuild (css)", async () => {
    const r = await minifyHtml("<style>a {  color : red ; }</style>");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("a{color:red}");
      expect(r.output).not.toContain("color : red");
    }
  });

  it("minifies both an embedded <script> AND <style> in one doc", async () => {
    const input =
      "<html><head><style>a {  color : red ; }</style></head>" +
      "<body>  <script>const a = 1 ;</script>  </body></html>";
    const r = await minifyHtml(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("a{color:red}");
      expect(r.output).toContain("const a=1");
    }
  });

  it("surfaces a broken embedded <script> as ok:false with block type + line:col (never a silent skip)", async () => {
    const input = "<html>\n<body>\n<script>const a = {</script>\n</body>\n</html>";
    const r = await minifyHtml(input);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message.toLowerCase()).toContain("script");
      expect(typeof r.error.line).toBe("number");
      expect(r.error.line!).toBeGreaterThanOrEqual(1);
      expect(typeof r.error.col).toBe("number");
      expect(r.error.col!).toBeGreaterThanOrEqual(1);
      // must NOT be a silent ok:true carrying the raw block
      expect((r as { output?: string }).output).toBeUndefined();
    }
  });

  it("preserves a JSON-LD (application/ld+json) data block verbatim — not fed to esbuild", async () => {
    // Bare JSON object syntax is NOT valid JS; routing it to esbuild would reject
    // the whole page. JSON-LD is ubiquitous (SEO), so this must stay ok:true.
    const block = `<script type="application/ld+json">{ "@context": "https://schema.org" }</script>`;
    const r = await minifyHtml(`<html><head>${block}</head><body>  hi  </body></html>`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Body preserved byte-for-byte (whitespace inside the data block untouched).
      expect(r.output).toContain(`{ "@context": "https://schema.org" }`);
      expect(r.output).toContain(`type="application/ld+json"`);
    }
  });

  it("preserves an importmap and an application/json data block verbatim", async () => {
    const importmap = `<script type="importmap">{ "imports": { "x": "/x.js" } }</script>`;
    const dataJson = `<script type='application/json'>{ "a": 1 }</script>`;
    const r = await minifyHtml(`${importmap}${dataJson}`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain(`{ "imports": { "x": "/x.js" } }`);
      expect(r.output).toContain(`{ "a": 1 }`);
    }
  });

  it("still minifies a JS script when type is module or a JS MIME (not treated as data)", async () => {
    const mod = await minifyHtml(`<script type="module">const a = 1 ;</script>`);
    expect(mod.ok).toBe(true);
    if (mod.ok) expect(mod.output).toContain("const a=1");
    const mime = await minifyHtml(`<script type="text/javascript">const b = 2 ;</script>`);
    expect(mime.ok).toBe(true);
    if (mime.ok) expect(mime.output).toContain("const b=2");
  });

  it("maps empty/whitespace input to ok with empty output and 0 bytes", async () => {
    const r = await minifyHtml("   \n  ");
    expect(r).toEqual({ ok: true, output: "", inputBytes: 0, outputBytes: 0 });
  });

  it("returns error-as-value (never throws/hangs) and stays valid on plain markup", async () => {
    const r = await minifyHtml("<div><p>one</p><p>two</p></div>");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("<div><p>one</p><p>two</p></div>");
  });
});
