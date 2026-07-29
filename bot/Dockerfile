# syntax=docker/dockerfile:1@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89

ARG PNPM_VERSION=11.17.0

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS pnpm

USER root
ARG PNPM_VERSION

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm install --global "pnpm@${PNPM_VERSION}" \
    && mkdir -p /app /pnpm/store \
    && chown -R 65532:65532 /app /pnpm

USER 65532:65532

FROM pnpm AS prod-deps
WORKDIR /app

COPY --chown=65532:65532 package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=65532:65532 bot/package.json ./bot/package.json
COPY --chown=65532:65532 web/package.json ./web/package.json

# hadolint ignore=DL3059
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,uid=65532,gid=65532 \
    pnpm install --frozen-lockfile --prod --filter powercord-bot

FROM pnpm AS build
WORKDIR /app

COPY --chown=65532:65532 package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=65532:65532 bot/package.json ./bot/package.json
COPY --chown=65532:65532 web/package.json ./web/package.json

# hadolint ignore=DL3059
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,uid=65532,gid=65532 \
    pnpm install --frozen-lockfile --filter powercord-bot

COPY --chown=65532:65532 bot/ ./bot/

RUN pnpm --filter powercord-bot build

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS runtime

RUN rm -rf /opt/yarn-* \
    /usr/local/bin/corepack \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/lib/node_modules/corepack \
    /usr/local/lib/node_modules/npm

ENV NODE_ENV=production
WORKDIR /app/bot

COPY --from=prod-deps --chown=65532:65532 /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=65532:65532 /app/bot/node_modules ./node_modules
COPY --from=prod-deps --chown=65532:65532 /app/bot/package.json ./package.json
COPY --from=build --chown=65532:65532 /app/bot/dist ./dist

USER 65532:65532
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/node"]
CMD ["dist/index.js"]
