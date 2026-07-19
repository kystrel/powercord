import {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { lifterCommandDefinition } from '../../command-definitions';
import { getEmbedColor, getEmbedFooter } from '../../constants/embed';
import { api } from '../../data/api';
import {
    elapsedMs,
    errorLogFields,
    interactionLocation,
} from '../../logging/fields';
import logger from '../../logging/logger';
import { Lifter } from '../../types/types';
import {
    DISCORD_LIMITS,
    enforceEmbedLimits,
    escapeDiscordMarkdown,
    formatDiscordCodeBlock,
    sanitizeDiscordText,
    truncateDiscordText,
} from '../../utils/discord';

async function fetchLifter(name: string): Promise<Lifter | undefined> {
    return api.getLifter(name);
}

function formatPlacement(place: number): string {
    const absolutePlace = Math.abs(place);
    const lastTwoDigits = absolutePlace % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
        return `${place}th`;
    }

    const suffix =
        absolutePlace % 10 === 1
            ? 'st'
            : absolutePlace % 10 === 2
              ? 'nd'
              : absolutePlace % 10 === 3
                ? 'rd'
                : 'th';

    return `${place}${suffix}`;
}

module.exports = {
    data: lifterCommandDefinition,
    async execute(interaction: ChatInputCommandInteraction) {
        const startedAt = Date.now();
        const logContext = interactionLocation(interaction);
        let input: string | undefined;

        try {
            await interaction.deferReply();

            const name = interaction.options.getString('name');
            input = name ?? undefined;
            if (!name) {
                await interaction.editReply(
                    'You need to specify a lifter name.',
                );
                logger.info(
                    {
                        event: 'command.completed',
                        commandName: 'lifter',
                        outcome: 'missing_input',
                        ...logContext,
                        duration_ms: elapsedMs(startedAt),
                    },
                    'command completed',
                );
                return;
            }

            const lifter: Lifter | undefined = await fetchLifter(name);

            if (!lifter || lifter.meets.length === 0) {
                const notFoundMessage = truncateDiscordText(
                    `No data found for lifter: ${escapeDiscordMarkdown(name)}.`,
                    DISCORD_LIMITS.message,
                );
                await interaction.editReply(notFoundMessage);
                logger.info(
                    {
                        event: 'command.completed',
                        commandName: 'lifter',
                        outcome: 'not_found',
                        input: name,
                        found: false,
                        ...logContext,
                        duration_ms: elapsedMs(startedAt),
                    },
                    'command completed',
                );
                return;
            }

            const embed = new EmbedBuilder()
                .setColor(getEmbedColor())
                .setTitle(
                    sanitizeDiscordText(
                        lifter.name,
                        DISCORD_LIMITS.embed.title,
                    ),
                )
                .setFooter({ text: getEmbedFooter() });

            if (lifter.personalBests && lifter.personalBests.length > 0) {
                const heading = '**Personal Bests**\n';
                let remaining =
                    DISCORD_LIMITS.embed.description - heading.length;
                const personalBestBlocks: string[] = [];

                for (const pb of lifter.personalBests) {
                    if (remaining <= 6) break;
                    const block = formatDiscordCodeBlock(
                        `Equipment: ${pb.equipment}\nS: ${pb.squat ?? ''} B: ${pb.bench ?? ''} D: ${pb.deadlift ?? ''} Total: ${pb.total} DOTS: ${pb.dots}`,
                        remaining,
                    );
                    personalBestBlocks.push(block);
                    remaining -= block.length;
                }

                embed.setDescription(
                    `${heading}${personalBestBlocks.join('')}`,
                );
            }

            if (lifter.url) {
                embed.setURL(lifter.url);
            }

            const fields = lifter.meets.slice(0, 3).flatMap((meet, index) => [
                {
                    name: truncateDiscordText(
                        `\`${index + 1}.\` ${escapeDiscordMarkdown(meet.federation)} ${escapeDiscordMarkdown(meet.name)}`,
                        DISCORD_LIMITS.embed.fieldName,
                    ),
                    value: truncateDiscordText(
                        `
                    ${formatPlacement(meet.place)} Place${meet.state ? `, ${escapeDiscordMarkdown(meet.state)}` : ''}
                    Date: ${escapeDiscordMarkdown(meet.date)}
                    Age: ${meet.age ?? '—'}
                    Equip: ${escapeDiscordMarkdown(meet.equipment)}
                    Class: ${meet.weightClass ?? '—'}
                    Weight: ${meet.bodyWeight ?? '—'}`,
                        DISCORD_LIMITS.embed.fieldValue,
                    ),
                    inline: true,
                },
                {
                    name: `\u200B`,
                    value: formatDiscordCodeBlock(
                        `Squat: ${meet.squat ?? '—'}\nBench: ${meet.bench ?? '—'}\nDead: ${meet.deadlift ?? '—'}\n\nTotal: ${meet.total ?? '—'}\nDOTS: ${meet.dots ?? '—'}`,
                        DISCORD_LIMITS.embed.fieldValue,
                    ),
                    inline: true,
                },
                {
                    name: `\u200B`,
                    value: `\u200B`,
                    inline: true,
                },
            ]);

            embed.addFields(fields);
            enforceEmbedLimits(embed);

            await interaction.editReply({ embeds: [embed] });
            logger.info(
                {
                    event: 'command.completed',
                    commandName: 'lifter',
                    outcome: 'success',
                    input: name,
                    found: true,
                    meetCount: lifter.meets.length,
                    personalBestCount: lifter.personalBests?.length ?? 0,
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                },
                'command completed',
            );
        } catch (error) {
            logger.error(
                {
                    event: 'command.failed',
                    commandName: 'lifter',
                    input,
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                    ...errorLogFields(error),
                },
                'command failed',
            );
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content:
                        'An error occurred while fetching the lifter data.',
                });
            } else {
                await interaction.reply({
                    content:
                        'An error occurred while fetching the lifter data.',
                    ephemeral: true,
                });
            }
        }
    },
    async autocomplete(interaction: AutocompleteInteraction) {
        const startedAt = Date.now();
        const logContext = interactionLocation(interaction);
        let query = '';

        try {
            const focusedValue = String(interaction.options.getFocused());
            query = focusedValue;

            if (!focusedValue || focusedValue.length < 2) {
                await interaction.respond([]);
                logger.info(
                    {
                        event: 'autocomplete.completed',
                        commandName: 'lifter',
                        autocompleteKind: 'lifter',
                        outcome: 'skipped',
                        query,
                        queryLength: query.length,
                        resultCount: 0,
                        ...logContext,
                        duration_ms: elapsedMs(startedAt),
                    },
                    'autocomplete completed',
                );
                return;
            }

            const lifterNames = await api.getLifterAutocomplete(
                focusedValue,
                10,
            );

            if (!lifterNames) {
                await interaction.respond([]);
                logger.info(
                    {
                        event: 'autocomplete.completed',
                        commandName: 'lifter',
                        autocompleteKind: 'lifter',
                        outcome: 'empty',
                        query,
                        queryLength: query.length,
                        resultCount: 0,
                        ...logContext,
                        duration_ms: elapsedMs(startedAt),
                    },
                    'autocomplete completed',
                );
                return;
            }

            const choices = lifterNames.map((name: string) => ({
                name: name,
                value: name,
            }));

            await interaction.respond(choices);
            logger.info(
                {
                    event: 'autocomplete.completed',
                    commandName: 'lifter',
                    autocompleteKind: 'lifter',
                    outcome: 'success',
                    query,
                    queryLength: query.length,
                    resultCount: choices.length,
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                },
                'autocomplete completed',
            );
        } catch (error) {
            logger.error(
                {
                    event: 'autocomplete.failed',
                    commandName: 'lifter',
                    autocompleteKind: 'lifter',
                    query,
                    queryLength: query.length,
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                    ...errorLogFields(error),
                },
                'autocomplete failed',
            );
            await interaction.respond([]);
        }
    },
};
