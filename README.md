<div class="title-block" style="text-align: center;" align="center">

<p>
    <img width="300" height="300" alt="PowerCord logo" src=".github/assets/powercord.png">
    <h1 align="center">PowerCord — OpenPowerlifting in Discord</h1>
</p>

[![CI Status](https://github.com/kystrel/powercord/actions/workflows/ci.yml/badge.svg)](https://github.com/kystrel/powercord/actions/workflows/ci.yml)
[![Web Deployment Status](https://vercelbadge.vercel.app/api/kystrel/powercord)](https://powercord-gilt.vercel.app/)
[![Codecov Coverage](https://codecov.io/gh/kystrel/powercord/graph/badge.svg?token=04DYKZJMH3)](https://codecov.io/gh/kystrel/powercord)
[![Discord JS](https://img.shields.io/badge/discord.js-14.23.x-orange.svg)](https://discord.js.org/)
[![Code style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4)](https://github.com/prettier/prettier)

<!-- [![Invite to Discord Server](https://img.shields.io/badge/discord-invite%20to%20server-5865F2?logo=discord&logoColor=white)](https://discord.com/api/oauth2/authorize?client_id=1306740469484486697&permissions=0&scope=bot%20applications.commands) -->
<!-- [![Open Trello board](https://img.shields.io/badge/trello-open_roadmap-026AA7?logo=Trello&logoColor=white)](https://trello.com/b/pm9X3ZfI) -->

**[Add to Discord] &nbsp;&nbsp;&bull;&nbsp;&nbsp;**
**[Support Server] &nbsp;&nbsp;&bull;&nbsp;&nbsp;**
**[Roadmap]**

[Add to Discord]: https://discord.com/oauth2/authorize?client_id=1306740469484486697&permissions=0&scope=bot%20applications.commands
[Support Server]: https://discord.com/invite/MZfchrRah4
[Roadmap]: https://trello.com/b/pm9X3ZfI

[![Better Stack Uptime Monitor](https://uptime.betterstack.com/status-badges/v3/monitor/26gjw.svg)](https://status.powercord.gg/)

</div>

> [!IMPORTANT]
> Migration complete and services back online. Database contains incomplete entries until refactor is finished.
>
> _- Jan 1 '26_

## 🚀 Setup

Project requires [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/installation) to run. After installing Node, it is recommended to use [NVM](https://github.com/nvm-sh/nvm) ([installation guide](https://www.freecodecamp.org/news/node-version-manager-nvm-install-guide/)) to manage Node versions. To set the Node version used by the project, run `nvm use` from root and follow the prompts, especially if that version has not been installed yet.

No other system level dependencies are needed.

### Environment

This project uses [dotenv](https://github.com/motdotla/dotenv#readme) to manage environment-specific settings. Rename the `.env.example` file in the `bot` directory to `.env` and enter in the necessary values listed inside the file. If you do not have a token yet, check out [this guide](https://discordjs.guide/preparations/setting-up-a-bot-application.html).

> [!WARNING]
> Keep the Discord token to yourself at all costs.

When `STATIC_BUCKET` is configured, the bot loads PowerCord Data autocomplete
blobs from S3 into memory and answers Discord autocomplete locally. If the cache
is not ready or a refresh fails before any cache is loaded, the bot falls back to
the public HTTP autocomplete API configured by `API_BASE_URL`.

The bot exposes `GET /live` for process liveness and `GET /health` for readiness.
Readiness returns `200` only while the Discord client is connected and ready;
otherwise it returns `503`. Better Stack heartbeats follow the same readiness
signal so startup or gateway failures are not reported as healthy.

### Project

In the root directory of the project enter the following commands. This will install all dependencies and begin the dev instance.

```sh
pnpm install
pnpm dev
```

To run the Discord bot or web client individually, run from the root:

```sh
pnpm dev:bot
pnpm dev:web
```

## 🌱 Contribute

[See contributing guide](CONTRIBUTING.md).
