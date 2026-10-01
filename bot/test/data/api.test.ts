import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConfig, mockClient, mockMockClient } = vi.hoisted(() => ({
    mockConfig: { NODE_ENV: 'test', ENABLE_MOCK_API: false },
    mockClient: { getLifter: vi.fn() },
    mockMockClient: { getLifter: vi.fn() },
}));
const health = vi.hoisted(() => vi.fn());
const status = vi.hoisted(() => vi.fn());
vi.mock('../../src/utils/config', () => ({ config: mockConfig }));
vi.mock('../../src/data/apiClient', () => ({
    apiClient: mockClient,
    checkApiHealth: health,
    fetchDataStatus: status,
}));
vi.mock('../../src/data/mockApiLoader', () => ({
    loadMockClient: () => mockMockClient,
}));

describe('data facade', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        mockConfig.ENABLE_MOCK_API = false;
    });
    it('uses the HTTP client and checks API readiness at startup', async () => {
        const { api, initializeApiData, getDataStatus } =
            await import('../../src/data/api');
        await initializeApiData();
        await api.getLifter('Taylor');
        await getDataStatus();
        expect(health).toHaveBeenCalledOnce();
        expect(mockClient.getLifter).toHaveBeenCalledWith('Taylor');
        expect(status).toHaveBeenCalledTimes(2);
    });
    it('keeps explicit development mock mode independent of the API', async () => {
        mockConfig.ENABLE_MOCK_API = true;
        const { api, initializeApiData, getDataStatus } =
            await import('../../src/data/api');
        await initializeApiData();
        await api.getLifter('Taylor');
        expect(mockMockClient.getLifter).toHaveBeenCalledWith('Taylor');
        expect(health).not.toHaveBeenCalled();
        expect(await getDataStatus()).toBeUndefined();
        expect(status).not.toHaveBeenCalled();
    });
});
