import { createBot } from './bot';
import { errorLogFields } from './logging/fields';
import logger from './logging/logger';

const bot = createBot();
let stopping = false;

function shutdown(exitCode: number) {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => {
        logger.error(
            { event: 'bot.shutdown_timeout' },
            'bot shutdown timed out',
        );
        process.exit(1);
    }, 10000);
    void bot.stop().then(
        () => {
            clearTimeout(timeout);
            process.exit(exitCode);
        },
        (error: unknown) => {
            logger.error(
                { event: 'bot.shutdown_failed', ...errorLogFields(error) },
                'bot shutdown failed',
            );
            clearTimeout(timeout);
            process.exit(1);
        },
    );
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
void bot.start().catch((error: unknown) => {
    logger.error(
        { event: 'bot.startup_failed', ...errorLogFields(error) },
        'bot startup failed',
    );
    shutdown(1);
});
