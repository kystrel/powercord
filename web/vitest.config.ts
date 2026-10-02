import { defineVitestConfig } from '@nuxt/test-utils/config';

export default defineVitestConfig({
    resolve: {
        dedupe: [
            'vue',
            '@vue/runtime-core',
            '@vue/runtime-dom',
            '@vue/reactivity',
        ],
    },
    test: {
        environment: 'nuxt',
        environmentOptions: {
            nuxt: {
                domEnvironment: 'jsdom',
            },
        },
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
            include: ['app/**/*.{js,ts,vue}'],
        },
    },
});
