#!/usr/bin/env bash
# Phase 30 (MAS-SHIP-01/02) — the TERMINAL `.pkg` build. Produces a
# DISTRIBUTION-signed Mac App Store `.pkg`, locally verified, ready for a HUMAN
# Transporter upload + Submit-for-Review. NEVER machine-uploads / machine-submits.
#
# This is the ONE net-new piece of infrastructure in Phase 30. It REUSES the proven
# build-appstore-bundle.sh machinery (do NOT edit that script — it keeps the dev-signed
# local-LAUNCH path; this script is the dedicated distribution path, CONTEXT D-Discretion)
# with exactly three swaps + the `productbuild` step + local pre-ITMS gates:
#
#   SWAP 1  SIGN_ID  = the **Apple Distribution** identity (NOT "Apple Development").
#                     The dev script signs for LOCAL launch; this signs for the store.
#   SWAP 2  PROFILE  = src-tauri/embedded.provisionprofile — the **Mac App Store
#                     distribution** profile ("TinkerDev MAS", NO ProvisionedDevices).
#                     (The dev script embeds dev.provisionprofile for THIS Mac.)
#   SWAP 3  INSTALLER_ID = the **Mac Installer Distribution** cert (a.k.a. "3rd Party
#                     Mac Developer Installer") — signs the `.pkg` installer itself.
#   + INJECT src-tauri/PrivacyInfo.xcprivacy into Contents/Resources/ BEFORE the deep
#     re-sign (Pattern 2 — inject-then-seal; a post-sign resource invalidates the seal).
#   + productbuild --component App.app /Applications --sign "$INSTALLER_ID" → the `.pkg`.
#   + local pre-ITMS gates (D-02, NO altool — that needs the ASC API key we deliberately
#     avoid): per-Mach-O app-sandbox assert (ITMS-90296), chmod-a+rX + no-root-only assert
#     (root-only payload bounce), pkgutil --check-signature chain, a STRONG embedded-profile
#     validity assert (TeamIdentifier + app id + unexpired + distribution), lipo two-arch,
#     and the existing verify-appstore-bundle.sh --require-bundle compliance + freshness gate.
#
# WHY local-verify-only (no altool / Transporter here): CONTEXT D-01/D-02 — the irreversible
# Apple submission is 100% human (D-04). This script stops at a locally-verified `.pkg` and
# hands the path + SUBMISSION-RUNBOOK.md to the human.
#
# DOES NOT notarise (scrubs the APPLE_* notary env like the dev script — a MAS build has no
# hardened runtime; notarising it would Developer-ID-sign the innards → ITMS-90238). DOES NOT
# gate on `spctl` accept — a MAS pkg legitimately REJECTS under Gatekeeper (it is not notarised,
# Pitfall 2); the trustworthy signal is the pkgutil installer chain + codesign --deep --strict.
#
# Build LAST: re-asserts the bundle binary mtime > the last source commit (via
# verify-appstore-bundle.sh --require-bundle) so a stale .app is never packaged (Pitfall 8).
#
# Usage:
#   bash scripts/build-appstore-pkg.sh                 # full build → signed .pkg + local gates
#   bash scripts/build-appstore-pkg.sh --check-prereqs # ONLY the cert/profile preflights, no build
#                                                      # (proves fail-closed without the installer cert)
#   pnpm tauri:build:appstore:pkg                      # the canonical command
# Env:
#   SIGN_ID      override the auto-detected "Apple Distribution: …" identity
#   INSTALLER_ID override the auto-detected "3rd Party Mac Developer Installer: …" identity
#   PROFILE      override src-tauri/embedded.provisionprofile (the MAS distribution profile)

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHECK_PREREQS=0
case "${1:-}" in
  --check-prereqs) CHECK_PREREQS=1 ;;
  --help|-h)
    sed -n '2,55p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0 ;;
  "") ;;
  *) echo "ERROR: unknown argument '$1' (try --help)"; exit 1 ;;
esac

PROFILE="${PROFILE:-src-tauri/embedded.provisionprofile}"
ENTITLEMENTS="src-tauri/entitlements.appstore.plist"
PRIVACY="src-tauri/PrivacyInfo.xcprivacy"
TARGET="universal-apple-darwin"
APP_OUT="src-tauri/target/${TARGET}/release/bundle/macos/TinkerDev.app"
PKG_OUT="src-tauri/target/${TARGET}/release/bundle/macos/TinkerDev.pkg"

