import { errorLogFields } from '../logging/fields';
import logger from '../logging/logger';

export function exitOnStartupFailure(error: unknown): never {
    logger.error(
        {
            event: 'bot.startup_failed',
            ...errorLogFields(error),
        },
        'bot startup failed',
    );
    return process.exit(1);
}
