# Phase 30: `.pkg` Build + App Store Connect Submission - Research

**Researched:** 2026-06-25
**Domain:** macOS App Store packaging (`productbuild` → signed `.pkg` → Transporter), MAS submission metadata, privacy manifest, cross-repo `/support` page, direct-channel un-regression
**Confidence:** HIGH on repo facts + Tauri/Apple command shapes; MEDIUM on the exact local "this-will-pass-ITMS" signal set (no `altool --validate-app` is run per D-02) and on a couple of date-sensitive Apple UI details.

## Summary

This phase wraps the existing universal, App-Sandboxed `.app` into a **distribution-signed `.pkg`** and prepares everything for a human Transporter upload + Submit. The hard technical core is small and well-understood: re-sign the `.app` with **Apple Distribution** (not Developer ID, not Apple Development) carrying the **embedded MAS provisioning profile**, then `productbuild --component App.app /Applications --sign "3rd Party Mac Developer Installer: …" App.pkg`. The risk is in the details the agent *cannot* fully prove locally without an ASC API key (deliberately avoided per D-02): the two real-world Tauri MAS bounce modes are **ITMS-90296** (app-sandbox entitlement missing on a *nested* executable) and a **root-only-files** `.pkg` permission rejection — both are reproducible failure classes for Tauri sandboxed universal apps, and both have local pre-checks.

The existing `build-appstore-bundle.sh` already does ~80% of the app-signing work — it builds universal, embeds a profile, deep-re-signs, and FATAL-verifies via `verify-appstore-bundle.sh`. Per CONTEXT D-Discretion the plan should add a **new `scripts/build-appstore-pkg.sh`** that flips the signing identity to **Apple Distribution** + embeds the **distribution** `embedded.provisionprofile` (not the dev one) and chains into `productbuild`, leaving the dev-signed local-launch script untouched. The `Apple Distribution` cert is present in the keychain; the **Mac Installer Distribution cert is NOT** (verified) — the new script must fail closed with an actionable pointer to ASC-SETUP §7.

Metadata deliverables (PrivacyInfo.xcprivacy, screenshots, Notes-for-Review, privacy/support URLs) are committed repo artifacts tied together by a `SUBMISSION-RUNBOOK.md`. The `/support` page and privacy-copy edit are **cross-repo** work in `tinkerdev-io` (flagged clearly below). Direct-channel un-regression is `pnpm release:publish --dry-run` (proven zero-side-effect) plus a `decoder.ts` byte-identity assert.

**Primary recommendation:** New `scripts/build-appstore-pkg.sh` = (reuse `build-appstore-bundle.sh` machinery with Apple Distribution + `embedded.provisionprofile`) → `verify-appstore-bundle.sh` gate → inject `PrivacyInfo.xcprivacy` before the final re-sign → `productbuild` with Mac Installer Distribution → local verify gates (`pkgutil --check-signature`, `codesign --deep --strict` per-executable sandbox-entitlement assert, `lipo` two-arch, embedded-profile assert, `spctl` interpreted correctly for MAS) → hand `.pkg` path + `SUBMISSION-RUNBOOK.md` to the human. Build LAST; never machine-upload or machine-submit.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — Upload mechanism:** Phase 30 ships a script that **builds + locally verifies the distribution-signed `.pkg`**, then hands the path to the human who **uploads via Transporter.app**. The agent does NOT upload. Transporter surfaces ITMS bounce reasons (ITMS-90238/90296) legibly before commit.
- **D-02 — No ASC API key plumbing this phase.** Script stops at local verification only: `pkgutil --check-signature`, `codesign -vvv --deep --strict` on the inner `.app`, `spctl`/embedded-provisionprofile assert, universal (lipo two-arch) assert, and the existing `verify-appstore-bundle.sh` compliance gate. ITMS validation delegated to Transporter. **No `altool --validate-app` preflight** (needs the API key D-02 avoids).
- **D-03 — First-release version: bump to 1.0.0** in `src-tauri/tauri.conf.json` base `version` (appstore + direct overlays inherit). **No direct release cut, no git tag pushed in this phase.** The ASC version record is created at 1.0.0.
- **D-04 — Phase terminal state:** agent's last deliverables = the verified signed `.pkg`, a Transporter upload runbook, all metadata artifacts staged, a green ASC checklist. **The human** runs the ship-gate walkthrough (launch signed `.app`, real Sandbox purchase round-trip, restore on a fresh container, refund→Pro-drop), uploads via Transporter, confirms processing, attaches the IAP, clicks **Submit for Review**. The irreversible Apple submission is never machine-driven.
- **D-05 — Submission metadata:** committed repo artifacts + one `SUBMISSION-RUNBOOK.md`. Includes screenshots (PNGs of real testable tool states at MAS-required resolutions), `Notes-for-Review.md` (how to exercise the Pro IAP — on-device StoreKit 2, no server), the privacy-label values (Data Not Collected).
- **D-06 — `PrivacyInfo.xcprivacy` is MANDATORY** — committed to the repo and bundled into the `.app`. Content = Data Not Collected / no tracking. Locked, not optional.
- **D-07 — URLs:** **Privacy URL** = reuse `https://tinkerdev.io/privacy` but **review/adjust copy for MAS accuracy** (store build has Keygen + updater compiled out; only network actor is StoreKit/Apple for the IAP). **Support URL** = **create a new `/support` page** in the `tinkerdev-io` repo (ASC support field requires `http(s)`, not `mailto:`). Reuse `LegalShell` + `SUPPORT_EMAIL`.

### Claude's Discretion