# Expected identity values pinned to the team + bundle id (must stay consistent with
# entitlements.appstore.plist application-identifier + tauri.conf.json identifier).
EXPECT_TEAM="FK4HQK83WX"
EXPECT_APPID="FK4HQK83WX.com.tinkerdev.app"

# === Preflight: resolve + fail-closed on the three signing identities + the profile ========

# SWAP 1 — Apple Distribution (NOT Apple Development). Codesigning-policy cert.
SIGN_ID="${SIGN_ID:-$(security find-identity -p codesigning -v 2>/dev/null \
  | grep -oE '"Apple Distribution: [^"]+"' | head -1 | tr -d '"')}"
if [[ -z "$SIGN_ID" ]]; then
  echo "ERROR: no 'Apple Distribution' signing identity in the keychain." >&2
  echo "       The MAS .pkg's inner .app MUST be signed with Apple Distribution (not Apple" >&2
  echo "       Development — that is the local-launch dev script). Create/download it per" >&2
  echo "       docs/appstore/ASC-SETUP.md §7, then re-run. (Set SIGN_ID=… to pin one.)" >&2
  echo "Present codesigning identities:" >&2
  security find-identity -p codesigning -v | sed 's/^/  /' >&2
  exit 1
fi

# SWAP 3 — Mac Installer Distribution (a.k.a. "3rd Party Mac Developer Installer").
# Installer certs are NOT codesigning-policy certs → use `-p basic` (Pitfall 6, A4). Grep
# BOTH the modern "Mac Installer Distribution" label and the legacy "3rd Party Mac Developer
# Installer" label for safety — they are the same cert under different portal/keychain names.
INSTALLER_ID="${INSTALLER_ID:-$(security find-identity -v -p basic 2>/dev/null \
  | grep -oE '"(3rd Party Mac Developer Installer|Mac Installer Distribution): [^"]+"' \
  | head -1 | tr -d '"')}"
if [[ -z "$INSTALLER_ID" ]]; then
  echo "ERROR: Mac Installer Distribution certificate not found — create it per docs/appstore/ASC-SETUP.md §7, then re-run." >&2
  echo "       (developer.apple.com → Certificates → + → Mac Installer Distribution → CSR →" >&2
  echo "        download + install into the login keychain; Account Holder/Admin only — Pitfall 6.)" >&2
  echo "       The Apple Distribution app-signing cert is already present; only the INSTALLER" >&2
  echo "       cert (which signs the .pkg) is missing." >&2
  echo "Present basic identities:" >&2
  security find-identity -v -p basic | sed 's/^/  /' >&2
  exit 1
fi

# SWAP 2 — the MAS distribution provisioning profile (mirror the dev script's missing-profile block).
if [[ ! -f "$PROFILE" ]]; then
  echo "ERROR: MAS distribution provisioning profile not found at '$PROFILE'." >&2
  echo "       Download the 'TinkerDev MAS' Mac App Store distribution profile (no" >&2
  echo "       ProvisionedDevices) for com.tinkerdev.app per docs/appstore/ASC-SETUP.md §7," >&2
  echo "       save it there (or set PROFILE=…). This is the DISTRIBUTION profile, not the" >&2
  echo "       dev.provisionprofile the local-launch script uses." >&2
  exit 1
fi
if [[ ! -f "$ENTITLEMENTS" ]]; then
  echo "ERROR: entitlements file not found at '$ENTITLEMENTS'." >&2
  exit 1
fi
if [[ ! -f "$PRIVACY" ]]; then
  echo "ERROR: PrivacyInfo.xcprivacy not found at '$PRIVACY' (Plan 30-01 should have added it)." >&2
  exit 1
fi
if ! security find-identity -p codesigning -v | grep -qF "$SIGN_ID"; then
  echo "ERROR: Apple Distribution signing identity not in keychain: '$SIGN_ID'" >&2
  exit 1
fi

echo "[appstore-pkg] Apple Distribution identity : $SIGN_ID"
echo "[appstore-pkg] Mac Installer Distribution  : $INSTALLER_ID"
echo "[appstore-pkg] embedded profile            : $PROFILE"

if [[ "$CHECK_PREREQS" -eq 1 ]]; then
  echo "[appstore-pkg] --check-prereqs: all signing prerequisites present (no build run)."
  exit 0
fi

# === Strong embedded-profile validity gate (Finding 3 / T-30-16) ===========================
# A stale/wrong/EXPIRED profile must fail HERE (locally), not bounce at Transporter. Decode
# the profile (security cms -D) and FATAL-assert ALL of: TeamIdentifier == FK4HQK83WX; the
# Entitlements application-identifier == FK4HQK83WX.com.tinkerdev.app (consistent with
# entitlements.appstore.plist + tauri.conf.json bundle id); ExpirationDate in the FUTURE;
# get-task-allow absent/false; and NO ProvisionedDevices (a distribution, not a dev, profile).
assert_embedded_profile_valid() {
  local prof="$1"
  local plist; plist="$(security cms -D -i "$prof" 2>/dev/null)"
  if [[ -z "$plist" ]]; then
    echo "ERROR: could not decode the embedded profile '$prof' (security cms -D) — see docs/appstore/ASC-SETUP.md §7" >&2
    return 1
  fi
  local tmp; tmp="$(mktemp -t mas-profile)"
  printf '%s' "$plist" > "$tmp"

  # PlistBuddy splits the key path on ':' only, so the dotted Apple key
  # ':Entitlements:com.apple.application-identifier' resolves correctly (a bare
  # 'application-identifier' would MISS — the real profile uses the com.apple.* prefix).
  # ExpirationDate is read via plutil as a clean ISO8601 'Z' string (trivially parseable).
  local team appid expiry gettask provdevices
  team="$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$tmp" 2>/dev/null)"
  appid="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.application-identifier' "$tmp" 2>/dev/null)"
  expiry="$(plutil -extract 'ExpirationDate' raw -o - "$tmp" 2>/dev/null)"
  gettask="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:get-task-allow' "$tmp" 2>/dev/null)"
  # Capture stderr: PlistBuddy prints "… Does Not Exist" on a missing key (the good,
  # distribution-profile case); a present key prints the array contents (the dev-profile case).
  provdevices="$(/usr/libexec/PlistBuddy -c 'Print :ProvisionedDevices' "$tmp" 2>&1)"
  rm -f "$tmp"

  local bad=0
  if [[ "$team" != "$EXPECT_TEAM" ]]; then
    echo "ERROR: embedded profile TeamIdentifier '$team' != expected '$EXPECT_TEAM' — wrong profile (see ASC-SETUP §7)" >&2; bad=1
  fi
  if [[ "$appid" != "$EXPECT_APPID" ]]; then
    echo "ERROR: embedded profile application-identifier '$appid' != expected '$EXPECT_APPID' — wrong app id (see ASC-SETUP §7)" >&2; bad=1
  fi
  # ExpirationDate must be in the FUTURE. plutil emits ISO8601 UTC, e.g. "2027-06-22T21:54:10Z".
  if [[ -z "$expiry" ]]; then
    echo "ERROR: embedded profile has no ExpirationDate — cannot prove it is unexpired (see ASC-SETUP §7)" >&2; bad=1
  else
    local exp_epoch now_epoch
    # BSD date (macOS): parse the ISO8601 'Z' form. GNU date fallback for CI.
    exp_epoch="$(date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$expiry" +%s 2>/dev/null)"
    [[ -z "$exp_epoch" ]] && exp_epoch="$(date -d "$expiry" +%s 2>/dev/null)"
    now_epoch="$(date +%s)"
    if [[ -z "$exp_epoch" ]]; then
      echo "ERROR: could not parse the embedded profile ExpirationDate '$expiry' — cannot prove it is unexpired" >&2; bad=1
    elif [[ "$exp_epoch" -le "$now_epoch" ]]; then
      echo "ERROR: embedded profile is EXPIRED ($expiry) — renew it per docs/appstore/ASC-SETUP.md §7" >&2; bad=1
    fi
  fi
  # get-task-allow must be absent or false (a distribution profile). PlistBuddy prints "true"/"false".
  if [[ "$gettask" == "true" ]]; then
    echo "ERROR: embedded profile has get-task-allow=true — that is a DEVELOPMENT profile, not a distribution one (see ASC-SETUP §7)" >&2; bad=1
  fi
  # NO ProvisionedDevices — a distribution profile has none (a dev profile lists this Mac).
  # PlistBuddy errors on a missing key (good); a present key prints "Array {...}" (bad).
  if [[ -n "$provdevices" && "$provdevices" != *"Does Not Exist"* ]]; then
    echo "ERROR: embedded profile carries ProvisionedDevices — that is a DEVELOPMENT profile, not a distribution one (see ASC-SETUP §7)" >&2; bad=1
  fi
  [[ "$bad" -eq 0 ]] || return 1
  echo "[appstore-pkg] embedded profile valid: team=$team appid=$appid expires=$expiry, get-task-allow≠true, no ProvisionedDevices ✓"
}
if ! assert_embedded_profile_valid "$PROFILE"; then
  echo "ERROR: the embedded MAS distribution profile failed validation — a stale/wrong/expired profile would bounce at Transporter; fix it now (docs/appstore/ASC-SETUP.md §7)." >&2
  exit 1
