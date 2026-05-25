require('dotenv').config({ quiet: true });

interface Config {
    CLIENT_ID?: string;
    DISCORD_TOKEN?: string;
    API_BASE_URL?: string;
    ENABLE_MOCK_API?: boolean;
    STATIC_BUCKET?: string;
    AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS: number;
    BETTERSTACK_HEARTBEAT_URL?: string;
}

const DEFAULT_AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS = 300;

function parsePositiveInteger(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
    return parsed;
}

export const config: Config = {
    CLIENT_ID: process.env.CLIENT_ID,
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    API_BASE_URL: process.env.API_BASE_URL,
    ENABLE_MOCK_API: process.env.ENABLE_MOCK_API === 'true',
    STATIC_BUCKET: process.env.STATIC_BUCKET,
    AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS:
        parsePositiveInteger(
            process.env.AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS,
        ) ?? DEFAULT_AUTOCOMPLETE_REFRESH_INTERVAL_SECONDS,
    BETTERSTACK_HEARTBEAT_URL: process.env.BETTERSTACK_HEARTBEAT_URL,
};

export default config;
