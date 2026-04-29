FROM node:20.11-alpine

WORKDIR /app

# Canonical Docker build-arg-secret pattern.
# ARG default is a placeholder (CAFEBABE) — user is expected to override
# at build with `--build-arg NEXT_PRIVATE_ENCRYPTION_KEY=$REAL_KEY`.
# If they don't, the placeholder ships, which is obviously not a real
# secret. config-auditor MUST NOT flag this as CRITICAL.
ARG NEXT_PRIVATE_ENCRYPTION_KEY="CAFEBABE"
ENV NEXT_PRIVATE_ENCRYPTION_KEY="$NEXT_PRIVATE_ENCRYPTION_KEY"

COPY . .
RUN npm ci --omit=dev
CMD ["node", "server.js"]
