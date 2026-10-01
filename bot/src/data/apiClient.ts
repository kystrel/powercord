import type { Lifter, Meet, MeetChoice, TopLifter } from '../types/types';
import { config } from '../utils/config';

export interface DataStatus {
    apiVersion?: number;
    revision: string;
    loadedAt: string;
    lifterCount: number;
    meetCount: number;
}

export class AmbiguousMeetError extends Error {}

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
        throw new Error(`Data API request failed (${response.status})`);
    }
    return (await response.json()) as T;
}

export const apiClient = {
    getLifter: (name: string) =>
        request<Lifter>('/api/lifters', { name }, true),
    getMeet: (name: string) => request<Meet>('/api/meets', { name }, true),
    getTopLifters: () => request<TopLifter[]>('/api/top'),
    getLifterAutocomplete: (query: string, limit = 10) =>
        request<string[]>(
            '/api/lifters/autocomplete',
            { query, limit },
            false,
            2000,
        ),
    getMeetAutocomplete: async (query: string, limit = 10) => {
        const choices = await request<MeetChoice[]>(
            '/api/meets/choices',
            { query, limit },
            true,
            2000,
        );
        if (choices !== undefined) return choices;
        const names = await request<string[]>(
            '/api/meets/autocomplete',
            { query, limit },
            false,
            2000,
        );
        return names?.map((name) => ({ name, value: name }));
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
