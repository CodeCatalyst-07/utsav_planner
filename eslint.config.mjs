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
    rules: {
      // Custom overrides if needed
    },
  },
];

export default eslintConfig;
