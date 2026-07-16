import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import logger from '../../src/logging/logger';
import { isBotReady } from '../../src/utils/botState';
import { config } from '../../src/utils/config';
import { startHeartbeat } from '../../src/utils/heartbeat';

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

const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal('fetch', mockFetch);

describe('heartbeat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
        vi.useFakeTimers();
        vi.mocked(isBotReady).mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('skips heartbeat when URL is not configured', () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL = undefined;

        startHeartbeat();

        expect(logger.warn).toHaveBeenCalledWith(
            { event: 'heartbeat.unconfigured' },
            'BetterStack heartbeat URL not configured, skipping heartbeat',
        );
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('starts heartbeat when URL is configured', () => {
        const timeout = vi.spyOn(AbortSignal, 'timeout');
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

        startHeartbeat();

        expect(logger.info).toHaveBeenCalledWith(
            { event: 'heartbeat.started', interval_ms: 60000 },
            'starting BetterStack heartbeat monitor',
        );
        expect(mockFetch).toHaveBeenCalledWith(
            'https://heartbeat.betterstack.com/test',
            { signal: expect.any(AbortSignal) },
        );
        expect(timeout).toHaveBeenCalledWith(5000);
    });

    it('discards successful heartbeat response bodies', async () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        const cancel = vi.fn().mockResolvedValue(undefined);
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            body: { cancel },
        } as unknown as Response);

        startHeartbeat();

        await vi.waitFor(() => {
            expect(cancel).toHaveBeenCalledOnce();
        });
    });

    it('sends heartbeat at 60-second intervals', async () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        mockFetch.mockResolvedValue(new Response(null, { status: 200 }));

        startHeartbeat();

        expect(mockFetch).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(60000);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(60000);
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('withholds heartbeats until the bot is ready', () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        vi.mocked(isBotReady).mockReturnValue(false);

        startHeartbeat();

        expect(mockFetch).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(
            { event: 'heartbeat.skipped', reason: 'bot_not_ready' },
            'skipping BetterStack heartbeat while bot is not ready',
        );

        vi.mocked(isBotReady).mockReturnValue(true);
        vi.advanceTimersByTime(60000);

        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('logs error when heartbeat request fails', async () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        const error = new Error('Network error');
        mockFetch.mockRejectedValue(error);

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

    it('logs non-success heartbeat responses with their status', async () => {
        (config as any).BETTERSTACK_HEARTBEAT_URL =
            'https://heartbeat.betterstack.com/test';
        mockFetch.mockResolvedValue(
            new Response('Service unavailable', { status: 503 }),
        );

        startHeartbeat();

        await vi.waitFor(() => {
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'heartbeat.failed',
                    errorType: 'HttpResponseError',
                    statusCode: 503,
                }),
                'failed to send heartbeat to BetterStack',
            );
        });
    });
});
