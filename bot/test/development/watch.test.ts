import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

it.each([false, true])(
    'restarts for nested TypeScript edits, additions and removals while ignoring other files (polling: %s)',
    async (polling) => {
        const directory = await mkdtemp(join(tmpdir(), 'powercord-watch-'));
        await mkdir(join(directory, 'src/events'), { recursive: true });
        await mkdir(join(directory, 'dist'));
        await copyFile(
            new URL('../../nodemon.json', import.meta.url),
            join(directory, 'nodemon.json'),
        );
        await writeFile(
            join(directory, 'src/index.ts'),
            "console.log('fixture-ready'); setInterval(() => {}, 1000);\n",
        );
        const file = join(directory, 'src/events/unused.ts');
        await writeFile(file, 'export const value = 1;\n');
        const child = spawn(
            process.execPath,
            [require.resolve('nodemon/bin/nodemon.js'), '--verbose'],
            {
                cwd: directory,
                env: {
                    ...process.env,
                    NODE_ENV: 'development',
                    CHOKIDAR_USEPOLLING: String(polling),
                    PATH: `${fileURLToPath(new URL('../../node_modules/.bin', import.meta.url))}:${process.env.PATH}`,
                    TS_NODE_PROJECT: fileURLToPath(
                        new URL('../../tsconfig.json', import.meta.url),
                    ),
                },
            },
        );
        let output = '';
        child.stdout.on('data', (chunk) => {
            output += chunk;
        });
        child.stderr.on('data', (chunk) => {
            output += chunk;
        });
        const starts = () => output.match(/fixture-ready/g)?.length ?? 0;
        const waitForStart = (count: number) =>
            vi.waitFor(() => expect(starts(), output).toBe(count), {
                timeout: 15000,
            });
        try {
            await waitForStart(1);
            await vi.waitFor(
                () => expect(output).toContain('watching 2 files'),
                {
                    timeout: 5000,
                },
            );
            await writeFile(file, 'export const value = 2;\n');
            await waitForStart(2);
            const added = join(directory, 'src/events/new.ts');
            await writeFile(added, 'export const added = true;\n');
            await waitForStart(3);
            await rm(added);
            await waitForStart(4);
            await writeFile(join(directory, 'src/ignored.txt'), 'ignored');
            await writeFile(join(directory, 'dist/ignored.ts'), 'export {};\n');
            await new Promise((resolve) => setTimeout(resolve, 750));
            expect(starts(), output).toBe(4);
        } finally {
            if (child.exitCode === null && child.signalCode === null) {
                const exit = once(child, 'exit');
                child.kill('SIGTERM');
                await exit;
            }
            await rm(directory, { recursive: true, force: true });
        }
    },
    45000,
);
