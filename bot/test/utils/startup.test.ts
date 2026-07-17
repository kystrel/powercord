import { afterEach, describe, expect, it, vi } from 'vitest';
import { exitOnStartupFailure } from '../../src/utils/startup';

const mockLogger = vi.hoisted(() => ({
    error: vi.fn(),
}));

vi.mock('../../src/logging/logger', () => ({ default: mockLogger }));

describe('startup failure handling', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs the failure and exits with a nonzero status', () => {
        const error = new Error('invalid API configuration');
        const exitError = new Error('process exited');
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
            throw exitError;
        }) as typeof process.exit);

        expect(() => exitOnStartupFailure(error)).toThrow(exitError);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'bot.startup_failed',
                errorType: 'Error',
                errorMessage: 'invalid API configuration',
            }),
            'bot startup failed',
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
    });
});
