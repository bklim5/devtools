// HTML formatter — real macOS WKWebView gate (Phase 33, 33-04; PRT-04/PRT-12, D-10/D-11).
//
// Drives the ACTUAL app's WKWebView via the embedded W3C WebDriver server
// (tauri-plugin-webdriver on 127.0.0.1:4445, debug-only), the same harness as
// json-formatter.e2e.ts / xml-formatter.e2e.ts. Run by scripts/e2e-spike.sh
// (starts `tauri dev --features webdriver`, waits for :4445, runs `pnpm e2e`,
// tears the child down). Scope this ONE spec via
// `E2E_SPECS=./test/e2e/html-formatter.e2e.ts bash scripts/e2e-spike.sh`.
//
// Stable selectors come from HtmlFormatterTool.tsx via FormatterView: #html-input,
// #html-output, the output copy <button aria-label="Copy output">, the
// [ Prettify | Minify ] mode segments (button text), and the status <footer>
// (role=status normally, role=alert on error — D-07). The footer error span is
// [data-status="error"] whose aria-label carries the FULL composed error text,
// which the HTML tool renders as line:col (`${line}:${col} ${message}`, mirroring
// JsonFormatterTool — NOT the XML line-only form).
//
// This is the load-bearing FIRST-MOUNTED-CONSUMER real-runtime check:
//   - it proves the lazy Prettier + esbuild chunks LOAD and format on the real
//     WKWebView (JavaScriptCore), whose behavior can differ from jsdom's — the
//     prettify path reformats an embedded <script>, and the minify path runs the
//     embedded body through esbuild;
//   - prettify/minify are ASYNC here (180ms debounce + one-time lazy-chunk load),
//     so every assertion waits via browser.waitUntil, NEVER an immediate getValue;
//   - it proves BOTH D-11 error categories surface a calm role=alert LINE:COL and
//     never crash: a bad embedded <script> in MINIFY (esbuild embedded-code error)
//     AND a malformed-HTML structure error in PRETTIFY (Prettier's html parser),
//     which live on DIFFERENT engine paths (see the plan's <engine_error_facts>);
//   - a best-effort resource-timing no-remote check COMPLEMENTS (never replaces)
//     the authoritative interactive Wi-Fi-off Network-tab gate (33-04-OFFLINE-PROOF.md).
//
// WebKit LESSON 3 (helpers.ts): the embedded WebDriver goes STALE on chained
// element handles across re-render — a held #html-output handle throws "A
// JavaScript exception occurred" on a property read once the async format
// re-renders the textarea. So this spec reads ALL live state (output value, footer
// role, error span) in a SINGLE browser.execute round-trip per poll, by id, never
// holding an output/footer handle across the async format.

import { assert, navigateToTool, saveScreenshot } from "./helpers";

