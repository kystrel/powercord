import { realpathSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Lifter, Meet, TopLifter } from '../types/types';
import { nameToSlug } from './slug';

type Metadata = {
    schema_version: number;
    source_revision: string;
    lifters: number;
    meets: number;
};

type Entry = {
    place: string | null;
    sex: string | null;
    age: number | null;
    equipment: string | null;
    division: string | null;
    bodyweight_kg: number | null;
    weight_class_kg: number | null;
    best3_squat_kg: number | null;
    best3_bench_kg: number | null;
    best3_deadlift_kg: number | null;
    total_kg: number | null;
    dots: number | null;
};

type MeetEntry = Entry & {
    federation: string;
    meet_date: string;
    meet_country: string;
    meet_state: string | null;
    meet_town: string | null;
    meet_name: string;
    lifter_name: string;
};

type MeetRecord = {
    meet_id: number;
    meet_name: string;
    federation: string;
    meet_date: string;
    meet_country: string;
    meet_state: string | null;
    meet_town: string | null;
};

function all<T>(
    db: DatabaseSync,
    sql: string,
    ...params: SQLInputValue[]
): T[] {
    return db.prepare(sql).all(...params) as T[];
}

function first<T>(
    db: DatabaseSync,
    sql: string,
    ...params: SQLInputValue[]
): T | undefined {
    return db.prepare(sql).get(...params) as T | undefined;
}

function place(value: string | null): number {
    return Number.parseInt(value ?? '', 10) || 0;
}

function age(value: number | null): number | null {
    return value == null ? null : Math.round(value);
}

function lifterUrl(name: string): string {
    return `https://www.openpowerlifting.org/u/${nameToSlug(name)}`;
}

function entryResult(row: Entry) {
    return {
        place: place(row.place),
        age: age(row.age),
        equipment: row.equipment ?? '',
        weightClass: row.weight_class_kg,
        bodyWeight: row.bodyweight_kg,
        squat: row.best3_squat_kg,
        bench: row.best3_bench_kg,
        deadlift: row.best3_deadlift_kg,
        total: row.total_kg,
        dots: row.dots,
    };
}

function searchNames(names: string[], query: string, limit: number): string[] {
    if (!query) return [];
    const max = Number.isFinite(limit)
        ? Math.max(1, Math.min(25, Math.trunc(limit)))
        : 10;
    const lower = query.toLowerCase();
    const result: string[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < names.length; i++) {
        const name = names[i].toLowerCase();
        if (name.startsWith(lower) || name.includes(` ${lower}`)) {
            result.push(names[i]);
            seen.add(i);
            if (result.length === max) return result;
        }
    }
    for (let i = 0; i < names.length; i++) {
        if (!seen.has(i) && names[i].toLowerCase().includes(lower)) {
            result.push(names[i]);
            if (result.length === max) break;
        }
    }
    return result;
}

export class SqliteClient {
    private readonly db: DatabaseSync;
    readonly status: {
        revision: string;
        loadedAt: string;
        lifterCount: number;
        meetCount: number;
    };
    private readonly lifterNames: string[] = [];
    private readonly meetNames: string[] = [];
    private readonly meetIds = new Map<string, number>();

    constructor(path: string) {
        this.db = new DatabaseSync(realpathSync(path), { readOnly: true });
        try {
            const metadata = first<Metadata>(
                this.db,
                'SELECT schema_version, source_revision, lifters, meets FROM metadata',
            );
            if (metadata?.schema_version !== 1 || !metadata.source_revision) {
                throw new Error('Unsupported SQLite snapshot schema');
            }
            for (const row of this.db
                .prepare('SELECT name FROM lifters ORDER BY name')
                .iterate()) {
                this.lifterNames.push(row.name as string);
            }
            for (const row of this.db
                .prepare(
                    'SELECT meet_id, meet_date, federation, meet_name FROM meets ORDER BY meet_date DESC',
                )
                .iterate()) {
                const displayName = `${(row.meet_date as string).slice(0, 4)} ${row.federation} ${row.meet_name}`;
                const key = displayName.toLowerCase().trim();
                const id = row.meet_id as number;
                this.meetNames.push(displayName);
                // The old export kept one meet per display key.
                if (id > (this.meetIds.get(key) ?? 0))
                    this.meetIds.set(key, id);
            }
            this.status = {
                revision: metadata.source_revision,
                loadedAt: new Date().toISOString(),
                lifterCount: metadata.lifters,
                meetCount: metadata.meets,
            };
        } catch (error) {
            this.db.close();
            throw error;
        }
    }

    close(): void {
        this.db.close();
    }

