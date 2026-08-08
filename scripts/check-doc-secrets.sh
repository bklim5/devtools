#!/usr/bin/env bash
# check-doc-secrets.sh — scan the ADDED lines of the STAGED diff for anything
# that looks like a secret VALUE, and hard-fail if one is found.
#
#   usage:  bash scripts/check-doc-secrets.sh [pathspec ...]
#   default pathspec:  docs/ CHANGELOG.md README.md infra/
#
# Wired into lefthook `pre-commit` (alongside archive-guard), so the "no secret
# value in this repo" rule in docs/KEYS.md is enforced mechanically rather than
# by author care plus reviewer attention. A secret committed to git history is
# permanent; human review is the wrong PRIMARY control for an irreversible
# failure. (docs/KEYS.md § 1a records the one exposure that predates this gate.)
#
# Every rule is a HARD FAIL. No warnings, no severity tiers, and NO path
# allowlist — deliberately. The two exemptions below are SEMANTIC rules that
# apply everywhere, not file exceptions:
#
#   • public-value context (long-b64) — a long base64/hex run within 3 lines of
#     the words sha256 / fingerprint / pubkey / public key is a deliberately
#     published value. A sha256 digest is one-way (publishing it proves a value's
#     identity without disclosing it) and the CE Ed25519 public key + the
#     minisign public key are COMPILED INTO EVERY SHIPPED BINARY — they are
#     public by construction. infra/keygen/RUNBOOK.md's recovery-secret table is
#     built entirely from those two kinds of value; it is the authoritative
#     fingerprint record and must stay scannable, not allowlisted.
#     Residual risk: a private value written within 3 lines of the word "pubkey"
#     slips this rule — which is why pem-header, minisign, apple-p8,
#     github-token, resend-key and env-assignment have NO exemption at all.
#
#   • path shape and payload length (long-b64) — see the rule's own notes below.
#
# WHEN A RULE MISFIRES
#   1. Rewrite the PROSE (almost always right — abstract the value, or point at
#      where it lives instead of quoting it).
#   2. If the pattern is genuinely too broad, NARROW it and record why here.
# Never add a file exception, and never delete a rule to make a finding go away.
#
# NARROWING NOTES
#   • long-hex was REMOVED as subsumed: [0-9a-f] is a strict subset of the
#     base64 alphabet, so every long-hex hit is already a long-b64 hit. Two rules
#     firing on one string produced duplicate findings and implied a coverage
#     that did not exist.
#   • long-b64 exempts PATH-SHAPED runs. `/` is in the base64 alphabet, so a
#     plain file path or URL path of 41+ chars matches the raw pattern
#     (`tauri/target/release/bundle/macos/TinkerDev` in
#     docs/harness-and-decisions.md, `com/help/account/certificates/certificates`
#     in docs/appstore/ASC-SETUP.md). A run is treated as a path only when it
#     contains NO `+` and NO `=` and splits on `/` into 3+ segments that each
#     start with a letter and are at most 16 chars. Base64 payloads essentially
#     never take that shape: 44 random base64 chars carry 0.7 `/` on average, so
#     needing 2+ of them AND no `+`/`=` AND every segment short and
#     letter-initial is a sub-1% event — and every secret SHAPE we actually
#     handle (PEM, minisign, .p8, provider tokens) has its own dedicated rule
#     above that does not consult this exemption.
#   • long-b64 also exempts runs with fewer than 32 characters left after
#     stripping `+/=` — an ASCII rule of '=' signs (infra/keygen/setup.sh) is a
#     41-char match with zero payload, not a key.
#   • healthcheck requires a >=8-char token after `hc-ping.com/`, so the
#     placeholder in infra/keygen/backup.env.example (`hc-ping.com/<uuid-of-…>`)
#     and the bare host in a curl example do not fire, while a real ping URL
#     (36-char UUID) still does.
#   • github-token requires a >=16-char tail after the provider prefix, matching
#     every real GitHub token format and nothing in prose.
#   • env-assignment matches an ENV-VAR SHAPE — see the rule's own note below.
#   • apple-p8 is anchored to a >=20-char base64 tail (`MIG[A-Za-z0-9+/]{20,}`)
#     rather than a bare `MIG` prefix: these docs legitimately use the words
#     "migration" / "migrating" a lot (update-host migration, transitional
#     release), and a bare prefix would fire on every one of them.
#   • resend-key requires a non-word char before `re_` and a >=16-char tail.
#     A bare `re_[A-Za-z0-9]{8,}` fired on `restore_purchases` (the StoreKit
#     bridge docs use it dozens of times) — "sto" + "re_purchases".
#   • env-assignment fires per MATCH, not per line, so a line carrying BOTH a
#     placeholder and a real assignment still fails. It tolerates spaces around
#     `=`, and only fires on a NONTRIVIAL right-hand side (>=8 chars that is not
#     a placeholder), so `.env.example`-style NAME-only or NAME= listings stay
#     legal — which is exactly how the docs must list keys.
#   • The R2 bucket name and "the R2 endpoint" appear in already-reviewed
#     RUNBOOK prose and may be named; a full account-id-bearing endpoint URL and
#     any hc-ping.com URL (the ping URL IS the credential) may not.
#
# FAIL-CLOSED CONTRACT
#   Any error from git or grep, any unreadable input, and any unscannable binary
#   addition is a FATAL exit (2), never a silent pass. The scanner would rather
#   block a legitimate commit than wave a secret through.

