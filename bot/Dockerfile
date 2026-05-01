# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.2.0
ARG PNPM_VERSION

FROM node:${NODE_VERSION}-alpine

ARG PNPM_VERSION

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY bot/package.json ./bot/package.json
COPY web/package.json ./web/package.json

# hadolint ignore=DL3059
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter powercord-bot

COPY bot/ ./bot/

ENV NODE_ENV=production
WORKDIR /app/bot
USER node
EXPOSE 3000
CMD ["pnpm", "start"]
