FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN test -f src/lib/passwords.ts \
    && test -f src/lib/file-security.ts \
    && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=10000
ENV DATA_DIR=/var/data
ENV SQLITE_PATH=/var/data/ucc-microcredentials.sqlite
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/scripts ./scripts
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --home-dir /app nextjs \
    && mkdir -p /var/data/uploads /var/data/backups \
    && chown -R nextjs:nodejs /app /var/data
# Render mounts its persistent disk after the image is built. The entrypoint
# repairs only application storage, then permanently drops to UID/GID 1001.
USER root
EXPOSE 10000
ENTRYPOINT ["node", "scripts/pilot-entrypoint.mjs"]
CMD ["node", "scripts/pilot-server.mjs"]