set -euo pipefail

fatal() {
  echo "check-doc-secrets: FATAL — $1" >&2
  echo "check-doc-secrets: refusing to report CLEAN on an incomplete scan." >&2
  exit 2
}

# Run from the repo root so relative pathspecs mean the same thing however the
# hook is invoked. Pathspecs are interpreted relative to the repository root.
toplevel=$(git rev-parse --show-toplevel 2>/dev/null) || fatal "not inside a git work tree."
cd "$toplevel" || fatal "cannot cd to repo root '$toplevel'."

if [ "$#" -eq 0 ]; then
  set -- docs/ CHANGELOG.md README.md infra/
fi

tmpdir=$(mktemp -d) || fatal "mktemp failed."
trap 'rm -rf "$tmpdir"' EXIT
raw="$tmpdir/raw"
content="$tmpdir/content"   # one added line of diff content per row
index="$tmpdir/index"       # same row count: "<path>:<lineno>"
findings="$tmpdir/findings"
: >"$content"
: >"$index"
: >"$findings"

# ---------------------------------------------------------------------------
# 0. Unscannable additions: a binary blob cannot be pattern-scanned, so it is
#    refused unless it really is an image. `docs/appstore/screenshots/*.png` and
#    `docs/seeds/**/*.png` are legitimate; a .p12, .p8, .keystore or .zip under
#    a scanned path must never pass. The test is MAGIC BYTES + a matching
#    extension, not the extension alone — renaming key.p12 to shot.png does not
#    get past it.
# ---------------------------------------------------------------------------
numstat="$tmpdir/numstat"
git -c core.quotePath=false diff --cached --numstat --diff-filter=AM -- "$@" >"$numstat" \
  || fatal "\`git diff --cached --numstat\` failed (status $?)."

binfindings="$tmpdir/binfindings"
: >"$binfindings"
while IFS=$'\t' read -r added deleted bpath; do
  [ "$added" = "-" ] && [ "$deleted" = "-" ] || continue
  [ -n "$bpath" ] || continue
  # Materialise the blob before sniffing it: piping `git show` straight into a
  # -N12 reader makes the reader exit first, SIGPIPEs git, and (under pipefail)
  # turns every binary into a FATAL.
  git show ":$bpath" >"$tmpdir/blob" 2>/dev/null \
    || fatal "cannot read staged blob for '$bpath'."
  magic=$(od -An -v -tx1 -N12 <"$tmpdir/blob" | tr -d ' \n') \
    || fatal "cannot sniff staged blob for '$bpath'."
  ok=no
  case "$bpath" in
    *.png|*.PNG)
      [ "${magic:0:16}" = "89504e470d0a1a0a" ] && ok=yes ;;
    *.jpg|*.JPG|*.jpeg|*.JPEG)
      [ "${magic:0:6}" = "ffd8ff" ] && ok=yes ;;
    *.gif|*.GIF)
      case "${magic:0:12}" in 474946383961|474946383761) ok=yes ;; esac ;;
    *.webp|*.WEBP)
      [ "${magic:0:8}" = "52494646" ] && [ "${magic:16:8}" = "57454250" ] && ok=yes ;;
  esac
  [ "$ok" = yes ] || printf '  %s\n' "$bpath" >>"$binfindings"
done <"$numstat"

if [ -s "$binfindings" ]; then
  echo "check-doc-secrets: BLOCKED — unscannable BINARY file(s) staged under: $*" >&2
  echo >&2
  cat "$binfindings" >&2
  cat >&2 <<'BINREMEDY'

