# PTAI (pentest-ai) sandbox — APTS-MR-018 AI/IO Boundary container.
#
# Build:
#   docker build -t aegis/ptai-sandbox:latest -f dockerfiles/sandboxes/ptai.Dockerfile dockerfiles/sandboxes
#
# Upstream: https://github.com/0xSteph/pentest-ai (MIT). pip-installable.
#
# Hardening at run-time (layered by wrapForSandbox):
#   --network=aegis-egress, --security-opt=no-new-privileges, --cap-drop=ALL,
#   --read-only with --tmpfs=/tmp.

FROM python:3.12-slim

LABEL org.opencontainers.image.title="aegis/ptai-sandbox"
LABEL org.opencontainers.image.description="APTS-MR-018 AI/IO boundary container for PTAI LLM-pentest tool"
LABEL org.opencontainers.image.source="https://github.com/RideMatch1/a.e.g.i.s"
LABEL org.opencontainers.image.licenses="Apache-2.0"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir ptai \
    || (echo "WARN: ptai package not on PyPI under that name. Update Dockerfile with the correct upstream install." >&2 && exit 1)

RUN useradd --uid 1000 --create-home --shell /usr/sbin/nologin aegis
USER aegis
WORKDIR /workspace

ENTRYPOINT ["ptai"]
CMD ["--help"]
