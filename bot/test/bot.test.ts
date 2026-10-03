import fs from 'node:fs';
import { Events } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBot } from '../src/bot';
import interactionCreate from '../src/events/interactionCreate';
import logger from '../src/logging/logger';
import { isBotReady } from '../src/utils/botState';
import { config } from '../src/utils/config';
import * as health from '../src/utils/health';

const api = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({
    isReady: vi.fn(() => true),
    login: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    commands: new Map(),
}));
vi.mock('discord.js', async (original) => ({
    ...(await original<typeof import('discord.js')>()),
    Client: class {
        constructor() {
            return client;
        }
    },
}));
vi.mock('../src/logging/logger', () => ({
    default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../src/data/api', () => ({ initializeApiData: api }));
vi.mock('../src/utils/config', () => ({
    config: {
        NODE_ENV: 'test',
        ENABLE_MOCK_API: true,
        DISCORD_TOKEN: 'test-token',
        BETTERSTACK_HEARTBEAT_URL: undefined,
    },
}));

let bot: ReturnType<typeof createBot>;
let healthUrl: string;
const startHealthServer = health.startHealthServer;

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
    vi.spyOn(health, 'startHealthServer').mockImplementation(async () => {
        const server = await startHealthServer(0);
        const address = server.address();
        if (!address || typeof address === 'string')
            throw new Error('Expected TCP listener');
        healthUrl = `http://127.0.0.1:${address.port}`;
        return server;
    });
    api.mockResolvedValue(undefined);
    client.login.mockResolvedValue('test-token');
    client.destroy.mockResolvedValue(undefined);
    config.DISCORD_TOKEN = 'test-token';
    bot = createBot();
});
afterEach(async () => {
    await bot.stop();
    vi.restoreAllMocks();
});

describe('bot lifecycle', () => {
    it('clears readiness and closes Discord and HTTP on stop', async () => {
        await bot.start();
        expect(isBotReady()).toBe(true);
        expect((await fetch(`${healthUrl}/health`)).status).toBe(200);
        let finish!: () => void;
        client.destroy.mockReturnValue(
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
        );
        const stopped = bot.stop();
        expect(isBotReady()).toBe(false);
        finish();
        await stopped;
        expect(client.destroy).toHaveBeenCalledOnce();
        await expect(fetch(`${healthUrl}/live`)).rejects.toThrow();
        await bot.stop();
        expect(client.destroy).toHaveBeenCalledOnce();
    });

    it('does not log in if stopped while API startup is pending', async () => {
        let finish!: () => void;
        api.mockReturnValue(
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
        );
        const started = bot.start();
        await vi.waitFor(() => expect(api).toHaveBeenCalledOnce());
        await bot.stop();
        finish();
        await started;
        expect(client.login).not.toHaveBeenCalled();
        expect(isBotReady()).toBe(false);
    });

    it('logs rejected interaction handlers without an unhandled rejection', async () => {
        const error = new Error('Discord reply failed');
        vi.spyOn(interactionCreate, 'execute').mockRejectedValue(error);
        await bot.start();
        const handler = client.on.mock.calls.find(
            ([name]) => name === Events.InteractionCreate,
        )?.[1];
        expect(handler).toBeDefined();
        handler({});
        await vi.waitFor(() =>
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'bot.event_failed',
                    err: error,
                }),
                'bot event failed',
            ),
        );
    });

    it('logs Discord gateway errors', async () => {
        await bot.start();
        const error = new Error('gateway disconnected');
        const handler = client.on.mock.calls.find(
            ([name]) => name === Events.Error,
        )?.[1];
        handler(error);
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'discord_gateway.error',
                err: error,
            }),
            'Discord gateway error',
        );
    });

    it('closes HTTP if stopped while listen is pending', async () => {
        const started = bot.start();
        await bot.stop();
        await started;
        expect(client.login).not.toHaveBeenCalled();
        await expect(fetch(`${healthUrl}/live`)).rejects.toThrow();
    });

    it('checks the configured backend outside mock mode', async () => {
        config.ENABLE_MOCK_API = false;
        config.API_BASE_URL = 'http://127.0.0.1:3001';
        try {
            await bot.start();
            expect(api).toHaveBeenCalledOnce();
        } finally {
            config.ENABLE_MOCK_API = true;
            config.API_BASE_URL = undefined;
        }
    });

    it('surfaces API failures and allows cleanup', async () => {
        api.mockRejectedValue(new Error('incompatible API'));
        await expect(bot.start()).rejects.toThrow('incompatible API');
        await bot.stop();
        expect(client.login).not.toHaveBeenCalled();
        await expect(fetch(`${healthUrl}/live`)).rejects.toThrow();
    });

    it('surfaces login failures and destroys the client on cleanup', async () => {
        client.login.mockRejectedValue(new Error('invalid token'));
        await expect(bot.start()).rejects.toThrow('invalid token');
        await bot.stop();
        expect(client.destroy).toHaveBeenCalledOnce();
        expect(isBotReady()).toBe(false);
    });

    it('keeps liveness without claiming Discord readiness when unconfigured', async () => {
        config.DISCORD_TOKEN = undefined;
        await bot.start();
        expect((await fetch(`${healthUrl}/live`)).status).toBe(200);
        expect((await fetch(`${healthUrl}/health`)).status).toBe(503);
        expect(client.login).not.toHaveBeenCalled();
    });
});
