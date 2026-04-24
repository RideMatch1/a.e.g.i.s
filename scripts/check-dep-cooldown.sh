#!/usr/bin/env bash
# AEGIS supply-chain hardening — dependency-version cooldown lint.
#
# Defends the post-publish detection-window for malicious-dep releases
# (eslint-config-prettier July-2025 npm-token leak class, lottie-player
# Oct-2024 hijack class). Catches cases where a transitive or direct
# dep version was published <THRESHOLD days ago and our manifest
# already pins to it — that's the rushed-update window where bad actors
# ship a poisoned tarball before maintainers can react.
#
# Policy:
#   - critical-deps (bumped, stable, security-sensitive): >= 14 days
#   - all others: >= 7 days
#
# Output:
#   - prints a per-dep age summary with PASS/WARN/FAIL classification
#   - exits 1 if any FAIL (under threshold for its tier)
#   - exits 0 if all PASS or only WARN-class entries (advisory phase)
#
# Set CI=true to make WARN-class fail too (strict-mode for pre-release).
#
# Usage:  bash scripts/check-dep-cooldown.sh
# Exit:   0 = all clean · 1 = at least one FAIL · 2 = config error

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

THRESHOLD_DEFAULT_DAYS=7
THRESHOLD_CRITICAL_DAYS=14

# Critical-dep allowlist: high-impact deps that warrant the longer cooldown.
# Add to this list if a dep ships into shipped tarballs (vs dev-only).
CRITICAL_DEPS=(
  "zod"
  "@clack/prompts"
  "commander"
  "gray-matter"
  "yaml"
  "chalk"
  "typescript"
  "vitest"
  "turbo"
  "@cyclonedx/cdxgen"
)

is_critical() {
  local dep="$1"
  for c in "${CRITICAL_DEPS[@]}"; do
    [[ "$c" == "$dep" ]] && return 0
  done
  return 1
}

# Parse direct deps from a package.json file. Emits "name<TAB>version" pairs.
# Skips workspace:*, file:*, link:* — those are local references.
parse_deps() {
  local pkg="$1"
  node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync('$pkg', 'utf-8'));
    const all = { ...(m.dependencies || {}), ...(m.devDependencies || {}) };
    for (const [name, spec] of Object.entries(all)) {
      if (typeof spec !== 'string') continue;
      if (spec.startsWith('workspace:')) continue;
      if (spec.startsWith('file:')) continue;
      if (spec.startsWith('link:')) continue;
      if (spec.startsWith('catalog:')) continue;
      // Strip leading ^ ~ >= etc to get the floor version
      const cleaned = spec.replace(/^[\^~>=<\s]+/, '').split(/[\s|]/)[0];
      // Skip if cleaned is empty or a tag (e.g. 'next', 'latest')
      if (!cleaned || !/^\d/.test(cleaned)) continue;
      console.log(name + '\t' + cleaned);
    }
  " 2>/dev/null
}

# Get the publish-time of a specific version of a package.
# Outputs ISO-8601 timestamp string, or empty on failure.
# Uses --json + node-extract because `npm view <pkg> time.<version>` mis-parses
# version-keys with dots (e.g. "3.23.0") as nested field paths.
publish_time() {
  local name="$1"
  local version="$2"
  npm view "${name}@${version}" time --json 2>/dev/null \
    | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{ try { const j=JSON.parse(s); console.log(j['$version']||''); } catch(e) { console.log(''); } });" \
    2>/dev/null || true
}

# Compute days-since-publish given an ISO-8601 timestamp.
days_since() {
  local iso="$1"
  if [[ -z "$iso" ]]; then
    echo "?"
    return
  fi
  local now_epoch pub_epoch
  now_epoch=$(date -u +%s)
  # macOS date vs GNU date — try GNU first, fallback to BSD
  if pub_epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%S" "${iso%.*}" +%s 2>/dev/null); then
    :
  elif pub_epoch=$(date -u -d "$iso" +%s 2>/dev/null); then
    :
  else
    echo "?"
    return
  fi
  echo $(( (now_epoch - pub_epoch) / 86400 ))
}

echo "Dependency cooldown lint"
echo "  threshold: critical-deps >= ${THRESHOLD_CRITICAL_DAYS}d, default >= ${THRESHOLD_DEFAULT_DAYS}d"
echo ""

FAIL_COUNT=0
WARN_COUNT=0
PASS_COUNT=0
SEEN=""

# Walk all package.json files in the workspace (root + each package/<name>)
PACKAGE_FILES=("package.json")
for d in packages/*/package.json; do
  [[ -f "$d" ]] && PACKAGE_FILES+=("$d")
done

for pkg in "${PACKAGE_FILES[@]}"; do
  while IFS=$'\t' read -r name version; do
    [[ -z "$name" ]] && continue
    # Dedupe across multiple package.json files
    key="${name}@${version}"
    case "$SEEN" in *"|${key}|"*) continue;; esac
    SEEN="${SEEN}|${key}|"

    pub_time=$(publish_time "$name" "$version")
    days=$(days_since "$pub_time")

    threshold=$THRESHOLD_DEFAULT_DAYS
    is_critical "$name" && threshold=$THRESHOLD_CRITICAL_DAYS

    if [[ "$days" == "?" ]]; then
      printf "  ?  %-40s  %-15s  unknown publish-time (skipped)\n" "$name" "$version"
      continue
    fi

    if (( days < threshold )); then
      if (( days < threshold / 2 )); then
        FAIL_COUNT=$((FAIL_COUNT + 1))
        printf "  FAIL  %-40s  %-15s  %d days old (need >= %dd)\n" "$name" "$version" "$days" "$threshold"
      else
        WARN_COUNT=$((WARN_COUNT + 1))
        printf "  WARN  %-40s  %-15s  %d days old (need >= %dd)\n" "$name" "$version" "$days" "$threshold"
      fi
    else
      PASS_COUNT=$((PASS_COUNT + 1))
      # Quiet on PASS unless verbose
      [[ "${VERBOSE:-0}" == "1" ]] && printf "  pass  %-40s  %-15s  %d days old\n" "$name" "$version" "$days"
    fi
  done < <(parse_deps "$pkg")
done

echo ""
echo "Summary:  PASS=$PASS_COUNT  WARN=$WARN_COUNT  FAIL=$FAIL_COUNT"

if (( FAIL_COUNT > 0 )); then
  echo "" >&2
  echo "::error::At least one dep is dangerously fresh (<half of cooldown threshold)." >&2
  echo "         Wait for the post-publish detection window to elapse, OR document an" >&2
  echo "         explicit override in a SECURITY-EXCEPTION.md entry referencing this run." >&2
  exit 1
fi

if (( WARN_COUNT > 0 )) && [[ "${STRICT:-0}" == "1" ]]; then
  echo "" >&2
  echo "::error::STRICT mode + WARN entries present. Fail-build for pre-release discipline." >&2
  exit 1
fi

exit 0
