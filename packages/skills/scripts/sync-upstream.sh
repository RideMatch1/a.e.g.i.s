#!/usr/bin/env bash
#
# sync-upstream.sh — quarterly maintenance helper for the skills library
#
# Fetches the upstream SnailSploit/Claude-Red repository and diffs each
# SKILL.md against the locally-forked copy under
# packages/skills/skills/offensive/snailsploit-fork/. Reports CHANGED,
# NEW, and REMOVED-upstream (kept-locally) skills. Does NOT auto-commit
# and does NOT auto-modify any file — the human reviewer triages the
# output, runs the pre-fork security-pass against any CHANGED or NEW
# files, then applies the updates via a dedicated PR.
#
# Usage:
#   ./packages/skills/scripts/sync-upstream.sh
#
# Environment:
#   UPSTREAM_URL        Override upstream git-url (defaults to the
#                       canonical SnailSploit/Claude-Red URL).
#   UPSTREAM_CLONE_DIR  Override the temporary clone location
#                       (defaults to a date-stamped path under /tmp).
#
# Exit codes:
#   0  Sync completed (even if differences were found — output is
#      reviewer-input, not a failure signal).
#   1  Upstream clone failed or local fork directory not found.
#
# Invariants honored by this script:
#   - Upstream .DS_Store is always filtered (matches commit-3 protocol).
#   - The aegis-local HTML header preserved locally stays in place on
#     the existing fork. Any update-application that the maintainer
#     performs post-review MUST preserve the header.
#   - This script never writes under packages/skills/ — it only READS
#     the local fork to produce the diff report.

set -euo pipefail

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/SnailSploit/Claude-Red.git}"
UPSTREAM_CLONE_DIR="${UPSTREAM_CLONE_DIR:-/tmp/claude-red-upstream-$(date +%Y%m%d)}"

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOCAL_FORK_DIR="$REPO_ROOT/packages/skills/skills/offensive/snailsploit-fork"

if [ ! -d "$LOCAL_FORK_DIR" ]; then
  echo "ERROR: local fork directory not found at $LOCAL_FORK_DIR" >&2
  exit 1
fi

echo "[sync-upstream] Cloning $UPSTREAM_URL → $UPSTREAM_CLONE_DIR"
rm -rf "$UPSTREAM_CLONE_DIR"
git clone --depth 1 "$UPSTREAM_URL" "$UPSTREAM_CLONE_DIR" > /dev/null

UPSTREAM_SHA="$(git -C "$UPSTREAM_CLONE_DIR" rev-parse HEAD)"
echo "[sync-upstream] Upstream HEAD: $UPSTREAM_SHA"
echo ""

changed_count=0
new_count=0
removed_count=0

echo "== CHANGED skills (upstream differs from local fork) =="
for upstream_skill_dir in "$UPSTREAM_CLONE_DIR"/Skills/offensive-*/; do
  skill_name="$(basename "$upstream_skill_dir" | sed 's/^offensive-//')"
  upstream_file="$upstream_skill_dir/SKILL.md"
  local_file="$LOCAL_FORK_DIR/$skill_name/SKILL.md"

  [ ! -f "$upstream_file" ] && continue

  if [ -f "$local_file" ]; then
    # Strip the leading aegis-local HTML header plus blank line so the
    # diff compares upstream content against the unmodified-upstream
    # portion of the local fork.
    local_content="$(tail -n +3 "$local_file")"
    upstream_content="$(cat "$upstream_file")"
    if [ "$local_content" != "$upstream_content" ]; then
      echo "  - $skill_name"
      changed_count=$((changed_count + 1))
    fi
  else
    echo "  (also NEW upstream — see next section)"
  fi
done
[ "$changed_count" -eq 0 ] && echo "  (none)"
echo ""

echo "== NEW upstream skills (not in local fork) =="
for upstream_skill_dir in "$UPSTREAM_CLONE_DIR"/Skills/offensive-*/; do
  skill_name="$(basename "$upstream_skill_dir" | sed 's/^offensive-//')"
  upstream_file="$upstream_skill_dir/SKILL.md"
  local_file="$LOCAL_FORK_DIR/$skill_name/SKILL.md"

  [ ! -f "$upstream_file" ] && continue
  if [ ! -f "$local_file" ]; then
    echo "  + $skill_name (upstream size: $(wc -l < "$upstream_file") lines)"
    new_count=$((new_count + 1))
  fi
done
[ "$new_count" -eq 0 ] && echo "  (none)"
echo ""

echo "== REMOVED upstream skills (kept locally) =="
for local_skill_dir in "$LOCAL_FORK_DIR"/*/; do
  skill_name="$(basename "$local_skill_dir")"
  upstream_match="$UPSTREAM_CLONE_DIR/Skills/offensive-$skill_name"
  if [ ! -d "$upstream_match" ]; then
    echo "  x $skill_name (absent upstream — decide: keep + mark as AEGIS-preserved, or delete to match upstream)"
    removed_count=$((removed_count + 1))
  fi
done
[ "$removed_count" -eq 0 ] && echo "  (none)"
echo ""

echo "== Summary =="
echo "  Upstream SHA:     $UPSTREAM_SHA"
echo "  Changed skills:   $changed_count"
echo "  New upstream:     $new_count"
echo "  Removed upstream: $removed_count"
echo ""
echo "Next steps for the reviewer:"
echo "  1. Run the pre-fork security-pass protocol (documented in the"
echo "     repository's internal planning tree — see the initial fork"
echo "     commit for the protocol and the additional anti-analysis"
echo "     grep) against any CHANGED or NEW files before accepting"
echo "     updates."
echo "  2. For CHANGED entries, replace the local file's body (lines 3"
echo "     onward) with the upstream content; leave the aegis-local"
echo "     HTML header on line 1 intact; update the fork-SHA in the"
echo "     header if the reviewer decides to bump it."
echo "  3. For NEW upstream skills, copy via the same byte-identical-"
echo "     plus-header protocol used in the initial fork, then add to"
echo "     the expected-skill-name list in"
echo "     packages/skills/__tests__/manifest.test.ts."
echo "  4. For REMOVED-upstream skills, decide whether to keep locally"
echo "     (mark with an AEGIS-preserved comment) or delete to match"
echo "     upstream."
echo "  5. Always land changes via PR, never direct-to-main, so the"
echo "     scrub-gate CI plus this repository's required-status-check"
echo "     ruleset fire before the package-registry state changes."
