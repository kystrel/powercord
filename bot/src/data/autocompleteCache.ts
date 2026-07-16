import { gunzipSync } from 'node:zlib';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { elapsedMs, errorLogFields } from '../logging/fields';
import logger from '../logging/logger';
import { config } from '../utils/config';

const LIFTERS_KEY = 'autocomplete/lifters.json.gz';
const MEETS_KEY = 'autocomplete/meets.json.gz';
const MANIFEST_KEY = 'autocomplete/manifest.json';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

type S3Reader = Pick<S3Client, 'send'>;

type AutocompleteManifest = {
    revision: string;
    updatedAt: string;
};

type AutocompleteSnapshot = {
    revision: string;
    updatedAt: string;
    loadedAt: string;
    lifterNames: string[];
    meetNames: string[];
};

export type AutocompleteCacheStatus =
    | {
          source: 'local';
          configured: true;
          revision: string;
          updatedAt: string;
          loadedAt: string;
          lifterCount: number;
          meetCount: number;
      }
    | {
          source: 'http';
          configured: boolean;
      };

type CacheLogger = {
    debug(fields: Record<string, unknown>, message: string): void;
    info(fields: Record<string, unknown>, message: string): void;
    warn(fields: Record<string, unknown>, message: string): void;
    error(fields: Record<string, unknown>, message: string): void;
};

export type AutocompleteFallback = (
    query: string,
    limit: number,
) => Promise<string[] | undefined>;

export function normalizeAutocompleteLimit(limit = DEFAULT_LIMIT): number {
    if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
    const integer = Math.trunc(limit);
    if (integer < 1) return 1;
    return Math.min(integer, MAX_LIMIT);
}

export function searchAutocompleteNames(
    names: string[],
    query: string,
    limit = DEFAULT_LIMIT,
): string[] {
    const maxResults = normalizeAutocompleteLimit(limit);
    const lowerQuery = query.toLowerCase();
    const results: string[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < names.length; i++) {
        const lowerName = names[i].toLowerCase();
        if (
            lowerName.startsWith(lowerQuery) ||
            lowerName.includes(` ${lowerQuery}`)
        ) {
            results.push(names[i]);
            seen.add(i);
            if (results.length >= maxResults) return results;
        }
    }

    for (let i = 0; i < names.length; i++) {
        if (seen.has(i)) continue;
        if (names[i].toLowerCase().includes(lowerQuery)) {
            results.push(names[i]);
            if (results.length >= maxResults) return results;
        }
    }

    return results;
}

function isManifest(value: unknown): value is AutocompleteManifest {
    if (!value || typeof value !== 'object') return false;
    const maybe = value as Partial<AutocompleteManifest>;
    return (
        typeof maybe.revision === 'string' &&
        typeof maybe.updatedAt === 'string'
    );
}

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every((item) => typeof item === 'string')
    );
}

export class AutocompleteCache {
    private snapshot: AutocompleteSnapshot | undefined;
    private refreshPromise: Promise<void> | undefined;
    private timer: ReturnType<typeof setInterval> | undefined;

    constructor(
        private readonly options: {
            s3: S3Reader;
            bucket?: string;
            refreshIntervalSeconds: number;
            logger: CacheLogger;
            now?: () => Date;
        },
    ) {}

    start(): void {
        if (!this.options.bucket) {
            this.options.logger.warn(
                { event: 'autocomplete_cache.unconfigured' },
                'STATIC_BUCKET is not configured; autocomplete will use HTTP fallback',
            );
            return;
        }

        if (this.timer) return;

        void this.refresh();
        this.timer = setInterval(
            () => void this.refresh(),
            this.options.refreshIntervalSeconds * 1000,
        );
        this.timer.unref?.();
    }

    stop(): void {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.timer = undefined;
    }

    async refresh(): Promise<void> {
        if (!this.options.bucket) return;
        if (this.refreshPromise) return this.refreshPromise;

        const bucket = this.options.bucket;

        this.refreshPromise = this.loadSnapshot(bucket)
            .catch((error: unknown) => {
                this.options.logger.error(
                    {
                        event: 'autocomplete_cache.refresh_failed',
                        ...errorLogFields(error),
                    },
                    'autocomplete cache refresh failed',
                );
            })
            .finally(() => {
                this.refreshPromise = undefined;
            });

        return this.refreshPromise;
    }

    async getLifterAutocomplete(
        query: string,
        limit: number,
        fallback: AutocompleteFallback,
    ): Promise<string[] | undefined> {
        return this.getAutocomplete('lifters', query, limit, fallback);
    }

