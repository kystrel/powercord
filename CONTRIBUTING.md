# Contributing

Fork the repository, create a branch, and follow [Setup](README.md#-setup). The Discord bot is in `bot/`; the website is in `web/`.

## Bot development

Set `ENABLE_MOCK_API=true` in `bot/.env` to use fixtures with `pnpm dev:bot`. Mock mode works only in development and tests. To use a backend, set it to `false` and provide `API_BASE_URL`; see [Data API](docs/API.md).

Register commands separately from starting the bot:

```sh
pnpm --filter powercord-bot deploy:commands
```

This needs `DISCORD_TOKEN` and `CLIENT_ID`. Set `DISCORD_GUILD_ID` for a development server; omit it for global registration. Gateway startup needs `DISCORD_TOKEN` to connect to Discord. `/live` on port 3000 checks the process; `/health` returns 200 only while Discord is ready.

## Docker

Start your API separately, then run from the repository root:

```sh
docker compose --env-file bot/.env -f bot/compose.yaml up --build -d
```

Set `ENABLE_MOCK_API=false`; the image runs in production mode. `API_BASE_URL` must be reachable from the container. On Docker Desktop, `http://host.docker.internal:3001` reaches a host API. For a container API, use its name and port, connect it with `docker network connect bot_default <api-container>`, then restart the bot using the same Compose options. `bot_default` is the default network for this Compose file.

## Website development

The Astro website uses `web/src/pages`, `components`, `layouts`, `assets`, and `styles`. Shared metadata and links are in `web/src/config/site.ts`; the daisyUI theme is in `web/src/styles/global.css`. Run `pnpm dev:web` for development or `pnpm --filter powercord-web preview` after a build.

Install Chromium once with `pnpm --filter powercord-web exec playwright install chromium`. Vitest runs component tests and browser checks against a fresh static build. Netlify uses the root `netlify.toml`; keep the base directory at the repository root and publish `web/dist`. Connect the site and configure the existing custom domain in Netlify before switching hosting.

## Checks and pull requests

Add or update tests for behavior changes, then run the checks relevant to your change:

```sh
pnpm lint
pnpm prettier
pnpm typecheck
pnpm test:bot
pnpm test:web
```

`pnpm format` fixes formatting and lint issues. Run `pnpm --filter powercord-bot build` or `pnpm --filter powercord-web build` when changing the corresponding application. Open a pull request.

For bug reports, include reproduction steps, expected and actual behavior, and relevant logs without credentials. Join the [support server](https://discord.com/invite/MZfchrRah4) for help.
