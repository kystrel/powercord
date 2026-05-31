import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deployCommands } from '../src/deploy-commands';
import logger from '../src/logging/logger';

const { mockRest, mockSetToken, mockPut, mockReaddirSync } = vi.hoisted(() => ({
    mockRest: vi.fn(),
    mockSetToken: vi.fn(),
    mockPut: vi.fn(),
    mockReaddirSync: vi.fn().mockReturnValue([]),
}));

vi.mock('../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../src/utils/config', () => ({
    config: {
        CLIENT_ID: undefined,
        DISCORD_TOKEN: undefined,
    },
}));

vi.mock('discord.js', () => ({
    REST: mockRest,
    Routes: {
        applicationCommands: vi.fn().mockReturnValue('/commands'),
    },
}));

vi.mock('node:fs', () => ({
    default: { readdirSync: mockReaddirSync },
}));

describe('deployCommands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockReaddirSync.mockReturnValue([]);
        mockPut.mockResolvedValue([]);
        mockSetToken.mockReturnValue({ put: mockPut });
        mockRest.mockImplementation(function () {
            return { setToken: mockSetToken };
        });
    });

    it('skips command registration when Discord configuration is missing', async () => {
        await deployCommands();

        expect(logger.warn).toHaveBeenCalledWith(
            { event: 'discord_commands.unconfigured' },
            'CLIENT_ID or DISCORD_TOKEN is not configured; skipping Discord command registration',
        );
        expect(mockRest).not.toHaveBeenCalled();
    });

    it('registers commands and logs success when credentials are provided', async () => {
        mockPut.mockResolvedValue([{ name: 'ping' }, { name: 'top' }]);

        await deployCommands({ clientId: 'client-123', discordToken: 'token-abc' });

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'discord_commands.refresh_started' }),
            'started refreshing application commands',
        );
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'discord_commands.refresh_completed',
                commandCount: 2,
            }),
            'successfully refreshed application commands',
        );
    });

    it('logs error when the REST call fails', async () => {
        mockPut.mockRejectedValue(new Error('Discord API error'));

        await deployCommands({ clientId: 'client-123', discordToken: 'token-abc' });

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'discord_commands.refresh_failed',
                err: expect.any(Error),
            }),
            'failed to refresh application commands',
        );
    });

});