    async getMeetAutocomplete(
        query: string,
        limit: number,
        fallback: AutocompleteFallback,
    ): Promise<string[] | undefined> {
        return this.getAutocomplete('meets', query, limit, fallback);
    }

    getSnapshot(): AutocompleteSnapshot | undefined {
        return this.snapshot;
    }

    getStatus(): AutocompleteCacheStatus {
        const snapshot = this.snapshot;
        if (!snapshot) {
            return {
                source: 'http',
                configured: Boolean(this.options.bucket),
            };
        }

        return {
            source: 'local',
            configured: true,
            revision: snapshot.revision,
            updatedAt: snapshot.updatedAt,
            loadedAt: snapshot.loadedAt,
            lifterCount: snapshot.lifterNames.length,
            meetCount: snapshot.meetNames.length,
        };
    }

    private async getAutocomplete(
        kind: 'lifters' | 'meets',
        query: string,
        limit: number,
        fallback: AutocompleteFallback,
    ): Promise<string[] | undefined> {
        if (!query) return [];
        const safeLimit = normalizeAutocompleteLimit(limit);
        const startedAt = Date.now();
        const snapshot = this.snapshot;

        if (snapshot) {
            const names =
                kind === 'lifters' ? snapshot.lifterNames : snapshot.meetNames;
            const results = searchAutocompleteNames(names, query, safeLimit);
            this.options.logger.debug(
                {
                    event: 'autocomplete_cache.hit',
                    kind,
                    query,
                    queryLength: query.length,
                    resultCount: results.length,
                    duration_ms: elapsedMs(startedAt),
                    revision: snapshot.revision,
                },
                'autocomplete cache hit',
            );
            return results;
        }

        if (this.options.bucket) void this.refresh();

        this.options.logger.debug(
            {
                event: 'autocomplete_cache.miss',
                kind,
                query,
                queryLength: query.length,
            },
            'autocomplete cache miss; using fallback',
        );
        return fallback(query, safeLimit);
    }

    private async loadSnapshot(bucket: string): Promise<void> {
        const startedAt = Date.now();
        const manifest = await this.loadJson<unknown>(bucket, MANIFEST_KEY);
        if (!isManifest(manifest)) {
            throw new Error('Invalid autocomplete manifest payload');
        }

        if (this.snapshot?.revision === manifest.revision) {
            this.options.logger.debug(
                {
                    event: 'autocomplete_cache.current',
                    revision: manifest.revision,
                    duration_ms: elapsedMs(startedAt),
                },
                'autocomplete cache already current',
            );
            return;
        }

        const [lifterNames, meetNames] = await Promise.all([
            this.loadGzippedJson<unknown>(bucket, LIFTERS_KEY),
            this.loadGzippedJson<unknown>(bucket, MEETS_KEY),
        ]);

        if (!isStringArray(lifterNames)) {
            throw new Error('Invalid lifter autocomplete payload');
        }
        if (!isStringArray(meetNames)) {
            throw new Error('Invalid meet autocomplete payload');
        }

        const loadedAt = (
            this.options.now ?? (() => new Date())
        )().toISOString();
        this.snapshot = {
            revision: manifest.revision,
            updatedAt: manifest.updatedAt,
            loadedAt,
            lifterNames,
            meetNames,
        };

        this.options.logger.info(
            {
                event: 'autocomplete_cache.loaded',
                revision: manifest.revision,
                updatedAt: manifest.updatedAt,
                loadedAt,
                lifterCount: lifterNames.length,
                meetCount: meetNames.length,
                bucket,
                duration_ms: elapsedMs(startedAt),
            },
            'autocomplete cache loaded',
        );
    }

    private async loadJson<T>(bucket: string, key: string): Promise<T> {
        const body = await this.loadObjectBody(bucket, key);
        const text = await body.transformToString('utf-8');
        return JSON.parse(text) as T;
    }

    private async loadGzippedJson<T>(bucket: string, key: string): Promise<T> {
        const body = await this.loadObjectBody(bucket, key);
        const bytes = await body.transformToByteArray();
        return JSON.parse(gunzipSync(bytes).toString('utf-8')) as T;
    }

    private async loadObjectBody(bucket: string, key: string) {
        const response = await this.options.s3.send(
            new GetObjectCommand({ Bucket: bucket, Key: key }),
        );

        if (!response.Body) {
            throw new Error(`S3 object has no body: s3://${bucket}/${key}`);
        }

        return response.Body;
    }
}

export const autocompleteCache = new AutocompleteCache({
    s3: new S3Client({ region: 'us-east-1' }),
    bucket: config.STATIC_BUCKET,
    refreshIntervalSeconds: config.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS,
    logger,
});

export function startAutocompleteCache(): void {
    autocompleteCache.start();
}
