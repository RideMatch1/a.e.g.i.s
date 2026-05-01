#!/usr/bin/env bash
# AEGIS Splinter Refresh — diff vendored Supabase Splinter rules against upstream main.
#
# - Compares the SHA in packages/rules/supabase/SPLINTER_SHA.lock against
#   the latest commit on supabase/splinter#main.
# - Lists new / changed / removed .sql lint files.
# - Flags any new rule that lacks an entry in packages/rules/supabase/RULES.md
#   (i.e. AEGIS coverage hasn't been decided yet).
# - Exits non-zero on any drift, so CI / cron can fail loudly.
#
# Run manually: scripts/refresh-splinter.sh
# Run via npm:  pnpm refresh:splinter
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$ROOT/packages/rules/supabase/SPLINTER_SHA.lock"
VENDOR_DIR="$ROOT/packages/rules/supabase/splinter"
RULES_MD="$ROOT/packages/rules/supabase/RULES.md"

[[ -f "$LOCK" ]] || { echo "ERROR: lock file missing: $LOCK" >&2; exit 2; }
PINNED_SHA="$(grep '^sha=' "$LOCK" | cut -d= -f2)"

# gh CLI handles upstream-SHA fetch in lieu of curl|python3 (eliminates the
# Scorecard downloadThenRun finding on this line — gh authenticates +
# does its own JSON parsing, no interpreter pipe).
command -v gh >/dev/null 2>&1 || { echo "ERROR: gh CLI required for upstream SHA fetch" >&2; exit 2; }
echo "Pinned SHA:  $PINNED_SHA"
LATEST_SHA="$(gh api repos/supabase/splinter/commits/main --jq '.sha')"
echo "Upstream SHA: $LATEST_SHA"

if [[ "$PINNED_SHA" == "$LATEST_SHA" ]]; then
  echo "✓ Splinter pin is up-to-date."
  exit 0
fi

echo ""
echo "⚠ Drift detected. Comparing rule files…"

# Pull upstream lint filenames via gh (handles auth + JSON parsing; no curl|python3 pipe).
upstream_files="$(gh api "repos/supabase/splinter/contents/lints?ref=$LATEST_SHA" --jq '.[] | select(.type=="file" and (.name | endswith(".sql"))) | .name' | sort)"
vendored_files="$(cd "$VENDOR_DIR" && ls *.sql 2>/dev/null | sort || true)"

added="$(comm -23 <(echo "$upstream_files") <(echo "$vendored_files"))"
removed="$(comm -13 <(echo "$upstream_files") <(echo "$vendored_files"))"

if [[ -n "$added" ]]; then
  echo ""
  echo "NEW rules upstream (not yet vendored):"
  echo "$added" | sed 's/^/  + /'

  echo ""
  echo "Coverage-decision needed for each. Add an entry to:"
  echo "  $RULES_MD"
  echo ""
  echo "Decide:"
  echo "  (a) Static-detectable → extend supabase-migration-checker"
  echo "  (b) Live-DB-only → document in rls-defense skill"
  echo "  (c) Perf hint → defer to supabase-postgres-best-practices"
fi

if [[ -n "$removed" ]]; then
  echo ""
  echo "REMOVED rules upstream (still vendored locally):"
  echo "$removed" | sed 's/^/  - /'
  echo "Consider deleting from $VENDOR_DIR/ if AEGIS no longer needs them as historical reference."
fi

echo ""
echo "To accept the new pin and refresh files:"
echo "  scripts/refresh-splinter.sh --apply"

if [[ "${1:-}" == "--apply" ]]; then
  echo ""
  echo "Applying refresh…"
  cd "$VENDOR_DIR"
  for fname in $upstream_files; do
    curl -fsSL "https://raw.githubusercontent.com/supabase/splinter/$LATEST_SHA/lints/$fname" -o "$fname"
  done
  for fname in $removed; do
    rm -f "$fname"
  done

  # update lock — fetch metadata via gh (auth + JSON parsing built-in)
  date_iso="$(gh api "repos/supabase/splinter/commits/$LATEST_SHA" --jq '.commit.committer.date')"
  message="$(gh api "repos/supabase/splinter/commits/$LATEST_SHA" --jq '.commit.message | split("\n")[0]')"
  cat > "$LOCK" <<EOF
repo=supabase/splinter
sha=$LATEST_SHA
date=$date_iso
last_message=$message
file_count=$(echo "$upstream_files" | wc -l | tr -d ' ')
vendored_at=$(date -u +%Y-%m-%d)
vendored_by=AEGIS-refresh-splinter.sh
EOF
  echo "✓ Vendor refreshed. Review diff and update RULES.md if new rules appeared."
else
  exit 1
fi
