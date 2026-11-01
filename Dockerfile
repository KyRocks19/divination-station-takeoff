# The full local edition of Divination Station in a container (docs/local-edition-setup.md, "Docker").
#
#   docker compose up --build        then open http://localhost:47831
#
# Everything a person writes is kept in the /data volume (the database in /data/database, pictures in /data/pictures). Nothing secret is in the image:
# the copy makes its own secrets on first start and saves them in /data. The container listens on all of its own addresses; docker-compose.yml publishes
# the port on this computer's loopback address only.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DS_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
# The build loads every route once and the sign-in code refuses to load without a secret. This value is only for that, it is set for this one command, and it
# is not in the final image: a copy makes its own secrets on first start.
RUN SESSION_SECRET=build-only-value-not-a-secret-build-only-value npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DS_EDITION=local \
    DS_DB_DIR=/data/database \
    ART_DIR=/data/pictures \
    DS_MIGRATIONS_DIR=/app/migrations \
    HOSTNAME=0.0.0.0 \
    PORT=47831
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/migrations ./migrations
# The reference bundle (made by scripts/export-reference-bundle.ts) fills the encyclopedia on first start. A copy without it starts with an empty one.
COPY --from=build --chown=node:node /app/data ./data
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 47831
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:47831/privacy').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
