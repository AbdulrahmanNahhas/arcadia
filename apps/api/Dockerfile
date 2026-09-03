# Built from the repo root: docker build -f apps/api/Dockerfile .
# (needs the whole workspace as build context — pnpm workspace deps are real source, not
# published packages).

FROM node:26-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# tsup bundles @arcadia/{contracts,database,domain} straight into dist/server.js (see
# apps/api/tsup.config.ts's noExternal) — only apps/api's own real npm dependencies need to
# survive into the runtime image, which is exactly what `pnpm deploy` isolates below.
RUN pnpm --filter @arcadia/api build
# --legacy: pnpm 10+'s default "injected" deploy needs inject-workspace-packages set repo-wide,
# which this workspace doesn't use — tsup already bundled the workspace deps in above, so a plain
# copy of apps/api's own real npm dependencies (the legacy behavior) is exactly what's needed.
RUN pnpm --filter @arcadia/api deploy --prod --legacy /deploy/api

FROM node:26-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /deploy/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/server.js"]
