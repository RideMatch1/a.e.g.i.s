FROM node:20-alpine

# Install pnpm via corepack (exact version from packageManager field)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /aegis

# ── Dependency layer (cached unless lock/manifests change) ────────────────────
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

COPY packages/core/package.json        packages/core/
COPY packages/scanners/package.json    packages/scanners/
COPY packages/reporters/package.json   packages/reporters/
COPY packages/cli/package.json         packages/cli/
COPY packages/mcp-server/package.json  packages/mcp-server/
COPY packages/rules/package.json       packages/rules/

RUN pnpm install --frozen-lockfile

# ── Source + build ────────────────────────────────────────────────────────────
COPY . .

RUN pnpm build

# ── Runtime ───────────────────────────────────────────────────────────────────
ENTRYPOINT ["node", "packages/cli/dist/index.js"]
CMD ["scan", "."]
