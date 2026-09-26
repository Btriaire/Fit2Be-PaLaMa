import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globalSetup: ['./vitest.global.ts'],
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
})
