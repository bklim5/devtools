# Requirements: v1.6 Licensing

**Milestone goal:** One-time-payment lifetime license that unlocks full functionality — all 11 tools (including the Protobuf hero) stay free; Pro locks customization — theming and tool ordering/pinning — and is the declared home for future power features (D-18); activation binds the key to one machine with self-serve transfer.

**Source:** Deep research (multi-agent, adversarially verified) + four external review rounds, consolidated in `docs/licensing-research.md` (2026-06-09). Architecture locked via `/gsd-new-milestone` questioning, 2026-06-09.

**Binding constraints (inherited wedge, with ONE scoped amendment):** offline tools · paste-instant (<2s) · keyboard-driven · **registry is the single control plane** · HashRouter only · WCAG-AA · layout-agnostic · zero new runtime deps **in the webview** (Rust crates for licensing — `ed25519-dalek`/`keyring`/HMAC — are expected and allowed) · **`src/lib/protobuf/decoder.ts` + its 19 tests stay byte-for-byte untouched** · macOS real-WKWebView UI gate. **Amendment (v1.6, recorded in PROJECT.md):** "no network at runtime" gains a narrow licensing-only exception — one-time activation + opportunistic ~30-day TTL refresh; never per-launch checks; every tool remains fully functional offline.

**Architecture (locked — see `docs/licensing-research.md` for rationale):** Keygen perpetual + node-locked (`maxMachines=1`); unencrypted Ed25519-signed `machine.lic` verified in Rust (embedded public key + fingerprint `HMAC-SHA256(IOPlatformUUID, app-salt)`); license key in macOS Keychain (Rust-owned); React sees only `license_status`/`activate_license`/`refresh_license`/`deactivate_machine`; MoR checkout → webhook backend → Keygen license creation (privileged tokens server-side only); webview gating accepted as UX-gating, not DRM; OS-portable seams, macOS-only impl.

---

## v1 Requirements

### Entitlements & Gating (ENT)

