# DevTools Desktop App — Design & Engineering Plan

**Status:** Ready for review
**Stack:** Tauri 2 + Vite + React + TypeScript
**Positioning:** A fast, offline, keyboard-driven decoder for the messy bytes developers
actually see at work. **Schema-less Protobuf is the hero feature**, supported by a tight set
of high-frequency transforms. Not a catalogue.

**Companion artifacts** (alongside this doc):
- `devtools/` — runnable frontend scaffold (Vite + React; the Tauri shell is the next step).
- `devtools/src/lib/protobuf/decoder.ts` — hardened wire-format decoder, 19 tests passing.
- `design/DevTools Mockup.html` (+ `devtools-ui.jsx`, `tweaks-panel.jsx`) — **canonical UI design
  from Claude Design**. The HTML/CSS spells out the visual system; `devtools-ui.jsx` carries the
  component structure and sample data. Production implementation must match this visual output;
  the JSX is a prototype, not production code. Two constraints from the design that aren't
  obvious from the visuals alone are lifted into §9 below as binding requirements.
- `devtools-mockup.html` — earlier static reference (descriptive-sidebar layout). Superseded by
  the Claude Design files above; retained only for historical context.

---

## 1. Goals & success criteria

The product wins on **speed and confidence**, not breadth. v1 is judged against five concrete
workflow criteria, not feature count:

1. Paste-to-interpretation in **under 2 seconds**, from clipboard to a usable result.
2. **No-mouse tool switching.** Cmd+K, type a few characters, Enter.
3. **One-keystroke copy** of any derived result. Every output region addressable.
4. **Opens to last-used or summoned tool.** No "pick a tool" friction on launch.
5. **No network, no account, no setup.** Offline by design.

### Non-goals (v1)
- No cloud sync, accounts, or licensing/payments (a registry seam is reserved with **zero
  UX manifestation** — see §6).
- No mobile **UI** in v1, but the architecture must not preclude iOS/Android later (§10).
- No plugin marketplace or third-party tool loading.
- No SSR or server runtime — the app is a static SPA inside a webview.

---

## 2. v1 catalogue (six tools)

Six tools. Anything beyond this is deferred.

| Tool | Why it earns its place |
|---|---|
| **Protobuf Decoder** *(hero)* | Genuinely differentiated; schema-less + offline + explorable is a sharper reason to install than anything else in the category |
| **Base64 / Hex / Bytes** | Modern `Uint8Array.toBase64`/`fromBase64` integration is the second-most-novel piece; daily-use tool |
| **Unix Time Converter** | Workhorse; expected in every dev-tools app for a reason |
| **JWT Debugger** | High-frequency debugging artifact; matches the "paste unknown blob, get structure" motif |
| **Hash Generator** | MD5 / SHA family; Web Crypto covers the heavy lifting |
| **UUID / ULID Generator + Decoder** | One-keystroke utility; benefits from the palette nav model |

**Deferred:** JSON / YAML / XML / HTML / CSS / JS beautifiers, JSON↔CSV / YAML conversions,
URL encode/decode, URL parser, regex tester, text diff, number-base converter, lorem ipsum,
QR codes, HTML preview, HTML entities, backslash escape, string inspector. All commodities;
shipping them mediocrely would dilute the product wedge.

### Future paid candidates (architectural seam only, no v1 UX)
Saved workspaces / history · custom tool chains or pipelines · **schema-aware Protobuf**
(imported `.proto` sets) · team-shared snippets · advanced inspectors (HAR, OpenAPI, Kafka
payloads, gRPC reflection, binary diff) · optional online AI-assisted explanation, clearly
separated from offline tools. **Basic converters stay free forever.**

---

## 3. Stack rationale

**Tauri over Electron / SwiftUI.** SwiftUI can't target Windows, so it's out the moment
cross-platform matters. Versus Electron, Tauri uses the OS webview (WKWebView on macOS,
WebView2 on Windows) rather than bundling Chromium — far smaller binaries and lower memory,
the right shape for a utility that should feel instant.

**Vite + React over Next.js.** In a Tauri app the frontend is a static SPA served from the
filesystem. Next.js's distinctive value (SSR, server components, API routes, server actions)
is disabled or impossible under static export, leaving us using ~5% of the framework. The
skills that drive velocity (React, TypeScript, Tailwind) transfer to Vite identically; Vite
is also the conventional, lower-friction Tauri pairing. Reversible at low cost — the tool
registry and tool logic are framework-agnostic.

**`HashRouter`, not `BrowserRouter`.** Tauri serves the build as static files; a path like
`/tools/base64` would 404 on reload with no server to rewrite. Hash routes (`#/tools/base64`)
need no rewrite, and a global shortcut or tray item can deep-link straight to a tool.

