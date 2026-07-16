import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as lifterCommand from '../../src/commands/opl/lifter';
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
            mockGetLifter.mockRejectedValue(new Error('API failure'));
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

        it('replies ephemerally when API throws and interaction is not deferred', async () => {
            mockGetLifter.mockRejectedValue(new Error('API failure'));
            const interaction = createChatInputInteraction({
                name: 'Heracles',
            });
            await execute(interaction);

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
        });

        it('responds with empty array when API returns no results', async () => {
            mockGetLifterAutocomplete.mockResolvedValue(undefined);
            const interaction = createAutocompleteInteraction('He');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('responds with empty array when API throws', async () => {
            mockGetLifterAutocomplete.mockRejectedValue(
                new Error('Network error'),
            );
            const interaction = createAutocompleteInteraction('He');
            await autocomplete(interaction);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });
    });
});
