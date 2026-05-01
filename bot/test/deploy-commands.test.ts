import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deployCommands } from '../src/deploy-commands';
import logger from '../src/utils/logger';

const { mockRest, mockSetToken } = vi.hoisted(() => ({
    mockRest: vi.fn(),
    mockSetToken: vi.fn(),
}));

vi.mock('../src/utils/logger', () => ({
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
        applicationCommands: vi.fn(),
    },
}));

describe('deployCommands', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRest.mockReturnValue({ setToken: mockSetToken });
    });

    it('skips command registration when Discord configuration is missing', async () => {
        await deployCommands();

        expect(logger.warn).toHaveBeenCalledWith(
            'CLIENT_ID or DISCORD_TOKEN is not configured; skipping Discord command registration.',
        );
        expect(mockRest).not.toHaveBeenCalled();
        expect(mockSetToken).not.toHaveBeenCalled();
    });
});
