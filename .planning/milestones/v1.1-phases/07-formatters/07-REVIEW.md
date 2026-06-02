---
phase: 07-formatters
reviewed: 2026-06-02T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/lib/format/types.ts
  - src/lib/format/json.ts
  - src/lib/format/xml.ts
  - src/components/ResizableSplit.tsx
  - src/components/StatusBar.tsx
  - src/components/FormatterView.tsx
  - src/tools/json-formatter/index.ts
  - src/tools/json-formatter/JsonFormatterTool.tsx
  - src/tools/xml-formatter/index.ts
  - src/tools/xml-formatter/XmlFormatterTool.tsx
  - src/lib/tools/registry.ts
  - src/tools/protobuf-decoder/ProtobufDecoder.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

The formatters meet the phase's binding security constraints: both `formatJson` and `formatXml` use only native engines (`JSON`, `DOMParser`/`XMLSerializer`) with zero runtime dependencies; the XML path uses `application/xml` and the browser/WKWebView/jsdom `DOMParser`, which does not resolve external entities or fetch external DTDs (no XXE / billion-laughs reachable, T-07-08/09). Output is rendered into a read-only `<textarea>` (no `innerHTML`/`dangerouslySetInnerHTML`), so the parsed XML/JSON is never injected as HTML (T-07-05). Copy is a real, visible, focusable `<button aria-label="Copy output">` with no hover gate (FMT-08), the resize separator is keyboard-operable with visible focus, and the StatusBar is `role="status" aria-live="polite"`. No hardcoded secrets, no `eval`, no network. Test and e2e coverage is solid, including a real-WKWebView gate for engine-specific error-message shapes.

The issues found are correctness/fidelity gaps, not security holes. The most material is that the XML formatter serializes `doc.documentElement` only, silently dropping the XML declaration and any document-level comments/PIs that sit outside the root element — a round-trip fidelity bug for real-world XML. The two other warnings concern a timing measurement that effectively always reads ~0 ms and a brittle error-offset heuristic. Info items are minor robustness and dead-prop notes.

## Warnings

### WR-01: XML formatter drops the XML declaration and any top-level nodes outside the root element

**File:** `src/lib/format/xml.ts:131` and `:133`
**Issue:** Both the minify and prettify branches serialize `doc.documentElement` rather than the document. Anything outside the root element — the XML declaration (`<?xml version="1.0"?>`), a `<!DOCTYPE …>`, and document-level comments or processing instructions — is silently discarded from the output. Verified against the same engine family used at runtime:

```
input:  <?xml version="1.0"?>\n<!-- top level comment -->\n<root><a>1</a></root>
serializeToString(doc.documentElement) => "<root><a>1</a></root>"   // prolog + comment lost
serializeToString(doc)                 => "<!-- top level comment --><root><a>1</a></root>"
```

This contradicts the module's own stated contract ("PRESERVING comments, CDATA, processing instructions", FMT-06) for the document-level case, and a user who pastes a declaration-prefixed document gets it stripped with no error or warning — a quiet data-fidelity loss in a "validate/format, don't mutate" tool.
**Fix:** Serialize from the document, indenting top-level children at depth 0. The XML declaration is not exposed as a child node by `DOMParser`, so it must be re-emitted explicitly if the input had one (or documented as intentionally dropped). For the comment/PI case:

```ts
// minify
stripInsignificantWhitespace(doc);
output = Array.from(doc.childNodes)
  .filter((n) => !isWhitespaceText(n))
  .map((n) => serializer.serializeToString(n))
  .join("");

// prettify
output = Array.from(doc.childNodes)
  .filter((n) => !isWhitespaceText(n))
  .map((n) => prettyNode(n, 0, indentUnit(opts.indent), serializer))
  .join("\n");
```

If the team's intent is genuinely "root element only", make that explicit in the module doc and a test, and decide whether to preserve a leading `<?xml …?>` declaration (common in pasted payloads). Either way the current silent drop should not stand without a recorded decision.

### WR-02: StatusBar timing always reports ~0 ms because it measures around a React state setter, not the format work

**File:** `src/tools/json-formatter/JsonFormatterTool.tsx:42-46` (and `src/tools/xml-formatter/XmlFormatterTool.tsx:41-45`)
**Issue:** `onInputChange` brackets `performance.now()` around `setInput(raw)`. `setInput` only schedules a React re-render; the actual `formatJson`/`formatXml` call happens later during render (line 27 / line 26). So `timingMs` measures the cost of enqueuing a state update (~0.000 ms), not the format pass it purports to report. The status bar's timing readout is therefore meaningless — it will read `0.0 ms` even for large/expensive inputs, undermining the "<2s, feels instant" verification signal.
**Fix:** Measure around the pure call, which is where the work is:

