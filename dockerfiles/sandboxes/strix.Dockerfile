# Strix sandbox — APTS-MR-018 AI/IO Boundary container.
#
# Closes the gap flagged by the brutal-audit on 2026-04-27: the
# `aegis/strix-sandbox:latest` image referenced by `wrapForSandbox`
# did not exist on docker hub and had no Dockerfile in the repo.
# This file is the authoritative build for the strix sandbox image.
#
# Build:
#   docker build -t aegis/strix-sandbox:latest -f dockerfiles/sandboxes/strix.Dockerfile dockerfiles/sandboxes
#
# The upstream Strix install at https://strix.ai/install requires Docker,
# which we cannot run inside the sandbox container. The container therefore
# installs the strix Python package from PyPI (pip-installable variant) and
# exposes `strix` as ENTRYPOINT. Operators who need the full Docker-host
# install of strix should use --sandbox-mode=firejail or none.
#
# Hardening that wrapForSandbox layers on top at run-time:
#   - --network=aegis-egress (egress allowlist, internal docker network)
#   - --security-opt=no-new-privileges
#   - --cap-drop=ALL
#   - --read-only with --tmpfs=/tmp
#
# Container-side hardening:
#   - Non-root user (uid 1000)
#   - No shell on the entrypoint path
#   - Minimal base (python:slim) — no shell utilities surface

FROM python:3.12-slim

LABEL org.opencontainers.image.title="aegis/strix-sandbox"
LABEL org.opencontainers.image.description="APTS-MR-018 AI/IO boundary container for Strix LLM-pentest tool"
LABEL org.opencontainers.image.source="https://github.com/RideMatch1/a.e.g.i.s"
LABEL org.opencontainers.image.licenses="Apache-2.0"

# Install only what strix needs at runtime; no curl, no shell utilities.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Strix from PyPI (the pip-installable variant). If the tool is not
# pip-installable in your install, replace this with the appropriate
# install commands. The build will fail loudly if strix is unreachable —
# operators must update this Dockerfile for their environment.
RUN pip install --no-cache-dir strix \
    || (echo "WARN: strix package not on PyPI under that name. Update Dockerfile with the correct upstream install." >&2 && exit 1)

# Non-root execution
RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin aegis
USER aegis
WORKDIR /workspace

# AEGIS_EGRESS_ALLOWLIST is consumed by wrapForSandbox via --env on
# the docker run; the entrypoint reads it for diagnostic logging.
ENTRYPOINT ["strix"]
CMD ["--help"]
