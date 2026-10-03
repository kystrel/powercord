import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import BaseHead from '../src/components/BaseHead.astro';
import { site } from '../src/config/site';
import NotFound from '../src/pages/404.astro';
import Index from '../src/pages/index.astro';

describe('website content', () => {
    it('preserves the public links, feature cards, landmarks and license', async () => {
        const container = await AstroContainer.create();
        const html = await container.renderToString(Index, {
            request: new Request('https://preview.example/'),
        });
        const { document } = new JSDOM(html).window;
        expect(document.querySelectorAll('main')).toHaveLength(1);
        expect(document.querySelector('header a')?.getAttribute('href')).toBe(
            '/',
        );
        expect(document.querySelector('header nav, header details')).toBeNull();
        expect(document.querySelectorAll('header a')).toHaveLength(1);
        expect(document.querySelector('h1')?.textContent).toContain(
            'Powerlifting competition results in',
        );
        expect(
            Array.from(
                document.querySelectorAll('h2'),
                (heading) => heading.textContent,
            ),
        ).toEqual([
            'Zero Configuration',
            'Always Up-to-date',
            'Open Source',
            'Support Available',
        ]);
        for (const href of Object.values(site.links)) {
            expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull();
        }
        for (const anchor of document.querySelectorAll('a[target="_blank"]')) {
            expect(anchor.getAttribute('rel')).toContain('noopener');
        }
        expect(document.querySelector('footer')?.textContent).toContain(
            `2024-${new Date().getFullYear()}`,
        );
        expect(document.querySelector('footer a')?.getAttribute('href')).toBe(
            `${site.links.source}/blob/master/LICENSE`,
        );
        expect(document.querySelector('iframe, script')).toBeNull();
    });

    it('uses the production canonical URL on preview hosts', async () => {
        const container = await AstroContainer.create();
        const html = await container.renderToString(BaseHead, {
            request: new Request('https://preview.example/?tracking=1'),
        });
        const { document } = new JSDOM(`<head>${html}</head>`).window;
        expect(
            document
                .querySelector('link[rel="canonical"]')
                ?.getAttribute('href'),
        ).toBe(`${site.url}/`);
        expect(
            document
                .querySelector('meta[property="og:image"]')
                ?.getAttribute('content'),
        ).toBe(`${site.url}/ogImage.png`);
        expect(document.querySelector('meta[name="robots"]')).toBeNull();
    });

    it('provides a noindex error page and a working home link', async () => {
        const container = await AstroContainer.create();
        const html = await container.renderToString(NotFound, {
            request: new Request('https://preview.example/404'),
        });
        const { document } = new JSDOM(html).window;
        expect(document.title).toBe('Page not found | PowerCord');
        expect(
            document
                .querySelector('meta[name="robots"]')
                ?.getAttribute('content'),
        ).toBe('noindex');
        expect(document.querySelector('main a')?.getAttribute('href')).toBe(
            '/',
        );
    });
});
