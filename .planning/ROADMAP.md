# Roadmap: DevTools

## Milestones

- ✅ **v1.0 Distribution** — Phases 1–6 (shipped 2026-06-01) — see `milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 Formatters** — Phases 7–8 (shipped 2026-06-02) — see `milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Release Tooling** — Phases 9–11 (shipped 2026-06-03) — see `milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 More Tools** — Phases 12–15 (shipped 2026-06-04) — see `milestones/v1.3-ROADMAP.md`
- ✅ **v1.4 Reorderable Tools** — Phase 16 (shipped 2026-06-05) — see `milestones/v1.4-ROADMAP.md`
- ✅ **v1.5 Pinned Tools** — Phase 17 (shipped 2026-06-07) — see `milestones/v1.5-ROADMAP.md`
- 🚧 **v1.6 Licensing** — Phases 18–21 (in progress, started 2026-06-09)

## Phases

<details>
<summary>✅ v1.0 Distribution (Phases 1–6) — SHIPPED 2026-06-01</summary>

- [x] Phase 1: Scaffold + Harness Proof (4/4 plans) — completed 2026-05-30
- [x] Phase 2: Shell (4/4 plans) — completed 2026-05-30
- [x] Phase 3: Hero (Protobuf) + Encoding + UX Constraints (signed off 2026-05-31)
- [x] Phase 4: Catalogue (Unix Time, JWT, Hash, UUID/ULID) — signed off 2026-06-01
- [x] Phase 5: Native Polish (tray/menu, single-instance, window-geometry) — 2026-06-01
- [x] Phase 6: Distribution (signed DMG + signature-verified auto-updater) — signed off 2026-06-01

Full detail: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Formatters (Phases 7–8) — SHIPPED 2026-06-02</summary>

- [x] Phase 7: Formatters — shared `FormatterView` + JSON formatter + XML formatter (zero-dep, native `JSON`/`DOMParser`) — validate/prettify/minify, plus JSON sort-keys (3/3 plans) — completed 2026-06-02
- [x] Phase 8: StatusBar Size-Readout Cleanup — make `StatusBar` byteCount opt-in; keep it on Base64/Protobuf/Formatters, drop it from Hash/UUID/Unix Time/JWT (1/1 plan) — completed 2026-06-02

Full detail: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Release Tooling (Phases 9–11) — SHIPPED 2026-06-03</summary>

Local release-automation helper scripts over a unit-tested pure core in `src/lib/release/` (zero new runtime deps; hero decoder + its 19 tests byte-untouched). CI parked to backlog 999.2.

- [x] Phase 9: Pure release core + housekeeping — `src/lib/release/version.ts` (bumpSemver + 3 surgical manifest editors) + `manifest.ts` (dual-key `buildLatestJson`); Cargo 0.1.0→0.2.1 reconcile (REL-02), `latest.json` untracked (REL-08) — completed 2026-06-02
- [x] Phase 10: `bump-and-tag` driver — `scripts/bump-and-tag.mjs` + `pnpm release:bump`: lockstep 3-manifest bump + lockfile regen (REL-01/03), `vX.Y.Z` tag + push to origin (REL-04), `--dry-run` (REL-10) + preflights (REL-11); live v0.2.2 cut — completed 2026-06-02
- [x] Phase 11: `build-and-publish` driver + universal binary — `scripts/build-and-publish.mjs` + `pnpm release:publish`: universal `tauri build` (REL-05), fresh-`.sig` dual-key `latest.json` (REL-06), cross-repo `gh` publish (REL-07), `APPLE_*` passthrough (REL-09), post-publish `curl` verify (REL-12); live v0.2.2 published + DST-02 updater round-trip proven on real hardware — completed 2026-06-03

All 12 REL requirements complete. Full detail: `.planning/milestones/v1.2-ROADMAP.md` · audit: `milestones/v1.2-MILESTONE-AUDIT.md`

</details>

<details>
<summary>✅ v1.3 More Tools (Phases 12–15) — SHIPPED 2026-06-04</summary>

Three new high-frequency tools (URL, Regex, Cron) + a Protobuf decimal-byte-array input mode — eight tools → eleven. Four fully-independent features, risk-ordered; zero new runtime deps; hero `decoder.ts` + its 19 tests byte-for-byte untouched throughout.

- [x] Phase 12: Protobuf decimal input — comma/space-separated decimal byte array as a third auto-detected input mode (`decimalToBytes` in `src/lib/bytes.ts`; decoder untouched); PRO-08/09 — completed 2026-06-03
- [x] Phase 13: URL tool (9th) — parse into components + query key→value table, component-vs-full encode/decode both ways over native `URL`/`URLSearchParams`; extracted shared `SegmentedControl`; URL-01..05 — completed 2026-06-03
- [x] Phase 14: Regex tester (10th) — live highlighted matches, capture-group breakdown, g/i/m/s/u flags, `$1`/`$<name>`/`$&` replace preview, 3-pattern library, ReDoS-safe via a Web Worker + timeout watchdog; RGX-01..07 — completed 2026-06-03
- [x] Phase 15: Cron tool (11th) — paste → 24h description + next 5 runs in local time with IANA TZ label; 5/6-field, macros, full syntax, DOM/DOW OR-union, DST-correct bounded next-run, isolated `L`/`nL`/`L-n` slice; CRON-01..11 — completed 2026-06-04

All 25 requirements complete. Full detail: `.planning/milestones/v1.3-ROADMAP.md` · requirements: `milestones/v1.3-REQUIREMENTS.md`

</details>

<details>
<summary>✅ v1.4 Reorderable Tools (Phase 16) — SHIPPED 2026-06-05</summary>

A focused single-feature milestone: a user-reorderable sidebar tool list (the first personalization feature). Drag-to-reorder (handle-initiated native drag, no dnd library) plus an accessible Alt+↑/↓ keyboard path with `aria-live` announcements, the custom order persisted as a `toolOrder` overlay over the registry, with graceful reconciliation for new/removed tools and a reset-to-default action. Promoted from backlog 999.6 (12 locked decisions). Zero new runtime deps; WCAG-AA; registry stays the single control plane; `decoder.ts` + its 19 tests untouched.

- [x] Phase 16: Reorderable sidebar tool list — drag + Alt+↑/↓ keyboard reorder, `aria-live` announcements, persisted `toolOrder` overlay, new-tool-append reconciliation, reset-to-default; REORD-01..07 (2/2 plans) — completed 2026-06-05

All 7 REORD requirements complete. Full detail: `.planning/milestones/v1.4-ROADMAP.md` · requirements: `milestones/v1.4-REQUIREMENTS.md`

</details>

<details>
<summary>✅ v1.5 Pinned Tools (Phase 17) — SHIPPED 2026-06-07</summary>

A focused single-feature milestone extending v1.4's personalization: users **pin favourite tools to a distinct, reorderable "Pinned" section at the top of the sidebar**, independent of the v1.4 custom order. Pinning is a render-time `pinnedToolIds` overlay persisted through the existing prefs seam (beside `toolOrder`/`recentToolIds`) and reconciled against the live registry on load; the registry stays the single control plane (⌘K palette + router pin-agnostic). Reuses v1.4's `reconcileToolOrder`/`moveToolInOrder` helpers, the drag + Alt+↑/↓ keyboard reorder, and the `aria-live` pattern. Zero new runtime/dev deps; WCAG-AA; `decoder.ts` + its 19 tests untouched. Default: no tool pinned (settings surface + auto-pin-hero deferred).

- [x] Phase 17: Pinned sidebar section — pin/unpin via a row pin icon (persistent-filled / hover + focus-visible) + **Alt+P** (`aria-live`-announced), a "Pinned" group with divider shown only when ≥1 tool pinned, independent per-group drag + Alt+↑/↓ reorder (no cross-boundary drag), persisted + reconciled `pinnedToolIds` overlay (drop unknown, de-dupe), and a keyboard-reachable "Unpin all"; PIN-01..09 (2/2 plans) — completed 2026-06-07

All 9 PIN requirements complete; human-signed-off (full suite 694/694, decoder 19/19 untouched, gsd-ui-review WCAG-AA 23/24). Post-walkthrough keyboard-model fixes (D-17): Alt+P physical-`KeyP` (macOS Option+P composes to "π"), Tab-reachable rows + pin fallback, ↑/↓ focus nav, 24×24 targets. Full detail: `.planning/milestones/v1.5-ROADMAP.md` · requirements: `milestones/v1.5-REQUIREMENTS.md`

</details>

### 🚧 v1.6 Licensing (Phases 18–21) — IN PROGRESS

One-time-payment lifetime license: MoR checkout → webhook → Keygen (perpetual, node-locked, `maxMachines=1`); paste-key one-time activation (fingerprint `HMAC-SHA256(IOPlatformUUID, app-salt)`); thereafter fully-offline Ed25519-verified `machine.lic` (~30-day TTL) in Rust; license key in macOS Keychain (Rust-owned); free tier locks the Protobuf hero, theming, and ordering/pinning behind ONE central entitlement gate. Architecture locked in `docs/licensing-research.md`. Webview gating accepted as UX-gating, not DRM. Webview runtime deps stay zero (Rust crates `ed25519-dalek`/`keyring`/HMAC allowed); `decoder.ts` + its 19 tests byte-for-byte untouched.

- [ ] **Phase 18: Entitlements Seam & Central Gate** - Pure-frontend entitlement gating (registry + app-level) with lock badges + upsell panel; lazy registry loaders; everything-unlocked in-Tauri default until licensing lands
- [ ] **Phase 19: License Activation & Offline Verification** - Keygen Rust core: paste-key activation, fingerprint, Ed25519 offline launch verify, Keychain storage, fail-closed; includes the key→token exchange SPIKE
- [ ] **Phase 20: Purchase Pipeline** - MoR checkout (Lemon Squeezy default) → webhook backend → Keygen license creation → key emailed; privileged tokens server-side only (parallel-capable with Phase 19)
- [ ] **Phase 21: License Lifecycle & Ship Gate** - TTL refresh + offline grace, self-serve transfer, revocation propagation, license status UI; flip the free-tier default live; full 8-case ship-gate matrix

## Phase Details (v1.6)

### Phase 18: Entitlements Seam & Central Gate
**Goal**: Feature gating exists as one central, testable seam — tools and app-level features resolve entitlements through a single gate, locked features stay visible-but-locked, and the registry is lazified — while the in-Tauri default keeps everything unlocked until licensing lands (flipped at Phase 21 integration)
**Depends on**: Nothing (pure frontend; first phase of v1.6)
**Requirements**: ENT-01, ENT-02, ENT-03, ENT-04, ENT-05
**Success Criteria** (what must be TRUE):
  1. With a free-tier entitlement set applied (test/dev toggle), the Protobuf decoder stays visible in the sidebar and ⌘K palette with a lock badge, and opening it shows a WCAG-AA unlock/upsell panel in place of the tool UI (never hidden, no opacity-only locked state)
  2. Theming and tool ordering/pinning gate through the same app-level entitlement map — flipping the resolved set locks/unlocks them with no scattered per-feature checks (one central gate, registry stays the single control plane)
  3. React consumes only a resolved entitlement set (Rust command inside Tauri; deterministic free-tier default in browser/jsdom/vite-preview so tests never touch licensing); the in-Tauri default resolves to everything-unlocked pre-licensing, so shipped behavior is unchanged
  4. All registry tool entries load via lazy `component` loaders and the app behaves identically (paste-instant, full suite green, real-WKWebView e2e green) — a future free-build decoder code-split exclusion is now a real seam, with `decoder.ts` + its 19 tests byte-for-byte untouched
**Plans**: 4 plans (1/4 executed)

Plans:
- [x] 18-01-PLAN.md — Entitlements core seam: vocabulary + isToolLocked/gatePreferences, env-split resolver (Tauri→FULL, browser→FREE, D-31 downgrade-only override), snapshot store + useEntitlements, shared UpsellPanel (D-19..D-22)
- [x] 18-02-PLAN.md — Lazy registry (11 entries → LazyComponent loaders) + ToolRoute element gate (locked→upsell, no chunk fetch) + per-tool chunk/decoder-isolation proof (ENT-05/D-30)
- [x] 18-03-PLAN.md — Lock UX surfaces: sidebar D-26 gating + D-28 locked-affordance upsell + D-29 footer "Unlock Pro" + dormant lock badges (D-23..25); palette badges + DEV-only free-tier toggle (D-32)
- [ ] 18-04-PLAN.md — D-18 doc reconciliation, real-WKWebView entitlements e2e + full e2e re-proof, dist-grep dev-strip check, phase-boundary build + human walkthrough

**UI hint**: yes

### Phase 19: License Activation & Offline Verification
**Goal**: A user with a license key can activate this Mac once online and thereafter launch fully licensed, fully offline — all verification and key material Rust-owned, never in the webview
**Depends on**: Phase 18 (entitlement gate to feed the resolved set into)
**Requirements**: LIC-01, LIC-02, LIC-03, LIC-04, LIC-06
**Success Criteria** (what must be TRUE):
  1. User pastes a license key in-app → one online activation validates against Keygen, binds the machine (fingerprint `HMAC-SHA256(IOPlatformUUID, app-salt)` computed in Rust), checks out and caches the Ed25519-signed `machine.lic` (Rust-owned app data), and full entitlements unlock without restart
  2. Activating the same key on a second Mac is rejected with a clear, calm error that names the resolution path (deactivate the other machine)
  3. After activation, launching with networking disabled still resolves licensed entitlements — Rust verifies the `machine.lic` Ed25519 signature with the embedded public key and checks the fingerprint, with zero network calls
  4. A corrupt, tampered, or foreign-machine `machine.lic` fails closed to the free tier — no crash, calm status messaging, re-activation offered
  5. The license key lives only in the macOS Keychain (Rust-owned, `keyring` crate) — never readable from JS, never in the Tauri store or app-data files; the SPIKE outcome on client-side license-key → license-token exchange against the live Keygen API is recorded (store a scoped token instead of the raw key if confirmed)
**Plans**: TBD
**UI hint**: yes

### Phase 20: Purchase Pipeline
**Goal**: A buyer can pay once through a merchant-of-record checkout and automatically receive a working license key by email — no manual fulfillment, no privileged credentials anywhere near the app
**Depends on**: Phase 18 (in-app "Buy license" affordance lives in the upsell panel); parallel-capable with Phase 19 (external infra — MoR + webhook backend)
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. The in-app "Buy license" affordance opens the MoR purchase page in the default browser (Lemon Squeezy default, seller payout-country verified before committing); checkout completes a one-time payment
  2. A completed purchase fires the `order_created` webhook → the small backend creates the Keygen license (perpetual, node-locked, `maxMachines=1`, entitlements embedded in the signed license) without manual steps
  3. The buyer receives the license key by email automatically after purchase, and that key activates successfully through the Phase 19 in-app flow
  4. Privileged Keygen tokens exist only server-side — verifiably absent from the app bundle, the repo, and every client-reachable surface
**Plans**: TBD
**UI hint**: yes

### Phase 21: License Lifecycle & Ship Gate
**Goal**: The license behaves correctly across its whole lifetime — opportunistic refresh, self-serve transfer, revocation propagation, a status UI — the free-tier default flips live, and the full 8-case ship-gate matrix passes end-to-end on a real build
**Depends on**: Phase 19 + Phase 20 (end-to-end purchase→activation integration requires both)
**Requirements**: LIC-05, LIC-07, LIC-08, LIC-09
**Success Criteria** (what must be TRUE):
  1. The cached `machine.lic` (~30-day TTL) refreshes opportunistically in the background when online, with a generous offline grace in between — never a hard per-launch network check, and every tool stays fully functional offline
  2. User can self-serve deactivate this Mac from within the app, freeing the seat, and then activate the same key on a new Mac (transfer proven end-to-end)
  3. A license revoked/suspended in Keygen (refund or chargeback) drops entitlements to the free tier at the next TTL refresh — calm messaging, no crash
  4. A keyboard-reachable, WCAG-AA license status UI shows the current state (free / licensed / offline-grace / refresh-needed), the masked key + licensee email from the signed license data, and working refresh + deactivate actions
  5. The in-Tauri free-tier default flips live (an unlicensed install actually locks the decoder, theming, and ordering/pinning) and all 8 ship-gate matrix cases pass on a fresh `tauri build`: valid first-Mac activation · second Mac rejected · offline launch · corrupted `machine.lic` fails closed · copied `machine.lic` fails on foreign fingerprint · TTL-expired grace→refresh · deactivate/transfer end-to-end · revocation propagates on refresh
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order. v1.6 runs 18 → 19 → 21 with Phase 20 parallel-capable beside 19 (external infra); Phase 21 requires both 19 and 20.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Scaffold + Harness Proof | v1.0 | 4/4 | Complete | 2026-05-30 |
| 2. Shell | v1.0 | 4/4 | Complete | 2026-05-30 |
| 3. Hero + Encoding + UX | v1.0 | — | Complete | 2026-05-31 |
| 4. Catalogue | v1.0 | — | Complete | 2026-06-01 |
| 5. Native Polish | v1.0 | — | Complete | 2026-06-01 |
| 6. Distribution | v1.0 | — | Complete | 2026-06-01 |
| 7. Formatters | v1.1 | 3/3 | Complete | 2026-06-02 |
| 8. StatusBar Size-Readout Cleanup | v1.1 | 1/1 | Complete | 2026-06-02 |
| 9. Pure release core + housekeeping | v1.2 | 2/2 | Complete   | 2026-06-02 |
| 10. bump-and-tag driver | v1.2 | 3/3 | Complete    | 2026-06-02 |
| 11. build-and-publish driver + universal binary + safety rails | v1.2 | 3/3 | Complete    | 2026-06-03 |
| 12. Protobuf decimal input | v1.3 | 2/2 | Complete    | 2026-06-03 |
| 13. URL tool | v1.3 | 2/2 | Complete    | 2026-06-03 |
| 14. Regex tester | v1.3 | 3/3 | Complete    | 2026-06-03 |
| 15. Cron tool | v1.3 | 4/4 | Complete    | 2026-06-04 |
| 16. Reorderable sidebar tool list | v1.4 | 2/2 | Complete    | 2026-06-05 |
| 17. Pinned sidebar section | v1.5 | 2/2 | Complete    | 2026-06-07 |
| 18. Entitlements Seam & Central Gate | v1.6 | 3/4 | In Progress|  |
| 19. License Activation & Offline Verification | v1.6 | 0/? | Not started | - |
| 20. Purchase Pipeline | v1.6 | 0/? | Not started | - |
| 21. License Lifecycle & Ship Gate | v1.6 | 0/? | Not started | - |

## Backlog

Unsequenced ideas captured for future planning. Promote with `/gsd-review-backlog` when ready.

### Phase 999.1: More tools for the app (PROMOTED → v1.3 More Tools, in progress)

**Status:** PROMOTED — the Cron, URL, Regex tools + Protobuf decimal-byte-array input are being delivered as milestone v1.3 "More Tools" (Phases 12–15). What remains parked here is the rest of the candidate wishlist below (SQL formatter still needs a lib; Date, JSON↔YAML, Number Base, Escape/Unescape, comparers, etc. unscheduled).

**Goal:** [Captured for future planning] — expand beyond the v1 six tools. NOTE: v1 locked "six tools only" — promoting this means deliberately reopening that constraint. There is no code-level limit (registry is a plain array; router/sidebar/palette auto-derive), so growth is mechanical; the constraint is product focus, not architecture. v1.1 already added the JSON + XML formatters from this list; v1.3 adds Cron + URL + Regex; SQL remains parked.

**Candidate tool wishlist (user-provided, categorized):**

- **Converters** — Cron Parser ✓ (v1.3), Date, JSON Array → Table/CSV, JSON ↔ YAML, Number Base
- **Text** — Escape / Unescape, List Comparer, Markdown Preview, Analyzer & Utilities, Text Comparer
- **Encoders / Decoders** — Base64 Image, Base64 Text, Certificate, GZIP, HTML, JWT, QR Code, URL ✓ (v1.3)
- **Formatters** — JSON ✓ (v1.1), XML ✓ (v1.1), **SQL** (still parked — needs `sql-formatter` lib; reformats only, can't lint)
- **Generators** — Hash / Checksum, Lorem Ipsum, Password, UUID
- **Graphic** — Color Blind Simulator, Image Converter
- **Testers** — JSONPath, Regular Expression ✓ (v1.3), XML / XSD

Each candidate must still pass the product wedge: offline/no-network, paste-instant (<2s), keyboard-driven, registry-driven, WCAG-AA, and the build+verify harness.

**Requirements:** TBD (remaining wishlist; Cron/URL/Regex requirements now in `.planning/REQUIREMENTS.md` for v1.3)
**Plans:** 3/4 plans executed

Plans:
- [ ] TBD (promote remaining wishlist with /gsd-review-backlog when ready)

### Phase 999.2: Release automation + CI integration (BACKLOG)

**Goal:** [Captured for future planning] — **the local-scripts half of this item is being delivered as milestone v1.2 (Phases 9–11); what remains parked here is the CI track.** Wire CI on top of the v1.2 scripts: CI checks (vitest + tsc + eslint) on every push/PR to main/master, and a tag-triggered CI release later (an Actions runner cuts the signed release).

**Pre-discussion decisions (captured 2026-06-02, before formal milestone planning):**

1. **Trigger model:** a git **tag push `vX.Y.Z`** cuts the signed release + updater bump. **CI checks (vitest + tsc + eslint) run on every push/PR to main/master REGARDLESS of publishing.** (Real-WKWebView e2e in CI is a stretch goal — macOS-runner + webview-automation cost.)
2. **Version bump = local helper script first, CI-integratable later.** Something like `pnpm release [patch|minor|major]` that bumps `package.json` + `src-tauri/tauri.conf.json` **in lockstep** (the D-16 lockstep from RELEASE.md; Cargo.toml is currently 0.1.0 and NOT part of it — decide whether to include it), commits, creates the `vX.Y.Z` tag, and pushes (push is what fires the release). **→ delivered in v1.2 Phases 9–10 (Cargo.toml folded into the lockstep).**
3. **App semver (`0.2.x`) stays DECOUPLED from GSD milestone tags (`v1.1`).** Two numbering systems on purpose: GSD `vMAJOR.MINOR` tracks planning milestones; app `vX.Y.Z` is what the updater compares. The release pipeline keys off the **app** version.
4. **Split the automation into two scripts** (both local now, both CI-callable later):
   - **bump-and-tag** (decision #2 above). **→ v1.2 Phase 10.**
   - **build-and-publish** — runs `pnpm tauri build`, then **generates `latest.json` from the FRESH `*.app.tar.gz.sig`** (automating the fragile manual paste RELEASE.md §5 warns about — never reuse a stale `.sig`), creates the GitHub Release on `bklim5/devtools-releases`, and uploads DMG + `.app.tar.gz` + `latest.json`. **→ v1.2 Phase 11.**

**Context the milestone must fold in (from RELEASE.md + repo state, 2026-06-02):**

- **Split-repo publish:** private source `bklim5/devtools` → public `bklim5/devtools-releases` (assets + `latest.json` only). Updater endpoint pinned to `releases/latest/download/latest.json` on the public repo. CI publishing across repos needs a **cross-repo PAT** — the default `GITHUB_TOKEN` cannot write releases to a different repo. **(Local `gh` auth suffices for v1.2; the cross-repo PAT stays parked here for CI.)**
- **Signing secrets:** minisign **private key (`~/.tauri/devtools.key`) + password** must move into **GitHub Actions secrets** for CI release (mandatory; DST-02 verify-before-apply). Only the public key is in the repo (`tauri.conf.json` `plugins.updater.pubkey`). **(v1.2 reads these from the local env; Actions secrets stay parked here.)**
- **arm64-only gap (Pitfall 7):** a local Apple-Silicon build serves only `darwin-aarch64`. Intel/`darwin-x86_64` or `--target universal-apple-darwin` coverage is a CI-phase improvement to consider. **→ closed in v1.2 Phase 11 (universal binary).**
- **Apple notarisation stays DEFERRED** (ad-hoc signing) until Apple Developer enrolment (D-02) — but scripts should be **notarisation-ready** (honor `APPLE_*` env if present, per RELEASE.md "post-enrolment flip"). **→ notarisation-ready honored in v1.2 Phase 11; activation still deferred.**
- **macOS runner required** for `tauri build`; private-repo Actions minutes are billed — a reason CI *release* is deferred while CI *checks* run regardless.
- **Stale committed `latest.json`** at repo root (currently 0.2.1) — decide whether to keep it generated-only / stop committing it. **→ v1.2 Phase 9 (generate-only, untracked).**

**Requirements:** TBD (the remaining CI track — define during a future `/gsd-new-milestone`)
**Plans:** 0 plans

Plans:
- [ ] TBD (promote the remaining CI track with /gsd-review-backlog or seed `/gsd-new-milestone` when ready)

### Phase 999.3: Theme settings (BACKLOG)

**Goal:** [Captured for future planning] — user-facing theme/appearance settings (beyond the current theme/accent persistence), e.g. light/dark/system toggle and accent customization in a settings surface.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: DevTools CLI (BACKLOG)

**Goal:** [Captured for future planning] — let users invoke the tools from the command line, e.g. `devtools hash.sha256 xxx` to print a SHA-256 hash, `devtools base64.encode ...`, etc. Implies sharing the pure transform logic (`src/lib/`) between the GUI and a CLI entrypoint so behavior stays identical. Open questions for promotion: distribution of the CLI binary (bundled with the app vs separate), namespacing/command grammar (`tool.action`), stdin/pipe support, and how it coexists with the offline/no-network ethos (a CLI is inherently offline-friendly). The pure-logic-in-`src/lib/` separation already in place is the enabler.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Protobuf decoder schema-file support (BACKLOG)

**Goal:** [Captured for future planning] — let the user supply a `.proto` schema file so the Protobuf decoder can render *named, typed* fields (e.g. `user_id` instead of `#1`, enums by name, nested message types) instead of the schema-less wire-format-only tree. This is an **additive, opt-in mode layered on top of the hero** — the schema-less decoder stays the default and the product wedge ("paste an unknown blob → usable interpretation in <2s, no setup"); a schema, when provided, only enriches the readout. **Key tension to resolve at promotion:** schema-less decoding is the explicit hero feature and "no setup / no accounts" is a binding constraint, so any schema mode must not dilute the paste-instant zero-config path — schema is an enhancement a power user reaches for, never a precondition. **Open questions:** parsing `.proto` without a new runtime dep (the constraint is zero-new-runtime-deps; a `.proto` parser is non-trivial — may need a vendored/pure parser or a deliberate dep exception decided at promotion); how the schema is supplied offline (file picker / paste / drag-drop, no network fetch of imports); handling `import` statements and well-known types; mismatches between schema and actual bytes (fall back to the schema-less view, never crash); and keeping `decoder.ts` + its 19 tests untouched (the schema layer wraps/annotates the existing wire-format output rather than modifying the core decoder).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: Drag-and-drop reorder the tool list (✅ PROMOTED → v1.4 Phase 16)

