declare namespace NodeJS {
    interface ProcessEnv {
        NODE_ENV?: string;
        CLIENT_ID?: string;
        DISCORD_TOKEN?: string;
        DISCORD_GUILD_ID?: string;
        API_BASE_URL?: string;
        ENABLE_MOCK_API?: string;
        BETTERSTACK_HEARTBEAT_URL?: string;
    }
}
