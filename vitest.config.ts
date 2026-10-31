import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}', 'tests/component/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/domain/**/*.ts',
        'src/server/**/*.ts',
        'src/lib/**/*.ts',
        'src/context/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/domain/fixtures/**',
        'src/domain/index.ts',
        'src/domain/config/types.ts',
        'src/domain/**/README.md',
        'src/server/**/README.md',
      ],
      thresholds: {
        lines: 85,
        branches: 80,
        'src/domain/**/*.ts': {
          lines: 90,
          branches: 80,
        },
        'src/server/**/*.ts': {
          lines: 85,
        },
        'src/lib/**/*.ts': {
          lines: 85,
        },
        'src/context/**/*.{ts,tsx}': {
          lines: 85,
        },
        'src/server/ai/chain.ts': {
          lines: 90,
          branches: 80,
        },
        'src/server/ai/critic.ts': {
          branches: 80,
        },
        'src/server/vendors/places.ts': {
          branches: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/mocks/server-only.ts'),
    },
  },
});
