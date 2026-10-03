import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { loadRemoteImage, revalidateRemoteImage } = require(
    join(
        dirname(require.resolve('astro/package.json')),
        'dist/assets/build/remote.js',
    ),
);
const url = 'https://images.example/image.png';

describe('remote image cache patch', () => {
    it('loads image bytes without retaining a fresh shared-cache entry', async () => {
        const fetchImage = vi.fn(
            async () =>
                new Response('image', {
                    headers: {
                        'Cache-Control': 'public, max-age=3600',
                        'Set-Cookie': 'session=private',
                        ETag: 'version-1',
                    },
                }),
        );
        const image = await loadRemoteImage(url, fetchImage);
        expect(image.data.toString()).toBe('image');
        expect(image.expires).toBe(0);
        expect(image.etag).toBe('version-1');
    });

    it('preserves conditional revalidation and unchanged image bytes', async () => {
        const fetchImage = vi.fn(
            async (_request: Request) => new Response(null, { status: 304 }),
        );
        const image = await revalidateRemoteImage(
            url,
            {
                etag: 'version-1',
                lastModified: 'Thu, 01 Oct 2026 12:00:00 GMT',
            },
            fetchImage,
        );
        const request = fetchImage.mock.calls[0][0];
        expect(request.headers.get('If-None-Match')).toBe('version-1');
        expect(request.headers.get('If-Modified-Since')).toBe(
            'Thu, 01 Oct 2026 12:00:00 GMT',
        );
        expect(image.data).toBeNull();
        expect(image.expires).toBe(0);
        expect(image.etag).toBe('version-1');
    });
});
