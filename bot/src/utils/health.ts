import express from 'express';
import logger from '../logging/logger';

const app = express();
const port = 3000;

app.get('/health', (req, res) => {
    res.send({ status: 'ok' });
});

app.listen(port, () => {
    logger.info(
        { event: 'health_server.started', port },
        'health check server started',
    );
});
