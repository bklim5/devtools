# Purchase-webhook container image (Plan-02 server/webhook backend, D-55).
#
# Build context is the repo's server/webhook directory (see compose.yaml's
# build.context). No secrets are baked in — all env (admin token, LS secret,
# Resend key, KEYGEN_BASE_URL=http://web:3000) arrives at runtime from the
# gitignored server/webhook/.env via compose `env_file`.
#
# The backend runs TS directly via Node's type-stripping (the package's
# `start` script: `node --experimental-strip-types src/index.ts`), so there is
# no build/transpile step — `resend` is the only runtime dependency.

# Node 22+ ships --experimental-strip-types (matches @types/node 22 in the repo).
FROM node:22-slim

WORKDIR /app

# Install ONLY the webhook package's production deps (resend). Copy the manifest
# first for layer caching; the package has no lockfile of its own (it is a pnpm
# workspace member), so a plain `npm install --omit=dev` resolves `resend`.
COPY package.json ./
RUN npm install --omit=dev --no-package-lock

# App source (src/*.ts — run directly, no transpile).
COPY src ./src

# The server binds PORT (config default 8787); Caddy fronts it (no host publish).
EXPOSE 8787

ENV NODE_ENV=production

# Runs `node --experimental-strip-types src/index.ts` per package.json.
CMD ["npm", "run", "start"]
