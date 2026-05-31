import { gzipSync } from 'node:zlib';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AutocompleteCache,
    autocompleteCache,
    normalizeAutocompleteLimit,
    searchAutocompleteNames,
    startAutocompleteCache,
} from '../../src/data/autocompleteCache';

type TestObjectMap = Record<string, string | Buffer>;

function makeBody(value: string | Buffer) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
    return {
        transformToString: () => Promise.resolve(bytes.toString('utf8')),
        transformToByteArray: () => Promise.resolve(new Uint8Array(bytes)),
    };
}

function makeS3(objects: TestObjectMap) {
    const send = vi.fn((command: GetObjectCommand) => {
        const key = command.input.Key;
        if (!key || !(key in objects)) {
            return Promise.reject(
                Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' }),
            );
        }

        return Promise.resolve({ Body: makeBody(objects[key]) });
    });

    return {
        s3: { send } as unknown as S3Client,
        send,
    };
}

function makeObjects(
    revision: string,
    lifterNames: unknown,
    meetNames: unknown,
): TestObjectMap {
    return {
        'autocomplete/manifest.json': JSON.stringify({
            revision,
            updatedAt: '2026-05-24T00:00:00.000Z',
        }),
        'autocomplete/lifters.json.gz': gzipSync(JSON.stringify(lifterNames)),
        'autocomplete/meets.json.gz': gzipSync(JSON.stringify(meetNames)),
    };
}

function makeLogger() {
    return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
}

describe('normalizeAutocompleteLimit', () => {
    it('defaults non-finite limits', () => {
        expect(normalizeAutocompleteLimit(Number.NaN)).toBe(10);
    });

    it('clamps limits to Discord autocomplete bounds', () => {
        expect(normalizeAutocompleteLimit(-5)).toBe(1);
        expect(normalizeAutocompleteLimit(0)).toBe(1);
        expect(normalizeAutocompleteLimit(100)).toBe(25);
    });
});

describe('searchAutocompleteNames', () => {
    it('prioritizes full-name and word-start matches before mid-word matches', () => {
        const names = ['A Kandasamy', 'Alice Anderson', 'Samantha Rice'];

        expect(searchAutocompleteNames(names, 'sam', 10)).toEqual([
            'Samantha Rice',
            'A Kandasamy',
        ]);
        expect(searchAutocompleteNames(names, 'and', 10)).toEqual([
            'Alice Anderson',
            'A Kandasamy',
        ]);
    });

    it('matches all names for an empty query (caller is responsible for guarding)', () => {
        expect(searchAutocompleteNames(['Alice'], '', 10)).toEqual(['Alice']);
    });

    it('stops at the limit during the first-pass prefix scan', () => {
        const names = ['Alice', 'Alan', 'Bob'];
        expect(searchAutocompleteNames(names, 'a', 1)).toEqual(['Alice']);
    });

    it('stops at the limit during the second-pass mid-word scan', () => {
        const names = ['Bob', 'Charlie'];
        expect(searchAutocompleteNames(names, 'ob', 1)).toEqual(['Bob']);
    });
});