A binary cannot be pattern-scanned, so this gate refuses it. Only real images
(PNG / JPEG / GIF / WebP, checked by magic bytes AND extension) are allowed
under a scanned path. Key material — .p12, .p8, .pem, .keystore, .provisionprofile,
archives — must never be committed here at all: put it in the password manager
and reference it from docs/KEYS.md by name.
BINREMEDY
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Split the staged unified diff into parallel content/location files.
#
# --output-indicator-new/old/context re-label the per-line markers so DIFF
# CONTENT can never be mistaken for DIFF STRUCTURE. With the default '+' marker,
# an added line whose text begins with "++ " is emitted as "+++ ..." — identical
# to a file header — so the parser would silently re-point `path` and SKIP every
# following added line. That is a scan hole, not a cosmetic bug (verified on
# 2026-08-08: a secret placed after a line reading "++ /dev/null" passed). With
# the markers below, an added line is ALWAYS ">"-prefixed and a real header
# always starts with "+++ ", so the two are disjoint.
# -U0 means there are no context lines.
#
# The diff is captured to a FILE first, not consumed through a process
# substitution: `while ... done < <(git diff ...)` discards git's exit status
# entirely, so a failing git would present as "no additions — nothing to scan".
# ---------------------------------------------------------------------------
git diff --cached -U0 \
    --output-indicator-new='>' \
    --output-indicator-old='<' \
    --output-indicator-context='=' -- "$@" >"$raw" \
  || fatal "\`git diff --cached\` failed (status $?)."

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
    ">"*)
      [ -n "$path" ] || continue
      printf '%s\n' "${line#>}" >>"$content"
      printf '%s:%s\n' "$path" "$lineno" >>"$index"
      lineno=$((lineno + 1))
      ;;
    *) ;;
  esac
done <"$raw"

if [ ! -s "$content" ]; then
  echo "check-doc-secrets: no staged additions under: $* — nothing to scan."
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Rules.
# ---------------------------------------------------------------------------

# grep_to <outfile> <ERE> — collect "<row>:<match>" hits. grep status 1 means
# "no match" (fine); anything above 1 is a grep ERROR and must be fatal, not a
# clean scan. -e is mandatory: several patterns start with '-'.
grep_to() {
  local out="$1" re="$2" rc=0
  grep -noE -e "$re" "$content" >"$out" || rc=$?
  [ "$rc" -le 1 ] || fatal "grep failed (status $rc) on rule pattern: $re"
}

record() { # <rule> <row> <match>
  local loc
  loc=$(sed -n "${2}p" "$index")
  printf '  [%-15s] %s  ::  %s\n' "$1" "$loc" "$3" >>"$findings"
}

hits="$tmpdir/hits"

