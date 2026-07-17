import fs from 'node:fs';
import path from 'node:path';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { startApiDataRefresh } from './data/api';
import { deployCommands } from './deploy-commands';
import logger from './logging/logger';
import { Command } from './types/command';
import { isMockApiEnabled, validateApiConfiguration } from './utils/apiConfig';
import { setDiscordClient } from './utils/botState';
import { config } from './utils/config';
import './utils/health';
import { startHeartbeat } from './utils/heartbeat';
import { exitOnStartupFailure } from './utils/startup';

logger.info({ event: 'bot.starting' }, 'bot starting');

async function initializeBot() {
    validateApiConfiguration();

    if (isMockApiEnabled()) {
        logger.warn(
            { event: 'api_data.mock_enabled' },
            'using development mock data for OPL commands',
        );
    } else {
        logger.info(
            { event: 'api_data.enabled' },
            'retrieving API data for OPL commands',
        );
    }

    startHeartbeat();
    startApiDataRefresh();

    await deployCommands();

    if (!config.DISCORD_TOKEN) {
        logger.warn(
            { event: 'discord_gateway.unconfigured' },
            'DISCORD_TOKEN is not configured; skipping Discord gateway startup',
        );
        return;
    }

    const client = new Client({
        intents: [GatewayIntentBits.Guilds],
    });
    setDiscordClient(client);

    client.commands = new Collection<string, Command>();

    // Load commands
    const foldersPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(foldersPath);
    const runtimeExtension = path.extname(__filename);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs
            .readdirSync(commandsPath)
            .filter((file: string) => file.endsWith(runtimeExtension));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            } else {
                logger.warn(
                    {
                        event: 'bot.invalid_command_file',
                        filePath,
                    },
                    'command file missing required exports',
                );
            }
        }
    }

    // Load events
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file: string) => file.endsWith(runtimeExtension));
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath).default;
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }

    await client.login(config.DISCORD_TOKEN);
}

void initializeBot().catch(exitOnStartupFailure);
