// Async Prettier engine wrapper (PRT-01, PRT-05) — the PRETTIFY half of the
// Phase-32 seam consumed by the HTML (P33) and JS/TS (P34) tools. Wraps
// `prettier/standalone` + the explicit plugin matrix behind a dynamic `import()`
// so the heavy engine chunk loads on the FIRST format, never at tool mount and
// never in the main bundle (PITFALLS 3). Returns the shared `FormatResult`
// discriminated union: error-as-value, NEVER a throw past this wrapper
// (PITFALLS 9). Output is byte-identical to dev-time `prettier --write` at the
// SAME options, locked by `prettier.parity.test.ts` (PRT-05).
//
// Options are passed EXPLICITLY: standalone has no filesystem, so it never reads
// the repo `.prettierrc` (printWidth 100). Pasted-code defaults are Prettier's
// OWN defaults (printWidth 80, tabWidth 2, semi true, singleQuote false,
// trailingComma "all") — NOT the repo's 100 (STACK.md output-parity caveat).
import type { FormatOptions, FormatResult } from "./types";
import { byteLen } from "./types";

/** Which parser drives the combined JS/TS tool (P34); HTML has its own entry. */
export type ScriptLang = "babel" | "typescript";

/** Callers (P33/P34) may widen the shared options with an explicit printWidth. */
export type PrettierFormatOptions = FormatOptions & { printWidth?: number };

// Prettier 3 plugins are ESM; a dynamic `import()` yields a namespace object
// whose `.default` is the plugin (PITFALLS 11). Normalise to `.default ?? ns`.
// The estree namespace trips prettier's own option types, so plugins are carried
// as `unknown[]` and cast ONCE at the single `format()` seam below — no scattered
// `any`.
type PluginModule = { default?: unknown };
function pickPlugin(m: PluginModule): unknown {
  return m.default ?? m;
}

// Module-level memoised lazy loaders — each engine/plugin import fires at most
// once, then the resolved promise is reused (the `p ??= import(...)` singleton
// idiom). Reopening a tool or formatting again never re-imports.
let standalonePromise: Promise<typeof import("prettier/standalone")> | undefined;
function loadStandalone(): Promise<typeof import("prettier/standalone")> {
  return (standalonePromise ??= import("prettier/standalone"));
}

const scriptPluginPromises: Partial<Record<ScriptLang, Promise<unknown[]>>> = {};
function loadScriptPlugins(lang: ScriptLang): Promise<unknown[]> {
  // JS → [estree, babel]; TS → [estree, typescript] (estree is the shared
  // printer — omitting it throws "Couldn't find plugin for AST format estree").
  return (scriptPluginPromises[lang] ??= Promise.all([
    import("prettier/plugins/estree"),
    lang === "typescript"
      ? import("prettier/plugins/typescript")
      : import("prettier/plugins/babel"),
  ]).then((mods) => mods.map(pickPlugin)));
}

let htmlPluginsPromise: Promise<unknown[]> | undefined;
function loadHtmlPlugins(): Promise<unknown[]> {
  // HTML `prettier --write` parity = [html, babel, estree, postcss]: html alone
  // leaves embedded <script>/<style> RAW; babel+estree format the embedded JS
  // and postcss the embedded CSS (STACK.md plugin matrix / PITFALLS 2).
  return (htmlPluginsPromise ??= Promise.all([
    import("prettier/plugins/html"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/estree"),
    import("prettier/plugins/postcss"),
  ]).then((mods) => mods.map(pickPlugin)));
}

/**
 * Map the shared `FormatOptions` (+ optional `printWidth`) onto the explicit
 * Prettier option set. Defaults are Prettier's OWN defaults, NOT the repo's
 * `.prettierrc` (which the filesystem-less standalone build can't read anyway).
 */
function optionsFrom(opts: PrettierFormatOptions) {
  return {
    printWidth: opts.printWidth ?? 80,
    tabWidth: opts.indent === "4" ? 4 : 2,
    useTabs: opts.indent === "tab",
    semi: true,
    singleQuote: false,
    trailingComma: "all" as const,
    embeddedLanguageFormatting: "auto" as const,
  };
}

/**
 * Convert a thrown Prettier error into the `FormatResult` error value. Prettier
 * 3 attaches `err.loc.start.{line,column}` where BOTH are 1-based (verified vs
 * 3.8.3 — the column equals the "(line:column)" shown in the message and the
 * JSON tool's own 1-based col), so it is surfaced as-is. NOTE: the plan assumed a
 * 0-based column needing +1; empirically 3.8.3's `loc.start.column` is already
 * 1-based, so adding +1 would over-count by one — see the SUMMARY deviation.
 */
function toError(err: unknown): { message: string; line?: number; col?: number } {
  const message = err instanceof Error ? err.message : String(err);
  const start = (err as { loc?: { start?: { line?: number; column?: number } } })?.loc
    ?.start;
  if (start && typeof start.line === "number") {
    const line = start.line;
    const col = typeof start.column === "number" ? start.column : undefined;
    return { message, line, ...(col !== undefined ? { col } : {}) };
  }
  return { message };
}

/**
 * Shared engine call: short-circuit empty input BEFORE any dynamic import, then
 * lazily load the engine + `plugins`, run `format()`, and wrap the whole thing in
 * try/catch so a malformed paste becomes a typed error value (never a throw).
 */
async function formatWith(
  input: string,
  parser: string,
  loadPlugins: () => Promise<unknown[]>,
  opts: PrettierFormatOptions,
): Promise<FormatResult> {
  if (input.trim() === "") {
    return { ok: true, output: "", inputBytes: 0, outputBytes: 0 };
  }
  try {
    const [{ format }, plugins] = await Promise.all([loadStandalone(), loadPlugins()]);
    const output = await format(input, {
      parser,
      // Single narrow cast at the interop seam (PITFALLS 11) — the ESM plugin
      // namespaces don't satisfy prettier's own `Plugin` option type.
      plugins: plugins as NonNullable<Parameters<typeof format>[1]>["plugins"],
      ...optionsFrom(opts),
    });
    return {
      ok: true,
      output,
      inputBytes: byteLen(input),
      outputBytes: byteLen(output),
    };
  } catch (err) {
    return { ok: false, error: toError(err) };
  }
}

/**
 * Prettify a JavaScript/TypeScript/JSX/TSX string via `prettier/standalone`.
 * `lang` selects the parser ("babel" for JS/JSX, "typescript" for TS/TSX).
 */
export function formatScript(
  input: string,
  lang: ScriptLang,
  opts: PrettierFormatOptions,
): Promise<FormatResult> {
  return formatWith(input, lang, () => loadScriptPlugins(lang), opts);
}

/**
 * Prettify an HTML string via `prettier/standalone`, reformatting embedded
 * `<script>` (JS) and `<style>` (CSS) too — full `prettier --write` parity.
 */
export function formatHtml(
  input: string,
  opts: PrettierFormatOptions,
): Promise<FormatResult> {
  return formatWith(input, "html", loadHtmlPlugins, opts);
}
