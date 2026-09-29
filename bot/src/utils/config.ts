require('dotenv').config({ quiet: true });

interface Config {
    NODE_ENV?: string;
    CLIENT_ID?: string;
    DISCORD_TOKEN?: string;
    DISCORD_GUILD_ID?: string;
    SQLITE_PATH?: string;
    ENABLE_MOCK_API?: boolean;
    BETTERSTACK_HEARTBEAT_URL?: string;
}

export const config: Config = {
    NODE_ENV: process.env.NODE_ENV,
    CLIENT_ID: process.env.CLIENT_ID,
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    SQLITE_PATH: process.env.SQLITE_PATH,
    ENABLE_MOCK_API: process.env.ENABLE_MOCK_API === 'true',
    BETTERSTACK_HEARTBEAT_URL: process.env.BETTERSTACK_HEARTBEAT_URL,
};

export default config;
