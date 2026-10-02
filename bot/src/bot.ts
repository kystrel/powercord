import fs from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { Client, Collection, Events } from 'discord.js';
import { discordClientOptions } from './constants/client';
import { initializeApiData } from './data/api';
import interactionCreate from './events/interactionCreate';
import ready from './events/ready';
import { errorLogFields } from './logging/fields';
import logger from './logging/logger';
import { Command } from './types/command';
import { isMockApiEnabled, validateApiConfiguration } from './utils/apiConfig';
import { setDiscordClient } from './utils/botState';
import { config } from './utils/config';
import { startHealthServer } from './utils/health';
import { startHeartbeat } from './utils/heartbeat';

export function createBot() {
    let client: Client | undefined;
    let server: Server | undefined;
    let heartbeat: ReturnType<typeof startHeartbeat>;
    let stopped = false;

    async function start() {
        logger.info({ event: 'bot.starting' }, 'bot starting');
        validateApiConfiguration();

        if (isMockApiEnabled()) {
            logger.warn(
                { event: 'api_data.mock_enabled' },
                'using development mock data for OPL commands',
            );
        } else {
            logger.info(
                { event: 'api_data.enabled' },
                'reading API data for OPL commands',
            );
        }

        server = await startHealthServer();
        if (stopped) {
            await stop();
            return;
        }
        await initializeApiData();
        if (stopped) return;
        heartbeat = startHeartbeat();

        if (!config.DISCORD_TOKEN) {
            logger.warn(
                { event: 'discord_gateway.unconfigured' },
                'DISCORD_TOKEN is not configured; skipping Discord gateway startup',
            );
            return;
        }

        client = new Client(discordClientOptions);
        setDiscordClient(client);
        client.on(Events.Error, (error) => {
            logger.error(
                { event: 'discord_gateway.error', ...errorLogFields(error) },
                'Discord gateway error',
            );
        });

        client.commands = new Collection<string, Command>();

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

        client.once(Events.ClientReady, ready.execute);
        client.on(Events.InteractionCreate, (interaction) => {
            void interactionCreate
                .execute(interaction)
                .catch((error: unknown) => {
                    logger.error(
                        {
                            event: 'bot.event_failed',
                            eventName: Events.InteractionCreate,
                            ...errorLogFields(error),
                        },
                        'bot event failed',
                    );
                });
        });

        await client.login(config.DISCORD_TOKEN);
    }

    async function stop() {
        stopped = true;
        setDiscordClient(undefined);
        if (heartbeat) clearInterval(heartbeat);
        const healthServer = server;
        const discord = client;
        server = undefined;
        client = undefined;
        await Promise.all([
            discord?.destroy(),
            healthServer &&
                new Promise<void>((resolve, reject) => {
                    healthServer.close((error) =>
                        error ? reject(error) : resolve(),
                    );
                }),
        ]);
    }

    return { start, stop };
}
