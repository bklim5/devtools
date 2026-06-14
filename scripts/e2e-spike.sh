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
# Env:    TAURI_WEBDRIVER_PORT (default 4445), MAX_WAIT (default 180s),
#         PREFLIGHT_ONLY=1 (run the orphan/port preflight, then exit 0 without
#         launching tauri — dry-run for verifying the preflight itself)
#
# Exit code is the WDIO run's exit code (0 = spike passed). If the WebDriver
# server never comes up within MAX_WAIT, it exits non-zero so the gate fails loud.

set -uo pipefail

PORT="${TAURI_WEBDRIVER_PORT:-4445}"
VITE_PORT=1420 # fixed by tauri.conf.json devUrl — tauri dev always needs this exact port
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

# --- Preflight: kill orphans + free ports BEFORE launching --------------------
# Rationale: the Tauri single-instance plugin means an orphan devtools-app blocks
# a proper relaunch even when ports look free; worse, an orphan holding :4445
# makes the nc -z poll below succeed instantly, so WDIO would run against the
# STALE app and a green run would prove nothing about the current code.
# Orphan dev/e2e app PIDs. `pgrep -f devtools-app` matches only the dev binary
# name (src-tauri/Cargo.toml) — the production app is TinkerDev, so a user's
# installed app can never match. Exclude $$ defensively.
orphan_pids() {
  pgrep -f devtools-app 2>/dev/null | grep -vx "$$" || true
}

preflight() {
  local found=0 pid waited port

  # 1) Kill orphan dev/e2e app processes (TERM first; KILL escalation below).
  for pid in $(orphan_pids); do
    found=1
    echo "[spike] preflight: killing orphan devtools-app (pid $pid)…"
    kill "$pid" 2>/dev/null || true
  done
  # Bounded re-poll: escalate to KILL after ~5s; fail loud if one survives even
  # that — the single-instance plugin means launching over it can never work.
  waited=0
  while [[ -n "$(orphan_pids)" ]]; do
    if (( waited == 5 )); then
      for pid in $(orphan_pids); do
        echo "[spike] preflight: orphan devtools-app (pid $pid) survived TERM — sending KILL…"
        kill -9 "$pid" 2>/dev/null || true
      done
    elif (( waited >= 10 )); then
      echo "[spike] ERROR: orphan devtools-app (pid $(orphan_pids | head -n 1)) survived KILL — refusing to launch."
      exit 1
    fi
    sleep 1
    waited=$((waited + 1))
  done

  # 2) Anything still LISTENING on the harness ports (`lsof -ti` → bare PIDs, one
  #    per line; -sTCP:LISTEN so we never kill a mere client connection).
  for port in "$PORT" "$VITE_PORT"; do
    for pid in $(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true); do
      [[ "$pid" == "$$" ]] && continue
      found=1
      echo "[spike] preflight: killing pid $pid holding :${port}…"
      kill "$pid" 2>/dev/null || true
    done
  done

  # 2.5) Delete the DEV license Keychain item. The preflight runs
  #    `pnpm tauri:dev:e2e` (a DEBUG build), which post-260614 stores its key
  #    under the dev-only service `com.tinkerdev.app.dev.license` (keychain.rs
  #    cfg-split). Targeting that dedicated service makes this preflight
  #    structurally incapable of ever touching a buyer's RELEASE license item
  #    (`com.tinkerdev.app.license`) — the prod literal no longer appears here.
  #    Every `cargo` rebuild changes the dev binary's ad-hoc signature, so a
  #    leftover item makes any Keychain read (e.g. the D-44 problem state's
  #    has_stored_key) raise an interactive macOS authorization prompt the e2e
  #    can never click — license.e2e then times out (walkthrough 2026-06-12).
  #    Re-activating in the app recreates it.
  if security find-generic-password -s com.tinkerdev.app.dev.license >/dev/null 2>&1; then
    echo "[spike] preflight: deleting dev license Keychain item (avoids the rebuild auth prompt)…"
    security delete-generic-password -s com.tinkerdev.app.dev.license >/dev/null 2>&1 || true
  fi

  # 3) Poll bounded (~10s) until both ports are free; escalate to KILL halfway,
  #    and fail loud on an unkillable foreign holder — never launch over it.
  waited=0
  while :; do
    local busy=""
    for port in "$PORT" "$VITE_PORT"; do
      if lsof -ti tcp:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        busy="$port"
        break
      fi
    done
    [[ -z "$busy" ]] && break
    if (( waited >= 10 )); then
      local holder
      holder="$(lsof -ti tcp:"$busy" -sTCP:LISTEN 2>/dev/null | head -n 1)"
      echo "[spike] ERROR: port :${busy} still held by pid ${holder:-unknown} after preflight — refusing to launch."
      exit 1
    fi
    if (( waited == 5 )); then
      for pid in $(lsof -ti tcp:"$busy" -sTCP:LISTEN 2>/dev/null || true); do
        [[ "$pid" == "$$" ]] && continue
        echo "[spike] preflight: pid $pid still holds :${busy} — sending KILL…"
        kill -9 "$pid" 2>/dev/null || true
      done
    fi
    sleep 1
    waited=$((waited + 1))
  done

  if (( found == 0 )); then
    echo "[spike] preflight: no orphans, ports ${PORT}/${VITE_PORT} free."
  else
    echo "[spike] preflight: cleared orphans; ports ${PORT}/${VITE_PORT} free."
  fi
}

preflight

# Dry-run escape hatch (see Env above): verify the preflight without launching.
if [[ "${PREFLIGHT_ONLY:-0}" == "1" ]]; then
  echo "[spike] PREFLIGHT_ONLY=1 — skipping tauri launch."
  exit 0
fi

# The WebDriver server only exists when the `webdriver` Cargo feature is enabled
# (the plugin is an optional dep — see src-tauri/Cargo.toml). `pnpm tauri:dev:e2e`
# is `tauri dev --features webdriver`. A plain `pnpm tauri dev` (and every
# `pnpm tauri build`) excludes the plugin, so :4445 never binds outside this gate.
echo "[spike] starting 'pnpm tauri:dev:e2e' (tauri dev --features webdriver; logs → $DEV_LOG)…"
# `setsid` puts tauri dev in its own process group so the trap can reap the whole
# tree (vite + Rust app). Fall back to a plain background start if setsid is absent.
if command -v setsid >/dev/null 2>&1; then
  setsid pnpm tauri:dev:e2e >"$DEV_LOG" 2>&1 &
else
  pnpm tauri:dev:e2e >"$DEV_LOG" 2>&1 &
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
