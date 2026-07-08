const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'marked.min.js',
            'pdf.min.js',
            'pdf.worker.min.js',
            'Readability.js',
            'bridge/**'
        ]
    },

    // Modular ES-module code (side panel app)
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.browser,
                chrome: 'readonly',
                CONFIG: 'readonly',
                marked: 'readonly',
                pdfjsLib: 'readonly',
                Readability: 'readonly'
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: ['error', 'smart']
        }
    },

    // Plain scripts: service worker, content script, config
    {
        files: ['background.js', 'content.js', 'config.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.browser,
                ...globals.node,
                chrome: 'readonly',
                CONFIG: 'writable',
                Readability: 'readonly',
                importScripts: 'readonly'
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^CONFIG$', caughtErrors: 'none' }
            ],
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: ['error', 'smart']
        }
    }
];
