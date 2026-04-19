#!/usr/bin/env bash
set -euo pipefail

# AEGIS pre-publish installability smoke-test.
# Pack → install from tarballs into scratch → run primary user-command → verify.
# Catches: workspace:* protocol leaks, missing-files packaging, prepack crashes,
# ESM/CJS mismatches, dep-declaration mistakes. See memory
# feedback_prepublish_installability_gate.md for rationale — this gate would
# have caught all three publish-breakages during the v0.12 release.

SMOKE_DIR=/tmp/aegis-release-smoke
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▸ Cleaning previous smoke-dir"
rm -rf "$SMOKE_DIR"
mkdir -p "$SMOKE_DIR"

echo "▸ Packing 5 packages"
for pkg in core scanners reporters cli mcp-server; do
  (cd "$REPO_ROOT/packages/$pkg" && pnpm pack --pack-destination "$SMOKE_DIR" --silent)
done

echo "▸ Verifying cli tarball bundles templates/"
if ! tar -tzf "$SMOKE_DIR"/aegis-scan-cli-*.tgz | grep -q "templates/nextjs-supabase/template.json"; then
  echo "✗ FAIL: templates/ missing from cli tarball"
  exit 1
fi

echo "▸ Verifying cli tarball has no workspace:* in deps"
tar -xzf "$SMOKE_DIR"/aegis-scan-cli-*.tgz -C "$SMOKE_DIR"
if grep -q '"workspace:' "$SMOKE_DIR/package/package.json"; then
  echo "✗ FAIL: workspace:* found in cli tarball deps"
  exit 1
fi
rm -rf "$SMOKE_DIR/package"

echo "▸ Scratch install from tarballs"
mkdir "$SMOKE_DIR/scratch"
cd "$SMOKE_DIR/scratch"
npm init -y >/dev/null 2>&1
npm install --silent \
  "$SMOKE_DIR"/aegis-scan-core-*.tgz \
  "$SMOKE_DIR"/aegis-scan-scanners-*.tgz \
  "$SMOKE_DIR"/aegis-scan-reporters-*.tgz \
  "$SMOKE_DIR"/aegis-scan-cli-*.tgz

echo "▸ Running aegis new"
./node_modules/.bin/aegis new smoke-test --skip-install --skip-scan >/dev/null

echo "▸ Verifying scaffold output"
if [ ! -d smoke-test ]; then
  echo "✗ FAIL: scaffold dir not created"
  exit 1
fi
if [ ! -f smoke-test/.gitignore ]; then
  echo "✗ FAIL: .gitignore missing (packaging-rename-bug regression)"
  exit 1
fi
# `|| true` suppresses grep's exit 1 when there are no matches — under
# `set -euo pipefail` the zero-match case would otherwise abort the script
# before the `if` check can compare the count.
UNSUB=$({ grep -rE "\{\{[A-Z_]+\}\}" smoke-test || true; } | wc -l | tr -d ' ')
if [ "$UNSUB" != "0" ]; then
  echo "✗ FAIL: $UNSUB unsubstituted {{placeholders}} in scaffold"
  exit 1
fi
TPL_REMAIN=$(find smoke-test -name "*.tpl" | wc -l | tr -d ' ')
if [ "$TPL_REMAIN" != "0" ]; then
  echo "✗ FAIL: $TPL_REMAIN .tpl files remain in scaffold"
  exit 1
fi
FILE_COUNT=$(find smoke-test -type f | wc -l | tr -d ' ')
echo "▸ Scaffold: $FILE_COUNT files, 0 unsubstituted, 0 .tpl leftovers, .gitignore present"

echo "▸ Cleaning up"
cd "$REPO_ROOT"
rm -rf "$SMOKE_DIR"

echo "✓ PASS: pre-publish smoke green. Safe to run 'pnpm -r publish'."
