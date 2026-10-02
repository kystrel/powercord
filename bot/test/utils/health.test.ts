import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { setDiscordClient } from '../../src/utils/botState';
import { startHealthServer } from '../../src/utils/health';

const servers: Server[] = [];

afterEach(async () => {
    setDiscordClient(undefined);
    await Promise.all(
        servers
            .splice(0)
            .map(
                (server) =>
                    new Promise<void>((resolve) =>
                        server.close(() => resolve()),
                    ),
            ),
    );
});

async function listen() {
    const server = await startHealthServer(0);
    servers.push(server);
    const address = server.address();
    if (!address || typeof address === 'string')
        throw new Error('Expected TCP listener');
    return {
        server,
        url: `http://127.0.0.1:${address.port}`,
        port: address.port,
    };
}

describe('health server', () => {
    it('reports liveness and Discord readiness over HTTP', async () => {
        const { url } = await listen();
        const live = await fetch(`${url}/live`);
        expect(live.status).toBe(200);
        expect(await live.json()).toEqual({ status: 'ok' });
        expect(live.headers.has('x-powered-by')).toBe(false);
        const pending = await fetch(`${url}/health`);
        expect(pending.status).toBe(503);
        expect(await pending.json()).toEqual({ status: 'not_ready' });
        setDiscordClient({ isReady: () => true });
        const ready = await fetch(`${url}/health`);
        expect(ready.status).toBe(200);
        expect(await ready.json()).toEqual({ status: 'ok' });
        setDiscordClient(undefined);
        expect((await fetch(`${url}/health`)).status).toBe(503);
    });

    it('rejects an occupied port', async () => {
        const { port } = await listen();
        await expect(startHealthServer(port)).rejects.toMatchObject({
            code: 'EADDRINUSE',
        });
    });

    it('releases the listener on close', async () => {
        const { server, port } = await listen();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        servers.splice(servers.indexOf(server), 1);
        const replacement = await startHealthServer(port);
        servers.push(replacement);
    });
});
