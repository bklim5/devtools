#!/usr/bin/env bash
# build.sh — one entry point for every signed build, loading signing/notary
# secrets from .env (gitignored) so builds run without manually exporting env in
# a separate terminal each session. The secrets are sourced into THIS shell only
# (never printed/echoed); callers never need to read .env's contents.
#
# Every invocation (single-target OR --all) exports an ABSOLUTE per-channel
# CARGO_TARGET_DIR ($ROOT/src-tauri/target/<channel>) so each channel's artifacts
# land in their OWN tree and can coexist — the dev-signed appstore .app, the
# distribution-signed appstore-pkg .app/.pkg, and the direct .dmg/.app no longer
# overwrite each other at the shared universal-apple-darwin bundle path. The
# sub-scripts derive their bundle root from ${CARGO_TARGET_DIR:-src-tauri/target},
# so a STANDALONE sub-script call (no CARGO_TARGET_DIR) is unchanged from today.
#
# Usage: scripts/build.sh <target>
#   direct              — direct-channel signed+notarised DMG via release:build-only
#                         (no publish: no latest.json / gh release / tag). Needs
#                         the Apple signing + notary vars in .env.
#   appstore            — dev-signed appstore .app (for the sandbox walkthrough).
#                         Uses keychain dev cert; needs no .env secrets.
#   appstore-pkg        — Apple-Distribution appstore .pkg for Transporter.
#                         Uses keychain Distribution + Installer certs +
#                         src-tauri/embedded.provisionprofile; needs no .env secrets.
#   --all               — build direct, appstore, appstore-pkg back-to-back, each
#                         in its own per-channel target tree (fail-fast, prints a
#                         final per-channel artifact-path summary).
#   --parallel          — SEQUENTIAL alias of --all (builds run back-to-back, NOT
#                         concurrently — named for intent, honest about behavior).
#
# .env keys (see .env.example): TAURI_SIGNING_PRIVATE_KEY[_PATH],
# TAURI_SIGNING_PRIVATE_KEY_PASSWORD, APPLE_API_KEY_PATH, APPLE_API_KEY,
# APPLE_API_ISSUER, APPLE_SIGNING_IDENTITY.
#
# NOTE: publishing (release:publish — cuts a tag + gh release) is deliberately
# NOT exposed here; run it explicitly when you mean to ship the direct channel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
  echo "[build] loaded .env"
else
  echo "[build] no .env (fine for appstore/appstore-pkg; direct needs it)"
fi

# Resolved artifact paths per channel (absolute), printed in the --all summary.
artifact_paths() {
  local ch="$1"
  case "$ch" in
    direct)        echo "$ROOT/src-tauri/target/direct/universal-apple-darwin/release/bundle/dmg/*.dmg (+ .../macos/TinkerDev.app)" ;;
    appstore)      echo "$ROOT/src-tauri/target/appstore/universal-apple-darwin/release/bundle/macos/TinkerDev.app" ;;
    appstore-pkg)  echo "$ROOT/src-tauri/target/appstore-pkg/universal-apple-darwin/release/bundle/macos/TinkerDev.pkg" ;;
  esac
}

# Set the per-channel ABSOLUTE CARGO_TARGET_DIR (Tauri runs cargo with CWD=src-tauri/,
# so a relative dir would resolve wrong — it MUST be absolute) then run the channel.
run_channel() {
  local ch="$1"
  export CARGO_TARGET_DIR="$ROOT/src-tauri/target/$ch"
  echo "[build] $ch → CARGO_TARGET_DIR=$CARGO_TARGET_DIR"
  case "$ch" in
    direct)        pnpm release:build-only ;;
    appstore)      pnpm tauri:build:appstore ;;
    appstore-pkg)  pnpm tauri:build:appstore:pkg ;;
    *) echo "[build] unknown channel: $ch" >&2; return 2 ;;
  esac
}

# Print the per-channel artifact summary for --all. $1 = the channel that FAILED
# (empty = all succeeded); channels before it are ✓ built, it is ✗ failed, after – skipped.
print_all_summary() {
  local failed="$1"; shift
  local seen_fail=0 ch mark
  echo "[build] ── artifact summary ─────────────────────────────"
  for ch in "$@"; do
    if [ -n "$failed" ] && [ "$ch" = "$failed" ]; then
      mark="✗ failed"; seen_fail=1
    elif [ "$seen_fail" -eq 1 ]; then
      mark="– skipped"
    else
      mark="✓ built"
    fi
    printf '[build]   %-13s %s  %s\n' "$ch" "$mark" "$(artifact_paths "$ch")"
  done
  echo "[build] ─────────────────────────────────────────────────"
}

build_all() {
  local channels=(direct appstore appstore-pkg) ch
  for ch in "${channels[@]}"; do
    # Guard run in an `if` so a failure doesn't trip `set -e` before the summary.
    if run_channel "$ch"; then
      :
    else
      echo "[build] channel '$ch' FAILED — stopping (fail-fast)." >&2
      print_all_summary "$ch" "${channels[@]}"
      exit 1
    fi
  done
  print_all_summary "" "${channels[@]}"
}

TARGET="${1:?usage: build.sh <direct|appstore|appstore-pkg|--all|--parallel>}"
case "$TARGET" in
  --all)
    build_all ;;
  --parallel)
    echo "[build] --parallel: SEQUENTIAL alias — builds run back-to-back, not concurrently."
    build_all ;;
  direct|appstore|appstore-pkg)
    run_channel "$TARGET" ;;
  *) echo "[build] unknown target: $TARGET (want: direct | appstore | appstore-pkg | --all | --parallel)" >&2; exit 2 ;;
esac
