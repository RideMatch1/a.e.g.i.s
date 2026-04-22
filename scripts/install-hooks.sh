#!/usr/bin/env bash
# Idempotent installer for AEGIS git-hooks.
# Run from any dir inside the repo: ./scripts/install-hooks.sh

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$REPO_ROOT" ]]; then
  echo "install-hooks: not inside a git repo" >&2
  exit 1
fi

SOURCE_HOOK="$REPO_ROOT/scripts/hooks/commit-msg"
TARGET_HOOK="$REPO_ROOT/.git/hooks/commit-msg"

if [[ ! -f "$SOURCE_HOOK" ]]; then
  echo "install-hooks: source $SOURCE_HOOK missing — corrupted clone?" >&2
  exit 1
fi

# If a different hook is already installed, warn and do not overwrite.
if [[ -f "$TARGET_HOOK" ]]; then
  if cmp -s "$SOURCE_HOOK" "$TARGET_HOOK"; then
    echo "install-hooks: AEGIS commit-msg hook already installed — no-op"
    exit 0
  fi
  echo "install-hooks: WARN — a different commit-msg hook is already installed at $TARGET_HOOK" >&2
  echo "install-hooks: inspect the existing hook, then remove or chain it manually to install ours." >&2
  exit 1
fi

cp "$SOURCE_HOOK" "$TARGET_HOOK"
chmod +x "$TARGET_HOOK"
echo "install-hooks: AEGIS commit-msg hook installed at $TARGET_HOOK"
echo ""
echo "To customize project-specific scrub-terms, create: $REPO_ROOT/scripts/scrub-terms.local.txt"
echo "  (gitignored — one term per line, # for comments, supports regex patterns)"
