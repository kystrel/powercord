import { describe, expect, it } from 'vitest';
import { lifterData } from '../../src/data/mock/lifter';
import { meetData } from '../../src/data/mock/meet';
import { topLifterData } from '../../src/data/mock/top';
import {
    getLifter,
    getLifterAutocomplete,
    getMeet,
    getMeetAutocomplete,
    getTopLifters,
} from '../../src/data/mockClient';

describe('mockClient', () => {
    describe('getLifter', () => {
        it('returns the lifter with an exact match', async () => {
            const result = await getLifter('Heracles');
            expect(result).toEqual(
                lifterData.find((l) => l.name === 'Heracles'),
            );
        });

        it('returns the closest matching lifter with fuzzy search', async () => {
            const result = await getLifter('Herac');
            expect(result?.name).toBe('Heracles');
        });

        it('returns undefined when no close match exists', async () => {
            const result = await getLifter('NonExistentName');
            expect(result).toBeUndefined();
        });
    });

    describe('getMeet', () => {
        it('returns the meet with an exact match', async () => {
            const result = await getMeet(
                'ipf/GRC-2025-06-15-labors-of-strength',
            );
            expect(result).toEqual(
                meetData.find((m) => m.name === 'Labors of Strength'),
            );
        });

        it('accepts a unique legacy name', async () => {
            const result = await getMeet(' 2025 ipf labors of strength ');
            expect(result?.name).toBe('Labors of Strength');
        });

        it('returns undefined when no close match exists', async () => {
            const result = await getMeet('NonExistentMeet');
            expect(result).toBeUndefined();
        });
    });

    describe('getLifterAutocomplete', () => {
        it('returns matching lifter names for a query', async () => {
            const result = await getLifterAutocomplete('Herac');
            expect(result).toContain('Heracles');
        });

        it('respects the limit parameter', async () => {
            const result = await getLifterAutocomplete('a', 2);
            expect(result).toHaveLength(2);
        });

        it('returns an empty array when no names match', async () => {
            const result = await getLifterAutocomplete('zzznomatch');
            expect(result).toEqual([]);
        });

        it('returns up to 10 results by default', async () => {
            const result = await getLifterAutocomplete('a');
            expect(result!.length).toBeLessThanOrEqual(10);
        });
    });

    describe('getMeetAutocomplete', () => {
        it('keeps same-name meets selectable and rejects ambiguous legacy names', async () => {
            const original = meetData[0];
            const other = {
                ...original,
                date: '2025-06-16',
                url: 'https://www.openpowerlifting.org/m/ipf/2502',
            };
            meetData.push(other);
            try {
                const choices = await getMeetAutocomplete(
                    '2025 IPF Labors of Strength',
                );
                expect(choices).toHaveLength(2);
                expect(choices).toContainEqual({
                    name: '2025-06-15 [ipf/GRC-2025-06-15-labors-of-strength] IPF Labors of Strength',
                    value: 'ipf/GRC-2025-06-15-labors-of-strength',
                });
                expect(choices?.map((choice) => choice.value)).toContain(
                    'ipf/2502',
                );
                expect(await getMeet('ipf/2502')).toEqual(other);
                expect(await getMeetAutocomplete('2025-06-16', 1)).toEqual([
                    {
                        name: '2025-06-16 [ipf/2502] IPF Labors of Strength',
                        value: 'ipf/2502',
                    },
                ]);
                expect(
                    await getMeet('ipf/GRC-2025-06-15-labors-of-strength'),
                ).toEqual(original);
                await expect(
                    getMeet('2025 IPF Labors of Strength'),
                ).rejects.toThrow('Select a meet from autocomplete');
                expect(await getMeet('Labor of Strength')).toBeUndefined();
            } finally {
                meetData.pop();
            }
        });

        it('returns matching meet names for a query', async () => {
            const result = await getMeetAutocomplete('Labor');
            expect(result).toContainEqual({
                name: '2025 IPF Labors of Strength',
                value: 'ipf/GRC-2025-06-15-labors-of-strength',
            });
        });

        it.each(['2025-06-15', 'ipf/GRC-2025-06-15-labors-of-strength'])(
            'keeps unique meets searchable by %s',
            async (query) => {
                expect(await getMeetAutocomplete(query, 1)).toEqual([
                    {
                        name: '2025 IPF Labors of Strength',
                        value: 'ipf/GRC-2025-06-15-labors-of-strength',
                    },
                ]);
            },
        );

        it('respects the limit parameter', async () => {
            const result = await getMeetAutocomplete('a', 1);
            expect(result).toHaveLength(1);
        });

        it('returns an empty array when no names match', async () => {
            const result = await getMeetAutocomplete('zzznomatch');
            expect(result).toEqual([]);
        });

        it('returns up to 10 results by default', async () => {
            const result = await getMeetAutocomplete('a');
            expect(result!.length).toBeLessThanOrEqual(10);
        });
    });

    describe('getTopLifters', () => {
        it('returns the first page of top lifters by default', async () => {
            const result = await getTopLifters();
            expect(result).toEqual(topLifterData.slice(0, 5));
        });

        it('returns the specified page of top lifters', async () => {
            const result = await getTopLifters(2);
            expect(result).toEqual(topLifterData.slice(5, 10));
        });

        it('returns an empty array for out-of-bounds pages', async () => {
            const result = await getTopLifters(10);
            expect(result).toEqual([]);
        });
    });
});
