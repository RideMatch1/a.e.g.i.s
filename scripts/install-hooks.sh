#!/usr/bin/env bash
# Idempotent installer for AEGIS git-hooks.
# Run from any dir inside the repo: ./scripts/install-hooks.sh
#
# Installs three client-side hooks (defense-in-depth, layered with the
# CI-side gates so a leak that slips one layer hits the next):
#   - commit-msg → scrub-gate.sh (Rule #13: scrub-term hygiene in
#     commit message; blocks "Claude", "Anthropic", and the local
#     scrub-list of operator-private brand/codename terms)
#   - pre-commit → check-no-operator-paths.sh --staged (operator-path
#     leak gate; blocks /Users/<name>/ + /home/<name>/ in staged file
#     contents BEFORE the commit lands locally)
#   - pre-push  → gitleaks protect (local secret-format scan, only
#     installed if the gitleaks binary is on $PATH; complements
#     GitHub's secret-scanning push-protection)

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$REPO_ROOT" ]]; then
  echo "install-hooks: not inside a git repo" >&2
  exit 1
fi

HOOKS_SRC="$REPO_ROOT/scripts/hooks"
HOOKS_TGT="$REPO_ROOT/.git/hooks"

if [[ ! -d "$HOOKS_SRC" ]]; then
  echo "install-hooks: source $HOOKS_SRC missing — corrupted clone?" >&2
  exit 1
fi

mkdir -p "$HOOKS_TGT"

install_hook() {
  local name="$1"
  local src="$HOOKS_SRC/$name"
  local tgt="$HOOKS_TGT/$name"

  if [[ ! -f "$src" ]]; then
    echo "  skip: $name (no source at $src)"
    return 0
  fi

  if [[ -f "$tgt" ]]; then
    if cmp -s "$src" "$tgt"; then
      echo "  noop: $name already installed (identical)"
      return 0
    fi
    # Different content already at target. If it identifies as an
    # AEGIS hook (header signature), overwrite. Otherwise warn.
    if head -3 "$tgt" 2>/dev/null | grep -q 'AEGIS'; then
      cp "$src" "$tgt"
      chmod +x "$tgt"
      echo "  update: $name (older AEGIS version replaced)"
      return 0
    fi
    echo "  WARN: $name already exists at $tgt and is NOT an AEGIS hook." >&2
    echo "        Inspect it, then either remove it or chain it manually." >&2
    return 1
  fi

  cp "$src" "$tgt"
  chmod +x "$tgt"
  echo "  installed: $name"
}

echo "AEGIS hook installer — target: $HOOKS_TGT"
echo ""

INSTALL_FAILED=0
install_hook "commit-msg" || INSTALL_FAILED=1
install_hook "pre-commit" || INSTALL_FAILED=1

# pre-push depends on gitleaks being installed locally.
if command -v gitleaks >/dev/null 2>&1; then
  install_hook "pre-push" || INSTALL_FAILED=1
else
  echo "  skip: pre-push (gitleaks binary not found on \$PATH)"
  echo "        install: brew install gitleaks (macOS) | apt install gitleaks (Debian/Ubuntu)"
  echo "        or download: https://github.com/gitleaks/gitleaks/releases"
  echo "        re-run this script after install to add the pre-push hook."
fi

echo ""
if [[ $INSTALL_FAILED -ne 0 ]]; then
  echo "install-hooks: completed with warnings (see above)" >&2
  exit 1
fi

echo "install-hooks: done. Active AEGIS hooks:"
ls -1 "$HOOKS_TGT" | grep -vE '\.(sample|aegis-backup-)' | grep -E '^(commit-msg|pre-commit|pre-push)$' || true
echo ""
echo "To customize project-specific scrub-terms, create: $REPO_ROOT/scripts/scrub-terms.local.txt"
echo "  (gitignored — one term per line, # for comments, supports regex patterns)"
