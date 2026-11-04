// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['server/**/*.js', 'shared/**/*.js'],
      exclude: [
        'server/index.js',
        'server/api/app.js',
        'server/app/bootstrap.js',
        'server/app/startup.js',
        '**/*.test.js',
      ],
    },
  },
});