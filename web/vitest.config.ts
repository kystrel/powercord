import { getViteConfig } from 'astro/config';
import type {} from 'vitest/config';

export default getViteConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,astro}'],
        },
    },
});
