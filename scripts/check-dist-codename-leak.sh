#!/usr/bin/env bash
# AEGIS supply-chain hardening — dist/ codename-leak gate (audit L1).
#
# Rule #13 (commit-msg scrub-gate) catches leaks in commit messages. This
# script extends coverage to the built dist/*.js artifacts, specifically
# targeting the planning-artifact shorthand the external audit observed
# ("recon §10", "dispatch-brief commit 1", "dogfood §3.2#5 + §3.7#6",
# "recon-report F1 + dogfood §3.5") that rode through the tsc build
# from source-comments into the shipped dist/.
#
# Scope-decision (advisor R-audit ISSUE-1, refined during B9 impl):
# the gate deliberately does NOT inherit the full Rule-#13 scrub-term
# list because that list covers legitimate product refs (Claude,
# Anthropic, aegis-precision as a real CLI feature-directory). Running
# the full list against dist/ false-positives on 16 legitimate code
# sites. The AI-provider name checks + internal-project-codename
# coverage already happens at the publish-*.yml tarball-scrub layer
# where the scope is tightly SaaS-operator-specific. This script is
# purposefully narrow: planning-artifact shorthand only.
#
# Future enhancement (v0.17.3 candidate): richer dist/ scrubbing via
# per-scanner allowlists or per-package SCRUB dictionaries.
#
# Usage:  bash scripts/check-dist-codename-leak.sh
# Exit:   0 = clean · 1 = leak detected · 2 = config error

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Audit-observed planning-artifact shorthand (v0.17.1 L1 finding). These
# strings only appear in internal planning artifacts and have no business
# in the shipped dist/*.js. Word-boundaried via space-anchors so prose
# like "reconnaissance" or "brief summary" does NOT match.
PLANNING_REGEX='recon §[0-9]|recon-report F[0-9]|dispatch-brief commit [0-9]|dogfood §[0-9]'

# Walk dist/ for every shipped package. Missing dist/ dirs are expected
# (some packages may have no dist yet); the find silently skips them.
DIST_FILES=$(find packages/*/dist -type f -name '*.js' 2>/dev/null || true)

if [[ -z "$DIST_FILES" ]]; then
  echo "check-dist-codename-leak: no dist/*.js files found — run \`pnpm build\` first" >&2
  exit 2
fi

FAIL_COUNT=0
TOTAL_CHECKED=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  TOTAL_CHECKED=$((TOTAL_CHECKED + 1))

  HITS=$(grep -inE "$PLANNING_REGEX" "$file" 2>/dev/null || true)
  if [[ -n "$HITS" ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "::error::planning-artifact leak in $file:" >&2
    echo "$HITS" | head -20 >&2
    echo "" >&2
  fi
done <<< "$DIST_FILES"

echo ""
echo "check-dist-codename-leak: scanned $TOTAL_CHECKED dist/*.js file(s); $FAIL_COUNT leak(s)."

if (( FAIL_COUNT > 0 )); then
  echo "" >&2
  echo "::error::Planning-artifact shorthand leaked into built dist/*.js." >&2
  echo "         Paraphrase the source-side comments (remove \"recon §N\"," >&2
  echo "         \"dispatch-brief commit N\", \"dogfood §N\", \"recon-report FN\")," >&2
  echo "         re-run \`pnpm build\`, and re-run this script." >&2
  exit 1
fi

exit 0
