#!/usr/bin/env bash
# Reproducible macOS real-webview UI-gate runner (D-01 / D-02 / HRN-02).
#
# This is the per-task UI-gate DRIVER for later phases — NOT a one-off two-terminal
# manual recipe. It:
#   1. starts `pnpm tauri dev` in the background, capturing its PID
#   2. polls until the embedded WebDriver server accepts connections on
#      127.0.0.1:${TAURI_WEBDRIVER_PORT:-4445} (bounded by MAX_WAIT seconds)
#   3. runs `pnpm e2e` (WebdriverIO) against that port — the spike spec finds the
#      skeleton input, sends keys, asserts the instant transform, and screenshots
#      the real WKWebView
#   4. ALWAYS tears down: a `trap` kills the whole `tauri dev` process group on
#      EXIT so no orphan dev-server / Rust child / :4445 listener leaks
#
# Usage:  bash scripts/e2e-spike.sh
# Env:    TAURI_WEBDRIVER_PORT (default 4445), MAX_WAIT (default 180s)
#
# Exit code is the WDIO run's exit code (0 = spike passed). If the WebDriver
# server never comes up within MAX_WAIT, it exits non-zero so the gate fails loud.

set -uo pipefail

PORT="${TAURI_WEBDRIVER_PORT:-4445}"
HOST="127.0.0.1" # localhost only — never 0.0.0.0 (threat T-01-11)
MAX_WAIT="${MAX_WAIT:-180}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/test/e2e/__logs__"
mkdir -p "$LOG_DIR"
DEV_LOG="$LOG_DIR/tauri-dev.log"

TAURI_DEV_PID=""

cleanup() {
  local code=$?
  if [[ -n "$TAURI_DEV_PID" ]]; then
    echo "[spike] tearing down tauri dev (pgid $TAURI_DEV_PID)…"
    # Kill the whole process group (tauri dev spawns vite + the Rust app child).
    kill -- "-$TAURI_DEV_PID" 2>/dev/null || kill "$TAURI_DEV_PID" 2>/dev/null || true
    wait "$TAURI_DEV_PID" 2>/dev/null || true
  fi
  exit "$code"
}
trap cleanup EXIT INT TERM

echo "[spike] starting 'pnpm tauri dev' (logs → $DEV_LOG)…"
# `setsid` puts tauri dev in its own process group so the trap can reap the whole
# tree (vite + Rust app). Fall back to a plain background start if setsid is absent.
if command -v setsid >/dev/null 2>&1; then
  setsid pnpm tauri dev >"$DEV_LOG" 2>&1 &
else
  pnpm tauri dev >"$DEV_LOG" 2>&1 &
fi
TAURI_DEV_PID=$!

echo "[spike] waiting up to ${MAX_WAIT}s for the WebDriver server on ${HOST}:${PORT}…"
waited=0
until nc -z "$HOST" "$PORT" >/dev/null 2>&1; do
  if ! kill -0 "$TAURI_DEV_PID" 2>/dev/null; then
    echo "[spike] ERROR: tauri dev exited before binding ${HOST}:${PORT}. Last log lines:"
    tail -n 40 "$DEV_LOG" || true
    exit 1
  fi
  if (( waited >= MAX_WAIT )); then
    echo "[spike] ERROR: timed out after ${MAX_WAIT}s waiting for ${HOST}:${PORT}. Last log lines:"
    tail -n 40 "$DEV_LOG" || true
    exit 1
  fi
  sleep 1
  waited=$((waited + 1))
done

echo "[spike] WebDriver server is up on ${HOST}:${PORT} (after ${waited}s). Running WDIO…"
TAURI_WEBDRIVER_PORT="$PORT" pnpm e2e
WDIO_EXIT=$?

echo "[spike] WDIO finished with exit code ${WDIO_EXIT}."
exit "$WDIO_EXIT"
