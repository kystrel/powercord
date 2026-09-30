import { isMockApiEnabled } from '../utils/apiConfig';
import { apiClient, checkApiHealth, fetchDataStatus } from './apiClient';
import { loadMockClient } from './mockApiLoader';

const useMock = isMockApiEnabled();

export const api = useMock ? loadMockClient() : apiClient;

export async function initializeApiData(): Promise<void> {
    if (!useMock) await checkApiHealth();
}

export async function getDataStatus() {
    return useMock ? undefined : fetchDataStatus();
}
