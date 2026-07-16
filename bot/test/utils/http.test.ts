import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOk } from '../../src/utils/http';

const mockFetch = vi.hoisted(() => vi.fn());

vi.stubGlobal('fetch', mockFetch);

describe('fetchOk', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('preserves the HTTP status when body cleanup fails', async () => {
        const cancel = vi.fn().mockRejectedValue(new Error('cancel failed'));
        mockFetch.mockResolvedValue({
            ok: false,
            status: 503,
            body: { cancel },
        } as unknown as Response);

        await expect(fetchOk('https://example.com')).rejects.toMatchObject({
            name: 'HttpResponseError',
            statusCode: 503,
        });
        expect(cancel).toHaveBeenCalledOnce();
    });
});
