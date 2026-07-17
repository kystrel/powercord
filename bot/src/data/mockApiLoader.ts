import type * as ApiClient from './apiClient';

export function loadMockClient(): typeof ApiClient {
    return require('./mockClient') as typeof ApiClient;
}
