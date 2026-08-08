#!/usr/bin/env bash
# check-doc-secrets.sh — scan the ADDED lines of the STAGED diff for anything
# that looks like a secret VALUE, and hard-fail if one is found.
#
#   usage:  bash scripts/check-doc-secrets.sh [pathspec ...]
#   default pathspec:  docs/ CHANGELOG.md README.md infra/ scripts/
#
# Wired into lefthook `pre-commit` (alongside archive-guard), because a secret
# committed to git history is permanent and human review is the wrong PRIMARY
# control for an irreversible failure. (docs/KEYS.md § 1a records the one
# exposure that predates this gate.)
#
# WHAT THIS GATE ACTUALLY COVERS — say it exactly, so nobody trusts more of it
# than exists. It scans the ADDED lines of the STAGED diff, under the pathspec
# above, on the machine running the commit. Therefore it does NOT cover:
#   • commit messages and tag messages (never diff content — a secret pasted
#     into `git commit -m` reaches history unscanned);
#   • any path outside the pathspec (src/, src-tauri/, server/, test/, .env
#     files, .planning/ …);
#   • a commit made with `git commit --no-verify`, or on a clone where
#     `pnpm lefthook install` was never run — it is a CLIENT-SIDE hook, and
#     there is no server-side enforcement;
#   • anything already in history (see docs/KEYS.md § 1a).
# The RULE ("no secret value anywhere in this repo") is broader than this
# scanner by design; the scanner is partial mechanical support for it, and
# review remains the backstop. docs/KEYS.md § 1 states the same surface in the
# same words — keep the two in sync.
#
# Every rule is a HARD FAIL. No warnings, no severity tiers, and NO path
# allowlist — deliberately. The exemptions below are SEMANTIC/STRUCTURAL rules
# that apply everywhere, not file exceptions:
#
#   • published-value (long-b64) — see `is_published` below. A value is exempt
#     only on STRUCTURAL evidence, never on proximity: either it IS a sha256
#     digest by shape (exactly 64 hex chars — one-way, so publishing it proves a
#     value's identity without disclosing it) and is labelled `sha256` /
#     `fingerprint` on its own line or by the header of the markdown table it
#     sits in, or it is labelled a PUBLIC key on its own line (or on the line
#     immediately above, for a value wrapped onto a line of its own). The CE
#     Ed25519 public key and the minisign public key are COMPILED INTO EVERY
#     SHIPPED BINARY — public by construction. infra/keygen/RUNBOOK.md's
#     recovery-secret table is built entirely from those two kinds of value; it
#     is the authoritative fingerprint record and must stay scannable, not
#     allowlisted.
#     This REPLACED a ±3-line proximity window (2026-08-08), which was far too
#     broad: any long run within a 7-line neighbourhood of the word "pubkey"
#     went unreported, including a real 44-char key in ordinary prose.
#     Residual risk: a private value written ON a line that says "public key",
#     or directly under one, still slips — which is why pem-header, minisign,
#     apple-p8, github-token, resend-key and env-assignment have NO exemption
#     of this kind at all.
#
#   • path shape and payload length (long-b64) — see the rule's own notes below.
#
#   • code-expression right-hand side (env-assignment) — see its notes below.
#
# WHEN A RULE MISFIRES
#   1. Rewrite the PROSE (almost always right — abstract the value, or point at
#      where it lives instead of quoting it).
#   2. If the pattern is genuinely too broad, NARROW it and record why here.
# Never add a file exception, and never delete a rule to make a finding go away.
#
# NARROWING NOTES
#   • pem-header fires on a PRIVATE-key PEM delimiter (`-----BEGIN … PRIVATE
#     KEY`), or on any `-----BEGIN X-----` immediately followed by 20+ base64
#     chars ON THE SAME LINE (a one-line paste). A bare `-----BEGIN` fired on
#     legitimate PEM-HANDLING CODE — scripts/keygen-ce/spike.sh greps its
#     licence fixture for the literal `-----BEGIN MACHINE FILE-----` marker —
#     and on every mention of a CERTIFICATE or PUBLIC KEY block, both of which
#     are public artifacts. What the narrowing gives up: a multi-line paste of a
#     non-private PEM block whose header line carries no base64. Its BODY is
#     41+ base64 characters, so long-b64 still catches it on the next line;
#     that is the intended defence in depth, not an assumption.
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
#   • env-assignment exempts a right-hand side that is CODE PRODUCING a value at
#     run time rather than a value: a shell expansion (`$(openssl rand -hex 16)`,
#     `${2:-}`) or a call/property expression
#     (`process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(…)` in
#     scripts/build-and-publish.mjs). The call form must start the value — an
#     identifier, optionally dotted, immediately followed by `(` — so a
#     `*_TOKEN` assigned a LITERAL still fails.
#   • The R2 bucket name and "the R2 endpoint" appear in already-reviewed
#     RUNBOOK prose and may be named; a full account-id-bearing endpoint URL and
#     any hc-ping.com URL (the ping URL IS the credential) may not.
#
# SELF-SCAN NOTE
#   scripts/ is inside the default pathspec, so this file is scanned by its own
#   rules. Two patterns are therefore written so their SOURCE TEXT does not
#   match them: `-{5}BEGIN` (equivalent to five literal dashes in an ERE) and
#   `untrusted[ ]comment:`. That is a spelling change with no effect on what is
#   accepted — not an exemption. Do not "simplify" them back to literals.
#
# FAIL-CLOSED CONTRACT
#   Any error from git or grep and any unreadable input is a FATAL exit (2);
#   an unscannable binary addition is a BLOCK (exit 1). Neither is ever a silent
#   pass. The scanner would rather block a legitimate commit than wave a secret
#   through.

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
  set -- docs/ CHANGELOG.md README.md infra/ scripts/
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
#
#    --no-renames closes a MOVE bypass: a tracked binary `git mv`-ed INTO a
#    scanned path is a rename, and rename detection reports it as an R entry
#    (numstat path `{scripts => docs}/key.p12`) that --diff-filter=AM dropped
#    entirely. Suppressing detection re-presents it as a plain A with `- -`
#    counts, which this loop polices. R and C are kept in the filter as belt and
#    braces: they cannot appear while --no-renames holds, and if a future change
#    or a `diff.renames` config ever lets one through, it is policed rather than
#    skipped.
# ---------------------------------------------------------------------------
numstat="$tmpdir/numstat"
git -c core.quotePath=false diff --cached --numstat --no-renames --diff-filter=AMRC -- "$@" >"$numstat" \
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
# --no-renames is LOAD-BEARING, not tidiness. With rename detection on, a
# tracked file that already contains a secret and is `git mv`-ed INTO a scanned
# path is reported as `R100 scripts/notes.md -> docs/notes.md` with ZERO content
# lines, so the scanner reads "no staged additions — nothing to scan" and the
# secret lands in a scanned path having never been scanned. Suppressing rename
# detection re-presents the move as an ADD of the destination whose FULL content
# is added lines. (Verified 2026-08-08: a file carrying PASSWORD=<a real value>
# under scripts/, moved into docs/, passed with detection on and fails with it
# off.) The same flag is why the numstat prepass above can trust its paths — a
# rename entry's path field is `{old => new}/name`, which no `git show :path`
# can resolve.
#
# The diff is captured to a FILE first, not consumed through a process
# substitution: `while ... done < <(git diff ...)` discards git's exit status
# entirely, so a failing git would present as "no additions — nothing to scan".
# ---------------------------------------------------------------------------
git diff --cached -U0 --no-renames \
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

