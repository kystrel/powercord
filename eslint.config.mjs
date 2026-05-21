import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const compat = new FlatCompat({
    baseDirectory: dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    ...compat.extends('eslint:recommended', 'prettier'),

    globalIgnores([
        '**/.nuxt',
        '**/.data',
        '**/.output',
        '**/coverage',
        '**/dist',
    ]),

    {
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },

            parser: tseslint.parser,
            ecmaVersion: 2021,
            sourceType: 'commonjs',
        },

        rules: {
            'no-console': 'warn',
            'no-empty-function': 'error',
            'no-return-assign': 'error',

            'no-shadow': [
                'error',
                {
                    allow: ['err', 'resolve', 'reject'],
                },
            ],

            'prefer-const': 'warn',
        },
    },
];
