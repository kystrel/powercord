import { config } from './config';

function isMockApiEnvironment(): boolean {
    return config.NODE_ENV === 'development' || config.NODE_ENV === 'test';
}

export function isMockApiEnabled(): boolean {
    return Boolean(config.ENABLE_MOCK_API && isMockApiEnvironment());
}

export function validateApiConfiguration(): void {
    if (config.ENABLE_MOCK_API && !isMockApiEnvironment()) {
        throw new Error(
            'ENABLE_MOCK_API can only be enabled when NODE_ENV is development or test',
        );
    }

    if (!config.API_BASE_URL && !isMockApiEnabled()) {
        throw new Error(
            'API_BASE_URL is required unless development mock mode is enabled',
        );
    }
}
