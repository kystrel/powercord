import type { Server } from 'node:http';
import express from 'express';
import logger from '../logging/logger';
import { isBotReady } from './botState';

export function startHealthServer(port = 3000): Promise<Server> {
    const app = express();
    app.disable('x-powered-by');
    app.get('/live', (_req, res) => {
        res.send({ status: 'ok' });
    });
    app.get('/health', (_req, res) => {
        const ready = isBotReady();
        res.status(ready ? 200 : 503).send({
            status: ready ? 'ok' : 'not_ready',
        });
    });
    return new Promise((resolve, reject) => {
        const server = app.listen(port, '0.0.0.0', (error?: Error) => {
            if (error) {
                reject(error);
                return;
            }
            logger.info(
                { event: 'health_server.started', port },
                'health check server started',
            );
            resolve(server);
        });
    });
}
