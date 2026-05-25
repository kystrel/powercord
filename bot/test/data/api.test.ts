import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConfig, mockApiClient, mockMockClient } = vi.hoisted(() => ({
    mockConfig: {
        API_BASE_URL: undefined as string | undefined,
        ENABLE_MOCK_API: false,
    },
    mockApiClient: {
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
const mockAutocompleteCache = vi.hoisted(() => ({
    autocompleteCache: {
        getLifterAutocomplete: vi.fn(),
        getMeetAutocomplete: vi.fn(),
    },
    startAutocompleteCache: vi.fn(),
}));

vi.mock('../../src/utils/config', () => ({ config: mockConfig }));
vi.mock('../../src/data/apiClient', () => mockApiClient);
vi.mock('../../src/data/mockClient', () => mockMockClient);
vi.mock('../../src/data/autocompleteCache', () => mockAutocompleteCache);

describe('api', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('routes getLifter to mockClient when ENABLE_MOCK_API is true', async () => {
        mockConfig.ENABLE_MOCK_API = true;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { api } = await import('../../src/data/api');
        await api.getLifter('test');

        expect(mockMockClient.getLifter).toHaveBeenCalledWith('test');
        expect(mockApiClient.getLifter).not.toHaveBeenCalled();
    });

    it('routes getLifter to apiClient when ENABLE_MOCK_API is false', async () => {
        mockConfig.ENABLE_MOCK_API = false;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { api } = await import('../../src/data/api');
        await api.getLifter('test');

        expect(mockApiClient.getLifter).toHaveBeenCalledWith('test');
        expect(mockMockClient.getLifter).not.toHaveBeenCalled();
    });

    it('routes getMeet to mockClient when ENABLE_MOCK_API is true', async () => {
        mockConfig.ENABLE_MOCK_API = true;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { api } = await import('../../src/data/api');
        await api.getMeet('test meet');

        expect(mockMockClient.getMeet).toHaveBeenCalledWith('test meet');
        expect(mockApiClient.getMeet).not.toHaveBeenCalled();
    });

    it('routes getMeet to apiClient when ENABLE_MOCK_API is false', async () => {
        mockConfig.ENABLE_MOCK_API = false;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { api } = await import('../../src/data/api');
        await api.getMeet('test meet');

        expect(mockApiClient.getMeet).toHaveBeenCalledWith('test meet');
        expect(mockMockClient.getMeet).not.toHaveBeenCalled();
    });

    it('routes getTopLifters to mockClient when ENABLE_MOCK_API is true', async () => {
        mockConfig.ENABLE_MOCK_API = true;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { api } = await import('../../src/data/api');
        await api.getTopLifters(2);

        expect(mockMockClient.getTopLifters).toHaveBeenCalledWith(2);
        expect(mockApiClient.getTopLifters).not.toHaveBeenCalled();
    });

    it('routes getTopLifters to apiClient when ENABLE_MOCK_API is false', async () => {
        mockConfig.ENABLE_MOCK_API = false;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { api } = await import('../../src/data/api');
        await api.getTopLifters(2);

        expect(mockApiClient.getTopLifters).toHaveBeenCalledWith(2);
        expect(mockMockClient.getTopLifters).not.toHaveBeenCalled();
    });

    it('routes getLifterAutocomplete to mockClient when ENABLE_MOCK_API is true', async () => {
        mockConfig.ENABLE_MOCK_API = true;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { api } = await import('../../src/data/api');
        await api.getLifterAutocomplete('Jane', 5);

        expect(mockMockClient.getLifterAutocomplete).toHaveBeenCalledWith(
            'Jane',
            5,
        );
        expect(mockApiClient.getLifterAutocomplete).not.toHaveBeenCalled();
    });

    it('routes getLifterAutocomplete through the local cache when ENABLE_MOCK_API is false', async () => {
        mockConfig.ENABLE_MOCK_API = false;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';
        mockAutocompleteCache.autocompleteCache.getLifterAutocomplete.mockResolvedValue(
            ['Jane Doe'],
        );

        const { api } = await import('../../src/data/api');
        const result = await api.getLifterAutocomplete('Jane', 5);

        expect(result).toEqual(['Jane Doe']);
        expect(
            mockAutocompleteCache.autocompleteCache.getLifterAutocomplete,
        ).toHaveBeenCalledWith('Jane', 5, mockApiClient.getLifterAutocomplete);
        expect(mockApiClient.getLifterAutocomplete).not.toHaveBeenCalled();
        expect(mockMockClient.getLifterAutocomplete).not.toHaveBeenCalled();
    });

    it('routes getMeetAutocomplete to mockClient when ENABLE_MOCK_API is true', async () => {
        mockConfig.ENABLE_MOCK_API = true;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { api } = await import('../../src/data/api');
        await api.getMeetAutocomplete('Labor', 5);

        expect(mockMockClient.getMeetAutocomplete).toHaveBeenCalledWith(
            'Labor',
            5,
        );
        expect(mockApiClient.getMeetAutocomplete).not.toHaveBeenCalled();
    });

    it('routes getMeetAutocomplete through the local cache when ENABLE_MOCK_API is false', async () => {
        mockConfig.ENABLE_MOCK_API = false;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';
        mockAutocompleteCache.autocompleteCache.getMeetAutocomplete.mockResolvedValue(
            ['2025 USAPL Raw Nationals'],
        );

        const { api } = await import('../../src/data/api');
        const result = await api.getMeetAutocomplete('Labor', 5);

        expect(result).toEqual(['2025 USAPL Raw Nationals']);
        expect(
            mockAutocompleteCache.autocompleteCache.getMeetAutocomplete,
        ).toHaveBeenCalledWith('Labor', 5, mockApiClient.getMeetAutocomplete);
        expect(mockApiClient.getMeetAutocomplete).not.toHaveBeenCalled();
        expect(mockMockClient.getMeetAutocomplete).not.toHaveBeenCalled();
    });

    it('starts autocomplete cache refresh for the real API client', async () => {
        mockConfig.ENABLE_MOCK_API = false;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { startApiDataRefresh } = await import('../../src/data/api');
        startApiDataRefresh();

        expect(mockAutocompleteCache.startAutocompleteCache).toHaveBeenCalled();
    });

    it('does not start autocomplete cache refresh for the mock API client', async () => {
        mockConfig.ENABLE_MOCK_API = true;
        mockConfig.API_BASE_URL = 'http://localhost:3000/api';

        const { startApiDataRefresh } = await import('../../src/data/api');
        startApiDataRefresh();

        expect(
            mockAutocompleteCache.startAutocompleteCache,
        ).not.toHaveBeenCalled();
    });
});
