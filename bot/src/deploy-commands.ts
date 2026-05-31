import fs from 'node:fs';
import path from 'node:path';
import { REST, Routes } from 'discord.js';
import { errorLogFields } from './logging/fields';
import logger from './logging/logger';
import { config } from './utils/config';

interface DeployCommandsOptions {
    clientId?: string;
    discordToken?: string;
}

function loadCommandPayloads(): unknown[] {
    const commands: unknown[] = [];
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
                commands.push(command.data.toJSON());
            } else {
                logger.warn(
                    {
                        event: 'discord_commands.invalid_command_file',
                        filePath,
                    },
                    'command file missing required exports',
                );
            }
        }
    }

    return commands;
}

export async function deployCommands({
    clientId = config.CLIENT_ID,
    discordToken = config.DISCORD_TOKEN,
}: DeployCommandsOptions = {}): Promise<void> {
    if (!clientId || !discordToken) {
        logger.warn(
            { event: 'discord_commands.unconfigured' },
            'CLIENT_ID or DISCORD_TOKEN is not configured; skipping Discord command registration',
        );
        return;
    }

    const commands = loadCommandPayloads();
    const rest = new REST().setToken(discordToken);
    try {
        logger.info(
            {
                event: 'discord_commands.refresh_started',
                commandCount: commands.length,
            },
            'started refreshing application commands',
        );

        // Register slash commands globally
        const data = (await rest.put(Routes.applicationCommands(clientId), {
            body: commands,
        })) as unknown[];

        logger.info(
            {
                event: 'discord_commands.refresh_completed',
                commandCount: data.length,
            },
            'successfully refreshed application commands',
        );
    } catch (error) {
        logger.error(
            {
                event: 'discord_commands.refresh_failed',
                commandCount: commands.length,
                ...errorLogFields(error),
            },
            'failed to refresh application commands',
        );
    }
}

if (require.main === module) {
    void deployCommands();
}
