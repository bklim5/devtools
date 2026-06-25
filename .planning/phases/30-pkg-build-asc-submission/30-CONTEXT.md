# Phase 30: `.pkg` Build + App Store Connect Submission - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Take the existing universal, App-Sandboxed `.app` and produce a **distribution-signed `.pkg`** (Apple Distribution app-signing + Mac Installer Distribution pkg-signing + embedded Mac App Store provisioning profile), get it to App Store Connect (`productbuild` → human Transporter upload), prepare submission-metadata deliverables as committed artifacts, and prove the direct DMG channel is un-regressed.

This phase runs **LAST** (after every source change in Phases 26–29 has landed; verify bundle mtime > last source commit) and culminates in the irreversible ship step. The phase **stops at "build uploaded + everything Ready to Submit"** — the actual "Submit for Review" click is 100% human, gated behind the ship-gate walkthrough.

Requirements covered: MAS-SHIP-01 (signed `.pkg` pipeline), MAS-SHIP-02 (ASC upload via `productbuild`→`altool`/Transporter), MAS-SHIP-03 (ASC setup guidance), MAS-SHIP-04 (submission metadata deliverables), MAS-SHIP-05 (direct channel un-regressed).

</domain>

<decisions>
## Implementation Decisions

### Upload mechanism & automation level
- **D-01:** Phase 30 ships a script that **builds + locally verifies the distribution-signed `.pkg`**, then hands the path to the human who **uploads via Transporter.app**. The agent does NOT upload. Rationale: first submission is delicate — Transporter surfaces ITMS bounce reasons (ITMS-90238/90296) legibly before commit.
- **D-02:** **No ASC API key plumbing this phase.** The script stops at local verification only: `pkgutil --check-signature`, `codesign -vvv --deep --strict` on the inner `.app`, `spctl`/embedded-provisionprofile assert, universal (lipo two-arch) assert, and the existing `verify-appstore-bundle.sh` compliance gate. ITMS validation is delegated to Transporter on the human's upload. No `altool --validate-app` preflight (it would need the API key D-02 avoids).

### First-release version
- **D-03:** Bump to **1.0.0**. The bump lands in `src-tauri/tauri.conf.json` base `version` (the appstore + direct overlays inherit it), so **store and direct channels stay consistent at 1.0.0**. This is a plain config edit — **no direct release is cut and no git tag is pushed in this phase** (the bump-and-tag driver is for direct releases; not invoked here). The next direct `release:publish` would then ship 1.0.0. The ASC version record is created at 1.0.0.

### Phase terminal state (human ship-gate boundary)
- **D-04:** The agent's last deliverables are: the verified signed `.pkg`, a Transporter upload runbook, all metadata artifacts staged, and a green ASC checklist. **The human** then: runs the ship-gate walkthrough (launch signed `.app`, real Sandbox purchase round-trip, restore on a fresh container, refund→Pro-drop), uploads via Transporter, confirms the build processes in ASC, attaches the IAP, and clicks **Submit for Review**. The irreversible Apple submission is never machine-driven.

### Submission-metadata deliverables
- **D-05:** Delivered as **committed repo artifacts + one `SUBMISSION-RUNBOOK.md`** that ties them together (everything reviewable in git). Includes: screenshots (PNGs of real testable tool states at MAS-required resolutions), `Notes-for-Review.md` (how to exercise the Pro IAP — on-device StoreKit 2, no server), and the privacy-label values (Data Not Collected).
- **D-06:** `PrivacyInfo.xcprivacy` is **mandatory** — committed to the repo and **bundled into the `.app`** (Apple privacy-manifest requirement). Treated as locked, not optional. Content reflects Data Not Collected / no tracking.

