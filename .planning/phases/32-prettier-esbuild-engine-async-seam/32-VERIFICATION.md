---
phase: 32-prettier-esbuild-engine-async-seam
verified: 2026-07-01T15:15:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
gaps: []
deferred:
  - truth: "Interactive mounted-tool async pending state shown + <2s paste-to-output feel (PRT-03 UI half)"
    addressed_in: "Phase 33 / 34"
    evidence: "REQUIREMENTS.md PRT-03 'In progress (32-02: latest-wins hook + pending flag; UI display/minify pending)'; no tool mounts the hook until P33/P34"
  - truth: "Interactive real-WKWebView Wi-Fi-off offline paste e2e + never-a-crash async on real paste (PRT-04 interactive half)"
    addressed_in: "Phase 33"
    evidence: "ROADMAP.md Phase 33 SC#5 blocking carry-forward: 'the HTML tool inherits the P32 offline-e2e obligation... MUST pass before this tool can close [PRT-04, carried from Phase 32]'"
  - truth: "esbuild-wired Minify in a mounted Prettier tool + lazy-load proven in-tool (PRT-06/PRT-11 tool half)"
    addressed_in: "Phase 33 / 34"
    evidence: "REQUIREMENTS.md PRT-11 'Pending' for P33; the esbuild-wired-minify UI half lands with the mounted HTML (P33) + JS/TS (P34) tools"
---

# Phase 32: Prettier/esbuild Engine & Async Seam Verification Report

**Phase Goal:** The async Prettier + esbuild engine seam, the shared formatting hook, the generalized FormatterView, and the parity/isolation guards exist and are proven — the foundation both tools depend on.
**Verified:** 2026-07-01T15:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This is a FOUNDATION phase. The engine wrappers, shared hook, generalized shell, and build guards are the deliverables; the two consuming tools (HTML=P33, JS/TS=P34) are out of scope. Verification targets the ENGINE/SEAM half; the deliberately-deferred tool-phase halves of PRT-03/04/06/11 are recorded as `deferred`, not gaps.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Async Prettier wrapper formats JS/TS/HTML (incl. embedded script+style) via 3.8.3 standalone → FormatResult, error-as-value, dynamic-import only | VERIFIED | `src/lib/format/prettier.ts` (158 lines); 10 `import("prettier...")` dynamic loads, 0 static imports; 12 unit tests + parity tests pass |
| 2 | Prettified output byte-identical to CLI `prettier --write`, locked by golden parity + separate regen-integrity, RED on version/option drift | VERIFIED | `prettier.parity.test.ts` uses `toBe(golden)` (no regen; 0 refs to gen-prettier-golden); pin guard asserts exact `3.8.3`; `gen-prettier-golden.mjs && git diff --exit-code` → clean (goldens not stale) |
| 3 | Minify wrapper: valid semantically-equivalent compact output via esbuild-wasm for JS/TS/JSX/TSX + CSS (no ASI/regex breakage); HTML via offline pure minifier; embedded-block failure → ok:false (never silent skip) | VERIFIED | `src/lib/format/minify.ts` (260 lines); 2 dynamic `import("esbuild-wasm")`, 0 static, 0 `.build()`; `minifyScript` delegated by `minifyHtml` (5 refs); 18 unit tests pass incl. ASI + regex-literal + broken-block→ok:false |
| 4 | Both heavy engines never initially-reachable from entry chunk — automated build guard with non-vacuous both-engines self-test + verifier sentinel | VERIFIED | `prettierChunkGuard.mjs` traverses static `.imports` (isEntry=seed only) for both `prettier` + `esbuild-wasm`; self-test 5/5 PASS (2 fold-in RED, non-entry-static-hoist RED, 2 dynamic-only GREEN); wired UNGATED in vite.config; `verify-appstore-bundle.sh` FATALs on `heavyEngineInitiallyReachable:true` |
| 5 | Shared hook debounces ~180ms, latest-wins reqId gate (stale never clobbers), pending flag, empty reset, unmount cleanup — no worker | VERIFIED | `src/shell/useAsyncFormat.ts` (119 lines); `DEBOUNCE_MS=180`, `id !== reqIdRef.current` stale-drop guard, 0 Worker/terminate; 7 tests pass incl. inverted-timing stale-drop |
| 6 | FormatterView generalized to `[Prettify\|Minify]` mode selector + optional printWidth (hidden in minify); StatusBar role=alert on error + pending hint; JSON/XML retrofitted with pure transforms unchanged | VERIFIED | `FormatterView.tsx` MODE_OPTIONS, `mode === "prettify"` guards both indent + printWidth; StatusBar `role={parseState === "error" ? "alert" : "status"}` + pending span; JSON/XML derive `minify = mode === "minify"`; `git diff --quiet json.ts xml.ts *.test.ts` CLEAN |
| 7 | Engines make zero outbound network calls (offline proof at engine layer) | VERIFIED | `offline.integration.test.ts` swaps fetch/XHR/WebSocket for recording+throwing stand-ins, drives real prettier+esbuild wrappers, asserts `networkCalls === 0` (×4) — all pass |

