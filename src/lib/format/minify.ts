// Offline minify engine wrappers (PRT-06) — the MINIFY half of the Phase-32 seam
// consumed by the HTML (P33) and JS/TS (P34) tools. JS/TS/JSX/TSX + CSS run
// through esbuild-wasm (the second deliberate, scoped heavy runtime-dep exception,
// vendored/self-hosted offline + lazy-loaded); HTML minifies via a pure, zero-dep
// offline collapse (esbuild has no HTML loader — D-05). Both return the shared
// `FormatResult` discriminated union: error-as-value, NEVER a throw past the
// wrapper (PITFALLS 9).
//
// esbuild-wasm loads ONLY via dynamic `import()` so the heavy wasm glue never
// enters the entry chunk (PITFALLS 3), and its `.wasm` is a LOCAL Vite `?url`
// asset (served over tauri://localhost) — never fetched remotely (PITFALLS 10 —
// offline). `esbuild.initialize()` (which throws if run twice) is memoized so it
// fires at most once no matter how many minify calls race.
//
// D-07/PRT-04: a parse/minify failure is NEVER a silent fallback. An embedded
// `<script>`/`<style>` block that fails to minify bubbles up as `ok:false` (block
// type + best-effort line:col) rather than leaving an un-minified block in the
// "minified" output.
import type { FormatResult } from "./types";
import { byteLen, offsetToLineCol } from "./types";

/** esbuild single-file transform loaders — code languages only (D-05). */
export type MinifyLoader = "js" | "ts" | "jsx" | "tsx" | "css";

type EsbuildModule = typeof import("esbuild-wasm");
type InitOptions = Parameters<EsbuildModule["initialize"]>[0];

// Test hook: node/vitest has no Vite `?url` asset pipeline, so the spec injects an
// init-options provider (a compiled `WebAssembly.Module` read off node_modules).
// The browser/WKWebView path stays offline — a local `?url` asset only. Undefined
// in production.
let initOptionsForTest: (() => Promise<InitOptions>) | undefined;
export function __setEsbuildInitForTest(
  provider: (() => Promise<InitOptions>) | undefined,
): void {
  initOptionsForTest = provider;
}

let esbuildPromise: Promise<EsbuildModule> | undefined;
let initPromise: Promise<void> | undefined;

/**
 * Lazily import esbuild-wasm and initialize it EXACTLY once. The dynamic import
 * keeps the heavy wasm glue out of the entry chunk (PITFALLS 3); `initPromise`
 * memoizes so `esbuild.initialize()` (a hard throw if called twice) runs once even
 * when many `minifyScript` calls race the first format.
 */
async function ensureEsbuild(): Promise<EsbuildModule> {
  const esbuild = await (esbuildPromise ??= import("esbuild-wasm"));
  await (initPromise ??= (async () => {
    const options =
      initOptionsForTest !== undefined
        ? await initOptionsForTest()
        : {
            // Local asset URL emitted by Vite — never a remote fetch (PITFALLS 10).
            wasmURL: (await import("esbuild-wasm/esbuild.wasm?url")).default,
            worker: false,
          };
    await esbuild.initialize(options);
  })());
  return esbuild;
}

/**
 * Map a thrown esbuild error to the `FormatResult` error value. esbuild attaches
 * `.errors[]`, each `{ text, location: { line (1-based), column (0-based) } }`, so
 * the column is normalised to 1-based (`+1`) to match the JSON/XML tools' col.
 */
function toError(e: unknown): { message: string; line?: number; col?: number } {
  const first = (
    e as {
      errors?: Array<{
        text?: string;
        location?: { line?: number; column?: number } | null;
      }>;
    }
  )?.errors?.[0];
  if (first) {
    const loc = first.location;
    const line = loc && typeof loc.line === "number" ? loc.line : undefined;
    const col = loc && typeof loc.column === "number" ? loc.column + 1 : undefined;
    return {
      message: first.text ?? "Minify failed",
      ...(line !== undefined ? { line } : {}),
      ...(col !== undefined ? { col } : {}),
    };
  }
  return { message: e instanceof Error ? e.message : String(e) };
}

