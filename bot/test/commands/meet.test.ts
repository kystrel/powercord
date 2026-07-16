import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as meetCommand from '../../src/commands/opl/meet';
import logger from '../../src/logging/logger';
import {
    createAutocompleteInteraction,
    createChatInputInteraction,
    createPaginationInteraction,
} from '../helpers/interactions';

const { mockGetMeet, mockGetMeetAutocomplete } = vi.hoisted(() => ({
    mockGetMeet: vi.fn(),
    mockGetMeetAutocomplete: vi.fn(),
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
        getMeet: mockGetMeet,
        getMeetAutocomplete: mockGetMeetAutocomplete,
    },
}));

const mockSinglePageMeetUrl =
    'https://www.openpowerlifting.org/m/ipf/GRC-2025-06-15-labors-of-strength';
const mockMultiPageMeetUrl =
    'https://www.openpowerlifting.org/m/ipf/GRC-2025-06-15-multi-page-meet';

const makeEntry = (name: string, dots: number | null) => ({
    place: 1,
    name,
    sex: 'M',
    age: 30,
    equipment: 'Raw',
    weightClass: 100,
    bodyWeight: 98,
    squat: 300,
    bench: 200,
    deadlift: 400,
    total: 900,
    dots,
});

const mockSinglePageMeet = {
    name: 'Labors of Strength',
    federation: 'IPF',
    date: '2025-06-15',
    year: '2025',
    url: mockSinglePageMeetUrl,
    country: 'Greece',
    state: null,
    town: null,
    entries: [makeEntry('Hercules', 1551.41)],
};

const mockMultiPageMeet = {
    name: 'Multi Page Meet',
    federation: 'IPF',
    date: '2025-06-15',
    year: '2025',
    url: mockMultiPageMeetUrl,
    country: 'Greece',
    state: null,
    town: null,
    entries: [
        makeEntry('A', 600),
        makeEntry('B', 590),
        makeEntry('C', 580),
        makeEntry('D', 570),
        makeEntry('E', 560),
        makeEntry('F', 550),
    ],
};

