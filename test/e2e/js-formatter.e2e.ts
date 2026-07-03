// JS/TS formatter — real macOS WKWebView gate (Phase 34, 34-05; PRT-09/PRT-10/PRT-12,
// D-01..D-11). The BLOCKING boundary proof for the combined JS/TS/JSX/TSX tool.
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the same harness as
// html-formatter.e2e.ts / json-formatter.e2e.ts. Run by scripts/e2e-spike.sh
// (starts `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`, tears
// the child down). Scope this ONE spec via
// `E2E_SPECS=./test/e2e/js-formatter.e2e.ts bash scripts/e2e-spike.sh`.
//
// Stable selectors come from JsFormatterTool.tsx via FormatterView: #js-input,
// #js-output, the output copy <button aria-label="Copy output">, the
// [ Prettify | Minify ] mode segments (button text), the Semi + Single-quotes
// Prettify-only toggles (button[aria-label="semicolons"] / button[aria-label="single
// quotes"]), and the status <footer> (role=status normally, role=alert on error —
// D-07). The footer error span is [data-status="error"] whose aria-label carries the
// FULL composed `${line}:${col} ${message}` (JSON/HTML-style, NOT the XML line-only
// form) via the shared conciseError helper.
//
// This is the load-bearing real-runtime check for the whole phase. Critically it
// pastes + asserts formatted output for ALL FOUR DIALECTS (JS, TS, JSX, TSX) — a
// JavaScriptCore-only JSX/TSX parser/lazy-plugin-chunk failure would be INVISIBLE to a
// TS-only gate, so each dialect must independently RED here rather than slip to the
// human walkthrough (T-34-16). formatJsTs is typescript-first, so every dialect
// exercises the typescript parser + its lazy plugin chunk on JavaScriptCore.
//
// Async facts: prettify/minify run through a 180ms debounce + a one-time lazy-chunk
// load, so EVERY assertion waits via browser.waitUntil, NEVER an immediate getValue.
//
// WebKit LESSON 3 (helpers.ts): the embedded WebDriver goes STALE on chained element
// handles across the async re-render — a held #js-output handle throws once the format
// re-renders the textarea. So this spec reads ALL live state (output value, footer
// role, hasError) in a SINGLE browser.execute round-trip per poll, by id, and reads the
// error TEXT via a FRESHLY-queried handle's aria-label (WebKit's execute/sync fails to
// transmit a string carrying the composed error's embedded quotes).

import { assert, navigateToTool, saveScreenshot } from "./helpers";

// Single-round-trip live-state read (LESSON 3 — no stale handles across re-render).
interface JsState {
  output: string;
  role: string | null;
  hasError: boolean;
}
function readState(): Promise<JsState> {
  return browser.execute(() => {
    const out = document.getElementById("js-output") as HTMLTextAreaElement | null;
    const footer = document.querySelector("footer");
    const errEl = footer?.querySelector('[data-status="error"]') ?? null;
    return {
      output: out?.value ?? "",
      role: footer?.getAttribute("role") ?? null,
      hasError: errEl !== null,
    };
  });
}

// Read the footer error span's composed line:col text via a FRESH element handle
// (never held across a re-render). aria-label carries the full, untruncated
// `${line}:${col} ${message}` (the visible text is `truncate`d).
async function readErrorText(): Promise<string> {
  const errEl = await $('footer [data-status="error"]');
  return (await errEl.getAttribute("aria-label")) ?? "";
}

// Replace #js-input, then wait for a predicate over a single readState round-trip.
// A FRESH #js-input query per call keeps the clean replace-then-assert discipline and
// dodges any handle staleness; WDIO setValue clears the field before typing, so each
// dialect step is a genuine replace, not an append onto the prior input.
async function pasteAndWait(
  value: string,
  predicate: (s: JsState) => boolean,
  timeoutMsg: string,
): Promise<void> {
  const input = await $("#js-input");
  await input.setValue(value);
  await browser.waitUntil(async () => predicate(await readState()), {
    timeout: 15_000,
    timeoutMsg,
  });
}

