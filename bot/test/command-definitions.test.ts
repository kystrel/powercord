import { describe, expect, it } from 'vitest';
import { commandDefinitions } from '../src/command-definitions';

describe('commandDefinitions', () => {
    const payloads = commandDefinitions.map((command) => command.toJSON());

    it('defines every globally deployed command exactly once', () => {
        const names = payloads.map((command) => command.name);

        expect(names).toEqual(['lifter', 'meet', 'top', 'ping', 'status']);
        expect(new Set(names).size).toBe(names.length);
    });

    it('preserves command descriptions and autocomplete options', () => {
        expect(
            payloads.map(({ name, description }) => ({ name, description })),
        ).toEqual([
            { name: 'lifter', description: `Displays lifter's last 3 meets` },
            {
                name: 'meet',
                description: `Displays meet's top lifters with pagination`,
            },
            { name: 'top', description: 'Display top ranked lifters' },
            { name: 'ping', description: 'Replies with Pong!' },
            { name: 'status', description: `Returns the bot's status` },
        ]);

        for (const name of ['lifter', 'meet']) {
            expect(
                payloads.find((command) => command.name === name)?.options,
            ).toEqual([
                expect.objectContaining({
                    name: 'name',
                    required: true,
                    autocomplete: true,
                }),
            ]);
        }
    });
});
