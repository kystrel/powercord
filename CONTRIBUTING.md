# Contributing

Fork the repository, create a branch, and follow [Setup](README.md#-setup). The Discord bot is in `bot/`; the website is in `web/`.

## Bot development

Configure mock data or a backend as described in [Environment](README.md#environment), then run `pnpm dev:bot`. Mock mode works only in development and tests. Real API mode checks the backend's `/health` and `/api/status` before connecting to Discord.

Register commands separately from starting the bot:

```sh
pnpm --filter powercord-bot deploy:commands
```

This needs `DISCORD_TOKEN` and `CLIENT_ID` from your Discord application. Set `DISCORD_GUILD_ID` to your development server ID; leaving it empty registers commands globally. Registration does not need a backend or a running bot.

The bot serves `/live` and `/health` on port 3000. `/live` returns 200 while the HTTP listener is running; `/health` returns 200 only while Discord is ready, otherwise 503. Without a Discord token, 503 is expected. These routes belong to the bot; the backend's health route is separate. Ctrl+C stops the bot, closes its HTTP listener and clears its heartbeat timer.

## Docker

Start your API separately, then run from the repository root:

```sh
docker compose --env-file bot/.env -f bot/compose.yaml up --build -d
```

Docker with Compose is required for this setup. Set `ENABLE_MOCK_API=false`; the image runs in production mode and rejects mock mode. `API_BASE_URL` must be reachable from the container; `localhost` refers to the bot container. On Docker Desktop, `http://host.docker.internal:3001` reaches a host API. For a container API, use its name and port, connect it with `docker network connect bot_default <api-container>`, then restart the bot using the same Compose options. `bot_default` is the default network for this Compose file.

## Website development

Shared metadata and links are in `web/src/config/site.ts`; the daisyUI theme is in `web/src/styles/global.css`. Run `pnpm dev:web` for development. To build and preview the static website:

```sh
pnpm --filter powercord-web build
pnpm --filter powercord-web preview
```

Install Chromium for browser tests with `pnpm --filter powercord-web exec playwright install chromium`. On Linux, add `--with-deps` to that command to install browser system dependencies too. Vitest runs component tests and browser checks against a fresh static build, including mobile layout and accessibility. Netlify builds from the repository root and publishes `web/dist`, as configured in `netlify.toml`.

## Checks and pull requests

Add or update tests for behavior changes, including relevant failure paths, then run the checks relevant to your change:

```sh
pnpm lint
pnpm prettier
pnpm typecheck
pnpm test:bot:coverage
pnpm test:web:coverage
```

Both test suites enforce 80% coverage for lines, statements, functions and branches. `pnpm format` fixes formatting and lint issues. Run `pnpm --filter powercord-bot build` or `pnpm --filter powercord-web build` when changing the corresponding application. CI also audits dependencies and validates Docker images and workflows. Open pull requests against `master`.

For bug reports, include reproduction steps, expected and actual behavior, and relevant logs without credentials. Join the [support server](https://discord.com/invite/MZfchrRah4) for help.
