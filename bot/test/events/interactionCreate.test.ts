import { MessageFlags } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import interactionCreate from '../../src/events/interactionCreate';
import logger from '../../src/logging/logger';

vi.mock('discord.js', () => ({
    Events: { InteractionCreate: 'interactionCreate' },
    MessageFlags: { Ephemeral: 64 },
}));

vi.mock('../../src/logging/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const makeCommandsMap = (command?: object) => {
    const map = new Map();
    if (command) map.set('testCmd', command);
    return map;
};

const makeAutocompleteInteraction = (
    commandName = 'testCmd',
    commands?: Map<string, any>,
) =>
    ({
        isAutocomplete: vi.fn().mockReturnValue(true),
        isChatInputCommand: vi.fn().mockReturnValue(false),
        commandName,
        client: { commands: commands ?? makeCommandsMap() },
    }) as any;

const makeChatInteraction = (
    opts: { replied?: boolean; deferred?: boolean } = {},
    commands?: Map<string, any>,
) =>
    ({
        isAutocomplete: vi.fn().mockReturnValue(false),
        isChatInputCommand: vi.fn().mockReturnValue(true),
        commandName: 'testCmd',
        replied: opts.replied ?? false,
        deferred: opts.deferred ?? false,
        followUp: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
        client: { commands: commands ?? makeCommandsMap() },
    }) as any;

describe('interactionCreate event', () => {
    const { execute } = interactionCreate;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('autocomplete interactions', () => {
        it('logs error and returns when no matching command is found', async () => {
            const interaction = makeAutocompleteInteraction('unknown');
            await execute(interaction);

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'interaction.command_missing',
                    interactionType: 'autocomplete',
                    commandName: 'unknown',
                }),
                'interaction command missing',
            );
        });

        it('returns silently when command has no autocomplete handler', async () => {
            const command = { execute: vi.fn() };
            const interaction = makeAutocompleteInteraction(
                'testCmd',
                makeCommandsMap(command),
            );
            await execute(interaction);

            expect(command.execute).not.toHaveBeenCalled();
        });

        it('calls command.autocomplete with the interaction', async () => {
            const command = {
                autocomplete: vi.fn().mockResolvedValue(undefined),
            };
            const interaction = makeAutocompleteInteraction(
                'testCmd',
                makeCommandsMap(command),
            );
            await execute(interaction);

            expect(command.autocomplete).toHaveBeenCalledWith(interaction);
        });

        it('logs error when autocomplete throws', async () => {
            const command = {
                autocomplete: vi.fn().mockRejectedValue(new Error('ac error')),
            };
            const interaction = makeAutocompleteInteraction(
                'testCmd',
                makeCommandsMap(command),
            );
            await execute(interaction);

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'interaction.autocomplete_failed',
                    commandName: 'testCmd',
                    err: expect.any(Error),
                }),
                'interaction autocomplete failed',
            );
        });
    });

    describe('non-chat-input interactions', () => {
        it('returns early without calling any command', async () => {
            const command = { execute: vi.fn() };
            const interaction = {
                isAutocomplete: vi.fn().mockReturnValue(false),
                isChatInputCommand: vi.fn().mockReturnValue(false),
                client: { commands: makeCommandsMap(command) },
            } as any;
            await execute(interaction);

            expect(command.execute).not.toHaveBeenCalled();
        });
    });

    describe('chat input command interactions', () => {
        it('logs error and returns when no matching command is found', async () => {
            const interaction = makeChatInteraction({}, makeCommandsMap());
            await execute(interaction);

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'interaction.command_missing',
                    interactionType: 'chat_input',
                    commandName: 'testCmd',
                }),
                'interaction command missing',
            );
        });

        it('calls command.execute with the interaction', async () => {
            const command = { execute: vi.fn().mockResolvedValue(undefined) };
            const interaction = makeChatInteraction(
                {},
                makeCommandsMap(command),
            );
            await execute(interaction);

            expect(command.execute).toHaveBeenCalledWith(interaction);
        });

        it('calls followUp with ephemeral error message when command throws and already replied', async () => {
            const command = {
                execute: vi.fn().mockRejectedValue(new Error('boom')),
            };
            const interaction = makeChatInteraction(
                { replied: true },
                makeCommandsMap(command),
            );
            await execute(interaction);

            expect(interaction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: 'There was an error while executing this command!',
                    flags: MessageFlags.Ephemeral,
                }),
            );
        });

        it('calls reply with ephemeral error message when command throws and not yet replied', async () => {
            const command = {
                execute: vi.fn().mockRejectedValue(new Error('boom')),
            };
            const interaction = makeChatInteraction(
                { replied: false, deferred: false },
                makeCommandsMap(command),
            );
            await execute(interaction);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: 'There was an error while executing this command!',
                    flags: MessageFlags.Ephemeral,
                }),
            );
        });

        it('calls followUp when command throws and interaction is deferred', async () => {
            const command = {
                execute: vi.fn().mockRejectedValue(new Error('boom')),
            };
            const interaction = makeChatInteraction(
                { replied: false, deferred: true },
                makeCommandsMap(command),
            );
            await execute(interaction);

            expect(interaction.followUp).toHaveBeenCalled();
        });
    });
});