- **Pipeline structure:** new dedicated `scripts/build-appstore-pkg.sh` (distribution-signed app → `productbuild` → signed `.pkg`) that **reuses** `build-appstore-bundle.sh` machinery, rather than overloading it with a mode flag — keeps the dev-signed local-launch path untouched. The pkg path flips signing to **Apple Distribution** + embeds the **Mac App Store** distribution profile (`embedded.provisionprofile`, "TinkerDev MAS", no `ProvisionedDevices`).
- **Direct-channel un-regression proof:** `pnpm release:publish --dry-run` (zero side-effects) **plus** a local universal DMG build + sign + notarise + staple with NO `gh release` **plus** assert `decoder.ts` + its 19 tests byte-for-byte untouched (git-clean).
- Exact screenshot count/resolutions, Notes-for-Review wording, `/support` page copy.

### Deferred Ideas (OUT OF SCOPE)

- Fully scripted `altool`/ASC-API upload + programmatic submission.
- ASC API key plumbing (`.p8`/issuer/key-id).
- Windows / Linux store channels (MAS-SHIP-06, v2).
- Automated screenshot capture in CI (manual capture during the human walkthrough this phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAS-SHIP-01 | Signed `.pkg` pipeline (Apple Distribution + Mac Installer Distribution + embedded profile) | `productbuild` recipe (Standard Stack + Code Examples); reuse `build-appstore-bundle.sh` machinery with Apple Distribution + `embedded.provisionprofile`; Mac Installer Distribution cert fail-closed gate (Pitfall 6) |
| MAS-SHIP-02 | ASC upload via `productbuild`→`altool`/Transporter | D-01 = human Transporter; agent stops at local-verified `.pkg` + runbook. `altool` documented as the *deferred* scripted path (Code Examples) |
| MAS-SHIP-03 | ASC setup guidance at point of need | ASC-SETUP.md + PHASE-26-ASC-CHECKLIST.md already cover §§1–8; Phase-30 delta = the deferred items in PHASE-26 lines 84–93 (screenshots/privacy/age/Notes/submission/dist-certs+pkg) → fold into `SUBMISSION-RUNBOOK.md` |
| MAS-SHIP-04 | Submission metadata deliverables | PrivacyInfo.xcprivacy (Code Examples), MAS screenshot specs (Standard Stack), Notes-for-Review template, privacy/support URL edits (cross-repo section) |
| MAS-SHIP-05 | Direct channel un-regressed | `release:publish --dry-run` zero-side-effect (verified in source); decoder.ts byte-identity assert via `git diff`/hash against known-good ref |
</phase_requirements>

## Standard Stack

### Core tools (all already on the machine — Xcode CLT)
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| `productbuild` | wrap a signed `.app` into a Mac App Store `.pkg` | The only Apple-sanctioned way to package a MAS app; `xcrun productbuild --component App.app /Applications --sign "3rd Party Mac Developer Installer: …" App.pkg` [CITED: v2.tauri.app/distribute/app-store] |
| `codesign` | deep re-sign the `.app` with Apple Distribution + entitlements + embedded profile | Already used by `build-appstore-bundle.sh` (lines 165–167) [VERIFIED: repo] |
| `pkgutil --check-signature` | verify the `.pkg` is installer-signed | local pre-ITMS signal (D-02) [ASSUMED — standard tool, confirm output shape on a real pkg] |
| `spctl -a -vvv -t install` | Gatekeeper assessment of the installer | see Pitfall 2 — a MAS `.pkg`/app legitimately *rejects* under Gatekeeper (not notarised); interpret correctly [CITED: Apple — MAS apps aren't notarised] |
| `lipo -archs` | assert universal (x86_64 + arm64) | already used (`build-appstore-bundle.sh` 172; `verify-appstore-bundle.sh` 397–403) [VERIFIED: repo] |
| `xcrun altool --upload-app --type macos` | (DEFERRED, D-02) the scripted upload alternative to Transporter | documented for completeness only [CITED: v2.tauri.app/distribute/app-store] |
| Transporter.app | the human upload path (D-01) | free from the Mac App Store; surfaces ITMS bounce codes legibly [CITED: ASC docs] |

### Apple certificate naming (modern, 2026) — DISAMBIGUATED
| Signs | Modern cert name | Legacy name | In keychain now? |
|-------|------------------|-------------|------------------|
| the `.app` (app + nested binaries) | **Apple Distribution** | "Mac App Distribution" / "3rd Party Mac Developer Application" | ✓ `Apple Distribution: Boon Khai Lim (FK4HQK83WX)` [VERIFIED: `security find-identity`] |
| the `.pkg` installer | **Mac Installer Distribution** | "3rd Party Mac Developer Installer" | ✗ NOT present [VERIFIED: `security find-identity`] |

> The `productbuild --sign` value resolves the installer cert. On modern systems the keychain entry is typically literally **`3rd Party Mac Developer Installer: <Name> (TEAMID)`** even though the portal calls it "Mac Installer Distribution" — these are the same cert. Plan should resolve it by `security find-identity -v -p basic | grep "3rd Party Mac Developer Installer"` (NOT `-p codesigning`; installer certs aren't codesigning policy certs). [CITED: developer.apple.com/forums/thread/128166] [ASSUMED on the exact `-p` flag — verify once the cert exists]

### MAS screenshot specs (current Apple, June 2026)
| Property | Value |
|----------|-------|
| Accepted Mac sizes (16:10, strict) | **1280×800, 1440×900, 2560×1600, 2880×1800** px — use ONE size category, need not supply all four [CITED: developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/] |
| Count | 1–10 per localization; Apple recommends ≥3 [CITED: same] |
| Formats | `.png`, `.jpg`, `.jpeg` [CITED: same] |
| Alpha | not documented as supported — **flatten / no alpha PNG** to be safe [ASSUMED — Apple historically rejects alpha in store screenshots] |

**Recommendation (D-05 discretion):** capture at **2880×1800** (Retina, the highest tier, future-proof) during the human walkthrough, ≥3 shots of *real testable tool states* (e.g. Protobuf decoder with a decoded blob, JWT decode, the Settings ▸ License Buy/Restore pane for the IAP review screenshot). Save as flattened PNG, no alpha. The IAP review screenshot (ASC-SETUP §5) is separate and shows the purchase context.

### No new npm/cargo dependencies
This phase is shell + Apple CLI + committed artifacts. No package installs. (Version-verification step N/A — no libraries added.)

## Architecture Patterns

### Recommended file additions
```
scripts/
├── build-appstore-pkg.sh        # NEW — Apple Distribution app → productbuild → signed .pkg + local gates
src-tauri/
├── PrivacyInfo.xcprivacy        # NEW (D-06) — committed; injected into Contents/Resources/ at build time
docs/appstore/
├── SUBMISSION-RUNBOOK.md        # NEW (D-05) — ties metadata + Transporter steps together
├── Notes-for-Review.md          # NEW (D-05) — how to exercise the Pro IAP (StoreKit 2, on-device, no server)
└── screenshots/                 # NEW (D-05) — committed PNGs of real tool states
.planning/phases/30-…/
└── (this RESEARCH.md)
```
Cross-repo (`tinkerdev-io`):
```
app/support/page.tsx             # NEW (D-07) — LegalShell-based support page
app/privacy/page.tsx             # EDIT (D-07) — MAS-accurate copy (channel-aware)
```

### Pattern 1: Reuse-not-overload the build script (D-Discretion)
**What:** `build-appstore-pkg.sh` reuses the proven app-signing logic but with three swaps vs `build-appstore-bundle.sh`:
1. `SIGN_ID` = the **Apple Distribution** identity (not Apple Development).
2. `PROFILE` = `src-tauri/embedded.provisionprofile` (the **MAS distribution** profile — "TinkerDev MAS", no `ProvisionedDevices`, verified) not `dev.provisionprofile`.
3. Inject `PrivacyInfo.xcprivacy` into `Contents/Resources/` **before** the deep re-sign, then `productbuild`.

**Why this matters (Pitfall 1):** the existing script is *deliberately* dev-signed because a distribution-signed sandboxed app **cannot launch locally** (AMFI -413, documented in `build-appstore-bundle.sh` lines 10–15). The pkg script's output is **not meant to launch locally** — it is meant to *upload*. So the human ship-gate walkthrough launches the **dev-signed** `.app` (from `build-appstore-bundle.sh`); the `.pkg` is only verified statically + uploaded. Keep the two paths separate. [VERIFIED: repo comment]

### Pattern 2: PrivacyInfo injection must precede the seal
**What:** copy `PrivacyInfo.xcprivacy` → `App.app/Contents/Resources/PrivacyInfo.xcprivacy`, THEN `codesign --force --deep --sign "Apple Distribution: …" --entitlements …`. Adding a file to a signed bundle invalidates the seal; the re-sign must happen after the copy. This mirrors the existing embed-then-re-sign order for the provisioning profile (`build-appstore-bundle.sh` steps 2→3). [CITED: Apple bundle-resources + repo pattern]

### Pattern 3: FATAL tail-call gating (existing repo idiom)
Every check is a fail-closed tail-call; the canonical command cannot exit 0 after any compliance failure (the `build-appstore-bundle.sh` and `verify-appstore-bundle.sh` idiom). The pkg script must follow it: missing installer cert → exit 1 with an ASC-SETUP §7 pointer; non-universal → exit 1; sandbox entitlement missing on any nested executable → exit 1; root-only files in the pkg → exit 1. [VERIFIED: repo]

### Anti-Patterns to Avoid
- **Don't notarise the `.pkg`.** MAS submissions are NOT notarised — Apple does that server-side after upload. The direct DMG path notarises; the MAS path must not (and `build-appstore-bundle.sh` already scrubs `APPLE_*` notary env, lines 80–82 — replicate). [VERIFIED: repo + CITED Apple]
- **Don't set hardened runtime.** The appstore overlay already sets `hardenedRuntime: false` (verified in `tauri.appstore.conf.json`). MAS uses App Sandbox, not hardened runtime. [VERIFIED: repo]
- **Don't use `--deep` as the *only* nested-signing strategy and assume it's enough.** `--deep` re-signs nested code with the *same top-level entitlements*, which is what we want here (sandbox entitlement propagates), but the ITMS-90296 class shows it can still miss helpers if a nested Mach-O was signed separately upstream. Add an explicit per-executable sandbox-entitlement assert (Pitfall 3). [CITED: Apple forums + Tauri #13118]
- **Don't machine-upload or machine-submit** (D-01/D-04).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wrapping `.app` → MAS `.pkg` | a custom `pkgbuild` + `productbuild --distribution` XML | plain `productbuild --component App.app /Applications --sign …` | the single-component form is the documented MAS path; a distribution XML adds review surface with no benefit [CITED: Tauri docs] |
| Universal binary | manual `lipo -create` glue | Tauri's `--target universal-apple-darwin` (already wired) | the build already emits universal; just assert it [VERIFIED: repo] |
| Installer signature verify | parsing `codesign` output | `pkgutil --check-signature` | purpose-built for `.pkg` |
| Privacy manifest schema | freelancing keys | Apple's 4 documented top-level keys (Code Examples) | wrong keys → ITMS rejection |
| ASC field guidance | re-deriving setup | the committed `ASC-SETUP.md` (§§1–8) + `PHASE-26-ASC-CHECKLIST.md` | already written + Apple-cited; Phase 30 only adds the deferred-item delta [VERIFIED: repo] |
| Direct-channel un-regression | a new build harness | `pnpm release:publish --dry-run` (zero-side-effect, verified in source) | the dry-run path is purpose-built and unit-tested [VERIFIED: repo] |

**Key insight:** nearly all the build machinery already exists in the repo. Phase 30 is **composition + the one new `productbuild` step + metadata artifacts**, not net-new infrastructure. The biggest *unknown* is not "how do I build a pkg" — it's "what local signal proves it will clear ITMS without running `altool --validate-app`."

## Runtime State Inventory

> This is a ship/packaging phase, not a rename. The relevant "runtime state" is the build/sign inputs and what must be committed vs left local.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastores touched. | None. |
| Live service config | App Store Connect record + IAP `com.tinkerdev.app.pro` (Ready to Submit) live on ASC, not in git. The Paid-Apps Agreement / Sandbox tester live in ASC. | Verified via PHASE-26-ASC-CHECKLIST. The human confirms ASC state before Submit (D-04). |
| OS-registered state | **Code-signing identities in the login keychain:** Apple Distribution = PRESENT; Mac Installer Distribution = ABSENT [VERIFIED: `security find-identity`]. | Build script must fail closed when the installer cert is absent → point at ASC-SETUP §7 (human creates it). |
| Secrets/env vars | The pkg path must **scrub** `APPLE_ID/APPLE_PASSWORD/APPLE_API_*` (notary env) so a MAS build isn't accidentally notarised/Developer-ID-signed (existing `build-appstore-bundle.sh` lines 80–82). No new secrets. | Replicate the env-scrub in `build-appstore-pkg.sh`. |
| Build artifacts | Universal `.app` at `src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app`; the new `.pkg` is a build output (gitignore it). `embedded.provisionprofile` + `dev.provisionprofile` on disk but **gitignored** (`src-tauri/*.provisionprofile` in `.gitignore`) [VERIFIED]. | Decide commit-vs-local for the profile (see Open Question 1 / recommendation: keep gitignored-but-documented). Add `*.pkg` to `.gitignore` if not covered. |

## Common Pitfalls

### Pitfall 1: Distribution-signed sandboxed app won't launch locally (AMFI -413)
**What goes wrong:** if you try to launch the `.pkg`'s Apple-Distribution-signed `.app` on your dev Mac, it dies at launch ("No matching profile found" / restricted-entitlements validation failed).
**Why:** a MAS *distribution* profile authorizes an app installed *from the App Store* only; the app-sandbox + application-identifier entitlements are profile-restricted.
**How to avoid:** the **human ship-gate walkthrough launches the DEV-signed `.app`** (from `build-appstore-bundle.sh`), NOT the distribution-signed one. The distribution `.app`/`.pkg` is only *statically verified* + uploaded. Plan the two as distinct artifacts. [VERIFIED: `build-appstore-bundle.sh` lines 10–15]

### Pitfall 2: `spctl` "rejects" a MAS pkg — and that's EXPECTED
**What goes wrong:** `spctl -a -t install Foo.pkg` returns "rejected" / "source=no usable signature" and you think the build is broken.
**Why:** Gatekeeper assessment is for *notarised, distributed-outside-the-store* artifacts. MAS apps/pkgs are **not notarised** — Apple notarises them server-side after upload — so `spctl` legitimately rejects them. A PASS under `spctl` is NOT the MAS success signal.
**How to avoid:** do NOT gate on `spctl` accept for the pkg. The trustworthy local signals are: `pkgutil --check-signature` shows a valid **"3rd Party Mac Developer Installer"** chain; `codesign --verify --deep --strict` on the inner `.app` passes; the inner `.app` carries `app-sandbox` + the embedded distribution profile; `lipo` shows both arches. (If you run `spctl` at all, run it for *information* and assert the cert chain via `pkgutil`, not Gatekeeper acceptance.) [CITED: Apple — MAS not notarised] [MEDIUM confidence — the exact "passing" signal set is community-derived since D-02 forbids `altool --validate-app`, the only definitive local validator]

### Pitfall 3: ITMS-90296 — app-sandbox missing on a NESTED executable
**What goes wrong:** Transporter rejects with ITMS-90296 "App sandbox not enabled. The following executables must include the 'com.apple.security.app-sandbox' entitlement…", naming a nested helper/Mach-O.
**Why:** every executable in the bundle — not just the main binary — must carry the sandbox entitlement. A nested binary signed without it (or signed with different entitlements upstream) slips through `--deep` in some cases. This is a *documented real failure for Tauri MAS uploads*. [CITED: tauri-apps/tauri#13118, Apple forums]
**How to avoid (local pre-check):** after the deep re-sign, enumerate every Mach-O under the `.app` and assert each carries `com.apple.security.app-sandbox`:
```bash
find App.app/Contents -type f -perm +111 -exec sh -c \
  'codesign -d --entitlements - --xml "$1" 2>/dev/null | grep -q app-sandbox || echo "MISSING SANDBOX: $1"' _ {} \;
```
Any "MISSING SANDBOX" line → FATAL. (TinkerDev's tray/IPC are in-process Rust, so the bundle is likely single-Mach-O + frameworks — but assert, don't assume.) **Warning sign:** more than one Mach-O under `Contents/MacOS` or any `Contents/Frameworks/*.dylib` that didn't get the entitlement.

### Pitfall 4: Root-only files in the `.pkg` → upload rejection
**What goes wrong:** Transporter rejects: "The installer package includes files that are only readable by the root user" — code-signature verification then fails for non-root.
**Why:** files copied into the bundle (e.g. the profile, PrivacyInfo) can inherit restrictive perms; `productbuild`'s default install perms can leave root-only files. This is the *other* documented Tauri MAS rejection. [CITED: tauri-apps/tauri#13118]
**How to avoid (local pre-check + fix):** before `productbuild`, normalize perms in the `.app` (`chmod -R a+rX App.app`); after `productbuild`, assert no root-only payload file:
```bash
# expand payload and check perms (lsbom on the pkg's Bom)
pkgutil --payload-files App.pkg   # inventory; then verify perms in an expanded copy
```
Practical fix: ensure injected files (`embedded.provisionprofile`, `PrivacyInfo.xcprivacy`) are `chmod 644` before the seal. **Warning sign:** any `chmod`-restricted file you copied in.

### Pitfall 5: ITMS-90238 — invalid/inconsistent signature
**What goes wrong:** Transporter rejects with ITMS-90238 "Invalid Signature" (a sealed resource missing/invalid, or a nested item re-signed inconsistently).
**Why:** mixed signing identities across nested code, or a resource added after signing without a re-seal.
**How to avoid:** the existing `codesign --verify --deep --strict --verbose=2` gate (already FATAL in `build-appstore-bundle.sh` lines 192–199) catches inconsistency; ensure PrivacyInfo is injected *before* that seal, and that the env-scrub prevents a stray Developer-ID innard. [VERIFIED: repo + CITED Apple forums/thread/749235]

### Pitfall 6: Mac Installer Distribution cert absent → can't sign the pkg
**What goes wrong:** `productbuild --sign "3rd Party Mac Developer Installer: …"` fails — the cert is NOT in the keychain (verified).
**How to avoid:** the script's preflight resolves the installer identity and, if absent, **fails closed** with: "Mac Installer Distribution certificate not found — create it per docs/appstore/ASC-SETUP.md §7 (Certificates → + → Mac Installer Distribution → CSR), then re-run." Only the Account Holder/Admin can create it. [VERIFIED: `security find-identity` shows it absent; CITED: ASC-SETUP §7]

### Pitfall 7: Privacy-page copy edit breaks direct-channel truth (cross-repo)
**What goes wrong:** you rewrite `tinkerdev.io/privacy` to say "no network calls / StoreKit only" — but the **direct** DMG channel DOES use Keygen license validation + the updater, and that page serves *both* channels.
**Why:** the privacy page is one URL for both distribution channels.
**How to avoid:** make the copy **channel-aware** — describe license validation + update checks as "the direct download," and add an explicit "App Store edition" paragraph stating the MAS build has no license-server or update-check network calls and its only network actor is Apple's StoreKit for the IAP. Do NOT delete the Lemon Squeezy/Keygen/Resend disclosures (still true for direct). [VERIFIED: `tinkerdev-io/app/privacy/page.tsx` describes Lemon Squeezy + Keygen + updater]

### Pitfall 8: Stale `.app` handed to the human (the harness rule)
**What goes wrong:** an earlier checkpoint built the `.app`; later source lands; the human walks through a stale binary.
**How to avoid:** Build LAST. `verify-appstore-bundle.sh::assert_dist_freshness` already asserts `binary mtime > last source commit` (lines 293–379). The pkg script must run AFTER all source lands, and re-derive freshness. [VERIFIED: repo]

## Code Examples

### `productbuild`: signed `.app` → MAS `.pkg` (the one new step)
```bash
# Source: v2.tauri.app/distribute/app-store (verbatim command shape)
# The inner .app is ALREADY Apple-Distribution-signed + carries embedded.provisionprofile
# + PrivacyInfo.xcprivacy, and passed verify-appstore-bundle.sh.
INSTALLER_ID="$(security find-identity -v -p basic \
  | grep -oE '"3rd Party Mac Developer Installer: [^"]+"' | head -1 | tr -d '"')"
[ -n "$INSTALLER_ID" ] || { echo "ERROR: Mac Installer Distribution cert absent — see ASC-SETUP §7"; exit 1; }

xcrun productbuild \
  --component "src-tauri/target/universal-apple-darwin/release/bundle/macos/TinkerDev.app" \
  /Applications \
  --sign "$INSTALLER_ID" \
  "TinkerDev.pkg"
```

### App signing (Apple Distribution + entitlements + profile) — the swap vs the dev script
```bash
# Source: repo build-appstore-bundle.sh (lines 165-167), with SIGN_ID/PROFILE swapped
SIGN_ID="$(security find-identity -p codesigning -v | grep -oE '"Apple Distribution: [^"]+"' | head -1 | tr -d '"')"
PROFILE="src-tauri/embedded.provisionprofile"   # the MAS distribution profile (no ProvisionedDevices)
cp "$PROFILE" "$APP/Contents/embedded.provisionprofile"
cp src-tauri/PrivacyInfo.xcprivacy "$APP/Contents/Resources/PrivacyInfo.xcprivacy"   # BEFORE the seal (D-06)
chmod 644 "$APP/Contents/embedded.provisionprofile" "$APP/Contents/Resources/PrivacyInfo.xcprivacy"
codesign --force --deep --timestamp --sign "$SIGN_ID" \
  --entitlements src-tauri/entitlements.appstore.plist "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"   # FATAL on inconsistency (ITMS-90238 guard)
```

### `PrivacyInfo.xcprivacy` — Data Not Collected, no tracking (D-06)
```xml
<!-- Source: Apple bundle-resources/privacy-manifest-files + chockenberry gist; for a
     no-collection, no-tracking app. Place at App.app/Contents/Resources/PrivacyInfo.xcprivacy -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <!-- Only if the app reads UserDefaults at runtime. Tauri's window-state /
         preferences plugins MAY trigger the "required reason API" check. If the
         app touches NSUserDefaults, declare CA92.1 (app's own prefs):  -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array><string>CA92.1</string></array>
    </dict>
  </array>
</dict>
</plist>
```
**[MEDIUM confidence on the `NSPrivacyAccessedAPITypes` content]:** the four top-level keys + the empty-array values for no-tracking/no-collection are well-documented [CITED]. Whether TinkerDev needs any *required-reason API* entry (UserDefaults / file-timestamp / disk-space / system-boot-time) depends on what the Tauri plugins call at runtime — **verify against the actual `@tauri-apps/plugin-store` + window-state usage** during planning. An over-declared UserDefaults reason is harmless; a *missing* required-reason entry can bounce. Safe default: include the UserDefaults `CA92.1` entry (the prefs blob persists via the store plugin). [ASSUMED — confirm the plugin's API surface]

### Local pre-ITMS gate set (D-02 — no altool)
```bash
# (1) installer signature chain (3rd Party Mac Developer Installer)
pkgutil --check-signature TinkerDev.pkg
# (2) inner .app signature consistent
codesign --verify --deep --strict --verbose=2 "$APP"
# (3) universal
lipo -archs "$APP/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Contents/Info.plist")"
# (4) sandbox entitlement on EVERY nested Mach-O (ITMS-90296 pre-check — Pitfall 3)
# (5) no root-only payload files (Pitfall 4)
# (6) embedded distribution profile present + has NO ProvisionedDevices (it's a distribution profile)
# (7) the existing compliance gate
bash scripts/verify-appstore-bundle.sh "$APP" --require-bundle
```

### Direct-channel un-regression (MAS-SHIP-05)
```bash
pnpm release:publish --dry-run            # zero side effects, exits 0 (verified in source)
# decoder.ts byte-identity vs a known-good ref (no refactor allowed):
git diff --exit-code <known-good-ref> -- src/lib/decoder.ts src/lib/decoder.test.ts \
  || echo "DECODER CHANGED — FAIL"
pnpm vitest run src/lib/decoder.test.ts    # the immovable 19 tests
# Optional full proof (D-Discretion): a local universal DMG build+sign+notarise+staple
# with the Apple API-key env set but NO `gh release` — the publish() pipeline runs the
# build+notarise but you stop before the gh step (or use --dry-run for zero-cost proof).
```

### `/support` page (cross-repo, D-07) — LegalShell pattern
```tsx
// Source: tinkerdev-io/app/refunds/page.tsx + privacy/page.tsx pattern (LegalShell + SUPPORT_EMAIL)
// File: tinkerdev-io/app/support/page.tsx
import type { Metadata } from "next";
import { LegalShell } from "@/components/site/legal";
import { SUPPORT_EMAIL } from "@/components/site/data";
export const metadata: Metadata = { title: "Support — TinkerDev", description: "How to get help with TinkerDev." };
export default function SupportPage() {
  return (
    <LegalShell title="Support" updated="June 2026">
      <p>Need a hand with TinkerDev? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> …</p>
    </LegalShell>
  );
}
```
**Cross-repo note:** this + the privacy edit land in `/Users/boonkhailim/Documents/projects/bk/playground/tinkerdev-io`, a **separate Next.js 14 repo**. The ASC "Support URL" field needs `https://tinkerdev.io/support` to resolve — so the page must be **deployed live** before Submit (the human verifies the URL 200s). The footer currently links Support as a `mailto:` ([VERIFIED: `components/site/footer.tsx`]) — optionally update it to `/support`, but the ASC requirement is just that the URL resolves.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Mac App Distribution" + "3rd Party Mac Developer Application" cert | unified **Apple Distribution** cert | ~2021 | one cert signs the app for all platforms; the keychain already has it [VERIFIED] |
| No privacy manifest | `PrivacyInfo.xcprivacy` + required-reason APIs | enforced since May 1 2024 | mandatory now (D-06) [CITED: Bitrise/Apple] |
| `altool` as primary uploader | Transporter.app (GUI) or `notarytool`/`altool` (CLI) | `altool` still works for `--upload-app`; Transporter preferred for first/manual uploads | D-01 picks Transporter [CITED] |

**Deprecated/outdated:**
- `application-loader` / old Application Loader.app — replaced by Transporter.app.
- Signing the `.pkg` with a *Developer ID Installer* cert — that's the **direct** channel; MAS needs **Mac Installer Distribution**.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The local gate set (`pkgutil` + `codesign --deep --strict` + sandbox-entitlement assert + `lipo` + profile assert) is sufficient to predict an ITMS PASS without `altool --validate-app` | Pitfall 2, Code Examples | MEDIUM — a first upload could still bounce; mitigated by D-01 (human Transporter surfaces the bounce before commit). This is the inherent cost of the D-02 no-API-key decision. |
| A2 | TinkerDev's appstore `.app` is effectively single-Mach-O (no extra nested executables needing separate sandbox entitlement) | Pitfall 3 | LOW–MED — if a nested helper exists, the per-Mach-O assert catches it; plan must actually run the assert, not assume. |
| A3 | `PrivacyInfo.xcprivacy` may need a UserDefaults `CA92.1` required-reason entry (prefs persist via the store plugin) | Code Examples | LOW — over-declaring is harmless; under-declaring can bounce. Verify the `@tauri-apps/plugin-store`/window-state API surface during planning. |
| A4 | Installer cert resolves via `security find-identity -v -p basic` and appears literally as `3rd Party Mac Developer Installer: …` | Standard Stack | LOW — confirm once the human creates the cert; the script should grep both the modern and legacy label strings to be safe. |
| A5 | Mac screenshots reject alpha/transparency | Standard Stack | LOW — flatten PNGs regardless; cheap insurance. |
| A6 | The privacy page serves both channels from one URL (so the edit must stay channel-aware) | Pitfall 7 | LOW — confirmed the page describes direct-channel actors; the edit must not lie for direct users. |

## Open Questions (RESOLVED)

1. **Commit vs gitignore the `embedded.provisionprofile`?**
   - What we know: it's currently **gitignored** (`src-tauri/*.provisionprofile`) but present on disk; it's a true **distribution** profile (no `ProvisionedDevices`, no `get-task-allow` — verified). It contains the team's **public** cert bits + the App ID, NOT private keys — committing it is *generally safe* (it's embedded in every shipped `.app` anyway).
   - What's unclear: whether the project wants build reproducibility (commit it) vs minimal secret-surface hygiene (keep local). It expires **2027-06-22** — a committed copy goes stale and needs regen-on-expiry.
   - **Recommendation:** **keep it gitignored but documented** — the script reads it from `src-tauri/embedded.provisionprofile` and fails closed with a "download the MAS profile per ASC-SETUP §7" message if absent (mirrors the dev-profile handling in `build-appstore-bundle.sh` lines 59–66). This matches the existing convention and avoids a stale-on-expiry committed binary. Document the profile's identity ("TinkerDev MAS") + expiry in the runbook. [Confidence: MEDIUM — a defensible call either way; the gitignore precedent tips it to local.]

2. **Does any Tauri plugin trigger a required-reason API beyond UserDefaults?** (file-timestamp, disk-space, system-boot-time). Resolve by auditing `@tauri-apps/plugin-store`, window-state, and global-shortcut native calls during planning. Over-declaration is safe; the planner should err toward declaring UserDefaults at minimum.

3. **Where does the IAP review screenshot come from?** ASC-SETUP §5 needs a screenshot of the *purchase context* (the Buy/Restore License pane). This is captured during the human ship-gate walkthrough on the dev-signed `.app` — sequence it into the walkthrough, not the agent's static work.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `productbuild` / `codesign` / `pkgutil` / `spctl` / `lipo` (Xcode CLT) | the pkg build | ✓ (Xcode CLT installed — prior phases used `codesign`/`lipo`) | system | — |
| Apple Distribution cert | sign the `.app` | ✓ | `Apple Distribution: Boon Khai Lim (FK4HQK83WX)` | — |
| **Mac Installer Distribution cert** | sign the `.pkg` | **✗** | — | **none — human creates per ASC-SETUP §7 (blocking)** |
| `embedded.provisionprofile` (MAS dist) | embed in `.app` | ✓ on disk (gitignored) | "TinkerDev MAS", exp 2027-06-22 | regenerate from portal if absent |
| Transporter.app | human upload (D-01) | ? (human installs from Mac App Store) | — | `xcrun altool` (deferred, needs API key — out of scope) |
| `gh` CLI + auth (for the dry-run preflight) | `release:publish --dry-run` | ✓ (used by direct channel) | — | — |

**Missing dependencies with no fallback (blocking):**
- **Mac Installer Distribution certificate** — the `.pkg` cannot be signed without it. The build script must detect its absence and fail closed pointing at ASC-SETUP §7. This is a human action (Account Holder/Admin only).

**Missing dependencies with fallback:**
- Transporter.app — if not installed, the human installs it from the Mac App Store (the runbook says so); `altool` is the deferred CLI alternative.

## Validation Architecture

> nyquist_validation not explicitly disabled — including. Note: this phase is shell/packaging + human-gate-heavy; most "tests" are FATAL shell asserts, not vitest, plus the immovable decoder suite for MAS-SHIP-05.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + bash self-tests (build/verify scripts) |
| Config file | `vite.config.ts` (existing — vitest config inline); scripts self-test via `--selftest` flags |
| Quick run command | `pnpm vitest run src/lib/protobuf/decoder.test.ts` (the 19 immovable tests) |
| Full suite command | `pnpm vitest run && pnpm tsc --noEmit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAS-SHIP-01 | signed `.pkg` produced + locally verified | shell asserts (FATAL) | `bash scripts/build-appstore-pkg.sh` (its tail gates) | ❌ Wave 0 — new script |
| MAS-SHIP-01 | inner `.app` sandbox on every Mach-O | shell assert | per-Mach-O `codesign -d --entitlements` grep | ❌ Wave 0 — add to new script / verify script |
| MAS-SHIP-01 | universal | shell assert | `lipo -archs` (reuse `assert_binary_integrity`) | ✅ `verify-appstore-bundle.sh` |
| MAS-SHIP-04 | PrivacyInfo present + well-formed | shell assert | `plutil -lint App.app/Contents/Resources/PrivacyInfo.xcprivacy` | ❌ Wave 0 |
| MAS-SHIP-05 | direct channel un-regressed | preflight + unit | `pnpm release:publish --dry-run` (exit 0) | ✅ source |
| MAS-SHIP-05 | decoder byte-identical | unit + git | `pnpm vitest run src/lib/protobuf/decoder.test.ts` + `test -f src/lib/protobuf/decoder.ts && git diff --exit-code -- src/lib/protobuf/decoder.ts` | ✅ tests exist |

### Sampling Rate
- **Per task commit:** `pnpm vitest run src/lib/protobuf/decoder.test.ts` + `pnpm tsc --noEmit`; for script tasks, the script's `--selftest`.
- **Per wave merge:** full `pnpm vitest run` + `bash scripts/verify-appstore-bundle.sh --selftest --selftest-realbuild`.
- **Phase gate:** the human ship-gate walkthrough (signed dev `.app`: purchase, restore on fresh container, refund→drop) + `.pkg` local-verify green + direct dry-run green, BEFORE Transporter upload + Submit (D-04). Build LAST.

### Wave 0 Gaps
- [ ] `scripts/build-appstore-pkg.sh` — new (productbuild + local gates) — covers MAS-SHIP-01/02-prep
- [ ] Per-Mach-O sandbox-entitlement assert + root-only-files assert — add to the new script or extend `verify-appstore-bundle.sh` (ITMS-90296/permissions pre-checks)
- [ ] `src-tauri/PrivacyInfo.xcprivacy` + a `plutil -lint` gate — MAS-SHIP-04 / D-06
- [ ] `docs/appstore/SUBMISSION-RUNBOOK.md` + `Notes-for-Review.md` + `screenshots/` — MAS-SHIP-04 / D-05
- [ ] Cross-repo: `tinkerdev-io/app/support/page.tsx` + privacy copy edit — D-07 (must be deployed live before Submit)

## Security Domain

> `security_enforcement` not explicitly false — including. This phase is packaging/signing; the security surface is supply-chain + signing integrity + data-collection accuracy, not app input handling.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth in app (StoreKit handled by Apple) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no (no new input paths) | decoder unchanged (MAS-SHIP-05) |
| V6 Cryptography | yes (signing) | Apple Distribution + Mac Installer Distribution code signing; never hand-roll; `codesign --verify --deep --strict` is the integrity gate |
| V14 Config / Build | yes | env-scrub of notary secrets; no secrets in argv (existing `build-and-publish.mjs` discipline); profile is public-bits-only |

### Known Threat Patterns for the MAS ship path
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mixed/Developer-ID innard sneaks into a MAS build → ITMS-90238 | Tampering | env-scrub `APPLE_*` + pin `APPLE_SIGNING_IDENTITY` (existing pattern); `codesign --verify --deep --strict` FATAL |
| Over-broad privacy declaration / inaccurate "Data Not Collected" | Repudiation/Info-disclosure (compliance) | privacy page is genuinely Data Not Collected for the store build; channel-aware copy so it's also true for direct |
| Committing private signing material | Info disclosure | never commit certs/keys; the profile (public bits only) stays gitignored per existing convention |
| Stale `.app` shipped to the human | Tampering (integrity) | `assert_dist_freshness` (binary mtime > last source commit); build LAST |

## Sources

### Primary (HIGH confidence)
- Repo files: `scripts/build-appstore-bundle.sh`, `scripts/verify-appstore-bundle.sh`, `scripts/build-and-publish.mjs`, `src-tauri/tauri.appstore.conf.json`, `src-tauri/entitlements.appstore.plist`, `tauri.conf.json` (base version 0.4.1), `tinkerdev-io/app/{privacy,refunds}/page.tsx`, `components/site/{legal,data,footer}.tsx` — read directly.
- `security find-identity -p codesigning -v` — Apple Distribution PRESENT, Mac Installer Distribution ABSENT.
- `security cms -D -i src-tauri/embedded.provisionprofile` — "TinkerDev MAS", no ProvisionedDevices, no get-task-allow, exp 2027-06-22.
- `docs/appstore/ASC-SETUP.md` §§1–8 (Apple-cited), `docs/appstore/PHASE-26-ASC-CHECKLIST.md` (deferred-to-Phase-30 list).
- Apple — Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/ (1280×800 / 1440×900 / 2560×1600 / 2880×1800, 16:10, 1–10, png/jpg).
- Tauri — App Store distribution: https://v2.tauri.app/distribute/app-store/ (productbuild + altool command shapes).

### Secondary (MEDIUM confidence)
- tauri-apps/tauri#13118 — real Tauri MAS upload failures: ITMS-90296 (sandbox on nested executables) + root-only-files. https://github.com/tauri-apps/tauri/issues/13118
- Apple Developer Forums thread/128166 (productbuild + installer cert naming), thread/749235 (ITMS-90238).
- chockenberry PrivacyInfo.xcprivacy gist + Apple bundle-resources privacy-manifest docs (4 top-level keys, no-collection values).

### Tertiary (LOW confidence — flagged for human/Transporter validation)
- The precise "this passes ITMS" local signal set without `altool --validate-app` (D-02) — the first Transporter upload is the real validator (mitigated by D-01).

## Metadata

**Confidence breakdown:**
- Standard stack (commands/certs/screenshots): HIGH — repo-verified certs + Apple-cited specs + Tauri official command shapes.
- Architecture (reuse-not-overload, inject-then-seal): HIGH — extends an existing, proven script.
- Pitfalls (ITMS-90296/90238, root-only-files, spctl semantics): MEDIUM-HIGH — documented real Tauri MAS failures with local pre-checks; the *sufficiency* of local checks (vs altool) is the residual MEDIUM.
- PrivacyInfo required-reason content: MEDIUM — keys/values cited; the exact API entries need a plugin audit.

**Research date:** 2026-06-25
**Valid until:** ~2026-07-25 (Apple ASC UI labels + cert names drift; re-confirm screenshot specs + cert label strings at execution time).
