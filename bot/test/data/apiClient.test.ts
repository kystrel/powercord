import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    apiClient,
    checkApiHealth,
    fetchDataStatus,
} from '../../src/data/apiClient';

vi.mock('../../src/utils/config', () => ({
    config: { API_BASE_URL: 'http://powercord-api:3001/' },
}));
afterEach(() => vi.unstubAllGlobals());

describe('HTTP data client', () => {
    it('encodes names and queries and uses the private API routes', async () => {
        const fetchMock = vi
            .fn()
            .mockImplementation(async () => Response.json([]));
        vi.stubGlobal('fetch', fetchMock);
        await apiClient.getLifter('A. Smith #1');
        await apiClient.getMeet('2026 FÉD Meet');
        await apiClient.getTopLifters();
        await apiClient.getLifterAutocomplete('a&b', 25);
        await apiClient.getMeetAutocomplete('meet');
        await checkApiHealth();
        expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
            'http://powercord-api:3001/api/lifters?name=A.+Smith+%231',
            'http://powercord-api:3001/api/meets?name=2026+F%C3%89D+Meet',
            'http://powercord-api:3001/api/top',
            'http://powercord-api:3001/api/lifters/autocomplete?query=a%26b&limit=25',
            'http://powercord-api:3001/api/meets/autocomplete?query=meet&limit=10',
            'http://powercord-api:3001/health',
        ]);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({
            redirect: 'error',
            signal: expect.any(AbortSignal),
        });
    });
    it('returns undefined only for missing lifters and meets', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockImplementation(
                    async () => new Response('{}', { status: 404 }),
                ),
        );
        expect(await apiClient.getLifter('missing')).toBeUndefined();
        expect(await apiClient.getMeet('missing')).toBeUndefined();
        await expect(apiClient.getTopLifters()).rejects.toThrow(
            'Data API request failed (404)',
        );
    });
    it('propagates outages, timeouts and malformed JSON rather than claiming data is missing', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(new Response('{}', { status: 503 }))
            .mockRejectedValueOnce(new TypeError('fetch failed'))
            .mockRejectedValueOnce(
                new DOMException('Timed out', 'TimeoutError'),
            )
            .mockResolvedValueOnce(new Response('invalid json'));
        vi.stubGlobal('fetch', fetchMock);
        await expect(apiClient.getLifter('Taylor')).rejects.toThrow('503');
        await expect(apiClient.getMeet('Meet')).rejects.toThrow('fetch failed');
        await expect(apiClient.getLifterAutocomplete('a')).rejects.toThrow(
            'Timed out',
        );
        await expect(apiClient.getTopLifters()).rejects.toThrow();
    });
    it('uses a shorter timeout for autocomplete', async () => {
        const timeout = vi.spyOn(AbortSignal, 'timeout');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])));
        await apiClient.getMeetAutocomplete('meet');
        expect(timeout).toHaveBeenLastCalledWith(2000);
        timeout.mockRestore();
    });
    it('validates the status contract before rendering it', async () => {
        const status = {
            revision: 'abc',
            loadedAt: '2026-09-30T00:00:00Z',
            lifterCount: 2,
            meetCount: 1,
        };
        const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(status));
        vi.stubGlobal('fetch', fetchMock);
        expect(await fetchDataStatus()).toEqual(status);
        for (const value of [
            null,
            {},
            { ...status, loadedAt: 'no' },
            { ...status, revision: 1 },
            { ...status, lifterCount: -1 },
            { ...status, meetCount: -1 },
        ]) {
            fetchMock.mockResolvedValueOnce(Response.json(value));
            await expect(fetchDataStatus()).rejects.toThrow(
                'Invalid data API status',
            );
        }
    });
});