describe('AutocompleteCache', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    it('loads manifest and both autocomplete blobs into one snapshot', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3(
            makeObjects(
                'rev1',
                ['Samantha Rice', 'A Kandasamy'],
                ['2025 USAPL Raw Nationals'],
            ),
        );
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
            now: () => new Date('2026-05-24T01:00:00.000Z'),
        });

        await cache.refresh();

        expect(cache.getSnapshot()).toEqual({
            revision: 'rev1',
            updatedAt: '2026-05-24T00:00:00.000Z',
            loadedAt: '2026-05-24T01:00:00.000Z',
            lifterNames: ['Samantha Rice', 'A Kandasamy'],
            meetNames: ['2025 USAPL Raw Nationals'],
        });
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'autocomplete_cache.loaded',
                revision: 'rev1',
                lifterCount: 2,
                meetCount: 1,
            }),
            'autocomplete cache loaded',
        );
    });

    it('returns an empty array for an empty query without calling fallback', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3(makeObjects('rev1', ['A Kandasamy'], []));
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });
        const fallback = vi.fn();

        await cache.refresh();
        const result = await cache.getLifterAutocomplete('', 10, fallback);

        expect(result).toEqual([]);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('serves local lifter autocomplete without calling fallback', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3(
            makeObjects('rev1', ['A Kandasamy', 'Samantha Rice'], []),
        );
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });
        const fallback = vi.fn().mockResolvedValue(['remote']);

        await cache.refresh();
        const result = await cache.getLifterAutocomplete('sam', 10, fallback);

        expect(result).toEqual(['Samantha Rice', 'A Kandasamy']);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('falls back to HTTP autocomplete when no local snapshot is loaded', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3({});
        const cache = new AutocompleteCache({
            s3,
            refreshIntervalSeconds: 300,
            logger,
        });
        const fallback = vi.fn().mockResolvedValue(['Remote Result']);

        const result = await cache.getMeetAutocomplete('remote', 100, fallback);

        expect(result).toEqual(['Remote Result']);
        expect(fallback).toHaveBeenCalledWith('remote', 25);
    });

    it('keeps the previous snapshot when a later refresh fails', async () => {
        const logger = makeLogger();
        const objects = makeObjects(
            'rev1',
            ['Samantha Rice'],
            ['2025 USAPL A'],
        );
        const { s3 } = makeS3(objects);
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });

        await cache.refresh();
        objects['autocomplete/manifest.json'] = JSON.stringify({
            revision: 'rev2',
            updatedAt: '2026-05-24T02:00:00.000Z',
        });
        objects['autocomplete/lifters.json.gz'] = gzipSync(
            JSON.stringify([1, 2, 3]),
        );

        await cache.refresh();

        expect(cache.getSnapshot()?.revision).toBe('rev1');
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'autocomplete_cache.refresh_failed',
                err: expect.any(Error),
            }),
            'autocomplete cache refresh failed',
        );
    });

    it('starts one polling timer and triggers an immediate refresh', async () => {
        vi.useFakeTimers();
        const logger = makeLogger();
        const { s3, send } = makeS3(makeObjects('rev1', [], []));
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });

        cache.start();
        cache.start();
        await vi.runOnlyPendingTimersAsync();

        expect(send).toHaveBeenCalled();
        cache.stop();
    });

    it('logs a warning when started without a bucket configured', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3({});
        const cache = new AutocompleteCache({
            s3,
            refreshIntervalSeconds: 300,
            logger,
        });

        cache.start();
        await cache.refresh();
        cache.stop();

        expect(logger.warn).toHaveBeenCalledWith(
            { event: 'autocomplete_cache.unconfigured' },
            'STATIC_BUCKET is not configured; autocomplete will use HTTP fallback',
        );
    });

    it('logs an error when the manifest payload is not an object', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3({
            'autocomplete/manifest.json': JSON.stringify(null),
        });
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });

        await cache.refresh();

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'autocomplete_cache.refresh_failed',
                err: expect.objectContaining({
                    message: 'Invalid autocomplete manifest payload',
                }),
            }),
            'autocomplete cache refresh failed',
        );
    });

    it('logs an error when the manifest payload is missing required fields', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3({
            'autocomplete/manifest.json': JSON.stringify({ foo: 'bar' }),
        });
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });

        await cache.refresh();

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'autocomplete_cache.refresh_failed',
                err: expect.objectContaining({
                    message: 'Invalid autocomplete manifest payload',
                }),
            }),
            'autocomplete cache refresh failed',
        );
    });

    it('logs an error when the meets payload is not a string array', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3(makeObjects('rev1', ['Valid Lifter'], [1, 2, 3]));
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });

        await cache.refresh();

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'autocomplete_cache.refresh_failed',
                err: expect.objectContaining({
                    message: 'Invalid meet autocomplete payload',
                }),
            }),
            'autocomplete cache refresh failed',
        );
    });

    it('logs an error when an S3 object has no body', async () => {
        const logger = makeLogger();
        const send = vi.fn().mockResolvedValue({ Body: undefined });
        const s3 = { send } as unknown as S3Client;
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });

        await cache.refresh();

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'autocomplete_cache.refresh_failed',
                err: expect.objectContaining({
                    message: expect.stringContaining('no body'),
                }),
            }),
            'autocomplete cache refresh failed',
        );
    });

    it('stop is a no-op when no timer is active', () => {
        const cache = new AutocompleteCache({
            s3: makeS3({}).s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger: makeLogger(),
        });
        expect(() => cache.stop()).not.toThrow();
    });

    it('deduplicates concurrent refresh calls', async () => {
        const { s3, send } = makeS3(makeObjects('rev1', ['Alice'], []));
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger: makeLogger(),
        });

        const [,] = await Promise.all([cache.refresh(), cache.refresh()]);

        expect(send).toHaveBeenCalledTimes(3);
    });

    it('serves meet autocomplete from the local snapshot without calling fallback', async () => {
        const logger = makeLogger();
        const { s3 } = makeS3(
            makeObjects('rev1', [], ['2025 USAPL Raw Nationals']),
        );
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });
        const fallback = vi.fn();

        await cache.refresh();
        const result = await cache.getMeetAutocomplete('usapl', 10, fallback);

        expect(result).toEqual(['2025 USAPL Raw Nationals']);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('triggers a background refresh on cache miss when bucket is configured', async () => {
        const logger = makeLogger();
        const { s3, send } = makeS3(makeObjects('rev1', ['Alice'], []));
        const cache = new AutocompleteCache({
            s3,
            bucket: 'test-bucket',
            refreshIntervalSeconds: 300,
            logger,
        });
        const fallback = vi.fn().mockResolvedValue(['Fallback']);

        const result = await cache.getLifterAutocomplete('alice', 10, fallback);

        expect(result).toEqual(['Fallback']);
        expect(fallback).toHaveBeenCalled();
        expect(send).toHaveBeenCalled();
    });

    it('startAutocompleteCache calls start on the singleton cache', () => {
        const spy = vi
            .spyOn(autocompleteCache, 'start')
            .mockImplementation(() => {});
        startAutocompleteCache();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
