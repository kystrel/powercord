import { describe, expect, it } from 'vitest';
import { discordClientOptions } from '../../src/constants/client';

describe('discordClientOptions', () => {
    it('disables all mentions by default', () => {
        expect(discordClientOptions.allowedMentions).toEqual({
            parse: [],
            repliedUser: false,
        });
    });
});
