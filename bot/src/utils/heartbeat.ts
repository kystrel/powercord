import axios from 'axios';
import { errorLogFields } from '../logging/fields';
import logger from '../logging/logger';
import { isBotReady } from './botState';
import { config } from './config';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds

export function startHeartbeat() {
    if (!config.BETTERSTACK_HEARTBEAT_URL) {
        logger.warn(
            { event: 'heartbeat.unconfigured' },
            'BetterStack heartbeat URL not configured, skipping heartbeat',
        );
        return;
    }

    logger.info(
        { event: 'heartbeat.started', interval_ms: HEARTBEAT_INTERVAL },
        'starting BetterStack heartbeat monitor',
    );
    sendHeartbeat();

    setInterval(() => {
        sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
}

async function sendHeartbeat() {
    if (!isBotReady()) {
        logger.debug(
            { event: 'heartbeat.skipped', reason: 'bot_not_ready' },
            'skipping BetterStack heartbeat while bot is not ready',
        );
        return;
    }

    try {
        await axios.get(config.BETTERSTACK_HEARTBEAT_URL!, { timeout: 5000 });
    } catch (error) {
        logger.error(
            {
                event: 'heartbeat.failed',
                ...errorLogFields(error),
            },
            'failed to send heartbeat to BetterStack',
        );
    }
}