- [x] **ENT-01**: `ToolDefinition` supports `requiredEntitlements?: string[]`; tool gating derives from the registry (sidebar, ⌘K palette, and router stay the single control plane — no scattered per-feature checks).
- [x] **ENT-02**: An app-level entitlement map gates non-tool features: theming and tool ordering/pinning.
- [x] **ENT-03**: Entitlements resolve through one central gate; React receives only the resolved entitlement set (via Rust command inside Tauri; a free-tier default in browser/test environments so jsdom/vite-preview never touch licensing).
- [x] **ENT-04**: Free tier locks **theming and tool ordering/pinning** (all 11 tools stay free — D-18 pivot). The tool-gating mechanism (lock badge in sidebar/palette + unlock/upsell panel in place of the tool UI) ships in full but **dormant**: no shipped tool carries `requiredEntitlements`. Locked features stay **visible** (not hidden; WCAG-AA, no opacity-only locked state).
- [x] **ENT-05**: Registry tool entries load via lazy `component` loaders (converting today's eager imports), making a future free-build decoder code-split exclusion a real seam — `decoder.ts` and its 19 tests untouched.

### License Lifecycle (LIC)

- [x] **LIC-01**: User can paste a license key in-app to activate; activation is a one-time online step that binds the key to this machine (fingerprint = `HMAC-SHA256(IOPlatformUUID, app-salt)`, computed in Rust).
- [x] **LIC-02**: Activation enforces the seat limit server-side — activating on a second Mac is rejected with a clear, calm error naming the resolution path (deactivate the other machine).
- [x] **LIC-03**: After activation, every launch verifies the license **fully offline**: Rust verifies the Ed25519 signature of the cached `machine.lic` with the embedded public key and checks the machine fingerprint — no network call.
- [x] **LIC-04**: The license key is stored in the macOS Keychain, Rust-owned, used only for TTL refresh and deactivation — never readable from JS, never in the Tauri store or app-data files.
- [ ] **LIC-05**: The cached license carries a ~30-day TTL; the app refreshes it opportunistically (background, online-only-when-available) with a generous offline grace — never a hard per-launch network check.
- [x] **LIC-06**: A corrupt, tampered, or foreign-machine `machine.lic` fails closed to the free tier — no crash, calm status messaging, re-activation offered.
- [ ] **LIC-07**: User can self-serve deactivate this machine from within the app, freeing the seat to activate on a new Mac (transfer).
- [x] **LIC-08**: A revoked/suspended license (refund or chargeback handled in Keygen) propagates to the app at the next TTL refresh — entitlements drop to free tier.
- [ ] **LIC-09**: A license status UI shows the current state (free / licensed / offline-grace / refresh-needed), masked key + licensee email from the signed license data, and refresh + deactivate actions — keyboard-reachable, WCAG-AA.

### Purchase Pipeline (PAY)

- [x] **PAY-01**: User can buy a lifetime license through a merchant-of-record checkout (one-time payment; Lemon Squeezy default pending a seller payout-country check); an in-app "Buy license" affordance opens the purchase page in the default browser.
- [x] **PAY-02**: A purchase-completed webhook triggers a small backend that creates the Keygen license (perpetual, node-locked, `maxMachines=1`, entitlements embedded in the signed key); privileged Keygen tokens exist **only** server-side — never in the app bundle.
- [x] **PAY-03**: The buyer receives the license key by email automatically after purchase.

---

## Ship gate (binding test matrix, beyond the standard harness)

1. Valid activation on first Mac · 2. second Mac rejected · 3. offline launch succeeds after activation · 4. corrupted `machine.lic` fails closed · 5. copied `machine.lic` fails on a different fingerprint · 6. TTL-expired behavior (grace → refresh) · 7. deactivate/transfer end-to-end · 8. revocation propagates on refresh.

---

## v1.7 Requirements — Settings & Preferences (SET)

A native macOS Settings/Preferences surface (promotes backlog 999.9; absorbs 999.3 theme settings + parked NAT-01/G-05-1 summon hotkey). **Architecture (locked):** a full **in-window modal overlay** (Claude-style) mounted shell-level via an `openSettings()` store (the upsell-modal pattern from Phase 21) — NOT a separate OS window (decision: lowest risk, reuses the single React root + prefs/entitlements/HashRouter; no multi-window/IPC). Native menu + tray entry points reach it through the `platform/` event seam.

### Surface & entry points

- [x] **SET-01**: User can open Settings from the macOS app menu (TinkerDev ▸ Settings…), bound to **⌘,** — the native menu item reaches the webview via the `platform/` event seam (no `@tauri-apps/*` import outside the seam).
- [x] **SET-02**: User can open Settings from the tray icon menu (a Settings… item), via the same event seam.
- [x] **SET-03**: User can open Settings from a sidebar "Settings" row (above "Unlock Pro") and from the ⌘K command palette.
- [x] **SET-04**: Settings renders as a full in-window modal overlay (Claude-style), Esc-dismissible, WCAG-AA (focus trap + return-focus to the invoker, `aria-modal`/`aria-labelledby`), reachable by everyone including unlicensed users (the License pane shows the no-license + Unlock-Pro state).
- [x] **SET-05**: Settings uses a paned layout (left nav list, right content pane), fully keyboard-navigable (move between panes, active pane announced via `aria`).

### Panes

- [x] **SET-06** (revised by Phase 22.1, Follow-up 2): The **License** pane hosts `LicenseSettings` (all 5 states). The not-Pro states (free/notActivated/problem/refreshNeeded) render the upsell/activation surface INLINE — free shows the full pitch + Buy + key-input + Activate; problem/refreshNeeded keep the calm status + Refresh with the key-input + Activate form inline below (no stacked modal-on-modal). licensed/offlineGrace unchanged. The standalone `UpsellModal` still opens from the sidebar "Unlock Pro" + ⌘K free-tier entries (D-22.1-5).
- [ ] **SET-07**: The **Appearance** pane lets the user choose theme (light/dark/system) and accent, persisted via the existing prefs seam and applied live (absorbs backlog 999.3).
- [ ] **SET-08**: The **Hotkeys** pane lets the user view and rebind (a) the global summon hotkey (Rust global-shortcut re-register + conflict handling — promotes NAT-01/G-05-1) and (b) the ⌘K command-palette hotkey (in-webview key handler keyed off the configured chord); both persist via the prefs seam.
- [ ] **SET-09**: The **General** pane exposes app-behavior toggles — candidates: launch-at-login, start-in-tray, default tool on open, show-license-status-in-sidebar (exact set finalized in planning; launch-at-login needs an autostart plugin → an explicit, scoped exception to the zero-new-dep wedge, decided at planning).
- [ ] **SET-10**: The **Updates** pane shows the current version + last-checked and offers Check-for-updates, reusing the existing updater seam (mirrors the tray action).

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
| ENT-01 | Phase 18 | 18-01, 18-02 | Complete |
| ENT-02 | Phase 18 | 18-01 | Complete |
| ENT-03 | Phase 18 | 18-01, 18-04 | Complete |
| ENT-04 | Phase 18 | 18-01, 18-03, 18-04 | Complete |
| ENT-05 | Phase 18 | 18-02, 18-04 | Complete |
| LIC-01 | Phase 19 | 19-03, 19-04 | Complete |
| LIC-02 | Phase 19 | 19-03, 19-04 | Complete |
| LIC-03 | Phase 19 | 19-02, 19-04 | Complete |
| LIC-04 | Phase 19 | 19-02, 19-03 | Complete |
| LIC-05 | Phase 21 | — | Pending |
| LIC-06 | Phase 19 | 19-02, 19-04 | Complete |
| LIC-07 | Phase 21 | — | Pending |
| LIC-08 | Phase 21 | 21-03 | Complete |
| LIC-09 | Phase 21 | — | Pending |
| PAY-01 | Phase 20 | 20-01 | Done |
| PAY-02 | Phase 20 | 20-02 | Done |
| PAY-03 | Phase 20 | 20-02 | Done |
| SET-01 | Phase 22 | 22-03 | Validated |
| SET-02 | Phase 22 | 22-03 | Validated |
| SET-03 | Phase 22 | 22-02 | Validated |
| SET-04 | Phase 22 | 22-01 | Validated |
| SET-05 | Phase 22 | 22-01 | Validated |
| SET-06 | Phase 22 → revised Phase 22.1 | 22-01 → 22.1-02 | Validated (revised: inline upsell) |
| SET-07 | Phase 23 | — | Pending |
| SET-08 | Phase 24 | — | Pending |
| SET-09 | Phase 24 | — | Pending |
| SET-10 | Phase 25 | — | Pending |
