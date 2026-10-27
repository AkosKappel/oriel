# syntax=docker/dockerfile:1

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build \
    # The migration script needs only these two packages (neither has dependencies).
    && mkdir -p /migrate/node_modules \
    && cp -rL node_modules/drizzle-orm node_modules/postgres /migrate/node_modules/

FROM node:24-slim
# Security patches newer than the base image, and no package managers at runtime: the app never
# installs anything, and npm and corepack carry their own dependencies for scanners to flag.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# The Nitro output bundles its server dependencies; nothing else is needed to run the app.
COPY --from=build /app/.output ./.output
COPY --from=build /migrate/node_modules ./node_modules
COPY drizzle ./drizzle
COPY scripts/migrate.ts ./scripts/migrate.ts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
