import express from 'express';
import logger from '../logging/logger';
import { isBotReady } from './botState';

const app = express();
const port = 3000;

app.get('/live', (_req, res) => {
    res.send({ status: 'ok' });
});

app.get('/health', (_req, res) => {
    if (isBotReady()) {
        res.send({ status: 'ok' });
        return;
    }

    res.status(503).send({ status: 'not_ready' });
});

app.listen(port, () => {
    logger.info(
        { event: 'health_server.started', port },
        'health check server started',
    );
});
