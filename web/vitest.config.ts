import { getViteConfig } from 'astro/config';
import type {} from 'vitest/config';

export default getViteConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            thresholds: {
                lines: 80,
                statements: 80,
                functions: 80,
                branches: 80,
            },
            reporter: ['text', 'lcov'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{ts,astro}'],
        },
    },
});