describe("JS/TS formatter tool (real WKWebView)", () => {
  it("async prettifies all four dialects (JS/TS/JSX/TSX), drives the toggles, minifies via esbuild, surfaces role=alert line:col, recovers, exposes focusable copy", async () => {
    // Navigate to the JS/TS formatter via HashRouter (deterministic).
    await navigateToTool("js-formatter");

    const inputEl = await $("#js-input");
    await inputEl.waitForExist({ timeout: 15_000 });

    // 1. PRETTIFY — ALL FOUR DIALECTS. Each proves the lazy Prettier chunk + the
    //    typescript parser ran on the WKWebView for THAT dialect. NOT collapsed to one
    //    TS case: a JSX/TSX-only JavaScriptCore parser/lazy-chunk failure must RED here.

    // 1a. JS — the plainest path; also proves the first lazy-chunk load resolved.
    await pasteAndWait(
      "const a=1;function f(x){return x*2}",
      (s) => s.output.includes("\n") && s.output.includes("const a = 1;") && s.output.includes("return x * 2;"),
      "expected async prettified JS output (const a = 1; / return x * 2;)",
    );

    // 1b. TS — interfaces + type annotations through the typescript parser.
    await pasteAndWait(
      "interface P{a:number}const z:P={a:1};function g(x:number){return x*2}",
      (s) => s.output.includes("interface P {") && s.output.includes("const z: P = { a: 1 };"),
      "expected async prettified TS output (interface P { / const z: P = { a: 1 };)",
    );

    // 1c. JSX — JSX through the typescript parser + its lazy plugin chunk. Default
    //     singleQuote:false canonicalises the attribute to DOUBLE quotes.
    await pasteAndWait(
      "const A=()=><div className='x'>{1+1}</div>",
      (s) => s.output.includes('className="x"') && s.output.includes("{1 + 1}"),
      'expected async prettified JSX output (className="x" / {1 + 1})',
    );

    // 1d. TSX — the disambiguating `<K,>` generic (a bare `<K>` would lex as JSX);
    //     proves the typescript-tsx surface formats on JavaScriptCore.
    await pasteAndWait(
      "const T=<K,>(p:{v:K})=><span>{String(p.v)}</span>",
      (s) => s.output.includes("<K,>") && s.output.includes("<span>{String(p.v)}</span>"),
      "expected async prettified TSX output (<K,> / <span>{String(p.v)}</span>)",
    );

    // 2. TOGGLES — prove the Semi + Single-quotes toggles drive the engine on the real
    //    runtime. Fixture `const s = 'hi'` → default output `const s = "hi";` (double
    //    quotes + trailing semi). Toggle Single quotes ON → 'hi'; toggle Semi OFF → no `;`.
    await pasteAndWait(
      "const s = 'hi'",
      (s) => s.output.includes('const s = "hi";'),
      'expected default prettified output const s = "hi"; (double quotes + semi)',
    );

    await (await $('button[aria-label="single quotes"]')).click();
    await browser.waitUntil(
      async () => (await readState()).output.includes("const s = 'hi'"),
      { timeout: 15_000, timeoutMsg: "expected Single-quotes toggle to flip output to 'hi'" },
    );

    await (await $('button[aria-label="semicolons"]')).click();
    await browser.waitUntil(
      async () => {
        const { output } = await readState();
        return output.includes("const s = 'hi'") && !output.trim().endsWith(";");
      },
      { timeout: 15_000, timeoutMsg: "expected Semi toggle OFF to drop the trailing semicolon" },
    );

    // 3. MINIFY — switch to esbuild via the Minify segment; a plain-JS input compacts to
    //    a single logical line. Wait for real content FIRST, THEN assert no INTERNAL
    //    newline (an initial EMPTY output would trivially satisfy a bare newline check).
    //    esbuild TERMINATES the minified body with a trailing "\n" (verified on the real
    //    WKWebView: `let a=1;\nlet b=2;` → `let a=1,b=2;\n`), so the compactness check is
    //    against the TRIMMED output — same esbuild trailing-newline fact the HTML spec
    //    documented, applied to a whole-file JS minify here.
    await (await $("#js-input")).setValue("let a=1;\nlet b=2;");
    await (await $("button=Minify")).click();
    await browser.waitUntil(
      async () => {
        const { output } = await readState();
        return output.includes("a=1") && output.includes("b=2") && !output.trim().includes("\n");
      },
      { timeout: 15_000, timeoutMsg: "expected compact single-line esbuild output in Minify mode" },
    );

    // 3b. MINIFY MUST NOT TRANSPILE JSX (real-runtime guard for the codex 34-05
    //     finding): pasting JSX under Minify keeps the JSX dialect (jsx:"preserve")
    //     and still folds `{1 + 1}`→`{2}` — it must NEVER lower to
    //     `React.createElement(...)`, which would change the required runtime. The
    //     plain-JS minify above can't catch this; only a JSX minify assertion does.
    await pasteAndWait(
      "const A = () => <div className='x'>{1 + 1}</div>;",
      (s) => s.output.includes("<div") && s.output.includes("{2}") && !s.output.includes("React.createElement"),
      "expected JSX minify to PRESERVE JSX (no React.createElement) and fold {1+1}->{2}",
    );

    // 4. ERROR (D-11): genuinely malformed input → calm role=alert, output CLEARED
    //    (never a silent fallback). Still in Minify mode, so esbuild is the erroring
    //    engine; the composed error carries a line:col.
    await pasteAndWait(
      "function(",
      (s) => s.role === "alert" && s.hasError && s.output === "",
      "expected role=alert + cleared output for malformed input (esbuild)",
    );
    const errorText = await readErrorText();
    assert(
      /\d+:\d+/.test(errorText),
      `expected a line:col error, got "${errorText}"`,
    );
    // CONCISE (D-11): no Prettier/esbuild boilerplate or spec URL leaking into the banner.
    assert(
      !/It may happen|For more info|https?:\/\//i.test(errorText),
      `expected a concise error (no boilerplate/URL), got "${errorText}"`,
    );

    // 5. RECOVERY: a subsequent valid paste produces output again and the footer returns
    //    to role=status — proves the app NEVER crashed and recovered after the error.
    await pasteAndWait(
      "const ok = 1;",
      (s) => s.output.trim().length > 0 && s.role === "status",
      "expected recovery to valid output + role=status",
    );

    // 6. NO-REMOTE (best-effort automated SC5 COMPLEMENT — NOT the authoritative gate).
    //    After the prettify + minify lazy-chunk loads, no resource should point at a
    //    remote host. The spike serves from localhost:1420, so localhost/127.0.0.1
    //    entries are EXPECTED; a CDN/remote fetch would be a DIFFERENT host and fail
    //    here. Complements the human Wi-Fi-off Network-tab gate (34-05-OFFLINE-PROOF.md).
    const resources: string[] = await browser.execute(() =>
      performance.getEntriesByType("resource").map((e) => e.name),
    );
    const remote = resources.filter(
      (u) => /^https?:\/\//.test(u) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(u),
    );
    assert(remote.length === 0, "unexpected remote resource requests: " + remote.join(", "));

    // 7. Copy affordance is a visible, focusable <button> — never hover-only (FMT-08).
    const copy = await $('button[aria-label="Copy output"]');
    assert(
      await copy.isDisplayed(),
      "Copy output button is not visible — hover-only copy is forbidden",
    );

    // 8. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    await saveScreenshot("js-formatter", "js-formatter-wkwebview.png");
  });
});
