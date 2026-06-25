#!/usr/bin/env bash
# build.sh — one entry point for every signed build, loading signing/notary
# secrets from .env (gitignored) so builds run without manually exporting env in
# a separate terminal each session. The secrets are sourced into THIS shell only
# (never printed/echoed); callers never need to read .env's contents.
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

TARGET="${1:?usage: build.sh <direct|appstore|appstore-pkg>}"
case "$TARGET" in
  direct)        exec pnpm release:build-only ;;
  appstore)      exec pnpm tauri:build:appstore ;;
  appstore-pkg)  exec pnpm tauri:build:appstore:pkg ;;
  *) echo "[build] unknown target: $TARGET (want: direct | appstore | appstore-pkg)" >&2; exit 2 ;;
esac
