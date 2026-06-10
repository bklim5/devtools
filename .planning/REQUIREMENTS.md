# Requirements: v1.6 Licensing

**Milestone goal:** One-time-payment lifetime license that unlocks full functionality — the free tier keeps core tools but locks the Protobuf decoder (hero), theming, and tool ordering/pinning; activation binds the key to one machine with self-serve transfer.

**Source:** Deep research (multi-agent, adversarially verified) + four external review rounds, consolidated in `docs/licensing-research.md` (2026-06-09). Architecture locked via `/gsd-new-milestone` questioning, 2026-06-09.

**Binding constraints (inherited wedge, with ONE scoped amendment):** offline tools · paste-instant (<2s) · keyboard-driven · **registry is the single control plane** · HashRouter only · WCAG-AA · layout-agnostic · zero new runtime deps **in the webview** (Rust crates for licensing — `ed25519-dalek`/`keyring`/HMAC — are expected and allowed) · **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched** · macOS real-WKWebView UI gate. **Amendment (v1.6, recorded in PROJECT.md):** "no network at runtime" gains a narrow licensing-only exception — one-time activation + opportunistic ~30-day TTL refresh; never per-launch checks; every tool remains fully functional offline.

**Architecture (locked — see `docs/licensing-research.md` for rationale):** Keygen perpetual + node-locked (`maxMachines=1`); unencrypted Ed25519-signed `machine.lic` verified in Rust (embedded public key + fingerprint `HMAC-SHA256(IOPlatformUUID, app-salt)`); license key in macOS Keychain (Rust-owned); React sees only `license_status`/`activate_license`/`refresh_license`/`deactivate_machine`; MoR checkout → webhook backend → Keygen license creation (privileged tokens server-side only); webview gating accepted as UX-gating, not DRM; OS-portable seams, macOS-only impl.

---

## v1 Requirements

### Entitlements & Gating (ENT)

