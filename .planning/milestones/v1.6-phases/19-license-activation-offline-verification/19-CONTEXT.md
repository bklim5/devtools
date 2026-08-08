# Phase 19: License Activation & Offline Verification - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A user with a license key can activate this Mac once online and thereafter launch fully licensed, fully offline — all verification and key material Rust-owned, never in the webview. Covers LIC-01/02/03/04/06 + the key→token SPIKE. **Out of scope (Phase 21):** TTL refresh (LIC-05), self-serve transfer (LIC-07), revocation propagation (LIC-08), status UI (LIC-09), flipping the free-tier default. **Out of scope (Phase 20):** purchase pipeline, webhook backend, production Keygen hosting.

</domain>

<decisions>
## Implementation Decisions

### Activation UX
- **D-33:** Key entry lives **inline in the shared upsell panel** — the D-22 "I have a license key" slot reveals the form in place. D-29 footer row opens the same panel. One WCAG-AA surface, no new modal/route.
- **D-34:** In-flight feedback = submit disabled + **calm inline status line under the field** (`aria-live="polite"`), e.g. "Activating…". No spinner chrome, no stepper.
- **D-35:** Success = panel swaps to a calm **"Licensed — thank you" state the user dismisses** (Esc/button); entitlements unlock **live behind it, no restart** (criterion 1). Reuse the existing `refreshEntitlements()` live-flip path proven by the D-32 dev toggle.

### Error handling
- **D-36:** Seat-limit rejection (criterion 2) = calm message **naming the resolution path** ("deactivate it on the other Mac first") — **message only** in Phase 19. Support-link/transfer escape hatch explicitly deferred to Phase 21 (LIC-07) — see Deferred.
- **D-37:** All activation errors render **inline below the key field** (calm red-tint, `aria-live`), field keeps its value for correction. No toasts, no error dialogs.
- **D-38:** Network failures are **distinguished**: locally-detected offline ("You're offline — connect and try again") vs service-unreachable ("Can't reach the licensing service — try again shortly"). Two messages, retry = resubmit.
- **D-39:** Client-side pre-validation = **trim/normalize whitespace only** (paste-friendly); anything non-empty goes to the server. No key-format regex — Keygen is the validator.

### Keygen hosting & SPIKE
- **D-40:** **Self-hosted Keygen CE** (user decision; CE verified architecture-compatible: offline licensing, signed machine files, Ed25519 all core CE). **Phase 19 runs a local Docker CE instance on the dev Mac** (Docker confirmed installed; agent brings it up: `keygen/api` image + Postgres 13+ + Redis 6.2+, secrets via `openssl rand`, setup container creates the first-party account — no keygen.sh signup exists or is needed for CE). **Production hosting (VPS vs cloud fallback) deferred to Phase 20/21** when the webhook backend needs a public endpoint. `KEYGEN_HOST` and the account's Ed25519 public key are **per-environment config** so the prod swap is a constants change at the ship gate.
- **D-41:** Both embedded constants **committed in the repo** as compile-time consts: the Ed25519 **public** key (public by design — same posture as the minisign pubkey in tauri.conf.json) and the **app-salt** (only de-correlates fingerprints; license forgery requires the server-side Ed25519 *private* key, which never leaves the CE instance DB). Verified safe even if the repo is public. Real secrets (instance private key, admin tokens, CE `SECRET_KEY_BASE`/encryption keys) stay server-side / local gitignored env — never repo, never app bundle.
- **D-42:** **SPIKE is plan 01 and blocking**: key→token exchange (`license.tokens.generate` from the license principal) against the local CE instance; outcome decides what the Keychain stores (scoped token if confirmed, else raw key). The SPIKE doubles as the CE bring-up validation (instance + account + policy + test license + machine-file checkout all proven live before activation code is written).

