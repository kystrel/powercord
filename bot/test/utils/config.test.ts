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

    it('reads API_BASE_URL from the environment', async () => {
        process.env.API_BASE_URL = 'http://powercord-api:3001';
        const { config } = await import('../../src/utils/config');
        expect(config.API_BASE_URL).toBe('http://powercord-api:3001');
    });
});
