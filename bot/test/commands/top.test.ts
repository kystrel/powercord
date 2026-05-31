import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as topCommand from '../../src/commands/opl/top';
import logger from '../../src/logging/logger';
import {
    createChatInputInteraction,
    createPaginationInteraction,
} from '../helpers/interactions';

const mockGetTopLifters = vi.hoisted(() => vi.fn());

vi.mock('../../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('discord.js');

vi.mock('../../src/data/api', () => ({
    api: {
        getTopLifters: mockGetTopLifters,
    },
}));

const makeLifter = (name: string, dots: number) => ({
    name,
    sex: 'M' as const,
    url: '',
    squat: 300,
    bench: 200,
    deadlift: 400,
    total: 900,
    dots,
});

const mockTopLifters = [
    makeLifter('Zeus', 450.5),
    makeLifter('Hades', 435.2),
    makeLifter('Poseidon', 420.0),
];

const mockTopLiftersMultiPage = [
    makeLifter('Zeus', 600),
    makeLifter('Hades', 590),
    makeLifter('Poseidon', 580),
    makeLifter('Ares', 570),
    makeLifter('Apollo', 560),
    makeLifter('Hermes', 550),
];

describe('Top command', () => {
    const execute = topCommand['execute'];

    beforeEach(() => {
        mockGetTopLifters.mockReset();
    });

    it('replies with not-found message when no data exists', async () => {
        mockGetTopLifters.mockResolvedValue(undefined);
        const interaction = createChatInputInteraction();
        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            'No data found for top lifters.',
        );
    });

    it('replies with not-found message when API returns an empty array', async () => {
        mockGetTopLifters.mockResolvedValue([]);
        const interaction = createChatInputInteraction();
        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            'No data found for top lifters.',
        );
    });

    it('replies ephemerally when API throws and interaction is not deferred', async () => {
        mockGetTopLifters.mockRejectedValue(new Error('API failure'));
        const interaction = createChatInputInteraction();
        await execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'An error occurred while fetching the top lifters.',
                ephemeral: true,
            }),
        );
    });

    it('edits reply with error when API throws and interaction is already deferred', async () => {
        mockGetTopLifters.mockRejectedValue(new Error('API failure'));
        const interaction = createChatInputInteraction({ deferred: true });
        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'An error occurred while fetching the top lifters.',
            }),
        );
    });

    it('generates an embed with top lifters', async () => {
        mockGetTopLifters.mockResolvedValue(mockTopLifters);
        const interaction = createChatInputInteraction();
        await execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: [
                    expect.objectContaining({
                        title: '🥇 Powerlifting Rankings',
                    }),
                ],
                components: expect.any(Array),
            }),
        );
    });

    it('sets up a message component collector after replying', async () => {
        mockGetTopLifters.mockResolvedValue(mockTopLifters);
        const interaction = createChatInputInteraction();
        await execute(interaction);

        expect(interaction.fetchReply).toHaveBeenCalled();
    });

    it('collector filter accepts only the command user', async () => {
        mockGetTopLifters.mockResolvedValue(mockTopLifters);
        const { interaction, getFilter } = createPaginationInteraction();
        await execute(interaction as any);

        const filter = getFilter()!;
        expect(filter({ user: { id: '12345' } })).toBe(true);
        expect(filter({ user: { id: 'other' } })).toBe(false);
    });

    it('advances to next page when next button is clicked', async () => {
        mockGetTopLifters.mockResolvedValue(mockTopLiftersMultiPage);
        const { interaction, handlers } = createPaginationInteraction();
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
        const { embeds } = vi.mocked(buttonInteraction.update).mock
            .calls[0][0] as any;
        expect(embeds[0].description).toContain('Page 2');
    });

    it('decrements page when prev is clicked from page 2', async () => {
        mockGetTopLifters.mockResolvedValue(mockTopLiftersMultiPage);
        const { interaction, handlers } = createPaginationInteraction();
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
        expect(embeds[0].description).toContain('Page 1');
    });

    it('does not decrement page when prev is clicked on the first page', async () => {
        mockGetTopLifters.mockResolvedValue(mockTopLiftersMultiPage);
        const { interaction, handlers } = createPaginationInteraction();
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
        mockGetTopLifters.mockResolvedValue(mockTopLiftersMultiPage);
        const { interaction, handlers } = createPaginationInteraction();
        await execute(interaction as any);

        const buttonInteraction = {
            customId: 'next',
            user: { id: '12345' },
            update: vi.fn().mockRejectedValue(new Error('update failed')),
        };
        await handlers['collect'](buttonInteraction);

        expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'pagination.failed',
                commandName: 'top',
                action: 'next',
                err: expect.any(Error),
            }),
            'pagination failed',
        );
    });

    it('logs error when end handler throws', async () => {
        mockGetTopLifters.mockResolvedValue(mockTopLiftersMultiPage);
        const { interaction, handlers } = createPaginationInteraction();
        await execute(interaction as any);

        vi.mocked(interaction.editReply).mockImplementationOnce(() => {
            throw new Error('edit failed');
        });
        handlers['end']();

        expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'pagination.disable_failed',
                commandName: 'top',
                err: expect.any(Error),
            }),
            'pagination disable failed',
        );
    });

    it('disables all buttons when the collector ends', async () => {
        mockGetTopLifters.mockResolvedValue(mockTopLiftersMultiPage);
        const { interaction, handlers } = createPaginationInteraction();
        await execute(interaction as any);

        handlers['end']();

        const lastCall = vi
            .mocked(interaction.editReply)
            .mock.calls.at(-1)![0] as any;
        expect(lastCall.components[0].components[0].disabled).toBe(true);
        expect(lastCall.components[0].components[1].disabled).toBe(true);
    });
});
