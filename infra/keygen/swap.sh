#!/usr/bin/env bash
# Provision 2 GB swap + vm.swappiness=10 on the CX23 box (D-48, Pitfall 6).
#
# Ruby + the CE migration/setup container can spike memory; 2 GB swap prevents
# OOM-killing Postgres on the 4 GB box. RUN THIS FIRST — before any CE bring-up
# (`docker compose run --rm setup`), per the hard ordering in RUNBOOK.md.
#
# Fully idempotent: re-running on a rebuilt box is a no-op where already done.
# Run as root (or via sudo) on the VPS.
set -euo pipefail

SWAPFILE="/swapfile"
SWAP_SIZE="2G"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "FATAL: run as root (e.g. sudo $0)" >&2
  exit 1
fi

# 1) Create + enable the swapfile (guard if it already exists / is active).
if swapon --show=NAME --noheadings 2>/dev/null | grep -qx "$SWAPFILE"; then
  echo "swap already active: $SWAPFILE"
elif [[ -e "$SWAPFILE" ]]; then
  echo "swapfile exists but inactive — enabling: $SWAPFILE"
  chmod 600 "$SWAPFILE"
  swapon "$SWAPFILE"
else
  echo "creating ${SWAP_SIZE} swapfile: $SWAPFILE"
  if ! fallocate -l "$SWAP_SIZE" "$SWAPFILE" 2>/dev/null; then
    # Fallback for filesystems where fallocate is unsupported.
    dd if=/dev/zero of="$SWAPFILE" bs=1M count=2048 status=progress
  fi
  chmod 600 "$SWAPFILE"
  mkswap "$SWAPFILE"
  swapon "$SWAPFILE"
fi

# 2) Persist in /etc/fstab (idempotent — grep before append).
if ! grep -qE "^\s*${SWAPFILE}\s" /etc/fstab; then
  echo "${SWAPFILE} none swap sw 0 0" >> /etc/fstab
  echo "added $SWAPFILE to /etc/fstab"
else
  echo "$SWAPFILE already in /etc/fstab"
fi

# 3) vm.swappiness=10 — live + persisted in /etc/sysctl.d/.
sysctl -w vm.swappiness=10
SYSCTL_FILE="/etc/sysctl.d/99-devtools-swappiness.conf"
if ! grep -qE "^\s*vm\.swappiness\s*=\s*10\s*$" "$SYSCTL_FILE" 2>/dev/null; then
  echo "vm.swappiness=10" > "$SYSCTL_FILE"
  echo "persisted vm.swappiness=10 -> $SYSCTL_FILE"
else
  echo "vm.swappiness already persisted"
fi

echo "--- swap status ---"
swapon --show
echo "vm.swappiness = $(cat /proc/sys/vm/swappiness)"
echo "swap.sh: done."