---

## 4. Navigation: Cmd+K command palette as primary

**Primary navigation is Cmd+K** (Ctrl+K on Windows), opening a fuzzy-match palette over the
registry. The sidebar remains for discoverability and serves as a visual map of available
tools, but productivity flows live in the palette.

The palette ships in two scope layers:

- **Phase 1 — tool switcher.** Cmd+K → type → Enter selects the matching tool. Fuzzy match
  over `name + keywords + description`. Recent-tool memory. Closes ~80% of the
  productivity-user value on its own.
- **Phase 2–3 — action palette.** Tool-scoped actions ("copy as base64url", "decode clipboard
  as protobuf", "reinterpret all LEN as packed varints") registered via the tool's
  `shortcuts` array (§6). Tied directly to the "copy result instantly" workflow target.

Sidebar uses **compact mode by default** — icon + tool name only. Descriptions appear in the
palette and in search results, where they earn their place. Detail mode is a preference.

---

## 5. Architecture

```
+-------------------------------------------------------------+
|                     Tauri application                       |
|  +----------------------+      IPC       +----------------+ |
|  |   Webview (frontend) | <------------> |  Rust "core"   | |
|  |  Vite + React SPA    |   invoke()/    |  - window mgmt | |
|  |  - tool registry     |   events       |  - clipboard   | |
|  |  - TS tool logic     |                |  - global hotkey| |
|  |  - Web Crypto, etc.  |                |  - tray / menu | |
|  +----------------------+                |  - auto-update | |
|       WKWebView (mac) / WebView2 (win)    +----------------+ |
+-------------------------------------------------------------+
```

**Where logic lives.** Tool transforms are pure TypeScript in the frontend — small inputs,
mature npm libs, zero IPC overhead, full skill reuse. Rust handles only OS-level capabilities
(clipboard, global shortcut, tray, single-instance, auto-update) and is otherwise thin plugin
wiring. The "no Rust experience" concern is contained by construction — the Rust surface area
is small and mostly declarative.

Hashing uses Web Crypto for SHA-1/256/384/512 in both webviews; MD5 needs a small JS lib.

---

## 6. Tool plugin architecture (registry as control plane)

Every tool implements one interface; one registry is the single source of truth. Sidebar,
palette, router, future usage ranking, and any future paid gating all derive from it.

```ts
export interface ToolDefinition {
  id: string;                       // stable, URL-safe; route segment
  name: string;
  description: string;
  category: ToolCategory;
  keywords: string[];               // powers palette + search
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType | LazyComponent;  // lazy for non-default-startup tools
  enabled?: boolean;
  status?: "stable" | "experimental";
  premium?: boolean;                // RESERVED — zero UX manifestation in v1
  shortcuts?: ToolShortcut[];       // tool-scoped palette actions (Phase 2-3)
}
```

Adding a tool, end to end: write `src/tools/<name>/index.tsx` exporting a `ToolDefinition`,
add one import + one array entry to `registry.ts`. Sidebar, palette, and route appear
automatically.

`premium` is an architectural reservation, not a feature — there are no badges, no upsells,
no gates in v1. The field exists so adding licensing later is a registry change, not a
refactor. `lazy` (a `() => Promise<{default: Component}>` form of `component`) lets
non-startup tools defer bundle cost until first open, which matters as the catalogue grows.

---

## 7. Hero feature: schema-less Protobuf decoder

### What it does
Paste hex or base64 bytes; get a recursive field tree with **all viable interpretations
surfaced and the user picking between them**. Walks the wire format directly, no `.proto`
required. Wire types 0/1/2/5 supported; groups (3/4) surfaced as errors, not crashed on.

### The interpretation model
Schema-less LEN decoding is fundamentally ambiguous — a LEN payload could be a string,
bytes, a sub-message, or packed repeated values of an unknown scalar type. The decoder
computes **every plausible reading** and the UI lets the user resolve the ambiguity per
node:

- `message` — recursive sub-message parse that consumes the buffer exactly
- `string` — strict UTF-8 (fatal mode)
- `bytes` — always available, hex view
- `packed-varints` — clean varint stream consuming the buffer
- `packed-i32` — length a positive multiple of 4
- `packed-i64` — length a positive multiple of 8

VARINT values also show their zigzag (sint) and signed int64 readings.

### Hardening
- **Recursion depth bounded** (`MAX_DEPTH = 64`). Hostile nested LENs cannot blow the stack;
  past the limit, message interpretations stop being offered but the top-level parse still
  succeeds.
- **Payload size bounded** (`MAX_PAYLOAD_BYTES = 16 MiB`, top-level only). DoS-by-paste guard.
- **64-bit precision via BigInt** end to end. Varints exceeding `Number.MAX_SAFE_INTEGER`
  preserve full precision.
- **No infinite loops by construction.** The main loop consumes ≥1 byte per iteration; the
  varint reader bails after 10 continuation bytes.

### Test bar — 19 vitest cases, all passing
- **7 happy-path** — canonical `{1:150}`, string LEN, nested message, zigzag, I32 float,
  I64 double, BigInt at `2^53 + 1`.
- **4 error cases** — truncated varint, unsupported (group) wire type, field number 0,
  runaway varint with 11 continuation bytes.
- **2 hardening** — oversize payload rejected; deep-nesting completes without crash and caps
  message interpretation at `MAX_DEPTH`.
- **3 packed-repeated** — packed varints recognised, packed fixed32 recognised, non-multiple-of-4
  correctly excluded.
- **1 fuzz** — 3000 seeded random byte buffers; every result is either a parse or an `Error`
  instance (no crashes, no hangs). Sanity-checked that both outcomes occur.
- **2 golden composites** — hand-verified mixed-wire-type message; Person-shaped message.

### Library choice: hand-rolled over `protobufjs`
~295 lines, zero deps. `protobufjs` is schema-oriented; its low-level `Reader` would save
~15 lines of varint reading but bring nothing else relevant — the product *is* the
schema-less heuristics, the interpretation model, and the ambiguity UI, none of which come
from a library. For a future schema-aware mode, **`protobuf-es`** is the recommended library
(modern, Buf-maintained, ESM-aligned); the hand-rolled walker then becomes the no-schema
fallback. The two coexist cleanly.

---

## 8. Second feature: `Uint8Array` ⇄ base64 / base64url / hex

Feature-detects the modern `Uint8Array.prototype.toBase64`/`fromBase64`/`toHex`/`fromHex` APIs
and falls back to `btoa`/`atob` plus hand-rolled hex. Internal representation is `Uint8Array`
throughout — strings live only at the I/O boundary. Encoding errors are explicit, never
silent.

Edit any of text / base64 / hex; the other two derive. Alphabet toggle for base64 vs base64url.

---

## 9. UX constraints

Non-negotiable. Every tool must satisfy these — they're constraints, not goals:

- **Paste-transforms-instantly.** Cmd+V in any tool's primary input triggers the transform
  with no separate "decode" button for the common case.
- **Copy-result-instantly.** Every output region has a visible, focusable copy affordance;
  the keyboard path from result to clipboard is at most one combo. The Claude Design mockup
  exposes a `hover` copy mode as a variant; **`hover` must not ship** — hidden-until-hover
  affordances are not keyboard-reachable and break this constraint. Production options are
  `always` (icon button always visible) and `inline` (text link).
- **Resizable panes** on tools with input/output split (Protobuf especially — payloads vary
  from short to deeply nested).
- **Sparing accent.** The blue is reserved for "currently selected/active" only — no
  decorative use. Specifically: the per-field `#N` number in the decoded tree must use a
  neutral colour, not the strong accent, even though the design mockup currently shows it in
  accent blue. Concurrent uses of strong accent (active sidebar item, active interpretation
  chip, active example chip, `#N` numbers, etc.) compete for attention; reserving the strong
  accent for selection state keeps the focal path clean.
- **All viable interpretations surfaced.** Every LEN field's interpretation chips must reflect
  what `decoder.ts` actually computes — i.e. `message` / `string` / `bytes` **plus**
  `packed-varints` / `packed-i32` / `packed-i64` when those parses are structurally valid.
  The current Claude Design `FIELDS` data model under-represents this (chips only show
  message/string/bytes); the production component must drive its chips from the decoder's
  `LenInterpretation` object directly, not from a hand-curated subset.
- **Dense layout.** Empty space earns its place; output regions, metadata, errors, and copy
  controls occupy the available real estate.

**Status bar contents:** parse state · byte count · current encoding · errors · timing.

**Defaults to ship** (the design mockup's `TWEAK_DEFAULTS` are the source of truth, with the
constraints above applied): `tree: rows` · `copyMode: always` · `density: comfortable` ·
`sidebar: compact` · `palette: off-by-default-but-bound-to-⌘K` · `premium: false`. The
experimentation harness (`tweaks-panel.jsx`) is a Claude Design dev tool and is not part of
the production build.

---

## 10. Future extension: mobile (iOS / Android)

Not a v1 deliverable. Tauri 2 supports iOS and Android from the same project, so the door
stays open cheaply **if** two disciplines are adopted from commit one:

1. **Tool components are layout-agnostic.** Tools render content; layout chrome lives only
   in the shell (`App`, `Sidebar`). The mobile path becomes "swap the sidebar for a drawer"
   — tools reflow automatically.
2. **Responsive Tailwind everywhere.** `sm:`/`md:`/`lg:` utilities; no fixed widths in tool
   UIs. Near-zero cost now, expensive to add later.

All tool logic ports unchanged (it's webview TypeScript). Desktop-only native features
(global shortcut, tray) are platform-gated and no-op on mobile. Caveats when pursued: Tauri
mobile is younger than its desktop support; iOS/Android toolchains apply; Android WebView
fragmentation makes the feature-detect-and-polyfill discipline matter more.

---

## 11. Milestones

Relative sizing, not calendar estimates.

| Phase | Scope | Size |
|---|---|---|
| **0. Scaffold** | `create-tauri-app` (Vite+React+TS), HashRouter wired, dark theme, window renders on mac + win. **Distribution spike** — produce a signed test build on each OS to surface code-signing surprises early. | S |
| **1. Shell** | Sidebar (compact mode), **Cmd+K command palette (tool-switcher)**, registry, **clipboard plugin wired**, **prefs persistence** (theme, last-tool, window geometry), shared `TransformTool` primitives. | M |
| **2. Hero + #2** | **Protobuf decoder** polished end-to-end (19-test bar; resizable panes; packed-repeated UI; status bar). **Bytes / base64 / hex** with feature-detect polyfill. §1 workflow targets must hold for both. | M |
| **3. Catalogue** | Unix Time, JWT, Hash, UUID/ULID under the same workflow constraints. **Action-palette layer** (tool-scoped shortcuts). | M |
| **4. Native polish** | Global shortcut to summon; tray/menu; single-instance. | S |
| **5. Distribution** | Code signing + notarisation (mac), signing (win), DMG/MSI, auto-updater wired. | M |

Phases 0–2 prove the architecture end-to-end against the hero feature — the riskiest path
goes first.

---

## 12. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Webview JS API gaps (e.g. `toBase64`) | Med | Feature-detect + polyfill; never assume newest APIs |
| Webview rendering differences mac vs win | Med | Test both early (Phase 0); avoid bleeding-edge CSS |
| Rust learning curve | Low | Logic in TS; Rust is plugin wiring |
| Code-signing / distribution surprises | Med | **Spike in Phase 0** (signed test build); real polish in Phase 5 |
| Schema-less protobuf mis-inference | Med | Surface all viable interpretations; user picks per node |
| Hostile / oversize protobuf input | Med | `MAX_DEPTH` + `MAX_PAYLOAD_BYTES` guards; fuzz-tested at 3000 iterations |
| Scope drift back toward "catalogue" | Med | Six v1 tools, full stop; future list is deferred, not promised |

---

## 13. Implementation status

A **runnable frontend scaffold** exists in `devtools/`. The Tauri shell (`src-tauri/`) is the
next step and is not yet present.

**Verified by execution:**
- `decoder.ts` — 295 lines, zero deps, with every hardening from §7. **19/19 vitest cases
  pass**, including the 3000-iteration random-byte fuzz.
- `bytes.ts` — base64 / base64url / hex round-trips checked, including the standard ↔
  url-safe mapping (`+/+/` ↔ `-_-_`).
- `ToolDefinition` carries the extended fields (`status`, `premium`, `shortcuts`, `lazy`).
- Protobuf tool UI surfaces packed-varint / packed-i32 / packed-i64 interpretations alongside
  message / string / bytes, as toggle pills the user picks between.

**Built but not yet browser-rendered:** the React components (`App`, `Sidebar`, router, tool
UIs). Standard wiring; depends on a Vite project + Tailwind to preview. The Cmd+K command
palette is **designed but not yet implemented** — Phase 1 work.

---

## 14. Open questions for the reviewer

1. Is **Linux** an explicit v1 packaging target, or best-effort?
2. **Action-palette scope** (Phase 2–3): which tool-scoped actions belong on day one
   ("decode clipboard as protobuf", "copy as base64url", "reinterpret all LEN as X")?
3. Where to draw the line between `status: "stable"` and `"experimental"` for v1's six tools
   — Protobuf is stable by definition; do any others warrant the experimental badge initially?
4. **Accessibility floor for v1.** The Claude Design mockup has no visible focus indicators
   in its CSS, communicates disabled chips via opacity alone, and uses `--tx-3 (#686d77)` on
   the dark window background — borderline WCAG AA for body text. What's the acceptable floor
   for v1 ship: WCAG AA across the board, a documented subset, or "fix in flight"?
5. **Self-hosted fonts.** The mockup loads IBM Plex Sans + JetBrains Mono from Google Fonts,
   which violates the "no network" non-goal. Confirm the production build bundles both
   locally (and licensing checks out for redistribution in a desktop binary).
