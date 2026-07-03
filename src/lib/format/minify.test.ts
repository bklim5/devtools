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
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { MinifyLoader } from "./minify";
import { __setEsbuildInitForTest, minifyHtml, minifyJsTs, minifyScript } from "./minify";

// An angle-bracket TS type cast: the tsx loader mis-lexes `<T>` as a JSX element
// and errors, while the ts loader accepts it. Author-verified at the pinned
// esbuild-wasm — tsx fails, ts yields `const v=1,y=1;`. The fallback-path fixture,
// reused by the ORDER proof below.
const ANGLE_BRACKET_CAST = "type T = number;\nconst v = 1;\nconst y = <T>v;";

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

  it("accepts the jsx loader AND preserves JSX (jsx:preserve — no transpile)", async () => {
    const r = await minifyScript("const x = <div className='a' />;", "jsx");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<div");
      expect(r.output).not.toContain("React.createElement");
    }
  });

  it("accepts the tsx loader AND preserves JSX (jsx:preserve — no transpile)", async () => {
    const r = await minifyScript("const x: unknown = <div />;", "tsx");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<div");
      expect(r.output).not.toContain("React.createElement");
    }
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

describe("minifyJsTs (tsx→ts fallback, D-02/D-03)", () => {
  it("minifies TS via the tsx loader (compact valid output)", async () => {
    const r = await minifyJsTs("const x: number = 1;");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).not.toContain(": number");
      expect(r.output).toContain("x=1");
      expect(isValidJs(r.output)).toBe(true);
    }
  });

  it("minifies JSX via the tsx loader WITHOUT transpiling it (jsx:preserve — no React.createElement)", async () => {
    // MINIFY MUST NOT TRANSPILE: esbuild's default lowers JSX to
    // `React.createElement(…)`, changing the runtime (breaks automatic-runtime /
    // no-`React`-in-scope projects). jsx:"preserve" keeps the JSX dialect while
    // still folding `{1 + 1}`→`{2}` + collapsing whitespace.
    const r = await minifyJsTs("const A = () => <div className='x'>{1 + 1}</div>;");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<div");
      expect(r.output).not.toContain("React.createElement");
      expect(r.output).toContain("{2}"); // constant still folded → genuine minify
    }
  });

  it("preserves TSX JSX too (generic component stays JSX, not React.createElement)", async () => {
    const r = await minifyJsTs("const T = <K,>(p: { v: K }) => <span>{String(p.v)}</span>;");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain("<span>");
      expect(r.output).not.toContain("React.createElement");
    }
  });

  it("does NOT drop a side-effecting import whose binding is unused (verbatimModuleSyntax)", async () => {
    // Under the tsx/ts loader esbuild's default TS import elision would delete
    // `import x from "mod"` when `x` is unused — but a static import must still run
    // the module for its SIDE EFFECTS. verbatimModuleSyntax keeps it (as a bare
    // side-effect import) so the minified output stays semantically equivalent.
    const r = await minifyJsTs('import x from "mod"; console.log(1);');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain('"mod"'); // the import survives (side effect kept)
      expect(r.output).toContain("console.log(1)");
    }
  });

  it("still elides an explicit `import type` (type-only, no runtime side effect)", async () => {
    const r = await minifyJsTs('import type { A } from "mod"; const a: A = 1; console.log(a);');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).not.toContain('"mod"'); // import type carries no side effect → dropped
      expect(r.output).toContain("console.log");
    }
  });

  it("compacts multiple statements ASI-safely (no merge error)", async () => {
    const r = await minifyJsTs("let a=1;\nlet b=2;");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(isValidJs(r.output)).toBe(true);
      expect(r.output).toContain("a=1");
      expect(r.output).toContain("b=2");
    }
  });

  it("RECOVERS an angle-bracket type cast via the ts fallback (tsx mis-reads `<T>` as JSX)", async () => {
    // Sanity: the fixture actually diverges (tsx rejects, ts accepts) at this pin.
    const tsx = await minifyScript(ANGLE_BRACKET_CAST, "tsx");
    const ts = await minifyScript(ANGLE_BRACKET_CAST, "ts");
    expect(tsx.ok).toBe(false);
    expect(ts.ok).toBe(true);

    const r = await minifyJsTs(ANGLE_BRACKET_CAST);
    expect(r.ok).toBe(true); // the FALLBACK path executes and succeeds
    if (r.ok && ts.ok) expect(r.output).toBe(ts.output);
  });

  it("attempts the tsx loader BEFORE ts (routing ORDER, not just output)", async () => {
    const order: MinifyLoader[] = [];
    const spyRun = vi.fn((input: string, loader: MinifyLoader) => {
      order.push(loader);
      return minifyScript(input, loader);
    });
    const result = await minifyJsTs("const x=1", spyRun);
    expect(result.ok).toBe(true);
    expect(order).toEqual(["tsx"]); // tsx-first succeeded → ts never tried
  });

  it("falls back to ts ONLY after tsx (order preserved on fallback)", async () => {
    const order: MinifyLoader[] = [];
    const spyRun = vi.fn((input: string, loader: MinifyLoader) => {
      order.push(loader);
      return minifyScript(input, loader);
    });
    const result = await minifyJsTs(ANGLE_BRACKET_CAST, spyRun);
    expect(result.ok).toBe(true);
    expect(order).toEqual(["tsx", "ts"]); // tsx FIRST, then ts
  });

  it("surfaces the FIRST (tsx) attempt's error when BOTH loaders fail (D-03)", async () => {
    const bad = "function(";
    const r = await minifyJsTs(bad);
    expect(r.ok).toBe(false);
    const tsxErr = await minifyScript(bad, "tsx");
    expect(tsxErr.ok).toBe(false);
    if (!r.ok && !tsxErr.ok) {
      expect(r.error.message).toBe(tsxErr.error.message);
      expect(r.error.line).toBe(tsxErr.error.line);
      expect(r.error.col).toBe(tsxErr.error.col);
    }
  });

  it("empty/whitespace → ok with empty output and 0 bytes (short-circuit)", async () => {
    for (const input of ["", "   ", "\n\t "]) {
      const r = await minifyJsTs(input);
      expect(r).toEqual({ ok: true, output: "", inputBytes: 0, outputBytes: 0 });
    }
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

  // Attribute-value integrity (Codex adversarial finding): collapsing markup
  // whitespace must NEVER rewrite the contents of a quoted attribute value, while
  // still collapsing structural whitespace between attributes and between tags.
  it("preserves runs of spaces inside quoted attribute values (no silent corruption)", async () => {
    const r = await minifyHtml(
      `<div  title="keep   spacing"  data-tpl="a   b">hi</div>`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Quoted values kept verbatim…
      expect(r.output).toContain(`title="keep   spacing"`);
      expect(r.output).toContain(`data-tpl="a   b"`);
      // …but structural whitespace between attributes still collapses to one space.
      expect(r.output).toContain(
        `<div title="keep   spacing" data-tpl="a   b">`,
      );
    }
  });

  it("preserves newlines inside quoted attribute values (alt / aria-label)", async () => {
    const r = await minifyHtml(`<img alt="line one\nline two" aria-label="a\n\nb">`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain(`alt="line one\nline two"`);
      expect(r.output).toContain(`aria-label="a\n\nb"`);
    }
  });

  it("preserves whitespace in single-quoted attribute values too", async () => {
    const r = await minifyHtml(`<span data-t='x   y'>t</span>`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain(`data-t='x   y'`);
  });

  it("does NOT treat a `>` inside a quoted attribute value as the tag boundary (ordinary tag)", async () => {
    // `>` is valid unescaped inside a quoted HTML attribute value. A `[^>]*` scan
    // would split the tag at the inner `>`, corrupting the value / trailing markup.
    const r = await minifyHtml(`<a  title="x > y">link</a>`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toBe(`<a title="x > y">link</a>`);
    }
  });

  it("tokenizes an embedded <script> whose attribute value contains `>` (no false error)", async () => {
    // A quoted `>` in the script's attrs must not shift the attrs/body split — that
    // would feed ` y">const x = 1 ;` to esbuild and fail the whole page falsely.
    const r = await minifyHtml(`<script data-x="a > b">const x = 1 ;</script>`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain(`data-x="a > b"`);
      expect(r.output).toContain(`const x=1`);
    }
  });

  it("maps a broken-script error to the BODY line even when a quoted attr holds `>` + newline (D-07 offset from captured groups, not indexOf('>'))", async () => {
    // The quoted attr value spans a `>` AND a newline, so the start tag ends on
    // line 2. The body `const a = {` is malformed. bodyStart must come from the
    // captured start-tag length: `m[0].indexOf(">")` would find the `>` inside the
    // attribute (line 1) and report the error a full line too early.
    const r = await minifyHtml(`<script data-x="a >\nb">const a = {</script>`);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message.toLowerCase()).toContain("script");
      // Body is on line 2 (after the newline inside the attribute value).
      expect(r.error.line).toBe(2);
    }
  });
});
