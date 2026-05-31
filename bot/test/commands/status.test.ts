import { describe, expect, it, vi } from 'vitest';
import * as statusCommand from '../../src/commands/utility/status';

vi.mock('discord.js');

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

    it('embed description contains latency, server count, and user count', async () => {
        const interaction = makeInteraction(75);
        await execute(interaction as any);

        const { embeds } = (interaction.editReply as any).mock.calls[0][0];
        const embed = embeds[0];
        expect(embed.description).toContain('ms');
        expect(embed.description).toContain('5 servers');
        expect(embed.description).toContain('42 users');
    });

    it('fetches guilds before building the embed', async () => {
        const interaction = makeInteraction();
        await execute(interaction as any);

        expect(interaction.client.guilds.fetch).toHaveBeenCalled();
    });
});
