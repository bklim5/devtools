# Phase 6: Distribution - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A signed, DMG-packaged, distributable macOS release with a wired, signature-verifying auto-updater. Delivers DST-01 (code-signed + notarised DMG that installs past Gatekeeper) and DST-02 (auto-updater that verifies updates before applying).

**Scope anchor for this phase:** Build *everything* to a "release-ready, pending cert" state — DMG packaging, ad-hoc signing, the full auto-updater (UX + signature verification + endpoint wiring), and all signing/notarisation config — such that real Developer-ID signing + notarisation become a single config-flip + credential step the moment the user enrols in the Apple Developer Program. The notarisation/Gatekeeper-clean clause of DST-01 is verified later when the cert exists; it does **not** block phase completion.

**Explicitly NOT in this phase (→ deferred CI phase):** the GitHub Actions release pipeline, secret migration to CI, and tag/merge-driven version automation. See Deferred Ideas.
</domain>

<decisions>
## Implementation Decisions

### Signing & Notarisation
- **D-01:** Apple Developer Program status = **not enrolled yet**. Therefore notarisation + Developer ID signing cannot run during this phase.
- **D-02:** Strategy = **wire everything, gate notarisation on the cert.** This phase ships DMG packaging + ad-hoc signing + the full updater + all config. Developer-ID signing + notarisation activate via a config-flip + credentials once the user enrols. Phase is considered complete in a "release-ready, pending cert" state; the "no Gatekeeper warnings" acceptance is re-verified post-enrolment, not a blocker now.
- **D-03:** Notarytool authentication (for when notarisation activates) = **App Store Connect API key** (`.p8` + key-id + issuer-id). Chosen over Apple-ID+app-specific-password for automation-friendliness and easy rotation.
- **D-04:** Hardened runtime + entitlements: planner/researcher should configure the standard macOS hardened-runtime entitlements required for notarisation as part of the "wired but gated" config (so the config-flip is genuinely just credentials), respecting the no-network/offline posture.

### Secrets Handling
- **D-05:** This phase = **local gitignored env vars only.** Apple Developer ID cert in the login keychain; notary API key (`.p8` + key-id + issuer-id), the Tauri updater minisign private key, and its password as local shell/`.env` exports that are gitignored and **never committed**. Nothing secret enters git history.
- **D-06:** CI phase (deferred) = **lift-and-shift the same values into GitHub Actions encrypted repo/environment secrets** (`.p8` and minisign key base64-encoded), with the workflow importing the cert into a temp keychain. Local→CI is a straight migration of identical values.

### Release & Update Hosting
- **D-07:** Artifacts (DMG, updater `.sig`) + the updater manifest are hosted on **GitHub Releases**. The updater endpoint points at a stable GitHub Release URL. Free, no infra, pairs with the planned GitHub Actions CI.
- **D-08:** Manifest style = **static `latest.json`** published to the release (Tauri default). The updater fetches it and compares versions. Chosen over GitHub's dynamic endpoint for simplicity/robustness.

