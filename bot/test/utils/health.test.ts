import express from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import logger from '../../src/logging/logger';
import { isBotReady } from '../../src/utils/botState';

vi.mock('express', () => ({
    default: vi.fn(() => ({
        get: vi.fn(),
        listen: vi.fn((port: number, callback: () => void) => {
            callback();
            return { close: vi.fn() };
        }),
    })),
}));

vi.mock('../../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
    },
}));

vi.mock('../../src/utils/botState', () => ({
    isBotReady: vi.fn(),
}));

describe('health', () => {
    let mockApp: {
        get: ReturnType<typeof vi.fn>;
        listen: ReturnType<typeof vi.fn>;
    };

    beforeAll(async () => {
        mockApp = {
            get: vi.fn(),
            listen: vi.fn((port: number, callback: () => void) => {
                callback();
                return { close: vi.fn() };
            }),
        };
        (express as any).mockReturnValue(mockApp);
        await import('../../src/utils/health');
    });

    beforeEach(() => {
        vi.mocked(isBotReady).mockReturnValue(false);
    });

    it('registers GET /live route', () => {
        expect(mockApp.get).toHaveBeenCalledWith('/live', expect.any(Function));
    });

    it('GET /live handler always reports liveness', () => {
        const handler = (mockApp.get.mock.calls as any[]).find(
            ([path]) => path === '/live',
        )?.[1];
        const res = { send: vi.fn() };

        handler({}, res);

        expect(res.send).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('registers GET /health route', () => {
        expect(mockApp.get).toHaveBeenCalledWith(
            '/health',
            expect.any(Function),
        );
    });

    it('GET /health handler reports ready when Discord is connected', () => {
        vi.mocked(isBotReady).mockReturnValue(true);
        const handler = (mockApp.get.mock.calls as any[]).find(
            ([path]) => path === '/health',
        )?.[1];
        const res = { send: vi.fn() };

        handler({}, res);

        expect(res.send).toHaveBeenCalledWith({ status: 'ok' });
    });

    it('GET /health handler returns 503 until Discord is connected', () => {
        const handler = (mockApp.get.mock.calls as any[]).find(
            ([path]) => path === '/health',
        )?.[1];
        const send = vi.fn();
        const status = vi.fn(() => ({ send }));

        handler({}, { status });

        expect(status).toHaveBeenCalledWith(503);
        expect(send).toHaveBeenCalledWith({ status: 'not_ready' });
    });

    it('listens on port 3000', () => {
        expect(mockApp.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    });

    it('logs startup message', () => {
        expect(logger.info).toHaveBeenCalledWith(
            { event: 'health_server.started', port: 3000 },
            'health check server started',
        );
    });
});