scan() { # <rule> <ERE>   — no exemptions
  local rule="$1" row match
  grep_to "$hits" "$2"
  while IFS= read -r hit; do
    [ -n "$hit" ] || continue
    row=${hit%%:*}
    match=${hit#*:}
    record "$rule" "$row" "$match"
  done <"$hits"
}

scan pem-header     '-----BEGIN'
scan apple-p8       'MIG[A-Za-z0-9+/]{20,}'
scan github-token   '(gh[pousr]_|github_pat_)[A-Za-z0-9]{16,}'
scan resend-key     '(^|[^A-Za-z0-9_])re_[A-Za-z0-9]{16,}'
scan minisign       '(untrusted comment:|RWS[A-Za-z0-9+/]{20,})'
scan healthcheck    'hc-ping\.com/[0-9A-Za-z][0-9A-Za-z-]{7,}'
scan r2-endpoint    '[0-9a-f]{20,}\.r2\.cloudflarestorage\.com'

# --- long-b64: the catch-all. Three semantic exemptions (see header). ---------
PUBLIC_CONTEXT_RE='sha-?256|fingerprint|pub[-_ ]?key|public[-_ ]?key|public half'
# Optional leading/trailing '/' so "/Library/Developer/Xcode/UserData/Provisioning"
# and "signingIdentity/entitlements/hardenedRuntime/" are both recognised.
PATH_SHAPE_RE='^/?([A-Za-z][A-Za-z0-9]{0,15}/){2,}([A-Za-z][A-Za-z0-9]{0,15})?/?$'

# context_says_public <row> — true when THIS added line, or an added line within
# 3 source lines of it in the SAME file, labels the value as public (a sha256
# digest or a public key). The window is not just the line because the two real
# cases in this repo straddle lines: infra/keygen/RUNBOOK.md puts the CE Ed25519
# public key on its own line under "ed25519 public key ==", and puts the two
# .env sha256 digests in table ROWS under a "| file | sha256 | keys |" header.
context_says_public() {
  local row="$1" self selfpath selfline r loc p l d
  self=$(sed -n "${row}p" "$index")
  selfpath=${self%:*}
  selfline=${self##*:}
  for r in $((row - 3)) $((row - 2)) $((row - 1)) "$row" $((row + 1)) $((row + 2)) $((row + 3)); do
    [ "$r" -ge 1 ] || continue
    loc=$(sed -n "${r}p" "$index")
    [ -n "$loc" ] || continue
    p=${loc%:*}
    l=${loc##*:}
    [ "$p" = "$selfpath" ] || continue
    d=$((l - selfline))
    if [ "$d" -lt 0 ]; then d=$((-d)); fi
    [ "$d" -le 3 ] || continue
    if sed -n "${r}p" "$content" | grep -qiE -e "$PUBLIC_CONTEXT_RE"; then
      return 0
    fi
  done
  return 1
}

grep_to "$hits" '[A-Za-z0-9+/=]{41,}'
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  row=${hit%%:*}
  match=${hit#*:}
  # exemption 1 — not enough payload to be a key. Strip the base64 punctuation
  # and require 32+ remaining characters, so an ASCII rule of '=' signs or a
  # slash-heavy fragment is not treated as a 41-char secret.
  payload=$(printf '%s' "$match" | tr -d '+/=')
  if [ "${#payload}" -lt 32 ]; then
    continue
  fi
  # exemption 2 — the surrounding text declares the value public
  if context_says_public "$row"; then
    continue
  fi
  # exemption 3 — the run is a file/URL path, not a payload
  case "$match" in
    *+* | *=*) ;;   # base64 padding/plus: never a path
    *)
      if printf '%s' "$match" | grep -qE -e "$PATH_SHAPE_RE"; then
        continue
      fi
      ;;
  esac
  record long-b64 "$row" "$match"
done <"$hits"

# --- env-assignment: an ENV-VAR-SHAPED name whose UNDERSCORE-DELIMITED ---------
# components include KEY / SECRET / TOKEN / PASSWORD / PASSPHRASE / CREDENTIAL,
# followed by a nontrivial value.
#
# The trigger must be a whole component, and the name must not be preceded by an
# alphanumeric. A bare "contains the substring KEY" fired on every KEYGEN_* name
# in infra/ (KEYGEN_HOST, KEYGEN_BASE_URL, KEYGEN_DOMAIN — hostnames, not
# secrets) and on `EXPECT_ED25519_PUBKEY=` (a PUBLIC key). Both are now excluded
# by shape, not by a path exception. The cost: `MYSECRETKEY=…` (no separators)
# is missed by THIS rule — long-b64 remains the backstop for any high-entropy
# value, whatever it is called.
#
# Suppression is per MATCH, not per line, so
#   APPLE_API_KEY=<your-key-id> and RESEND_API_KEY=re_liveXXXXXXXXXXXX
# still fails on the second assignment.
#
# The quoted/angled value alternatives exist so a match SPANS a multi-word
# placeholder ("<redacted — see password manager>"); without them the match
# would stop at the first space and the placeholder test would never see the
# closing '>'.
ASSIGN_RE="(^|[^A-Za-z0-9])([A-Z0-9]+_)*(KEYS?|SECRETS?|TOKENS?|PASSWORD|PASSPHRASE|CREDENTIALS?)(_[A-Z0-9]+)*[[:space:]]*=[[:space:]]*(<[^>]*>|[\"'][^\"']{8,}[\"']|[^[:space:]]{8,})"
# A placeholder, or a SHELL EXPANSION — `\$(openssl rand -hex 16)` and
# `\${2:-}` are code that produces a value at run time, not a value.
PLACEHOLDER_RE="=[[:space:]]*[\"']?(<[^>]*>|\\.\\.\\.|[xX]{3,}|[yY][oO][uU][rR][_-]|CHANGEME|changeme|CHANGE_ME|REDACTED|redacted|EXAMPLE|example|PLACEHOLDER|placeholder|\\\$\\(|\\\$\\{?[A-Za-z0-9_])"
# A *_FILE / *_PATH / *_DIR variable assigned a filesystem path holds a
# LOCATION, not a value — `BACKUP_GPG_PASSPHRASE_FILE=/some/other/path/gpg.pass`
# in infra/keygen/backup.env.example is the documented shape. Both halves are
# required: the name must carry the location suffix AND the value must look like
# a path, so `FOO_PATH=hunter2hunter2` still fails.
LOCATION_RE="_(FILE|PATH|DIR)[[:space:]]*=[[:space:]]*[\"']?[~./\$]"

grep_to "$hits" "$ASSIGN_RE"
while IFS= read -r hit; do
  [ -n "$hit" ] || continue
  row=${hit%%:*}
  match=${hit#*:}
  if printf '%s' "$match" | grep -qE -e "$PLACEHOLDER_RE"; then
    continue
  fi
  if printf '%s' "$match" | grep -qE -e "$LOCATION_RE"; then
    continue
  fi
  record env-assignment "$row" "$match"
done <"$hits"

# ---------------------------------------------------------------------------
# 3. Verdict.
# ---------------------------------------------------------------------------
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
