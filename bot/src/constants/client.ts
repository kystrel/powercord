import { ClientOptions, GatewayIntentBits } from 'discord.js';

export const discordClientOptions = {
    intents: [GatewayIntentBits.Guilds],
    allowedMentions: {
        parse: [],
        repliedUser: false,
    },
} satisfies ClientOptions;
