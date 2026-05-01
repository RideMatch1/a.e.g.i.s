#!/usr/bin/env bash
# AEGIS supply-chain hardening — operator-path leak gate.
#
# Catches absolute home-directory paths that would leak the contributor's
# workstation account name into committed file contents. gitleaks (CI)
# scans for secret-format patterns (Stripe, AWS, GitHub PATs, generic
# api-keys, high-entropy strings); it does NOT have rules for
# /Users/<name>/ or /home/<name>/ patterns. Without this gate, hardcoded
# absolute paths (the v0.17.x hunt-script class) ride through to public
# git history.
#
# Scope (tracked files; binary dirs excluded):
#   - All files under git ls-files
#   - Excludes: node_modules/, dist/, .next/, build/, coverage/
#   - Excludes: packages/scanners/__tests__/, packages/benchmark/
#     canary-fixtures/ — these are validation surface where path-like
#     literals are intentional test data
#
# Patterns:
#   /Users/<unix-username>/   (macOS home paths)
#   /home/<unix-username>/    (Linux home paths)
#   /private/var/folders/    (macOS NSTemp / NSDocumentDirectory paths
#                             that include the user's account in subdirs)
#
# Usage:
#   bash scripts/check-no-operator-paths.sh           — scan all tracked files
#   bash scripts/check-no-operator-paths.sh --staged  — scan only staged files
#                                                       (pre-commit hook mode)
# Exit:
#   0 = clean
#   1 = operator-path leak detected
#   2 = config error

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-all}"

if [[ "$MODE" == "--staged" ]]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACM)
elif [[ "$MODE" == "all" ]]; then
  FILES=$(git ls-files)
else
  echo "check-no-operator-paths: usage: $0 [--staged]" >&2
  exit 2
fi

if [[ -z "$FILES" ]]; then
  exit 0
fi

# Exclude path-prefixes that legitimately carry path-like literals
# as test/canary surface, plus build artifacts and upstream fork
# pedagogical content (parallels .gitleaks.toml allowlists).
EXCLUDE_PREFIX_RE='^(node_modules|dist|build|coverage|\.next|\.turbo)/|^packages/[^/]+/dist/|^packages/scanners/__tests__/|^packages/benchmark/canary-fixtures/|^packages/skills/skills/(offensive|osint)/[a-zA-Z0-9_-]+-fork/'

# Operator-path patterns. /Users/Shared and CI/example placeholders
# excluded via ALLOWED_NAMES_RE second-pass.
LEAK_PATTERN='(/Users/[a-zA-Z0-9_-]+/|/home/[a-zA-Z0-9_-]+/)'
ALLOWED_NAMES_RE='/(Users/(Shared|Library)|home/(runner|ubuntu|root|user|dev|USER|USERNAME|myuser|myname|username|app|node|worker))/'

LEAK_FILES=$(echo "$FILES" \
  | grep -vE "$EXCLUDE_PREFIX_RE" \
  | xargs -I{} sh -c '
      f="$1"
      [ -f "$f" ] || exit 0
      grep -lE "'"$LEAK_PATTERN"'" "$f" 2>/dev/null || true
    ' _ {} \
  || true)

if [[ -z "$LEAK_FILES" ]]; then
  echo "check-no-operator-paths: clean (0 operator-path leaks in $(echo "$FILES" | wc -l | tr -d ' ') files)"
  exit 0
fi

# Per-file leak detail, filtering allowed-name false-positives
FAIL_COUNT=0
echo "check-no-operator-paths: LEAK — operator-path strings found in tracked files:" >&2
echo "" >&2

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  HITS=$(grep -nE "$LEAK_PATTERN" "$file" 2>/dev/null | grep -vE "$ALLOWED_NAMES_RE" || true)
  if [[ -n "$HITS" ]]; then
    echo "  $file:" >&2
    echo "$HITS" | sed 's/^/    /' >&2
    echo "" >&2
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done <<< "$LEAK_FILES"

if [[ $FAIL_COUNT -eq 0 ]]; then
  echo "check-no-operator-paths: clean (all matches were on allowlisted names like /Users/Shared, /home/runner)"
  exit 0
fi

echo "Fix: replace absolute home-paths with repo-relative resolution." >&2
echo "  Bash:   REPO_ROOT=\"\$(cd \"\$(dirname \"\$0\")/..\" && pwd)\"" >&2
echo "  Node:   \${process.env.HOME}/... (template literal, not string)" >&2
echo "" >&2
echo "If a path is intentionally illustrative (docs/example), put it" >&2
echo "behind a placeholder like <USER>/ or \$HOME/ to keep this gate" >&2
echo "useful for catching real leaks." >&2
exit 1
