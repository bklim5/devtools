#!/usr/bin/env bash
# check-planning-archive.sh — pre-commit guard: a planning phase file may leave
# .planning/phases/ only if the SAME BYTES are simultaneously staged somewhere
# they will still be found — either under .planning/milestones/<version>-phases/
# at the same relative path (an archive), or elsewhere under .planning/phases/
# (a phase renumber / reorganisation).
#
# WHY IT EXISTS
#   Commit 9fcbbd9d ("docs: start milestone v1.9", 2026-06-30) deleted 205 files
#   — the entire v1.6/v1.7/v1.8 decision ledger — from .planning/phases/ without
#   archiving them, so the D-xx / T-xx-yy identifiers the code cites everywhere
#   lived only in git history for five weeks. Restored 2026-08-08.
#   The destructive step is in user-global tooling this repo cannot patch
#   (`gsd-tools phases clear --confirm`, and the complete-milestone workflow's
#   "Skip" branch), so the gate lives here instead.
#
# WHAT IT DOES *NOT* COVER — read this before trusting it
#   This guard is a DELETION guard, and only that. It compares blob hashes, so
#   it catches a delete or a placeholder "archive". It does NOT and CANNOT
#   prevent history loss in general:
#     • rewriting or truncating a phase file IN PLACE (an M or T entry, no
#       deletion) is invisible to it — active phase files are edited constantly,
#       and gating that would block ordinary work;
#     • it says nothing about .planning/milestones/ content once archived;
#     • ALLOW_PHASE_DELETE=1 bypasses it entirely, by design.
#   Its guarantee is exactly: "no file leaves .planning/phases/ without its
#   bytes landing somewhere else in this same commit". Nothing broader.
#
# CONSEQUENCE — it is content-preserving BY DESIGN: editing a phase file in the
# same commit that archives it is REJECTED. Archive first, edit after. That is
# the correct behaviour for a historical record.
#
# ESCAPE HATCH
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

PHASES=".planning/phases/"
MILESTONES=".planning/milestones/"

# collect_dels <outfile>
#   Staged deletions under .planning/phases/, as "<pre-image blob>TAB<dir/relpath>".
#
# --no-renames is LOAD-BEARING: rename detection is on by default, so a `git mv`
# is reported as a single R100 record with no D record at all — without the flag
# the guard would see zero deletions and pass vacuously.
# --abbrev=40 is likewise required: --raw abbreviates blob hashes to 7 chars.
collect_dels() {
  local out="$1" raw="$tmpdir/raw.dels" meta path _m1 _m2 srcsha _dstsha _st
  # Captured to a FILE first: `while … done < <(git …)` throws git's exit status
  # away, so a failing git would look exactly like "no deletions" and the guard
  # would pass vacuously — the same failure mode --no-renames exists to prevent.
  git diff --cached --raw -z --abbrev=40 --no-renames \
      --diff-filter=D -- "$PHASES" >"$raw" \
    || { echo "check-planning-archive: FATAL — git diff (deletions) failed." >&2; exit 2; }
  : >"$out"
  while IFS= read -r -d '' meta && IFS= read -r -d '' path; do
    # meta = ":<srcmode> <dstmode> <srcsha> <dstsha> <status>"
    IFS=' ' read -r _m1 _m2 srcsha _dstsha _st <<<"$meta"
    printf '%s\t%s\n' "$srcsha" "${path#"$PHASES"}" >>"$out"
  done <"$raw"
}

