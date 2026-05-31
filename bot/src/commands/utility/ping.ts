import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import {
    elapsedMs,
    errorLogFields,
    interactionLocation,
} from '../../logging/fields';
import logger from '../../logging/logger';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),
    async execute(interaction: ChatInputCommandInteraction) {
        const startedAt = Date.now();
        const logContext = interactionLocation(interaction);

        try {
            await interaction.reply('Pong!');
            logger.info(
                {
                    event: 'command.completed',
                    commandName: 'ping',
                    outcome: 'success',
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                },
                'command completed',
            );
        } catch (error) {
            logger.error(
                {
                    event: 'command.failed',
                    commandName: 'ping',
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                    ...errorLogFields(error),
                },
                'command failed',
            );
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: 'An error occurred.',
                });
            } else {
                await interaction.reply({
                    content: 'An error occurred.',
                    ephemeral: true,
                });
            }
        }
    },
};