**Status:** PROMOTED into milestone v1.4 "Reorderable Tools" as **Phase 16** (2026-06-04). Requirements REORD-01..07. Its 12 design decisions moved with it to `.planning/phases/16-reorderable-sidebar-tool-list/16-CONTEXT.md`. See the v1.4 milestone section above for the live phase. (The pinning idea it split out remains an unscheduled future feature.)

**Goal:** [Captured for future planning] — let the user drag-and-drop to reorder the tools in the sidebar (and the order should persist), so the most-used tools can sit at the top instead of the fixed registry order. **Architectural fit:** the registry (`src/lib/tools/registry.ts`) is the single control plane — sidebar, ⌘K palette, and router all derive from it — so a user-defined ordering is a presentation-layer overlay (a persisted array of tool IDs applied over the registry), NOT a mutation of the registry array itself; the registry stays the canonical source. **Open questions for promotion:** persistence via the existing `platform.store` seam (a `toolOrder: string[]` pref, same mechanism as theme/last-used — no new dep); keyboard-accessible reordering (WCAG-AA is binding — drag-drop alone is insufficient; needs a keyboard affordance, e.g. move-up/down or an aria-grabbed pattern); how new tools shipped in a later version slot into an existing custom order (append unknown IDs); whether the ⌘K palette and router care about order (they shouldn't — only the sidebar render order changes); and a reset-to-default affordance. Zero-new-runtime-deps still applies (HTML5 drag events or a small pure handler, not a dnd library).
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Base64 tool — inline image preview (BACKLOG)

**Goal:** [Captured for future planning] — extend the **existing base64 tool** (not a new tool) with an inline image preview: when decoded bytes sniff as an image (PNG/JPEG/GIF/WebP/SVG via magic bytes), render the image inline below the decoded output. Fits the wedge: paste blob → usable interpretation. **Open questions for promotion:** rendering via data-URI `<img>` (no new deps); SVG safety (sanitize or render rasterized/sandboxed — SVG can carry scripts); size limits for very large payloads; alt-text/a11y treatment (WCAG-AA binding); whether preview shows dimensions/format metadata; copy/save affordance for the rendered image.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)
