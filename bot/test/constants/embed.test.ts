import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEmbedColor, getEmbedFooter } from '../../src/constants/embed';
import { config } from '../../src/utils/config';

vi.mock('../../src/utils/config', () => ({
    config: {
        NODE_ENV: 'test',
        ENABLE_MOCK_API: false,
    },
}));

describe('embed constants', () => {
    afterEach(() => {
        config.NODE_ENV = 'test';
        config.ENABLE_MOCK_API = false;
    });

    describe('getEmbedColor', () => {
        it('returns the brand hex color', () => {
            expect(getEmbedColor()).toBe('#c62932');
        });
    });

    describe('getEmbedFooter', () => {
        it('returns real data text when mock API is disabled', () => {
            config.ENABLE_MOCK_API = false;
            expect(getEmbedFooter()).toBe(
                'Data retrieved from OpenPowerlifting',
            );
        });

        it('returns mock warning when ENABLE_MOCK_API is true', () => {
            config.ENABLE_MOCK_API = true;
            expect(getEmbedFooter()).toBe('\u26A0 Mock data being used');
        });

        it('does not show mock data in production', () => {
            config.NODE_ENV = 'production';
            config.ENABLE_MOCK_API = true;
            expect(getEmbedFooter()).toBe(
                'Data retrieved from OpenPowerlifting',
            );
        });
    });
});