scan pem-header     '-{5}BEGIN[A-Z ]*PRIVATE KEY|-{5}BEGIN[A-Z ]+-{5}[[:space:]]*[A-Za-z0-9+/]{20,}'
scan apple-p8       'MIG[A-Za-z0-9+/]{20,}'
scan github-token   '(gh[pousr]_|github_pat_)[A-Za-z0-9]{16,}'
scan resend-key     '(^|[^A-Za-z0-9_])re_[A-Za-z0-9]{16,}'
scan minisign       '(untrusted[ ]comment:|RWS[A-Za-z0-9+/]{20,})'
scan healthcheck    'hc-ping\.com/[0-9A-Za-z][0-9A-Za-z-]{7,}'
scan r2-endpoint    '[0-9a-f]{20,}\.r2\.cloudflarestorage\.com'

# --- long-b64: the catch-all. Three semantic exemptions (see header). ---------
SHA256_LABEL_RE='sha-?256|fingerprint'
PUBKEY_LABEL_RE='pub[-_ ]?key|public[-_ ]?key|public half'
TABLE_ROW_RE='^[[:space:]]*\|'
DIGEST_RE='^[0-9a-f]{64}$'
# Optional leading/trailing '/' so "/Library/Developer/Xcode/UserData/Provisioning"
# and "signingIdentity/entitlements/hardenedRuntime/" are both recognised.
PATH_SHAPE_RE='^/?([A-Za-z][A-Za-z0-9]{0,15}/){2,}([A-Za-z][A-Za-z0-9]{0,15})?/?$'

