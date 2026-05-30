# Requirements: DevTools

**Defined:** 2026-05-30
**Core Value:** Paste an unknown blob → get a usable, explorable interpretation in under 2 seconds, offline, without the mouse.

## v1 Requirements

Requirements for the initial macOS release. Each maps to exactly one roadmap phase.

### Foundation (FND)

- [x] **FND-01**: Tauri 2 + Vite + React + TS project builds and launches a dark window on macOS from a single repo
- [x] **FND-02**: `react-router` HashRouter wired (no BrowserRouter); unknown routes redirect to the first tool
- [x] **FND-03**: Verified `src/lib/` (decoder, bytes, tool types, registry) ported unchanged with all **19 decoder vitest cases passing**
- [x] **FND-04**: `src/lib/platform/` capability seam exists; tools access clipboard/store/shortcuts through it, never importing `@tauri-apps/*` directly
- [x] **FND-05**: IBM Plex Sans + JetBrains Mono self-hosted (vendored, SIL OFL); no network/CDN font loading at runtime

### Harness (HRN)

- [x] **HRN-01**: A walking-skeleton (trivial) feature exercises the full per-task gate end-to-end: `/codex:review` → `vitest`+`tsc` → real-webview UI verification
- [x] **HRN-02**: macOS real-webview UI automation path is proven (community WebDriver plugin spike) OR the documented `screencapture`+`chrome-devtools-mcp` fallback is in place, recorded in `docs/phase-0-notes.md`
- [x] **HRN-03**: Per-task Definition of Done (review→unit→ui) and per-phase human sign-off are enforced for every subsequent phase; parallel plans never bypass the gates
- [x] **HRN-04**: `tauri build` produces a runnable macOS bundle; build verification runs at each phase boundary

### Shell (SHL)

- [x] **SHL-01**: Sidebar (compact mode: icon + name) renders, generated from the tool registry <!-- 02-04: registry-driven Sidebar; Task-4 human-verify approved 2026-05-30 -->
- [x] **SHL-02**: ⌘K command palette opens, fuzzy-matches over name+keywords+description, and Enter switches tools (no mouse) <!-- 02-04: ⌘K CommandPalette (rankTools + ↑/↓+Enter no-mouse); Task-4 human-verify approved 2026-05-30 -->
- [x] **SHL-03**: Command palette remembers and surfaces recently-used tools
- [x] **SHL-04**: Registry is the single source of truth — adding a tool (file + one registry entry) makes sidebar, palette, and route appear automatically <!-- 02-01: registry now populated (3 tools enabled), router derives routes from ENABLED_TOOLS; sidebar/palette consumers land in 02-04 -->
- [~] **SHL-05** (PARTIAL): Preferences persist across restarts: theme, last-used tool, ~~window geometry~~, Protobuf tree style <!-- 02-01: real on-disk Store seam delivered (plugin-store + localStorage); theme/last-used/recents persistence wired in 02-03. WINDOW GEOMETRY deferred to Phase 5 (D-11); Protobuf tree-style key written by Phase 3. Do NOT mark fully Complete at the Phase 2 boundary. -->
- [x] **SHL-06**: App opens to the last-used or summoned tool with no "pick a tool" step

### Protobuf Decoder — hero (PRO)

- [ ] **PRO-01**: User pastes hex or base64 bytes and the field tree renders instantly (no decode button)
- [ ] **PRO-02**: Recursive field tree walks the wire format with no `.proto`; wire types 0/1/2/5 supported, groups (3/4) surfaced as errors not crashes
- [ ] **PRO-03**: Every LEN field's interpretation chips are computed directly from the decoder's `LenInterpretation` — message/string/bytes **plus** packed-varints/packed-i32/packed-i64 when structurally valid
- [ ] **PRO-04**: User can resolve interpretation ambiguity per node by selecting a chip; VARINT nodes also show zigzag + signed int64 readings
- [ ] **PRO-05**: Input/output panes are resizable
- [ ] **PRO-06**: Tree renders as cards by default, with a persisted rows/cards format toggle
- [ ] **PRO-07**: `#N` field numbers render neutral (not accent); strong accent reserved for selected/active state only

### Encoding — Base64/Hex/Bytes (ENC)

- [ ] **ENC-01**: Editing any of text / base64 / hex derives the other two; internal representation is `Uint8Array`
- [ ] **ENC-02**: Modern `Uint8Array` base64/hex APIs used when present, with feature-detect polyfill fallback; encoding errors are explicit
- [ ] **ENC-03**: Alphabet toggle switches base64 vs base64url

### Unix Time (TIME)

- [ ] **TIME-01**: User pastes a unix timestamp (s/ms) and sees human-readable local + UTC datetimes, and the reverse

### JWT Debugger (JWT)

- [ ] **JWT-01**: User pastes a JWT and sees decoded header + payload (and signature segment), with malformed tokens reported clearly

### Hash Generator (HASH)

- [ ] **HASH-01**: User inputs text/bytes and gets MD5 + SHA-1/256/384/512 digests (Web Crypto for SHA, JS lib for MD5)

### UUID / ULID (UID)

- [ ] **UID-01**: User can generate UUIDs/ULIDs with one keystroke, and decode a pasted UUID/ULID into its components

### Cross-cutting UX constraints (UX)

