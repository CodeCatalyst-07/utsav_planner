import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**', 'coverage/**', 'test-results/**'],
  },
  ...compat.extends('next/core-web-vitals', 'plugin:jsx-a11y/recommended'),
  {
    files: ['src/domain/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'src/domain must be pure TypeScript. No React imports allowed.',
            },
            {
              name: 'next',
              message: 'src/domain must be pure TypeScript. No Next.js imports allowed.',
            },
            {
              name: 'server-only',
              message: 'src/domain must be pure TypeScript. No server-only imports allowed.',
            },
          ],
          patterns: [
            {
              group: [
                'next/*',
                'react/*',
                '@/server',
                '@/server/*',
                'src/server',
                'src/server/*',
                '../server/*',
                '../../server/*',
              ],
              message: 'src/domain cannot import from Next.js, React, or server modules.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
