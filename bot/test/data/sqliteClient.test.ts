import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteClient } from '../../src/data/sqliteClient';

const directories: string[] = [];

function snapshot(schemaVersion = 1): string {
    const directory = mkdtempSync(join(tmpdir(), 'powercord-sqlite-'));
    directories.push(directory);
    const file = join(directory, 'snapshot.sqlite');
    const db = new DatabaseSync(file);
    db.exec(`
        CREATE TABLE metadata (schema_version INTEGER, source_revision TEXT, lifters INTEGER, meets INTEGER);
        CREATE TABLE lifters (lifter_id INTEGER PRIMARY KEY, name TEXT, lifter_key TEXT);
        CREATE TABLE meets (meet_id INTEGER PRIMARY KEY, federation TEXT, meet_date TEXT,
            meet_country TEXT, meet_state TEXT, meet_town TEXT, meet_name TEXT);
        CREATE TABLE entries (entry_id INTEGER PRIMARY KEY, meet_id INTEGER, lifter_id INTEGER,
            place TEXT, sex TEXT, age REAL, equipment TEXT, division TEXT, bodyweight_kg REAL,
            weight_class_kg REAL, best3_squat_kg REAL, best3_bench_kg REAL,
            best3_deadlift_kg REAL, total_kg REAL, dots REAL);
        CREATE INDEX top_lifters ON entries(dots DESC, lifter_id)
            WHERE equipment IN ('Raw', 'Wraps') AND dots > 0;
        INSERT INTO metadata VALUES (${schemaVersion}, 'revision123', 2, 2);
        INSERT INTO lifters VALUES (1, 'Taylor Atwood', 'taylor atwood'), (2, 'Jane Doe', 'jane doe');
        INSERT INTO meets VALUES
            (1, 'USAPL', '2025-06-15', 'USA', 'TX', 'Austin', 'Raw Nationals'),
            (2, 'IPF', '2024-05-01', 'USA', NULL, NULL, 'World Open');
        INSERT INTO entries VALUES
            (1, 1, 1, '1', 'M', 30.6, 'Raw', 'Open', 74.5, 75, 200, 140, 250, 590, 520.123),
            (2, 1, 2, '2', 'F', 25, 'Raw', 'Open', 65, 69, 150, 90, 190, 430, 470.125),
            (3, 2, 1, '1', 'M', 29, 'Wraps', 'Open', 74.1, 75, 210, 145, 245, 600, 530.456),
            (4, 2, 2, 'NS', 'F', 24, 'Single-ply', 'Open', 65, 69, 160, 100, 190, 450, NULL);
    `);
    db.close();
    const selection = join(directory, 'current.sqlite');
    symlinkSync('snapshot.sqlite', selection);
    return selection;
}

afterEach(() => {
    for (const directory of directories.splice(0))
        rmSync(directory, { recursive: true, force: true });
});

