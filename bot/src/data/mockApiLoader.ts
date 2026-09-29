import type * as MockClient from './mockClient';

export function loadMockClient(): typeof MockClient {
    return require('./mockClient') as typeof MockClient;
}
