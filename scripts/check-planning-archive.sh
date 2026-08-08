#!/usr/bin/env bash
# check-planning-archive.sh — pre-commit guard: a planning phase file may be
# REMOVED from .planning/phases/ only if the SAME BYTES are simultaneously ADDED
# under .planning/milestones/<version>-phases/<same relative path>.
#
# WHY THIS EXISTS
# ---------------
# Commit 9fcbbd9d ("docs: start milestone v1.9", 2026-06-30) deleted 15 phase
# directories — 205 files, the entire decision ledger for milestones v1.6, v1.7
# and v1.8 — from .planning/phases/ without archiving them. The D-xx / T-xx-yy
# identifiers that the code, the plans and the summaries cite everywhere then
# lived ONLY in git history for five weeks: a future agent grepping the working
# tree for "D-52" or "T-20-01" found nothing. They were restored on 2026-08-08
# (quick/260808-kfs) into .planning/milestones/v1.{6,7,8}-phases/.
#
# The destructive step lives in USER-GLOBAL tooling that this repo cannot patch
# (`gsd-tools phases clear --confirm`, and the `complete-milestone` workflow's
# "Skip" branch at the "Archive Phases?" prompt). The correct path already
# exists — `gsd-tools milestone complete --archive-phases` and `/gsd-cleanup`
# both `git mv` the directories — so this guard simply makes the wrong path fail
# loudly at commit time.
#
# WHAT IT CHECKS (per FILE, per BLOB HASH — not per directory, not by count)
# -------------------------------------------------------------------------
# A directory-level or file-count check would happily accept an "archive" made
# of placeholder, truncated or re-flowed files. That is the same knowledge loss
# as the bare delete, only harder to notice. So the guard demands that the blob
# hash of every removed file appears, unchanged, at the matching archive path.
#
# CONSEQUENCE — it is content-preserving BY DESIGN: editing a phase file in the
# same commit that archives it is REJECTED. Archive first, edit after. That is
# the correct behaviour for a historical record.
#
# ESCAPE HATCH
# ------------
#   ALLOW_PHASE_DELETE=1 git commit ...
# for a deliberate removal (e.g. dropping a 999.* backlog directory that was
# never a real phase).
#
# Cost: one `git diff --cached` plumbing call on every commit; it exits 0
# immediately when nothing under .planning/phases/ is being removed.

set -euo pipefail

if [ -n "${ALLOW_PHASE_DELETE:-}" ]; then
  echo "check-planning-archive: ALLOW_PHASE_DELETE set — skipping archive guard."
  exit 0
fi

# Not a git work tree (or no HEAD yet) — nothing to guard.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
dels="$tmpdir/dels"
adds="$tmpdir/adds"
: >"$dels"
: >"$adds"

# Read NUL-delimited `--raw` records into "<blob-sha><TAB><key>" lines.
#
# --no-renames is LOAD-BEARING: rename detection is on by default, so a `git mv`
# into .planning/milestones/ is reported as a single R100 record with no D
# record at all — without the flag the guard would see zero deletions and pass
# vacuously, never checking the destination.
# --abbrev=40 is likewise required: --raw abbreviates blob hashes to 7 chars by
# default, which is far too weak to stand in for "the same bytes".
collect() { # $1 = D|A (which blob half to read), $2 = required path prefix, $3 = sed prefix strip
  local meta path shaidx filter prefix strip sha key
  filter="$1"
  prefix="$2"
  strip="$3"
  case "$filter" in
    D) shaidx=3 ;; # source blob (the pre-image being removed)
    A) shaidx=4 ;; # destination blob (the post-image being added)
    *) echo "check-planning-archive: internal error: bad filter '$filter'" >&2; exit 2 ;;
  esac
  # NOTE: `set -- $meta` below clobbers this function's positional parameters,
  # which is why $1..$3 are copied into locals first.
  while IFS= read -r -d '' meta && IFS= read -r -d '' path; do
    # meta = ":<srcmode> <dstmode> <srcsha> <dstsha> <status>"
    # shellcheck disable=SC2086
    set -- $meta
    eval "sha=\${$shaidx}"
    [ "${path#"$prefix"}" != "$path" ] || continue
    key=$(printf '%s' "$path" | sed -E "$strip")
    [ -n "$key" ] || continue
    printf '%s\t%s\n' "$sha" "$key"
  done
}

git diff --cached --raw -z --abbrev=40 --no-renames --diff-filter=D -- .planning/phases/ \
  | collect D ".planning/phases/" 's|^\.planning/phases/||' >"$dels"

# Fast path: nothing removed from .planning/phases/ — the overwhelmingly common
# case on every ordinary commit.
if [ ! -s "$dels" ]; then
  exit 0
fi

git diff --cached --raw -z --abbrev=40 --no-renames --diff-filter=A -- .planning/milestones/ \
  | collect A ".planning/milestones/" 's|^\.planning/milestones/[^/]+-phases/||' >"$adds"

no_archive="$tmpdir/no_archive"
mismatch="$tmpdir/mismatch"
: >"$no_archive"
: >"$mismatch"

while IFS=$'\t' read -r sha key; do
  [ -n "$key" ] || continue
  # PASS: an add at the same archive-relative path carrying the same blob hash.
  if grep -qxF "$sha	$key" "$adds"; then
    continue
  fi
  # An add exists at the right path but with different bytes.
  archived=$(grep -F "	$key" "$adds" | cut -f1 | tr '\n' ' ' | sed 's/ $//' || true)
  if [ -n "$archived" ]; then
    printf '  %s\n      deleted blob : %s\n      archived blob: %s\n' \
      ".planning/phases/$key" "$sha" "$archived" >>"$mismatch"
  else
    printf '  %s\n' ".planning/phases/$key" >>"$no_archive"
  fi
done <"$dels"

if [ ! -s "$no_archive" ] && [ ! -s "$mismatch" ]; then
  exit 0
fi

echo "check-planning-archive: BLOCKED — planning history would be lost." >&2
echo >&2

if [ -s "$no_archive" ]; then
  echo "NO ARCHIVE — removed from .planning/phases/ with nothing staged at" >&2
  echo ".planning/milestones/<version>-phases/<same relative path>:" >&2
  cat "$no_archive" >&2
  echo >&2
fi

if [ -s "$mismatch" ]; then
  echo "CONTENT MISMATCH — an archive copy is staged at the right path, but its" >&2
  echo "bytes differ from the file being removed (placeholder, truncated," >&2
  echo "re-flowed or rewritten). An archive that is not the original is not an" >&2
  echo "archive:" >&2
  cat "$mismatch" >&2
  echo >&2
fi

cat >&2 <<'REMEDY'
Remedy:
  • Close the milestone the supported way — it `git mv`s the directories, so the
    blob hashes match by construction:
        gsd-tools milestone complete --archive-phases
    or, retroactively:
        /gsd-cleanup
  • Archiving by hand? `git mv .planning/phases/<dir> \
        .planning/milestones/vX.Y-phases/<dir>` — never copy-then-edit, and never
    edit a phase file in the same commit that archives it (archive first, edit
    after).
  • Deliberately dropping a directory that was never a real phase (e.g. a 999.*
    backlog stub)? Bypass explicitly:
        ALLOW_PHASE_DELETE=1 git commit ...
REMEDY

exit 1
