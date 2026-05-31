import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from 'discord.js';
import {
    elapsedMs,
    errorLogFields,
    interactionLocation,
} from '../../logging/fields';
import logger from '../../logging/logger';

// Function to get the last update date from the database
// export function getLastUpdate(): { UpdatedDate: string } {
//     const db = DatabaseManager.getInstance().getDB();

//     const query = `
//     SELECT "UpdatedDate" FROM "main"."opl_data_version" LIMIT 1
//     `;

//     return db.prepare(query).get() as { UpdatedDate: string };
// }

// Command definition
module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription(`Returns the bot's status`),
    async execute(interaction: ChatInputCommandInteraction) {
        const startedAt = Date.now();
        const logContext = interactionLocation(interaction);

        try {
            // Latency calculation
            const sent = await interaction.reply({
                content: 'Pong!',
                fetchReply: true,
            });
            const latency =
                sent.createdTimestamp - interaction.createdTimestamp;
            // await interaction.editReply(`Pong! Latency is ${latency}ms`);

            // Uptime calculation
            const uptimeInSeconds = process.uptime();
            const hours = Math.floor(uptimeInSeconds / 3600);
            const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
            const seconds = Math.floor(uptimeInSeconds % 60);

            // await interaction.editReply(
            //     `
            //     Pong! Latency is ${latency}ms.
            //     The bot has been online for ${hours} hours, ${minutes} minutes, and ${seconds} seconds.
            //     `
            // );

            // Server and user count
            const client = interaction.client; // Access the client from the interaction object
            await client.guilds.fetch();
            const serverCount = client.guilds.cache.size;
            const userCount = client.users.cache.size;
            // await interaction.editReply(`The bot is in ${serverCount} servers with a total of ${userCount} users`);

            // Last update from the database
            // const lastUpdate = getLastUpdate().UpdatedDate;
            // await interaction.editReply(`Extracted Date, ${lastUpdate}`);

            // Create an embed to display the status
            const embed = new EmbedBuilder()
                .setColor('#c62932')
                .setAuthor({
                    name: 'Status',
                })
                .setDescription(
                    `Latency is **${latency}**ms\n\n` +
                        `Uptime: **${hours} hours** and **${minutes} minutes**\n` +
                        `I am currently in **${serverCount} servers** with a total of **${userCount} users**\n\n` +
                        `Credit to [OpenPowerlifting](https://www.openpowerlifting.org/) for data used`,
                );

            // Send the final reply with the embed
            await interaction.editReply({ content: null, embeds: [embed] });
            logger.info(
                {
                    event: 'command.completed',
                    commandName: 'status',
                    outcome: 'success',
                    latency_ms: latency,
                    serverCount,
                    cachedUserCount: userCount,
                    uptimeSeconds: Math.floor(uptimeInSeconds),
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                },
                'command completed',
            );
        } catch (error) {
            logger.error(
                {
                    event: 'command.failed',
                    commandName: 'status',
                    ...logContext,
                    duration_ms: elapsedMs(startedAt),
                    ...errorLogFields(error),
                },
                'command failed',
            );
            throw error;
        }
    },
};
