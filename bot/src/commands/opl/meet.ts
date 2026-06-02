import {
    ActionRowBuilder,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import { getEmbedColor, getEmbedFooter } from '../../constants/embed';
import { api } from '../../data/api';
import {
    elapsedMs,
    errorLogFields,
    interactionLocation,
} from '../../logging/fields';
import logger from '../../logging/logger';
import { Meet } from '../../types/types';

const OPL_MEET_PATH_PATTERN =
    /^[A-Za-z0-9][A-Za-z0-9._~-]*(\/[A-Za-z0-9][A-Za-z0-9._~-]*)+$/;

async function fetchMeet(name: string): Promise<Meet | undefined> {
    return api.getMeet(name);
}

function getOpenPowerliftingMeetUrl(url: string | null | undefined) {
    if (!url) return undefined;

    try {
        const parsed = new URL(url);
        const pathSegments = parsed.pathname.split('/').filter(Boolean);
        if (
            parsed.protocol !== 'https:' ||
            parsed.hostname !== 'www.openpowerlifting.org' ||
            parsed.port ||
            parsed.search ||
            parsed.hash ||
            pathSegments[0] !== 'm' ||
            !OPL_MEET_PATH_PATTERN.test(pathSegments.slice(1).join('/'))
        ) {
            return undefined;
        }

        return parsed.toString();
    } catch {
        return undefined;
    }
}

function escapeMarkdownText(value: string) {
    return value.replace(/([\\`*_{}\[\]()#+\-.!|>~])/g, '\\$1');
}

function formatMeetName(name: string, url: string | undefined) {
    const escapedName = escapeMarkdownText(name);
    return url ? `[**${escapedName}**](${url})` : `**${escapedName}**`;
}

function compareDots(a: Meet['entries'][0], b: Meet['entries'][0]): number {
    if (!a.dots && !b.dots) return 0;
    if (!a.dots) return 1;
    if (!b.dots) return -1;
    return b.dots - a.dots;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('meet')
        .setDescription(`Displays meet's top lifters with pagination`)
        .addStringOption((option) =>
            option
                .setName('name')
                .setDescription('Name of the meet')
                .setRequired(true)
                .setAutocomplete(true),
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        const startedAt = Date.now();
        const logContext = interactionLocation(interaction);
        let input: string | undefined;

        try {
            await interaction.deferReply();

            const name = interaction.options.getString('name');
            input = name ?? undefined;
            if (!name) {
                await interaction.editReply('You need to specify a meet.');
                logger.info(
                    {
                        event: 'command.completed',
                        commandName: 'meet',
                        outcome: 'missing_input',
                        ...logContext,
                        duration_ms: elapsedMs(startedAt),
                    },
                    'command completed',
                );
                return;
            }

            const meet: Meet | undefined = await fetchMeet(name);

            if (!meet || meet.entries.length === 0) {
                await interaction.editReply(`No data found for meet: ${name}.`);
                logger.info(
                    {
                        event: 'command.completed',
                        commandName: 'meet',
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

            const entries = meet.entries.sort(compareDots);
            const meetUrl = getOpenPowerliftingMeetUrl(meet.url);
            const meetName = formatMeetName(meet.name, meetUrl);

            const embed = new EmbedBuilder()
                .setColor(getEmbedColor())
                .setTitle('🥇 Powerlifting Rankings')
                .setFooter({ text: getEmbedFooter() });

            if (meetUrl) {
                embed.setURL(meetUrl);
            }

            const pageSize = 5;
            const maxPages = Math.ceil(entries.length / pageSize);
            let currentPage = 1;

            const updateFields = (page: number) => {
                const offset = (page - 1) * pageSize;
                const pageEntries = entries.slice(offset, offset + pageSize);
                const fields = pageEntries.flatMap((entry, index) => [
                    {
                        name: `\`${offset + index + 1}.\` ${entry.name}`,
                        value: `Squat: ${entry.squat ?? '—'} | Bench: ${entry.bench ?? '—'} | Deadlift: ${entry.deadlift ?? '—'}`,
                        inline: true,
                    },
                    {
                        name: `\u200B`,
                        value: `Total: ${entry.total ?? '—'} | Dots: ${entry.dots != null ? entry.dots.toFixed(2) : '—'}`,
                        inline: true,
                    },
                    {
                        name: `\u200B`,
                        value: `\u200B`,
                        inline: true,
                    },
                ]);
                embed.setFields(fields);
                embed.setDescription(
                    `Top lifters for ${meetName}, page ${page}`,
                );
            };

            updateFields(1);

            const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('◀')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('▶')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(maxPages <= 1),
            );

            await interaction.editReply({
                embeds: [embed],
                components: [buttons],
            });

            const message = await interaction.fetchReply();

            const collector = message.createMessageComponentCollector({
                filter: (i) => i.user.id === interaction.user.id,
                time: 60000,
            });

            collector.on('collect', async (i) => {
                const paginationStartedAt = Date.now();
                const previousPage = currentPage;
                let targetPage = currentPage;

                try {
                    if (i.customId === 'prev' && currentPage > 1) {
                        targetPage = currentPage - 1;
                    } else if (
                        i.customId === 'next' &&
                        currentPage < maxPages
                    ) {
                        targetPage = currentPage + 1;
                    } else {
                        return;
                    }

                    updateFields(targetPage);
                    buttons.components[0].setDisabled(targetPage === 1);
                    buttons.components[1].setDisabled(targetPage === maxPages);

                    await i.update({ embeds: [embed], components: [buttons] });
                    currentPage = targetPage;
                    logger.info(
                        {
                            event: 'pagination.changed',
                            commandName: 'meet',
                            action: i.customId,
                            input: name,
                            previousPage,
                            page: targetPage,
                            pageCount: maxPages,
                            entryCount: entries.length,
                            ...logContext,
                            duration_ms: elapsedMs(paginationStartedAt),
                        },
                        'pagination changed',
                    );
                } catch (error) {
                    logger.error(
                        {
                            event: 'pagination.failed',
                            commandName: 'meet',
                            action: i.customId,
                            input: name,
                            previousPage,
                            page: targetPage,
                            pageCount: maxPages,
                            entryCount: entries.length,
                            ...logContext,
                            duration_ms: elapsedMs(paginationStartedAt),
                            ...errorLogFields(error),
                        },
                        'pagination failed',
                    );
                }
            });

            collector.on('end', async () => {
                const paginationStartedAt = Date.now();

                try {
                    buttons.components.forEach((button) =>
                        button.setDisabled(true),
                    );
                    await interaction.editReply({ components: [buttons] });
                    logger.info(
                        {
                            event: 'pagination.ended',
                            commandName: 'meet',
                            input: name,
                            page: currentPage,
                            pageCount: maxPages,
                            entryCount: entries.length,
                            ...logContext,
                            duration_ms: elapsedMs(paginationStartedAt),
                        },
                        'pagination ended',
                    );
                } catch (error) {
                    logger.error(
                        {
                            event: 'pagination.disable_failed',
                            commandName: 'meet',
                            input: name,
                            page: currentPage,
                            pageCount: maxPages,
                            entryCount: entries.length,
                            ...logContext,
                            duration_ms: elapsedMs(paginationStartedAt),
                            ...errorLogFields(error),
                        },
                        'pagination disable failed',
                    );
                }
            });

            logger.info(
                {
                    event: 'command.completed',
                    commandName: 'meet',
                    outcome: 'success',
                    input: name,
                    found: true,
                    entryCount: entries.length,
                    pageCount: maxPages,
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                },
                'command completed',
            );
        } catch (error) {
            logger.error(
                {
                    event: 'command.failed',
                    commandName: 'meet',
                    input,
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                    ...errorLogFields(error),
                },
                'command failed',
            );
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: 'An error occurred while fetching the meet data.',
                });
            } else {
                await interaction.reply({
                    content: 'An error occurred while fetching the meet data.',
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
                        commandName: 'meet',
                        autocompleteKind: 'meet',
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

            const meetNames = await api.getMeetAutocomplete(focusedValue, 25);

            if (!meetNames) {
                await interaction.respond([]);
                logger.info(
                    {
                        event: 'autocomplete.completed',
                        commandName: 'meet',
                        autocompleteKind: 'meet',
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

            const choices = meetNames.map((name: string) => ({
                name: name,
                value: name,
            }));

            await interaction.respond(choices);
            logger.info(
                {
                    event: 'autocomplete.completed',
                    commandName: 'meet',
                    autocompleteKind: 'meet',
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
                    commandName: 'meet',
                    autocompleteKind: 'meet',
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