fi

# === Build the universal appstore bundle, signed Apple Distribution, no notarisation =======
# Scrub the direct-channel notary env so it cannot hijack this MAS build (a MAS build has no
# hardened runtime → notarising fails AND Developer-ID-signs the innards → ITMS-90238), then
# pin APPLE_SIGNING_IDENTITY so the WHOLE bundle signs Apple Distribution in one pass.
unset APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID \
      APPLE_API_KEY APPLE_API_ISSUER APPLE_API_KEY_PATH \
      APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_KEYCHAIN 2>/dev/null || true
export APPLE_SIGNING_IDENTITY="$SIGN_ID"

# Pre-build freshness marker — assert the produced binary is NEWER than it, so a skipped/failed
# build can never masquerade as fresh (copied verbatim from build-appstore-bundle.sh).
BUILD_MARKER="$(mktemp -t appstore-pkg-build-marker)"
trap 'rm -f "$BUILD_MARKER"' EXIT

echo "[appstore-pkg] building universal appstore bundle, signed Apple Distribution (no notarisation)…"
# HYBRID guard: the appstore feature MUST always be paired with --no-default-features so the
# default `direct` umbrella feature is dropped (otherwise updater/keyring/license link in — a
# silent hybrid binary, caught by the lib.rs compile_error! guard but pinned here too). The
# --no-default-features token is a CARGO flag (the Tauri CLI has no such flag) so it goes after
# the `--` runner-args separator. Kept on the SAME line as the feature flag so the two can
# never drift apart. Same invocation + committed overlay as the dev script.
MACOSX_DEPLOYMENT_TARGET=13.0 pnpm tauri build --features appstore --target "$TARGET" --bundles app --config src-tauri/tauri.appstore.conf.json -- --no-default-features || true

