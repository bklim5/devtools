# Phase 4: Catalogue - Research

**Researched:** 2026-05-31
**Domain:** Four small frontend tools (Unix Time, JWT, Hash, UUID/ULID) over native crypto + `bytes.ts`, plus shared-scaffold extraction
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Verbatim from `04-CONTEXT.md` `<decisions>` (D-01..D-17 locked; D-18..D-20 discretion). The 20 decisions are the authoritative scope. Summarized for the planner; the source remains canonical.

- **D-01 (Hash deps):** MD5 = vendor a tiny audited zero-runtime-dep JS lib (`js-md5`), bundled offline. Do NOT hand-roll MD5. SHA-1/256/384/512 = Web Crypto `crypto.subtle.digest`.
- **D-02 (UUID/ULID deps):** ULID = hand-roll in-house under `src/lib/` with tests (Crockford base32 of 48-bit ms timestamp + 80-bit `crypto.getRandomValues`, encode + decode). UUID v4 = `crypto.randomUUID`; UUID v7 = `crypto.getRandomValues` + spec layout. NO `uuid`/`ulid` npm deps.
- **D-03 (Date/time):** Native `Intl.DateTimeFormat` + `Date` only. No date library.
- **D-04 (Shared scaffold):** Extract shared `StatusBar` to a shared location; establish a thin reusable "simple tool" layout + copy pattern; reuse `useCopyFeedback`. Migrate Base64 (and Protobuf where clean) to the shared component, keeping `encoding` as an OPTIONAL prop. Do NOT regress Phase-3 tests/behavior.
- **D-05 (Unix Time detect):** Auto-detect timestamp unit by magnitude + manual override toggle (mirrors Protobuf hex/base64 detect+override). s/ms (and plausibly µs/ns). Instant, no button. Empty = neutral.
- **D-06 (Unix Time reverse):** Editable datetime/ISO field deriving the timestamp (two-way) + a live "now" with ≤1-keystroke copy. Always show both local and UTC.
- **D-07 (JWT decode):** Split on `.`, base64url-decode header + payload via `bytes.ts`, pretty-print JSON. Signature shown raw + `alg` from header.
- **D-08 (JWT errors):** Field-scoped explicit errors (wrong segment count / non-base64url / non-JSON). Never silent or crash.
- **D-09 (JWT scope):** Display-only — NO signature verification, no key input.
- **D-10 (JWT claims):** Humanize `exp`/`iat`/`nbf` (absolute + relative); visibly flag expired / not-yet-valid. Reuse D-03 formatting.
- **D-11 (Hash input):** Input modes UTF-8 text / hex / base64 via encoding toggle → single internal `Uint8Array` → hashers. Reuse `bytes.ts` end-to-end like Base64.
- **D-12 (Hash output):** Compute + show all five digests at once, stacked (MD5, SHA-1/256/384/512), each row with its own visible focusable ≤1-keystroke copy. No algorithm picker.
- **D-13 (Hash casing):** Lowercase hex by default + uppercase toggle.
- **D-14 (Hash async):** SHA digests async (`subtle.digest` Promise), MD5 sync. Compute reactively on input change within <2s.
- **D-15 (UUID/ULID generate):** UUID v4 + UUID v7 + ULID.
- **D-16 (UUID/ULID UX):** Generate one on open; single keystroke regenerates; optional count → batch list, each copyable + copy-all.
- **D-17 (UUID/ULID decode):** Auto-detect UUID vs ULID; full breakdown. UUID: version + variant (+ embedded timestamp for time-based v1/v7). ULID: decoded timestamp + randomness. Malformed flagged (D-08 pattern).

### Claude's Discretion
- **D-18:** Sidebar/registry ordering of the four tools, lucide icons, labels/keywords, example/placeholder content.
- **D-19:** Hash debounce / large-input strategy + async-state UX (e.g. "computing…"), within <2s.
- **D-20:** Unit-toggle granularity (whether µs/ns ship beyond s/ms), datetime-field input format/parsing (D-06), JWT relative-time wording (D-10), batch-count control design (D-16), per-tool layout/spacing — all within locked decisions and `design/DevTools Mockup.html` tokens.

### Deferred Ideas (OUT OF SCOPE)
- JWT signature verification / HMAC secret input (D-09 — display-only this phase).
- Tool-scoped action palette (V2-01).
- Persisting per-tool preferences (hash casing, default time unit, last UUID version) — session-local unless a need emerges; via `usePreferences` if ever added.
- Protobuf decimal-byte-array input mode (backlog; belongs to the Protobuf tool, not this phase).
- Window-geometry persistence / native polish (Phase 5); distribution/signing (Phase 6).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIME-01 | Paste unix timestamp (s/ms) → local + UTC datetimes, and the reverse | §Native Date/Time — magnitude heuristic, `Intl.DateTimeFormat`, ISO parse-back, "now" |
| JWT-01 | Paste a JWT → decoded header + payload (+ signature segment), malformed reported clearly | §JWT Decode — `bytes.ts` base64url (unpadded confirmed), field-scoped error taxonomy |
| HASH-01 | Input text/bytes → MD5 + SHA-1/256/384/512 (Web Crypto for SHA, JS lib for MD5) | §MD5 lib (js-md5 verified), §Web Crypto SHA (all four verified incl. SHA-1) |
| UID-01 | Generate UUIDs/ULIDs with one keystroke; decode a pasted UUID/ULID into components | §ULID hand-roll (alphabet + algorithm + vectors), §UUID v7 (RFC 9562 layout + vector) |
</phase_requirements>

## Summary

