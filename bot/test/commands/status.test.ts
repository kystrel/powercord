import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as statusCommand from '../../src/commands/utility/status';
import { autocompleteCache } from '../../src/data/autocompleteCache';
import logger from '../../src/logging/logger';

vi.mock('discord.js');

vi.mock('../../src/data/autocompleteCache', () => ({
    autocompleteCache: {
        getStatus: vi.fn(),
    },
}));

vi.mock('../../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

const makeInteraction = (latencyMs = 50) => {
    const sentTimestamp = Date.now();
    const interactionTimestamp = sentTimestamp - latencyMs;

    return {
        createdTimestamp: interactionTimestamp,
        reply: vi.fn().mockResolvedValue({
            createdTimestamp: sentTimestamp,
        }),
        editReply: vi.fn().mockResolvedValue(undefined),
        client: {
            guilds: {
                fetch: vi.fn().mockResolvedValue(undefined),
                cache: { size: 5 },
            },
            users: {
                cache: { size: 42 },
            },
        },
    };
};

describe('Status command', () => {
    const execute = statusCommand['execute'];

    beforeEach(() => {
        vi.mocked(logger.info).mockClear();
        vi.mocked(logger.error).mockClear();
        vi.mocked(autocompleteCache.getStatus).mockReturnValue({
            source: 'http',
            configured: false,
        });
    });

    it('replies to measure latency then edits reply with embed', async () => {
        const interaction = makeInteraction();
        await execute(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ fetchReply: true }),
        );
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ embeds: expect.any(Array) }),
        );
    });

    it('embed description contains latency, server count, and cached user count', async () => {
        const interaction = makeInteraction(75);
        await execute(interaction as any);

        const { embeds } = (interaction.editReply as any).mock.calls[0][0];
        const embed = embeds[0];
        expect(embed.description).toContain('ms');
        expect(embed.description).toContain('5 servers');
        expect(embed.description).toContain('42 cached users');
        expect(embed.description).toContain('HTTP fallback');
    });

    it('shows local autocomplete snapshot metadata and counts', async () => {
        vi.mocked(autocompleteCache.getStatus).mockReturnValue({
            source: 'local',
            configured: true,
            revision: '1234567890abcdef',
            updatedAt: '2026-05-24T00:00:00.000Z',
            loadedAt: '2026-05-24T01:00:00.000Z',
            lifterCount: 12_345,
            meetCount: 678,
        });
        const interaction = makeInteraction();

        await execute(interaction as any);

        const { embeds } = (interaction.editReply as any).mock.calls[0][0];
        const embed = embeds[0];
        expect(embed.description).toContain('local cache');
        expect(embed.description).toContain('`1234567890ab`');
        expect(embed.description).toContain('<t:1779580800:R>');
        expect(embed.description).toContain('12,345 lifters');
        expect(embed.description).toContain('678 meets');
    });

    it('handles an invalid snapshot timestamp without emitting a broken Discord timestamp', async () => {
        vi.mocked(autocompleteCache.getStatus).mockReturnValue({
            source: 'local',
            configured: true,
            revision: 'rev1',
            updatedAt: 'invalid',
            loadedAt: '2026-05-24T01:00:00.000Z',
            lifterCount: 1,
            meetCount: 1,
        });
        const interaction = makeInteraction();

        await execute(interaction as any);

        const { embeds } = (interaction.editReply as any).mock.calls[0][0];
        expect(embeds[0].description).toContain('updated at an unknown time');
        expect(embeds[0].description).not.toContain('<t:NaN:R>');
    });

    it('fetches guilds before building the embed', async () => {
        const interaction = makeInteraction();
        await execute(interaction as any);

        expect(interaction.client.guilds.fetch).toHaveBeenCalled();
    });

    it('replies ephemerally with error when reply throws and interaction is not deferred', async () => {
        const interaction = makeInteraction();
        vi.mocked(interaction.reply).mockRejectedValueOnce(
            new Error('Discord error'),
        );
        await execute(interaction as any);

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'command.failed',
                commandName: 'status',
            }),
            'command failed',
        );
        expect(interaction.reply).toHaveBeenLastCalledWith(
            expect.objectContaining({
                content: 'An error occurred while fetching the status.',
                ephemeral: true,
            }),
        );
    });

    it('edits reply with error when interaction is deferred', async () => {
        const interaction = {
            ...makeInteraction(),
            deferred: true,
            replied: false,
        };
        vi.mocked(interaction.reply).mockRejectedValueOnce(
            new Error('Discord error'),
        );
        await execute(interaction as any);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: 'An error occurred while fetching the status.',
            }),
        );
    });
});