if [[ ! -d "$APP_OUT" ]]; then
  echo "ERROR: bundle not produced at $APP_OUT — check the build log above." >&2
  exit 1
fi

APP_BIN="$APP_OUT/Contents/MacOS/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP_OUT/Contents/Info.plist" 2>/dev/null)"
if [[ ! -f "$APP_BIN" ]]; then
  echo "ERROR: could not resolve the bundle executable via CFBundleExecutable at $APP_OUT/Contents/Info.plist" >&2
  exit 1
fi
if [[ ! "$APP_BIN" -nt "$BUILD_MARKER" ]]; then
  echo "ERROR: the bundle at $APP_OUT is STALE (older than this run) — the real appstore build" >&2
  echo "       did not produce a fresh binary. Check the build log above (flag-parse / codegen)." >&2
  exit 1
fi

# === Inject the profile + PrivacyInfo BEFORE the deep re-sign (Pattern 2 — inject then seal) =
echo "[appstore-pkg] embedding distribution profile + PrivacyInfo.xcprivacy (before the seal)…"
rm -f "$APP_OUT/Contents/embedded.provisionprofile"
if ! cp "$PROFILE" "$APP_OUT/Contents/embedded.provisionprofile"; then
  echo "ERROR: failed to copy the distribution profile '$PROFILE' into the bundle." >&2
  exit 1
