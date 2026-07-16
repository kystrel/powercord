import { errorLogFields } from '../logging/fields';
import logger from '../logging/logger';
import { isBotReady } from './botState';
import { config } from './config';
import { discardResponseBody, fetchOk } from './http';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const HEARTBEAT_TIMEOUT_MS = 5000;

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
        const response = await fetchOk(config.BETTERSTACK_HEARTBEAT_URL!, {
            signal: AbortSignal.timeout(HEARTBEAT_TIMEOUT_MS),
        });
        await discardResponseBody(response);
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