```ts
const t0 = performance.now();
const result = formatJson(input, { indent, minify, sortKeys });
const timingMs = performance.now() - t0;
```

Then drop the `timingMs` state and the timing logic from `onInputChange`. Computing it during render is consistent with the "derive synchronously every render" comment already in the file, and removes a useless state variable.

### WR-03: V8 snippet-offset heuristic can mis-locate the error when the quoted snippet repeats in the input

**File:** `src/lib/format/json.ts:93` (`input.indexOf(snippet)`)
**Issue:** When falling back to V8's snippet form, the code locates the failure via `input.indexOf(snippet)` — the *first* occurrence. If the quoted context snippet appears earlier in the input than the actual failure site (common with repeated keys/values, e.g. `{"a":1,"a":1,"a":}`), the reported line:col points at the wrong location. This is a best-effort path (the doc acknowledges it), so it is a Warning rather than Critical, but a confidently-wrong line:col is worse than none for a developer chasing a syntax error.
**Fix:** Prefer the explicit-offset and explicit-line/column branches (already first), and when forced into the snippet branch, bias toward the *last* occurrence (`input.lastIndexOf(snippet)`), since V8's snippet is anchored at/after the failure. Alternatively, treat a non-unique snippet match as "no reliable offset" and return `{}` so the UI shows the message without a misleading position. Add a regression test with a repeated-snippet input.

## Info

### IN-01: ResizableSplit clamp inverts when `min` > 0.5

**File:** `src/components/ResizableSplit.tsx:31-34`
**Issue:** `clamp = Math.min(1 - min, Math.max(min, r))`. With the default `min = 0.2` this is correct, but the prop is public; passing `min > 0.5` makes the lower bound exceed the upper bound, so `Math.min(1-min, …)` wins and the pane snaps to `1-min` (e.g. `min=0.6` clamps a centered drag to `0.4`). Not reachable from current call sites, hence Info.
**Fix:** Guard the prop, e.g. `const m = Math.min(min, 0.5);` before clamping, or document the `0..0.5` precondition on the prop.

### IN-02: Stale registry comment describes the opposite of the current state

**File:** `src/lib/tools/registry.ts:14-19`
**Issue:** The block comment says "three real tools below are registered enabled:false ID-reserving stubs … so ENABLED_TOOLS is currently EMPTY". The array now holds eight tools all without `enabled:false`, so `ENABLED_TOOLS` is non-empty and the router no longer falls back to the bare shell. The comment is misleading to the next reader.
**Fix:** Update the comment to reflect that the eight tools are live and enabled, and drop the obsolete walking-skeleton/stub narrative.

### IN-03: FormatterView accepts `encoding`/`timingMs`-style status but never forwards `encoding`; protobuf passes `timingMs` that StatusBar shows but is real, fine

**File:** `src/components/FormatterView.tsx:31-37` and `:203-209`
**Issue:** `FormatterStatus` does not include `encoding` (correct for formatters), but note the formatters pass `timingMs` into the StatusBar (line 208) sourced from the WR-02 measurement, so the rendered "0.0 ms" chip is a visible symptom of WR-02. No separate fix needed beyond WR-02; flagged so the timing chip is not mistaken for correct once WR-02 is addressed.
**Fix:** None independent of WR-02. After WR-02, confirm the chip shows a plausible non-zero value for large inputs.

### IN-04: `byteLen` is duplicated across four modules

**File:** `src/lib/format/json.ts:18-20`, `src/lib/format/xml.ts:25-27`, `src/tools/json-formatter/JsonFormatterTool.tsx:14-16`, `src/tools/xml-formatter/XmlFormatterTool.tsx:14-16`
**Issue:** The identical `new TextEncoder().encode(s).length` helper is defined in four files (the tools only use it for the error-path input byte count). Minor duplication; the contract comment already notes byte length "matches how the StatusBar delta is measured", so a single shared helper would keep them provably in sync.
**Fix:** Export a `byteLen` from `src/lib/format/types.ts` (or a small `format/bytes.ts`) and import it in all four sites. Low priority — purely a DRY/maintainability nit.

---

_Reviewed: 2026-06-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
