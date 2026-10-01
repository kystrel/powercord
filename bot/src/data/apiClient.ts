import type { Lifter, Meet, TopLifter } from '../types/types';
import { config } from '../utils/config';

export interface DataStatus {
    revision: string;
    loadedAt: string;
    lifterCount: number;
    meetCount: number;
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
    getMeetAutocomplete: (query: string, limit = 10) =>
        request<string[]>(
            '/api/meets/autocomplete',
            { query, limit },
            false,
            2000,
        ),
};

export async function checkApiHealth(): Promise<void> {
    await request('/health');
}

export async function fetchDataStatus(): Promise<DataStatus> {
    const status = await request<DataStatus>('/api/status');
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
