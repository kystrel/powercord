import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isMockApiEnabled,
    validateApiConfiguration,
} from '../../src/utils/apiConfig';

const mockConfig = vi.hoisted(() => ({
    NODE_ENV: 'test' as string | undefined,
    API_BASE_URL: 'http://localhost:3000/api' as string | undefined,
    ENABLE_MOCK_API: false,
}));

vi.mock('../../src/utils/config', () => ({ config: mockConfig }));

describe('API configuration', () => {
    beforeEach(() => {
        mockConfig.NODE_ENV = 'test';
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';
        mockConfig.ENABLE_MOCK_API = false;
    });

    it('uses mock data only when it is explicitly enabled outside production', () => {
        mockConfig.API_BASE_URL = undefined;
        mockConfig.ENABLE_MOCK_API = true;

        expect(isMockApiEnabled()).toBe(true);
        expect(validateApiConfiguration).not.toThrow();
    });

    it('requires API_BASE_URL when mock mode is disabled', () => {
        mockConfig.API_BASE_URL = undefined;

        expect(() => validateApiConfiguration()).toThrow(
            'API_BASE_URL is required unless development mock mode is enabled',
        );
    });

    it('rejects mock mode in production', () => {
        mockConfig.NODE_ENV = 'production';
        mockConfig.API_BASE_URL = undefined;
        mockConfig.ENABLE_MOCK_API = true;

        expect(isMockApiEnabled()).toBe(false);
        expect(() => validateApiConfiguration()).toThrow(
            'ENABLE_MOCK_API cannot be enabled when NODE_ENV is production',
        );
    });

    it('accepts a configured real API in production', () => {
        mockConfig.NODE_ENV = 'production';

        expect(isMockApiEnabled()).toBe(false);
        expect(validateApiConfiguration).not.toThrow();
    });
});
