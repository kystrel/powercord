import { EmbedBuilder } from 'discord.js';
import { describe, expect, it } from 'vitest';
import {
    DISCORD_LIMITS,
    enforceEmbedLimits,
    escapeDiscordCodeBlock,
    escapeDiscordMarkdown,
    formatDiscordCodeBlock,
    sanitizeDiscordText,
    truncateDiscordText,
} from '../../src/utils/discord';

const countEmbedCharacters = (embed: ReturnType<EmbedBuilder['toJSON']>) =>
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.author?.name.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    (embed.fields?.reduce(
        (total, field) => total + field.name.length + field.value.length,
        0,
    ) ?? 0);

describe('Discord text utilities', () => {
    it('escapes Discord markdown and mention syntax', () => {
        expect(escapeDiscordMarkdown('<@123> **bold** [link](url)')).toBe(
            '<@123\\> \\*\\*bold\\*\\* \\[link\\]\\(url\\)',
        );
    });

    it('breaks embedded code block fences', () => {
        const escaped = escapeDiscordCodeBlock('before```after');

        expect(escaped).not.toContain('```');
        expect(escaped.replaceAll('\u200B', '')).toBe('before```after');
    });

    it('keeps code block wrappers intact while truncating content', () => {
        const block = formatDiscordCodeBlock('x'.repeat(100), 20);

        expect(block).toHaveLength(20);
        expect(block.startsWith('```')).toBe(true);
        expect(block.endsWith('```')).toBe(true);
    });

    it('truncates text without splitting surrogate pairs or escape sequences', () => {
        expect(truncateDiscordText('ab😀cd', 4)).toBe('ab…');
        expect(truncateDiscordText('abc\\def', 5)).toBe('abc…');
    });

    it('escapes before applying the requested limit', () => {
        const result = sanitizeDiscordText('*'.repeat(300), 256);

        expect(result.length).toBeLessThanOrEqual(256);
        expect(result.endsWith('…')).toBe(true);
    });

    it('rejects invalid maximum lengths', () => {
        expect(() => truncateDiscordText('value', 0)).toThrow(RangeError);
        expect(() => formatDiscordCodeBlock('value', 6)).toThrow(RangeError);
    });

    it('enforces individual and aggregate embed limits', () => {
        const embed = new EmbedBuilder({
            title: 't'.repeat(300),
            description: 'd'.repeat(5_000),
            author: { name: 'a'.repeat(300) },
            footer: { text: 'f'.repeat(3_000) },
            fields: Array.from({ length: 5 }, (_, index) => ({
                name: `${index}${'n'.repeat(300)}`,
                value: 'v'.repeat(1_500),
            })),
        });

        enforceEmbedLimits(embed);
        const data = embed.toJSON();

        expect(data.title).toHaveLength(DISCORD_LIMITS.embed.title);
        expect(data.description!.length).toBeLessThanOrEqual(
            DISCORD_LIMITS.embed.description,
        );
        expect(data.author?.name).toHaveLength(DISCORD_LIMITS.embed.authorName);
        expect(data.footer?.text).toHaveLength(DISCORD_LIMITS.embed.footerText);
        expect(data.fields).toHaveLength(5);
        expect(
            data.fields?.every(
                (field) =>
                    field.name.length <= DISCORD_LIMITS.embed.fieldName &&
                    field.value.length <= DISCORD_LIMITS.embed.fieldValue,
            ),
        ).toBe(true);
        expect(countEmbedCharacters(data)).toBeLessThanOrEqual(
            DISCORD_LIMITS.embed.total,
        );
    });
});