/**
 * Minify a JS/TS/JSX/TSX/CSS string via esbuild-wasm's single-file `transform`
 * (NEVER `build` — no bundling, Out of Scope). esbuild's lexer is regex/ASI-aware,
 * so it never merges statements into a syntax error or mis-lexes a regex literal
 * (PRT-06). Empty/whitespace input short-circuits to the neutral ok value WITHOUT
 * loading or initializing esbuild.
 */
export async function minifyScript(
  input: string,
  loader: MinifyLoader,
): Promise<FormatResult> {
  if (input.trim() === "") {
    return { ok: true, output: "", inputBytes: 0, outputBytes: 0 };
  }
  try {
    const esbuild = await ensureEsbuild();
    // MINIFY MUST NOT CHANGE SEMANTICS — two esbuild defaults would, so both are
    // pinned here:
    //   jsx:"preserve" — esbuild's default LOWERS `<div/>` to
    //     `React.createElement("div",…)`, a runtime change (needs `React` in scope;
    //     breaks React-automatic-runtime / custom-factory projects). Preserve keeps
    //     the pasted dialect while still folding constants + collapsing whitespace.
    //   verbatimModuleSyntax — under the ts/tsx loader esbuild applies TypeScript's
    //     import elision, DROPPING an unused value import (`import x from "mod";` when
    //     `x` is unused) even though a static import must still evaluate the module
    //     for its SIDE EFFECTS. verbatimModuleSyntax keeps it (as a bare side-effect
    //     `import"mod"`) while still eliding an explicit `import type`.
    // Both are no-ops for the loaders that don't apply them (jsx:preserve for js/css;
    // tsconfigRaw for js/jsx/css — incl. HTML embedded <script>/<style>), so the
    // 33-02 HTML SC2 golden stays byte-identical and every caller is safe.
    const { code } = await esbuild.transform(input, {
      loader,
      minify: true,
      jsx: "preserve",
      tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } },
    });
    return {
      ok: true,
      output: code,
      inputBytes: byteLen(input),
      outputBytes: byteLen(code),
    };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Minify a JS/TS/JSX/TSX string with NO language picker (D-02/D-04): try the
 * `tsx` esbuild loader first (handles TS + JSX + plain JS — the modern common
 * case), and only on error retry the `ts` loader (recovers the rare angle-bracket
 * type cast `<T>value` that tsx mis-lexes as JSX). On total failure the input is
 * genuinely broken, so surface the FIRST (tsx) attempt's error (D-03).
 */
export async function minifyJsTs(
  input: string,
  // Test-only injection seam for the ORDER proof (default = the real
  // minifyScript, so callers stay one-arg — additive). minifyJsTs calls
  // minifyScript intra-module, so a module-boundary spy would not intercept.
  run: (input: string, loader: MinifyLoader) => Promise<FormatResult> = minifyScript,
): Promise<FormatResult> {
  const primary = await run(input, "tsx");
  if (primary.ok) return primary;
  const fallback = await run(input, "ts");
  return fallback.ok ? fallback : primary; // first-attempt error on total failure
}

// ── Offline HTML minifier (D-05) ─────────────────────────────────────────────
// esbuild has no HTML loader, so HTML minifies via a pure, zero-dep, bounded
// string transform: collapse insignificant whitespace + strip non-conditional
// comments, PRESERVING whitespace-sensitive elements (<pre>/<textarea>) verbatim
// and delegating embedded <script>/<style> bodies to minifyScript. A single
// segmenting regex matches every span that must be handled specially; the gaps
// between matches are ordinary markup that gets whitespace-collapsed. All groups
// end-anchored to their own closing tag (`\k<name>`), so blocks can't leak.

