#!/usr/bin/env bash
#
# AEGIS Dogfood-Scan
# ──────────────────
# Scans each cloned corpus project (and optionally your own project if
# AEGIS_USER_PROJECT is set), writes JSON output to
# $CORPUS_DIR/scans/<name>-<date>.json. Skips corpora that haven't been
# cloned yet (run dogfood-corpus.sh first to set them up).
#
# Customize via env vars:
#   AEGIS_CORPUS_DIR     — corpus root (default: ~/aegis-corpus)
#   AEGIS_USER_PROJECT   — optional path to your own project to include
#                          as a fourth corpus member (default: skipped)
#
# Usage:
#   bash scripts/dogfood-scan.sh
#   AEGIS_USER_PROJECT=~/code/my-app bash scripts/dogfood-scan.sh

set -euo pipefail

CORPUS_DIR="${AEGIS_CORPUS_DIR:-$HOME/aegis-corpus}"
USER_PROJECT="${AEGIS_USER_PROJECT:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AEGIS_CLI="$SCRIPT_DIR/../packages/cli/dist/index.js"
DATE_TAG="$(date +%Y%m%d)"

if [ ! -f "$AEGIS_CLI" ]; then
  echo "error: AEGIS CLI not built. Run: pnpm -r build" >&2
  exit 1
fi

mkdir -p "$CORPUS_DIR/scans"

scan_project() {
  local name="$1"
  local proj_path="$2"
  local out="$CORPUS_DIR/scans/${name}-${DATE_TAG}.json"
  local err="$CORPUS_DIR/scans/${name}-${DATE_TAG}.stderr.txt"

  echo ""
  echo "── $name ──────────────────────────────"
  if [ ! -d "$proj_path" ]; then
    echo "  ⚠ Skipped (not found): $proj_path"
    return
  fi

  local start_time exit_code
  start_time=$(date +%s)

  # `aegis scan` exits 1 when findings are blocker-severity (e.g., SQLi,
  # hardcoded secret in production). That is a VALID scan outcome with
  # complete output — not a failure. A real failure produces empty or
  # malformed JSON. Decide by JSON validity, not by exit code.
  node "$AEGIS_CLI" scan "$proj_path" --format json > "$out" 2> "$err" && exit_code=0 || exit_code=$?
  local elapsed=$(( $(date +%s) - start_time ))

  if [ -s "$out" ] && node -e "JSON.parse(require('fs').readFileSync('$out'))" 2>/dev/null; then
    local count blocked
    count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$out')).findings.length)")
    blocked=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$out')).blocked ? ' [BLOCKED]' : '')")
    echo "  ✓ $count findings${blocked} (${elapsed}s, exit $exit_code) → $out"
    rm -f "$err"
  else
    echo "  ✗ Scan failed (exit $exit_code)"
    if [ -s "$err" ]; then
      echo "    stderr:"
      sed 's/^/      /' "$err"
    fi
    rm -f "$out"
  fi
}

if [ -n "$USER_PROJECT" ]; then
  scan_project "user-project" "$USER_PROJECT"
fi
scan_project "cal-com"         "$CORPUS_DIR/cal-com"
scan_project "dub"             "$CORPUS_DIR/dub"
scan_project "openstatus"      "$CORPUS_DIR/openstatus"
# v0.8 Phase 7 additions — expanded corpus for n>=20 precision validation
scan_project "taxonomy"        "$CORPUS_DIR/taxonomy"
scan_project "documenso"       "$CORPUS_DIR/documenso"
scan_project "nextjs-commerce" "$CORPUS_DIR/nextjs-commerce"

echo ""
echo "✅ Scans done — $CORPUS_DIR/scans/*-${DATE_TAG}.json"
echo ""
echo "Next: bash scripts/dogfood-annotate.sh"
