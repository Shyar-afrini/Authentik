# Build from the repo root. The private registry needs credentials, passed as a BuildKit secret
# (never baked into a layer):
#   docker build -f infrastructure/docker/server.Dockerfile --secret id=npmrc,src=$HOME/.npmrc -t authentik-server .
FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    pnpm install --frozen-lockfile --filter "@authentik/server..." \
 && pnpm --filter @authentik/auth build \
 && pnpm --filter @authentik/server build \
 && pnpm --filter @authentik/server deploy --prod --legacy /out

FROM node:24-slim
ENV NODE_ENV=production AUTH_HOST=0.0.0.0 AUTH_PORT=3005
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 3005
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.AUTH_PORT+'/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Apply migrations first with:  docker compose -f infrastructure/docker/compose.yml run --rm auth node dist/database/migrate.js
CMD ["node", "dist/main.js"]
