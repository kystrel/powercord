import { SlashCommandBuilder } from 'discord.js';

export const lifterCommandDefinition = new SlashCommandBuilder()
    .setName('lifter')
    .setDescription(`Displays lifter's last 3 meets`)
    .addStringOption((option) =>
        option
            .setName('name')
            .setDescription('The name of the lifter')
            .setRequired(true)
            .setAutocomplete(true),
    );

export const meetCommandDefinition = new SlashCommandBuilder()
    .setName('meet')
    .setDescription(`Displays meet's top lifters with pagination`)
    .addStringOption((option) =>
        option
            .setName('name')
            .setDescription('Name of the meet')
            .setRequired(true)
            .setAutocomplete(true),
    );

export const topCommandDefinition = new SlashCommandBuilder()
    .setName('top')
    .setDescription('Display top ranked lifters');

export const pingCommandDefinition = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!');

export const statusCommandDefinition = new SlashCommandBuilder()
    .setName('status')
    .setDescription(`Returns the bot's status`);

export const commandDefinitions = [
    lifterCommandDefinition,
    meetCommandDefinition,
    topCommandDefinition,
    pingCommandDefinition,
    statusCommandDefinition,
] as const;
