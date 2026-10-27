# Agent HQ: one image with the API and the interface.
# Build: docker build -t agent-hq .   (or: docker compose up -d --build)

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build \
 && npm prune --omit=dev \
 && rm -f server/*.test.ts

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=8787 \
    DATABASE_PATH=/data/agent-hq.db \
    BACKUP_DIR=/data/backups
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/sdk ./sdk
COPY --from=build /app/web/dist ./web/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts"]
