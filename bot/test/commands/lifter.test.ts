import { beforeEach, describe, expect, it, vi } from 'vitest';
import lifterCommand from '../../src/commands/opl/lifter';
import logger from '../../src/logging/logger';
import {
    createAutocompleteInteraction,
    createChatInputInteraction,
} from '../helpers/interactions';

const { mockGetLifter, mockGetLifterAutocomplete } = vi.hoisted(() => ({
    mockGetLifter: vi.fn(),
    mockGetLifterAutocomplete: vi.fn(),
}));

vi.mock('../../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('discord.js');

vi.mock('../../src/data/api', () => ({
    api: {
        getLifter: mockGetLifter,
        getLifterAutocomplete: mockGetLifterAutocomplete,
    },
}));

const mockLifter = {
    name: 'Heracles',
    url: 'https://www.openpowerlifting.org/u/heracles',
    meets: [
        {
            place: 1,
            federation: 'IPF',
            date: '2025-06-15',
            country: 'Greece',
            state: 'Attica',
            name: 'Labors of Strength',
            division: 'Open',
            age: 39,
            equipment: 'Raw',
            weightClass: 100,
            bodyWeight: 98.6,
            squat: 1018,
            bench: 758,
            deadlift: 729,
            total: 2505,
            dots: 1551.41,
        },
    ],
    personalBests: [
        {
            equipment: 'Raw',
            squat: '1018',
            bench: '758',
            deadlift: '729',
            total: '2505',
            dots: '1551.41',
        },
    ],
};

describe('Lifter command', () => {
    const execute = lifterCommand['execute'];
    const autocomplete = lifterCommand['autocomplete'];

    beforeEach(() => {
        mockGetLifter.mockReset();
        mockGetLifterAutocomplete.mockReset();
        vi.mocked(logger.info).mockClear();
        vi.mocked(logger.error).mockClear();
    });

    describe('execute', () => {
        it('generates an embed with lifter data', async () => {
            mockGetLifter.mockResolvedValue(mockLifter);
            const interaction = createChatInputInteraction({
                name: 'Heracles',
            });
            await execute(interaction);

            expect(interaction.deferReply).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: [
                        expect.objectContaining({
                            title: 'Heracles',
                            fields: expect.any(Array),
                        }),
                    ],
                }),
            );
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    commandName: 'lifter',
                    outcome: 'success',
                    meetCount: 1,
                }),
                'command completed',
            );
            expect(
                JSON.stringify(vi.mocked(logger.info).mock.calls),
            ).not.toContain('Heracles');
        });

        it('escapes and limits untrusted lifter data', async () => {
            mockGetLifter.mockResolvedValue({
                ...mockLifter,
                name: `**<@123> ${'x'.repeat(300)}`,
                meets: [
                    {
                        ...mockLifter.meets[0],
                        federation: '**IPF**',
                        name: '<@123> Championship',
                        state: '*Attica*',
                        equipment: 'Raw```@everyone',
                        date: '**<@789>**',
                    },
                ],
                personalBests: [
                    {
                        ...mockLifter.personalBests[0],
                        equipment: `Raw\`\`\`${'x'.repeat(5_000)}`,
                    },
                ],
            });
            const interaction = createChatInputInteraction({ name: 'unsafe' });

            await execute(interaction);

            const { embeds } = vi.mocked(interaction.editReply).mock
                .calls[0][0] as any;
            const embed = embeds[0];
            expect(embed.title.length).toBeLessThanOrEqual(256);
            expect(embed.title).toContain('\\*\\*<@123\\>');
            expect(embed.description.length).toBeLessThanOrEqual(4_096);
            expect(embed.description).toContain('\u200B');
            expect(embed.fields[0].name.length).toBeLessThanOrEqual(256);
            expect(embed.fields[0].name).toContain('\\*\\*IPF\\*\\*');
            expect(embed.fields[0].value).toContain('\\*Attica\\*');
            expect(embed.fields[0].value).toContain(
                'Date: \\*\\*<@789\\>\\*\\*',
            );
        });

        it.each([
            [1, '1st'],
            [2, '2nd'],
            [3, '3rd'],
            [4, '4th'],
            [11, '11th'],
            [12, '12th'],
            [13, '13th'],
            [21, '21st'],
            [22, '22nd'],
            [23, '23rd'],
        ])('formats a placement of %i as %s', async (place, placement) => {
            mockGetLifter.mockResolvedValue({
                ...mockLifter,
                meets: [{ ...mockLifter.meets[0], place }],
            });
            const interaction = createChatInputInteraction({
                name: 'Heracles',
            });

            await execute(interaction);

            const { embeds } = vi.mocked(interaction.editReply).mock
                .calls[0][0] as any;
            expect(embeds[0].fields[0].value).toContain(`${placement} Place`);
        });

        it('replies with error when no name is provided', async () => {
            const interaction = createChatInputInteraction({ name: null });
            await execute(interaction);

            expect(interaction.deferReply).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith(
                'You need to specify a lifter name.',
            );
        });

        it('replies with not-found message when lifter does not exist', async () => {
            mockGetLifter.mockResolvedValue(undefined);
            const interaction = createChatInputInteraction({
                name: 'UnknownLifter',
            });
            await execute(interaction);

            expect(interaction.deferReply).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith(
                'No data found for lifter: UnknownLifter.',
            );
        });

        it('escapes user input in the not-found message', async () => {
            mockGetLifter.mockResolvedValue(undefined);
            const interaction = createChatInputInteraction({
                name: '<@123> **Unknown**',
            });

            await execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                'No data found for lifter: <@123\\> \\*\\*Unknown\\*\\*.',
            );
        });

        it('replies with not-found message when lifter has no meets', async () => {
            mockGetLifter.mockResolvedValue({ ...mockLifter, meets: [] });
            const interaction = createChatInputInteraction({
                name: 'Heracles',
            });
            await execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                'No data found for lifter: Heracles.',
            );
        });

        it('replies with error message when the API throws', async () => {
            const cause = Object.assign(new Error('Connection lost'), {
                code: 'ECONNRESET',
            });
            mockGetLifter.mockRejectedValue(
                Object.assign(
                    new Error('API failure for Heracles', { cause }),
                    {
                        requestBody: { json: { name: 'Heracles' } },
                    },
                ),
            );
            const interaction = createChatInputInteraction({
                name: 'Heracles',
                deferred: true,
            });
            await execute(interaction);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content:
                        'An error occurred while fetching the lifter data.',
                }),
            );
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    commandName: 'lifter',
                    input: 'Heracles',
                    guildId: '23456',
                    channelId: '34567',
                    userId: '12345',
                    errorType: 'Error',
                    errorCode: 'ECONNRESET',
                }),
                'command failed',
            );
            const logFields = vi.mocked(logger.error).mock.lastCall?.[0];
            expect(logFields).not.toHaveProperty('err');
            expect(logFields).not.toHaveProperty('errorMessage');
        });

        it('does not set embed URL when lifter url is empty', async () => {
            mockGetLifter.mockResolvedValue({ ...mockLifter, url: '' });
            const interaction = createChatInputInteraction({
                name: 'Heracles',
            });
            await execute(interaction);

            const call = vi.mocked(interaction.editReply).mock
                .calls[0][0] as any;
            expect(call.embeds[0].url).toBeUndefined();
        });

        it('logs the lookup and replies ephemerally when deferring fails', async () => {
            const interaction = createChatInputInteraction({
                name: 'Heracles',
            });
            vi.mocked(interaction.deferReply).mockRejectedValueOnce(
                new Error('Failed to defer reply'),
            );
            await execute(interaction);

            expect(mockGetLifter).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ input: 'Heracles' }),
                'command failed',
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content:
                        'An error occurred while fetching the lifter data.',
                    ephemeral: true,
                }),
            );
        });
    });

    describe('autocomplete', () => {
        it('responds with empty array for short queries', async () => {
            const interaction = createAutocompleteInteraction('H');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('responds with matching lifter names', async () => {
            mockGetLifterAutocomplete.mockResolvedValue(['Heracles', 'Hades']);
            const interaction = createAutocompleteInteraction('He');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([
                { name: 'Heracles', value: 'Heracles' },
                { name: 'Hades', value: 'Hades' },
            ]);
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    commandName: 'lifter',
                    outcome: 'success',
                    queryLength: 2,
                    resultCount: 2,
                }),
                'autocomplete completed',
            );
            expect(
                JSON.stringify(vi.mocked(logger.info).mock.calls),
            ).not.toContain('"He"');
        });

        it('responds with empty array when API returns no results', async () => {
            mockGetLifterAutocomplete.mockResolvedValue(undefined);
            const interaction = createAutocompleteInteraction('He');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('responds with empty array when API throws', async () => {
            mockGetLifterAutocomplete.mockRejectedValue(
                new Error('Network error for He'),
            );
            const interaction = createAutocompleteInteraction('He');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([]);
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    commandName: 'lifter',
                    queryLength: 2,
                    errorType: 'Error',
                }),
                'autocomplete failed',
            );
            expect(
                JSON.stringify(vi.mocked(logger.error).mock.calls),
            ).not.toContain('He');
        });
    });
});