Phase 4 is four small, low-risk tools whose entire value is **feeling identical to the Phase-3 hero**: paste→instant, ≤1-keystroke visible copy, the same status bar, accent-=-selection discipline. The locked decisions already pick every approach; this research de-risks the **exact implementation details** the planner needs — canonical algorithms, concrete TDD test vectors, the precise `bytes.ts`/registry/StatusBar integration points — not the choices themselves.

Every technical claim below is verified against the local codebase, the npm registry, the actual `js-md5` package source, a Node 22 crypto probe (a faithful proxy for the macOS WKWebView, which tracks the same WebKit/Safari implementation), and the canonical ULID/RFC-9562 specs. **All four native primitives — `crypto.subtle.digest` (incl. SHA-1), `crypto.randomUUID`, `crypto.getRandomValues`, `Intl.DateTimeFormat` — are present and offline.** `js-md5@0.8.3` (MIT, 51 KB unpacked, ships its own `.d.ts`) is the single justified vendored dep and correctly hashes both `string` and `Uint8Array` input.

The single most important discovery for the planner: **`StatusBar` is ALREADY shared across both Phase-3 tools** — `ProtobufDecoder.tsx:24` imports `StatusBar` from `@/tools/base64/StatusBar`. D-04 is therefore a low-risk *relocation* (move the file to a neutral path + fix two import lines), not a from-scratch extraction.

**Primary recommendation:** Build each tool as a thin component over native crypto + `bytes.ts`, mirroring `Base64Tool.tsx`/`useBytesConvert.ts`. Hand-roll ULID + UUIDv7 as pure `src/lib/` modules with the concrete test vectors in §Validation Architecture. Relocate the shared `StatusBar` first (Wave 0) so all four tools consume it.

## Project Constraints (from CLAUDE.md)

