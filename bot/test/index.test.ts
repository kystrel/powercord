import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const bot = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
const logger = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('../src/bot', () => ({ createBot: () => bot }));
vi.mock('../src/logging/logger', () => ({ default: logger }));
let signals: Map<string, () => void>;
let exit: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    bot.start.mockResolvedValue(undefined);
    bot.stop.mockResolvedValue(undefined);
    signals = new Map();
    vi.spyOn(process, 'on').mockImplementation((signal, listener) => {
        signals.set(String(signal), listener);
        return process;
    });
    exit = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('entry point shutdown', () => {
    it.each(['SIGINT', 'SIGTERM'])(
        'closes the bot before exiting on %s',
        async (signal) => {
            let finish!: () => void;
            bot.stop.mockReturnValue(
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
            );
            await import('../src/index');
            signals.get(signal)?.();
            signals.get(signal)?.();
            expect(bot.stop).toHaveBeenCalledOnce();
            expect(exit).not.toHaveBeenCalled();
            finish();
            await vi.advanceTimersByTimeAsync(0);
            expect(exit).toHaveBeenCalledWith(0);
            expect(vi.getTimerCount()).toBe(0);
        },
    );
    it('cleans up and exits nonzero on startup failure', async () => {
        bot.start.mockRejectedValue(new Error('invalid configuration'));
        await import('../src/index');
        await vi.advanceTimersByTimeAsync(0);
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'bot.startup_failed',
                errorMessage: 'invalid configuration',
            }),
            'bot startup failed',
        );
        expect(bot.stop).toHaveBeenCalledOnce();
        expect(exit).toHaveBeenCalledWith(1);
    });
    it('exits nonzero if cleanup hangs for ten seconds', async () => {
        bot.stop.mockReturnValue(new Promise(() => {}));
        await import('../src/index');
        signals.get('SIGTERM')?.();
        await vi.advanceTimersByTimeAsync(9999);
        expect(exit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(exit).toHaveBeenCalledWith(1);
        expect(logger.error).toHaveBeenCalledWith(
            { event: 'bot.shutdown_timeout' },
            'bot shutdown timed out',
        );
    });
    it('exits nonzero if cleanup fails', async () => {
        bot.stop.mockRejectedValue(new Error('close failed'));
        await import('../src/index');
        signals.get('SIGTERM')?.();
        await vi.advanceTimersByTimeAsync(0);
        expect(exit).toHaveBeenCalledWith(1);
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'bot.shutdown_failed' }),
            'bot shutdown failed',
        );
        expect(vi.getTimerCount()).toBe(0);
    });
});
