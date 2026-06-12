# Phase 19: License Activation & Offline Verification - Research

**Researched:** 2026-06-12
**Domain:** Keygen CE self-hosting + Rust-side licensing (Ed25519 verify, Keychain, machine fingerprint, Tauri 2 commands)
**Confidence:** HIGH (most claims verified against the keygen-api source on GitHub master, crates.io registry, and official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Activation UX**
- **D-33:** Key entry lives **inline in the shared upsell panel** — the D-22 "I have a license key" slot reveals the form in place. D-29 footer row opens the same panel. One WCAG-AA surface, no new modal/route.
- **D-34:** In-flight feedback = submit disabled + **calm inline status line under the field** (`aria-live="polite"`), e.g. "Activating…". No spinner chrome, no stepper.
- **D-35:** Success = panel swaps to a calm **"Licensed — thank you" state the user dismisses** (Esc/button); entitlements unlock **live behind it, no restart** (criterion 1). Reuse the existing `refreshEntitlements()` live-flip path proven by the D-32 dev toggle.

**Error handling**
- **D-36:** Seat-limit rejection (criterion 2) = calm message **naming the resolution path** ("deactivate it on the other Mac first") — **message only** in Phase 19. Support-link/transfer escape hatch explicitly deferred to Phase 21 (LIC-07) — see Deferred.
- **D-37:** All activation errors render **inline below the key field** (calm red-tint, `aria-live`), field keeps its value for correction. No toasts, no error dialogs.
- **D-38:** Network failures are **distinguished**: locally-detected offline ("You're offline — connect and try again") vs service-unreachable ("Can't reach the licensing service — try again shortly"). Two messages, retry = resubmit.
- **D-39:** Client-side pre-validation = **trim/normalize whitespace only** (paste-friendly); anything non-empty goes to the server. No key-format regex — Keygen is the validator.

**Keygen hosting & SPIKE**
- **D-40:** **Self-hosted Keygen CE** (user decision; CE verified architecture-compatible: offline licensing, signed machine files, Ed25519 all core CE). **Phase 19 runs a local Docker CE instance on the dev Mac** (Docker confirmed installed; agent brings it up: `keygen/api` image + Postgres 13+ + Redis 6.2+, secrets via `openssl rand`, setup container creates the first-party account — no keygen.sh signup exists or is needed for CE). **Production hosting (VPS vs cloud fallback) deferred to Phase 20/21** when the webhook backend needs a public endpoint. `KEYGEN_HOST` and the account's Ed25519 public key are **per-environment config** so the prod swap is a constants change at the ship gate.
- **D-41:** Both embedded constants **committed in the repo** as compile-time consts: the Ed25519 **public** key (public by design — same posture as the minisign pubkey in tauri.conf.json) and the **app-salt** (only de-correlates fingerprints; license forgery requires the server-side Ed25519 *private* key, which never leaves the CE instance DB). Verified safe even if the repo is public. Real secrets (instance private key, admin tokens, CE `SECRET_KEY_BASE`/encryption keys) stay server-side / local gitignored env — never repo, never app bundle.
- **D-42:** **SPIKE is plan 01 and blocking**: key→token exchange (`license.tokens.generate` from the license principal) against the local CE instance; outcome decides what the Keychain stores (scoped token if confirmed, else raw key). The SPIKE doubles as the CE bring-up validation (instance + account + policy + test license + machine-file checkout all proven live before activation code is written).

**Fail-closed surfacing (corrupt/tampered/foreign machine.lic)**
- **D-43:** Discovery = **silent free-tier launch + footer hint**: no launch interruption; the D-29 footer row swaps to a "license needs attention" state; details on opening the panel.
- **D-44:** The panel shows a **distinct license-problem state** ("Your license file couldn't be verified" + key field pre-focused, pre-filled from Keychain when present) — a paying customer never sees the sales pitch.
- **D-45:** **Manual re-activation only** in Phase 19 — one user-initiated call is the phase's entire network surface; no unprompted launch-time network calls (v1.6 amendment: never per-launch checks). Auto-heal rides Phase 21's opportunistic-refresh machinery.

### Claude's Discretion
- Rust module layout, error enum design, exact command payload shapes (within the locked 4-command surface)
- `machine.lic` location within Rust-owned app data; atomic write strategy
- Exact copy/wording of statuses and errors (within the calm-tone decisions above)
- Keyboard semantics of the activation form (Enter submit / Esc dismiss — follow app conventions)
- Docker compose layout / local CE bootstrap scripting
- Whether `deactivate_machine` ships callable-but-unwired or gets a minimal affordance (LIC-07 UI is Phase 21 either way)

### Deferred Ideas (OUT OF SCOPE)
- **Seat-limit support/transfer escape hatch** — Phase 21 (LIC-07 self-serve transfer); **user explicitly asked for a follow-up reminder when planning Phase 21** (D-36)
- **Auto-heal on corrupt lic with Keychain key present** — Phase 21, rides opportunistic refresh (D-45)
- **Production CE hosting (VPS vs cloud fallback)** — decide at Phase 20 (webhook needs a public endpoint); KEYGEN_HOST/pubkey already per-env (D-40)
- **Offline-grace behavior when TTL lapses** — Phase 21 (research doc open item)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIC-01 | Paste key in-app → one-time online activation binding key to this machine (fingerprint = `HMAC-SHA256(IOPlatformUUID, app-salt)` in Rust) | §Activation Flow (3 verified API calls), §Fingerprint (ioreg pattern verified), §Standard Stack (hmac/sha2 pairing) |
| LIC-02 | Seat limit enforced server-side; second Mac rejected with calm error naming resolution | §Activation Flow step 2 (machine create 422 `MACHINE_LIMIT_EXCEEDED`, verified `limit_exceeded` validation in machine.rb), §Error Taxonomy |
| LIC-03 | Every launch verifies fully offline: Ed25519 sig of cached `machine.lic` + fingerprint check, zero network | §Machine File Format (verified from checkout-service source), §Offline Verify Algorithm, §Code Examples |
| LIC-04 | License key in macOS Keychain, Rust-owned, never readable from JS | §keyring crate (v3.6.3 `apple-native`), §Pitfall 5 (dev-build prompts), §Architecture Patterns (command-only surface) |
| LIC-06 | Corrupt/tampered/foreign `machine.lic` fails closed to free tier — no crash, calm messaging, re-activation offered | §Offline Verify Algorithm (every step returns a typed error → free tier), §Testing Strategy (fixture-driven corrupt/tampered/foreign cases) |
| SPIKE (D-42) | Key→token exchange outcome recorded; decides Keychain payload | §SPIKE Pre-Verification — source-level answer already found: **license principal CANNOT generate tokens** (dual-layer denial verified in keygen-api master); spike confirms empirically against the running CE |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Binding per-task DoD, in order:** `/simplify` → `/codex:review --wait --scope working-tree` → unit tests green (`vitest` + `tsc --noEmit`; decoder's 19 tests immovable; new features TDD their own) → real-WKWebView UI verification vs `design/`.
- **Phase boundary:** agent auto-runs `pnpm tauri build` at the human-verify checkpoint (updater-signing-key exit is expected; confirm bundle exists), hands off built-app path; sign-off = human walkthrough + passing `gsd-ui-review` WCAG-AA audit.
- **HashRouter only**; six tools only; **do not refactor `decoder.ts` or its 19 tests**; **no network at runtime** (v1.6 amendment: narrow licensing-only exception — one user-initiated activation call this phase, never per-launch checks).
- Tools/shell import **`src/lib/platform/`**, never `@tauri-apps/*` directly — the 4 license commands must be exposed through the platform seam.
- **Zero new runtime AND dev dependencies in the webview**; Rust crates `ed25519-dalek`/`keyring`/HMAC explicitly allowed (v1.6 amendment).
- Registry stays the single control plane; WCAG-AA with keyboard path + `aria-live` mandatory.
- lefthook gates every commit on `tsc + vitest + eslint` — **failing tests cannot land as standalone RED commits**; land tests GREEN with their impl (project memory: TDD RED commits blocked by lefthook).
- GSD workflow enforcement: file changes only through GSD commands.

## Summary

This phase has two halves: (1) bring up a local Keygen CE instance in Docker and prove the full license lifecycle against it (the blocking SPIKE plan), and (2) build the Rust license module — fingerprint, HTTP activation client, Ed25519 offline verification of `machine.lic`, Keychain storage — behind the locked 4-command surface, plus the activation form in the existing upsell panel.

Research went unusually deep because Keygen CE is open source: instead of relying on docs summaries, the actual authorization policies, permission catalogs, serializers, and the machine-file checkout service were read from `keygen-sh/keygen-api` master. This produced a **source-level answer to the SPIKE question before the spike runs**: the license principal cannot generate license tokens (the `LICENSE_PERMISSIONS` set lacks `license.tokens.generate`, AND `Licenses::TokenPolicy#create?` role-matches only admin/developer/sales_agent/environment/product — a `license` bearer hits `deny!`). The spike should still run as the CE bring-up validation D-42 demands, but the planner can assume the outcome: **the Keychain stores the raw license key**.

Two source-verified traps materially shape the plan: the policy's `authentication_strategy` defaults to `TOKEN`, so the bootstrap **must create the policy with `authenticationStrategy: "LICENSE"`** or every `Authorization: License <key>` call 403s; and CE runs Rails `force_ssl` behind a Caddy reverse proxy with a self-signed internal CA locally, so the Rust HTTP client needs a dev-only trust path for the local instance.

**Primary recommendation:** Plan 01 = CE bring-up + SPIKE (scripted compose + bootstrap, record outcome); Plan 02 = Rust license module TDD'd against locally-generated fixture certificates (pure verify logic needs no CE); Plan 03 = activation UX in the upsell panel through the platform seam. Use `ed25519-dalek 2.2`, `keyring 3.6` (`apple-native`), `hmac 0.12`+`sha2 0.10`, `reqwest 0.13` (rustls), and the `ioreg` subprocess for IOPlatformUUID.

## Standard Stack

### Core (Rust — src-tauri)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ed25519-dalek` | 2.2.0 | Verify machine.lic signature | Keygen's own Rust example uses it; the de-facto Ed25519 crate `[VERIFIED: crates.io 2026-05-28]` |
| `keyring` | 3.6.3 (NOT 4.x — see Pitfall 6) | License key in macOS Keychain | The standard cross-platform credential crate; v3 line is the mature API `[VERIFIED: crates.io]` |
| `hmac` | 0.12.x | Fingerprint HMAC-SHA256 | Pairs with sha2 0.10, sharing ed25519-dalek's existing `sha2 ^0.10` tree (verified dep) `[VERIFIED: crates.io deps]` |
| `sha2` | 0.10.x | SHA-256 for HMAC | Same RustCrypto line as ed25519-dalek's internal dep — one sha2 in tree `[VERIFIED: ed25519-dalek 2.2.0 depends on sha2 ^0.10]` |
| `base64` | 0.22.1 | Certificate + enc/sig decoding | Current stable `[VERIFIED: crates.io]` |
| `reqwest` | 0.13.x, features `["json", "rustls-tls"]`, `default-features = false` | The 3 activation HTTP calls | Standard async HTTP client; rustls avoids OpenSSL linkage `[VERIFIED: crates.io 0.13.4]` |
| `serde` / `serde_json` | already in tree | JSON:API payloads + machine.lic dataset | Already project deps `[VERIFIED: src-tauri/Cargo.toml]` |
| `thiserror` | 2.x | License error enum | Standard error derive `[ASSUMED — version check at impl time]` |

### Supporting (infra, not app deps)

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `keygen/api` Docker image | `latest` (multi-arch: **amd64 AND arm64 published** — native on this Apple Silicon Mac) | Local CE instance | Plan 01 bring-up `[VERIFIED: Docker Hub tags API]` |
| `postgres` | 17.5 (official compose pins this; CE requires ≥13) | CE database | compose service `[VERIFIED: keygen-api compose.yaml]` |
| `redis` | latest (CE requires ≥6.2) | CE Sidekiq/cache | compose service `[VERIFIED: keygen-api compose.yaml]` |
| `caddy` | latest | TLS termination (`tls internal` self-signed locally) | compose service — CE forces SSL `[VERIFIED: keygen-api Caddyfile + production.rb force_ssl=true]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ioreg` subprocess for IOPlatformUUID | `io-kit-sys`/`objc2_io_kit` FFI | FFI avoids a subprocess but adds unsafe code + a crate for one value read once per launch; the subprocess is the idiom proven by `machineid-rs` `[VERIFIED: machineid-rs src/macos.rs]` |
| `keyring` 3.6 | `keyring` 4.0.1 | v4 is a 1-month-old architectural rewrite requiring explicit store init (`use_native_store()`); its own README warns against migrating; v3.6 is battle-tested `[VERIFIED: keyring-rs README + docs.rs]` |
| Hand-rolled HMAC fingerprint | `machineid-rs` crate | machineid-rs bundles HWID+HMAC but adds a dep for ~20 lines we control; locked decision already allows hmac crate directly |
| `reqwest` | `tauri-plugin-http` | Plugin exposes HTTP to the webview — exactly what this phase must NOT do; reqwest stays Rust-only |
| Direct Rust integration | `tauri-plugin-keygen` (community) | No releases, community-maintained — already rejected in locked research doc |

**Installation (src-tauri/Cargo.toml additions):**
```toml
ed25519-dalek = "2.2"
keyring = { version = "3.6", features = ["apple-native"] }
hmac = "0.12"
sha2 = "0.10"
base64 = "0.22"
reqwest = { version = "0.13", default-features = false, features = ["json", "rustls-tls"] }
thiserror = "2"

[dev-dependencies]
ed25519-dalek = { version = "2.2", features = ["rand_core"] }  # test keypair generation for fixtures
rand = "0.8"  # rand_core 0.6-compatible OsRng (ed25519-dalek 2.x wants rand_core ^0.6.4)
```

**Version note:** `hmac 0.13`/`sha2 0.11` exist (newer RustCrypto line) but `ed25519-dalek 2.2` depends on `sha2 ^0.10` — using the 0.12/0.10 pairing keeps one sha2 in the tree. `[VERIFIED: crates.io dependency API]`

## Keygen CE Bring-Up (D-40 — concrete, source-verified)

### Official compose layout `[VERIFIED: keygen-sh/keygen-api master compose.yaml + Caddyfile + .env.sample]`

The keygen-api repo ships an official `compose.yaml` with services: `postgres` (17.5), `redis`, `web` (`keygen/api:latest`, command `web`, port 3000), `worker` (command `worker`), `caddy` (ports 80/443, reverse-proxies `web:3000`), plus profile-gated one-shots: `setup` (`bundle exec rails keygen:setup`, waits for pg_isready), `console` (rails console), `migrate`. The Caddyfile is two lines:

```
{$CADDY_HOSTS} {
    tls {$CADDY_ACME_EMAIL:internal}
    reverse_proxy web:3000
}
```

With `CADDY_ACME_EMAIL` unset, Caddy uses `tls internal` — a self-signed local CA. The Caddy root cert can be extracted: `docker cp <caddy-container>:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt` `[VERIFIED: .env.sample comments]`.

### Required .env (gitignored — D-41 real-secrets rule)

```bash
POSTGRES_USER=keygen
POSTGRES_PASSWORD="$(openssl rand -hex 16)"
POSTGRES_DB=keygen
REDIS_URL=redis://redis:6379
SECRET_KEY_BASE="$(openssl rand -hex 64)"
ENCRYPTION_DETERMINISTIC_KEY="$(openssl rand -base64 32)"
ENCRYPTION_PRIMARY_KEY="$(openssl rand -base64 32)"
ENCRYPTION_KEY_DERIVATION_SALT="$(openssl rand -base64 32)"
KEYGEN_EDITION=CE
KEYGEN_MODE=singleplayer
KEYGEN_ACCOUNT_ID="$(uuidgen | tr 'A-Z' 'a-z')"   # MUST be lowercase [VERIFIED: .env.sample]
KEYGEN_ADMIN_EMAIL=admin@example.com               # used by non-interactive setup
KEYGEN_ADMIN_PASSWORD="$(openssl rand -hex 16)"
KEYGEN_HOST=<hostname>                             # hostname, NOT an IP [VERIFIED: docs]
```

`[VERIFIED: .env.sample in keygen-api master — variable names, generation commands, and lowercase-account-ID note are verbatim from it]`

### Bring-up sequence

```bash
docker compose up -d postgres redis
docker compose run --rm setup       # runs `rails keygen:setup` — creates account (KEYGEN_ACCOUNT_ID) + admin user
docker compose up -d web worker caddy
```

CE is free, no registration, no license key needed `[VERIFIED: keygen.sh/docs/self-hosting]`.

### Local-host + TLS strategy (the one genuinely fiddly bit)

CE's Rails env sets `config.force_ssl = true` (HSTS, https redirect; only `/v*/health` excluded) `[VERIFIED: config/environments/production.rb]`. So the app cannot just call `http://localhost:3000`. Options for the dev Mac:

1. **Recommended:** `KEYGEN_HOST=keygen.local.test` (any non-IP hostname) + `/etc/hosts` entry `127.0.0.1 keygen.local.test` + Caddy `tls internal` + the Rust client trusting the extracted Caddy root cert. In dev builds only, read an env var (e.g. `DEVTOOLS_KEYGEN_CA=/path/caddy-root.crt`) and `reqwest::ClientBuilder::add_root_certificate()`. Production builds ignore the var (or it's compiled out) — pubkey/host are per-env consts anyway (D-40).
2. Alternative: dev-only `danger_accept_invalid_certs(true)` double-gated like the webdriver precedent (`#[cfg(debug_assertions)]` + opt-in env). Less setup, slightly uglier; acceptable for a local-only instance.
3. Fallback hack (avoid): plain HTTP to `web:3000` with a forged `X-Forwarded-Proto: https` header — works because Rails honors forwarded proto, but diverges from the prod call path. `[ASSUMED — Rails behavior, not tested here]`

Note: macOS does **not** automatically resolve arbitrary `*.localhost`/custom hostnames to loopback — the `/etc/hosts` entry is required. `[ASSUMED]`

### Bootstrap: product → policy → license (admin token)

After setup, authenticate as admin to get a token, then create resources. All endpoints are standard Keygen API paths under `https://{KEYGEN_HOST}/v1/accounts/{KEYGEN_ACCOUNT_ID}/...`:

1. **Admin token:** `POST /tokens` with HTTP Basic `email:password` (the setup admin credentials) `[VERIFIED: keygen.sh/docs/api/tokens — Basic auth email:password]`.
2. **Product:** `POST /products` (admin token) — name e.g. "TinkerDev".
3. **Policy:** `POST /policies` (admin token) — **critical attributes:**
   ```json
   {
     "data": { "type": "policies", "attributes": {
       "name": "perpetual-node-locked",
       "floating": false,
       "maxMachines": 1,
       "authenticationStrategy": "LICENSE",
       "expirationStrategy": "RESTRICT_ACCESS"
     }, "relationships": { "product": { "data": { "type": "products", "id": "<product-id>" } } } }
   }
   ```
   `authenticationStrategy` **defaults to `TOKEN`** — without `LICENSE` (or `MIXED`), every `Authorization: License <key>` call from the app is denied `[VERIFIED: policy.rb before_create default 'TOKEN' + docs "License key authentication can only be utilized if the license policy's authentication strategy is set to LICENSE or MIXED"]`. Note `floating: false` (node-locked) auto-defaults `max_machines = 1` server-side, but set it explicitly `[VERIFIED: policy.rb before_create]`. No `scheme` needed — machine-file signing is independent of license-key schemes and defaults to ed25519 `[VERIFIED: machine_checkout_service.rb — `else true` → default sign]`.
4. **License:** `POST /licenses` (admin token) — relationships: policy. Key autogenerates `[VERIFIED: license.rb autogenerate_key before_create]`.

### Where the account's Ed25519 public key comes from

`GET /v1/accounts/{id}` (admin token). The account serializer returns `meta.public_key` (RSA) and `meta.keys: { ed25519, rsa2048, ecdsa }` — **the ed25519 value is BASE64 of the raw 32-byte public key** (`Base64.strict_encode64(@object.ed25519_public_key)`) `[VERIFIED: app/serializers/account_serializer.rb lines 130-140]`. The cloud dashboard shows hex; CE's API gives base64 — decode base64 → 32 raw bytes → that's the compile-time const (commit as hex or base64 string, decode in Rust; D-41). The keypair is generated server-side at account creation and the private key never leaves the CE database.

## SPIKE Pre-Verification (D-42) — source-level answer

**Question:** can the license principal (license-key auth) generate a license token (`license.tokens.generate`) so the Keychain stores a scoped token instead of the raw key?

**Answer found in keygen-api master — NO, denied at two independent layers:**

1. **Permission layer:** `Permission::LICENSE_PERMISSIONS` (the maximal permission set a license bearer can hold) contains `token.read`, `token.regenerate`, `token.revoke` — but **NOT** `license.tokens.generate` and **NOT** `token.generate`. `license.tokens.generate` exists only in the broader (admin/product) permission sets. `[VERIFIED: app/models/permission.rb — LICENSE_PERMISSIONS list read in full]`
2. **Policy layer:** `Licenses::TokenPolicy#create?` requires the `license.tokens.generate` permission AND pattern-matches the bearer role to `admin | developer | sales_agent | environment` or `product` (own product) — a `role: license` bearer falls through to `deny!`. `[VERIFIED: app/policies/licenses/token_policy.rb]`

The earlier "authz matrix says yes" reading (research doc, medium confidence) conflated the permission *existing in the catalog* with the license principal *holding* it. The reviewer who said "token generation needs privileged auth" was right.

**Consequence for planning:** the SPIKE still runs (it's the CE bring-up validation and the empirical record D-42 requires), but the plan should assume its outcome: **Keychain stores the raw license key**. The spike's recorded outcome closes the research-doc open item. The "scoped token upgrade" future-requirement stays dead unless Keygen changes this server-side.

What the license principal CAN do (all source-verified, all that Phase 19 needs):
- `license.validate` — validate itself `[VERIFIED: LICENSE_PERMISSIONS]`
- `machine.create` — activate (MachinePolicy#create?: `role: Role(:license) if record.license == bearer` → allow) `[VERIFIED: machine_policy.rb]`
- `machine.check-out` — machine-file checkout (same license-role allow) `[VERIFIED: machine_policy.rb#check_out?]`
- `machine.delete` — deactivate own machine (same allow — `deactivate_machine` is implementable with key auth) `[VERIFIED: machine_policy.rb#destroy?]`

## Activation Flow (LIC-01/LIC-02 — the three online calls)

All under `https://{KEYGEN_HOST}/v1/accounts/{ACCOUNT_ID}`:

### 1. Validate key (pre-flight, UNAUTHENTICATED)
`POST /licenses/actions/validate-key` — the controller uses `authenticate_with_token` (optional-auth variant) for `validate_by_key`, vs `authenticate_with_token!` (required) for everything else — **no auth needed, the key in the body is the credential** `[VERIFIED: app/controllers/api/v1/licenses/actions/validations_controller.rb lines 10-11]`.

```json
{ "meta": { "key": "<pasted-key>", "scope": { "fingerprint": "<hmac-hex>" } } }
```

Response: `meta.valid` (bool), `meta.code`, `meta.detail`, `data` (license incl. `id` when found). Relevant codes `[VERIFIED: docs api/licenses]`:
- `VALID` — already activated on this fingerprint (re-activation path: skip to checkout)
- `NO_MACHINE` / `NO_MACHINES` — key exists, not yet activated → proceed to activate (this is the EXPECTED first-activation response; `valid` is `false` — do not treat as failure)
- `FINGERPRINT_SCOPE_MISMATCH` — activated, but on a DIFFERENT machine → seat taken (D-36 calm message)
- `NOT_FOUND` — bad key
- `SUSPENDED` / `EXPIRED` / `BANNED` — terminal states (calm error)

### 2. Activate machine
`POST /machines` with header `Authorization: License <key>` `[VERIFIED: docs api/authentication — License scheme; machine_policy.rb allows license bearer]`:

```json
{ "data": { "type": "machines",
    "attributes": { "fingerprint": "<hmac-hex>", "platform": "macOS", "name": "<hostname or 'Mac'>" },
    "relationships": { "license": { "data": { "type": "licenses", "id": "<license-id-from-step-1>" } } } } }
```

- Success: 201 with machine `id`.
- **Seat limit:** 422 with validation error from `machine.errors.add :base, :limit_exceeded, message: "machine count has exceeded maximum allowed for license (1)"` `[VERIFIED: machine.rb]` — serialized error `code` is `MACHINE_LIMIT_EXCEEDED` `[ASSUMED — Keygen's code derivation convention (attribute+key upcased); confirm exact string in the SPIKE]`. This is the LIC-02 / D-36 trigger.
- 403 `Forbidden` here usually means the policy's `authenticationStrategy` wasn't set to `LICENSE`/`MIXED` (Pitfall 1).

### 3. Check out machine file
`POST /machines/{machine-id}/actions/check-out?include=license,license.entitlements&ttl=2629746` with `Authorization: License <key>`:

- Do **NOT** pass `encrypt=1` — unencrypted is the locked architecture (verify with pubkey alone, no key retention needed for verification).
- `include=license,license.entitlements` embeds the license and its entitlements in the signed dataset — `license.entitlements` is in the service's `ALLOWED_INCLUDES` `[VERIFIED: machine_checkout_service.rb]`. Phase 21's entitlement resolution reads these from the verified file; include them NOW so machine.lic is forward-compatible.
- `ttl` default = 2629746s (1 month), minimum 3600 `[VERIFIED: docs api/machines]` — the default matches the locked ~30-day TTL model; explicit is fine.
- Response: machine-file object with `certificate` attribute (the `-----BEGIN MACHINE FILE-----` text) + `issued`/`expiry`/`ttl` meta.
- Signing algorithm: when the policy has no crypto scheme, the service falls to the default signer = **ed25519**, producing `alg: "base64+ed25519"` for unencrypted files `[VERIFIED: machine_checkout_service.rb scheme→sign mapping + docs cryptography]`.

Then: atomic-write `certificate` → `machine.lic` in app data; license key → Keychain; `refreshEntitlements()` flips live (D-35).

## Machine File Format & Offline Verify Algorithm (LIC-03/LIC-06)

### Certificate structure `[VERIFIED: machine_checkout_service.rb source + docs cryptography + Keygen Rust example]`

```
-----BEGIN MACHINE FILE-----
<base64 of {"enc": "...", "sig": "...", "alg": "base64+ed25519"}, wrapped at 80 cols>
-----END MACHINE FILE-----
```

- `enc` = base64 (strict) of the JSON dataset: `{ "meta": { "issued", "expiry", "ttl" }, "data": { <machine resource: id, attributes incl. fingerprint, relationships> }, "included": [ <license>, <entitlements...> ] }` `[VERIFIED: service renders meta+data+included, then strict-encodes]`
- `sig` = base64 of Ed25519 signature over the ASCII string `"machine/" + enc` (the prefix is literal; sign happens BEFORE the outer base64) `[VERIFIED: service `sign(enc, prefix: 'machine')` + docs + Rust example]`
- `alg` = `"base64+ed25519"` for unencrypted ed25519 (vs `"aes-256-gcm+ed25519"` for encrypted — reject it)

### Verify algorithm (fail closed at EVERY step → free tier, typed error for D-43/D-44)

1. Read `machine.lic` (missing → `NotActivated`, not an error state).
2. Strip `-----BEGIN MACHINE FILE-----` / `-----END MACHINE FILE-----`, remove all newlines/whitespace.
3. Base64-decode → parse JSON `{enc, sig, alg}` (any failure → `Corrupt`).
4. **Check `alg == "base64+ed25519"` exactly** — anything else (encrypted, RSA, unknown) → `Corrupt`/`UnsupportedAlg`. Never fall through to a weaker path.
5. Base64-decode `sig` (strict) → 64 bytes → `Signature::from_slice`.
6. `VerifyingKey::from_bytes(EMBEDDED_PUBKEY_32_BYTES)` → `verify_strict(format!("machine/{enc}").as_bytes(), &sig)` — failure → `Tampered` (foreign instance's file also lands here: different account keypair).
7. Base64-decode `enc` → parse dataset JSON (failure after a VALID signature should be near-impossible; still → `Corrupt`).
8. Extract `data.attributes.fingerprint`; compute local fingerprint; constant-time compare (`subtle` is already in tree via ed25519-dalek, or compare HMAC outputs via `Mac::verify_slice`) — mismatch → `ForeignMachine` (covers ship-gate case 5: copied machine.lic).
9. Record `meta.expiry` in the status payload but do **NOT** enforce TTL expiry this phase — grace/refresh behavior is Phase 21 (deferred). The planner should surface expiry in `license_status` so Phase 21 doesn't need a format change. `[ASSUMED — scoping judgment consistent with CONTEXT.md deferred list]`
10. Success → `Licensed { entitlements, expiry, ... }`.

Use `verify_strict` (rejects malleable/weak-key edge cases) rather than `verify` `[CITED: docs.rs/ed25519-dalek — verify_strict rationale]`.

## Fingerprint (LIC-01)

**Source:** `IOPlatformUUID` from the IORegistry. The proven pattern (used verbatim by `machineid-rs`) `[VERIFIED: machineid-rs src/macos.rs]`:

```rust
// ioreg -d2 -c IOPlatformExpertDevice → find line containing "IOPlatformUUID",
// split on '=', trim quotes → "264D91D9-...-..." (uppercase UUID string)
let output = Command::new("ioreg")
    .args(["-rd1", "-c", "IOPlatformExpertDevice"])
    .output()?;
```

Probed live on this Mac: `ioreg -rd1 -c IOPlatformExpertDevice` prints exactly one `"IOPlatformUUID" = "<uuid>"` line `[VERIFIED: ran on the dev machine]`. Note `libc` does NOT bind `gethostuuid(2)` (docs.rs 404), so the syscall route would need a manual `extern "C"` — the subprocess is simpler and runs once per launch `[VERIFIED: docs.rs/libc 404 for gethostuuid]`.

**Fingerprint:** `hex(HMAC-SHA256(key = APP_SALT, message = io_platform_uuid_string))` — keep the raw UUID out of any payload; only the HMAC leaves the machine (locked architecture). Use the UUID string exactly as ioreg prints it (uppercase, hyphenated) and document that normalization choice in code — changing it later invalidates every activation. `[ASSUMED — normalization is our choice; lock it in the plan]`

## Architecture Patterns

### Recommended Rust module layout (Claude's discretion area — recommendation)

```
src-tauri/src/
├── lib.rs              # registers .manage(LicenseState) + 4 commands; stays thin
└── license/
    ├── mod.rs          # LicenseManager: state machine, command impls
    ├── commands.rs     # #[tauri::command] wrappers (license_status, activate_license,
    │                   #   refresh_license, deactivate_machine)
    ├── verify.rs       # PURE: parse + Ed25519 verify + fingerprint check (no I/O, no tauri) ← cargo-test target
    ├── fingerprint.rs  # ioreg read + HMAC (I/O isolated; pure HMAC helper testable)
    ├── keygen_client.rs# reqwest calls: validate-key, activate, checkout (typed errors)
    ├── keychain.rs     # keyring Entry wrapper (service/user consts)
    ├── store.rs        # machine.lic read/atomic-write in app_data_dir
    └── config.rs       # per-env consts: KEYGEN_HOST, ACCOUNT_ID, ED25519_PUBKEY, APP_SALT (D-40/D-41)
```

**Key principle:** `verify.rs` takes `(certificate: &str, pubkey: &VerifyingKey, expected_fingerprint: &str)` and returns `Result<LicenseData, VerifyError>` — zero I/O, zero Tauri types → directly `cargo test`-able with fixtures.

### Pattern 1: Tauri 2 async commands + managed state

**What:** `LicenseManager` in `tauri::State`, async commands for the network calls.
**Gotcha (documented Tauri rule):** async commands with borrowed parameters — which includes `State<'_, T>` — **must return `Result`** `[CITED: v2.tauri.app/develop/calling-rust — async command borrowing note]`.

```rust
// Source: v2.tauri.app/develop/calling-rust (async commands + state pattern)
pub struct LicenseState(pub tokio::sync::Mutex<LicenseManager>);

#[tauri::command]
async fn activate_license(
    app: tauri::AppHandle,
    state: tauri::State<'_, LicenseState>,
    key: String,
) -> Result<LicenseStatusPayload, LicenseError> {   // Result REQUIRED (async + State<'_>)
    let mut mgr = state.0.lock().await;
    mgr.activate(&app, key.trim()).await
}

// lib.rs:
// .manage(LicenseState(Mutex::new(LicenseManager::new())))
// .invoke_handler(tauri::generate_handler![license_status, activate_license,
//                                          refresh_license, deactivate_machine])
```

Blocking bits (keyring, ioreg subprocess, file I/O) are fast one-shots; wrap in `tauri::async_runtime::spawn_blocking` if codex review flags executor blocking — keyring's macOS calls are synchronous `[ASSUMED — acceptable either way for sub-ms ops]`.

App-defined commands registered via `generate_handler!` are invokable from the main window without new capability entries (capabilities gate core/plugin permissions) `[ASSUMED — verify during impl; the existing webdriver/store capabilities file shows the project pattern]`.

`LicenseError` must serialize for the webview: implement `serde::Serialize` on the error enum (Tauri command errors must be Serialize) — return a **typed error code enum** (e.g. `"seatLimit" | "offline" | "serviceUnreachable" | "invalidKey" | "suspended" | "licenseProblem"`) so the D-36/D-37/D-38 copy lives in the webview, not in Rust strings.

### Pattern 2: Platform-seam exposure (project constraint)

The webview never imports `@tauri-apps/api` directly. Add to `src/lib/platform/`:
- `tauri.ts`: `invoke("license_status")` etc. via the existing platform plumbing
- `browser.ts`/`stub.ts`: deterministic free-tier/no-license stubs (browser + vitest never touch licensing — mirrors ENT-03)

`resolveEntitlements()` (`src/lib/entitlements/resolve.ts`) is **NOT flipped** this phase — Phase 19 builds `license_status` but the Tauri arm stays `FULL_SET` (verified the current code: flip point is one line, Phase 21's job).

### Pattern 3: D-38 offline vs unreachable distinction

reqwest error taxonomy maps cleanly: `err.is_connect()`/`err.is_timeout()` → "service unreachable"; pre-check local reachability via the webview's `navigator.onLine` (cheap, available in WKWebView) for the "you're offline" branch, or attempt + classify in Rust. Recommendation: classify in Rust (single source of truth): DNS-resolution/connection-refused vs OS-level "network down" errors; map `std::io::ErrorKind::NetworkUnreachable`-class causes to `offline`, the rest of connect failures to `serviceUnreachable` `[ASSUMED — exact reqwest error introspection to be confirmed in impl; both decisions D-38 needs are reachable from the error chain]`.

### Pattern 4: Atomic machine.lic write

Write `machine.lic.tmp` in the SAME directory (`app_data_dir()` → `~/Library/Application Support/{identifier}/`), then `std::fs::rename` (atomic on APFS same-volume). Tauri 2: `app.path().app_data_dir()` `[CITED: v2.tauri.app path API]`.

### Anti-Patterns to Avoid

- **Webview-visible key material:** never return the license key (even masked) from commands this phase; Keychain read stays inside Rust. LIC-09's masked display is Phase 21 and reads from the signed file's license data, not the Keychain.
- **Per-launch network:** `license_status` must be pure-local (read + verify machine.lic). The ONLY network call is user-initiated `activate_license` (D-45).
- **String-matching Keygen error messages:** match on HTTP status + JSON:API error `code` field, never on `detail`/`title` text.
- **Treating first-activation `valid: false, code: NO_MACHINE` as failure** — it's the expected pre-activation state.
- **Encrypted machine files:** `encrypt=1` would force retaining the key for verification — locked architecture says unencrypted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ed25519 verification | any custom curve math | `ed25519-dalek::VerifyingKey::verify_strict` | Constant-time, audited, malleability-safe |
| HMAC | manual SHA256(salt‖msg) | `hmac::Hmac<Sha256>` | Length-extension safe, constant-time verify via `Mac::verify_slice` |
| Keychain access | `security` CLI subprocess / raw Security.framework FFI | `keyring` 3.6 (`apple-native`) | ACL handling, error taxonomy, maintained |
| HTTP + TLS | raw TcpStream / curl subprocess | `reqwest` + rustls | Cert validation, redirects, timeouts, JSON |
| Seat counting / license state | any client-side seat logic | Keygen server-side validation codes | The entire point of online activation — server is the only honest seat counter |
| Base64/certificate parsing | regex over the PEM-ish block | strip markers + `base64` crate strict decode | The format is exactly "markers + wrapped base64" `[VERIFIED: checkout service source]` |

**Key insight:** every cryptographic and credential-storage primitive this phase needs has a canonical crate that the locked decisions already allow. The only genuinely custom logic is the small state machine (status resolution + fail-closed taxonomy) and the JSON:API request/response types — keep those pure and tested.

## Common Pitfalls

### Pitfall 1: Policy `authenticationStrategy` defaults to TOKEN
**What goes wrong:** machine activation/checkout with `Authorization: License <key>` returns 401/403 even though the key is valid.
**Why:** `policy.rb` defaults `authentication_strategy = 'TOKEN'`; license-key auth requires `LICENSE` or `MIXED` `[VERIFIED: source + docs]`.
**Avoid:** bootstrap script creates the policy with `"authenticationStrategy": "LICENSE"` explicitly. SPIKE asserts a license-key-authed `whoami`/machine call succeeds before declaring CE up.
**Warning sign:** validate-key works (unauthenticated) but everything else 403s.

### Pitfall 2: CE forces SSL — no plain-HTTP localhost path
**What goes wrong:** `http://localhost:3000` requests 301-redirect to https (or fail), and the Caddy cert is self-signed → reqwest rejects it.
**Why:** Rails `force_ssl = true` in the production image; Caddy `tls internal` locally `[VERIFIED: production.rb + Caddyfile]`.
**Avoid:** `/etc/hosts` hostname + extract Caddy root cert + dev-only `add_root_certificate` (see §Local-host + TLS strategy).
**Warning sign:** reqwest `invalid peer certificate` or endless 301s.

### Pitfall 3: First-activation validate-key returns `valid: false`
**What goes wrong:** treating `NO_MACHINE`/`NO_MACHINES` as a bad key and showing an error instead of proceeding to activate.
**Avoid:** branch on `meta.code`, not `meta.valid`. The activation state machine: `NO_MACHINE(S)` → activate; `VALID` → already activated here, go straight to checkout (idempotent re-activation, also the D-44 recovery path); `FINGERPRINT_SCOPE_MISMATCH` → seat taken elsewhere (D-36).

### Pitfall 4: Signature is over `"machine/" + enc`, not the decoded data
**What goes wrong:** verifying the signature against the decoded dataset bytes (or against the whole certificate) — always fails.
**Why:** Keygen signs the still-base64 `enc` string with a literal `machine/` prefix `[VERIFIED: checkout service `sign(enc, prefix: 'machine')`]`.
**Avoid:** `verify_strict(format!("machine/{enc}").as_bytes(), &sig)` — and the same prefix discipline (`license/`) if license files ever appear in Phase 21.

### Pitfall 5: macOS Keychain prompts in dev builds
**What goes wrong:** during `tauri dev`, each rebuilt binary is freshly ad-hoc-signed, so the Keychain ACL no longer matches the item creator → macOS shows "devtools-app wants to use your confidential information" prompts (or denies), repeatedly across rebuilds.
**Why:** Keychain item ACLs bind to the code-signing identity; ad-hoc signatures change every build. `[ASSUMED — well-known macOS behavior; not re-verified this session]`
**Avoid:** don't let unit tests touch the real Keychain (mock the keychain module trait); make e2e specs avoid Keychain-dependent paths; the human walkthrough on the signed `tauri build` artifact is where real Keychain behavior is verified (stable signature within a build). Expect and document the dev-time prompt.
**Warning sign:** keyring `get_password` errors only under `tauri dev` after rebuilds.

### Pitfall 6: keyring v4 is a trap for this use case
**What goes wrong:** `cargo add keyring` pulls 4.0.1, which restructured the crate around `keyring-core` + explicit store initialization (`use_native_store()`); examples/docs in the wild target v3 API and silently mismatch.
**Why:** v4 released 2026-05; its own README warns existing apps off it `[VERIFIED: keyring-rs README + crates.io]`.
**Avoid:** pin `keyring = { version = "3.6", features = ["apple-native"] }`. Without the `apple-native` feature, v3 has NO macOS store and entries fail at runtime.

### Pitfall 7: lefthook blocks RED commits; cargo test isn't in the gate
**What goes wrong:** planning a standalone failing-fixture commit, or assuming `cargo test` runs automatically per commit.
**Why:** lefthook gate = tsc + vitest + eslint (project memory); this is the first phase with substantive Rust.
**Avoid:** land Rust tests GREEN with their impl; plan must state explicitly when `cargo test --manifest-path src-tauri/Cargo.toml` runs (recommend: per-task DoD addition for Rust tasks + consider adding to lefthook in this phase).

### Pitfall 8: Old Docker toolchain on the dev Mac
**What goes wrong:** the official `compose.yaml` uses service `profiles` (`setup`, `console`, `migrate`); the installed Compose is `2.0.0-beta.3` (2021) and the Docker CLI is `20.10.7` — profile and `docker compose run` behavior in that beta is unreliable; the daemon was also down at research time.
**Avoid:** Plan 01 first task: start Docker Desktop, and update it if `docker compose version` < 2.x stable (or fall back to `docker compose -f ... up <service>` without profiles by splitting the bootstrap into explicit `docker run` commands like the docs' setup example).
**Warning sign:** `docker compose run --rm setup` erroring on the `profiles` key. `[VERIFIED: probed locally — Docker 20.10.7, Compose 2.0.0-beta.3, daemon DOWN]`

### Pitfall 9: keygen/api image arch
**Not actually a problem — verified:** `keygen/api:latest` publishes both amd64 AND arm64 — native on this arm64 Mac, no Rosetta needed `[VERIFIED: Docker Hub tags API]`. (The self-hosting docs' "x86_64 with SSE 4.2" note predates multi-arch publishing.) If an older pinned tag is used instead of `latest`, re-check its arch.

## Code Examples

### Verify machine.lic (the LIC-03/LIC-06 core)

```rust
// Sources: keygen-sh/example-rust-cryptographic-machine-files (parsing pattern, adapted
// from encrypted→unencrypted) + machine_checkout_service.rb (format ground truth)
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, VerifyingKey};

#[derive(serde::Deserialize)]
struct Envelope { enc: String, sig: String, alg: String }

pub fn verify_machine_file(
    cert: &str,
    pubkey: &VerifyingKey,
    expected_fingerprint: &str,
) -> Result<Dataset, VerifyError> {
    let body: String = cert
        .trim()
        .strip_prefix("-----BEGIN MACHINE FILE-----").ok_or(VerifyError::Corrupt)?
        .strip_suffix("-----END MACHINE FILE-----").ok_or(VerifyError::Corrupt)?
        .chars().filter(|c| !c.is_whitespace()).collect();

    let env: Envelope = serde_json::from_slice(
        &B64.decode(&body).map_err(|_| VerifyError::Corrupt)?,
    ).map_err(|_| VerifyError::Corrupt)?;

    if env.alg != "base64+ed25519" { return Err(VerifyError::UnsupportedAlg); }

    let sig_bytes = B64.decode(&env.sig).map_err(|_| VerifyError::Corrupt)?;
    let sig = Signature::from_slice(&sig_bytes).map_err(|_| VerifyError::Corrupt)?;
    pubkey
        .verify_strict(format!("machine/{}", env.enc).as_bytes(), &sig)
        .map_err(|_| VerifyError::Tampered)?;

    let dataset: Dataset = serde_json::from_slice(
        &B64.decode(&env.enc).map_err(|_| VerifyError::Corrupt)?,
    ).map_err(|_| VerifyError::Corrupt)?;

    // constant-time-adequate: both sides are fixed-length hex HMAC outputs
    if dataset.machine_fingerprint() != expected_fingerprint {
        return Err(VerifyError::ForeignMachine);
    }
    Ok(dataset)
}
```

### Fingerprint

```rust
// Sources: machineid-rs src/macos.rs (ioreg pattern, VERIFIED) + RustCrypto hmac docs
use hmac::{Hmac, Mac};
use sha2::Sha256;

fn io_platform_uuid() -> Result<String, FingerprintError> {
    let out = std::process::Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"]).output()?;
    let text = String::from_utf8(out.stdout)?;
    text.lines()
        .find(|l| l.contains("IOPlatformUUID"))
        .and_then(|l| l.split('=').nth(1))
        .map(|s| s.trim().trim_matches('"').to_string())
        .ok_or(FingerprintError::NotFound)
}

pub fn fingerprint(app_salt: &[u8]) -> Result<String, FingerprintError> {
    let uuid = io_platform_uuid()?;
    let mut mac = Hmac::<Sha256>::new_from_slice(app_salt).expect("any key length ok");
    mac.update(uuid.as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}
```

### Test fixture generation (no CE needed for verify tests)

```rust
// Pure-Rust fixture: generate a keypair, construct a certificate exactly like
// machine_checkout_service.rb does (VERIFIED format), then assert verify behavior.
use ed25519_dalek::{Signer, SigningKey};

fn make_fixture(fingerprint: &str) -> (String, VerifyingKey) {
    let sk = SigningKey::generate(&mut rand::rngs::OsRng);
    let dataset = serde_json::json!({
        "meta": { "issued": "2026-06-12T00:00:00Z", "expiry": "2026-07-12T00:00:00Z", "ttl": 2629746 },
        "data": { "type": "machines", "id": "test-id",
                  "attributes": { "fingerprint": fingerprint } },
        "included": []
    });
    let enc = B64.encode(dataset.to_string());
    let sig = B64.encode(sk.sign(format!("machine/{enc}").as_bytes()).to_bytes());
    let doc = serde_json::json!({ "enc": enc, "sig": sig, "alg": "base64+ed25519" });
    let body = B64.encode(doc.to_string());
    let cert = format!("-----BEGIN MACHINE FILE-----\n{body}\n-----END MACHINE FILE-----");
    (cert, sk.verifying_key())
}
// Cases: happy path · flipped byte in enc (Tampered) · truncated file (Corrupt) ·
// alg="aes-256-gcm+ed25519" (UnsupportedAlg) · different keypair (Tampered = foreign
// instance) · wrong fingerprint (ForeignMachine) · empty/garbage (Corrupt)
```

After the SPIKE, additionally commit ONE real CE-issued `machine.lic` fixture (with its instance pubkey) as a cross-validation test — proves our parser against real server output, not just our own fixture constructor.

### Keychain

```rust
// Source: docs.rs/keyring 3.6 — v3 API, apple-native feature
use keyring::Entry;
const SERVICE: &str = "com.tinkerdev.devtools.license"; // match bundle identifier convention
const USER: &str = "license-key";

fn store_key(key: &str) -> keyring::Result<()> { Entry::new(SERVICE, USER)?.set_password(key) }
fn read_key() -> keyring::Result<String>      { Entry::new(SERVICE, USER)?.get_password() }
fn delete_key() -> keyring::Result<()>        { Entry::new(SERVICE, USER)?.delete_credential() }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Keygen example repo's `ed25519-dalek 1.0`, `base64 0.13` | `ed25519-dalek 2.2` (`VerifyingKey`/`verify_strict`), `base64 0.22` (Engine API) | dalek 2.0 (2023), base64 0.21+ (2023) | Example repo code does NOT compile against current crates — port the logic, not the code `[VERIFIED: example Cargo.toml vs crates.io]` |
| `keyring` 3.x built-in stores | `keyring` 4.x store-picker over `keyring-core` | 4.0 (2026-05) | Stay on 3.6 this phase (Pitfall 6) |
| Keygen docs "x86_64 only" for CE | Multi-arch `keygen/api` (amd64+arm64) | verified current | Native Apple Silicon Docker, no emulation |
| Research-doc "license principal may hold `license.tokens.generate` (medium confidence)" | Source-verified: it does NOT, and the policy role-match additionally denies | this research | SPIKE outcome pre-determined: raw key in Keychain |

**Deprecated/outdated:**
- `tauri-plugin-keygen` (community): no releases — already rejected; direct integration confirmed as the path.
- `[target.'cfg(debug_assertions)'.dependencies]`: doesn't work (project already learned this — use Cargo features for any build-gated dep, webdriver precedent).

## Runtime State Inventory

Not applicable — greenfield feature phase (no rename/refactor/migration). Omitted per template rule.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Serialized seat-limit error `code` is exactly `MACHINE_LIMIT_EXCEEDED` | Activation Flow step 2 | Error-mapping misses → generic error instead of D-36 message. SPIKE records the exact string |
| A2 | macOS Keychain re-prompts when ad-hoc-signed dev binaries change between rebuilds | Pitfall 5 | Dev-time annoyance handled differently; no shipped impact |
| A3 | App-defined Tauri commands need no new capability entries | Pattern 1 | One-line capability addition if wrong; caught immediately at first invoke |
| A4 | reqwest error chain distinguishes OS-offline vs connection-refused well enough for D-38's two messages | Pattern 3 | May need `navigator.onLine` assist from webview for the "offline" branch |
| A5 | Fingerprint normalization: use ioreg's uppercase hyphenated UUID string verbatim as HMAC input | Fingerprint | None if locked now; changing later orphans activations |
| A6 | Phase 19 records but does not enforce machine.lic `expiry` (TTL handling = Phase 21) | Verify algorithm step 9 | If planner wants expiry enforced now, it's one extra check — but grace UX is explicitly deferred |
| A7 | macOS needs an explicit /etc/hosts entry for the local KEYGEN_HOST hostname | CE bring-up | One-line bootstrap addition either way |
| A8 | `thiserror` 2.x current | Standard Stack | Trivial — check at impl |
| A9 | X-Forwarded-Proto plain-HTTP fallback works against force_ssl | TLS strategy option 3 | Not recommended anyway; options 1/2 are verified-safe |

## Open Questions

1. **Exact `MACHINE_LIMIT_EXCEEDED` error payload shape from CE** (A1)
   - What we know: validation message verified in source; Keygen serializes validation errors as JSON:API errors with a `code`.
   - What's unclear: exact `code` string and HTTP status (expect 422).
   - Recommendation: SPIKE explicitly triggers a second-machine activation and records the full error JSON — it's ship-gate case 2 anyway.
2. **Whether to add `cargo test` to the lefthook gate this phase**
   - What we know: gate is tsc+vitest+eslint; this is the first substantive-Rust phase.
   - Recommendation: planner decides; minimum bar = `cargo test` in each Rust task's DoD + the phase-boundary build. Adding to lefthook costs commit latency (cold cargo builds) — consider `cargo test --quiet` with warm target dir, or a pre-push hook instead.
3. **Where the SPIKE outcome is recorded**
   - Recommendation: a short `19-SPIKE-OUTCOME.md` in the phase dir (key→token denial confirmation + exact error payloads + CE pubkey extraction transcript), referenced by STATE.md — satisfies the "SPIKE outcome recorded" success criterion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker CLI | CE instance (D-40) | ✓ (daemon DOWN at probe) | 20.10.7 (2021 — OLD) | Start Docker Desktop; update recommended (Pitfall 8) |
| Docker Compose | compose.yaml profiles | ⚠ | 2.0.0-beta.3 (beta, 2021) | Update Docker Desktop, or script explicit `docker run` per docs setup example |
| keygen/api image (arm64) | CE on Apple Silicon | ✓ (multi-arch on Hub) | latest | — |
| openssl | secret generation | ✓ | 3.6.1 | — |
| rustc / cargo | Rust module + cargo test | ✓ | 1.96.0 | — |
| ioreg | fingerprint source | ✓ (probed, emits IOPlatformUUID) | macOS builtin | — |
| uuidgen | KEYGEN_ACCOUNT_ID | ✓ | macOS builtin | — |

**Missing dependencies with no fallback:** none.
**Action needed:** Docker daemon must be started (and toolchain ideally updated) before Plan 01 — make it the SPIKE's first checklist item.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (webview) | Vitest (existing, 816 tests green) + tsc + eslint via lefthook |
| Framework (Rust) | `cargo test` (NEW this phase — first substantive Rust module) |
| Config file | `vitest` config existing; cargo tests need no config — Wave 0 adds `src-tauri/src/license/verify.rs` test module + fixtures |
| Quick run command | `pnpm vitest run` · `cargo test --manifest-path src-tauri/Cargo.toml` |
| Full suite command | lefthook gate (tsc+vitest+eslint) + cargo test + real-WKWebView e2e (`scripts/e2e-spike.sh`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIC-01 | Fingerprint = HMAC-SHA256(UUID, salt); activation state machine (validate→activate→checkout) | cargo unit (pure HMAC + state machine w/ mocked client) | `cargo test --manifest-path src-tauri/Cargo.toml license::` | ❌ Wave 0 |
| LIC-01 | Activation form UX (D-33/34/35: inline form, aria-live status, live unlock) | vitest (jsdom, platform stub) + e2e UI states | `pnpm vitest run src/` | ❌ Wave 0 |
| LIC-02 | Seat-limit error → D-36 calm message | vitest (stubbed `seatLimit` error code) + LIVE against CE (SPIKE/walkthrough) | `pnpm vitest run` (mapping); manual for live | ❌ Wave 0 |
| LIC-03 | Offline verify: valid file + matching fingerprint → licensed, zero network | cargo unit (fixture certs) | `cargo test ... verify` | ❌ Wave 0 |
| LIC-04 | Key only in Keychain; JS surface exposes no key material | cargo unit (keychain trait mock) + grep-style assertion that no command payload contains the key; real Keychain = human walkthrough on built app | `cargo test` + manual | ❌ Wave 0 |
| LIC-06 | Corrupt/tampered/foreign/wrong-alg → typed fail-closed errors → free tier + D-43/D-44 UI states | cargo unit (7 fixture cases) + vitest (UI state per error code) + e2e (footer hint + panel problem-state, drivable by seeding a bad machine.lic) | `cargo test` + `pnpm vitest run` | ❌ Wave 0 |
| D-42 | SPIKE: CE up, full lifecycle proven, token-denial recorded | scripted spike runbook (not CI) — outcome doc | manual/scripted, recorded in 19-SPIKE-OUTCOME.md | ❌ Wave 0 |

**Manual-only justification:** live activation against CE, real-Keychain behavior, and Docker bring-up cannot run in CI/lefthook (network + daemon + signing identity); they are SPIKE-scripted and human-walkthrough items per the project's existing native-input precedent.

### Sampling Rate
- **Per task commit:** lefthook (tsc+vitest+eslint) — automatic; Rust tasks add `cargo test` to their DoD explicitly
- **Per wave merge:** full vitest + cargo test + tsc
- **Phase gate:** full suite + real-WKWebView e2e (15 existing specs + new license specs) + `pnpm tauri build` + human walkthrough w/ local CE running + `gsd-ui-review` WCAG-AA audit

### Wave 0 Gaps
- [ ] `src-tauri/src/license/verify.rs` (+ inline `#[cfg(test)]` fixture-driven tests) — LIC-03/LIC-06
- [ ] `src-tauri/src/license/fingerprint.rs` HMAC unit tests — LIC-01
- [ ] dev-deps: `ed25519-dalek` `rand_core` feature + `rand` for fixture keygen
- [ ] `src/lib/platform/` license command stubs (browser/stub arms) so vitest never touches Tauri — LIC-01/02/06 UI tests
- [ ] e2e spec `test/e2e/license.e2e.ts` for offline-reachable UI states (panel form, error rendering, footer attention state)
- [ ] `scripts/keygen-ce/` bring-up + bootstrap scripts (compose.yaml, .env.example, bootstrap.sh) — SPIKE infrastructure

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | License-key auth to Keygen only over TLS; key never logged, never in JS, Keychain-only at rest |
| V3 Session Management | no | No sessions — stateless key auth + signed file |
| V4 Access Control | yes | Server-side seat enforcement (Keygen policy); client never decides seats |
| V5 Input Validation | yes | Fail-closed certificate parsing (typed errors, exact-alg check, strict base64); serde with `deny_unknown_fields` optional but strict types required |
| V6 Cryptography | yes | `ed25519-dalek verify_strict` + `hmac`/`sha2` — never hand-rolled; public key + salt are compile-time consts (D-41, verified safe-if-public) |
| V8 Data Protection | yes | Raw IOPlatformUUID never leaves the machine (HMAC only); machine.lic is integrity-protected, not secret |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered/forged machine.lic | Tampering | Ed25519 `verify_strict` over `"machine/"+enc`; forgery requires server-side private key (never leaves CE DB) |
| machine.lic copied to another Mac | Spoofing | Fingerprint HMAC compare (ship-gate case 5) |
| Key exfiltration via webview inspection | Info disclosure | Key Rust-owned (Keychain); commands return status/entitlements only — never key material |
| Algorithm-confusion (encrypted/RSA file fed to verifier) | Tampering | Exact `alg == "base64+ed25519"` check, fail closed |
| MITM on activation | Tampering | rustls TLS; dev-only trust additions double-gated out of release builds (webdriver precedent) |
| Malicious deep link / argv triggering license calls | Elevation | Existing single-instance argv-ignore posture; activation is panel-initiated only (D-45) |
| Webview gate patching | — | Accepted as UX-gating, not DRM (locked architecture; out of scope) |

## Sources

### Primary (HIGH confidence — source code & registries)
- `keygen-sh/keygen-api` master (GitHub raw): `compose.yaml`, `Caddyfile`, `.env.sample`, `app/models/permission.rb` (LICENSE_PERMISSIONS), `app/models/policy.rb` (auth-strategy default), `app/models/machine.rb` (limit_exceeded), `app/models/license.rb`, `app/policies/machine_policy.rb` (create/destroy/check_out role allows), `app/policies/licenses/token_policy.rb` (token-generate denial), `app/controllers/api/v1/licenses/actions/validations_controller.rb` (validate-key optional auth), `app/serializers/account_serializer.rb` (meta.keys.ed25519 base64), `app/services/machine_checkout_service.rb` (certificate format, sign prefix, ALLOWED_INCLUDES), `config/environments/production.rb` (force_ssl)
- crates.io API: ed25519-dalek 2.2.0 (+ dep tree: sha2 ^0.10), keyring 3.6.3/4.0.1, hmac 0.13/0.12, sha2, base64 0.22.1, reqwest 0.13.4, hex
- Docker Hub API: `keygen/api:latest` amd64+arm64
- `Taptiive/machineid-rs` `src/macos.rs` — ioreg IOPlatformUUID pattern
- Local probes: Docker 20.10.7/Compose 2.0.0-beta.3/daemon down, arm64, openssl 3.6.1, rustc 1.96.0, ioreg output
- Project code: `src-tauri/src/lib.rs`, `Cargo.toml`, `src/lib/entitlements/*`, `src/lib/platform/` listing

### Secondary (MEDIUM-HIGH — official docs via WebFetch)
- keygen.sh/docs/self-hosting (CE setup, env vars, free/no-registration)
- keygen.sh/docs/api/cryptography (certificate format, ED25519_SIGN, machine/ prefix)
- keygen.sh/docs/api/machines (checkout ttl default/min, params)
- keygen.sh/docs/api/licenses (validate-key codes)
- keygen.sh/docs/api/authentication (License auth scheme, LICENSE/MIXED constraint)
- keygen.sh/docs/api/tokens (Basic email:password for admin tokens)
- github.com/keygen-sh/example-rust-cryptographic-machine-files (verify flow + Cargo.toml)
- docs.rs/keyring (v4 store-init model), keyring-rs README (v4 migration warning)
- v2.tauri.app/develop/calling-rust (async command + State Result rule) `[CITED, not re-fetched]`

### Tertiary (LOW — flagged in Assumptions Log)
- macOS Keychain ACL/ad-hoc-signing prompt behavior (A2); Tauri capability defaults for app commands (A3); reqwest offline-error introspection (A4)

## Metadata

**Confidence breakdown:**
- Keygen CE bring-up & API behavior: HIGH — verified against the CE source itself, not just docs
- SPIKE answer (token denial): HIGH — dual-layer denial read directly from master; only residual risk is the Docker image lagging master (longstanding policy, low risk)
- Standard stack: HIGH — all versions registry-verified today
- Rust verify logic: HIGH — format verified from the generating service's source + official example
- macOS Keychain dev-build behavior: MEDIUM — flagged assumption, mitigated by test strategy
- Tauri command patterns: MEDIUM-HIGH — stable, documented patterns; two small assumptions flagged

**Research date:** 2026-06-12
**Valid until:** ~2026-07-12 (crate versions, Docker image tags); keygen-api source findings stable longer

---
*Phase: 19-license-activation-offline-verification*
