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
    const { code } = await esbuild.transform(input, { loader, minify: true });
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

// ── Offline HTML minifier (D-05) ─────────────────────────────────────────────
// esbuild has no HTML loader, so HTML minifies via a pure, zero-dep, bounded
// string transform: collapse insignificant whitespace + strip non-conditional
// comments, PRESERVING whitespace-sensitive elements (<pre>/<textarea>) verbatim
// and delegating embedded <script>/<style> bodies to minifyScript. A single
// segmenting regex matches every span that must be handled specially; the gaps
// between matches are ordinary markup that gets whitespace-collapsed. All groups
// end-anchored to their own closing tag (`\k<name>`), so blocks can't leak.

/**
 * One pass matches, in order: a `<pre>`/`<textarea>` block (content preserved
 * verbatim), a `<script>`/`<style>` block (body minified via esbuild), or an HTML
 * comment. The source is cloned per call (fresh `lastIndex`) so calls never race.
 */
const HTML_SEGMENT =
  /<(?<pre>pre|textarea)\b[^>]*>[\s\S]*?<\/\k<pre>>|<(?<code>script|style)(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/\k<code>>|<!--(?<comment>[\s\S]*?)-->/gi;

/**
 * Collapse every run of ASCII whitespace to a single space. This is exactly how a
 * browser renders whitespace in normal flow (outside pre/textarea), so it is
 * semantically equivalent while dropping all indentation/newlines between tags.
 */
function collapseMarkup(s: string): string {
  return s.replace(/\s+/g, " ");
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
        if (body.trim() === "") {
          parts.push(`<${tag}${attrs}></${tag}>`);
          continue;
        }
        const loader: MinifyLoader = tagLower === "script" ? "js" : "css";
        const inner = await minifyScript(body, loader);
        if (!inner.ok) {
          // D-07: surface the failure — never leave the raw block in the output.
          const bodyStart = m.index + m[0].indexOf(">") + 1;
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
