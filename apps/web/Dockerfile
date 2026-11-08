# Built from the repository root, Railway's default build context.
FROM node:22-slim AS build
WORKDIR /repo
ENV CI=true NX_DAEMON=false NX_NO_CLOUD=true
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx build web

FROM caddy:2-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
COPY apps/web/coming-soon /coming-soon
