import type { Lifter, Meet, MeetChoice, TopLifter } from '../types/types';

type MockClient = {
    getLifter(name: string): Promise<Lifter | undefined>;
    getMeet(name: string): Promise<Meet | undefined>;
    getTopLifters(page?: number): Promise<TopLifter[] | undefined>;
    getLifterAutocomplete(
        query: string,
        limit?: number,
    ): Promise<string[] | undefined>;
    getMeetAutocomplete(
        query: string,
        limit?: number,
    ): Promise<MeetChoice[] | undefined>;
};

export function loadMockClient(): MockClient {
    return require('./mockClient') as MockClient;
}
