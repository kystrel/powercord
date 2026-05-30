import { gunzipSync } from 'node:zlib';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../utils/config';
import logger from '../utils/logger';

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

type CacheLogger = {
    debug(message: string, ...meta: unknown[]): void;
    info(message: string, ...meta: unknown[]): void;
    warn(message: string, ...meta: unknown[]): void;
    error(message: string, ...meta: unknown[]): void;
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
                'STATIC_BUCKET is not configured; autocomplete will use HTTP fallback.',
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
                    'Autocomplete cache refresh failed:',
                    error,
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
            this.options.logger.debug('Autocomplete cache hit', {
                kind,
                queryLength: query.length,
                resultCount: results.length,
                durationMs: Date.now() - startedAt,
                revision: snapshot.revision,
            });
            return results;
        }

        if (this.options.bucket) void this.refresh();

        this.options.logger.debug('Autocomplete cache miss; using fallback', {
            kind,
            queryLength: query.length,
        });
        return fallback(query, safeLimit);
    }

    private async loadSnapshot(bucket: string): Promise<void> {
        const manifest = await this.loadJson<unknown>(bucket, MANIFEST_KEY);
        if (!isManifest(manifest)) {
            throw new Error('Invalid autocomplete manifest payload');
        }

        if (this.snapshot?.revision === manifest.revision) {
            this.options.logger.debug('Autocomplete cache already current', {
                revision: manifest.revision,
            });
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

        this.options.logger.info('Autocomplete cache loaded', {
            revision: manifest.revision,
            updatedAt: manifest.updatedAt,
            loadedAt,
            lifterCount: lifterNames.length,
            meetCount: meetNames.length,
            bucket,
        });
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