// Single-round-trip live-state read (LESSON 3 — no stale handles across re-render).
// Returns ONLY primitives (output value, footer role, hasError flag) — deliberately
// NOT the raw error aria-label: WebKit's execute/sync fails to transmit that string
// once it carries the composed error's embedded double-quotes (e.g. `found "("`),
// surfacing the aria-label itself as a WebDriverError. The error TEXT is read
// separately via a freshly-queried element handle (the proven json/xml pattern).
interface HtmlState {
  output: string;
  role: string | null;
  hasError: boolean;
}
function readState(): Promise<HtmlState> {
  return browser.execute(() => {
    const out = document.getElementById("html-output") as HTMLTextAreaElement | null;
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
// (never held across a re-render). getAttribute("aria-label") carries the full,
// untruncated `${line}:${col} ${message}` the tool composed (StatusBar sets it as
// the accessible name because the visible text is `truncate`d).
async function readErrorText(): Promise<string> {
  const errEl = await $('footer [data-status="error"]');
  return (await errEl.getAttribute("aria-label")) ?? "";
}

describe("HTML formatter tool (real WKWebView)", () => {
  it("async prettifies + minifies, surfaces role=alert line:col on both D-11 paths, recovers, exposes focusable copy", async () => {
    // Navigate to the HTML formatter via HashRouter (deterministic).
    await navigateToTool("html-formatter");

    const input = await $("#html-input");
    await input.waitForExist({ timeout: 15_000 });

    // 1. PRETTIFY (ASYNC): pasting compact HTML with an embedded <script> triggers
    //    the lazy Prettier chunk load, then reformats the doc AND the embedded JS.
    //    This is the load-bearing proof the real Prettier engine loaded + ran on
    //    the WKWebView (embedded `const a=1;function f…` → multi-line `const a = 1;`).
    await input.click();
    await input.setValue(
      "<div><span>hi</span></div><script>const a=1;function f(){return a}</script>",
    );
    await browser.waitUntil(
      async () => {
        const { output } = await readState();
        return output.includes("\n") && output.includes("const a = 1;");
      },
      {
        timeout: 15_000,
        timeoutMsg: "expected async prettified output with formatted embedded JS",
      },
    );

    // 2. MINIFY (ASYNC): the Minify SEGMENT compacts the output (single-line). Use a
    //    DEDICATED plain-HTML input (no embedded <script>/<style>) — esbuild appends
    //    a trailing "\n" inside a minified script/style body (33-02 golden), so a
    //    script-bearing input can never satisfy the no-newline assertion; the proven
    //    33-03 unit test uses this same plain input for exactly this reason. Wait for
    //    the real content first, THEN assert no newline — an initial EMPTY output
    //    would trivially satisfy a bare `!includes("\n")` before the format lands.
    await input.setValue("<div>\n  <span>hi</span>\n</div>");
    const minifyBtn = await $("button=Minify");
    await minifyBtn.click();
    await browser.waitUntil(
      async () => {
        const { output } = await readState();
        return output.includes("<span>hi</span>") && !output.includes("\n");
      },
      { timeout: 15_000, timeoutMsg: "expected compact output in Minify mode" },
    );

    // 3. ERROR — D-11: prove BOTH categories, each on the engine path that GENUINELY
    //    errors, and assert line:col per the plan's <engine_error_facts>. A broken
    //    embedded <script> does NOT error under Prettify (formatHtml's embedded
    //    formatting is best-effort and leaves it raw), so the embedded-code category
    //    MUST be proven via Minify/esbuild and the html-structure category via
    //    Prettify/html-parser — two DIFFERENT engines.

    // 3a. EMBEDDED-CODE error via MINIFY (esbuild): still in Minify mode, a broken
    //     embedded <script> body fails esbuild → calm role=alert, output CLEARED
    //     (never a silent un-minified fallback), error text carries a line:col.
    await input.setValue("<script>function(</script>");
    await browser.waitUntil(
      async () => {
        const { output, role, hasError } = await readState();
        return role === "alert" && hasError && output === "";
      },
      {
        timeout: 15_000,
        timeoutMsg:
          "expected role=alert + cleared output for a broken embedded <script> in Minify (esbuild)",
      },
    );
    const minifyError = await readErrorText();
    // esbuild's embedded-JS syntax error is mapped through offsetToLineCol → a
    // line:col somewhere in the composed text. (Executor fallback per
    // <engine_error_facts> would downgrade THIS assertion to line-located only if
    // the input genuinely lacked a col; it does NOT — the col is present here.)
    assert(
      /\d+:\d+/.test(minifyError),
      `expected a line:col esbuild embedded-code error, got "${minifyError}"`,
    );

    // 3b. MALFORMED-HTML structure error via PRETTIFY (Prettier's html parser): a
    //     mismatched/orphan close tag the html parser REJECTS (verified: throws
    //     `Unexpected closing tag "div"` at 1:14, NOT auto-recovered). Distinct
    //     engine from esbuild. The composed error is LINE:COL (col CONFIRMED — do
    //     NOT accept line-only): the tool renders `1:14 Unexpected closing tag …`.
    const prettifyBtn = await $("button=Prettify");
    await prettifyBtn.click();
    await input.setValue("<div><span>hi</div>");
    await browser.waitUntil(
      async () => {
        const { output, role, hasError } = await readState();
        return role === "alert" && hasError && output === "";
      },
      {
        timeout: 15_000,
        timeoutMsg:
          "expected role=alert + cleared output for malformed HTML in Prettify (html parser)",
      },
    );
    const prettifyError = await readErrorText();
    assert(
      /^\d+:\d+ /.test(prettifyError),
      `expected a LINE:COL html-parser error (col confirmed, not line-only), got "${prettifyError}"`,
    );
    // CONCISE (D-13): Prettier's "It may happen…" explanation + spec URL are stripped
    // so the message fits without hover-only truncation.
    assert(
      !/It may happen|For more info|https?:\/\//i.test(prettifyError),
      `expected a concise error (no boilerplate/URL), got "${prettifyError}"`,
    );

    // 4. RECOVERY: a subsequent VALID paste in Prettify produces output again and
    //    the footer returns to role=status — proves the app NEVER crashed and
    //    recovered after BOTH error paths (D-11 "never a crash").
    await input.setValue("<p>ok</p>");
    await browser.waitUntil(
      async () => {
        const { output, role } = await readState();
        return output.trim().length > 0 && role === "status";
      },
      { timeout: 15_000, timeoutMsg: "expected recovery to valid output + role=status" },
    );

    // 5. NO-REMOTE (best-effort automated SC5 COMPLEMENT — NOT the authoritative
    //    gate). After the prettify+minify lazy-chunk loads have run, no resource
    //    should point at a remote host. NOTE: the spike runs against `tauri dev`
    //    (assets served from localhost:1420), so localhost/127.0.0.1 entries are
    //    EXPECTED; a CDN/remote fetch would be a DIFFERENT host and would fail here.
    //    This is a COMPLEMENT to the human Wi-Fi-off Network-tab gate + the durable
    //    33-04-OFFLINE-PROOF.md artifact — WKWebView native fetches at the OS layer
    //    are not all visible to resource-timing, so this is NOT a full replacement.
    const resources: string[] = await browser.execute(() =>
      performance.getEntriesByType("resource").map((e) => e.name),
    );
    const remote = resources.filter(
      (u) => /^https?:\/\//.test(u) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(u),
    );
    assert(
      remote.length === 0,
      "unexpected remote resource requests: " + remote.join(", "),
    );

    // 6. Copy affordance is a visible, focusable <button> — never hover-only (FMT-08).
    const copy = await $('button[aria-label="Copy output"]');
    assert(
      await copy.isDisplayed(),
      "Copy output button is not visible — hover-only copy is forbidden",
    );

    // 7. Screenshot the real WKWebView (the HRN-02 artifact for this tool).
    await saveScreenshot("html-formatter", "html-formatter-wkwebview.png");
  });
});
