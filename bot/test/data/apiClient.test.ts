import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getLifter,
    getLifterAutocomplete,
    getMeet,
    getMeetAutocomplete,
    getTopLifters,
} from '../../src/data/apiClient';
import logger from '../../src/logging/logger';
import { Lifter, Meet, TopLifter } from '../../src/types/types';

vi.mock('../../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/utils/config', () => ({
    config: {
        API_BASE_URL: 'http://localhost:8080',
        ENABLE_MOCK_API: false,
    },
}));

const mockGet = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({
            get: mockGet,
            defaults: { baseURL: 'http://localhost:8080' },
        })),
    },
}));

const mockLifter: Lifter = {
    name: 'Jane Doe',
    url: 'https://www.openpowerlifting.org/u/janedoe',
    meets: [
        {
            place: 1,
            federation: 'USAPL',
            date: '2025-07-30',
            country: 'USA',
            state: null,
            name: 'Mock Meet',
            division: null,
            age: null,
            equipment: 'Raw',
            weightClass: null,
            bodyWeight: null,
            squat: null,
            bench: null,
            deadlift: null,
            total: null,
            dots: null,
        },
    ],
    personalBests: [
        {
            equipment: 'Raw',
            squat: '150',
            bench: '100',
            deadlift: '180',
            total: '430',
            dots: '500',
        },
    ],
};

const mockMeet: Meet = {
    name: 'Mock Meet',
    federation: 'USAPL',
    date: '2025-07-30',
    year: '2025',
    url: 'https://www.openpowerlifting.org/m/usapl/USA-2025-07-30-mock-meet',
    country: 'USA',
    state: null,
    town: null,
    entries: [
        {
            place: 1,
            name: 'Jane Doe',
            sex: 'F',
            age: null,
            equipment: 'Raw',
            weightClass: null,
            bodyWeight: null,
            squat: null,
            bench: null,
            deadlift: null,
            total: null,
            dots: null,
        },
    ],
};

const mockTopLifters: TopLifter[] = [
    {
        name: 'Jane Doe',
        sex: 'F',
        url: 'https://www.openpowerlifting.org/u/janedoe',
        squat: 150,
        bench: 100,
        deadlift: 180,
        total: 430,
        dots: 500,
    },
    {
        name: 'John Smith',
        sex: 'M',
        url: 'https://www.openpowerlifting.org/u/johnsmith',
        squat: 200,
        bench: 120,
        deadlift: 220,
        total: 540,
        dots: 480,
    },
];

describe('apiClient', () => {
    beforeEach(() => {
        mockGet.mockReset();
        vi.mocked(logger.error).mockClear();
    });

    it('getLifter returns lifter data from the API', async () => {
        mockGet.mockResolvedValueOnce({ data: mockLifter });
        const result = await getLifter('Jane Doe');

        expect(result).toEqual(mockLifter);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('getMeet returns meet data from the API', async () => {
        mockGet.mockResolvedValueOnce({ data: mockMeet });
        const result = await getMeet('Mock Meet');

        expect(result).toEqual(mockMeet);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('getTopLifters returns top lifter data from the API', async () => {
        mockGet.mockResolvedValueOnce({ data: mockTopLifters });
        const result = await getTopLifters(1);

        expect(result).toEqual(mockTopLifters);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('getLifter returns undefined and logs error on network failure', async () => {
        mockGet.mockRejectedValueOnce(new Error('Network error'));
        const result = await getLifter('Jane Doe');

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'api_client.request_failed',
                route: '/api/lifters',
                query: 'Jane Doe',
                err: expect.any(Error),
            }),
            'api client request failed',
        );
    });

    it('getMeet returns undefined and logs error on network failure', async () => {
        mockGet.mockRejectedValueOnce(new Error('Network error'));
        const result = await getMeet('Mock Meet');

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'api_client.request_failed',
                route: '/api/meets',
                query: 'Mock Meet',
                err: expect.any(Error),
            }),
            'api client request failed',
        );
    });

    it('getTopLifters returns undefined and logs error on network failure', async () => {
        mockGet.mockRejectedValueOnce(new Error('Network error'));
        const result = await getTopLifters(1);

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'api_client.request_failed',
                route: '/api/top',
                page: 1,
                err: expect.any(Error),
            }),
            'api client request failed',
        );
    });

    it('getLifterAutocomplete returns name suggestions from the API', async () => {
        mockGet.mockResolvedValueOnce({ data: ['Jane Doe', 'Jane Smith'] });
        const result = await getLifterAutocomplete('Jane');

        expect(result).toEqual(['Jane Doe', 'Jane Smith']);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('getLifterAutocomplete returns undefined and logs error on network failure', async () => {
        mockGet.mockRejectedValueOnce(new Error('Network error'));
        const result = await getLifterAutocomplete('Jane');

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'api_client.request_failed',
                route: '/api/lifters/autocomplete',
                query: 'Jane',
                err: expect.any(Error),
            }),
            'api client request failed',
        );
    });

    it('getMeetAutocomplete returns meet name suggestions from the API', async () => {
        mockGet.mockResolvedValueOnce({
            data: ['Mock Meet', 'Mock Meet 2'],
        });
        const result = await getMeetAutocomplete('Mock');

        expect(result).toEqual(['Mock Meet', 'Mock Meet 2']);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('getMeetAutocomplete returns undefined and logs error on network failure', async () => {
        mockGet.mockRejectedValueOnce(new Error('Network error'));
        const result = await getMeetAutocomplete('Mock');

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'api_client.request_failed',
                route: '/api/meets/autocomplete',
                query: 'Mock',
                err: expect.any(Error),
            }),
            'api client request failed',
        );
    });
});
