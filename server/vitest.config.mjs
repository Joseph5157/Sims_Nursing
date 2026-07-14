import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.mjs'],
    env: {
      DATABASE_URL: 'postgresql://localhost:5432/test_fake',
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '7d',
    },
  },
});
