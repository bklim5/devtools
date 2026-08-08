#!/usr/bin/env bash
# check-doc-secrets.sh — scan the ADDED lines of the STAGED diff for anything
# that looks like a secret VALUE, and hard-fail if one is found.
#
#   usage:  bash scripts/check-doc-secrets.sh [pathspec ...]     (default: docs/ CHANGELOG.md)
#
# WHY THIS EXISTS
# ---------------
# quick/260808-kfs writes reference docs ABOUT the project's trust anchors
# (docs/KEYS.md, docs/RELEASE-MACHINE.md, docs/CHANNELS.md, docs/RELEASE.md).
# Those docs must contain inventory, locations, fingerprint POINTERS, expiry
# dates, consequences and procedures — and ZERO secret values. "The author will
# be careful" and "the reviewer will notice" are the wrong PRIMARY control for an
# irreversible failure: a secret committed to git history is permanent, and this
# repo's history is permanent even though the repo is private today.
#
# So the constraint is mechanical. Every rule below is a HARD FAIL. There are no
# warnings, no severity tiers, and NO path allowlist — deliberately.
#
# WHEN A RULE MISFIRES
# --------------------
# Fix it in this order:
#   1. Rewrite the PROSE (almost always the right answer — abstract the value, or
#      point at where it lives instead of quoting it).
#   2. If the pattern is genuinely too broad, NARROW the pattern and record why
#      in the "narrowing notes" below.
# Never add a file exception, and never delete a rule to make a finding go away.
#
# NARROWING NOTES
#   • apple-p8 is anchored to a >=20-char base64 tail (`MIG[A-Za-z0-9+/]{20,}`)
#     rather than a bare `MIG` prefix: these docs legitimately use the words
#     "migration" / "migrating" a lot (update-host migration, transitional
#     release), and a bare prefix would fire on every one of them.
#   • long-hex requires 41+ chars, so an abbreviated commit sha (9fcbbd9d) and a
#     full 40-char sha are both fine, while a pasted sha256 fingerprint table is
#     not: infra/keygen/RUNBOOK.md is the authoritative fingerprint record and
#     KEYS.md must CROSS-LINK it, never duplicate it. This rule enforces that.
#   • env-assignment only fires on a NONTRIVIAL right-hand side (>=8 non-space
#     chars that is not a placeholder), so `.env.example`-style NAME-only or
#     NAME= listings stay legal — which is exactly how the docs must list keys.
#   • The R2 bucket name and "the R2 endpoint" appear in already-reviewed
#     RUNBOOK prose and may be named; a full account-id-bearing endpoint URL and
#     any hc-ping.com URL (the ping URL IS the credential) may not.

set -euo pipefail

if [ "$#" -eq 0 ]; then
  set -- docs/ CHANGELOG.md
fi

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
content="$tmpdir/content"   # one added line of diff content per row
index="$tmpdir/index"       # same row count: "<path>:<lineno>"
: >"$content"
: >"$index"

# Split the staged unified diff into parallel content/location files. -U0 means
# there are no context lines, so every '+' row (bar the '+++' header) is an
# added line.
path=""
lineno=0
while IFS= read -r line; do
  case "$line" in
    "+++ /dev/null") path="" ;;
    "+++ "*)
      path=${line#+++ }
      path=${path#b/}
      ;;
    "@@"*)
      # @@ -<old>[,<n>] +<new>[,<n>] @@ ...
      hunk=${line#*+}
      hunk=${hunk%% *}
      lineno=${hunk%%,*}
      ;;
    "+"*)
      [ -n "$path" ] || continue
      printf '%s\n' "${line#+}" >>"$content"
      printf '%s:%s\n' "$path" "$lineno" >>"$index"
      lineno=$((lineno + 1))
      ;;
    *) ;;
  esac
done < <(git diff --cached -U0 -- "$@")

if [ ! -s "$content" ]; then
  echo "check-doc-secrets: no staged additions under: $* — nothing to scan."
  exit 0
fi

findings="$tmpdir/findings"
: >"$findings"

# report <rule>  — reads `grep -n` output on stdin, one finding per output line
report() {
  local rule="$1" n loc text
  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    n=${hit%%:*}
    text=${hit#*:}
    loc=$(sed -n "${n}p" "$index")
    printf '  [%-15s] %s  ::  %s\n' "$rule" "$loc" "$text" >>"$findings"
  done
}

scan() { # $1 = rule name, $2 = ERE
  # -e is mandatory: several patterns start with '-' (e.g. the PEM header) and
  # would otherwise be parsed as grep options.
  report "$1" < <(grep -nE -e "$2" "$content" || true)
}

scan pem-header     '-----BEGIN'
scan long-b64       '[A-Za-z0-9+/=]{41,}'
scan long-hex       '[0-9a-f]{41,}'
scan apple-p8       'MIG[A-Za-z0-9+/]{20,}'
scan github-token   '(gh[pousr]_|github_pat_)'
scan resend-key     're_[A-Za-z0-9]{8,}'
scan minisign       '(untrusted comment:|RWS[A-Za-z0-9+/]{20,})'
scan healthcheck    'hc-ping\.com/'
scan r2-endpoint    '[0-9a-f]{20,}\.r2\.cloudflarestorage\.com'

# env-assignment: NAME containing KEY/SECRET/TOKEN/PASSWORD/PASSPHRASE/CREDENTIAL
# followed by a nontrivial value. Two stages so placeholders stay legal.
ASSIGN_RE='[A-Za-z0-9_]*(KEY|SECRET|TOKEN|PASSWORD|PASSPHRASE|CREDENTIAL)[A-Za-z0-9_]*=[^[:space:]]{8,}'
PLACEHOLDER_RE='=[[:space:]]*("|'"'"')?(<[^>]*>|\.\.\.|[xX]{3,}|[yY][oO][uU][rR][_-]|CHANGEME|changeme|REDACTED|redacted|\$\{?[A-Za-z_])'
report env-assignment < <(grep -nE -e "$ASSIGN_RE" "$content" | grep -vE -e "$PLACEHOLDER_RE" || true)

if [ -s "$findings" ]; then
  echo "check-doc-secrets: BLOCKED — the staged diff looks like it contains secret VALUES." >&2
  echo >&2
  sort -u "$findings" >&2
  echo >&2
  cat >&2 <<'REMEDY'
Every rule above is a hard fail. Fix it by rewriting the PROSE — name the anchor,
say where its value lives (password manager / gitignored .env / Keychain), and
link the authoritative record; never quote the value. If a pattern is genuinely
too broad, NARROW the pattern and record why in this script's header. Do NOT add
a path exception and do NOT delete a rule.
REMEDY
  exit 1
fi

echo "check-doc-secrets: clean ($(wc -l <"$content" | tr -d ' ') added lines scanned under: $*)."
exit 0