describe('Meet command', () => {
    const execute = meetCommand['execute'];
    const autocomplete = meetCommand['autocomplete'];

    beforeEach(() => {
        mockGetMeet.mockReset();
        mockGetMeetAutocomplete.mockReset();
        vi.mocked(logger.info).mockClear();
        vi.mocked(logger.error).mockClear();
    });

    it('generates an embed with meet data', async () => {
        mockGetMeet.mockResolvedValue(mockSinglePageMeet);
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
        });
        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: [
                    expect.objectContaining({
                        title: '🥇 Powerlifting Rankings',
                        description: expect.stringContaining(
                            `Top lifters for [**2025 IPF Labors of Strength**](${mockSinglePageMeetUrl})`,
                        ),
                        url: mockSinglePageMeetUrl,
                        fields: expect.any(Array),
                    }),
                ],
            }),
        );
    });

    it('sorts entries without changing the API response', async () => {
        const meet = {
            ...mockSinglePageMeet,
            entries: [makeEntry('Lower', 400), makeEntry('Higher', 500)],
        };
        mockGetMeet.mockResolvedValue(meet);
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
        });

        await execute(interaction);

        expect(meet.entries.map((entry) => entry.name)).toEqual([
            'Lower',
            'Higher',
        ]);
        const { embeds } = vi.mocked(interaction.editReply).mock
            .calls[0][0] as any;
        expect(embeds[0].fields[0].name).toContain('Higher');
        expect(embeds[0].fields[3].name).toContain('Lower');
    });

    it('sorts zero DOTS ahead of missing DOTS', async () => {
        mockGetMeet.mockResolvedValue({
            ...mockSinglePageMeet,
            entries: [makeEntry('Missing', null), makeEntry('Zero', 0)],
        });
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
        });

        await execute(interaction);

        const { embeds } = vi.mocked(interaction.editReply).mock
            .calls[0][0] as any;
        expect(embeds[0].fields[0].name).toContain('Zero');
        expect(embeds[0].fields[1].value).toContain('Dots: 0.00');
        expect(embeds[0].fields[3].name).toContain('Missing');
        expect(embeds[0].fields[4].value).toContain('Dots: —');
    });

    it('does not link the meet name when url is missing', async () => {
        const meet = { ...mockSinglePageMeet } as any;
        delete meet.url;
        mockGetMeet.mockResolvedValue(meet);
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
        });

        await execute(interaction);

        const { embeds } = vi.mocked(interaction.editReply).mock
            .calls[0][0] as any;
        expect(embeds[0].description).toContain(
            'Top lifters for **2025 IPF Labors of Strength**',
        );
        expect(embeds[0].url).toBeUndefined();
    });

    it('does not link the meet name when url is null', async () => {
        mockGetMeet.mockResolvedValue({
            ...mockSinglePageMeet,
            url: null,
        });
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
        });

        await execute(interaction);

        const { embeds } = vi.mocked(interaction.editReply).mock
            .calls[0][0] as any;
        expect(embeds[0].description).toContain(
            'Top lifters for **2025 IPF Labors of Strength**',
        );
        expect(embeds[0].url).toBeUndefined();
    });

    it('does not link the meet name when url is invalid', async () => {
        mockGetMeet.mockResolvedValue({
            ...mockSinglePageMeet,
            url: 'https://www.openpowerlifting.org/u/not-a-meet',
        });
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
        });

        await execute(interaction);

        const { embeds } = vi.mocked(interaction.editReply).mock
            .calls[0][0] as any;
        expect(embeds[0].description).toContain(
            'Top lifters for **2025 IPF Labors of Strength**',
        );
        expect(embeds[0].url).toBeUndefined();
    });

    it('replies with error when no name is provided', async () => {
        const interaction = createChatInputInteraction({ name: null });
        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            'You need to specify a meet.',
        );
    });

    it('replies with not-found message when meet does not exist', async () => {
        mockGetMeet.mockResolvedValue(undefined);
        const interaction = createChatInputInteraction({
            name: 'NonExistentMeet',
        });
        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            'No data found for meet: NonExistentMeet.',
        );
    });

    it('replies with not-found message when meet has no entries', async () => {
        mockGetMeet.mockResolvedValue({ ...mockSinglePageMeet, entries: [] });
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
        });
        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            'No data found for meet: Labors of Strength.',
        );
    });

    it('sets up a message component collector after replying', async () => {
        mockGetMeet.mockResolvedValue(mockSinglePageMeet);
        const { interaction } = createPaginationInteraction({
            name: 'Labors of Strength',
        });
        await execute(interaction as any);

        expect(interaction.fetchReply).toHaveBeenCalled();
    });

    it('collector filter accepts only the command user', async () => {
        mockGetMeet.mockResolvedValue(mockSinglePageMeet);
        const { interaction, getFilter } = createPaginationInteraction({
            name: 'Labors of Strength',
        });
        await execute(interaction as any);

        const filter = getFilter()!;
        expect(filter({ user: { id: '12345' } })).toBe(true);
        expect(filter({ user: { id: 'other' } })).toBe(false);
    });

    it('advances to next page when next button is clicked', async () => {
        mockGetMeet.mockResolvedValue(mockMultiPageMeet);
        const { interaction, handlers } = createPaginationInteraction({
            name: 'Multi Page Meet',
        });
        await execute(interaction as any);

        const buttonInteraction = {
            customId: 'next',
            user: { id: '12345' },
            update: vi.fn().mockResolvedValue(undefined),
        };
        await handlers['collect'](buttonInteraction);

        expect(buttonInteraction.update).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) }),
        );
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'pagination.changed',
                commandName: 'meet',
                action: 'next',
                input: 'Multi Page Meet',
                previousPage: 1,
                page: 2,
                pageCount: 2,
                entryCount: 6,
                duration_ms: expect.any(Number),
            }),
            'pagination changed',
        );
        const { embeds } = vi.mocked(buttonInteraction.update).mock
            .calls[0][0] as any;
        expect(embeds[0].description).toContain('page 2');
        expect(embeds[0].description).toContain(
            `[**2025 IPF Multi Page Meet**](${mockMultiPageMeetUrl})`,
        );
        expect(embeds[0].url).toBe(mockMultiPageMeetUrl);
    });

    it('replies ephemerally when API throws and interaction is not deferred', async () => {
        mockGetMeet.mockRejectedValue(new Error('API failure'));
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
        });
        await execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'An error occurred while fetching the meet data.',
                ephemeral: true,
            }),
        );
    });

    it('edits reply with error when API throws and interaction is already deferred', async () => {
        mockGetMeet.mockRejectedValue(new Error('API failure'));
        const interaction = createChatInputInteraction({
            name: 'Labors of Strength',
            deferred: true,
        });
        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'An error occurred while fetching the meet data.',
            }),
        );
    });

    it('decrements page when prev is clicked from page 2', async () => {
        mockGetMeet.mockResolvedValue(mockMultiPageMeet);
        const { interaction, handlers } = createPaginationInteraction({
            name: 'Multi Page Meet',
        });
        await execute(interaction as any);

        await handlers['collect']({
            customId: 'next',
            user: { id: '12345' },
            update: vi.fn().mockResolvedValue(undefined),
        });

        const prevInteraction = {
            customId: 'prev',
            user: { id: '12345' },
            update: vi.fn().mockResolvedValue(undefined),
        };
        await handlers['collect'](prevInteraction);

        expect(prevInteraction.update).toHaveBeenCalled();
        const { embeds } = vi.mocked(prevInteraction.update).mock
            .calls[0][0] as any;
        expect(embeds[0].description).toContain('page 1');
    });

    it('does not decrement page when prev is clicked on the first page', async () => {
        mockGetMeet.mockResolvedValue(mockMultiPageMeet);
        const { interaction, handlers } = createPaginationInteraction({
            name: 'Multi Page Meet',
        });
        await execute(interaction as any);

        const buttonInteraction = {
            customId: 'prev',
            user: { id: '12345' },
            update: vi.fn().mockResolvedValue(undefined),
        };
        await handlers['collect'](buttonInteraction);

        expect(buttonInteraction.update).not.toHaveBeenCalled();
    });

    it('logs error when collect handler throws', async () => {
        mockGetMeet.mockResolvedValue(mockMultiPageMeet);
        const { interaction, handlers } = createPaginationInteraction({
            name: 'Multi Page Meet',
        });
        await execute(interaction as any);

        const buttonInteraction = {
            customId: 'next',
            user: { id: '12345' },
            update: vi.fn().mockRejectedValue(new Error('update failed')),
        };
        await handlers['collect'](buttonInteraction);

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'pagination.failed',
                commandName: 'meet',
                action: 'next',
                input: 'Multi Page Meet',
                previousPage: 1,
                page: 2,
                pageCount: 2,
                entryCount: 6,
                duration_ms: expect.any(Number),
                err: expect.any(Error),
            }),
            'pagination failed',
        );

        const retryInteraction = {
            customId: 'next',
            user: { id: '12345' },
            update: vi.fn().mockResolvedValue(undefined),
        };
        await handlers['collect'](retryInteraction);

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'pagination.changed',
                commandName: 'meet',
                action: 'next',
                input: 'Multi Page Meet',
                previousPage: 1,
                page: 2,
            }),
            'pagination changed',
        );
    });

    it('logs error when end handler throws', async () => {
        mockGetMeet.mockResolvedValue(mockMultiPageMeet);
        const { interaction, handlers } = createPaginationInteraction({
            name: 'Multi Page Meet',
        });
        await execute(interaction as any);

        vi.mocked(interaction.editReply).mockImplementationOnce(() => {
            throw new Error('edit failed');
        });
        handlers['end']();

        expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'pagination.disable_failed',
                commandName: 'meet',
                input: 'Multi Page Meet',
                page: 1,
                pageCount: 2,
                entryCount: 6,
                err: expect.any(Error),
            }),
            'pagination disable failed',
        );
    });

    describe('autocomplete', () => {
        it('responds with empty array for short queries', async () => {
            const interaction = createAutocompleteInteraction('L');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([]);
            expect(mockGetMeetAutocomplete).not.toHaveBeenCalled();
        });

        it('responds with matching meet names', async () => {
            mockGetMeetAutocomplete.mockResolvedValue([
                'Labors of Strength',
                'Labors of Speed',
            ]);
            const interaction = createAutocompleteInteraction('La');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([
                { name: 'Labors of Strength', value: 'Labors of Strength' },
                { name: 'Labors of Speed', value: 'Labors of Speed' },
            ]);
        });

        it('responds with empty array when API returns no results', async () => {
            mockGetMeetAutocomplete.mockResolvedValue(undefined);
            const interaction = createAutocompleteInteraction('La');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('responds with empty array when API throws', async () => {
            mockGetMeetAutocomplete.mockRejectedValue(
                new Error('Network error'),
            );
            const interaction = createAutocompleteInteraction('La');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });
    });

    it('disables all buttons when the collector ends', async () => {
        mockGetMeet.mockResolvedValue(mockMultiPageMeet);
        const { interaction, handlers } = createPaginationInteraction({
            name: 'Multi Page Meet',
        });
        await execute(interaction as any);

        await handlers['end']();

        const lastCall = vi
            .mocked(interaction.editReply)
            .mock.calls.at(-1)![0] as any;
        expect(lastCall.components[0].components[0].disabled).toBe(true);
        expect(lastCall.components[0].components[1].disabled).toBe(true);
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'pagination.ended',
                commandName: 'meet',
                input: 'Multi Page Meet',
                page: 1,
                pageCount: 2,
                entryCount: 6,
                duration_ms: expect.any(Number),
            }),
            'pagination ended',
        );
    });
});
