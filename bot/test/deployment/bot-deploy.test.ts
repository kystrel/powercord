import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
const instance = 'i-0123456789abcdef0';
const sha = 'b'.repeat(40);

afterEach(() => {
    for (const directory of directories.splice(0))
        rmSync(directory, { recursive: true, force: true });
});

function deployment(
    options: {
        initExit?: number;
        marker?: boolean;
        instance?: string;
        phase?: string;
    } = {},
) {
    const dir = mkdtempSync(join(tmpdir(), 'powercord-bot-deploy-'));
    directories.push(dir);
    const log = join(dir, 'commands');
    writeFileSync(log, '');
    if (options.marker !== false) writeFileSync(join(dir, 'api-start.sh'), '');
    writeFileSync(join(dir, 'cloud-init.log'), 'initialization diagnostics');
    writeFileSync(
        join(dir, 'cloud-init'),
        '#!/usr/bin/env bash\nexit "$INIT_EXIT"\n',
        {
            mode: 0o755,
        },
    );
    writeFileSync(
        join(dir, 'aws'),
        `#!${process.execPath}
const { appendFileSync, readFileSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const args = process.argv.slice(2);
const dir = process.env.TEST_DIR;
appendFileSync(process.env.TEST_LOG, JSON.stringify(args) + '\\n');
const option = (key) => args[args.indexOf(key) + 1];
if (args[0] === 'cloudformation') {
  console.log(process.env.STACK_INSTANCE);
} else if (args[1] === 'describe-instance-information') {
  console.log(process.env.STACK_INSTANCE);
} else if (args[1] === 'send-command') {
  const command = JSON.parse(option('--parameters')).commands[0];
  if (command.startsWith('cloud-init')) {
    const result = spawnSync('bash', ['-c', command
      .replaceAll('/opt/powercord-start.sh', join(dir, 'api-start.sh'))
      .replaceAll('/var/log/cloud-init-output.log', join(dir, 'cloud-init.log'))],
      { encoding: 'utf8' });
    writeFileSync(join(dir, 'init-status'), result.status === 0 ? 'Success' : 'Failed');
    writeFileSync(join(dir, 'init-output'), result.stdout + result.stderr);
    console.log('init-command');
  } else {
    console.log('deploy-command');
  }
} else if (args[1] === 'get-command-invocation') {
  if (option('--command-id') === 'init-command') {
    console.log(readFileSync(join(dir, option('--query') === 'Status' ? 'init-status' : 'init-output'), 'utf8'));
  } else {
    console.log('Success');
  }
} else {
  process.exit(1);
}
`,
        { mode: 0o755 },
    );
    const result = spawnSync(
        'bash',
        [
            join(
                dirname(fileURLToPath(import.meta.url)),
                '../../../.github/scripts/bot-deploy.sh',
            ),
            sha,
            options.phase ?? 'all',
            instance,
        ],
        {
            env: {
                ...process.env,
                PATH: `${dir}:${process.env.PATH}`,
                GITHUB_OUTPUT: join(dir, 'output'),
                TEST_DIR: dir,
                TEST_LOG: log,
                INIT_EXIT: String(options.initExit ?? 0),
                STACK_INSTANCE: options.instance ?? instance,
            },
            encoding: 'utf8',
        },
    );
    return { result, commands: readFileSync(log, 'utf8'), dir };
}

describe('Bot deployment readiness', () => {
    it('deploys to the stack-managed instance after successful initialization', () => {
        const { result, commands } = deployment();
        expect(result.status, result.stderr).toBe(0);
        expect(commands).toContain('PowercordBotStack');
        expect(commands).toContain('BotInstanceId');
        expect(commands).not.toContain('describe-instances');
        expect(commands).toContain(`"--instance-ids","${instance}"`);
        expect(commands).toContain(`/opt/powercord-start.sh ${sha}`);
    });

    it('exports the managed instance for the separate deployment phase', () => {
        const { result, commands, dir } = deployment({ phase: 'wait' });
        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(join(dir, 'output'), 'utf8')).toBe(
            `instance_id=${instance}\n`,
        );
        expect(commands).not.toContain(`/opt/powercord-start.sh ${sha}`);
    });

    it('deploys to the previously verified instance without rediscovering the host', () => {
        const { result, commands } = deployment({ phase: 'deploy' });
        expect(result.status, result.stderr).toBe(0);
        expect(commands).not.toContain('cloudformation');
        expect(commands).not.toContain('cloud-init');
        expect(commands).toContain(`"--instance-ids","${instance}"`);
        expect(commands).toContain(`/opt/powercord-start.sh ${sha}`);
    });

    it.each([1, 2])(
        'rejects cloud-init exit %i even when the start script exists',
        (initExit) => {
            const { result, commands } = deployment({ initExit });
            expect(result.status).not.toBe(0);
            expect(result.stderr).toContain('initialization diagnostics');
            expect(result.stderr).toContain(`cloud-init exit ${initExit}`);
            expect(commands).not.toContain(`/opt/powercord-start.sh ${sha}`);
        },
    );

    it('rejects a missing start script after successful cloud-init', () => {
        const { result, commands } = deployment({ marker: false });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('Host initialization failed');
        expect(commands).not.toContain(`/opt/powercord-start.sh ${sha}`);
    });

    it.each(['None', '', 'another-instance'])(
        'rejects an invalid stack instance: %s',
        (id) => {
            const { result, commands } = deployment({ instance: id });
            expect(result.status).not.toBe(0);
            expect(result.stderr).toContain('no valid BotInstanceId');
            expect(commands).not.toContain('ssm');
        },
    );
});