### Updater UX & Trigger
- **D-09:** Update check trigger = **opt-in on first run.** On first launch, ask once whether to enable automatic update checks; persist that choice via the Phase-2 Store/preferences seam. If enabled, a silent check runs at launch; if not, no automatic network call ever happens. A manual check is **always** available regardless of the toggle. This preserves the "no network at runtime / offline by design" guarantee — automatic network access is explicitly user-granted.
- **D-10:** Apply flow = **prompt → install on user confirm.** When a newer version is found: show "vX.Y available" + release notes + Install/Later. On Install: download → **verify signature** → relaunch to apply. User stays in control (satisfies DST-02's verify-before-apply).
- **D-11:** Surfaces (three): (a) **tray menu** "Check for Updates…" (reuses the Phase-5 tray/menu), (b) a **native About / app-menu** entry, and (c) a **dismissible in-app banner** shown whenever a newer version is detected (reappears on subsequent detections/launches while still outdated; user can dismiss each time).
- **D-12:** The updater is reached through a **`src/lib/platform/` seam** like every other native capability — tools/shell never import `@tauri-apps/*` directly (binding project constraint). Browser/jsdom fallbacks are harmless no-ops.
- **D-13:** The in-app update banner must be **layout-agnostic** (responsive Tailwind, no fixed widths) and meet **WCAG-AA** (visible focus, AA contrast, dismiss reachable by keyboard, no opacity-only states) — consistent with the binding cross-cutting UX constraints.

### Build & Release Process
- **D-14:** Release build location = **local `pnpm tauri build` on the user's Mac** this phase, producing the signed DMG + updater artifacts. CI automation is a deferred follow-on phase.
- **D-15:** Updater signing key = **generate the Tauri minisign keypair now** (`tauri signer generate`). Public key committed to `tauri.conf.json` (it is public); private key + password held as local gitignored env (migrates to CI secrets next phase). Verification wired against the public key.
- **D-16:** Versioning = **manual version bump now** (`tauri.conf.json` + `package.json`) captured in a **`RELEASE.md` runbook** (build → publish GitHub Release → update `latest.json`). Eventually CI-driven on every merge to main (deferred).

### Claude's Discretion
- Hardened-runtime entitlement specifics, DMG window layout/background/icon positioning, exact `tauri.conf.json` updater block shape, banner copy/placement details, and the structure of `RELEASE.md` are left to research + planning, within the decisions above.
- Reconciling the updater's network access with the CSP `connect-src 'self'` — the planner should determine the minimal CSP/capability change needed for the GitHub Releases endpoint while keeping all tool runtime offline.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 6: Distribution" — goal + 4 success criteria (signed/notarised DMG, verifying auto-updater, preserved §1 workflow targets, final gate + sign-off).
- `.planning/REQUIREMENTS.md` — DST-01 (code-signed + notarised DMG), DST-02 (auto-updater wired + verifies).

### Product spec & locked decisions
- `docs/design-and-plan.md` — §11 milestone table ("5. Distribution: Code signing + notarisation (mac), DMG, auto-updater wired") and the Phase-0 distribution-spike note + the "no network, no account, offline by design" principle (§ core principles).
- `docs/harness-and-decisions.md` §5 phase table (row "5. Distribution — Windows/Linux deferred") + §1 locked decisions; the binding per-task gate (review → unit → ui) and phase-boundary human sign-off + `gsd-ui-review` audit.
- `CLAUDE.md` — binding constraints: HashRouter only, no network at runtime, `src/lib/platform/` seam (no direct `@tauri-apps/*`), six tools only, do not refactor `decoder.ts`/its 19 tests.

### Current implementation touchpoints
- `src-tauri/tauri.conf.json` — already has `bundle.targets: ["app","dmg"]`, identifier `com.boonkhailim.devtools-app`, `app.security.csp`, window `visible:false`. No updater/signing block yet — this phase adds them.
- `src-tauri/Cargo.toml` + `src-tauri/src/lib.rs` — Phase-5 plugin registration + tray icon/menu (Show/Quit); the "Check for Updates…" tray item attaches here.
- `src/lib/platform/` (`index.ts`, `tauri.ts`, `browser.ts`) — the capability seam; the updater capability is added here following the clipboard/store/window/nativeShortcut pattern.
- Phase-2 preferences seam (`usePreferences` over the Store) — home for the persisted first-run update-check opt-in.

### State / build notes
- `.planning/STATE.md` "Build note (2026-06-01)" — `pnpm tauri build` is green (.app + .dmg); the `bundle_dmg.sh`/`hdiutil` flake when other DMGs are mounted (unmount + retry) — DMG/signing hardening is explicitly this phase's job.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase-5 tray icon + Show/Quit menu** (`src-tauri/src/lib.rs`, `setup()`): the "Check for Updates…" menu item slots into the existing tray/menu infrastructure.
- **`src/lib/platform/` seam**: clipboard/store/window/nativeShortcut already follow a per-capability accessor pattern with real impls in `tauri.ts` and no-ops in `browser.ts`. The updater capability mirrors this exactly.
- **Phase-2 preferences (`usePreferences` + Store seam)**: persists theme/accent/last-used/tree-style/window-geometry across restart — the update-check opt-in is a new persisted preference here.
- **Shared UI primitives**: `CopyButton`, `StatusBar`, existing WCAG-AA token system (`design/DevTools Mockup.html`) — the dismissible update banner reuses these patterns for consistency + accessibility.

### Established Patterns
- **No direct `@tauri-apps/*` imports** outside `tauri.ts` (grep-audited each phase) — the updater must stay behind the seam.
- **Offline-by-design / CSP `connect-src 'self'`**: the updater is the single sanctioned network egress; it must be explicitly opted into (D-09) and the minimal CSP/capability widening scoped to the GitHub endpoint only.
- **Least-privilege Tauri capabilities** (Phase 5 granted specific allow-lists, no wildcards) — the updater capability follows suit.
- **Binding per-task gate** (review → unit → ui) + phase-boundary human sign-off on a fresh `tauri build` + `gsd-ui-review` WCAG-AA audit. The decoder's 19 tests stay green.

### Integration Points
- `tauri.conf.json`: add the `plugins.updater` block (endpoint + pubkey) + `bundle.createUpdaterArtifacts` + macOS signing/notarisation config (gated per D-02).
- `Cargo.toml`/`lib.rs`: register `tauri-plugin-updater`; tray menu item wiring.
- `main.tsx` / shell startup: first-run opt-in prompt + (if enabled) launch-time check, mirroring the Phase-5 `initPlatform()` preload chain.
- New `src/lib/platform/` updater surface + a small shell module orchestrating check → prompt → verify → install + the banner component.
</code_context>

<specifics>
## Specific Ideas

- "Release-ready, pending cert" is the explicit acceptance shape for DST-01 this phase: every artifact and config path is built and exercised with ad-hoc signing; the only thing missing is the Apple Developer ID identity + notarisation credentials, which flip on at enrolment.
- In-app banner: shown **every time** a newer version is detected (not one-shot), individually dismissible per detection — user's explicit ask.
- Updates should eventually be cut automatically on **every merge to master/main** via the CI pipeline (deferred phase), but manual bump + runbook is the v1 mechanism.
</specifics>

<deferred>
## Deferred Ideas

- **CI / release-automation phase (NEW — recommend adding to roadmap):** GitHub Actions pipeline triggered on merge to main (or version tag) that signs, notarises, builds the DMG, publishes to GitHub Releases, updates `latest.json`, and reads all secrets (Apple ASC API key, Developer ID cert, minisign private key) from encrypted Actions secrets. This is the destination for D-06, D-14, D-16's "eventually CI-driven" clauses. Out of Phase 6 scope by user decision.
- **Apple Developer Program enrolment** — a prerequisite the user will complete out-of-band; once done, notarisation activates per D-02 and DST-01's Gatekeeper-clean clause gets re-verified.
- **Windows + Linux signing/packaging** — deferred per project constraints (macOS-only for now).
- **Backlog (from Phase-3 sign-off, unrelated to distribution):** Protobuf decimal-byte-array input mode — tracked in STATE.md, not this phase.

</deferred>

---

*Phase: 06-distribution*
*Context gathered: 2026-06-01*
