# Built from the repo root: docker build -f apps/web/Dockerfile .
#
# One image for every deployment: the bundle is built with VITE_API_URL=same-origin, which makes
# the web app talk to the origin it was served from (see apps/web/src/lib/api.ts), and nginx
# proxies /api, /media and /openapi.json to the API container. No server address is baked in;
# point ARCADIA_API_UPSTREAM (default arcadia-api:23101) at wherever the API listens.

FROM node:26-slim AS build
ARG VITE_API_URL=same-origin
ENV VITE_API_URL=${VITE_API_URL}
# node:26 no longer ships corepack; pin the same pnpm the workspace declares (package.json packageManager).
RUN npm install -g pnpm@11.11.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @arcadia/web build

FROM nginx:alpine AS runtime
ENV ARCADIA_API_UPSTREAM=arcadia-api:23101
COPY --from=build /repo/apps/web/dist/client /usr/share/nginx/html
# nginx's entrypoint runs envsubst over /etc/nginx/templates/*.template into /etc/nginx/conf.d.
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
