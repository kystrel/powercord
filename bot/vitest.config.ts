import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: [
                'src/types/**',
                'src/data/mock/**',
                'src/data/mockClient.ts',
            ],
            thresholds: {
                lines: 80,
                statements: 80,
                functions: 80,
                branches: 80,
            },
            reporter: ['text', 'lcov'],
            reportsDirectory: './coverage',
        },
    },
});
