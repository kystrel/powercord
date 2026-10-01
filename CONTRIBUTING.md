# Contributing

Thank you for taking the time to look to contribute to PowerCord. Below are some additional instructions on setting up the project in a way that allows for code contributions, as well as information on reporting bugs and making suggestions.

## Getting Started

To get started with repo setup, follow these steps:

1. **Fork the Repository**: Fork into your own GitHub account.

2. **Clone Your Fork**: Clone to work locally or use the web editor in your new fork.

3. **Run Project**: Follow setup instructions in [README](README.md).

## Bot Setup

After setting up `bot/.env` and Discord as described in the README, choose how to provide data:

### Mock Data

Set `ENABLE_MOCK_API=true` in `bot/.env`, then run `pnpm dev:bot` from the repo root. This uses local fixtures without a backend. Mock mode only works in development and tests.

### Your Own API

Set `ENABLE_MOCK_API=false` and point `API_BASE_URL` at your backend. See the [Data API docs](docs/API.md) for the routes and response types it needs to provide. Run `pnpm dev:bot` from the repo root.

### Docker

The Compose file runs only the bot, so start your API separately. Set `ENABLE_MOCK_API=false`; the Docker image runs in production mode.

`API_BASE_URL` must be reachable from the bot container. `localhost` points at the container itself. With Docker Desktop, use `http://host.docker.internal:3001` for an API running on your host at port 3001. For an API in another container, put both containers on the same Docker network and use the API's container name and port.

Run from the repo root:

```bash
docker compose --env-file bot/.env -f bot/compose.yaml up --build -d
```

## Project Structure

This repo contains the contents for both the Discord bot and its website.

- `/`: Root directory that contains many helpful pnpm commands for formatting, tests, and running both applications in a dev environment.
- `/bot`: Source code for the bot and all utilities it needs.
- `/web`: Source code for the website.

## How to Contribute

### Reporting Bugs

If you encounter a bug or have a feature request, you can open a new issue. To be able to quickly assist in fixing it, please include as much detail as possible:

- Steps to reproduce the issue
- Expected and actual behavior
- Screenshots if available

### Code Contributions

1. **Branching**: Create a new branch for your work.

2. **Follow Code Style**: Prettier and ESLint is configured for this project. Run the following from root to quickly format all your changes made.

    ```bash
    pnpm run format
    ```

3. **Run Tests**: Writing new tests is not required/expected. Run existing tests to ensure existing features have not been impacted.

    ```bash
    pnpm run test:bot
    pnpm run test:web
    ```

4. **Open a Merge Request (MR)**: Provide info on your changes and feel free to reference any related issues.

## Contact

For questions or assistance, feel free to open an issue or join the discussion on any existing issues.