# row_text / row_loc — the content and the "<path>:<lineno>" of an added row.
row_text() { sed -n "${1}p" "$content"; }
row_loc()  { sed -n "${1}p" "$index"; }

# is_published <row> <match> — STRUCTURAL evidence that this long run is a
# deliberately published value. Proximity is NOT evidence: the ±3-line window
# this replaced exempted anything within seven lines of the word "pubkey".
#
#   (a) the match IS a sha256 digest by shape — exactly 64 LOWERCASE hex
#       characters, as `sha256sum` emits, and one-way — AND is labelled
#       `sha256`/`fingerprint` either on its own
#       line, or by the HEADER of the markdown table it sits in (the two .env
#       digests in infra/keygen/RUNBOOK.md are table rows under a
#       "| file | sha256 | keys |" header, one of them below the |---| rule).
#       The header walk climbs only CONTIGUOUS table-row lines of the SAME file
#       and stops at the first line that is not one, so it cannot reach into
#       unrelated prose.
#
#   (b) the line labels the value a PUBLIC key — or the line IMMEDIATELY above
#       does, which is the wrapped-value case (RUNBOOK puts the CE Ed25519
#       public key on a line of its own under "ed25519 public key ==").
is_published() {
  local row="$1" match="$2" self loc path lineno r rloc rtext prevloc

  self=$(row_text "$row")
  loc=$(row_loc "$row")
  path=${loc%:*}
  lineno=${loc##*:}

  # (a) sha256 digest, labelled on its line or by its table header
  if printf '%s' "$match" | grep -qE -e "$DIGEST_RE"; then
    if printf '%s' "$self" | grep -qiE -e "$SHA256_LABEL_RE"; then
      return 0
    fi
    if printf '%s' "$self" | grep -qE -e "$TABLE_ROW_RE"; then
      r=$row
      while [ "$r" -gt 1 ]; do
        r=$((r - 1))
        rloc=$(row_loc "$r")
        [ -n "$rloc" ] || break
        # same file AND the immediately preceding SOURCE line (contiguous adds)
        [ "${rloc%:*}" = "$path" ] || break
        [ "${rloc##*:}" = "$((lineno - (row - r)))" ] || break
        rtext=$(row_text "$r")
        printf '%s' "$rtext" | grep -qE -e "$TABLE_ROW_RE" || break
        if printf '%s' "$rtext" | grep -qiE -e "$SHA256_LABEL_RE"; then
          return 0
        fi
      done
    fi
  fi

  # (b) labelled a public key, on this line …
  if printf '%s' "$self" | grep -qiE -e "$PUBKEY_LABEL_RE"; then
    return 0
  fi
  # … or on the line immediately above (a value wrapped onto its own line)
  if [ "$row" -gt 1 ]; then
    prevloc=$(row_loc $((row - 1)))
    if [ "${prevloc%:*}" = "$path" ] && [ "${prevloc##*:}" = "$((lineno - 1))" ] \
       && row_text $((row - 1)) | grep -qiE -e "$PUBKEY_LABEL_RE"; then
      return 0
    fi
  fi

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
  # exemption 2 — the value is structurally declared public
  if is_published "$row" "$match"; then
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
# Suppression is per MATCH, not per line: a line carrying BOTH a placeholder
# assignment and a real one still fails, on the real one. (The probe suite holds
# the executable version of that sentence; this comment deliberately does NOT
# quote a token-shaped literal, because scripts/ is now scanned and the rule is
# right to object to one.)
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
# A CALL or PROPERTY expression is code that produces a value at run time, the
# same class as the shell expansions above:
#   process.env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(path, "utf8")
# The expression must START the value (an identifier, optionally dotted, then
# '('), so a `*_TOKEN` assigned a LITERAL is untouched — the probe suite pins
# that case rather than quoting one here.
CODE_RHS_RE="=[[:space:]]*[A-Za-z_\$][A-Za-z0-9_\$]*(\\.[A-Za-z0-9_\$]+)*\\("

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
  if printf '%s' "$match" | grep -qE -e "$CODE_RHS_RE"; then
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
