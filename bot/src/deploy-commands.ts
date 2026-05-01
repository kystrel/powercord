import { REST, Routes } from 'discord.js';
import { config } from './utils/config';
import logger from './utils/logger';

const fs = require('node:fs');
const path = require('node:path');

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
                    `The command at ${filePath} is missing a required "data" or "execute" property.`,
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
            'CLIENT_ID or DISCORD_TOKEN is not configured; skipping Discord command registration.',
        );
        return;
    }

    const commands = loadCommandPayloads();
    const rest = new REST().setToken(discordToken);
    try {
        logger.info(
            `Started refreshing ${commands.length} application (/) commands.`,
        );

        // Register slash commands globally
        const data = (await rest.put(Routes.applicationCommands(clientId), {
            body: commands,
        })) as unknown[];

        logger.info(
            `Successfully reloaded ${data.length} application (/) commands.`,
        );
    } catch (error) {
        logger.error('Error refreshing commands: ', error);
    }
}

if (require.main === module) {
    void deployCommands();
}
