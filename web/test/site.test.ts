import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { PreviewServer } from 'astro';
import axe from 'axe-core';
import { chromium, type Browser } from 'playwright';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const { build, preview }: typeof import('astro') = createRequire(
    import.meta.url,
)('astro');

let server: PreviewServer;
let browser: Browser;
let url: string;
let headers: Record<string, string>;

declare global {
    interface Window {
        axe: typeof axe;
    }
}

beforeAll(async () => {
    await build({
        root: fileURLToPath(new URL('../', import.meta.url)),
        logLevel: 'warn',
    });
    server = await preview({
        root: fileURLToPath(new URL('../', import.meta.url)),
        server: { host: '127.0.0.1', port: 0 },
        logLevel: 'warn',
    });
    url = `http://127.0.0.1:${server.port}`;
    browser = await chromium.launch();
    const rules = await readFile(
        new URL('../dist/_headers', import.meta.url),
        'utf8',
    );
    headers = Object.fromEntries(
        rules
            .trim()
            .split('\n')
            .slice(1)
            .map((line) => {
                const separator = line.indexOf(':');
                return [
                    line.slice(0, separator).trim(),
                    line.slice(separator + 1).trim(),
                ];
            }),
    );
}, 60000);

afterAll(async () => {
    await browser?.close();
    await server?.stop();
});

describe('built static website', () => {
    it.each([360, 768, 1440])(
        'renders and passes accessibility checks at %ipx',
        async (width) => {
            const context = await browser.newContext({
                viewport: { width, height: 900 },
                deviceScaleFactor: 2,
            });
            try {
                await context.route(`${url}/**`, async (route) => {
                    const response = await route.fetch();
                    await route.fulfill({
                        response,
                        headers: { ...response.headers(), ...headers },
                    });
                });
                const page = await context.newPage();
                const response = await page.goto(url);
                expect(response?.status()).toBe(200);
                await page.evaluate(() => document.fonts.ready);
                expect(await page.title()).toBe(
                    'PowerCord | Powerlifting competition results in Discord',
                );
                expect(
                    await page
                        .getByRole('link', { name: 'Add to Discord' })
                        .getAttribute('href'),
                ).toContain('client_id=1306740469484486697');
                expect(
                    await page
                        .getByRole('link', { name: 'View on GitHub' })
                        .getAttribute('href'),
                ).toBe('https://github.com/kystrel/powercord');
                const logo = page.locator('header img');
                const logoSource = await logo.evaluate(
                    (image: HTMLImageElement) => image.currentSrc,
                );
                const logoMetadata = await sharp(
                    Buffer.from(await (await fetch(logoSource)).arrayBuffer()),
                ).metadata();
                const logoWidth = await logo.evaluate(
                    (image) => image.getBoundingClientRect().width,
                );
                expect(logoMetadata.width).toBeGreaterThanOrEqual(
                    logoWidth * 2,
                );
                expect(
                    await page.locator('script, style, [style]').count(),
                ).toBe(0);
                expect(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <=
                            window.innerWidth,
                    ),
                ).toBe(true);
                const screenshot = page.getByRole('img', {
                    name: 'PowerCord meet results, lifter profiles, and top totals in Discord',
                });
                expect(
                    await screenshot.evaluate(
                        (image: HTMLImageElement) =>
                            image.complete && image.naturalWidth > 0,
                    ),
                ).toBe(true);
                expect(await screenshot.getAttribute('srcset')).toContain(
                    '480w',
                );
                await page.evaluate(axe.source);
                const accessibility = await page.evaluate(async () =>
                    window.axe.run(),
                );
                expect(accessibility.violations).toEqual([]);
            } finally {
                await context.close();
            }
        },
    );

    it('serves the share image, favicon and robots file at their existing URLs', async () => {
        const response = await fetch(`${url}/ogImage.png`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('image/png');
        const metadata = await sharp(
            Buffer.from(await response.arrayBuffer()),
        ).metadata();
        expect([metadata.width, metadata.height]).toEqual([1200, 630]);
        expect((await fetch(`${url}/favicon.ico`)).status).toBe(200);
        expect(await (await fetch(`${url}/robots.txt`)).text()).toContain(
            'User-Agent: *',
        );
    });

    it('returns a real 404 for unknown routes', async () => {
        const response = await fetch(`${url}/missing-page`);
        expect(response.status).toBe(404);
        expect(await response.text()).toContain('Return to PowerCord');
    });
});
