import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { site } from './src/config/site.ts';

export default defineConfig({
    site: site.url,
    build: { inlineStylesheets: 'never' },
    vite: { plugins: [tailwindcss()] },
});
