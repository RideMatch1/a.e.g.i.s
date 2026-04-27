#!/usr/bin/env bash
# Build all three APTS-MR-018 sandbox images locally.
#
# Usage:
#   bash dockerfiles/sandboxes/build.sh                          # build all
#   bash dockerfiles/sandboxes/build.sh strix                    # build single
#
# Also creates the `aegis-egress` docker network with --internal so
# containers attached to it cannot reach external networks. Operators
# who need a custom egress allowlist should re-create this network
# with their own allow rules (or use a custom --docker-network flag
# in RoE.sandboxing).

set -euo pipefail

WHICH="${1:-all}"

build_image() {
  local name="$1"
  local dockerfile="dockerfiles/sandboxes/${name}.Dockerfile"
  local tag="aegis/${name}-sandbox:latest"
  if [[ ! -f "$dockerfile" ]]; then
    echo "ERROR: ${dockerfile} not found" >&2
    return 1
  fi
  echo "==> Building ${tag} from ${dockerfile}"
  docker build \
    -t "${tag}" \
    -f "${dockerfile}" \
    dockerfiles/sandboxes
}

create_network() {
  if docker network inspect aegis-egress >/dev/null 2>&1; then
    echo "==> aegis-egress network already exists"
    return 0
  fi
  echo "==> Creating aegis-egress docker network (--internal: no external egress)"
  docker network create --driver=bridge --internal aegis-egress
}

create_network

case "$WHICH" in
  all)
    build_image strix
    build_image ptai
    build_image pentestswarm
    ;;
  strix|ptai|pentestswarm)
    build_image "$WHICH"
    ;;
  *)
    echo "ERROR: unknown image '$WHICH' — expected: all | strix | ptai | pentestswarm" >&2
    exit 1
    ;;
esac

echo ""
echo "==> Build complete. Verify:"
echo "    docker image ls 'aegis/*-sandbox'"
echo "    docker network inspect aegis-egress | head -20"
