import { Client } from 'discord.js';
import logger from '../logging/logger';

export default {
    execute(_client: Client) {
        logger.info({ event: 'bot.ready' }, 'bot ready');
    },
};
