import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Where test files live
  testDir: './e2e',

  // Max time a single test can run (checkout flow can be slow)
  timeout: 60_000,

  // Retry failed tests once (network flakiness with Docker services)
  retries: 1,

  // Run tests sequentially — E2E tests share state (registered user, cart)
  fullyParallel: false,

  // Reporter: show each test step in terminal
  reporter: 'list',

  use: {
    // Base URL — all page.goto('/path') calls resolve against this
    baseURL: 'http://localhost:3000',

    // Capture screenshot on failure for debugging
    screenshot: 'only-on-failure',

    // Record trace on first retry — gives full timeline of what happened
    trace: 'on-first-retry',
  },

  // Only test in Chromium (keeps it fast)
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],

  // Start the Next.js dev server before tests run
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Wait up to 60s for the dev server to start
    timeout: 60_000,
    // Reuse an already-running dev server if one exists
    reuseExistingServer: true,
  },
});
