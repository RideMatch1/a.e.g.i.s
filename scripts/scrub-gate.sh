#!/usr/bin/env bash
# Rule #13 scrub-gate — pre-commit message hygiene enforcement.
# See CONTRIBUTING.md §Commit-message hygiene for rationale + install.
#
# Usage: scrub-gate.sh <path-to-commit-message-file>
# Exit:  0 clean · 1 leak detected · 2 config error

set -euo pipefail

MSG_FILE="${1:-}"
if [[ -z "$MSG_FILE" || ! -f "$MSG_FILE" ]]; then
  echo "scrub-gate: usage: $0 <commit-message-file>" >&2
  exit 2
fi

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$REPO_ROOT" ]]; then
  echo "scrub-gate: not inside a git repo" >&2
  exit 2
fi

GENERIC_LIST="$REPO_ROOT/scripts/scrub-terms.generic.txt"
LOCAL_LIST="$REPO_ROOT/scripts/scrub-terms.local.txt"

if [[ ! -f "$GENERIC_LIST" ]]; then
  echo "scrub-gate: missing $GENERIC_LIST — is the hook installed from a clean clone?" >&2
  exit 2
fi

# Build combined regex (generic always, local if present). Skip blank lines + comment-lines.
combine_list() {
  for f in "$GENERIC_LIST" "$LOCAL_LIST"; do
    [[ -f "$f" ]] || continue
    grep -v '^\s*#' "$f" | grep -v '^\s*$' || true
  done | tr '\n' '|' | sed 's/|$//'
}

SCRUB_REGEX=$(combine_list)

# Skip commit-message-file comment-lines (those starting with #)
STRIPPED=$(grep -v '^#' "$MSG_FILE" || true)

# ---- check 1: scrub-term match ----
if [[ -n "$SCRUB_REGEX" ]]; then
  HITS=$(echo "$STRIPPED" | grep -inE "$SCRUB_REGEX" || true)
  if [[ -n "$HITS" ]]; then
    echo "scrub-gate: LEAK — commit message contains scrub-term(s):" >&2
    echo "$HITS" >&2
    echo "" >&2
    echo "Fix: rewrite the commit message, re-check, then commit again." >&2
    echo "See CONTRIBUTING.md §Commit-message hygiene for why this matters." >&2
    exit 1
  fi
fi

# ---- check 2: unexpected trailer (authoritative via git) ----
TRAILERS=$(echo "$STRIPPED" | git interpret-trailers --parse 2>/dev/null || true)
if [[ -n "$TRAILERS" ]]; then
  echo "scrub-gate: WARN — commit message ends in a trailer-block:" >&2
  echo "$TRAILERS" >&2
  echo "" >&2
  echo "If intentional (e.g. Signed-off-by), no action needed — hook does not block on this." >&2
  echo "If accidental (narrative line misparsed), rewrite message." >&2
  # Trailers are warn-only; don't exit here.
fi

# ---- check 3: commit-SHA reference (warn, may be intentional) ----
SHA_HITS=$(echo "$STRIPPED" | grep -oE '\b[a-f0-9]{7,40}\b' || true)
if [[ -n "$SHA_HITS" ]]; then
  echo "scrub-gate: INFO — commit message references SHA-like strings:" >&2
  echo "$SHA_HITS" | sort -u >&2
  echo "" >&2
  echo "Verify these are not reference-repo leaks (see feedback_template_commit_sha_leak.md)." >&2
  # Info only; don't exit.
fi

echo "scrub-gate: clean" >&2
exit 0
