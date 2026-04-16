#!/usr/bin/env bash
#
# AEGIS Dogfood-Annotate
# ──────────────────────
# Initializes annotation templates from the most recent scans.
# Verdicts default to 'skip'; existing TP/FP markings are preserved
# via source-context fingerprint (stable across line-number drift).
#
# Annotation files land in:
#   <project-cwd>/aegis-precision/<corpus>.json
#
# So if you run this from the AEGIS repo, all annotations live in
# /aegis/aegis-precision/{user-project,cal-com,dub,openstatus}.json
# (user-project only if AEGIS_USER_PROJECT was set during scan).
#
# Usage:
#   bash scripts/dogfood-annotate.sh

set -euo pipefail

CORPUS_DIR="${AEGIS_CORPUS_DIR:-$HOME/aegis-corpus}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AEGIS_CLI="$SCRIPT_DIR/../packages/cli/dist/index.js"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ ! -f "$AEGIS_CLI" ]; then
  echo "error: AEGIS CLI not built. Run: pnpm -r build" >&2
  exit 1
fi

if [ ! -d "$CORPUS_DIR/scans" ]; then
  echo "error: no scans directory at $CORPUS_DIR/scans" >&2
  echo "Run: bash scripts/dogfood-scan.sh first" >&2
  exit 1
fi

cd "$REPO_ROOT"

annotate() {
  local name="$1"
  # Find newest scan for this corpus (by ymd suffix)
  local latest
  latest=$(ls -1 "$CORPUS_DIR/scans/${name}"-*.json 2>/dev/null | sort -r | head -1 || true)
  if [ -z "$latest" ]; then
    echo "  ⚠ No scan found for $name"
    return
  fi
  echo "── $name ──────────────────────────────"
  echo "  Using scan: $latest"
  node "$AEGIS_CLI" precision annotate --init --corpus="$name" --from="$latest" 2>&1 | sed 's/^/  /'
}

annotate "user-project"
annotate "cal-com"
annotate "dub"
annotate "openstatus"

echo ""
echo "✅ Annotation templates ready in $REPO_ROOT/aegis-precision/"
echo ""
echo "Edit each file: set verdict to 'TP', 'FP', or leave 'skip'."
echo "Then run:"
echo "  node $AEGIS_CLI precision report"
