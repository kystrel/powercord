const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-05-15',
    future: {
        compatibilityVersion: 4,
    },
    devtools: { enabled: !isTest },
    hooks: {
        ready(nuxt) {
            if (isTest) {
                // Nuxt 4.4.6 runtimeConfig needs to be plain-cloned for @nuxt/test-utils.
                nuxt.options.runtimeConfig = JSON.parse(
                    JSON.stringify(nuxt.options.runtimeConfig),
                );
            }
        },
    },

    app: {
        head: {
            title: 'PowerCord | Powerlifting competition results in Discord', // Default fallback title
            htmlAttrs: {
                lang: 'en',
            },
            link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
        },
    },

    modules: [
        '@nuxt/icon',
        '@nuxt/image',
        '@nuxt/test-utils',
        '@nuxt/ui',
        '@nuxt/fonts',
        '@nuxt/eslint',
        '@nuxtjs/tailwindcss',
    ],

    css: ['~/assets/css/main.css'],
});
