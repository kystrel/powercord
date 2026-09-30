import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as statusCommand from '../../src/commands/utility/status';
import { getDataStatus } from '../../src/data/api';
import logger from '../../src/logging/logger';

vi.mock('discord.js');

vi.mock('../../src/data/api', () => ({ getDataStatus: vi.fn() }));

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
        vi.mocked(getDataStatus).mockResolvedValue(undefined);
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

    it('labels cached server and user counts in the embed and logs', async () => {
        const interaction = makeInteraction(75);
        await execute(interaction as any);

        const { embeds } = (interaction.editReply as any).mock.calls[0][0];
        const embed = embeds[0];
        expect(embed.description).toContain('ms');
        expect(embed.description).toContain('5 cached servers');
        expect(embed.description).toContain('42 cached users');
        expect(embed.description).toContain('development mock');
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                cachedServerCount: 5,
                cachedUserCount: 42,
            }),
            'command completed',
        );
    });

    it('shows API snapshot metadata and counts', async () => {
        vi.mocked(getDataStatus).mockResolvedValue({
            revision: '1234567890abcdef',
            loadedAt: '2026-05-24T01:00:00.000Z',
            lifterCount: 12_345,
            meetCount: 678,
        });
        const interaction = makeInteraction();

        await execute(interaction as any);

        const { embeds } = (interaction.editReply as any).mock.calls[0][0];
        const embed = embeds[0];
        expect(embed.description).toContain('API');
        expect(embed.description).toContain('`1234567890ab`');
        expect(embed.description).toContain('<t:1779584400:R>');
        expect(embed.description).toContain('12,345 lifters');
        expect(embed.description).toContain('678 meets');
    });

    it('uses the guild cache without fetching every guild', async () => {
        const interaction = makeInteraction();
        await execute(interaction as any);

        expect(interaction.client.guilds.fetch).not.toHaveBeenCalled();
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
