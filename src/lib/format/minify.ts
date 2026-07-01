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

/** esbuild single-file transform loaders — code languages only (D-05). */
export type MinifyLoader = "js" | "ts" | "jsx" | "tsx" | "css";

/** UTF-8 byte length — mirrors xml.ts `byteLen` so the StatusBar delta matches. */
function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

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