**Score:** 7/7 truths verified

### Deferred Items

Items not delivered by this foundation phase but explicitly addressed in later milestone phases (do not affect status).

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | PRT-03 interactive pending-state-shown + <2s feel (UI half) | Phase 33/34 | REQUIREMENTS.md PRT-03 "In progress ... UI display/minify pending"; hook has no mounted consumer yet |
| 2 | PRT-04 interactive real-WKWebView Wi-Fi-off paste e2e + never-a-crash on real paste | Phase 33 | ROADMAP Phase 33 SC#5 blocking carry-forward line (grep-confirmed, single match under P33) |
| 3 | PRT-06/PRT-11 esbuild-wired Minify in a mounted tool + lazy-load-in-tool | Phase 33/34 | REQUIREMENTS.md PRT-11 "Pending" (P33); engine landed this phase, UI wiring deferred |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/format/prettier.ts` | async formatScript/formatHtml, lazy memoized | VERIFIED | 158 lines, dynamic-import only, wired via parity + offline tests |
| `src/lib/format/prettier.parity.test.ts` | byte-equal vs committed goldens, no regen | VERIFIED | 93 lines, `toBe(golden)`, pin guard, 0 gen refs |
| `test/fixtures/prettier/` | messy inputs + CLI goldens (js/ts/embedded html) | VERIFIED | 6 files; embedded.html.golden differs from source in script+style |
| `src/lib/format/minify.ts` | minifyScript (esbuild) + minifyHtml (pure), ok:false propagation | VERIFIED | 260 lines, transform-only, embedded-block→ok:false |
| `src/shell/useAsyncFormat.ts` | reqId latest-wins + debounce + pending | VERIFIED | 119 lines, stale-drop guard present, no worker |
| `src/components/FormatterView.tsx` | mode selector + optional printWidth + D-04 hide | VERIFIED | 310 lines, onMinify removed, both controls guarded by prettify mode |
| `src/components/StatusBar.tsx` | role=alert on error + pending hint | VERIFIED | 119 lines, conditional role, Formatting… span |
| `scripts/prettierChunkGuard.mjs` | initial-reachability guard, both engines, sentinel | VERIFIED | 101 lines, .imports traversal, emits sentinel |
| `scripts/prettierChunkGuard.selftest.mjs` | non-vacuous both-engines + non-entry-static trap | VERIFIED | 172 lines, 5/5 real-Vite builds pass |
| `src/lib/format/offline.integration.test.ts` | zero-network proof | VERIFIED | 106 lines, `networkCalls === 0` ×4 |
| `package.json` | prettier 3.8.3 + esbuild-wasm 0.28.0 exact-pinned deps | VERIFIED | both present, no caret, prettier count=1 |
| `scripts/verify-appstore-bundle.sh` | FATAL on heavyEngineInitiallyReachable:true | VERIFIED | assert_no_heavy_engine_in_entry wired to main run block, bound by dist freshness |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| prettier.ts | prettier/standalone + plugins | dynamic import() | WIRED | 10 dynamic imports, 0 static |
| minify.ts (minifyHtml) | minifyScript (esbuild) | embedded block minify, failure→ok:false | WIRED | 5 refs; broken-block test asserts ok:false |
| minify.ts | esbuild-wasm + .wasm asset | dynamic import + local wasmURL | WIRED | 2 dynamic imports, 0 CDN refs |
| useAsyncFormat.ts | async runner | reqId-gated resolution | WIRED | `id !== reqIdRef.current` gate proven by stale-drop test |
| JsonFormatterTool/XmlFormatterTool | formatJson/formatXml | minify = mode==='minify' | WIRED | both tools; pure transforms untouched |
| vite.config.ts | prettierChunkGuard() | plugins array (ungated) | WIRED | outside isAppstoreBuild branch |
| verify-appstore-bundle.sh | prettier-chunk-inventory.json | FATAL on true | WIRED | assert function + main-block call |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase test suites (9 files) | `vitest run` prettier/minify/hook/formatterview/statusbar/json/xml/offline | 97/97 passed | PASS |
| Decoder immovable bar | `vitest run decoder.test.ts` | 19/19 passed | PASS |
| Golden not stale (PRT-05) | `gen-prettier-golden.mjs && git diff --exit-code` | clean | PASS |
| Chunk guard non-vacuous (PRT-02) | `node prettierChunkGuard.selftest.mjs` | 5/5 OK | PASS |
| Zero-network (PRT-04 engine half) | offline.integration.test.ts | networkCalls===0 ×4 | PASS |
| Type check | `tsc --noEmit` | exit 0 | PASS |
| Decoder source untouched | `git diff --quiet decoder.ts` | clean | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| PRT-01 | 32-01 | Prettier 3.8.3 standalone runtime prettify engine, devDep→dep, byte-identical to CLI | SATISFIED | wrapper + parity test pass; single pinned dep |
| PRT-02 | 32-05 | Both engines lazy/code-split, never in initial chunk, automated non-vacuous guard | SATISFIED | guard + 5/5 self-test + sentinel + verifier FATAL |
| PRT-03 | 32-02 | Async latest-wins + pending state (engine/hook half) | SATISFIED (engine half); UI half deferred P33/34 | useAsyncFormat + stale-drop test; REQUIREMENTS marks "In progress" for UI half |
| PRT-04 | 32-03, 32-05 | Error-as-value role=alert line:col + offline (engine half) | SATISFIED (engine half); interactive half deferred P33 | StatusBar role=alert + offline test 0 calls; interactive carry-forward on P33 ROADMAP |
| PRT-05 | 32-01 | Golden parity test RED on version/option drift | SATISFIED | byte-equal parity + pin guard + regen-integrity |
| PRT-06 | 32-04 | esbuild runtime minify engine (JS/TS/JSX/TSX/CSS + HTML), no ASI/regex breakage | SATISFIED (engine half); in-tool lazy-load proof deferred P33/34 | minify.ts + 18 tests incl. ASI/regex |
| PRT-11 | 32-03 | FormatterView generalized to unified mode selector + optional printWidth; JSON/XML retrofit | SATISFIED (shell + retrofit half); esbuild-wired-minify UI half deferred P33/34 | mode selector + printWidth + retrofit; pure transforms unchanged; PRT-11 wording amended (D-05) |

All 7 declared requirement IDs accounted for. No orphaned requirements (REQUIREMENTS.md traceability maps PRT-01,02,03,04,05,06,11 to Phase 32; all present in plan frontmatter).

### Anti-Patterns Found

None blocking. Scanned engine wrappers, hook, shell, and guard: dynamic-import discipline holds (0 static heavy-engine imports), no CDN/remote URLs in engine source, no TODO/FIXME/placeholder in shipped artifacts, no hollow empty-data flows (the `heavyEngineInitiallyReachable:false` + empty hits in the P32 build are correct — no tool consumes the engines yet, by design).

Note (informational, not a gap): the codex adversarial review documented an unbounded main-thread size-guard as a carry-forward to P33/P34 (per phase context) — a pathological-paste size cap, out of scope for this engine-seam foundation.

### Human Verification Required

None for this phase. Per the phase context, the binding CLAUDE.md harness (/simplify, /code-review xhigh, /codex:adversarial-review, real-WKWebView e2e on json/xml/protobuf specs) was already run at the phase boundary. This phase mounts no new tool, so there is no new interactive/native surface to human-verify here — the real-WKWebView Wi-Fi-off paste flow is an explicit BLOCKING carry-forward onto Phase 33 (the first mounted consumer), recorded on the P33 ROADMAP entry.

### Gaps Summary

No gaps. All 7 observable truths for the foundation seam are verified against the codebase and proven by passing tests: the Prettier wrapper (byte-parity locked), the esbuild-wasm minify wrapper (ASI/regex-safe, no-silent-skip), the offline HTML minifier, the shared latest-wins hook, the generalized FormatterView + role=alert StatusBar (with JSON/XML retrofitted, pure transforms byte-unchanged), the non-vacuous both-engines chunk-isolation guard + sentinel + verifier FATAL, and the engine-level zero-network offline proof. Decoder + its 19 tests are byte-for-byte untouched. tsc clean. The deliberately-deferred UI-facing halves of PRT-03/04/06/11 (which require a mounted tool) are correctly scheduled for P33/P34 and recorded as deferred, not gaps — including the blocking interactive offline-paste e2e carried forward onto Phase 33.

---

_Verified: 2026-07-01T15:15:00Z_
_Verifier: Claude (gsd-verifier)_