# collect_adds <outfile> <mode>
#   Staged adds/modifies, as "<post-image blob>TAB<key>".
#   mode=archive : under .planning/milestones/<version>-phases/, key = dir/relpath
#                  (the milestone segment stripped, so the key is comparable to a
#                  deletion key).
#   mode=phases  : under .planning/phases/, key = the path (only the BLOB is used
#                  for this side; the key is carried for the report).
#
# --diff-filter=AM, not A: an archive that lands on a path git already tracks is
# a MODIFY, and an A-only collector silently ignored it — the archive looked
# absent and the commit was blocked (or, worse, a rename target that already
# existed went unnoticed).
collect_adds() {
  local out="$1" mode="$2" raw="$tmpdir/raw.$2" meta path key _m1 _m2 _srcsha dstsha _st prefix
  case "$mode" in
    archive) prefix="$MILESTONES" ;;
    phases)  prefix="$PHASES" ;;
    *) echo "check-planning-archive: internal error: bad mode '$mode'" >&2; exit 2 ;;
  esac
  git diff --cached --raw -z --abbrev=40 --no-renames \
      --diff-filter=AM -- "$prefix" >"$raw" \
    || { echo "check-planning-archive: FATAL — git diff ($mode adds) failed." >&2; exit 2; }
  : >"$out"
  while IFS= read -r -d '' meta && IFS= read -r -d '' path; do
    IFS=' ' read -r _m1 _m2 _srcsha dstsha _st <<<"$meta"
    key=${path#"$prefix"}
    if [ "$mode" = archive ]; then
      # strip the "<version>-phases/" segment: v1.6-phases/20-x/f.md -> 20-x/f.md
      case "$key" in
        *-phases/*) key=${key#*-phases/} ;;
        *) continue ;;   # something under milestones/ that is not a phase archive
      esac
    fi
    [ -n "$key" ] || continue
    printf '%s\t%s\n' "$dstsha" "$key" >>"$out"
  done <"$raw"
}

dels="$tmpdir/dels"
collect_dels "$dels"

# Fast path: nothing removed from .planning/phases/ — the overwhelmingly common
# case on every ordinary commit.
if [ ! -s "$dels" ]; then
  exit 0
fi

arch="$tmpdir/arch"
phad="$tmpdir/phad"
collect_adds "$arch" archive
collect_adds "$phad" phases

# All set algebra below is sort/comm/join — O(n log n) — rather than a grep per
# deleted file over the whole add list, which was O(deletions x adds) and would
# have run 205 x 205 greps on the restore commit this guard exists to protect.
export LC_ALL=C

sort -u "$dels" >"$tmpdir/d.pk"
sort -u "$arch" >"$tmpdir/a.pk"

# 1. PASS — archived at the same relative path with the same bytes.
comm -12 "$tmpdir/d.pk" "$tmpdir/a.pk" >"$tmpdir/ok.pk"
comm -23 "$tmpdir/d.pk" "$tmpdir/ok.pk" >"$tmpdir/rem1.pk"

if [ ! -s "$tmpdir/rem1.pk" ]; then
  exit 0
fi

# 2. PASS — the same bytes were re-staged elsewhere under .planning/phases/.
#    This is a phase RENUMBER or reorganisation (`git mv .planning/phases/18-x
#    .planning/phases/31-x`): the path changes, the ledger does not move out of
#    the active tree, and nothing is lost. Matching is blob-only, because the
#    destination path is by definition different.
cut -f1 "$phad" | sort -u >"$tmpdir/phase.blobs"
sort -t"$(printf '\t')" -k1,1 "$tmpdir/rem1.pk" >"$tmpdir/rem1.bysha"
join -t"$(printf '\t')" -v1 -1 1 -2 1 "$tmpdir/rem1.bysha" "$tmpdir/phase.blobs" \
  >"$tmpdir/rem2.pk"

if [ ! -s "$tmpdir/rem2.pk" ]; then
  exit 0
fi

# 3. Everything left is a failure. Split it: an add exists at the right archive
#    path but with different bytes (CONTENT MISMATCH), or there is no add at all
#    (NO ARCHIVE).
awk -F'\t' '{ print $2 "\t" $1 }' "$tmpdir/rem2.pk" \
  | sort -t"$(printf '\t')" -k1,1 >"$tmpdir/rem2.bykey"
awk -F'\t' '{ print $2 "\t" $1 }' "$tmpdir/a.pk" \
  | sort -t"$(printf '\t')" -k1,1 >"$tmpdir/a.bykey"

join -t"$(printf '\t')" -1 1 -2 1 -o 0,1.2,2.2 \
  "$tmpdir/rem2.bykey" "$tmpdir/a.bykey" >"$tmpdir/mismatch"
join -t"$(printf '\t')" -v1 -1 1 -2 1 \
  "$tmpdir/rem2.bykey" "$tmpdir/a.bykey" >"$tmpdir/no_archive"

echo "check-planning-archive: BLOCKED — planning history would be lost." >&2
echo >&2

if [ -s "$tmpdir/no_archive" ]; then
  echo "NO ARCHIVE — removed from .planning/phases/ with nothing staged at" >&2
  echo ".planning/milestones/<version>-phases/<same relative path>, and no" >&2
  echo "same-blob add anywhere else under .planning/phases/:" >&2
  cut -f1 "$tmpdir/no_archive" | sed "s|^|  $PHASES|" >&2
  echo >&2
fi

if [ -s "$tmpdir/mismatch" ]; then
  echo "CONTENT MISMATCH — an archive copy is staged at the right path, but its" >&2
  echo "bytes differ from the file being removed (placeholder, truncated," >&2
  echo "re-flowed or rewritten). An archive that is not the original is not an" >&2
  echo "archive:" >&2
  while IFS=$'\t' read -r key delsha addsha; do
    printf '  %s\n      deleted blob : %s\n      archived blob: %s\n' \
      "$PHASES$key" "$delsha" "$addsha" >&2
  done <"$tmpdir/mismatch"
  echo >&2
fi

cat >&2 <<'REMEDY'
Remedy:
  • Close the milestone the supported way — it `git mv`s the directories, so the
    blob hashes match by construction (the VERSION IS A POSITIONAL: without it
    the flag is parsed AS the version string):
        gsd-tools milestone complete <vX.Y> --archive-phases
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