### Support + privacy URLs (required ASC fields, must resolve)
- **D-07:** **Privacy URL** = reuse the existing `https://tinkerdev.io/privacy` page (already live in the `tinkerdev-io` repo). **Review/adjust** its copy for MAS accuracy — current text describes "license validation and optional update checks," but the **App Store build has Keygen + the updater compiled out**; the store binary's only network actor is StoreKit (Apple) for the IAP. **Support URL** = **create a new `/support` page** in the `tinkerdev-io` repo (ASC's support field requires an `http(s)` URL, not a `mailto:`). Reuse the existing `LegalShell` component pattern and the `SUPPORT_EMAIL` constant (`components/site/data`).

### Claude's Discretion
- **Pipeline structure:** Implement as a **new dedicated `scripts/build-appstore-pkg.sh`** (distribution-signed app → `productbuild` → signed `.pkg`) that **reuses** the existing `build-appstore-bundle.sh` machinery, rather than overloading that script with a mode flag — keeps the dev-signed local-launch path untouched. The pkg path flips the signing identity to **Apple Distribution** and embeds the **Mac App Store** distribution profile (`embedded.provisionprofile`, name "TinkerDev MAS", no `ProvisionedDevices`) instead of the dev profile.
- **Direct-channel un-regression proof:** `pnpm release:publish --dry-run` (preflights, zero side-effects) **plus** a local universal DMG build + sign + notarise + staple **with NO `gh release`** — proves the path works without publishing. Plus assert `decoder.ts` + its 19 tests are byte-for-byte untouched (`git`-clean).
- Exact screenshot count/resolutions, Notes-for-Review wording, and `/support` page copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 30 spec & requirements
- `.planning/ROADMAP.md` §"Phase 30" (lines ~223–234) — goal, success criteria, gate (full ship-gate walkthrough; build LAST, bundle mtime > last source commit)
- `.planning/ROADMAP.md` lines 122–128, 244 — the four ship-gate killers, execution order, ITMS bounce-mode (ITMS-90238/90296) validation note
- `.planning/REQUIREMENTS.md` MAS-SHIP-01…05 (lines ~46–50)

### App Store Connect setup & submission
- `docs/appstore/ASC-SETUP.md` — full ASC setup guide; **§7** = signing prerequisites (Apple Distribution cert, Mac Installer Distribution cert, MAS provisioning profile); **§8** = do-now vs wait-for-build
- `docs/appstore/PHASE-26-ASC-CHECKLIST.md` lines 84–93 — the explicit "Deferred to Phase 30" list (screenshots, privacy label + `PrivacyInfo.xcprivacy`, age rating, Notes-for-Review, App Review submission, distribution certs + `.pkg` signing)
- `docs/appstore/REFUND-TEST-RUNBOOK.md` — refund / Pro-drop testing (Sandbox Path B) for the human ship-gate walkthrough
- `src-tauri/TinkerDev.storekit` — local StoreKit product config (Pro non-consumable `com.tinkerdev.app.pro`)

### Existing build/sign infrastructure to reuse/extend
- `scripts/build-appstore-bundle.sh` — canonical universal sandboxed `.app` builder (currently **dev-signed** for local launch); the input the new pkg step extends
- `scripts/verify-appstore-bundle.sh` — `.app` compliance gate (forbidden plugins absent, required entitlements present, dist freshness); reuse as a pre-pkg gate
- `scripts/build-and-publish.mjs` — the **direct** DMG build+sign+notarise+publish path; `--dry-run` is the un-regression preflight (MAS-SHIP-05 baseline)
- `src-tauri/tauri.appstore.conf.json` — appstore overlay (entitlements path, hardenedRuntime false, min 13.0, app-only target, `appstore-iap` capability); **no category/signingIdentity** (injected at build time)
- `src-tauri/tauri.direct.conf.json` / `src-tauri/tauri.conf.json` — direct + base config (base `version` is the single bump point for D-03)
- `src-tauri/entitlements.appstore.plist` — sandbox + `network.client` + `application-identifier FK4HQK83WX.com.tinkerdev.app` + `team-identifier FK4HQK83WX`
- `src-tauri/embedded.provisionprofile` — **MAS distribution** profile ("TinkerDev MAS", no `ProvisionedDevices`); `src-tauri/dev.provisionprofile` = Mac Development (local launch). NOTE: both are currently **untracked** on disk.

