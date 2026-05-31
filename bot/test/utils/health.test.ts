import express from 'express';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import logger from '../../src/logging/logger';

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

    it('registers GET /health route', () => {
        expect(mockApp.get).toHaveBeenCalledWith(
            '/health',
            expect.any(Function),
        );
    });

    it('GET /health handler responds with { status: "ok" }', () => {
        const handler = (mockApp.get.mock.calls as any[]).find(
            ([path]) => path === '/health',
        )?.[1];
        const res = { send: vi.fn() };
        handler({}, res);
        expect(res.send).toHaveBeenCalledWith({ status: 'ok' });
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
