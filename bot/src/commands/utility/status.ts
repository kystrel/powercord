import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import {
    autocompleteCache,
    AutocompleteCacheStatus,
} from '../../data/autocompleteCache';
import {
    elapsedMs,
    errorLogFields,
    interactionLocation,
} from '../../logging/fields';
import logger from '../../logging/logger';

function formatAutocompleteStatus(status: AutocompleteCacheStatus): string {
    if (status.source === 'http') {
        return 'Autocomplete data: **HTTP fallback**';
    }

    const updatedAt = Date.parse(status.updatedAt);
    const updatedLabel = Number.isNaN(updatedAt)
        ? 'at an unknown time'
        : `<t:${Math.floor(updatedAt / 1000)}:R>`;
    const revision = status.revision.slice(0, 12).replaceAll('`', '');

    return (
        `Autocomplete data: **local cache**\n` +
        `Snapshot: \`${revision}\`, updated ${updatedLabel}\n` +
        `Cached names: **${status.lifterCount.toLocaleString('en-US')} lifters** and **${status.meetCount.toLocaleString('en-US')} meets**`
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription(`Returns the bot's status`),
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
            await client.guilds.fetch();
            const serverCount = client.guilds.cache.size;
            const userCount = client.users.cache.size;
            const autocompleteStatus = autocompleteCache.getStatus();

            const embed = new EmbedBuilder()
                .setColor('#c62932')
                .setAuthor({
                    name: 'Status',
                })
                .setDescription(
                    `Latency is **${latency}**ms\n\n` +
                        `Uptime: **${hours} hours** and **${minutes} minutes**\n` +
                        `I am currently in **${serverCount} servers** with **${userCount} cached users**\n\n` +
                        `${formatAutocompleteStatus(autocompleteStatus)}\n\n` +
                        `Credit to [OpenPowerlifting](https://www.openpowerlifting.org/) for data used`,
                );

            await interaction.editReply({ content: null, embeds: [embed] });
            logger.info(
                {
                    event: 'command.completed',
                    commandName: 'status',
                    outcome: 'success',
                    latency_ms: latency,
                    serverCount,
                    cachedUserCount: userCount,
                    uptimeSeconds: Math.floor(uptimeInSeconds),
                    autocompleteSource: autocompleteStatus.source,
                    ...(autocompleteStatus.source === 'local' && {
                        autocompleteRevision: autocompleteStatus.revision,
                        autocompleteUpdatedAt: autocompleteStatus.updatedAt,
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
