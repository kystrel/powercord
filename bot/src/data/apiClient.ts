import axios from 'axios';
import { elapsedMs, errorLogFields } from '../logging/fields';
import logger from '../logging/logger';
import type { Lifter, Meet, TopLifter } from '../types/types';
import { config } from '../utils/config';

let api = axios.create({
    baseURL: config.API_BASE_URL,
    timeout: 20000,
    headers: { 'Content-Type': 'application/json' },
});

type ApiLogFields = Record<string, unknown>;

type ApiGetOptions<T> = {
    route: string;
    params: Record<string, string | number>;
    logFields: ApiLogFields;
    resultFields: (data: T) => ApiLogFields;
};

async function getFromApi<T>({
    route,
    params,
    logFields,
    resultFields,
}: ApiGetOptions<T>): Promise<T | undefined> {
    const startedAt = Date.now();

    try {
        const response = await api.get(route, { params });
        const data = response.data as T;

        logger.info(
            {
                event: 'api_client.request_completed',
                route,
                method: 'GET',
                ...logFields,
                statusCode: response.status,
                ...resultFields(data),
                duration_ms: elapsedMs(startedAt),
            },
            'api client request completed',
        );

        return data;
    } catch (error) {
        logger.error(
            {
                event: 'api_client.request_failed',
                route,
                method: 'GET',
                ...logFields,
                duration_ms: elapsedMs(startedAt),
                ...errorLogFields(error),
            },
            'api client request failed',
        );

        return undefined;
    }
}

export async function getLifter(name: string): Promise<Lifter | undefined> {
    return getFromApi<Lifter>({
        route: '/api/lifters',
        params: { name },
        logFields: { query: name },
        resultFields: (lifter) => ({
            found: Boolean(lifter),
            meetCount: lifter?.meets?.length,
        }),
    });
}

export async function getMeet(name: string): Promise<Meet | undefined> {
    return getFromApi<Meet>({
        route: '/api/meets',
        params: { name },
        logFields: { query: name },
        resultFields: (meet) => ({
            found: Boolean(meet),
            entryCount: meet?.entries?.length,
        }),
    });
}

export async function getTopLifters(
    page: number = 1,
): Promise<TopLifter[] | undefined> {
    return getFromApi<TopLifter[]>({
        route: '/api/top',
        params: { page },
        logFields: { page },
        resultFields: (topLifters) => ({
            resultCount: topLifters?.length,
        }),
    });
}

export async function getLifterAutocomplete(
    query: string,
    limit: number = 10,
): Promise<string[] | undefined> {
    return getFromApi<string[]>({
        route: '/api/lifters/autocomplete',
        params: { query, limit },
        logFields: { query, queryLength: query.length, limit },
        resultFields: (results) => ({
            resultCount: results?.length,
        }),
    });
}

export async function getMeetAutocomplete(
    query: string,
    limit: number = 10,
): Promise<string[] | undefined> {
    return getFromApi<string[]>({
        route: '/api/meets/autocomplete',
        params: { query, limit },
        logFields: { query, queryLength: query.length, limit },
        resultFields: (results) => ({
            resultCount: results?.length,
        }),
    });
}
