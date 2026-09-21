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
RUN mkdir -p /var/data/uploads /var/data/backups
EXPOSE 10000
CMD ["node", "scripts/pilot-server.mjs"]
