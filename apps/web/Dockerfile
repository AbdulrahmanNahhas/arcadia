# Built from the repo root: docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=... .
# VITE_API_URL is a Vite build-time value baked into the static bundle — rebuild the image if the
# API's address ever changes (see docs/deployment-and-release-roadmap.md §3 for the runtime-
# configurable alternative, not built yet).

FROM node:26-slim AS build
ARG VITE_API_URL=http://127.0.0.1:3001
ENV VITE_API_URL=${VITE_API_URL}
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @arcadia/web build

FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/web/dist/client /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
