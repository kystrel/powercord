import { describe, expect, it, vi } from 'vitest';
import { isBotReady, setDiscordClient } from '../../src/utils/botState';

describe('botState', () => {
    it('is not ready before a Discord client is registered', () => {
        expect(isBotReady()).toBe(false);
    });

    it('reflects the Discord client readiness state', () => {
        const isReady = vi.fn().mockReturnValue(false);
        setDiscordClient({ isReady });

        expect(isBotReady()).toBe(false);

        isReady.mockReturnValue(true);
        expect(isBotReady()).toBe(true);
    });
});
