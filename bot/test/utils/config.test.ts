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

    it('uses AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS when set to a valid positive integer', async () => {
        process.env.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS = '600';
        const { config } = await import('../../src/utils/config');
        expect(config.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS).toBe(600);
    });

    it('falls back to 300 when AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS is not a positive integer', async () => {
        process.env.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS = 'abc';
        const { config } = await import('../../src/utils/config');
        expect(config.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS).toBe(300);
    });

    it('falls back to 300 when AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS is zero or negative', async () => {
        process.env.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS = '0';
        const { config } = await import('../../src/utils/config');
        expect(config.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS).toBe(300);
    });

    it('falls back to 300 when AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS is absent', async () => {
        delete process.env.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS;
        const { config } = await import('../../src/utils/config');
        expect(config.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS).toBe(300);
    });
});