- [ ] **UX-01**: Every tool's primary input transforms instantly on paste (Cmd+V)
- [ ] **UX-02**: Every output region has a visible, focusable copy affordance reachable in ≤1 keystroke (no hover-only copy)
- [ ] **UX-03**: Every tool shows a status bar: parse state · byte count · current encoding · errors · timing
- [ ] **UX-04**: WCAG AA across the board — visible focus indicators, AA text contrast, disabled state not signalled by opacity alone
- [ ] **UX-05**: Tool components are layout-agnostic (no fixed widths; responsive Tailwind) so layout chrome lives only in the shell

### Native polish (NAT)

- [ ] **NAT-01**: A global keyboard shortcut summons/focuses the app from anywhere (macOS)
- [ ] **NAT-02**: Tray/menu presence and single-instance behavior (second launch focuses the existing window)

### Distribution (DST)

- [ ] **DST-01**: macOS build is code-signed and notarised, packaged as a DMG
- [ ] **DST-02**: Auto-updater is wired and verifies updates

## v2 Requirements

Deferred; tracked but not in the current roadmap.

### Action palette & advanced (V2)

- **V2-01**: Tool-scoped action palette (e.g. "decode clipboard as protobuf", "copy as base64url", "reinterpret all LEN as packed varints") via each tool's `shortcuts` array
- **V2-02**: Windows + Linux build, verification, signing, and packaging

## Out of Scope

| Feature | Reason |
|---------|--------|
| JSON/YAML/XML beautifiers, conversions, URL tools, regex, diff, etc. | Commodity tools; dilute the product wedge. Deferred, not promised |
| Cloud sync / accounts / licensing / payments | Offline by design; `premium` registry seam reserved with zero v1 UX |
| Mobile (iOS/Android) UI | Architecture stays open (layout-agnostic + responsive); no v1 mobile UI |
| Schema-aware Protobuf (`.proto` imports) | Future paid candidate; v1 is schema-less only |
| Plugin marketplace / third-party tool loading | Not the product |
| SSR / server runtime | App is a static SPA in a webview |

## Traceability

Phase mapping finalized by the roadmapper. Every v1 requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 (Scaffold + Harness Proof) | Complete |
| FND-02 | Phase 1 (Scaffold + Harness Proof) | Complete |
| FND-03 | Phase 1 (Scaffold + Harness Proof) | Complete |
| FND-04 | Phase 1 (Scaffold + Harness Proof) | Complete |
| FND-05 | Phase 1 (Scaffold + Harness Proof) | Complete |
| HRN-01 | Phase 1 (Scaffold + Harness Proof) | Complete |
| HRN-02 | Phase 1 (Scaffold + Harness Proof) | Complete |
| HRN-03 | Phase 1 (Scaffold + Harness Proof) | Complete |
| HRN-04 | Phase 1 (Scaffold + Harness Proof) | Complete |
| SHL-01 | Phase 2 (Shell) | Complete |
| SHL-02 | Phase 2 (Shell) | Complete |
| SHL-03 | Phase 2 (Shell) | Complete |
| SHL-04 | Phase 2 (Shell) | Complete |
| SHL-05 | Phase 2 (Shell) | Partial (window geometry → Phase 5, D-11) |
| SHL-06 | Phase 2 (Shell) | Complete |
| PRO-01 | Phase 3 (Hero + Encoding + UX) | Pending |
| PRO-02 | Phase 3 (Hero + Encoding + UX) | Pending |
| PRO-03 | Phase 3 (Hero + Encoding + UX) | Pending |
| PRO-04 | Phase 3 (Hero + Encoding + UX) | Pending |
| PRO-05 | Phase 3 (Hero + Encoding + UX) | Pending |
| PRO-06 | Phase 3 (Hero + Encoding + UX) | Pending |
| PRO-07 | Phase 3 (Hero + Encoding + UX) | Pending |
| ENC-01 | Phase 3 (Hero + Encoding + UX) | Pending |
| ENC-02 | Phase 3 (Hero + Encoding + UX) | Pending |
| ENC-03 | Phase 3 (Hero + Encoding + UX) | Pending |
| UX-01 | Phase 3 (Hero + Encoding + UX) | Pending |
| UX-02 | Phase 3 (Hero + Encoding + UX) | Pending |
| UX-03 | Phase 3 (Hero + Encoding + UX) | Pending |
| UX-04 | Phase 3 (Hero + Encoding + UX) | Pending |
| UX-05 | Phase 3 (Hero + Encoding + UX) | Pending |
| TIME-01 | Phase 4 (Catalogue) | Pending |
| JWT-01 | Phase 4 (Catalogue) | Pending |
| HASH-01 | Phase 4 (Catalogue) | Pending |
| UID-01 | Phase 4 (Catalogue) | Pending |
| NAT-01 | Phase 5 (Native Polish) | Pending |
| NAT-02 | Phase 5 (Native Polish) | Pending |
| DST-01 | Phase 6 (Distribution) | Pending |
| DST-02 | Phase 6 (Distribution) | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38 ✓
- Unmapped: 0 ✓

*Note: an earlier draft of this section stated "41 total" — that was a miscount. The actual count of distinct v1 REQ-IDs is 38 (FND 5, HRN 4, SHL 6, PRO 7, ENC 3, TIME 1, JWT 1, HASH 1, UID 1, UX 5, NAT 2, DST 2). All 38 are mapped.*

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-30 — traceability finalized by roadmapper (per-requirement mapping, count corrected 41→38)*
