import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function check(
    options: {
        runId?: string;
        watchStatus?: number;
        lookupStatus?: number;
    } = {},
) {
    const dir = mkdtempSync(join(tmpdir(), 'powercord-ci-check-'));
    const log = join(dir, 'commands');
    writeFileSync(log, '');
    writeFileSync(
        join(dir, 'gh'),
        `#!${process.execPath}
const { appendFileSync } = require('node:fs');
appendFileSync(process.env.TEST_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[3] === 'list') {
  console.log(process.env.RUN_ID);
  process.exit(Number(process.env.LOOKUP_STATUS));
}
process.exit(Number(process.env.WATCH_STATUS));
`,
        { mode: 0o755 },
    );
    writeFileSync(join(dir, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    try {
        const result = spawnSync(
            'bash',
            [resolve('../.github/scripts/require-ci.sh')],
            {
                encoding: 'utf8',
                env: {
                    ...process.env,
                    PATH: `${dir}:${process.env.PATH}`,
                    GITHUB_REPOSITORY: 'kystrel/powercord',
                    GITHUB_SHA: 'a'.repeat(40),
                    TEST_LOG: log,
                    RUN_ID: options.runId ?? '123',
                    WATCH_STATUS: String(options.watchStatus ?? 0),
                    LOOKUP_STATUS: String(options.lookupStatus ?? 0),
                },
            },
        );
        return {
            ...result,
            commands: readFileSync(log, 'utf8')
                .trim()
                .split('\n')
                .filter(Boolean)
                .map((line) => JSON.parse(line) as string[]),
        };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

describe('deployment CI gate', () => {
    it('waits for master push or manual CI at the exact commit and requires success', () => {
        const result = check();
        expect(result.status).toBe(0);
        expect(result.commands[0]).toEqual([
            'run',
            'list',
            '--repo',
            'kystrel/powercord',
            '--workflow',
            'ci.yml',
            '--commit',
            'a'.repeat(40),
            '--branch',
            'master',
            '--limit',
            '20',
            '--json',
            'databaseId,event',
            '--jq',
            'map(select(.event == "push" or .event == "workflow_dispatch")) | .[0].databaseId // empty',
        ]);
        expect(result.commands[1]).toEqual([
            'run',
            'watch',
            '123',
            '--repo',
            'kystrel/powercord',
            '--exit-status',
        ]);
    });
    it('blocks deployment when CI fails or is cancelled', () => {
        expect(check({ watchStatus: 1 }).status).toBe(1);
    });
    it('fails closed when GitHub cannot list runs', () => {
        const result = check({ lookupStatus: 1 });
        expect(result.status).toBe(1);
        expect(result.commands).toHaveLength(1);
    });
    it('fails when no matching CI run appears', () => {
        const result = check({ runId: '' });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain('No master CI run found');
        expect(result.commands).toHaveLength(60);
    });
});
