import { Events, Interaction, MessageFlags } from 'discord.js';
import { errorLogFields, interactionLocation } from '../logging/fields';
import logger from '../logging/logger';

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(
                interaction.commandName,
            );

            if (!command) {
                logger.warn(
                    {
                        event: 'interaction.command_missing',
                        interactionType: 'autocomplete',
                        commandName: interaction.commandName,
                        ...interactionLocation(interaction),
                    },
                    'interaction command missing',
                );
                return;
            }

            if (!command.autocomplete) {
                return;
            }

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                logger.error(
                    {
                        event: 'interaction.autocomplete_failed',
                        commandName: interaction.commandName,
                        ...interactionLocation(interaction),
                        ...errorLogFields(error),
                    },
                    'interaction autocomplete failed',
                );
            }
            return;
        }
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(
            interaction.commandName,
        );

        if (!command) {
            logger.warn(
                {
                    event: 'interaction.command_missing',
                    interactionType: 'chat_input',
                    commandName: interaction.commandName,
                    ...interactionLocation(interaction),
                },
                'interaction command missing',
            );
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            logger.error(
                {
                    event: 'interaction.command_failed',
                    commandName: interaction.commandName,
                    ...interactionLocation(interaction),
                    ...errorLogFields(error),
                },
                'interaction command failed',
            );
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'There was an error while executing this command!',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: 'There was an error while executing this command!',
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};
