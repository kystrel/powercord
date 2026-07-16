import { config } from './config';

export function isMockApiEnabled(): boolean {
    return Boolean(config.ENABLE_MOCK_API && config.NODE_ENV !== 'production');
}

export function validateApiConfiguration(): void {
    if (config.ENABLE_MOCK_API && config.NODE_ENV === 'production') {
        throw new Error(
            'ENABLE_MOCK_API cannot be enabled when NODE_ENV is production',
        );
    }

    if (!config.API_BASE_URL && !isMockApiEnabled()) {
        throw new Error(
            'API_BASE_URL is required unless development mock mode is enabled',
        );
    }
}