/**
 * A start-tag attribute run: any char that is NOT a quote or `>`, OR a fully quoted
 * value (`"…"`/`'…'`) that may itself contain a `>`. The three alternatives are
 * disjoint on their first character, so the `*` is linear-time (ReDoS-safe) while
 * still consuming a `>` that lives inside a quoted attribute value instead of
 * treating it as the tag terminator. This is what lets `<a title="x > y">` and
 * `<script data-x="a > b">…` tokenize correctly rather than splitting mid-value.
 */
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;

/**
 * One pass matches, in order: a `<pre>`/`<textarea>` block (content preserved
 * verbatim), a `<script>`/`<style>` block (body minified via esbuild), or an HTML
 * comment. The source is cloned per call (fresh `lastIndex`) so calls never race.
 * Start-tag attributes use {@link ATTRS} so a quoted `>` never ends the tag early.
 */
const HTML_SEGMENT = new RegExp(
  `<(?<pre>pre|textarea)\\b${ATTRS}>[\\s\\S]*?<\\/\\k<pre>>` +
    `|<(?<code>script|style)(?<attrs>${ATTRS})>(?<body>[\\s\\S]*?)<\\/\\k<code>>` +
    `|<!--(?<comment>[\\s\\S]*?)-->`,
  "gi",
);

/** Matches a single tag `<…>`, quote-aware (see {@link ATTRS}) so a literal `>`
 *  inside a quoted attribute value does not terminate the tag early. */
const TAG = new RegExp(`<${ATTRS}>`, "g");

/**
 * Collapse structural whitespace inside a tag (between attributes) to a single
 * space, but keep the interior of every quoted attribute value ("…"/'…') VERBATIM.
 * A blind `\s+`→` ` over a tag would rewrite values like `title="keep   spacing"`,
 * `alt`, `aria-label`, or `data-*` that carry semantic runs of spaces/newlines — a
 * silent data-corruption path. The alternation matches a quoted value OR a
 * whitespace run; only the latter collapses.
 */
function collapseTag(tag: string): string {
  return tag.replace(/"[^"]*"|'[^']*'|\s+/g, (t) =>
    t[0] === '"' || t[0] === "'" ? t : " ",
  );
}

/**
 * Collapse insignificant whitespace in an ordinary-markup slice. Whitespace between
 * tags (text nodes, indentation) collapses to a single space — exactly how a browser
 * renders normal-flow whitespace — and structural whitespace inside a tag collapses
 * too, but quoted attribute values are preserved verbatim (see {@link collapseTag}).
 * This is the attribute-safe replacement for a blind `\s+`→` ` over the raw markup.
 */
function collapseMarkup(s: string): string {
  let out = "";
  let last = 0;
  const re = new RegExp(TAG.source, TAG.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out += s.slice(last, m.index).replace(/\s+/g, " "); // text before the tag
    out += collapseTag(m[0]); // the tag: keep quoted values verbatim
    last = re.lastIndex;
  }
  out += s.slice(last).replace(/\s+/g, " "); // trailing text after the last tag
  return out;
}

/**
 * A `<script>` holds executable JavaScript only when its `type` is absent, empty,
 * `module`, or a JS MIME type. Everything else — `application/json`,
 * `application/ld+json` (JSON-LD), `importmap`, `text/plain`, or a custom template
 * type — is a DATA block, not code (WHATWG "the script block's type"). Feeding such
 * a block to esbuild's JS parser would reject valid content (bare JSON object
 * syntax) and fail the whole page's minify, so data blocks are preserved verbatim.
 */
const JS_SCRIPT_TYPES = new Set([
  "",
  "module",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
]);

function scriptIsJavaScript(attrs: string): boolean {
  const m = /\btype\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(attrs);
  if (!m) return true; // no type attribute → a classic JavaScript script
  const value = (m[2] ?? m[3] ?? m[4] ?? "").trim().toLowerCase();
  return JS_SCRIPT_TYPES.has(value);
}

