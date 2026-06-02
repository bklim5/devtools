# Phase 4: Catalogue - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the remaining four tools — **Unix Time, JWT, Hash, UUID/ULID** — into the registry-driven shell's routed `<Outlet/>`, each under the **identical binding cross-cutting UX constraints already proven in Phase 3** (paste-instant, visible focusable copy ≤1 keystroke, status bar, WCAG-AA, layout-agnostic). This completes the six-tool v1 catalogue.

**In scope:**
- **TIME-01** — paste a unix timestamp (s/ms) → human-readable local + UTC datetimes, and the reverse (datetime → timestamp).
- **JWT-01** — paste a JWT → decoded header + payload (+ signature segment), malformed tokens reported clearly.
- **HASH-01** — input text/bytes → MD5 + SHA-1/256/384/512 digests (Web Crypto for SHA, JS lib for MD5).
- **UID-01** — generate UUIDs/ULIDs with one keystroke; decode a pasted UUID/ULID into its components.
- Cross-cutting **UX-01..05** applied to all four (already validated in Phase 3; carried forward, not re-litigated).

**Out of scope:**
- Native polish — global summon shortcut, tray, single-instance, window-geometry persistence (Phase 5, incl. SHL-05's deferred clause).
- Distribution / signing / auto-update (Phase 6).
- **Tool-scoped action palette** ("action-palette layer" mentioned in `design-and-plan.md` §line 297 / V2-01) — deferred, stays deferred.
- JWT **signature verification** (display-only this phase — see D-09).
- Protobuf decimal-byte-array input mode (backlog item, belongs to the Protobuf tool, not this phase).
- **No edits to the port-unchanged files** — `decoder.ts`/`bytes.ts`/`types.ts`/`registry.ts` internals and the 19 decoder tests are immovable. New tools add their own TDD cases.
</domain>

<decisions>
## Implementation Decisions

### Dependencies & scaffolding (cross-cutting)
- **D-01:** **MD5 — vendor a tiny, audited, zero-runtime-dep JS lib** (e.g. `js-md5`, a few KB), bundled offline (no network). Web Crypto deliberately omits MD5, and `design-and-plan.md` §line 130 explicitly concedes "MD5 needs a small JS lib." Do **not** hand-roll an MD5 primitive — risk with no gain. SHA-1/256/384/512 use **Web Crypto** (`crypto.subtle.digest`), native in both webviews.
- **D-02:** **ULID — hand-roll in-house** under `src/lib/` with its own tests (~Crockford base32 encode of a 48-bit timestamp + 80-bit `crypto.getRandomValues` randomness, plus decode). It's simple, spec-stable, and trivially unit-testable — fits the zero-dep ethos. **UUID v4/v7 use native `crypto`** (`crypto.randomUUID` for v4; `crypto.getRandomValues` + spec layout for v7). No `uuid`/`ulid` npm deps.
- **D-03:** **Date/time — native `Intl.DateTimeFormat` + `Date` only**, no date library. Sufficient for s/ms timestamp ↔ local/UTC datetime rendering and ISO output (TIME-01) and for humanizing JWT timestamp claims. Zero-dep, no network.
- **D-04:** **Promote shared scaffolding now.** Extract a shared `StatusBar` (currently inside `src/tools/base64/`) to a shared location and establish a thin reusable **"simple tool" layout + copy pattern** the four catalogue tools consume — so paste-instant input, the status bar (parse·bytes·errors·timing), and ≤1-keystroke focusable copy stay consistent across all six tools without per-tool duplication. Reuse the existing `useCopyFeedback` hook. **Migrate the Base64 (and, where it cleanly fits, Protobuf) status bar to the shared component** as part of this, keeping the Phase-3 refinement that `encoding` is an optional prop (shown only where encoding is auto-detected). Do not regress any Phase-3 behavior or its tests.

### Unix Time tool (TIME-01)
- **D-05:** **Auto-detect timestamp unit by magnitude, with a manual override toggle** — mirrors the Protobuf hex/base64 detect+override pattern (Phase 3 D-01) for product consistency. A digit-count/range heuristic classifies the pasted integer as **s / ms** (and plausibly **µs / ns**) targeting a sensible date range; the conversion runs instantly with no button; a small unit toggle lets the user force another unit. Empty input is the neutral state, not an error.
- **D-06:** **Reverse direction = an editable datetime/ISO field that derives the timestamp**, mirroring the forward pane (a two-way tool), **plus a live "now"** current unix time with ≤1-keystroke copy/insert. Fully satisfies TIME-01's "and the reverse." Always show **both local and UTC** readings on the forward side.

### JWT tool (JWT-01)
- **D-07:** **Decode = split on `.`, base64url-decode header + payload, pretty-print the JSON.** Reuse `src/lib/bytes.ts` base64url decoding (the engine already supports the base64url alphabet) — do not hand-roll base64 in the tool. The **signature segment is shown raw** (plus the `alg` from the header).
- **D-08:** **Malformed tokens are reported clearly, field-scoped** — wrong segment count, non-base64url segments, or non-JSON header/payload each surface an explicit error (consistent with the Phase-3 explicit-error pattern), never a silent failure or crash.
- **D-09:** **Display-only — no signature verification.** No secret/key input this phase; matches JWT-01's literal wording ("shows … the signature segment") and the offline "decode an unknown blob" motif. (Optional HMAC verify was considered and **deferred** — it needs key-input UX and a larger crypto surface.)
- **D-10:** **Humanize timestamp claims + flag validity.** Render `exp` / `iat` / `nbf` as readable datetimes (absolute + relative) using the same native date formatting as D-03, and **visibly flag an expired or not-yet-valid token**. Reuses the Unix Time formatting logic.

### Hash tool (HASH-01)
- **D-11:** **Input modes = UTF-8 text / hex / base64 via an input-encoding toggle**, feeding a single internal `Uint8Array` to the hashers — reuses `src/lib/bytes.ts` end-to-end exactly like the Base64 tool. Satisfies "text/bytes" literally; hashes arbitrary byte payloads, not just text.
- **D-12:** **Compute and show all five digests at once, stacked** — MD5, SHA-1, SHA-256, SHA-384, SHA-512 — each row with its own visible, focusable ≤1-keystroke copy. Paste once, see everything; no algorithm picker.
- **D-13:** **Hex digest output lowercase by default, with an uppercase toggle.** Lowercase matches `sha256sum`/`md5sum` convention; the toggle covers callers that need uppercase.
- **D-14:** **Web Crypto SHA digests are async** (`crypto.subtle.digest` returns a Promise) while MD5 is sync. Compute reactively on input change; keep the paste→all-digests path within the <2s budget (realistically instant for normal inputs). Debounce/large-input handling is Claude's discretion (D-19).

### UUID / ULID tool (UID-01)
- **D-15:** **Generate UUID v4 + UUID v7 + ULID.** v4 = random (`crypto.randomUUID`), v7 = time-ordered (increasingly common for DB keys), ULID = hand-rolled per D-02. Covers modern needs without sprawl.
- **D-16:** **Generate one on open; a single keystroke regenerates** (e.g. Enter, or a default-focused button) — satisfies UID-01's "one keystroke." An **optional count produces a batch list**, each entry copyable in ≤1 keystroke (plus a copy-all). 
- **D-17:** **Decode = auto-detect UUID vs ULID from the pasted string, then full breakdown.** For UUID: **version + variant** (+ the embedded timestamp for time-based versions like v1/v7). For ULID: the **decoded timestamp + randomness** components. Malformed input flagged like the other tools (D-08 pattern).

### Claude's Discretion
- **D-18:** Sidebar/registry **ordering** of the four new tools, their lucide icons, exact labels/keywords, and example/placeholder content.
- **D-19:** Hash **debounce / large-input** strategy and async-state UX (e.g. transient "computing…" affordance), within the <2s budget.
- **D-20:** Unit-toggle granularity for Unix Time (whether µs/ns ship beyond s/ms), datetime-field input format/parsing affordance (D-06), relative-time wording for JWT claims (D-10), batch-count control design (D-16), and per-tool layout/spacing — all within the locked decisions above and the design tokens in `design/DevTools Mockup.html`.

### TDD / harness expectation
- Per the binding harness, every plan passes the per-task gate **simplify → /codex:review → vitest+tsc → real-webview UI** in order; the decoder's **19 tests stay green**, the shared-StatusBar migration must not regress Phase-3 tests, and each new tool/lib adds its own TDD cases (the ULID and MD5-integration logic especially). Plans may run in parallel but none advances past the gates. Phase ends with human sign-off on a `tauri build` + a passing `gsd-ui-review` WCAG-AA audit.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### Product spec & catalogue intent
- `docs/design-and-plan.md` §lines 50-53 — the six-tool table: Unix Time / JWT / Hash / UUID-ULID rationale.
- `docs/design-and-plan.md` §line 130 — "Hashing uses Web Crypto for SHA-1/256/384/512 in both webviews; MD5 needs a small JS lib" (basis for D-01).
- `docs/design-and-plan.md` §line 297 — the Phase-3/Catalogue row; note the **action-palette layer is deferred** (V2-01), NOT part of this phase.
- `docs/design-and-plan.md` §9 — the binding cross-cutting UX constraints (paste-instant, copy-instant/no hover-only, status-bar contents, sparing accent, WCAG-AA) — apply unchanged to all four tools.
- `docs/harness-and-decisions.md` — build+verify harness (simplify → /codex:review → vitest+tsc → real-webview UI; phase-boundary human sign-off + WCAG-AA audit).

### Visual system (rebuild visuals against this; do NOT load its CDN fonts)
- `design/DevTools Mockup.html` — **note: the mockup contains NO dedicated layouts for these four tools** (verified — zero keyword hits). Only the shared design tokens apply: CSS vars `--bg-app`, `--accent`/`--accent-soft`/`--accent-line` (accent = selected/active state ONLY — Phase-3 D-08 rule carries forward), `--tx`/`--tx-2`/`--tx-3`, `--bd`/`--bd-2`, `--card`/`--card-2`, `--input-bg`, `--bad`; chip/toggle/copy-affordance styles; status-bar styling. Reuse the established tool look (cards, chips, status bar, focusable copy) from the Phase-3 tools for consistency.

### Code to build on / reuse
- `src/lib/bytes.ts` — **port-unchanged.** `utf8ToBytes`/`bytesToUtf8`, `bytesToBase64`/`base64ToBytes` (alphabet param incl. **base64url** — used by JWT decode D-07), `bytesToHex`/`hexToBytes`, `Base64Alphabet`. Hash input (D-11) and JWT decode (D-07) route through here.
- `src/tools/base64/Base64Tool.tsx`, `src/tools/base64/useBytesConvert.ts`, `src/tools/base64/StatusBar.tsx` — the **reference pattern** for a thin tool over `bytes.ts` (input-encoding toggle, single Uint8Array source of truth, status bar, focusable copy). `StatusBar.tsx` is the component to **promote to shared** (D-04); its `encoding` prop is already optional (Phase-3 refinement).
- `src/tools/protobuf-decoder/` — second reference: detect+override toggle pattern (D-05 mirrors its hex/base64 D-01), per-node copy, `copyAsJson.ts`. Its status bar (`ProtobufStatusBar.tsx`) is a candidate to fold into the shared component where it cleanly fits.
- `src/shell/useCopyFeedback.ts` — existing copy-feedback hook; reuse for all copy affordances (D-04/D-12/D-16).
- `src/lib/tools/registry.ts` + `src/lib/tools/types.ts` — **port-unchanged** single control plane. Each tool only swaps its registry `component` from the placeholder to the real component.
- `src/tools/unix-time/` — already scaffolded as a placeholder dir; the other three tools' registry entries (JWT, Hash, UUID/ULID) currently point at `makePlaceholder` (or need creating) under `src/tools/<id>/index.ts`.
- `src/lib/platform/` — `clipboard` (copy) + `store` (persistence). Tools use these, never `@tauri-apps/*` (FND-04). No persisted prefs are required by these four tools; any (e.g. hash casing, unit default) would go through `usePreferences`/`prefsStore`, never widening the `Store` seam directly.

### Prior phase decisions (consistency — read before planning)
- `.planning/phases/03-hero-protobuf-encoding-ux-constraints/03-CONTEXT.md` — the binding UX constraint decisions (D-15..D-18: paste-instant, no hover-only copy, status-bar contents, WCAG-AA, layout-agnostic) and the detect+override pattern (D-01/D-02) this phase mirrors; the StatusBar `encoding`-optional refinement.
- `.planning/phases/02-shell/02-CONTEXT.md` — registry-as-control-plane, persistence seam, layout-chrome-in-shell.
- `.planning/phases/01-scaffold-harness-proof/01-CONTEXT.md` — platform seam + macOS real-webview UI-gate driver (`scripts/e2e-spike.sh`).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/bytes.ts`** — full byte engine (UTF-8/hex/base64 incl. **base64url**, feature-detect polyfill, explicit errors). Powers Hash input modes (D-11) and JWT base64url decode (D-07); no new byte logic needed.
- **Base64 tool as the template** — `Base64Tool.tsx` + `useBytesConvert.ts` + `StatusBar.tsx` are the proven shape for a thin tool over `bytes.ts`; Hash and (structurally) JWT follow it. `StatusBar.tsx` is promoted to shared (D-04).
- **`useCopyFeedback`** — existing hook for ≤1-keystroke focusable copy across all output rows.
- **Detect+override pattern** — the Protobuf hero's hex/base64 toggle is the precedent for Unix Time's s/ms auto-detect+override (D-05).
- **Native platform crypto** — `crypto.subtle.digest` (SHA family), `crypto.randomUUID` (UUID v4), `crypto.getRandomValues` (UUID v7 + ULID randomness) — all native, offline, no deps.
- **`makePlaceholder` swap point** — each tool's registry `component` is the single line to change; sidebar/palette/router render whatever the registry points at (single control plane).

### Established Patterns
- **Registry-as-control-plane** + **HashRouter-only** — locked; tools just provide a `component`. No routing/sidebar work needed.
- **No `@tauri-apps/*` in tools** — clipboard/store via `src/lib/platform/` (FND-04).
- **Prefer in-house over libraries; no network at runtime** — drives D-02 (hand-roll ULID) and D-03 (native dates); the single justified exception is the vendored MD5 lib (D-01).
- **Layout chrome lives in the shell** — tool components are layout-agnostic responsive Tailwind (UX-05).

### Integration Points
- New/updated tool dirs under `src/tools/`: `unix-time/` (exists as placeholder), plus `jwt/`, `hash/`, `uuid-ulid/` (ids TBD by Claude, D-18) — each with `index.ts` (registry entry) + components + tests.
- Swap each tool's registry `component` from `makePlaceholder(...)` to the real component.
- New `src/lib/` modules: hand-rolled **ULID** (encode/decode) and **UUID v7** helper, each with tests; MD5 lib integration wrapped in a small hashing module alongside the Web Crypto SHA calls.
- Shared `StatusBar` (+ simple-tool layout/copy pattern) extracted to a shared location (e.g. `src/components/` or `src/shell/`); Base64 (and where clean, Protobuf) migrated to it.

### Constraints from existing architecture
- Do NOT touch `decoder.ts` / `bytes.ts` / `types.ts` / `registry.ts` internals — the 19 decoder tests are the immovable spec.
- The shared-StatusBar migration (D-04) must NOT regress Phase-3 tests or behavior (esp. the `encoding`-optional refinement).
- Do NOT widen the `Store` seam; any persisted preference goes through `usePreferences`/`prefsStore`.
</code_context>

<specifics>
## Specific Ideas

- **Consistency is the product value here.** Phase 4 is four small tools, not new risk — they win by feeling identical to the hero: paste→instant, ≤1-keystroke visible copy, the same status bar, the same accent-=-selection discipline. The shared scaffolding (D-04) and the mirrored detect+override pattern (D-05) exist to enforce that sameness.
- **Reuse over reinvention, with one deliberate exception.** Everything routes through `bytes.ts` and native `crypto`; the only vendored dep is a tiny MD5 lib (D-01), explicitly sanctioned by the spec.
- **The two-way tools (Unix Time, Hash, base64url for JWT) reuse the single-Uint8Array / single-source-of-truth idea** proven in Base64.
- **JWT and Unix Time share timestamp humanization** (D-03/D-10) — factor the date-formatting once.

</specifics>

<deferred>
## Deferred Ideas

- **JWT signature verification (optional HMAC secret input)** — considered for JWT-01; deferred (D-09). v1 is display-only; verification needs key-input UX + larger crypto surface. Revisit if users ask.
- **Tool-scoped action palette** ("decode clipboard as JWT", "copy SHA-256", "regenerate ULID") — V2-01, deferred (consistent with Phase 3's deferral).
- **Persisting per-tool preferences** (hash casing, default time unit, last-used UUID version) — left session-local by default unless a clear need emerges; would go through `usePreferences` if added.
- **Protobuf decimal-byte-array input mode** — backlog item from Phase-3 sign-off; belongs to the Protobuf tool, not this phase.
- **Window-geometry persistence + native polish** — Phase 5. **Distribution/signing** — Phase 6.

None of the above were scope creep — they surfaced as natural boundaries while scoping the four catalogue tools.

</deferred>

---

*Phase: 04-catalogue*
*Context gathered: 2026-05-31*
