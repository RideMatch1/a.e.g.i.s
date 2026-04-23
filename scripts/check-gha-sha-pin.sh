#!/usr/bin/env bash
# AEGIS supply-chain hardening — enforce SHA-pinning on all GitHub Actions.
#
# Closes the threat-class exemplified by the tj-actions/changed-files
# compromise (March 2025): a popular action's `v3` tag was rewritten to
# point at a malicious commit, harvesting secrets from every consumer that
# used `@v3` instead of a full commit-SHA. SHA-pinning is the structural
# defense; this script makes the discipline a CI gate instead of human
# review.
#
# Usage:  bash scripts/check-gha-sha-pin.sh
# Exit:   0 = all clean · 1 = at least one bare-tag violation · 2 = config error

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKFLOWS_DIR="$REPO_ROOT/.github/workflows"

if [[ ! -d "$WORKFLOWS_DIR" ]]; then
  echo "check-gha-sha-pin: $WORKFLOWS_DIR not found" >&2
  exit 2
fi

# Collect all `uses: ...` lines across the workflow files.
# Format expected:  uses: <owner>/<repo>[/<sub>]@<ref>[  # <comment>]
# Skip:
#   - local actions (./<path>) — these live in this repo and are reviewed in PRs
#   - docker:// references — different trust model, out of scope here
#   - reusable workflows from same repo (./.github/workflows/foo.yml) — local

VIOLATIONS=""
TOTAL=0
PINNED=0

while IFS= read -r line; do
  TOTAL=$((TOTAL + 1))

  # Extract the value after `uses:` and trim leading/trailing whitespace.
  value="${line#*uses:}"
  value="$(echo "$value" | sed -E 's/^[[:space:]]+//;s/[[:space:]]+$//')"

  # Strip trailing comment if present (everything from `  #` onward).
  bare="$(echo "$value" | sed -E 's/[[:space:]]+#.*$//')"

  # Local action — skip
  if [[ "$bare" == ./* ]]; then
    PINNED=$((PINNED + 1))
    continue
  fi

  # Docker reference — skip (different format)
  if [[ "$bare" == docker://* ]]; then
    PINNED=$((PINNED + 1))
    continue
  fi

  # Must contain @<ref>
  if [[ "$bare" != *@* ]]; then
    VIOLATIONS="$VIOLATIONS\n  - missing @ref:  $bare"
    continue
  fi

  ref="${bare##*@}"

  # Lowercase 40-char hex SHA-1 = 0-9a-f, exactly 40 chars
  if [[ "$ref" =~ ^[0-9a-f]{40}$ ]]; then
    PINNED=$((PINNED + 1))
  else
    VIOLATIONS="$VIOLATIONS\n  - bare-tag:      $bare"
  fi
done < <(grep -hE '^[[:space:]]*-?[[:space:]]*uses:' "$WORKFLOWS_DIR"/*.yml)

echo "GitHub Actions SHA-pin check"
echo "  workflows scanned: $WORKFLOWS_DIR/*.yml"
echo "  uses-lines total:  $TOTAL"
echo "  SHA-pinned (or skipped local/docker): $PINNED"

if [[ -n "$VIOLATIONS" ]]; then
  echo "" >&2
  echo "::error::SHA-pin policy violations found:" >&2
  printf "%b\n" "$VIOLATIONS" >&2
  echo "" >&2
  echo "Fix: replace each bare-tag (e.g. @v4) with the full 40-char commit SHA." >&2
  echo "     Append a trailing comment with the human version for readability:" >&2
  echo "     uses: actions/checkout@<40-char-sha>  # v4.x.y" >&2
  echo "" >&2
  echo "Why: bare-tags can be rewritten by the action's repo owner (or anyone" >&2
  echo "     with push-access if compromised). SHA-pinning makes the action's" >&2
  echo "     content immutable at the consumer's chosen point-in-time." >&2
  echo "     Reference: tj-actions/changed-files compromise, March 2025." >&2
  exit 1
fi

echo "  result: ALL PINNED — supply-chain SHA-pin policy honored."
exit 0
