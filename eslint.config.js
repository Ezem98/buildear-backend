import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: [
            'coverage/**',
            'dist/**',
            'node_modules/**',
            'palworld-discord-bot/**',
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
    {
        files: ['**/*.ts'],
        rules: {
            'no-undef': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    }
)