- **HashRouter only** — `BrowserRouter` forbidden. (No routing work this phase; registry derives routes.)
- **Six tools only** — these four complete the set; add nothing from the deferred list.
- **Do NOT refactor `decoder.ts` or its 19 tests** without explicit approval. Also port-unchanged: `bytes.ts`, `types.ts`, `registry.ts` internals (per CONTEXT — Hash/JWT consume `bytes.ts` but must not edit it).
- **No network at runtime** — self-host fonts; `js-md5` must be bundled (npm dep, vendored into the bundle), no CDN.
- Tools import **`src/lib/platform/`**, never `@tauri-apps/*` directly (FND-04). Clipboard copy goes through `platform.clipboard.writeText`.
- **Registry is the single control plane** — sidebar/palette/router derive from it; each tool's only registry change is swapping `component`.
- **No hover-only copy** — every output row needs a visible focusable `<button>` (UX-02).
- **Tool components layout-agnostic** — responsive Tailwind, no fixed widths (UX-05); layout chrome lives in the shell.
- **Binding harness per task:** `/simplify` → `/codex:review` → vitest+tsc green (decoder's 19 immovable) → real-WKWebView UI via `test/e2e/<tool>.e2e.ts` + `scripts/e2e-spike.sh`. Phase boundary: human sign-off on `tauri build` + passing `gsd-ui-review` WCAG-AA audit.
- **Do NOT widen the `Store` seam** — any persisted pref goes via `usePreferences`/`prefsStore` (none required this phase).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `js-md5` | `0.8.3` | MD5 digest (D-01) | MIT, zero-runtime-dep, 51 KB unpacked, ships own `.d.ts`, accepts `string`/`number[]`/`ArrayBuffer`/`Uint8Array`. Web Crypto deliberately omits MD5. `[VERIFIED: npm view js-md5 → 0.8.3, license MIT; tarball source hashes md5("")=d41d8cd98f00b204e9800998ecf8427e]` |
| Web Crypto `crypto.subtle.digest` | native | SHA-1/256/384/512 (D-14) | Native in WKWebView, async, no dep. SHA-1 supported. `[VERIFIED: Node 22 probe — all four algos + sha256("")=e3b0c4…]` |
| `crypto.randomUUID` | native | UUID v4 (D-15) | Native, returns RFC-4122 v4 string. `[VERIFIED: Node probe — typeof function, sample valid]` |
| `crypto.getRandomValues` | native | UUID v7 randomness + ULID 80-bit randomness (D-02/D-15) | Native CSPRNG. `[VERIFIED: Node probe]` |
| `Intl.DateTimeFormat` + `Date` | native | s/ms timestamp ↔ local/UTC/ISO (D-03) | Zero-dep, offline, locale-aware. `[VERIFIED: standard ES Intl]` |
| `Intl.RelativeTimeFormat` | native | Relative time for JWT exp/iat/nbf (D-10) | Native "in 3 days"/"5 minutes ago". `[ASSUMED: present in WKWebView — confirm on real webview during e2e]` |

### Supporting (already in the repo — reuse, do not re-add)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `@/lib/bytes` | `utf8ToBytes`/`bytesToUtf8`, `base64ToBytes`/`bytesToBase64` (base64url alphabet), `hexToBytes`/`bytesToHex` | Hash input modes (D-11) + JWT base64url decode (D-07). `[VERIFIED: src/lib/bytes.ts read]` |
| `@/shell/useCopyFeedback` | `[copied, confirm]` momentary "Copied" (1200 ms, re-arms) | Every copy affordance (D-04/D-12/D-16). `[VERIFIED: read]` |
| `@/lib/platform` | `platform.clipboard.writeText`, `platform.store` | Copy + (unused) persistence. Never `@tauri-apps/*`. `[VERIFIED: used in Base64Tool.tsx]` |
| Shared `StatusBar` (`@/tools/base64/StatusBar` → relocate) | parse·bytes·encoding?·error·timing footer; `encoding` already optional | All four tools. `[VERIFIED: read + ProtobufDecoder.tsx:24 already imports it]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `js-md5` | `hash-wasm@4.12.0` | hash-wasm is faster + covers all algos in one lib, but pulls a WASM blob (larger, async-init, heavier offline-vendor story). For one-off MD5 of small dev inputs, js-md5's 51 KB sync API wins. CONTEXT locks js-md5 (D-01). `[VERIFIED: npm view hash-wasm → 4.12.0]` |
| hand-rolled ULID | `ulid` npm | CONTEXT bans new deps (D-02); the algorithm is ~30 lines and trivially testable. |
| `Intl` dates | `date-fns`/`dayjs`/`luxon` | CONTEXT bans a date lib (D-03); native `Intl` + `Date` covers s/ms↔local/UTC/ISO and relative-time. |

**Installation:**
```bash
npm install js-md5@0.8.3
# types ship inside js-md5 (package/index.d.ts) — do NOT add @types/js-md5
```
Import: `import { md5 } from "js-md5";` (named export `export var md5: Hash`). `[VERIFIED: tarball index.d.ts]`

**Version verification (run before writing the plan's install step):**
```bash
npm view js-md5 version   # → 0.8.3 (verified 2026-05-31)
npm view js-md5 license   # → MIT (verified)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── ulid.ts            # hand-rolled encode/decode (D-02) + ulid.test.ts
│   ├── uuidv7.ts          # hand-rolled v7 build/decode (D-15) + uuidv7.test.ts
│   └── (bytes.ts)         # UNCHANGED — consumed by hash + jwt
├── components/            # NEW shared home for the relocated StatusBar (D-04)
│   └── StatusBar.tsx      # moved from src/tools/base64/StatusBar.tsx
├── tools/
│   ├── unix-time/         # exists as placeholder — swap component
│   │   ├── index.ts       # registry entry (already enabled, Clock icon)
│   │   ├── UnixTimeTool.tsx
│   │   ├── timeFormat.ts  # shared s/ms↔local/UTC/ISO + relative (reused by JWT)
│   │   └── *.test.ts(x)
│   ├── jwt/               # NEW dir + index.ts registry entry
│   │   ├── index.ts
│   │   ├── JwtTool.tsx
│   │   ├── decodeJwt.ts   # pure: split→base64url→JSON→error taxonomy
│   │   └── *.test.ts(x)
│   ├── hash/             # NEW
│   │   ├── index.ts
│   │   ├── HashTool.tsx
│   │   ├── hashes.ts      # md5 (sync) + subtle.digest (async) → hex
│   │   └── *.test.ts(x)
│   └── uuid-ulid/        # NEW
│       ├── index.ts
│       ├── UuidUlidTool.tsx
│       ├── decodeId.ts    # auto-detect UUID vs ULID + breakdown
│       └── *.test.ts(x)
```
*(Exact ids/dir names are D-18 discretion; `unix-time` already exists. `src/components/` vs `src/shell/` for the StatusBar home is the planner's call — `src/components/` is the cleaner neutral home since it is presentational and tool-agnostic.)*

### Pattern 1: Thin tool over a pure logic hook (the Base64 template)
**What:** A presentational component renders panes/rows; all transform logic lives in a pure hook or module that is unit-tested independently of React. Single internal `Uint8Array` is the source of truth for byte tools.
**When to use:** Hash (D-11, identical to Base64), JWT (input string → derived panes).
**Example:** `src/tools/base64/Base64Tool.tsx` + `useBytesConvert.ts` — copy its shape: `timed()` wrapper feeding `StatusBar.timingMs`, `Pane` with visible `<button>` copy via `useCopyFeedback` + `platform.clipboard.writeText`, per-field error nodes (`aria-invalid` + `text-bad`, never opacity-only). `[VERIFIED: read]`

### Pattern 2: Pure `src/lib/` algorithm modules (ULID, UUIDv7)
**What:** Encode/decode logic with zero React/DOM/Tauri imports, fully deterministic given inputs (inject the random bytes / timestamp as params so tests are deterministic).
**When to use:** ULID + UUIDv7. Make `generate(now?, randomBytes?)` accept optional injected entropy/clock so tests assert exact vectors; production calls pass `Date.now()` + `crypto.getRandomValues`.
**Example (UUIDv7 build, RFC 9562):**
```typescript
// Source: RFC 9562 §5.7 — VERIFIED via Node, produces the canonical
// example 017f22e2-79b0-7cc3-98c4-dc0c0c180cc3
export function buildUuidV7(unixMs: number, rand: Uint8Array /* >=10 bytes */): string {
  const b = new Uint8Array(16);
  const ms = BigInt(unixMs);
  for (let i = 0; i < 6; i++) b[5 - i] = Number((ms >> BigInt(8 * i)) & 0xffn); // 48-bit BE ms
  for (let i = 0; i < 10; i++) b[6 + i] = rand[i];
  b[6] = (b[6] & 0x0f) | 0x70; // version 7 in high nibble of byte 6
  b[8] = (b[8] & 0x3f) | 0x80; // variant 0b10 in top 2 bits of byte 8
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
```

### Pattern 3: Reactive async digest (Hash, D-14)
**What:** MD5 is sync; SHA via `subtle.digest` is a Promise. Compute reactively in a `useEffect` keyed on the input bytes; guard against out-of-order resolution (stale closure) by capturing the current input identity and discarding late results. Optionally a transient "computing…" state (D-19 discretion).
**Example:**
```typescript
// Source: MDN SubtleCrypto.digest — VERIFIED Node probe
async function sha(algo: "SHA-1"|"SHA-256"|"SHA-384"|"SHA-512", bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest(algo, bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// MD5 (sync): import { md5 } from "js-md5"; md5(bytes)  // accepts Uint8Array directly
```
Stale-result guard in React:
```typescript
useEffect(() => {
  let live = true;
  Promise.all([...algos.map((a) => sha(a, bytes))]).then((rows) => { if (live) setDigests(rows); });
  return () => { live = false; };
}, [bytes]);
```

### Anti-Patterns to Avoid
- **Hand-rolling MD5 or base64.** MD5 via js-md5 (D-01); base64url via `bytes.ts` (D-07). The bytes engine already feature-detects native `fromBase64`/`toBase64` and handles unpadded base64url. `[VERIFIED: bytes.ts]`
- **Non-deterministic generator tests.** Don't test `generate()` against itself; inject fixed clock + random bytes and assert exact strings (vectors below).
- **`new Date(seconds)` confusion.** `Date` is ms-based; a unix *seconds* value must be `× 1000`. The magnitude heuristic must classify the unit BEFORE constructing the `Date`.
- **Reusing `useBytesConvert` verbatim for Hash.** Hash is one-directional (bytes → many digests), not a three-way mutual derive. Reuse the single-`Uint8Array`-source idea and the `bytes.ts` input parsing, but the hook shape differs (no back-derivation of the input from a digest).
- **Opacity-only disabled/error states** (UX-04) and **hover-only copy** (UX-02) — forbidden; the e2e gate fails on hover-only copy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MD5 | A custom MD5 round function | `js-md5@0.8.3` | Crypto primitive correctness/edge-cases; CONTEXT sanctions it (D-01). |
| SHA-1/256/384/512 | A JS SHA implementation | `crypto.subtle.digest` | Native, audited, async, present in WKWebView. `[VERIFIED]` |
| base64 / base64url decode | btoa/atob or a tool-local decoder | `bytes.base64ToBytes(s, "base64url")` | Handles unpadded base64url + native/polyfill split. `[VERIFIED]` |
| UUID v4 | A random-hex assembler | `crypto.randomUUID()` | Native, correct version/variant bits. `[VERIFIED]` |
| Date formatting / timezones | Manual UTC offset math | `Intl.DateTimeFormat` / `toISOString()` / `Date.UTC` | Locale + DST correctness for free. |
| Relative time wording | A "n days ago" string builder | `Intl.RelativeTimeFormat` | Localized, pluralized. (Confirm on real webview.) |

**Key insight:** This phase's only legitimate hand-rolls are **ULID** and **UUID v7** — both are tiny, spec-stable, deterministic-when-injected, and explicitly chosen (D-02) to avoid npm deps. Everything else is native or `bytes.ts`.

## ULID — Exact Spec (D-02)

`[CITED: github.com/ulid/spec]` `[VERIFIED: Node computation of the test vectors below]`

- **Crockford base32 alphabet (exact, 32 chars, in order):**
  `0123456789ABCDEFGHJKMNPQRSTVWXYZ` — **excludes I, L, O, U** (note: it excludes **U**, unlike some Crockford variants). 5 bits per char.
- **Layout:** 26 chars total = **10 chars timestamp** (48-bit Unix **ms**, MSB first) + **16 chars randomness** (80 bits).
- **Encode timestamp:** treat the 48-bit ms as an integer; emit 10 base32 chars MSB-first. `encodeTime(0) = "0000000000"`.
- **Encode randomness:** 80 random bits (10 bytes from `crypto.getRandomValues(new Uint8Array(10))`) → 16 base32 chars.
- **Overflow:** max valid timestamp = `2^48 − 1 = 281474976710655` ms, which encodes to time-portion `7ZZZZZZZZZ` (full ULID `7ZZZZZZZZZZZZZZZZZZZZZZZZZ`, year 10889 AD). Encoding a larger ms must throw/clamp — a TDD edge case.
- **Decode:** map each char back through the alphabet (index = 5-bit value), reassemble. First 10 chars → ms timestamp; last 16 → randomness bytes.
- **Monotonicity (optional, D-16 batch):** within the same ms the random component may increment by 1 (with carry); on 2^80-in-1ms it fails. For v1 a simple fresh-random-per-ULID is sufficient unless the planner wants monotonic batches — *not required by UID-01*; treat as discretion.

**Concrete test vectors (write these as TDD cases):**
| Input | Expected |
|-------|----------|
| `decodeTime("01ARZ3NDEKTSV4RRFFQ69G5FAV")` | `1469922850259` ms (2016-07-30T23:54:10.259Z) `[VERIFIED]` |
| `encodeTime(1469922850259).slice(0,10)` | `"01ARZ3NDEK"` (matches the vector's prefix) `[VERIFIED]` |
| `encodeTime(0)` | `"0000000000"` `[VERIFIED]` |
| `encodeTime(281474976710655)` | `"7ZZZZZZZZZ"` (max) `[VERIFIED]` |
| `encodeTime(281474976710656)` | must throw (overflow) |
| round-trip: `decode(generate(ms, rand))` | recovers `ms` and `rand` exactly |

## UUID v7 — Exact Layout (D-15, RFC 9562)

`[CITED: RFC 9562 §5.7]` `[VERIFIED: Node construction produces the RFC canonical example]`

- 16 bytes. **Bytes 0–5:** 48-bit big-endian Unix **ms** timestamp. **Byte 6 high nibble:** version `0b0111` (`| 0x70` after masking low nibble). **Byte 8 top 2 bits:** variant `0b10` (`(b8 & 0x3f) | 0x80`). All remaining bits (low nibble of byte 6, low 6 bits of byte 8, bytes 7 and 9–15) = `crypto.getRandomValues`.
- **String formatting:** lowercase hex, dashed `8-4-4-4-12` (positions 8/12/16/20).
- **v4 generation:** `crypto.randomUUID()` directly (sets version `0b0100` + variant `0b10` itself).

**Concrete test vector (deterministic — inject ts + rand):**
| Input | Expected |
|-------|----------|
| `buildUuidV7(1645557742000, [0x0c,0xc3,0x18,0xc4,0xdc,0x0c,0x0c,0x18,0x0c,0xc3])` | `017f22e2-79b0-7cc3-98c4-dc0c0c180cc3` (the RFC 9562 example) `[VERIFIED]` |

**Decode assertions (D-17):** parse 32 hex nibbles → 16 bytes. `version = byte6 >> 4` (expect `7` for v7, `4` for v4); `variant = byte8 >> 6` (expect `0b10`). For v1/v7 extract the embedded timestamp: v7 = bytes 0–5 as 48-bit BE ms. Decoding the vector yields `{version:7, variant:"10", tsMs:1645557742000, date:"2022-02-22T19:22:22.000Z"}`. `[VERIFIED]`

## JWT Decode — Integration (D-07/D-08)

`[VERIFIED: bytes.ts read; Node base64url confirmation]`

- **base64url path is in `bytes.ts`:** `base64ToBytes(segment, "base64url")` — the polyfill branch maps `-`→`+`, `_`→`/`, and re-pads to a multiple of 4 (`while (s.length % 4 !== 0) s += "="`). **JWT base64url has NO padding; `bytes.ts` handles unpadded input correctly** (re-pads in the fallback; native `fromBase64` accepts unpadded base64url). `[VERIFIED: src/lib/bytes.ts:31-45]`
- **Decode algorithm:** `token.split(".")` → require exactly 3 parts → `bytesToUtf8(base64ToBytes(part, "base64url"))` for header + payload → `JSON.parse` → pretty-print. Signature segment shown raw (no decode); surface `alg` from the parsed header.
- **Error taxonomy (field-scoped, D-08 — mirror the Phase-3 explicit-error pattern):**
  | Failure | Detection | Message scope |
  |---------|-----------|---------------|
  | Wrong segment count | `parts.length !== 3` | token-level: "Expected 3 dot-separated segments, got N" |
  | Non-base64url segment | `base64ToBytes` throws | header- or payload-scoped |
  | Non-JSON header/payload | `JSON.parse` throws | header- or payload-scoped |
  - Empty input = neutral state, not an error (mirror Base64/Protobuf).
- **Claim humanization (D-10):** `exp`/`iat`/`nbf` are unix **seconds** → reuse Unix Time's `timeFormat.ts` (×1000 to ms, absolute local+UTC + `Intl.RelativeTimeFormat`). Flag `exp < now` (expired) and `nbf > now` (not yet valid) with a visible `text-bad`/badge cue.

## Native Date/Time (D-03/D-05/D-06)

- **s/ms magnitude heuristic (D-05):** classify the pasted integer by plausible date range, not just digit count, to stay robust:
  - seconds (10 digits ≈ now): `1e9`–`1e11` (≈ 2001–5138 in s)
  - ms (13 digits ≈ now): `1e12`–`1e14`
  - µs / ns: larger bands (D-20 discretion whether to ship). Provide a manual override toggle (mirrors Protobuf hex/base64). Empty = neutral.
  - Practical rule: if `value` interpreted as **seconds** lands in a sane window (e.g. 1973–2100) AND as ms does not, pick seconds; the override lets the user force any unit. Document the exact boundaries as TDD cases.
- **Forward render:** `new Date(ms)` → `.toISOString()` (UTC ISO), `Intl.DateTimeFormat(undefined, {dateStyle, timeStyle, timeZone:"UTC"})` for UTC human, and the same without `timeZone` for **local**. Always show both local and UTC (D-06).
- **Reverse (D-06):** an editable ISO/datetime field → `Date.parse(value)` or `new Date(value).getTime()` → emit timestamp in the active unit. Guard `NaN` (invalid date) as a field-scoped error.
- **"Now":** `Date.now()` with a live tick (e.g. `setInterval` 1s) + ≤1-keystroke copy/insert.

## Shared StatusBar Extraction (D-04)

`[VERIFIED: full read of StatusBar.tsx, Base64Tool.tsx, ProtobufDecoder.tsx, Base64Tool.test.tsx]`

**Key finding — it is already shared.** Two importers exist today:
- `src/tools/base64/Base64Tool.tsx:16` → `import { StatusBar, type ParseState } from "./StatusBar";`
- `src/tools/protobuf-decoder/ProtobufDecoder.tsx:24` → `import { StatusBar, type ParseState } from "@/tools/base64/StatusBar";`

**Current prop shape (do not break):**
```typescript
interface StatusBarProps {
  parseState: "ok" | "error" | "empty";  // type ParseState exported alongside
  byteCount: number;
  encoding?: string;   // OPTIONAL (Phase-3 refinement) — omitted by Base64, omitted by Protobuf
  error?: string | null;
  timingMs?: number;
}
```
The component is already fully presentational (primitives only, no tool logic), renders `<footer role="status" aria-live="polite">`, and always renders (neutral "0 bytes").

**Safe extraction target:** move the file to a neutral home — recommend `src/components/StatusBar.tsx` (presentational, tool-agnostic). Update the **two** existing import lines to the new path; the four new tools import from there too. **Do NOT change the prop shape or markup** — that is what keeps Phase-3 tests green.

**"Simple tool" scaffold the four tools should consume (D-04):** factor the repeated `Pane`/copy-row primitive out of `Base64Tool.tsx` into a shared `CopyableRow`/`CopyButton` (visible focusable `<button>` + `useCopyFeedback` + `platform.clipboard.writeText` + "Copied" confirm + the exact focus-ring/`text-bad` classes). Expose: a labelled output row with a ≤1-keystroke copy button, and the `StatusBar`. This lets Hash's five digest rows, JWT's segments, and UUID/ULID's batch entries reuse one copy affordance without duplication.

**Phase-3 test files that touch StatusBar / the copy pattern (must stay green):**
- `src/tools/base64/Base64Tool.test.tsx` — asserts `footer[role='status']`, `byte count` label, that the `encoding` label is **absent** for Base64, the visible-non-hover copy `<button>`s, and the "Copied" re-arm. **These constrain the migration: keep `role="status"`, the `byte count`/`encoding`/`error`/`timing` aria-labels, optional `encoding`, and the copy-button semantics identical.** `[VERIFIED: read]`
- `src/tools/protobuf-decoder/ProtobufDecoder.test.tsx` — renders the real StatusBar (via the relocated import); must still find it after the move.

**Migration order (Wave 0):** relocate `StatusBar` + fix the two imports + (optionally) extract the shared copy row, run the full suite to confirm 182/182 stays green, THEN build the four tools against the shared home.

## Registry Registration — Exact Shape & Swap Point

`[VERIFIED: registry.ts, types.ts, unix-time/index.ts, base64/index.ts read]`

`TOOLS` in `src/lib/tools/registry.ts` is `[unixTimeTool, base64Tool, protobufDecoderTool]`. `ENABLED_TOOLS` = those with `enabled !== false`. **registry.ts is port-unchanged** EXCEPT the planner must add the three new tool imports + array entries (adding a tool = "import it and drop it in here, nothing else" per the file's own doc). The two-line edit to add a tool is: `import { jwtTool } from "@/tools/jwt";` and append to the `TOOLS` array. *(This is the sanctioned registry growth, not an internals edit — confirm with the planner that adding array entries is permitted; the CONTEXT says registry internals are immovable but the registry is explicitly the place new tools register.)*

**Per-tool `ToolDefinition` shape (copy `base64Tool`):**
```typescript
export const jwtTool: ToolDefinition = {
  id: "jwt",                       // URL-safe route segment (D-18)
  name: "JWT",                     // D-18
  description: "Decode JWT header / payload / signature",  // D-18
  category: "crypto",              // existing union: time | encoding | ... | crypto
  keywords: ["jwt", "token", "jose", "decode", "bearer"], // D-18
  icon: KeyRound,                  // lucide-react (D-18)
  component: JwtTool,              // ← the single swap point
  enabled: true,
};
```
**Single swap point per tool:**
- **unix-time:** already exists with `component: makePlaceholder("Unix Time")` (`Clock` icon). Swap to `component: UnixTimeTool`. `[VERIFIED]`
- **jwt / hash / uuid-ulid:** create `src/tools/<id>/index.ts` exporting the `ToolDefinition` with `component: <RealTool>`, then add to `TOOLS`.

Suggested `category` values (existing union has `time`, `encoding`, `crypto`, `generators`, `converters`, `inspectors`): unix-time→`time`, jwt→`crypto`, hash→`crypto`, uuid-ulid→`generators`. Icons/labels/order are D-18.

## Common Pitfalls

### Pitfall 1: Unix seconds vs ms off-by-1000
**What goes wrong:** `new Date(1469922850)` is 1970, not 2016. **Why:** `Date` is ms-based; a 10-digit value is seconds. **Avoid:** classify the unit (D-05) and multiply seconds by 1000 before `new Date`. **Warning sign:** dates near the epoch for plausible recent timestamps.

### Pitfall 2: base64url padding in JWTs
**What goes wrong:** A naive `atob` on an unpadded base64url segment throws. **Why:** JWT segments are unpadded base64url. **Avoid:** route through `base64ToBytes(seg, "base64url")` — it re-pads/maps correctly. **Warning sign:** "invalid character" on valid tokens. `[VERIFIED: bytes.ts handles it]`

### Pitfall 3: SHA digest race in React
**What goes wrong:** Fast typing resolves an older `subtle.digest` Promise after a newer one, showing a stale digest. **Why:** async + no ordering guarantee. **Avoid:** the `let live = true` cleanup guard keyed on input bytes (Pattern 3). **Warning sign:** digest momentarily doesn't match the visible input.

### Pitfall 4: Non-deterministic generator tests
**What goes wrong:** ULID/UUIDv7 tests that call `generate()` and re-`decode()` it can pass while the encoder is wrong (both share the bug). **Why:** self-referential. **Avoid:** assert against the **fixed vectors** (`01ARZ3NDEKTSV4RRFFQ69G5FAV`→1469922850259; `017f22e2-79b0-7cc3-98c4-dc0c0c180cc3`). **Warning sign:** green tests but wrong real output.

### Pitfall 5: Regressing Phase-3 StatusBar tests during the move
**What goes wrong:** Renaming props/markup/aria-labels while relocating breaks `Base64Tool.test.tsx`. **Why:** the test asserts exact `role="status"`, `byte count`/`encoding` labels, optional `encoding`. **Avoid:** relocate the file unchanged; only fix import paths. Run full suite before building tools. **Warning sign:** `queryByLabelText("encoding")` assertions flip.

### Pitfall 6: Tauri secure-context for Web Crypto
**What goes wrong:** `crypto.subtle` is gated to secure contexts; some non-TLS schemes disable it. **Why:** spec requirement. **Mitigation:** Tauri's default `tauri://` custom protocol is treated as a secure context and Phase-3 already runs Web Crypto-adjacent native APIs in the real webview; **verify `subtle.digest` + `randomUUID` on the real WKWebView in the e2e gate** (don't assume from jsdom/Node). `[CITED: MDN SubtleCrypto — secure-context only]` `[ASSUMED: tauri:// is a secure context — confirm in e2e]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UUID v4 everywhere for DB keys | UUID **v7** time-ordered keys | RFC 9562 (May 2024) | v7 is now common for index locality; D-15 ships it. |
| `uuid`/`ulid` npm deps | native `crypto.randomUUID` + hand-rolled v7/ULID | crypto.randomUUID broad since ~2021 | zero-dep, offline (D-02). |
| date libs (moment/dayjs) | native `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat` | Intl broadly available | no dep (D-03). |

**Deprecated/outdated:** `moment.js` (maintenance mode) — not used. UUID v1/v6 (MAC/clock-seq) — out of scope; only v4/v7 generated (decode still reports v1 timestamp if pasted, D-17).

## Validation Architecture

`workflow.nyquist_validation: true` `[VERIFIED: .planning/config.json]` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.7` (unit/jsdom) + WebdriverIO `9.27.2` (real-WKWebView e2e) |
| Config file | `package.json` scripts; `wdio.conf.ts`; jsdom via `// @vitest-environment jsdom` pragma per test |
| Quick run command | `npx vitest run <path>` (or `npm test` = `vitest run`) |
| Full suite command | `npm test` then `npx tsc --noEmit` then `npm run lint` |
| Real-webview gate | `bash scripts/e2e-spike.sh` with `test/e2e/<tool>.e2e.ts` (standing harness rule) |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| UID-01 | ULID encode/decode known vectors + overflow | unit | `npx vitest run src/lib/ulid.test.ts` | ❌ Wave 0 |
| UID-01 | UUIDv7 build → `017f22e2-79b0-7cc3-98c4-dc0c0c180cc3`; decode version/variant/ts | unit | `npx vitest run src/lib/uuidv7.test.ts` | ❌ Wave 0 |
| UID-01 | auto-detect UUID vs ULID + malformed flagged | unit | `npx vitest run src/tools/uuid-ulid/decodeId.test.ts` | ❌ Wave 0 |
| UID-01 | generate-on-open + 1-keystroke regen + batch copy | e2e | `bash scripts/e2e-spike.sh` (`uuid-ulid.e2e.ts`) | ❌ Wave 0 |
| HASH-01 | md5("")=`d41d8cd98f00b204e9800998ecf8427e`; md5(Uint8Array)=string | unit | `npx vitest run src/tools/hash/hashes.test.ts` | ❌ Wave 0 |
| HASH-01 | sha256("")=`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; sha1/384/512 vectors | unit | (same suite) | ❌ Wave 0 |
| HASH-01 | text/hex/base64 input → bytes → 5 digests; lowercase + uppercase toggle | unit + e2e | vitest + `hash.e2e.ts` | ❌ Wave 0 |
| JWT-01 | split→base64url→JSON happy path; 3 error classes | unit | `npx vitest run src/tools/jwt/decodeJwt.test.ts` | ❌ Wave 0 |
| JWT-01 | exp expired flag / nbf not-yet-valid flag | unit | (same suite) | ❌ Wave 0 |
| TIME-01 | s/ms heuristic boundaries; override; empty=neutral | unit | `npx vitest run src/tools/unix-time/timeFormat.test.ts` | ❌ Wave 0 |
| TIME-01 | forward local+UTC+ISO; reverse ISO→ts; "now" | unit + e2e | vitest + `unix-time.e2e.ts` | ❌ Wave 0 |
| D-04 | StatusBar relocation keeps Phase-3 green | regression | `npm test` (182/182, decoder 19) | ✅ exists |

### Known-good digest vectors (assert these exactly)
```
md5("")    = d41d8cd98f00b204e9800998ecf8427e   [VERIFIED via js-md5 source]
md5("abc") = 900150983cd24fb0d6963f7d28e17f72   [VERIFIED]
sha1("abc")    = a9993e364706816aba3e25717850c26c9cd0d89d   [VERIFIED]
sha256("")     = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  [VERIFIED]
sha256("abc")  = ba7816bf8f01cfea...  (64 hex)  [VERIFIED prefix]
sha384("abc")  = cb00753f45a35e8b...  (96 hex)  [VERIFIED prefix]
sha512("abc")  = ddaf35a193617aba...  (128 hex) [VERIFIED prefix]
```

### Sampling Rate
- **Per task commit:** `npx vitest run <changed-suite>` + `npx tsc --noEmit`.
- **Per wave merge:** `npm test` (full vitest) + `tsc` + `npm run lint`.
- **Phase gate:** full suite green (decoder 19 untouched) + per-tool `test/e2e/<tool>.e2e.ts` via `scripts/e2e-spike.sh` + human sign-off on `tauri build` + `gsd-ui-review` WCAG-AA.

### Wave 0 Gaps
- [ ] Relocate `StatusBar` to `src/components/StatusBar.tsx`; fix the 2 import lines; (optional) extract shared `CopyableRow`. Run full suite (182/182 must hold).
- [ ] `src/lib/ulid.ts` + `ulid.test.ts` (vectors above).
- [ ] `src/lib/uuidv7.ts` + `uuidv7.test.ts` (vector above).
- [ ] `npm install js-md5@0.8.3` (the one dep).
- [ ] New tool dirs `jwt/`, `hash/`, `uuid-ulid/` each with `index.ts` registry entry; add 3 imports + array entries to `registry.ts` (sanctioned tool registration).
- [ ] New `test/e2e/{unix-time,jwt,hash,uuid-ulid}.e2e.ts` for the real-WKWebView gate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `crypto.subtle.digest` (SHA-1/256/384/512) | HASH-01 | ✓ (Node probe; WKWebView tracks WebKit) | native | none — verify on real webview |
| `crypto.randomUUID` | UID-01 (v4) | ✓ | native | none |
| `crypto.getRandomValues` | UID-01 (v7+ULID) | ✓ | native | none |
| `Intl.DateTimeFormat` / `Date` | TIME-01/JWT-01 | ✓ | native | none |
| `Intl.RelativeTimeFormat` | JWT-01 (D-10) | likely | native | absolute-only if absent |
| `js-md5` | HASH-01 (MD5) | ✓ (npm) | 0.8.3 MIT | hash-wasm (heavier) |
| `@/lib/bytes` base64url | JWT/Hash | ✓ | in-repo | none |

**Missing dependencies with no fallback:** none. **With fallback:** `Intl.RelativeTimeFormat` (degrade to absolute time) — confirm on the real webview.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tauri://` is a secure context so `crypto.subtle.digest`/`randomUUID` work in the packaged WKWebView | Pitfall 6, Environment | HIGH if wrong — Hash/UUID broken in production. **Must verify in the e2e gate** (Phase-3 precedent: production-only bugs surfaced only on the real webview). Mitigated by the standing real-WKWebView gate. |
| A2 | `Intl.RelativeTimeFormat` is available in the WKWebView | Date/Time, JWT | LOW — degrade to absolute-only; verify in e2e. |
| A3 | Adding new tool imports + array entries to `registry.ts` is permitted (it is the registry's stated purpose) despite "registry internals immovable" | Registry section | LOW — confirm with planner/user; the alternative (a separate registration file) would be a larger change. The file's own comment says adding a tool = drop it in `TOOLS`. |
| A4 | The magnitude heuristic boundaries (s: 1e9–1e11, ms: 1e12–1e14) are acceptable defaults | Date/Time D-05 | LOW — D-20 makes granularity discretionary; boundaries are TDD-tunable. |

## Open Questions

1. **StatusBar home: `src/components/` vs `src/shell/`?**
   - Known: it is presentational and tool-agnostic; `src/shell/` holds shell-wiring hooks, `src/components/` does not yet exist.
   - Recommendation: create `src/components/StatusBar.tsx` (cleaner neutral home). Planner decides; either keeps Phase-3 tests green as long as imports are fixed.

2. **Does CONTEXT's "registry.ts internals immovable" forbid adding tool entries?**
   - Known: registry.ts explicitly documents adding a tool = import + array entry; that's how Base64/Protobuf were enabled in prior phases.
   - Recommendation: treat array-entry additions as sanctioned registration (not an internals edit). Flag for the planner to confirm.

3. **ULID monotonicity for batches (D-16)?**
   - Known: UID-01 doesn't require monotonic batches; the spec defines optional monotonicity.
   - Recommendation: ship fresh-random-per-ULID for v1 (simpler, fully spec-valid). Monotonic batch is discretion, not required.

## Sources

### Primary (HIGH confidence)
- Local codebase (read in full): `src/lib/bytes.ts`, `src/tools/base64/{Base64Tool,useBytesConvert,StatusBar,index,Base64Tool.test}.tsx/ts`, `src/tools/protobuf-decoder/{ProtobufDecoder.tsx,index.ts}`, `src/lib/tools/{registry,types}.ts`, `src/shell/useCopyFeedback.ts`, `src/tools/unix-time/index.ts`, `src/tools/_placeholder/ToolPlaceholder.tsx`, `.planning/config.json`.
- Node 22 crypto/`js-md5` probe (this session): SHA-1/256/384/512 + `randomUUID` + `getRandomValues` present; md5/sha256 empty-string vectors; ULID + UUIDv7 vector computations.
- `js-md5@0.8.3` tarball `index.d.ts` + `src/md5.js` (npm pack): API surface + `Message = string | number[] | ArrayBuffer | Uint8Array`, named export `md5`.
- `github.com/ulid/spec` (WebFetch): alphabet, layout, 2^48−1 overflow.
- RFC 9562 §5.7 (UUIDv7 layout) — confirmed by reproducing the canonical example.

### Secondary (MEDIUM confidence)
- `npm view js-md5` → version 0.8.3, license MIT (registry).
- MDN SubtleCrypto / WebKit "Update on Web Cryptography" — secure-context gating, SHA-1 supported value.

### Tertiary (LOW confidence)
- Tauri secure-context behavior for `tauri://` (A1) — must be confirmed on the real WKWebView in the e2e gate.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive verified by Node probe + registry + package source.
- ULID / UUIDv7 algorithms + vectors: HIGH — reproduced deterministically.
- StatusBar/registry integration: HIGH — read directly; StatusBar already shared.
- WKWebView secure-context for Web Crypto: MEDIUM — verify in e2e (A1).

**Research date:** 2026-05-31
**Valid until:** ~2026-06-30 (stable native APIs + pinned js-md5; re-verify js-md5 version before install).

Sources:
- [ulid/spec](https://github.com/ulid/spec)
- [RFC 9562 (UUID)](https://www.rfc-editor.org/rfc/rfc9562)
- [MDN SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
- [WebKit: Update on Web Cryptography](https://webkit.org/blog/7790/update-on-web-cryptography/)
- [Tauri Configuration](https://v2.tauri.app/reference/config/)
