import { Client, Events } from 'discord.js';
import logger from '../logging/logger';

export default {
    name: Events.ClientReady,
    once: true,
    execute(_client: Client) {
        logger.info({ event: 'bot.ready' }, 'bot ready');
    },
};