/** IE conditional comments (`<!--[if …]>` / `<![endif]-->`) are preserved. */
function isConditionalComment(inner: string): boolean {
  return /^\s*\[if\b/i.test(inner) || /\[endif\]/i.test(inner);
}

/**
 * Minify an HTML string offline (D-05): collapse insignificant whitespace, strip
 * non-conditional comments, preserve `<pre>`/`<textarea>` verbatim, and minify
 * embedded `<script>` (JS) and `<style>` (CSS) via `minifyScript`.
 *
 * D-07/PRT-04: an embedded block that FAILS to minify is NEVER silently skipped —
 * it returns `{ok:false}` naming the block type with a best-effort line:col mapped
 * back to the HTML document, rather than shipping an un-minified block in
 * "minified" output. Structural failures return error-as-value, never a throw.
 */
export async function minifyHtml(input: string): Promise<FormatResult> {
  if (input.trim() === "") {
    return { ok: true, output: "", inputBytes: 0, outputBytes: 0 };
  }
  try {
    const re = new RegExp(HTML_SEGMENT.source, HTML_SEGMENT.flags);
    const parts: string[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = re.exec(input)) !== null) {
      const g = m.groups as Record<string, string | undefined>;
      // Ordinary markup before this special span → whitespace-collapsed.
      parts.push(collapseMarkup(input.slice(lastIndex, m.index)));
      lastIndex = re.lastIndex;

      if (g.pre !== undefined) {
        parts.push(m[0]); // <pre>/<textarea>: preserve verbatim
        continue;
      }
      if (g.code !== undefined) {
        const tag = g.code;
        const tagLower = tag.toLowerCase();
        const attrs = g.attrs ?? "";
        const body = g.body ?? "";
        // A non-JS <script> data block (JSON-LD, importmap, application/json, …) is
        // NOT code — esbuild would reject it and fail the whole page. Preserve it
        // verbatim, exactly like <pre>/<textarea>.
        if (tagLower === "script" && !scriptIsJavaScript(attrs)) {
          parts.push(m[0]);
          continue;
        }
        if (body.trim() === "") {
          parts.push(`<${tag}${attrs}></${tag}>`);
          continue;
        }
        const loader: MinifyLoader = tagLower === "script" ? "js" : "css";
        const inner = await minifyScript(body, loader);
        if (!inner.ok) {
          // D-07: surface the failure — never leave the raw block in the output.
          // Body starts right after the start tag `<${tag}${attrs}>`. Compute its
          // length from the captured groups, NOT `m[0].indexOf(">")` — a quoted
          // attribute value may contain a `>` (now tokenized correctly), which
          // indexOf would mistake for the tag terminator and shift the offset.
          const bodyStart = m.index + 1 + tag.length + attrs.length + 1;
          const pos = offsetToLineCol(input, bodyStart);
          const eLine = inner.error.line;
          const eCol = inner.error.col;
          const line = eLine !== undefined ? pos.line + eLine - 1 : pos.line;
          const col =
            eLine === 1 && eCol !== undefined ? pos.col + eCol - 1 : (eCol ?? pos.col);
          return {
            ok: false,
            error: {
              message: `<${tagLower}> block: ${inner.error.message}`,
              line,
              col,
            },
          };
        }
        parts.push(`<${tag}${attrs}>${inner.output}</${tag}>`);
        continue;
      }
      // Comment: drop unless it's an IE conditional comment.
      if (g.comment !== undefined && isConditionalComment(g.comment)) {
        parts.push(m[0]);
      }
    }

    parts.push(collapseMarkup(input.slice(lastIndex)));
    const output = parts.join("").trim();
    return {
      ok: true,
      output,
      inputBytes: byteLen(input),
      outputBytes: byteLen(output),
    };
  } catch (e) {
    return { ok: false, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}
