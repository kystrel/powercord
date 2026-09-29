import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    isMockApiEnabled,
    validateApiConfiguration,
} from '../../src/utils/apiConfig';

const mockConfig = vi.hoisted(() => ({
    NODE_ENV: 'test' as string | undefined,
    SQLITE_PATH: '/data/current.sqlite' as string | undefined,
    ENABLE_MOCK_API: false,
}));

vi.mock('../../src/utils/config', () => ({ config: mockConfig }));

describe('API configuration', () => {
    beforeEach(() => {
        mockConfig.NODE_ENV = 'test';
        mockConfig.SQLITE_PATH = '/data/current.sqlite';
        mockConfig.ENABLE_MOCK_API = false;
    });

    it('uses mock data only when it is explicitly enabled outside production', () => {
        mockConfig.SQLITE_PATH = undefined;
        mockConfig.ENABLE_MOCK_API = true;

        expect(isMockApiEnabled()).toBe(true);
        expect(validateApiConfiguration).not.toThrow();
    });

    it('requires SQLITE_PATH when mock mode is disabled', () => {
        mockConfig.SQLITE_PATH = undefined;

        expect(() => validateApiConfiguration()).toThrow(
            'SQLITE_PATH is required unless development mock mode is enabled',
        );
    });

    it('rejects mock mode in production', () => {
        mockConfig.NODE_ENV = 'production';
        mockConfig.SQLITE_PATH = undefined;
        mockConfig.ENABLE_MOCK_API = true;

        expect(isMockApiEnabled()).toBe(false);
        expect(() => validateApiConfiguration()).toThrow(
            'ENABLE_MOCK_API can only be enabled when NODE_ENV is development or test',
        );
    });

    it('rejects mock mode when NODE_ENV is not set', () => {
        mockConfig.NODE_ENV = undefined;
        mockConfig.SQLITE_PATH = undefined;
        mockConfig.ENABLE_MOCK_API = true;

        expect(isMockApiEnabled()).toBe(false);
        expect(() => validateApiConfiguration()).toThrow(
            'ENABLE_MOCK_API can only be enabled when NODE_ENV is development or test',
        );
    });

    it('accepts a configured SQLite snapshot in production', () => {
        mockConfig.NODE_ENV = 'production';

        expect(isMockApiEnabled()).toBe(false);
        expect(validateApiConfiguration).not.toThrow();
    });
});