- [x] **ENT-01**: `ToolDefinition` supports `requiredEntitlements?: string[]`; tool gating derives from the registry (sidebar, ⌘K palette, and router stay the single control plane — no scattered per-feature checks).
- [x] **ENT-02**: An app-level entitlement map gates non-tool features: theming and tool ordering/pinning.
- [x] **ENT-03**: Entitlements resolve through one central gate; React receives only the resolved entitlement set (via Rust command inside Tauri; a free-tier default in browser/test environments so jsdom/vite-preview never touch licensing).
- [x] **ENT-04**: Free tier locks the Protobuf decoder, theming, and ordering/pinning — locked tools stay **visible with a lock badge** in the sidebar/palette and show an unlock/upsell panel in place of the tool UI (not hidden; WCAG-AA, no opacity-only locked state).
- [ ] **ENT-05**: Registry tool entries load via lazy `component` loaders (converting today's eager imports), making a future free-build decoder code-split exclusion a real seam — `decoder.ts` and its 19 tests untouched.

### License Lifecycle (LIC)

- [ ] **LIC-01**: User can paste a license key in-app to activate; activation is a one-time online step that binds the key to this machine (fingerprint = `HMAC-SHA256(IOPlatformUUID, app-salt)`, computed in Rust).
- [ ] **LIC-02**: Activation enforces the seat limit server-side — activating on a second Mac is rejected with a clear, calm error naming the resolution path (deactivate the other machine).
- [ ] **LIC-03**: After activation, every launch verifies the license **fully offline**: Rust verifies the Ed25519 signature of the cached `machine.lic` with the embedded public key and checks the machine fingerprint — no network call.
- [ ] **LIC-04**: The license key is stored in the macOS Keychain, Rust-owned, used only for TTL refresh and deactivation — never readable from JS, never in the Tauri store or app-data files.
- [ ] **LIC-05**: The cached license carries a ~30-day TTL; the app refreshes it opportunistically (background, online-only-when-available) with a generous offline grace — never a hard per-launch network check.
- [ ] **LIC-06**: A corrupt, tampered, or foreign-machine `machine.lic` fails closed to the free tier — no crash, calm status messaging, re-activation offered.
- [ ] **LIC-07**: User can self-serve deactivate this machine from within the app, freeing the seat to activate on a new Mac (transfer).
- [ ] **LIC-08**: A revoked/suspended license (refund or chargeback handled in Keygen) propagates to the app at the next TTL refresh — entitlements drop to free tier.
- [ ] **LIC-09**: A license status UI shows the current state (free / licensed / offline-grace / refresh-needed), masked key + licensee email from the signed license data, and refresh + deactivate actions — keyboard-reachable, WCAG-AA.

### Purchase Pipeline (PAY)

- [ ] **PAY-01**: User can buy a lifetime license through a merchant-of-record checkout (one-time payment; Lemon Squeezy default pending a seller payout-country check); an in-app "Buy license" affordance opens the purchase page in the default browser.
- [ ] **PAY-02**: A purchase-completed webhook triggers a small backend that creates the Keygen license (perpetual, node-locked, `maxMachines=1`, entitlements embedded in the signed key); privileged Keygen tokens exist **only** server-side — never in the app bundle.
- [ ] **PAY-03**: The buyer receives the license key by email automatically after purchase.

---

## Ship gate (binding test matrix, beyond the standard harness)

1. Valid activation on first Mac · 2. second Mac rejected · 3. offline launch succeeds after activation · 4. corrupted `machine.lic` fails closed · 5. copied `machine.lic` fails on a different fingerprint · 6. TTL-expired behavior (grace → refresh) · 7. deactivate/transfer end-to-end · 8. revocation propagates on refresh.

---

## Future Requirements (deferred — recorded, not promised)

- **Multi-device tier** — a higher-priced tier raising `maxMachines` (architecture supports it as a policy change).
- **Free-build decoder exclusion** — a separate free build with the decoder chunk code-split out (ENT-05 reserves the seam).
- **Windows/Linux licensing impl** — fingerprint source + credential store per OS behind the same Rust commands; Linux needs keyring-absent fallback UX (Secret Service/libsecret not guaranteed).
- **Keygen production hosting decision** — paid Std cloud vs self-hosted CE (free Dev tier caps ~100 active licensed users / 10 releases; dev-only).
- **Key→token exchange upgrade** — if the P2 spike confirms client-side license-key → license-token generation, optionally store a scoped token instead of the raw key.

---

## Out of Scope (held)

- **Subscriptions / recurring billing** — one-time lifetime payment only.
- **User accounts / cloud sync** — the license key + machine file are the entire identity surface.
- **Per-launch or per-call network checks** — verification is local; network is activation + opportunistic TTL refresh only.
- **DRM-grade protection** — webview gates are patchable by a determined user; accepted. No obfuscation, no anti-debugging.
- **Rust rewrite of the decoder for protection** — `decoder.ts` is immovable; distribution-level exclusion (future free build) is the answer if ever needed.
- **Trials, coupons, regional pricing** — MoR features usable later without app changes; not v1.6 requirements.

---

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| ENT-01 | Phase 18 | — | Pending |
| ENT-02 | Phase 18 | — | Pending |
| ENT-03 | Phase 18 | — | Pending |
| ENT-04 | Phase 18 | — | Pending |
| ENT-05 | Phase 18 | — | Pending |
| LIC-01 | Phase 19 | — | Pending |
| LIC-02 | Phase 19 | — | Pending |
| LIC-03 | Phase 19 | — | Pending |
| LIC-04 | Phase 19 | — | Pending |
| LIC-05 | Phase 21 | — | Pending |
| LIC-06 | Phase 19 | — | Pending |
| LIC-07 | Phase 21 | — | Pending |
| LIC-08 | Phase 21 | — | Pending |
| LIC-09 | Phase 21 | — | Pending |
| PAY-01 | Phase 20 | — | Pending |
| PAY-02 | Phase 20 | — | Pending |
| PAY-03 | Phase 20 | — | Pending |
