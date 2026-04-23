#!/usr/bin/env bash
# AEGIS supply-chain hardening — CycloneDX SBOM generation.
#
# Generates a CycloneDX 1.7 Software Bill-of-Materials for the given
# package, capturing every transitive runtime dep with version + license
# + source-file location + import-evidence. Consumers + auditors can
# verify the package's exact dep-graph against the registry-served bits
# without re-resolving from package-lock or pnpm-lock files.
#
# Tool: @cyclonedx/cdxgen v12.x — pnpm-aware, multi-manager. Pinned to
# a major-line in the workflow invocation; the dep-cooldown lint covers
# any cdxgen point-release that shows up via Renovate.
#
# Output:
#   - <package-dir>/sbom.cdx.json (gitignored; published WITHIN the
#     tarball if the package's files-array includes "sbom.cdx.json"
#     — currently OUT of files-array per per-package decision; future
#     enhancement may opt-in)
#   - stdout summary: package name + version + component count + size
#
# Usage:  bash scripts/generate-sbom.sh <package-dir>
# Exit:   0 on success · 1 on cdxgen failure · 2 on config error

set -euo pipefail

PACKAGE_DIR="${1:-}"
if [[ -z "$PACKAGE_DIR" || ! -f "$PACKAGE_DIR/package.json" ]]; then
  echo "Usage: bash scripts/generate-sbom.sh <package-dir>" >&2
  echo "  <package-dir> must contain a package.json" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SBOM_OUT="$REPO_ROOT/$PACKAGE_DIR/sbom.cdx.json"

# Pin cdxgen to a known major; allow Renovate to bump within the major after
# the dep-cooldown window elapses.
CDXGEN_VERSION="^12.2.0"

echo "▸ Generating CycloneDX SBOM for $PACKAGE_DIR"
echo "  tool:    @cyclonedx/cdxgen@$CDXGEN_VERSION"
echo "  output:  $SBOM_OUT"

# Run cdxgen with pnpm-aware project type (-t pnpm). cdxgen does its own
# install-with-ignore-scripts under the hood so we do not pollute the runner's
# node_modules.
pnpm dlx "@cyclonedx/cdxgen@$CDXGEN_VERSION" \
  -t pnpm \
  -o "$SBOM_OUT" \
  --no-recurse \
  "$PACKAGE_DIR" \
  > /tmp/cdxgen-stdout.log 2> /tmp/cdxgen-stderr.log || {
    echo "::error::cdxgen failed for $PACKAGE_DIR" >&2
    echo "--- stderr ---" >&2
    tail -40 /tmp/cdxgen-stderr.log >&2 || true
    exit 1
  }

if [[ ! -f "$SBOM_OUT" ]]; then
  echo "::error::cdxgen reported success but no SBOM file at $SBOM_OUT" >&2
  exit 1
fi

# Summary stats from the SBOM
COMPONENT_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SBOM_OUT','utf8')).components?.length || 0)")
SBOM_SIZE=$(wc -c < "$SBOM_OUT" | tr -d ' ')
PKG_NAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PACKAGE_DIR/package.json','utf8')).name)")
PKG_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$PACKAGE_DIR/package.json','utf8')).version)")

echo "  package: $PKG_NAME@$PKG_VERSION"
echo "  components: $COMPONENT_COUNT"
echo "  size: $SBOM_SIZE bytes"
echo "  SBOM ready at $SBOM_OUT"
