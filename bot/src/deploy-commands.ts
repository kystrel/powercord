import fs from 'node:fs';
import path from 'node:path';
import { REST, Routes } from 'discord.js';
import { errorLogFields } from './logging/fields';
import logger from './logging/logger';
import { config } from './utils/config';

interface DeployCommandsOptions {
    clientId?: string;
    discordToken?: string;
    guildId?: string;
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
    guildId = config.DISCORD_GUILD_ID,
}: DeployCommandsOptions = {}): Promise<void> {
    if (!clientId || !discordToken) {
        const missingConfiguration = [
            !clientId && 'CLIENT_ID',
            !discordToken && 'DISCORD_TOKEN',
        ].filter((value): value is string => Boolean(value));
        const error = new Error(
            `Missing required Discord command deployment configuration: ${missingConfiguration.join(', ')}`,
        );
        logger.error(
            {
                event: 'discord_commands.configuration_invalid',
                missingConfiguration,
                ...errorLogFields(error),
            },
            'discord command deployment configuration is invalid',
        );
        throw error;
    }

    const scope = guildId ? 'guild' : 'global';
    let commands: unknown[] = [];
    try {
        commands = loadCommandPayloads();
        const rest = new REST().setToken(discordToken);

        logger.info(
            {
                event: 'discord_commands.refresh_started',
                commandCount: commands.length,
                scope,
            },
            'started refreshing application commands',
        );

        const route = guildId
            ? Routes.applicationGuildCommands(clientId, guildId)
            : Routes.applicationCommands(clientId);
        const data = (await rest.put(route, { body: commands })) as unknown[];

        logger.info(
            {
                event: 'discord_commands.refresh_completed',
                commandCount: data.length,
                scope,
            },
            'successfully refreshed application commands',
        );
    } catch (error) {
        logger.error(
            {
                event: 'discord_commands.refresh_failed',
                commandCount: commands.length,
                scope,
                ...errorLogFields(error),
            },
            'failed to refresh application commands',
        );
        throw error;
    }
}

export async function runCommandDeployment(): Promise<void> {
    try {
        await deployCommands();
    } catch {
        process.exitCode = 1;
    }
}

if (require.main === module) {
    void runCommandDeployment();
}
