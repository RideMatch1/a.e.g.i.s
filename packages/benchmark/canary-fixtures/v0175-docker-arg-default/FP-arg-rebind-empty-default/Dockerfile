FROM node:20.11-alpine

WORKDIR /app

# Empty-default build-arg pattern — the safest variant.
# If --build-arg is omitted, the empty value ships and the app fails
# fast at startup (clean error on missing required env var).
ARG NEXT_PRIVATE_TELEMETRY_KEY=""
ENV NEXT_PRIVATE_TELEMETRY_KEY="$NEXT_PRIVATE_TELEMETRY_KEY"

ARG NEXT_PRIVATE_TELEMETRY_HOST=""
ENV NEXT_PRIVATE_TELEMETRY_HOST="$NEXT_PRIVATE_TELEMETRY_HOST"

COPY . .
RUN npm ci --omit=dev
CMD ["node", "server.js"]
