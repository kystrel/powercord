import { Routes } from 'discord.js';
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
        DISCORD_GUILD_ID: undefined,
    },
}));

vi.mock('discord.js', () => ({
    REST: mockRest,
    Routes: {
        applicationCommands: vi.fn().mockReturnValue('/commands'),
        applicationGuildCommands: vi.fn().mockReturnValue('/guild-commands'),
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

    it('rejects command registration when Discord configuration is missing', async () => {
        await expect(deployCommands()).rejects.toThrow(
            'Missing required Discord command deployment configuration: CLIENT_ID, DISCORD_TOKEN',
        );

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'discord_commands.configuration_invalid',
                missingConfiguration: ['CLIENT_ID', 'DISCORD_TOKEN'],
                err: expect.any(Error),
            }),
            'discord command deployment configuration is invalid',
        );
        expect(mockRest).not.toHaveBeenCalled();
    });

    it('registers commands and logs success when credentials are provided', async () => {
        mockPut.mockResolvedValue([{ name: 'ping' }, { name: 'top' }]);

        await deployCommands({
            clientId: 'client-123',
            discordToken: 'token-abc',
        });

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'discord_commands.refresh_started',
                scope: 'global',
            }),
            'started refreshing application commands',
        );
        expect(Routes.applicationCommands).toHaveBeenCalledWith('client-123');
        expect(Routes.applicationGuildCommands).not.toHaveBeenCalled();
        expect(mockPut).toHaveBeenCalledWith('/commands', { body: [] });
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'discord_commands.refresh_completed',
                commandCount: 2,
                scope: 'global',
            }),
            'successfully refreshed application commands',
        );
    });

    it('registers commands to a development guild when configured', async () => {
        await deployCommands({
            clientId: 'client-123',
            discordToken: 'token-abc',
            guildId: 'guild-456',
        });

        expect(Routes.applicationGuildCommands).toHaveBeenCalledWith(
            'client-123',
            'guild-456',
        );
        expect(Routes.applicationCommands).not.toHaveBeenCalled();
        expect(mockPut).toHaveBeenCalledWith('/guild-commands', { body: [] });
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'discord_commands.refresh_completed',
                scope: 'guild',
            }),
            'successfully refreshed application commands',
        );
    });

    it('logs and rejects when the REST call fails', async () => {
        mockPut.mockRejectedValue(new Error('Discord API error'));

        await expect(
            deployCommands({
                clientId: 'client-123',
                discordToken: 'token-abc',
            }),
        ).rejects.toThrow('Discord API error');

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'discord_commands.refresh_failed',
                scope: 'global',
                err: expect.any(Error),
            }),
            'failed to refresh application commands',
        );
    });
});
