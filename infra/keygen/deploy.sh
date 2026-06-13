#!/usr/bin/env bash
# Script-over-SSH deploy of the production CE + webhook stack (D-72; the origin
# remote is release-tags-only, NOT CI, so deploy is a script — D-57 discretion).
#
# Rsyncs infra/keygen/ + server/webhook/ to the box, (re)builds the webhook
# image, and brings the stack up. Secrets (.env files) are NEVER rsynced —
# they live ONLY on the box (gitignored, D-41/D-55); rsync excludes them.
#
# Usage:
#   DEPLOY_HOST=root@<vps-ip> ./deploy.sh            # full up -d
#   DEPLOY_HOST=root@<vps-ip> ./deploy.sh webhook    # rebuild + restart webhook only
#
# Prereqs on the box (RUNBOOK steps): Docker + Compose installed, swap.sh run,
# both .env files filled, `docker compose run --rm setup` already done once.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

: "${DEPLOY_HOST:?Set DEPLOY_HOST=user@host (e.g. root@1.2.3.4)}"
REMOTE_DIR="${REMOTE_DIR:-/opt/devtools}"
MODE="${1:-up}"

echo "==> deploying to $DEPLOY_HOST:$REMOTE_DIR (mode: $MODE)"

# 1) Ensure the remote layout exists, mirroring the repo's relative paths so
#    compose.yaml's `build.context: ../../server/webhook` resolves on the box.
ssh "$DEPLOY_HOST" "mkdir -p '$REMOTE_DIR/infra/keygen' '$REMOTE_DIR/server/webhook'"

# 2) Rsync infra/keygen/ (EXCLUDING .env + certs — secrets stay on the box).
rsync -az --delete \
  --exclude '.env' --exclude '*.crt' \
  "$SCRIPT_DIR/" "$DEPLOY_HOST:$REMOTE_DIR/infra/keygen/"

# 3) Rsync server/webhook/ source (EXCLUDING node_modules + .env + build junk).
rsync -az --delete \
  --exclude 'node_modules' --exclude '.env' --exclude 'dist' --exclude '*.tsbuildinfo' \
  "$REPO_ROOT/server/webhook/" "$DEPLOY_HOST:$REMOTE_DIR/server/webhook/"

# 4) Build + (re)start over SSH from the infra/keygen dir.
COMPOSE="docker compose -f '$REMOTE_DIR/infra/keygen/compose.yaml'"
case "$MODE" in
  webhook)
    ssh "$DEPLOY_HOST" "$COMPOSE build webhook && $COMPOSE up -d webhook"
    ;;
  up)
    # Bring up the long-running services; setup is one-shot and NOT listed here
    # (Pitfall 8) — run it manually once per RUNBOOK before the first `up`.
    ssh "$DEPLOY_HOST" "$COMPOSE build webhook && $COMPOSE up -d postgres redis web worker webhook caddy"
    ;;
  *)
    echo "usage: DEPLOY_HOST=user@host $0 [up|webhook]" >&2
    exit 2
    ;;
esac

echo "==> deploy ($MODE) complete. Verify: curl https://license.tinkerdev.io/health"