fi
if ! cp "$PRIVACY" "$APP_OUT/Contents/Resources/PrivacyInfo.xcprivacy"; then
  echo "ERROR: failed to copy '$PRIVACY' into Contents/Resources/." >&2
  exit 1
fi
chmod 644 "$APP_OUT/Contents/embedded.provisionprofile" "$APP_OUT/Contents/Resources/PrivacyInfo.xcprivacy"

# Strip ALL extended attributes from the payload BEFORE the seal. macOS `cp`
# preserves xattrs, so a profile/PrivacyInfo downloaded via a browser carries
# com.apple.quarantine into the .app — which Transporter rejects (91109:
# "com.apple.quarantine extended file attribute isn't permitted"). Clearing
# recursively (not just the profile) catches any other quarantined payload file,
# and must run before codesign so the signature covers the cleaned tree.
echo "[appstore-pkg] stripping extended attributes (com.apple.quarantine et al — ITMS 91109)…"
xattr -cr "$APP_OUT"

# === Deep re-sign so the seal covers the embedded profile + PrivacyInfo + appstore entitlements
echo "[appstore-pkg] deep re-signing with Apple Distribution + appstore entitlements…"
if ! codesign --force --deep --timestamp --sign "$SIGN_ID" \
       --entitlements "$ENTITLEMENTS" "$APP_OUT"; then
  echo "ERROR: deep re-sign failed." >&2
  exit 1
fi
# FATAL deep --strict verify (ITMS-90238 guard — an inconsistent nested signature would bounce).
if ! codesign --verify --deep --strict --verbose=2 "$APP_OUT" 2>/dev/null; then
  echo "ERROR: deep codesign verification FAILED — the bundle is not internally consistent." >&2
  codesign --verify --deep --strict --verbose=2 "$APP_OUT" 2>&1 | sed 's/^/    /' | head -8 >&2
  exit 1
fi

# === Local pre-ITMS gates (D-02, no altool — each FATAL) ==================================

# (1) per-Mach-O app-sandbox assert (ITMS-90296 / Pitfall 3): every Mach-O under the .app must
#     carry com.apple.security.app-sandbox. A nested helper missing it bounces at Transporter.
echo "[appstore-pkg] per-Mach-O app-sandbox check (ITMS-90296)…"
sandbox_miss=0
while IFS= read -r f; do
  # Only inspect actual Mach-O files (executables/dylibs); skip scripts/resources.
  if file "$f" 2>/dev/null | grep -q 'Mach-O'; then
    if ! codesign -d --entitlements - --xml "$f" 2>/dev/null | grep -q 'app-sandbox'; then
      echo "  MISSING SANDBOX: $f" >&2
      sandbox_miss=1
    fi
  fi
done < <(find "$APP_OUT/Contents" -type f -perm +111)
if [[ "$sandbox_miss" -ne 0 ]]; then
  echo "ERROR: one or more nested Mach-O executables lack the app-sandbox entitlement (ITMS-90296)." >&2
  exit 1
fi
echo "  every nested Mach-O carries app-sandbox ✓"

# (1b) no com.apple.quarantine anywhere in the payload (ITMS 91109). The xattr -cr
# above strips it pre-seal; this FATAL assert proves it actually stuck (e.g. a
# re-downloaded profile re-quarantined after a partial run).
echo "[appstore-pkg] quarantine-xattr check (ITMS 91109)…"
if xattr -lr "$APP_OUT" 2>/dev/null | grep -q "com.apple.quarantine"; then
  echo "ERROR: com.apple.quarantine xattr present in the payload (ITMS 91109)." >&2
  xattr -lr "$APP_OUT" 2>/dev/null | grep "com.apple.quarantine" | head >&2
  exit 1
fi
echo "  no com.apple.quarantine in the payload ✓"

# (2) normalize perms so productbuild cannot leave root-only payload files (Pitfall 4).
chmod -R a+rX "$APP_OUT"

# (3) productbuild the signed .app into a Mac Installer Distribution-signed .pkg (the one new step).
echo "[appstore-pkg] productbuild → signed .pkg…"
rm -f "$PKG_OUT"
if ! xcrun productbuild --component "$APP_OUT" /Applications --sign "$INSTALLER_ID" "$PKG_OUT"; then
  echo "ERROR: productbuild failed." >&2
  exit 1
