---
phase: 4
slug: catalogue
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.7` (unit / jsdom via `// @vitest-environment jsdom` pragma) + WebdriverIO `9.27.2` (real-WKWebView e2e) |
| **Config file** | `package.json` scripts; `wdio.conf.ts` |
| **Quick run command** | `npx vitest run <path>` |
| **Full suite command** | `npm test && npx tsc --noEmit && npm run lint` |
| **Estimated runtime** | ~15 seconds (unit) + e2e via `bash scripts/e2e-spike.sh` |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed-suite>` + `npx tsc --noEmit`
- **After every plan wave:** Run `npm test` (full vitest) + `tsc --noEmit` + `npm run lint`
- **Before `/gsd-verify-work`:** Full suite green (decoder's 19 tests untouched) + per-tool `test/e2e/<tool>.e2e.ts` via `scripts/e2e-spike.sh` on the real WKWebView
- **Max feedback latency:** ~15 seconds (unit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-W0 | shared | 0 | D-04 | — | StatusBar relocation keeps Phase-3 behavior identical | regression | `npm test` (decoder 19 + Base64 green) | ✅ exists | ⬜ pending |
| 4-UID-lib | uuid-ulid | — | UID-01 | — | ULID encode/decode round-trips known vectors; overflow at 2^48−1 | unit | `npx vitest run src/lib/ulid.test.ts` | ❌ W0 | ⬜ pending |
| 4-UID-v7 | uuid-ulid | — | UID-01 | — | `buildUuidV7(...)` → `017f22e2-79b0-7cc3-98c4-dc0c0c180cc3`; decode version=7/variant=10 | unit | `npx vitest run src/lib/uuidv7.test.ts` | ❌ W0 | ⬜ pending |
| 4-UID-decode | uuid-ulid | — | UID-01 | — | auto-detect UUID vs ULID; malformed flagged (no crash) | unit | `npx vitest run src/tools/uuid-ulid/decodeId.test.ts` | ❌ W0 | ⬜ pending |
| 4-UID-ui | uuid-ulid | — | UID-01 | — | generate-on-open + 1-keystroke regen + batch copy | e2e | `bash scripts/e2e-spike.sh` (`uuid-ulid.e2e.ts`) | ❌ W0 | ⬜ pending |
| 4-HASH-digests | hash | — | HASH-01 | — | md5("")=`d41d8cd98f00b204e9800998ecf8427e`; sha256("")=`e3b0c4…b855`; sha1/384/512 vectors | unit | `npx vitest run src/tools/hash/hashes.test.ts` | ❌ W0 | ⬜ pending |
| 4-HASH-input | hash | — | HASH-01 | — | text/hex/base64 → bytes → 5 digests; lowercase default + uppercase toggle | unit + e2e | vitest + `hash.e2e.ts` | ❌ W0 | ⬜ pending |
| 4-JWT-decode | jwt | — | JWT-01 | — | split→base64url→JSON happy path; 3 error classes (count / non-base64url / non-JSON) | unit | `npx vitest run src/tools/jwt/decodeJwt.test.ts` | ❌ W0 | ⬜ pending |
| 4-JWT-claims | jwt | — | JWT-01 | — | `exp` expired flag / `nbf` not-yet-valid flag humanized | unit | (same suite) | ❌ W0 | ⬜ pending |
| 4-TIME-heuristic | unix-time | — | TIME-01 | — | s/ms heuristic boundaries; manual override; empty=neutral | unit | `npx vitest run src/lib/timeFormat.test.ts` | ❌ W0 | ⬜ pending |
| 4-TIME-twoway | unix-time | — | TIME-01 | — | forward local+UTC+ISO; reverse ISO→ts; live "now" | unit + e2e | vitest + `unix-time.e2e.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Relocate `StatusBar` → `src/components/StatusBar.tsx`; fix the Base64 import line (the Protobuf decoder uses its own status rendering — no shared-StatusBar import — so the D-04 "where it cleanly fits" Protobuf clause is a no-op this phase); full suite holds (decoder 19 + Base64 prop/aria contract from `Base64Tool.test.tsx`)
- [ ] `npm install js-md5@0.8.3` (the single vendored dep — MIT, offline, accepts `string` + `Uint8Array`)
- [ ] `src/lib/ulid.ts` + `src/lib/ulid.test.ts` — Crockford base32 encode/decode + known vectors (`01ARZ3NDEKTSV4RRFFQ69G5FAV` → `1469922850259` ms; `encodeTime(0)="0000000000"`; overflow `7ZZZZZZZZZ`)
- [ ] `src/lib/uuidv7.ts` + `src/lib/uuidv7.test.ts` — RFC 9562 layout + canonical vector
- [ ] New tool dirs `src/tools/jwt/`, `src/tools/hash/`, `src/tools/uuid-ulid/` each with `index.ts` registry entry; 3 imports + array entries added to `registry.ts` (sanctioned tool registration); `unix-time/` placeholder swapped
- [ ] New `test/e2e/{unix-time,jwt,hash,uuid-ulid}.e2e.ts` for the real-WKWebView gate

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Web Crypto secure-context availability on the real WKWebView (Assumption A1) | HASH-01, UID-01 | `crypto.subtle` requires a secure context; jsdom/Node probe is a proxy, not the packaged webview | In `hash.e2e.ts` assert a known SHA-256 digest renders in the real WKWebView; if `crypto.subtle` is undefined, the gate fails loudly |
| WCAG-AA visual audit (focus, AA contrast, no opacity-only disabled) across all four tools | UX (cross-cutting) | Contrast/focus require rendered-pixel inspection | `gsd-ui-review` audit at phase boundary |
| `tauri build` runs + tools function in the bundle | all | Packaged build differs from `tauri dev` | Human sign-off at phase boundary |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-31 (plans 04-01..04-06 satisfy per-task `<automated>` coverage; `wave_0_complete` flips true once Wave-1 plan 04-01 lands)
