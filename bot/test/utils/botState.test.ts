import { beforeEach, describe, expect, it, vi } from 'vitest';

let botState: typeof import('../../src/utils/botState');

describe('botState', () => {
    beforeEach(async () => {
        vi.resetModules();
        botState = await import('../../src/utils/botState');
    });

    it('is not ready before a Discord client is registered', () => {
        expect(botState.isBotReady()).toBe(false);
    });

    it('reflects the Discord client readiness state', () => {
        const isReady = vi.fn().mockReturnValue(false);
        botState.setDiscordClient({ isReady });

        expect(botState.isBotReady()).toBe(false);

        isReady.mockReturnValue(true);
        expect(botState.isBotReady()).toBe(true);
    });
});
