import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConfig, mockClient, mockMockClient } = vi.hoisted(() => ({
    mockConfig: {
        NODE_ENV: 'test' as string | undefined,
        SQLITE_PATH: '/data/current.sqlite' as string | undefined,
        ENABLE_MOCK_API: false,
    },
    mockClient: {
        status: {
            revision: 'revision',
            loadedAt: '2026-09-28T00:00:00Z',
            lifterCount: 2,
            meetCount: 1,
        },
        getLifter: vi.fn(),
        getMeet: vi.fn(),
        getTopLifters: vi.fn(),
        getLifterAutocomplete: vi.fn(),
        getMeetAutocomplete: vi.fn(),
    },
    mockMockClient: {
        getLifter: vi.fn(),
        getMeet: vi.fn(),
        getTopLifters: vi.fn(),
        getLifterAutocomplete: vi.fn(),
        getMeetAutocomplete: vi.fn(),
    },
}));

const sqliteConstructor = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/config', () => ({ config: mockConfig }));
vi.mock('../../src/data/sqliteClient', () => ({
    SqliteClient: class {
        constructor(path: string) {
            sqliteConstructor(path);
            Object.assign(this, mockClient);
        }
    },
}));
vi.mock('../../src/data/mockApiLoader', () => ({
    loadMockClient: () => mockMockClient,
}));

describe('data facade', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mockConfig.NODE_ENV = 'test';
        mockConfig.SQLITE_PATH = '/data/current.sqlite';
        mockConfig.ENABLE_MOCK_API = false;
    });

    it('routes production queries through the initialized SQLite client', async () => {
        const { api, initializeApiData, getDataStatus } =
            await import('../../src/data/api');
        initializeApiData();
        await api.getLifter('Taylor');
        await api.getMeet('Nationals');
        await api.getTopLifters();
        await api.getLifterAutocomplete('Tay', 25);
        await api.getMeetAutocomplete('Nat', 25);

        expect(sqliteConstructor).toHaveBeenCalledWith('/data/current.sqlite');
        expect(mockClient.getLifter).toHaveBeenCalledWith('Taylor');
        expect(mockClient.getMeet).toHaveBeenCalledWith('Nationals');
        expect(mockClient.getTopLifters).toHaveBeenCalledWith();
        expect(mockClient.getLifterAutocomplete).toHaveBeenCalledWith(
            'Tay',
            25,
        );
        expect(mockClient.getMeetAutocomplete).toHaveBeenCalledWith('Nat', 25);
        expect(getDataStatus()).toEqual(mockClient.status);
    });

    it('keeps development mock mode independent of SQLite', async () => {
        mockConfig.ENABLE_MOCK_API = true;
        mockConfig.SQLITE_PATH = undefined;
        const { api, initializeApiData, getDataStatus } =
            await import('../../src/data/api');
        initializeApiData();
        await api.getLifter('Taylor');

        expect(sqliteConstructor).not.toHaveBeenCalled();
        expect(mockMockClient.getLifter).toHaveBeenCalledWith('Taylor');
        expect(getDataStatus()).toBeUndefined();
    });
});
