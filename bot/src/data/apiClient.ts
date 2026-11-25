import type { Lifter, Meet, MeetChoice, TopLifter } from '../types/types';
import { config } from '../utils/config';

export interface DataStatus {
    apiVersion?: number;
    revision: string;
    loadedAt: string;
    lifterCount: number;
    meetCount: number;
}

export class AmbiguousMeetError extends Error {
    readonly statusCode = 409;
}

class InvalidAutocompleteResponseError extends Error {}

function parseAutocompleteNames(value: unknown): string[] {
    if (
        !Array.isArray(value) ||
        !value.every((name) => typeof name === 'string')
    ) {
        throw new InvalidAutocompleteResponseError(
            'Invalid autocomplete names',
        );
    }
    return value;
}

function parseMeetChoices(value: unknown): MeetChoice[] {
    if (
        !Array.isArray(value) ||
        !value.every(
            (choice: unknown): choice is MeetChoice =>
                choice !== null &&
                typeof choice === 'object' &&
                'name' in choice &&
                typeof choice.name === 'string' &&
                'value' in choice &&
                typeof choice.value === 'string',
        )
    ) {
        throw new InvalidAutocompleteResponseError('Invalid meet choices');
    }
    return value;
}

async function request<T>(
    route: string,
    params: Record<string, string | number> = {},
    allowMissing = false,
    timeout = 10000,
): Promise<T | undefined> {
    const baseUrl = config.API_BASE_URL;
    if (!baseUrl) throw new Error('API_BASE_URL is required');
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}${route}`);
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(timeout),
        redirect: 'error',
    });
    if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 409 && route === '/api/meets') {
            throw new AmbiguousMeetError(
                'Multiple meets match. Select a meet from autocomplete.',
            );
        }
        if (response.status === 404 && allowMissing) return undefined;
        throw Object.assign(
            new Error(`Data API request failed (${response.status})`),
            { statusCode: response.status },
        );
    }
    return (await response.json()) as T;
}

export const apiClient = {
    getLifter: (name: string) =>
        request<Lifter>('/api/lifters', { name }, true),
    getMeet: (name: string) => request<Meet>('/api/meets', { name }, true),
    getTopLifters: () => request<TopLifter[]>('/api/top'),
    getLifterAutocomplete: async (query: string, limit = 10) => {
        const names = await request(
            '/api/lifters/autocomplete',
            { query, limit },
            false,
            2000,
        );
        return parseAutocompleteNames(names);
    },
    getMeetAutocomplete: async (query: string, limit = 10) => {
        const choices = await request(
            '/api/meets/choices',
            { query, limit },
            true,
            2000,
        );
        if (choices !== undefined) return parseMeetChoices(choices);
        const names = await request(
            '/api/meets/autocomplete',
            { query, limit },
            false,
            2000,
        );
        return parseAutocompleteNames(names).map((name) => ({
            name,
            value: name,
        }));
    },
};

export async function checkApiHealth(): Promise<void> {
    await request('/health');
}

export async function fetchDataStatus(): Promise<DataStatus> {
    const status = await request<DataStatus>('/api/status');
    if (status?.apiVersion !== undefined && status.apiVersion !== 1) {
        throw new Error('Unsupported data API version; expected 1');
    }
    if (
        !status ||
        typeof status.revision !== 'string' ||
        !Number.isFinite(Date.parse(status.loadedAt)) ||
        !Number.isSafeInteger(status.lifterCount) ||
        status.lifterCount < 0 ||
        !Number.isSafeInteger(status.meetCount) ||
        status.meetCount < 0
    ) {
        throw new Error('Invalid data API status');
    }
    return status;
}