    getLifter(name: string): Lifter | undefined {
        const lifter = first<{ lifter_id: number; name: string }>(
            this.db,
            'SELECT lifter_id, name FROM lifters WHERE lifter_key = ?',
            name.trim().toLowerCase(),
        );
        if (!lifter) return undefined;

        const rows = all<MeetEntry>(
            this.db,
            `
            SELECT e.*, m.federation, m.meet_date, m.meet_country, m.meet_state,
                   m.meet_town, m.meet_name, l.name AS lifter_name
            FROM entries e
            JOIN meets m ON m.meet_id = e.meet_id
            JOIN lifters l ON l.lifter_id = e.lifter_id
            WHERE e.lifter_id = ? AND e.dots > 0
            ORDER BY m.meet_date DESC LIMIT 10
        `,
            lifter.lifter_id,
        );
        const best = first<{
            raw_squat: number | null;
            wraps_squat: number | null;
            bench: number | null;
            deadlift: number | null;
            raw_total: number | null;
            wraps_total: number | null;
            raw_dots: number | null;
            wraps_dots: number | null;
        }>(
            this.db,
            `
            SELECT MAX(CASE WHEN equipment = 'Raw' THEN best3_squat_kg END) AS raw_squat,
                   MAX(CASE WHEN equipment = 'Wraps' THEN best3_squat_kg END) AS wraps_squat,
                   MAX(best3_bench_kg) AS bench, MAX(best3_deadlift_kg) AS deadlift,
                   MAX(CASE WHEN equipment = 'Raw' THEN total_kg END) AS raw_total,
                   MAX(CASE WHEN equipment = 'Wraps' THEN total_kg END) AS wraps_total,
                   MAX(CASE WHEN equipment = 'Raw' THEN dots END) AS raw_dots,
                   MAX(CASE WHEN equipment = 'Wraps' THEN dots END) AS wraps_dots
            FROM entries WHERE lifter_id = ? AND equipment IN ('Raw', 'Wraps') AND dots > 0
        `,
            lifter.lifter_id,
        );
        const personalBests: NonNullable<Lifter['personalBests']> = [];
        if (best) {
            for (const equipment of ['Raw', 'Wraps'] as const) {
                const total =
                    equipment === 'Raw' ? best.raw_total : best.wraps_total;
                const dots =
                    equipment === 'Raw' ? best.raw_dots : best.wraps_dots;
                if (total == null || dots == null) continue;
                const squat =
                    equipment === 'Raw' ? best.raw_squat : best.wraps_squat;
                personalBests.push({
                    equipment,
                    squat: squat?.toFixed(1) ?? null,
                    bench: best.bench?.toFixed(1) ?? null,
                    deadlift: best.deadlift?.toFixed(1) ?? null,
                    total: total.toFixed(1),
                    dots: dots.toFixed(2),
                });
            }
        }
        return {
            name: lifter.name,
            url: lifterUrl(lifter.name),
            meets: rows.map((row) => ({
                ...entryResult(row),
                federation: row.federation,
                date: row.meet_date,
                country: row.meet_country,
                state: row.meet_state,
                name: row.meet_name,
                division: row.division,
            })),
            personalBests: personalBests.length ? personalBests : null,
        };
    }

    getMeet(name: string): Meet | undefined {
        const id = this.meetIds.get(name.toLowerCase().trim());
        if (id === undefined) return undefined;
        const meet = first<MeetRecord>(
            this.db,
            `
            SELECT meet_id, meet_name, federation, meet_date, meet_country, meet_state, meet_town
            FROM meets WHERE meet_id = ?
        `,
            id,
        );
        if (!meet) return undefined;
        const rows = all<MeetEntry>(
            this.db,
            `
            SELECT e.*, m.federation, m.meet_date, m.meet_country, m.meet_state,
                   m.meet_town, m.meet_name, l.name AS lifter_name
            FROM meets m
            JOIN entries e ON e.meet_id = m.meet_id
            JOIN lifters l ON l.lifter_id = e.lifter_id
            WHERE m.meet_id = ? AND e.dots > 0
            ORDER BY e.dots DESC
        `,
            meet.meet_id,
        );
        return {
            name: meet.meet_name,
            federation: meet.federation,
            date: meet.meet_date,
            year: meet.meet_date.slice(0, 4),
            url: null,
            country: meet.meet_country,
            state: meet.meet_state,
            town: meet.meet_town,
            entries: rows.map((row) => ({
                ...entryResult(row),
                name: row.lifter_name,
                sex: row.sex ?? '',
            })),
        };
    }

    getTopLifters(): TopLifter[] {
        const results: TopLifter[] = [];
        const seen = new Set<number>();
        const rows = this.db
            .prepare(
                `
            SELECT e.lifter_id, l.name, e.sex, e.best3_squat_kg, e.best3_bench_kg,
                   e.best3_deadlift_kg, e.total_kg, e.dots
            FROM entries e JOIN lifters l ON l.lifter_id = e.lifter_id
            WHERE e.equipment IN ('Raw', 'Wraps') AND e.dots > 0
            ORDER BY e.dots DESC
        `,
            )
            .iterate();
        for (const row of rows) {
            const id = row.lifter_id as number;
            if (seen.has(id)) continue;
            seen.add(id);
            const name = row.name as string;
            results.push({
                name,
                sex: (row.sex as string | null) ?? 'U',
                url: lifterUrl(name),
                squat: row.best3_squat_kg as number | null,
                bench: row.best3_bench_kg as number | null,
                deadlift: row.best3_deadlift_kg as number | null,
                total: row.total_kg as number | null,
                dots: row.dots as number,
            });
            if (results.length === 20) break;
        }
        return results;
    }

    getLifterAutocomplete(query: string, limit = 10): string[] {
        return searchNames(this.lifterNames, query, limit);
    }

    getMeetAutocomplete(query: string, limit = 10): string[] {
        return searchNames(this.meetNames, query, limit);
    }
}
