import type { APIEmbed, APIEmbedField, EmbedBuilder } from 'discord.js';

export const DISCORD_LIMITS = {
    message: 2_000,
    embed: {
        title: 256,
        description: 4_096,
        authorName: 256,
        footerText: 2_048,
        fieldName: 256,
        fieldValue: 1_024,
        fields: 25,
        total: 6_000,
    },
} as const;

export function escapeDiscordMarkdown(value: string): string {
    return value
        .replace(/@(everyone|here)\b/g, '@\u200B$1')
        .replace(/([\\`*_{}\[\]()#+\-.!|>~])/g, '\\$1');
}

export function escapeDiscordCodeBlock(value: string): string {
    return value.replaceAll('`', '`\u200B');
}

export function formatDiscordCodeBlock(
    value: string,
    maxLength: number,
): string {
    const wrapperLength = 6;
    if (maxLength <= wrapperLength) {
        throw new RangeError('maxLength must leave room for a code block');
    }

    const content = truncateDiscordText(
        escapeDiscordCodeBlock(value),
        maxLength - wrapperLength,
    );
    return `\`\`\`${content}\`\`\``;
}

export function truncateDiscordText(value: string, maxLength: number): string {
    if (!Number.isInteger(maxLength) || maxLength < 1) {
        throw new RangeError('maxLength must be a positive integer');
    }

    if (value.length <= maxLength) return value;
    if (maxLength === 1) return '…';

    let truncated = value.slice(0, maxLength - 1);
    const finalCodeUnit = truncated.charCodeAt(truncated.length - 1);
    if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) {
        truncated = truncated.slice(0, -1);
    }

    truncated = truncated.replace(/\\+$/, '');
    return `${truncated}…`;
}

export function sanitizeDiscordText(value: string, maxLength: number): string {
    return truncateDiscordText(escapeDiscordMarkdown(value), maxLength);
}

function countEmbedCharacters(embed: APIEmbed): number {
    return (
        (embed.title?.length ?? 0) +
        (embed.description?.length ?? 0) +
        (embed.author?.name.length ?? 0) +
        (embed.footer?.text.length ?? 0) +
        (embed.fields?.reduce(
            (total, field) => total + field.name.length + field.value.length,
            0,
        ) ?? 0)
    );
}

function shrinkText(
    value: string,
    excess: number,
    minimumLength: number,
): { value: string; excess: number } {
    if (excess <= 0 || value.length <= minimumLength) {
        return { value, excess };
    }

    const targetLength = Math.max(minimumLength, value.length - excess);
    const shortened = truncateDiscordText(value, targetLength);
    return {
        value: shortened,
        excess: excess - (value.length - shortened.length),
    };
}

export function enforceEmbedLimits(embed: EmbedBuilder): EmbedBuilder {
    const data = embed.data;
    const fields: APIEmbedField[] = (data.fields ?? [])
        .slice(0, DISCORD_LIMITS.embed.fields)
        .map((field) => ({
            ...field,
            name: truncateDiscordText(
                field.name,
                DISCORD_LIMITS.embed.fieldName,
            ),
            value: truncateDiscordText(
                field.value,
                DISCORD_LIMITS.embed.fieldValue,
            ),
        }));

    if (data.title) {
        embed.setTitle(
            truncateDiscordText(data.title, DISCORD_LIMITS.embed.title),
        );
    }
    if (data.description) {
        embed.setDescription(
            truncateDiscordText(
                data.description,
                DISCORD_LIMITS.embed.description,
            ),
        );
    }
    if (data.author) {
        embed.setAuthor({
            name: truncateDiscordText(
                data.author.name,
                DISCORD_LIMITS.embed.authorName,
            ),
            iconURL: data.author.icon_url,
            url: data.author.url,
        });
    }
    if (data.footer) {
        embed.setFooter({
            text: truncateDiscordText(
                data.footer.text,
                DISCORD_LIMITS.embed.footerText,
            ),
            iconURL: data.footer.icon_url,
        });
    }
    embed.setFields(fields);

    let excess =
        countEmbedCharacters(embed.toJSON()) - DISCORD_LIMITS.embed.total;
    if (excess <= 0) return embed;

    if (embed.toJSON().footer) {
        const currentFooter = embed.toJSON().footer!;
        const result = shrinkText(currentFooter.text, excess, 1);
        embed.setFooter({
            text: result.value,
            iconURL: currentFooter.icon_url,
        });
        excess = result.excess;
    }

    if (excess > 0 && embed.toJSON().author) {
        const currentAuthor = embed.toJSON().author!;
        const result = shrinkText(currentAuthor.name, excess, 1);
        embed.setAuthor({
            name: result.value,
            iconURL: currentAuthor.icon_url,
            url: currentAuthor.url,
        });
        excess = result.excess;
    }

    for (let index = fields.length - 1; index >= 0 && excess > 0; index--) {
        const valueResult = shrinkText(fields[index].value, excess, 1);
        fields[index].value = valueResult.value;
        excess = valueResult.excess;

        const nameResult = shrinkText(fields[index].name, excess, 1);
        fields[index].name = nameResult.value;
        excess = nameResult.excess;
    }
    embed.setFields(fields);

    if (excess > 0 && embed.toJSON().description) {
        const currentDescription = embed.toJSON().description!;
        const result = shrinkText(currentDescription, excess, 1);
        embed.setDescription(result.value);
        excess = result.excess;
    }

    if (excess > 0 && embed.toJSON().title) {
        const currentTitle = embed.toJSON().title!;
        const result = shrinkText(currentTitle, excess, 1);
        embed.setTitle(result.value);
        excess = result.excess;
    }

    return embed;
}
