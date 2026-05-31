import { describe, expect, it, vi } from 'vitest';
import * as pingCommand from '../../src/commands/utility/ping';
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

    it('replies with Pong!', async () => {
        const interaction = createChatInputInteraction();
        await execute(interaction);

        expect(interaction.reply).toHaveBeenCalledWith('Pong!');
    });
});
