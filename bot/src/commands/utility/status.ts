import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { statusCommandDefinition } from '../../command-definitions';
import { getDataStatus } from '../../data/api';
import {
    elapsedMs,
    errorLogFields,
    interactionLocation,
} from '../../logging/fields';
import logger from '../../logging/logger';
import { enforceEmbedLimits } from '../../utils/discord';

function formatDataStatus(status: ReturnType<typeof getDataStatus>): string {
    if (!status) return 'Data: **development mock**';

    const loadedLabel = `<t:${Math.floor(Date.parse(status.loadedAt) / 1000)}:R>`;
    const revision = status.revision.slice(0, 12).replaceAll('`', '');

    return (
        `Data: **local SQLite**\n` +
        `Snapshot: \`${revision}\`, loaded ${loadedLabel}\n` +
        `Cached names: **${status.lifterCount.toLocaleString('en-US')} lifters** and **${status.meetCount.toLocaleString('en-US')} meets**`
    );
}

module.exports = {
    data: statusCommandDefinition,
    async execute(interaction: ChatInputCommandInteraction) {
        const startedAt = Date.now();
        const logContext = interactionLocation(interaction);

        try {
            const sent = await interaction.reply({
                content: 'Pong!',
                fetchReply: true,
            });
            const latency =
                sent.createdTimestamp - interaction.createdTimestamp;

            const uptimeInSeconds = process.uptime();
            const hours = Math.floor(uptimeInSeconds / 3600);
            const minutes = Math.floor((uptimeInSeconds % 3600) / 60);

            const client = interaction.client;
            const serverCount = client.guilds.cache.size;
            const userCount = client.users.cache.size;
            const dataStatus = getDataStatus();

            const embed = new EmbedBuilder()
                .setColor('#c62932')
                .setAuthor({
                    name: 'Status',
                })
                .setDescription(
                    `Latency is **${latency}**ms\n\n` +
                        `Uptime: **${hours} hours** and **${minutes} minutes**\n` +
                        `I currently have **${serverCount} cached servers** and **${userCount} cached users**\n\n` +
                        `${formatDataStatus(dataStatus)}\n\n` +
                        `Credit to [OpenPowerlifting](https://www.openpowerlifting.org/) for data used`,
                );
            enforceEmbedLimits(embed);

            await interaction.editReply({ content: null, embeds: [embed] });
            logger.info(
                {
                    event: 'command.completed',
                    commandName: 'status',
                    outcome: 'success',
                    latency_ms: latency,
                    cachedServerCount: serverCount,
                    cachedUserCount: userCount,
                    uptimeSeconds: Math.floor(uptimeInSeconds),
                    dataSource: dataStatus ? 'sqlite' : 'mock',
                    ...(dataStatus && {
                        dataRevision: dataStatus.revision,
                    }),
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                },
                'command completed',
            );
        } catch (error) {
            logger.error(
                {
                    event: 'command.failed',
                    commandName: 'status',
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                    ...errorLogFields(error),
                },
                'command failed',
            );
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: 'An error occurred while fetching the status.',
                });
            } else {
                await interaction.reply({
                    content: 'An error occurred while fetching the status.',
                    ephemeral: true,
                });
            }
        }
    },
};