describe('SQLite reader', () => {
    it('resolves the selected file and checks its schema', () => {
        const client = new SqliteClient(snapshot());
        expect(client.status).toMatchObject({
            revision: 'revision123',
            lifterCount: 2,
            meetCount: 2,
        });
        client.close();
        expect(() => new SqliteClient(snapshot(2))).toThrow(
            'Unsupported SQLite snapshot schema',
        );
    });

    it('returns the lifter result shape, recent valid meets, and formatted personal bests', () => {
        const client = new SqliteClient(snapshot());
        expect(client.getLifter('taylor atwood')).toEqual({
            name: 'Taylor Atwood',
            url: 'https://www.openpowerlifting.org/u/tayloratwood',
            meets: [
                {
                    place: 1,
                    federation: 'USAPL',
                    date: '2025-06-15',
                    country: 'USA',
                    state: 'TX',
                    name: 'Raw Nationals',
                    division: 'Open',
                    age: 31,
                    equipment: 'Raw',
                    weightClass: 75,
                    bodyWeight: 74.5,
                    squat: 200,
                    bench: 140,
                    deadlift: 250,
                    total: 590,
                    dots: 520.123,
                },
                {
                    place: 1,
                    federation: 'IPF',
                    date: '2024-05-01',
                    country: 'USA',
                    state: null,
                    name: 'World Open',
                    division: 'Open',
                    age: 29,
                    equipment: 'Wraps',
                    weightClass: 75,
                    bodyWeight: 74.1,
                    squat: 210,
                    bench: 145,
                    deadlift: 245,
                    total: 600,
                    dots: 530.456,
                },
            ],
            personalBests: [
                {
                    equipment: 'Raw',
                    squat: '200.0',
                    bench: '145.0',
                    deadlift: '250.0',
                    total: '590.0',
                    dots: '520.12',
                },
                {
                    equipment: 'Wraps',
                    squat: '210.0',
                    bench: '145.0',
                    deadlift: '250.0',
                    total: '600.0',
                    dots: '530.46',
                },
            ],
        });
        expect(client.getLifter('missing')).toBeUndefined();
        client.close();
    });

    it('selects a meet by autocomplete key and returns its ranked entries', () => {
        const client = new SqliteClient(snapshot());
        expect(client.getMeet('2025 USAPL Raw Nationals')).toEqual({
            name: 'Raw Nationals',
            federation: 'USAPL',
            date: '2025-06-15',
            year: '2025',
            url: null,
            country: 'USA',
            state: 'TX',
            town: 'Austin',
            entries: [
                {
                    place: 1,
                    name: 'Taylor Atwood',
                    sex: 'M',
                    age: 31,
                    equipment: 'Raw',
                    weightClass: 75,
                    bodyWeight: 74.5,
                    squat: 200,
                    bench: 140,
                    deadlift: 250,
                    total: 590,
                    dots: 520.123,
                },
                {
                    place: 2,
                    name: 'Jane Doe',
                    sex: 'F',
                    age: 25,
                    equipment: 'Raw',
                    weightClass: 69,
                    bodyWeight: 65,
                    squat: 150,
                    bench: 90,
                    deadlift: 190,
                    total: 430,
                    dots: 470.125,
                },
            ],
        });
        expect(client.getMeet('Nationals')).toBeUndefined();
        expect(client.getMeet('missing')).toBeUndefined();
        client.close();
    });

    it('ranks one best Raw or Wraps entry per lifter and keeps autocomplete order', () => {
        const client = new SqliteClient(snapshot());
        expect(client.getTopLifters()).toEqual([
            {
                name: 'Taylor Atwood',
                sex: 'M',
                url: 'https://www.openpowerlifting.org/u/tayloratwood',
                squat: 210,
                bench: 145,
                deadlift: 245,
                total: 600,
                dots: 530.456,
            },
            {
                name: 'Jane Doe',
                sex: 'F',
                url: 'https://www.openpowerlifting.org/u/janedoe',
                squat: 150,
                bench: 90,
                deadlift: 190,
                total: 430,
                dots: 470.125,
            },
        ]);
        expect(client.getTopLifters()).toHaveLength(2);
        expect(client.getLifterAutocomplete('atw')).toEqual(['Taylor Atwood']);
        expect(client.getMeetAutocomplete('raw')).toEqual([
            '2025 USAPL Raw Nationals',
        ]);
        expect(client.getLifterAutocomplete('')).toEqual([]);
        client.close();
    });

    it('returns the complete top list for command pagination', () => {
        const path = snapshot();
        const db = new DatabaseSync(path);
        for (let id = 3; id <= 6; id++) {
            db.prepare('INSERT INTO lifters VALUES (?, ?, ?)').run(
                id,
                `Lifter ${id}`,
                `lifter ${id}`,
            );
            db.prepare(
                `
                INSERT INTO entries(entry_id, meet_id, lifter_id, sex, equipment, dots)
                VALUES (?, 1, ?, 'M', 'Raw', ?)
            `,
            ).run(id + 2, id, 470 - id);
        }
        db.close();

        const client = new SqliteClient(path);
        expect(client.getTopLifters()).toHaveLength(6);
        client.close();
    });

    it('keeps colliding meet display keys as one result', () => {
        const path = snapshot();
        const db = new DatabaseSync(path);
        db.exec(`
            INSERT INTO meets VALUES (3, 'USAPL', '2025-08-01', 'USA', 'CA', 'Oakland', 'Raw Nationals');
            INSERT INTO entries(entry_id, meet_id, lifter_id, place, sex, equipment, dots)
            VALUES (5, 3, 1, '1', 'M', 'Raw', 510);
        `);
        db.close();

        const client = new SqliteClient(path);
        expect(client.getMeet('2025 USAPL Raw Nationals')).toMatchObject({
            date: '2025-08-01',
            town: 'Oakland',
            entries: [{ name: 'Taylor Atwood', dots: 510 }],
        });
        client.close();
    });

    it('does not resolve an ambiguous unsuffixed lifter name', () => {
        const path = snapshot();
        const db = new DatabaseSync(path);
        db.exec("INSERT INTO lifters VALUES (3, 'A. Smith #1', 'a. smith #1')");
        db.close();

        const client = new SqliteClient(path);
        expect(client.getLifter('A. Smith')).toBeUndefined();
        expect(client.getLifter('A. Smith #1')?.name).toBe('A. Smith #1');
        client.close();
    });

    it('matches Unicode case variants in a meet display key', () => {
        const path = snapshot();
        const db = new DatabaseSync(path);
        db.exec(`
            INSERT INTO meets VALUES (3, 'FÉD', '2025-09-01', 'Brazil', NULL, NULL, 'SÃO PAULO');
            INSERT INTO entries(entry_id, meet_id, lifter_id, place, sex, equipment, dots)
            VALUES (5, 3, 1, '1', 'M', 'Raw', 510);
        `);
        db.close();

        const client = new SqliteClient(path);
        expect(client.getMeet('2025 féd são paulo')?.name).toBe('SÃO PAULO');
        client.close();
    });

    it('keeps prefix and word matches ahead of substring autocomplete matches', () => {
        const path = snapshot();
        const db = new DatabaseSync(path);
        db.exec(`
            INSERT INTO lifters VALUES
                (3, 'Sam Lee', 'sam lee'),
                (4, 'A Sam', 'a sam'),
                (5, 'Rosamund', 'rosamund');
        `);
        db.close();

        const client = new SqliteClient(path);
        expect(client.getLifterAutocomplete('sam', 2)).toEqual([
            'A Sam',
            'Sam Lee',
        ]);
        expect(client.getLifterAutocomplete('sam', 3)).toEqual([
            'A Sam',
            'Sam Lee',
            'Rosamund',
        ]);
        client.close();
    });

    it('keeps OpenPowerlifting URLs for Latin and East Asian names', () => {
        const path = snapshot();
        const db = new DatabaseSync(path);
        db.exec(`
            INSERT INTO lifters VALUES
                (3, 'Petr Petráš', 'petr petráš'),
                (4, '武田 裕介', '武田 裕介');
        `);
        db.close();

        const client = new SqliteClient(path);
        expect(client.getLifter('Petr Petráš')?.url).toBe(
            'https://www.openpowerlifting.org/u/petrpetras',
        );
        expect(client.getLifter('武田 裕介')?.url).toBe(
            'https://www.openpowerlifting.org/u/ea-27494300003502920171',
        );
        client.close();
    });
});
