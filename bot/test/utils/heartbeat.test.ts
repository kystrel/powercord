import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger from '../../src/logging/logger';
import { isBotReady } from '../../src/utils/botState';
import { config } from '../../src/utils/config';
import { startHeartbeat } from '../../src/utils/heartbeat';

vi.mock('axios');
vi.mock('../../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../../src/utils/config', () => ({
    config: {
        BETTERSTACK_HEARTBEAT_URL: undefined,
    },
}));

vi.mock('../../src/utils/botState', () => ({
    isBotReady: vi.fn(),
}));

const mockAxios = vi.mocked(axios, true);

describe('heartbeat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.mocked(isBotReady).mockReturnValue(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('skips heartbeat when URL is not configured', () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL = undefined;

        startHeartbeat();

        expect(logger.warn).toHaveBeenCalledWith(
            { event: 'heartbeat.unconfigured' },
            'BetterStack heartbeat URL not configured, skipping heartbeat',
        );
        expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('starts heartbeat when URL is configured', () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        mockAxios.get.mockResolvedValue({ data: 'ok' });

        startHeartbeat();

        expect(logger.info).toHaveBeenCalledWith(
            { event: 'heartbeat.started', interval_ms: 60000 },
            'starting BetterStack heartbeat monitor',
        );
        expect(mockAxios.get).toHaveBeenCalledWith(
            'https://heartbeat.betterstack.com/test',
            { timeout: 5000 },
        );
    });

    it('sends heartbeat at 60-second intervals', async () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        mockAxios.get.mockResolvedValue({ data: 'ok' });

        startHeartbeat();

        expect(mockAxios.get).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(60000);
        expect(mockAxios.get).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(60000);
        expect(mockAxios.get).toHaveBeenCalledTimes(3);
    });

    it('withholds heartbeats until the bot is ready', () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        vi.mocked(isBotReady).mockReturnValue(false);

        startHeartbeat();

        expect(mockAxios.get).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(
            { event: 'heartbeat.skipped', reason: 'bot_not_ready' },
            'skipping BetterStack heartbeat while bot is not ready',
        );

        vi.mocked(isBotReady).mockReturnValue(true);
        vi.advanceTimersByTime(60000);

        expect(mockAxios.get).toHaveBeenCalledTimes(1);
    });

    it('logs error when heartbeat request fails', async () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        const error = new Error('Network error');
        mockAxios.get.mockRejectedValue(error);

        startHeartbeat();

        await vi.waitFor(() => {
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'heartbeat.failed',
                    err: error,
                }),
                'failed to send heartbeat to BetterStack',
            );
        });
    });
});
