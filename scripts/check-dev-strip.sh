#!/usr/bin/env bash
# D-32: the DEV-only palette command must be tree-shaken from production bundles.
# Run AFTER `pnpm build`. Reused at the Phase 21 flip gate.
set -uo pipefail

# Guard the artifact's existence — a missing dist/assets must FAIL, not
# vacuously pass (grep's "nothing to search" would otherwise read as "absent").
if [[ ! -d dist/assets ]]; then
  echo "FAIL: dist/assets/ not found — run 'pnpm build' first (from the repo root)" >&2
  exit 1
fi

grep -R --include='*.js' -l "Toggle free tier" dist/assets/
status=$?
if [[ $status -eq 0 ]]; then
  echo "FAIL: dev-only palette command present in production bundle" >&2
  exit 1
elif [[ $status -ge 2 ]]; then
  echo "FAIL: grep errored (exit $status) — bundle was not actually checked" >&2
  exit 1
fi
echo "OK: dev toggle absent from dist/assets"

# Phase 21 (T-21-15): the DEV-only "full" entitlements override is written ONLY
# inside the same import.meta.env.DEV palette branch (above) AND honored only
# behind isTestOrDev()/import.meta.env.DEV (prefsStore.ts coercer + resolve.ts
# branch). The dev write-site is the distinctive `entitlementsOverride:"full"`
# object-literal assignment; a release bundle that failed to tree-shake the DEV
# branch would carry it. Grep the MINIFIED-tolerant shapes (whitespace varies):
# the absence of the literal "full" override write proves the Pro-grant path is
# gone from prod, so no stored value can ever UNLOCK (the prod downgrade-only
# invariant). The "free" downgrade write legitimately ships (it can only LOCK).
if grep -REq --include='*.js' 'entitlementsOverride: *"full"' dist/assets/; then
  echo "FAIL: DEV-only 'entitlementsOverride: \"full\"' write present in production bundle (T-21-15)" >&2
  exit 1
fi
gstatus=$?
if [[ $gstatus -ge 2 ]]; then
  echo "FAIL: grep errored (exit $gstatus) — the 'full' override check did not run" >&2
  exit 1
fi
echo "OK: DEV-only 'full' entitlements override absent from dist/assets"

# 21-04 hardening: the DEV-only deterministic tier-set seam (main.tsx) registers
# `window.__devSetTier` ONLY under `import.meta.env.DEV` (statically false in prod →
# the whole block tree-shaken). It calls setDevTier(), which writes the same DEV-only
# `entitlementsOverride:"full"` path already checked above. A release bundle that
# failed to tree-shake the DEV block would carry the distinctive `__devSetTier` name.
# Its absence proves the deterministic Pro-reach seam is gone from prod (the e2e
# harness can never alter a shipped app's tier).
grep -R --include='*.js' -l "__devSetTier" dist/assets/
dstatus=$?
if [[ $dstatus -eq 0 ]]; then
  echo "FAIL: DEV-only '__devSetTier' seam present in production bundle (21-04)" >&2
  exit 1
elif [[ $dstatus -ge 2 ]]; then
  echo "FAIL: grep errored (exit $dstatus) — the '__devSetTier' check did not run" >&2
  exit 1
fi
echo "OK: DEV-only '__devSetTier' seam absent from dist/assets"

# --- D-52: release binary embeds ONLY the prod licensing constants -----------
# The licensing host/account/pubkey are cfg(debug_assertions)-split in
# src-tauri/src/license/config.rs — a RELEASE binary must embed the production
# CE host (license.tinkerdev.io) and NOT the localhost Keygen host. Unlike the
# dist/assets dev-toggle check above (the Rust binary, not dist/, is the
# artifact here), this runs against the packaged RELEASE binary at the
# phase-boundary `tauri build` (Plan 03) — pass the binary/bundle path:
#
#   bash scripts/check-dev-strip.sh && \
#     check_prod_constants src-tauri/target/release/devtools-app
#
# (sourcing: `source scripts/check-dev-strip.sh` then call the function, or run
# the inline block below by exporting CHECK_PROD_BINARY=<path>). The prod-host
# PRESENT grep is the load-bearing assertion; the localhost-ABSENT grep is the
# corroborating check and only meaningful against a release (non-debug) binary.
check_prod_constants() {
  local binary="${1:?usage: check_prod_constants <release-binary-path>}"
  if [[ ! -f "$binary" ]]; then
    echo "FAIL: release binary not found at '$binary' — run 'pnpm tauri build' first" >&2
    return 1
  fi
  # PRESENT: the production CE host must be embedded (load-bearing, D-52).
  if ! grep -qa "license.tinkerdev.io" "$binary"; then
    echo "FAIL: prod Keygen host 'license.tinkerdev.io' ABSENT from release binary" >&2
    return 1
  fi
  # ABSENT (load-bearing, finding 9 / T-20-14): the pre-fill sentinels must NOT
  # be embedded. A release built before 20-03 filled config.rs would still carry
  # these literal placeholder strings — fixed-string (`grep -F`) match so a stray
  # regex metachar in a future sentinel can't silently neuter the check. Either
  # sentinel present ⇒ a placeholder binary is masquerading as prod ⇒ FAIL.
  for sentinel in "PROD_ACCOUNT_ID_PLACEHOLDER" "PROD_PUBKEY_PLACEHOLDER"; do
    if grep -qaF "$sentinel" "$binary"; then
      echo "FAIL: placeholder sentinel '$sentinel' embedded in release binary — config.rs prod constants not filled (run Plan 03 setup.sh)" >&2
      return 1
    fi
  done
  # ABSENT: the localhost Keygen host string must NOT be embedded in a release
  # binary (the dev arm is cfg'd out). Corroborating check.
  if grep -qa "localhost" "$binary"; then
    echo "WARN: 'localhost' string present in release binary — verify it is NOT the Keygen host constant" >&2
  fi
  echo "OK: release binary embeds prod constant license.tinkerdev.io"
}

# Opt-in: run the prod-constant check inline when CHECK_PROD_BINARY is set, so
# the Plan 03 phase-boundary build can invoke this single script end-to-end.
if [[ -n "${CHECK_PROD_BINARY:-}" ]]; then
  check_prod_constants "$CHECK_PROD_BINARY" || exit 1
fi
