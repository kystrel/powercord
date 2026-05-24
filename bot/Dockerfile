# syntax=docker/dockerfile:1

ARG CHAINGUARD_REGISTRY=cgr.dev/chainguard
ARG NODE_VERSION=latest
ARG PNPM_VERSION=11.1.2

FROM ${CHAINGUARD_REGISTRY}/node:${NODE_VERSION}-dev AS pnpm

USER root
ARG PNPM_VERSION

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm install --global "pnpm@${PNPM_VERSION}" \
    && mkdir -p /app /pnpm/store \
    && chown -R 65532:65532 /app /pnpm

USER 65532

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

FROM ${CHAINGUARD_REGISTRY}/node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production
WORKDIR /app/bot

COPY --from=prod-deps --chown=65532:65532 /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=65532:65532 /app/bot/node_modules ./node_modules
COPY --from=prod-deps --chown=65532:65532 /app/bot/package.json ./package.json
COPY --from=build --chown=65532:65532 /app/bot/dist ./dist

USER 65532
EXPOSE 3000
ENTRYPOINT ["/usr/bin/node"]
CMD ["dist/index.js"]
