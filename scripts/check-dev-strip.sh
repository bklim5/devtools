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
