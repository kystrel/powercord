import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as pingCommand from '../../src/commands/utility/ping';
import logger from '../../src/logging/logger';
import { createChatInputInteraction } from '../helpers/interactions';

vi.mock('discord.js');

vi.mock('../../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Ping command', () => {
    const execute = pingCommand['execute'];

    beforeEach(() => {
        vi.mocked(logger.info).mockClear();
        vi.mocked(logger.error).mockClear();
    });

    it('replies with Pong!', async () => {
        const interaction = createChatInputInteraction();
        await execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith('Pong!');
    });

    it('replies ephemerally with error when reply throws and interaction is not deferred', async () => {
        const interaction = createChatInputInteraction();
        vi.mocked(interaction.reply).mockRejectedValueOnce(new Error('Discord error'));
        await execute(interaction);

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'command.failed', commandName: 'ping' }),
            'command failed',
        );
        expect(interaction.reply).toHaveBeenLastCalledWith(
            expect.objectContaining({ content: 'An error occurred.', ephemeral: true }),
        );
    });

    it('edits reply with error when reply throws and interaction is deferred', async () => {
        const interaction = createChatInputInteraction({ deferred: true });
        vi.mocked(interaction.reply).mockRejectedValueOnce(new Error('Discord error'));
        await execute(interaction);

        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({ content: 'An error occurred.' }),
        );
    });
});
