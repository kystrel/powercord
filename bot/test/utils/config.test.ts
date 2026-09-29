import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('reads NODE_ENV from the environment', async () => {
        process.env.NODE_ENV = 'production';
        const { config } = await import('../../src/utils/config');
        expect(config.NODE_ENV).toBe('production');
    });

    it('reads SQLITE_PATH from the environment', async () => {
        process.env.SQLITE_PATH = '/data/current.sqlite';
        const { config } = await import('../../src/utils/config');
        expect(config.SQLITE_PATH).toBe('/data/current.sqlite');
    });
});
