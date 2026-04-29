FROM node:20.11-alpine

WORKDIR /app

# TP — secret baked directly into ENV with NO upstream ARG.
# config-auditor MUST flag this CRITICAL.
ENV API_KEY="EXAMPLE_FIXTURE_NOT_A_REAL_KEY"
ENV DATABASE_PASSWORD="hunter2-real-prod-password"

COPY . .
RUN npm ci --omit=dev
CMD ["node", "server.js"]