### tinkerdev-io site (URL deliverables — separate repo)
- `/Users/boonkhailim/Documents/projects/bk/playground/tinkerdev-io` — Next.js 14 app-router marketing site
- `app/privacy/page.tsx` — existing privacy policy (reuse for Privacy URL; review for MAS accuracy per D-07)
- `app/refunds/` — existing refunds page (reference pattern)
- `components/site/legal` (`LegalShell`) + `components/site/data` (`SUPPORT_EMAIL`) — reuse for the new `/support` page

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/build-appstore-bundle.sh`: universal sandboxed `.app` build + deep re-sign + freshness guards + tail-call verify — the new pkg script wraps/reuses this rather than reimplementing.
- `scripts/verify-appstore-bundle.sh`: ~1500-line compliance verifier (forbidden-plugin/entitlement/dist-freshness asserts) — gate the `.app` before wrapping it in a `.pkg`.
- `scripts/build-and-publish.mjs`: direct channel with `--dry-run` (zero side-effects) — the MAS-SHIP-05 un-regression preflight.
- `src-tauri/embedded.provisionprofile` (MAS distribution) + Apple Distribution cert (present in keychain) — the app-signing inputs for the pkg.
- `tinkerdev-io` `LegalShell` component + `SUPPORT_EMAIL` constant — scaffold the `/support` page from the existing `/privacy` + `/refunds` pattern.

### Established Patterns
- Variant configs via `--config` overlay + `--features appstore --no-default-features` (HYBRID-binary guard — never bare `--features appstore`).
- Build-time injection of signingIdentity/category/profile (kept out of the committed overlay).
- Compliance gating as FATAL tail-calls in build scripts (build fails closed).

### Integration Points
- New `scripts/build-appstore-pkg.sh` chains: `build-appstore-bundle.sh` (Apple Distribution sign + MAS profile) → `verify-appstore-bundle.sh` → `productbuild` → local pkg verification → hand off to human/Transporter.
- `src-tauri/tauri.conf.json` base `version` → single edit propagates 1.0.0 to both channels.
- `PrivacyInfo.xcprivacy` must land in the `.app` bundle (`Contents/Resources/`) at build time.

### Gaps to close (none exist yet — net-new in this phase)
- No `.pkg`/`productbuild`/`altool` logic anywhere in the repo.
- **Mac Installer Distribution cert NOT in keychain** (the cert that signs the `.pkg` itself) — human creates it per ASC-SETUP §7.
- No `PrivacyInfo.xcprivacy`, screenshots, Notes-for-Review, or `/support` page yet.
- Provisioning profiles untracked — decide commit vs documented-local during planning.

</code_context>

<specifics>
## Specific Ideas

- First-submission risk posture: keep the irreversible actions (Transporter upload, Submit for Review) human; the agent only produces verified artifacts + runbooks.
- "Build LAST" discipline: the signed `.pkg` is produced only after all Phase 26–29 source changes have landed; verify the bundle binary mtime is newer than the last source commit before any walkthrough — never hand off a stale `.app`.
- Privacy posture is genuinely Data Not Collected; the App Store binary has no Keygen and no updater (compiled out), so the privacy page copy should not imply license-validation/update network calls for the store build.

</specifics>

<deferred>
## Deferred Ideas

- Fully scripted `altool`/ASC-API upload + programmatic submission — explicitly out of scope (D-01/D-02/D-04 keep upload + submit human for the first release; revisit for later updates).
- ASC API key plumbing (`.p8`/issuer/key-id) — deferred with the scripted-upload idea above.
- Windows / Linux store channels — MAS-SHIP-06 (v2).
- Automated screenshot capture in CI — manual capture during the human walkthrough this phase.

</deferred>

---

*Phase: 30-pkg-build-asc-submission*
*Context gathered: 2026-06-25*