fi
if [[ ! -f "$PKG_OUT" ]]; then
  echo "ERROR: .pkg not produced at $PKG_OUT." >&2
  exit 1
fi

# (4) no root-only payload file (Pitfall 4): expand the pkg payload and assert every file is
#     at least owner+group+other readable (a 0-perm-for-other file is a documented bounce).
echo "[appstore-pkg] no-root-only-files check (Pitfall 4)…"
PKG_EXPAND="$(mktemp -d -t appstore-pkg-expand)"
trap 'rm -f "$BUILD_MARKER"; rm -rf "$PKG_EXPAND"' EXIT
rm -rf "$PKG_EXPAND"
if pkgutil --expand "$PKG_OUT" "$PKG_EXPAND" 2>/dev/null; then
  rootonly="$(find "$PKG_EXPAND" -type f ! -perm -004 2>/dev/null)"
  if [[ -n "$rootonly" ]]; then
    echo "ERROR: root-only (non-world-readable) payload file(s) in the .pkg (Pitfall 4):" >&2
    printf '%s\n' "$rootonly" | sed 's/^/    /' >&2
    exit 1
  fi
  echo "  no root-only payload files ✓"
else
  echo "  (could not expand the pkg for the perms inventory — relying on chmod -R a+rX above)"
fi

# (5) pkgutil --check-signature must show a Mac Installer Distribution / 3rd Party Mac Developer
#     Installer chain (the local installer-signature signal — D-02).
echo "[appstore-pkg] pkgutil --check-signature…"
SIG_OUT="$(pkgutil --check-signature "$PKG_OUT" 2>&1)"
printf '%s\n' "$SIG_OUT" | sed 's/^/    /'
if ! printf '%s' "$SIG_OUT" | grep -qE '3rd Party Mac Developer Installer|Mac Installer Distribution'; then
  echo "ERROR: the .pkg is not signed with a Mac Installer Distribution chain (pkgutil --check-signature)." >&2
  exit 1
fi
echo "  installer signature chain valid ✓"

# (6) universal — both arches (a single-arch build is rejected by ASC).
echo "[appstore-pkg] lipo two-arch check…"
ARCHS="$(lipo -archs "$APP_BIN" 2>/dev/null)"
if ! grep -qw x86_64 <<<"$ARCHS" || ! grep -qw arm64 <<<"$ARCHS"; then
  echo "ERROR: the signed binary is NOT universal (lipo -archs = '${ARCHS:-<none>}'; expected x86_64 arm64)." >&2
  exit 1
fi
echo "  universal (lipo -archs: $ARCHS) ✓"

# (7) the existing compliance + freshness/Build-LAST gate (re-asserts binary mtime > last source
#     commit so a stale .app is never packaged — Pitfall 8). FATAL on any finding.
echo "[appstore-pkg] verify-appstore-bundle.sh --require-bundle (compliance + freshness)…"
if ! bash scripts/verify-appstore-bundle.sh "$APP_OUT" --require-bundle; then
  echo "ERROR: verify-appstore-bundle FAILED on the signed bundle — NOT compliant / stale." >&2
  exit 1
fi

# (8) spctl — INFO ONLY, never a gate. A MAS pkg legitimately rejects under Gatekeeper (it is
#     NOT notarised — Pitfall 2). We print it for context but trust the pkgutil chain + deep
#     --strict above; we do NOT `|| exit` on it.
echo "[appstore-pkg] spctl (informational only — a MAS pkg legitimately rejects, not notarised):"
spctl -a -vvv --type install "$PKG_OUT" 2>&1 | sed 's/^/    /' || true

echo ""
echo "================ DONE ================"
echo ".pkg: $PKG_OUT"
echo "Next: the HUMAN ship-gate per docs/appstore/SUBMISSION-RUNBOOK.md — for the WALKTHROUGH"
echo "      launch the DEV-signed .app (pnpm tauri:build:appstore), NOT this distribution"
echo "      .pkg's app (AMFI -413); then upload THIS .pkg via Transporter + Submit for Review."
echo "====================================="
