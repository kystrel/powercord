import type { Client } from 'discord.js';

type DiscordClientState = Pick<Client, 'isReady'>;

let discordClient: DiscordClientState | undefined;

export function setDiscordClient(client: DiscordClientState | undefined): void {
    discordClient = client;
}

export function isBotReady(): boolean {
    return discordClient?.isReady() ?? false;
}