### Fail-closed surfacing (corrupt/tampered/foreign machine.lic)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture (locked — do not re-litigate)
- `docs/licensing-research.md` — full locked architecture: Keygen, unencrypted Ed25519 machine.lic, fingerprint `HMAC-SHA256(IOPlatformUUID, app-salt)`, Keychain via `keyring`, 4-command Rust surface, TTL model, §"Open items" (SPIKE question + offline-grace)
- `.planning/phases/18-entitlements-seam-central-gate/18-CONTEXT.md` — D-18..D-32 (upsell panel D-19..D-22, footer D-29, downgrade-only override D-31)
- `.planning/REQUIREMENTS.md` — LIC-01..LIC-09 text (this phase: 01/02/03/04/06)

### Code seams this phase touches
- `src/lib/entitlements/resolve.ts` — THE Phase-21 flip point; this phase **builds** `license_status` but does **not** flip the Tauri arm
- `src/lib/platform/` — all Tauri access goes through here (tools never import `@tauri-apps/*`)
- `src-tauri/src/lib.rs` — thin Rust core; license module joins it; webdriver-feature pattern shows the build-gating idiom

### Verification
- `docs/HARNESS.md` — e2e gate runbook (ports, preflight, WebKit quirks)

### External (Keygen)
- https://keygen.sh/docs/self-hosting/ — CE requirements + setup (Docker, Postgres 13+, Redis 6.2+, secrets, Puma+Sidekiq)
- https://keygen.sh/docs/api/cryptography/ — Ed25519 machine-file verification
- https://keygen.sh/docs/api/authentication/ — license-key auth + the authz matrix behind the SPIKE
- https://keygen.sh/docs/choosing-a-licensing-model/offline-licenses/ — offline model
- https://github.com/keygen-sh/example-rust-cryptographic-machine-files — Rust verify reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UpsellPanel`/`UpsellModal` (Phase 18) — D-22 slot reserved for exactly this key-entry form; focus trap + WCAG-AA already proven
- D-29 footer "Unlock Pro" row — becomes the license-attention surface (D-43)
- `src/lib/entitlements/` store + `refreshEntitlements()` — live entitlement flip already proven by the D-32 dev toggle; activation success reuses it (D-35)
- `isTauriEnv()` / platform seam — env detection mirrored between gate and capability seam

### Established Patterns
- Rust core stays thin; plugins registered in `lib.rs`; build-excluded deps use Cargo features (webdriver precedent)
- v1.6 amendment allows Rust crates `ed25519-dalek`, `keyring`, HMAC; **webview runtime deps stay zero**
- Prefs store race: reads before `initPlatform` resolve to localStorage — license state deliberately bypasses the JS store (commands only), per research doc

### Integration Points
- `resolveEntitlements()` Tauri arm = Phase 21 flip point (untouched this phase)
- Upsell panel D-22 slot → activation form (D-33)
- lefthook unit gate (tsc + vitest + eslint) per commit; real-WKWebView e2e gate for UI surfaces; `cargo test` for the Rust license module (new — first phase with substantive Rust)

</code_context>

<specifics>
## Specific Ideas

- Calm, quiet UX throughout — no launch interruptions, no toasts, no spinner chrome; matches the app's existing tone
- "One user-initiated network call" is the entire Phase 19 network surface
- Committed constants must remain safe under a public repo (verified — D-41)

</specifics>

<deferred>
## Deferred Ideas

- **Seat-limit support/transfer escape hatch** — Phase 21 (LIC-07 self-serve transfer); **user explicitly asked for a follow-up reminder when planning Phase 21** (D-36)
- **Auto-heal on corrupt lic with Keychain key present** — Phase 21, rides opportunistic refresh (D-45)
- **Production CE hosting (VPS vs cloud fallback)** — decide at Phase 20 (webhook needs a public endpoint); KEYGEN_HOST/pubkey already per-env (D-40)
- **Offline-grace behavior when TTL lapses** — Phase 21 (research doc open item)

</deferred>

---

*Phase: 19-license-activation-offline-verification*
*Context gathered: 2026-06-12*
