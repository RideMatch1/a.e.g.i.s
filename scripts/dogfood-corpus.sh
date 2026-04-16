#!/usr/bin/env bash
#
# AEGIS Dogfood-Corpus Setup
# ──────────────────────────
# Clones (or updates) the multi-project OSS corpus used to measure scanner
# precision on real production code. Three external open-source Next.js
# projects are cloned by default; you can optionally scan your own project
# as a fourth corpus member by setting AEGIS_USER_PROJECT when running
# dogfood-scan.sh.
#
# Customize via env vars:
#   AEGIS_CORPUS_DIR              — where corpora are cloned (default: ~/aegis-corpus)
#   AEGIS_CORPUS_PIN_CALCOM       — git ref for cal.com (default: main)
#   AEGIS_CORPUS_PIN_DUB          — git ref for dub (default: main)
#   AEGIS_CORPUS_PIN_OPENSTATUS   — git ref for openstatus (default: main)
#
# Pinning to a specific commit-hash makes precision-numbers reproducible
# across runs. Track pins in your own project docs when measuring precision.
#
# Usage:
#   bash scripts/dogfood-corpus.sh
#   AEGIS_CORPUS_PIN_CALCOM=v3.7.2 bash scripts/dogfood-corpus.sh

set -euo pipefail

CORPUS_DIR="${AEGIS_CORPUS_DIR:-$HOME/aegis-corpus}"
mkdir -p "$CORPUS_DIR"
mkdir -p "$CORPUS_DIR/scans"

clone_or_update() {
  local name="$1"
  local url="$2"
  local pin="$3"
  local dir="$CORPUS_DIR/$name"

  echo ""
  echo "── $name ($pin) ──────────────────────────────"

  if [ ! -d "$dir" ]; then
    echo "Cloning $url..."
    git clone --depth 100 "$url" "$dir" 2>&1 | sed 's/^/  /'
  else
    echo "Already cloned: $dir"
  fi

  pushd "$dir" > /dev/null
  git fetch --depth 100 origin "$pin" 2>/dev/null || git fetch --depth 100 origin
  git checkout "$pin" 2>&1 | sed 's/^/  /'
  local current
  current=$(git rev-parse HEAD)
  echo "  → HEAD: $current"
  popd > /dev/null
}

# Cal.com — Next.js App Router + Prisma + tRPC, 2000+ files (performance stress + non-Supabase DB)
clone_or_update "cal-com" \
  "https://github.com/calcom/cal.com.git" \
  "${AEGIS_CORPUS_PIN_CALCOM:-main}"

# Dub — Next.js + Prisma + Redis + edge-runtime
clone_or_update "dub" \
  "https://github.com/dubinc/dub.git" \
  "${AEGIS_CORPUS_PIN_DUB:-main}"

# OpenStatus — Next.js App Router + Drizzle + Multi-Tenant production SaaS
clone_or_update "openstatus" \
  "https://github.com/openstatusHQ/openstatus.git" \
  "${AEGIS_CORPUS_PIN_OPENSTATUS:-main}"

echo ""
echo "✅ Corpus ready at $CORPUS_DIR"
echo ""
echo "Next:"
echo "  1. bash scripts/dogfood-scan.sh         # scan all corpus projects"
echo "  2. bash scripts/dogfood-annotate.sh     # generate annotation templates"
echo "  3. Edit aegis-precision/<corpus>.json   # mark each finding TP/FP"
echo "  4. node packages/cli/dist/index.js precision report  # tier-aware scoring"
