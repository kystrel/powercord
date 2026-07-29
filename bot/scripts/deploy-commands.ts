import { REST, Routes } from 'discord.js';
import { commandDefinitions } from '../src/command-definitions';
import { errorLogFields } from '../src/logging/fields';
import logger from '../src/logging/logger';
import { config } from '../src/utils/config';

interface DeployCommandsOptions {
    clientId?: string;
    discordToken?: string;
    guildId?: string;
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
        commands = commandDefinitions.map((command) => command.toJSON());
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
