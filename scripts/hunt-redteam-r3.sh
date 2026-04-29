#!/usr/bin/env bash
# Round 3 Deep Red-Team Hunt — themed targets beyond Round 2's Supabase-template territory.
# 2026-04-29 — RideMatch1/AEGIS battle-testing pipeline
#
# Themes:
#   1. AI-agent vibecoded SaaS (LangChain, openai-sdk, RAG frontends)
#   2. Web3 / Solana / Bitcoin (crypto track extension)
#   3. Stripe-Connect marketplace SaaS
#   4. Cloudflare Workers / edge-functions
#   5. Next.js 15 server actions + supabase
#
# Output: ~/findings/redteam-r3-YYYYMMDD/

set -uo pipefail

WORKDIR="$HOME/findings/redteam-r3-$(date +%Y%m%d)"
AEGIS_CLI="<REPO_ROOT>/packages/cli/dist/index.js"
mkdir -p "$WORKDIR/clones" "$WORKDIR/scans"
cd "$WORKDIR"

if [ ! -f "$AEGIS_CLI" ]; then
  echo "error: AEGIS CLI not built at $AEGIS_CLI" >&2
  exit 1
fi

echo "🔍 Round 3 themed hunt — AI-agent + Web3 + payments + edge"
echo "  Workdir: $WORKDIR"
echo ""

> raw-targets.txt

run_query() {
  local label="$1"
  local query="$2"
  echo "── query [$label]"
  gh search repos "$query" \
    --limit 20 \
    --json url,fullName,stargazersCount,pushedAt \
    --jq '.[] | [.fullName, (.stargazersCount|tostring), .pushedAt, .url] | @tsv' \
    2>/dev/null >> raw-targets.txt
}

# Theme 1: AI-agent SaaS (LangChain / openai-sdk / RAG)
run_query "langchain"     '"langchain" supabase pushed:>2026-03-01 stars:<100 language:TypeScript'
run_query "openai-sdk"    '"openai" "next.js" stars:<50 pushed:>2026-04-01 language:TypeScript'
run_query "ai-rag"        '"rag" "supabase" "vector" stars:<30 pushed:>2026-03-01'
run_query "vercel-ai"     '"@ai-sdk" "supabase" stars:<50 pushed:>2026-04-01'

# Theme 2: Web3 / Solana / Bitcoin
run_query "solana-app"    '"@solana/web3.js" next.js stars:<50 pushed:>2026-03-01 language:TypeScript'
run_query "ethers-app"    '"ethers" next.js supabase stars:<30 pushed:>2026-03-01'
run_query "wallet-connect" '"walletconnect" "next.js" stars:<40 pushed:>2026-03-01'

# Theme 3: Stripe-Connect / marketplace
run_query "stripe-connect" '"stripe.connect" next.js stars:<40 pushed:>2026-03-01 language:TypeScript'
run_query "marketplace"   'marketplace "stripe" supabase next.js stars:<30 pushed:>2026-03-01'

# Theme 4: Edge functions / Cloudflare Workers
run_query "cf-workers"    '"cloudflare/workers" next.js supabase stars:<30 pushed:>2026-03-01'
run_query "edge-runtime"  '"export const runtime" "edge" supabase stars:<30 pushed:>2026-04-01'

# Theme 5: Next.js 15 server actions
run_query "server-action" '"use server" "supabase" pushed:>2026-04-01 stars:<30 language:TypeScript'

# Dedupe
echo ""
echo "── dedupe + filter"
sort -u -k1,1 raw-targets.txt | head -25 > targets.txt
TOTAL=$(wc -l < targets.txt | tr -d ' ')
echo "  Unique candidates: $TOTAL"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo "⚠ No targets found."
  exit 0
fi

echo "── targets (top 25, sorted unique)"
awk -F'\t' '{printf "  %-50s %4s★  %s\n", $1, $2, $3}' targets.txt
echo ""

# Clone + scan top-15
LIMIT=15
echo "── clone + AEGIS-scan top-$LIMIT"
COUNT=0
while IFS=$'\t' read -r fullname stars pushedAt url; do
  COUNT=$((COUNT+1))
  if [ "$COUNT" -gt "$LIMIT" ]; then break; fi

  safe_name="${fullname//\//_}"
  clone_dir="$WORKDIR/clones/$safe_name"
  scan_out="$WORKDIR/scans/$safe_name.json"

  echo ""
  echo "── [$COUNT/$LIMIT] $fullname (★$stars, pushed $pushedAt)"

  if [ ! -d "$clone_dir" ]; then
    git clone --depth=1 --quiet "$url" "$clone_dir" 2>&1 | sed 's/^/    /' || {
      echo "    ✗ clone failed, skip"
      continue
    }
  fi

  start_time=$(date +%s)
  if node "$AEGIS_CLI" scan "$clone_dir" --format json > "$scan_out" 2> "$scan_out.err"; then
    elapsed=$(( $(date +%s) - start_time ))
    findings=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$scan_out')).findings.length)" 2>/dev/null)
    blocked=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$scan_out')).blocked ? '[BLOCKED]' : '')" 2>/dev/null)
    score=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$scan_out')).score)" 2>/dev/null)
    grade=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$scan_out')).grade)" 2>/dev/null)
    echo "    ✓ score:$score grade:$grade findings:$findings ${blocked} (${elapsed}s)"
    rm -f "$scan_out.err"
  else
    elapsed=$(( $(date +%s) - start_time ))
    if [ -s "$scan_out" ] && node -e "JSON.parse(require('fs').readFileSync('$scan_out'))" 2>/dev/null; then
      findings=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$scan_out')).findings.length)" 2>/dev/null)
      score=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$scan_out')).score)" 2>/dev/null)
      grade=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$scan_out')).grade)" 2>/dev/null)
      echo "    ✓ score:$score grade:$grade findings:$findings [BLOCKED] (${elapsed}s)"
      rm -f "$scan_out.err"
    else
      echo "    ✗ scan failed (${elapsed}s)"
      head -5 "$scan_out.err" 2>/dev/null | sed 's/^/      /'
    fi
  fi
done < targets.txt

echo ""
echo "🎉 Round 3 hunt done. Triage with:"
echo "    node <REPO_ROOT>/scripts/triage-vibecoded.mjs $WORKDIR/scans"
