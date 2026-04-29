#!/usr/bin/env bash
# AEGIS battle-testing cleanup — wipe local clones from hunt scripts
# Usage: bash scripts/cleanup-findings.sh [findings-dir]
#
# After triage is complete, run this to wipe all cloned third-party
# repos. Scan-result JSONs are kept by default (small, archived under
# aegis-precision/scan-archives/ if you want longer retention).
#
# Per battle-testing directive 2026-04-29: clones must not accumulate
# locally. Run this at the end of every hunt session.

set -uo pipefail

FINDINGS_ROOT="${1:-$HOME/findings}"

if [ ! -d "$FINDINGS_ROOT" ]; then
  echo "✓ $FINDINGS_ROOT does not exist — nothing to clean."
  exit 0
fi

BEFORE=$(du -sh "$FINDINGS_ROOT" 2>/dev/null | cut -f1)
echo "Findings root: $FINDINGS_ROOT ($BEFORE)"
echo ""
echo "Subdirs that will be deleted:"
for dir in "$FINDINGS_ROOT"/*/; do
  [ -d "$dir" ] || continue
  size=$(du -sh "$dir" 2>/dev/null | cut -f1)
  printf "  %-8s %s\n" "$size" "$(basename "$dir")"
done
echo ""

read -r -p "Delete entire $FINDINGS_ROOT tree? (y/N) " ans
case "$ans" in
  y|Y|yes|YES)
    rm -rf "$FINDINGS_ROOT"
    echo "✅ Wiped $FINDINGS_ROOT ($BEFORE freed)"
    ;;
  *)
    echo "✗ Aborted — nothing deleted."
    exit 1
    ;;
esac
